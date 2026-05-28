import type { AgentState } from 'agora-agent-client-toolkit';
import type { AgentVisualizerState } from 'agora-agent-uikit';

// View-state enum. Collapses the richer agent lifecycle + local flags into the 8 visual
// states the conversation UI styles around.
//
// `connecting` and `preparing` split what used to be lumped into `idle`:
//   - `connecting`: RTC/RTM not yet established, or the agent hasn't joined the channel
//   - `preparing`: channel is up and the agent is in it, but we haven't received the
//     first AGENT_STATE_CHANGED event (i.e. Luna hasn't started greeting yet)
//   - `idle`: Luna has been active and is now quiet — safe for the user to speak
//
// There is no `ended` state: the end-call button unmounts the conversation tree and
// returns to the landing screen. Anything that would have rendered for "ended" (Call
// ended pill, Start new call CTA) lives on the landing page instead.
export type ViewState =
  | 'connecting'
  | 'preparing'
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'muted'
  | 'error';

// Map the AgoraAgent state + local mute/end-of-call flags to the view-state enum.
// Priority: disconnected (error) > connecting > preparing > muted > active states.
// `preparing` wins over `muted` because the mute hint ("Luna can't hear you") is misleading
// before Luna has said anything — nothing is listening yet regardless of mic state.
export function mapToViewState(
  visualizerState: AgentVisualizerState,
  agentState: AgentState | null,
  isMuted: boolean,
): ViewState {
  if (visualizerState === 'disconnected') return 'error';
  if (visualizerState === 'joining' || visualizerState === 'not-joined') {
    return 'connecting';
  }
  // Agent is present in the channel but no AGENT_STATE_CHANGED has arrived yet — the
  // server-side greeting is still spinning up. Distinguishing this from real `idle`
  // stops us from telling users "Say something" before Luna has had a chance to speak.
  if (visualizerState === 'ambient' && agentState === null) {
    return 'preparing';
  }
  if (isMuted) return 'muted';
  switch (visualizerState) {
    case 'listening':
      return 'listening';
    case 'analyzing':
      return 'thinking';
    case 'talking':
      return 'speaking';
    case 'ambient':
    default:
      return 'idle';
  }
}

// Agent display name. Single source of truth for the label shown in hint copy,
// transcript, persona card, and controls dock.
export const ADA_AGENT_NAME = 'Luna';

// Hint copy keyed on ViewState. Empty string = no hint (caller should render a fixed-height
// placeholder to avoid layout jumps).
export const VIEW_HINT: Record<ViewState, string> = {
  connecting: `Connecting to ${ADA_AGENT_NAME}…`,
  preparing: `${ADA_AGENT_NAME} is about to say hi.`,
  idle: 'Say something whenever you\u2019re ready.',
  listening: 'Listening… keep talking.',
  thinking: 'Thinking through that for you.',
  speaking: `${ADA_AGENT_NAME} is responding.`,
  muted: `Mic is off. ${ADA_AGENT_NAME} can't hear you right now.`,
  error: 'Network hiccup — trying to reconnect.',
};
