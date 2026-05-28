'use client';

import { useRef, useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { Ambient, BrandMark, ErrorToast } from '@/components/convo-ui';
import { useAgoraSession } from '@/features/conversation/hooks/useAgoraSession';
import { ADA_AGENT_NAME } from '@/features/conversation/lib/view-state';

// Dynamically import the ConversationShell with ssr disabled.
const ConversationShell = dynamic(() => import('./ConversationShell'), {
  ssr: false,
});

// Dynamically import AgoraRTCProvider (browser-only). The AgoraVoiceAI toolkit is
// initialized inside ConversationShell after the RTC join succeeds, so this wrapper
// only needs to provide the RTC client.
const AgoraProvider = dynamic(
  async () => {
    const { AgoraRTCProvider, default: AgoraRTC } =
      await import('agora-rtc-react');
    return {
      default: function AgoraProviders({
        children,
      }: {
        children: React.ReactNode;
      }) {
        // useRef persists across StrictMode's simulated unmount/remount, so only
        // one RTC client is ever created per session (useMemo creates two in StrictMode).
        const clientRef = useRef<ReturnType<
          typeof AgoraRTC.createClient
        > | null>(null);
        if (!clientRef.current) {
          clientRef.current = AgoraRTC.createClient({
            mode: 'rtc',
            codec: 'vp8',
          });
        }
        return (
          <AgoraRTCProvider client={clientRef.current}>
            {children}
          </AgoraRTCProvider>
        );
      },
    };
  },
  { ssr: false },
);

export default function LandingPage() {
  const {
    showConversation,
    isLoading,
    error,
    agentJoinError,
    agoraData,
    rtmClient,
    startConversation,
    endConversation,
    handleTokenWillExpire,
  } = useAgoraSession();
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');

  // In-call path: ConversationShell owns its own shell. We just mount it inside the RTC
  // provider + error boundary. The non-fatal invite warning floats on top as a toast so it
  // doesn't disrupt the shell layout.
  if (showConversation && agoraData && rtmClient) {
    return (
      <>
        {agentJoinError && (
          <ErrorToast>
            Failed to connect with AI agent. The conversation may not work as
            expected.
          </ErrorToast>
        )}
        <Suspense fallback={<LoadingSkeleton />}>
          <ErrorBoundary>
            <AgoraProvider>
              <ConversationShell
                agoraData={agoraData}
                rtmClient={rtmClient}
                onTokenWillExpire={handleTokenWillExpire}
                onEndConversation={endConversation}
              />
            </AgoraProvider>
          </ErrorBoundary>
        </Suspense>
      </>
    );
  }

  // Pre-call path: editorial landing. Drifting ambient blobs, brand mark in the top bar,
  // italic serif headline, minimal ink CTA pill, quiet attribution footer.
  return (
    <motion.div
      className="relative grid h-screen w-screen grid-rows-[auto_1fr_auto] overflow-hidden"
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
    >
      <Ambient state="idle" />

      <header className="relative z-20 flex shrink-0 items-center justify-between px-6 py-3.5 max-lg:px-4 max-lg:py-3">
        {/* Landing omits agentName — the agent is still hypothetical ("your agent"
            in the hero), so only the product is identified here. In-call, the
            BrandMark gains the agent name to anchor the user in a real conversation. */}
        <BrandMark />
        <nav className="flex items-center">
          <a
            href="https://github.com/EpicConnectorAI/UCWS-SINGAPORE-HACKATHON-2026"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            GitHub →
          </a>
        </nav>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center p-6">
        {/* H1 — "your agent" keeps the reader as subject without promising a
            specific demo character. Warm, editorial, invitation-first; the
            stack and pluggability story lives in the body paragraph below. */}
        <h1 className="max-w-3xl text-center font-display text-[clamp(40px,6vw,64px)] italic font-normal leading-[1.05] tracking-[-0.02em] text-foreground">
          Talk to Luna
        </h1>

        {/* Editorial sub — italic serif pull-quote, the strongest single line on
            the page. Implies bidirectional conversation + quality (other voice
            AI doesn't actually listen). */}
        <p className="mt-5 max-w-2xl text-center font-display text-lg italic leading-snug text-muted-foreground">
          Your AI voice assistant for Singapore — powered by MiMo + Agora.
        </p>

        {/* Body — honest framing of Ada as sample + reader's agent as the real
            product. "any LLM" does the pluggability work in one word; no need
            for cycle or BYO label when one adjective carries the meaning. */}
        <p className="mt-5 max-w-xl text-center font-ui text-sm leading-relaxed text-muted-foreground">
          Powered by Xiaomi MiMo and Agora's real-time voice engine. Luna is a
          smart voice agent built for Singapore. Talk to her now.
        </p>

        {/* Language Selector */}
        {!showConversation && (
          <div className="mt-6 flex flex-col items-center gap-3">
            <p className="font-ui text-xs uppercase tracking-widest text-muted-foreground">
              Choose your language
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                { code: 'en-US', label: 'English', flag: '🇬🇧' },
                { code: 'zh-CN', label: '中文', flag: '🇨🇳' },
              ].map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setSelectedLanguage(lang.code)}
                  className={`flex items-center gap-1.5 rounded-full border px-4 py-2 font-ui text-sm transition-all duration-150 \${
                    selectedLanguage === lang.code
                      ? 'border-foreground bg-foreground text-accent-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground'
                  }`}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {showConversation && (!agoraData || !rtmClient) ? (
          <p className="mt-8 max-w-md text-center font-ui text-sm text-muted-foreground">
            Failed to load conversation data.
          </p>
        ) : (
          <button
            type="button"
            className="mt-8 inline-flex h-14 cursor-pointer items-center gap-2.5 rounded-full border-none bg-foreground px-10 font-ui text-base font-medium tracking-[-0.01em] text-accent-foreground transition-all duration-200 ease-voice-out hover:-translate-y-px hover:bg-foreground/90 disabled:cursor-default disabled:translate-y-0 disabled:opacity-70 disabled:hover:bg-foreground"
            onClick={() => startConversation(selectedLanguage)}
            disabled={isLoading}
            aria-label={isLoading ? 'Starting conversation' : 'Start conversation'}
          >
            {isLoading ? (
              <>
                <motion.span
                  className="size-4 rounded-full border-2 border-white/35 border-t-white"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  aria-hidden="true"
                />
                Starting…
              </>
            ) : (
              <>
                <MessageCircle
                  size={18}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                Talk to Luna
              </>
            )}
          </button>
        )}

        {error && (
          <p className="mt-4 font-mono text-xs tracking-[-0.01em] text-state-error">
            {error}
          </p>
        )}
      </main>

      <footer className="relative z-20 flex items-center gap-2 px-6 pb-5 pt-3.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        <span>Built for UCWS Hackathon 2026 by</span>
        <a
          href="https://agora.io/en/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Visit Agora's website"
          className="group"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/agora-logo-rgb-blue.svg"
            alt="Agora"
            className="h-[18px] w-auto opacity-65 transition-opacity duration-150 group-hover:opacity-100"
          />
        </a>
      </footer>
    </motion.div>
  );
}
