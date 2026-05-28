import { NextRequest, NextResponse } from 'next/server';
import {
  AgoraClient,
  Agent,
  Area,
  AresSTT,
  ExpiresIn,
  MiniMaxTTS,
  OpenAI,
} from 'agora-agent-server-sdk';
import type {
  ClientStartRequest,
  AgentResponse,
} from '@/features/conversation/types';
import {
  ADA_PROMPT,
  AGENT_UID,
  getLanguageConfig,
} from '@/features/conversation/server/invite-agent-config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export async function POST(request: NextRequest) {
  try {
    // --- 1. Parse request ---
    const body: ClientStartRequest = await request.json();
    const { requester_id, channel_name, language } = body;
    
    // Get language-specific configuration
    const langConfig = getLanguageConfig(language);
    const greeting = langConfig.greeting;
    const instructions = ADA_PROMPT + langConfig.promptSuffix;

    const appId = requireEnv('NEXT_PUBLIC_AGORA_APP_ID');
    const appCertificate = requireEnv('NEXT_AGORA_APP_CERTIFICATE');

    if (!channel_name || !requester_id) {
      return NextResponse.json(
        { error: 'channel_name and requester_id are required' },
        { status: 400 },
      );
    }

    // --- 2. Build and start the agent ---

    // Using Asia-Pacific area for Singapore deployment
    const client = new AgoraClient({
      area: Area.AP,
      appId,
      appCertificate,
    });

    // VoxAgent pipeline: Ares STT (Agora built-in) → Xiaomi MiMo LLM → MiniMax TTS (Agora built-in)
    const agent = new Agent({
      name: `voxagent-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      instructions,
      greeting,
      failureMessage: 'Sorry, I had a hiccup. Give me a moment please.',
      maxHistory: 50,
      turnDetection: {
        config: {
          speech_threshold: 0.5,
          start_of_speech: {
            mode: 'vad',
            vad_config: {
              interrupt_duration_ms: 160,
              prefix_padding_ms: 300,
            },
          },
          end_of_speech: {
            mode: 'vad',
            vad_config: {
              silence_duration_ms: 480,
            },
          },
        },
      },
      advancedFeatures: { enable_rtm: true, enable_tools: true },
      parameters: { data_channel: 'rtm', enable_error_message: true },
    })
      .withStt(
        // Ares: Agora's built-in ASR — no external API key required
        new AresSTT({
          language: langConfig.sttLanguage,
        }),
      )
      .withLlm(
        // BYOK: Xiaomi MiMo as custom LLM (OpenAI-compatible)
        new OpenAI({
          apiKey: requireEnv('NEXT_LLM_API_KEY'),
          url: requireEnv('NEXT_LLM_URL'),
          model: process.env.NEXT_LLM_MODEL || 'mimo-v2.5-pro',
          greetingMessage: greeting,
          failureMessage: 'Sorry, I had a hiccup. Give me a moment please.',
          maxHistory: 15,
          maxTokens: 1024,
          temperature: 0.7,
          topP: 0.95,
        }),
      )
      .withTts(
        // MiniMax TTS via Agora's built-in access (no external key needed)
        new MiniMaxTTS({
          model: 'speech_2_6_turbo',
          voiceId: langConfig.ttsVoiceId,
        }),
      );

    const session = agent.createSession(client, {
      channel: channel_name,
      agentUid: AGENT_UID,
      remoteUids: [requester_id],
      idleTimeout: 30,
      expiresIn: ExpiresIn.hours(1),
      debug: false,
    });

    const agentId = await session.start();

    return NextResponse.json({
      agent_id: agentId,
      create_ts: Math.floor(Date.now() / 1000),
      state: 'RUNNING',
    } as AgentResponse);
  } catch (error) {
    console.error('Error starting conversation:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to start conversation',
      },
      { status: 500 },
    );
  }
}
