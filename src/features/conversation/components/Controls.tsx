'use client';

import type { IMicrophoneAudioTrack } from 'agora-rtc-react';
import { Icons } from '@/components/convo-ui';
import { MicPicker } from './MicPicker';
import { VoiceLangMenu } from '@/components/convo-ui';

export interface ControlsProps {
  muted: boolean;
  voice: string;
  onVoiceChange: (id: string) => void;
  onToggleMute: () => void;
  onEnd: () => void;
  // Passed into MicPicker so the chevron next to the mic button can enumerate + swap devices.
  localMicrophoneTrack?: IMicrophoneAudioTrack | null;
  // Controls the side transcript panel. Button is shown in the active "on" style when visible.
  transcriptVisible?: boolean;
  onToggleTranscript?: () => void;
}

// Utility class fragments for the dock buttons. Pulled out so the variants below stay readable.
const DOCK_PILL =
  'flex items-center gap-2.5 rounded-full border border-border bg-surface/70 px-2 py-2 shadow-[0_2px_4px_rgba(0,0,0,0.03),_0_12px_40px_rgba(0,0,0,0.08)] backdrop-blur-xl supports-[backdrop-filter]:bg-surface/70';

const CTRL_BTN =
  'flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-foreground transition-colors duration-150 hover:bg-black/5 disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent';

// Active toggle variant — dark fill with inverted icon color. `!` importance on bg + text
// is needed for the same reason as CTRL_END: CTRL_BTN's `bg-transparent` and `text-foreground` can
// win over these in the generated CSS depending on Tailwind class emit order.
const CTRL_ACTIVE = '!bg-foreground !text-accent-foreground hover:!bg-foreground/90';

// End-call variant — red fill, white icon, darker red on hover. All color
// utilities need `!` importance: without it, `bg-transparent` / `text-foreground`
// / `hover:bg-black/5` from CTRL_BTN can win in the Tailwind class emit order,
// making the hangup button render transparent, with a dark icon, or gray on hover.
const CTRL_END =
  '!bg-[#dc2626] !text-white hover:!bg-[#b91c1c]';

export function Controls({
  muted,
  voice,
  onVoiceChange,
  onToggleMute,
  onEnd,
  localMicrophoneTrack = null,
  transcriptVisible = false,
  onToggleTranscript,
}: ControlsProps) {
  return (
    <div className={DOCK_PILL}>
      {/* VoiceLangMenu hidden — language is selected on landing page */}
      {/* <VoiceLangMenu voice={voice} onVoiceChange={onVoiceChange} /> */}

      <div className="relative inline-flex items-center gap-0.5">
        <button
          type="button"
          className={`${CTRL_BTN} ${muted ? CTRL_ACTIVE : ''}`}
          onClick={onToggleMute}
          title={muted ? 'Unmute' : 'Mute'}
          aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}
          aria-pressed={muted}
        >
          {muted ? Icons.micOff : Icons.mic}
        </button>
        <MicPicker localMicrophoneTrack={localMicrophoneTrack} />
      </div>

      {onToggleTranscript && (
        <button
          type="button"
          className={`${CTRL_BTN} ${transcriptVisible ? CTRL_ACTIVE : ''}`}
          onClick={onToggleTranscript}
          title={transcriptVisible ? 'Hide transcript' : 'Show transcript'}
          aria-label={transcriptVisible ? 'Hide transcript' : 'Show transcript'}
          aria-pressed={transcriptVisible}
        >
          {Icons.captions}
        </button>
      )}

      <button
        type="button"
        className={`${CTRL_BTN} ${CTRL_END}`}
        onClick={onEnd}
        title="End call"
        aria-label="End call"
      >
        {Icons.hangup}
      </button>
    </div>
  );
}
