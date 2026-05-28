'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RTMClient } from 'agora-rtm';
import type {
  AgentResponse,
  AgoraRenewalTokens,
  AgoraTokenData,
  ClientStartRequest,
} from '@/features/conversation/types';

export interface UseAgoraSessionResult {
  showConversation: boolean;
  isLoading: boolean;
  error: string | null;
  agentJoinError: boolean;
  agoraData: AgoraTokenData | null;
  rtmClient: RTMClient | null;
  startConversation: (language?: string) => Promise<void>;
  endConversation: () => void;
  handleTokenWillExpire: (uid: string) => Promise<AgoraRenewalTokens>;
}

// Orchestrates a single call: token fetch → parallel agent invite + RTM login → teardown.
// Owned by the landing page; ConversationShell receives the resulting objects via props.
export function useAgoraSession(): UseAgoraSessionResult {
  const [showConversation, setShowConversation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agoraData, setAgoraData] = useState<AgoraTokenData | null>(null);
  const [rtmClient, setRtmClient] = useState<RTMClient | null>(null);
  const [agentJoinError, setAgentJoinError] = useState(false);

  // Preload heavy modules on mount so they're already cached when the user clicks
  // "Try it now!" — eliminates the ~1.8s dynamic-import delay.
  useEffect(() => {
    import('agora-rtc-react').catch(() => {});
    import('agora-rtm').catch(() => {});
  }, []);

  const startConversation = useCallback(async (language?: string) => {
    setIsLoading(true);
    setError(null);
    setAgentJoinError(false);

    try {
      // 1. Fetch RTC token + channel
      const agoraResponse = await fetch('/api/generate-agora-token');
      const responseData = await agoraResponse.json();

      if (!agoraResponse.ok) {
        throw new Error(
          `Failed to generate Agora token: ${JSON.stringify(responseData)}`,
        );
      }

      // 2. Agent invite and RTM setup run in parallel — both only need the token response.
      //    RTM must be ready before ConversationShell mounts so AgoraVoiceAI can subscribe
      //    immediately. Agent invite is non-fatal: a failure still lets the call proceed so
      //    the user can see the UI and retry.
      const [agentData, rtm] = await Promise.all([
        fetch('/api/invite-agent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requester_id: responseData.uid,
            channel_name: responseData.channel,
            language: language || 'en-US',
          } as ClientStartRequest),
        })
          .then(async (res) => {
            if (!res.ok) {
              setAgentJoinError(true);
              return null;
            }
            return res.json() as Promise<AgentResponse>;
          })
          .catch((err) => {
            console.error('Failed to start conversation with agent:', err);
            setAgentJoinError(true);
            return null;
          }),

        (async () => {
          const { default: AgoraRTM } = await import('agora-rtm');
          const rtm: RTMClient = new AgoraRTM.RTM(
            process.env.NEXT_PUBLIC_AGORA_APP_ID!,
            String(Date.now()),
          );
          await rtm.login({ token: responseData.token });
          await rtm.subscribe(responseData.channel);
          return rtm;
        })(),
      ]);

      setRtmClient(rtm);
      setAgoraData({ ...responseData, agentId: agentData?.agent_id });
      setShowConversation(true);
    } catch (err) {
      setError('Failed to start conversation. Please try again.');
      console.error('Error starting conversation:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleTokenWillExpire = useCallback(
    async (uid: string): Promise<AgoraRenewalTokens> => {
      try {
        const channel = agoraData?.channel;
        if (!channel) {
          throw new Error('Missing channel for token renewal');
        }

        // RTC and RTM tokens renew independently:
        //   - RTC uses the browser client's assigned UID (passed in from ConversationShell).
        //   - RTM uses uid=0 because buildTokenWithRtm embeds RTM capability by AppID+channel,
        //     not by a specific RTM userId — so uid=0 is valid for any RTM client instance.
        // Both are fetched in parallel to stay within the token-expiry grace-period window.
        const [rtcResponse, rtmResponse] = await Promise.all([
          fetch(`/api/generate-agora-token?channel=${channel}&uid=${uid}`),
          fetch(`/api/generate-agora-token?channel=${channel}&uid=0`),
        ]);
        const [rtcData, rtmData] = await Promise.all([
          rtcResponse.json(),
          rtmResponse.json(),
        ]);

        if (!rtcResponse.ok || !rtmResponse.ok) {
          throw new Error('Failed to generate renewal tokens');
        }

        return {
          rtcToken: rtcData.token,
          rtmToken: rtmData.token,
        };
      } catch (error) {
        console.error('Error renewing token:', error);
        throw error;
      }
    },
    [agoraData],
  );

  // End-call flow: unmount the conversation UI first so the landing screen appears
  // immediately, then clean up the agent and RTM in the background. We don't block the UI
  // on the stop-agent fetch because the server-side session also honors its idle timeout —
  // the network call is a courtesy, not a correctness requirement.
  const endConversation = useCallback(() => {
    const agentId = agoraData?.agentId;
    const rtm = rtmClient;
    setRtmClient(null);
    setShowConversation(false);
    if (agentId) {
      fetch('/api/stop-conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId }),
      })
        .then((response) => {
          if (!response.ok) {
            response
              .text()
              .then((text) => console.error('Failed to stop agent:', text));
          }
        })
        .catch((err) => console.error('Error stopping agent:', err));
    }
    rtm?.logout().catch((err) => console.error('RTM logout error:', err));
  }, [agoraData?.agentId, rtmClient]);

  return {
    showConversation,
    isLoading,
    error,
    agentJoinError,
    agoraData,
    rtmClient,
    startConversation,
    endConversation,
    handleTokenWillExpire,
  };
}
