import { NextRequest, NextResponse } from 'next/server';
import {
  AgoraClient,
  Agent,
  Area,
  DeepgramSTT,
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
  GREETING,
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
    const { requester_id, channel_name } = body;

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

    // VoxAgent pipeline: Deepgram STT → Xiaomi MiMo LLM → MiniMax TTS
    const agent = new Agent({
      name: `voxagent-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      instructions: ADA_PROMPT,
      greeting: GREETING,
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
        new DeepgramSTT({
          model: 'nova-3',
          language: 'en',
        }),
      )
      .withLlm(
        // BYOK: Xiaomi MiMo as custom LLM
        new OpenAI({
          apiKey: requireEnv('NEXT_LLM_API_KEY'),
          url: requireEnv('NEXT_LLM_URL'),
          model: process.env.NEXT_LLM_MODEL || 'mimo-v2.5-pro',
          greetingMessage: GREETING,
          failureMessage: 'Sorry, I had a hiccup. Give me a moment please.',
          maxHistory: 15,
          maxTokens: 1024,
          temperature: 0.7,
          topP: 0.95,
        }),
      )
      .withTts(
        new MiniMaxTTS({
          model: 'speech_2_6_turbo',
          voiceId: 'English_captivating_female1',
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
