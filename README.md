# 🎤 VoxAgent — Singapore's Real-Time Voice AI Assistant

> Talk to **Luna**, your AI voice companion for Singapore. Powered by **Xiaomi MiMo** reasoning + **Agora Conversational AI** engine. Built for **UCWS Singapore Hackathon 2026** — Agent Track.

![VoxAgent](https://img.shields.io/badge/UCWS%20Hackathon-2026-blue?style=for-the-badge)
![Track](https://img.shields.io/badge/Track-Agent-green?style=for-the-badge)
![AI](https://img.shields.io/badge/AI-Xiaomi%20MiMo-orange?style=for-the-badge)
![Voice](https://img.shields.io/badge/Voice-Agora%20ConvoAI-purple?style=for-the-badge)
![Skills](https://img.shields.io/badge/Agora-Skills-brightgreen?style=for-the-badge)

## 🌟 What is VoxAgent?

VoxAgent is a **real-time voice AI agent** built for Singapore. Speak naturally to **Luna** and get instant spoken answers about hawker food, MRT directions, weather, local culture, and anything else — in **English or Chinese**.

### Why It's Different

| Feature | VoxAgent | Typical Voice Bots |
|---------|----------|-------------------|
| **Latency** | Sub-second (Agora SD-RTN) | 2-5 seconds |
| **AI Brain** | Xiaomi MiMo v2.5 Pro (reasoning) | Generic GPT |
| **Voice Engine** | Agora ConvoAI (Ares STT + MiniMax TTS) | Browser TTS |
| **Tool Calling** | Weather, time, Singapore knowledge | Chat only |
| **Languages** | English + Chinese (auto-detect) | English only |
| **Locale** | Singapore-specific (MRT, hawker, Singlish) | Generic |

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────────────────────┐     ┌─────────────────┐
│ Browser Mic  │────▶│   Agora RTC (SD-RTN)     │────▶│  Agora Cloud    │
│              │     │   Real-time audio stream  │     │                 │
└─────────────┘     └──────────────────────────┘     │  ┌───────────┐  │
                                                      │  │ Ares STT  │  │
                                                      │  │ (built-in)│  │
                                                      │  └─────┬─────┘  │
                                                      │        │ text   │
                                                      │  ┌─────▼─────┐  │
                                                      │  │  MiMo LLM │  │
                                                      │  │ (via proxy)│  │
                                                      │  └─────┬─────┘  │
                                                      │        │ text   │
                                                      │  ┌─────▼─────┐  │
                                                      │  │MiniMax TTS │  │
                                                      │  │ (built-in) │  │
                                                      │  └───────────┘  │
                                                      └────────┬────────┘
                                                               │ audio
                                                      ┌────────▼────────┐
                                                      │  Browser Speaker │
                                                      └─────────────────┘
```

**Custom LLM Proxy** (`/api/chat/completions`):
- Routes requests to Xiaomi MiMo v2.5 Pro
- Server-side tool execution (weather, Singapore info, time)
- Pre-LLM context injection for tool results

## 🛠️ Tech Stack

| Layer | Technology | Role |
|-------|-----------|------|
| **Voice Engine** | Agora Conversational AI | Real-time voice pipeline |
| **Speech-to-Text** | Ares STT (Agora built-in) | Automatic speech recognition |
| **AI Brain** | Xiaomi MiMo v2.5 Pro | Reasoning, conversation, tool use |
| **Text-to-Speech** | MiniMax TTS (Agora built-in) | Natural voice synthesis |
| **Frontend** | Next.js 16 + TypeScript + Tailwind | Web UI |
| **Design System** | 28 convo-ui components | Professional voice UI |
| **Real-time Data** | Agora RTM SDK | Transcript streaming |
| **Token Auth** | agora-token (RTC+RTM) | Secure channel access |
| **Deployment** | Vercel | One-click hosting |

## 🚀 Quick Start

### Prerequisites

1. **Agora Account** — [Sign up](https://console.agora.io) → Create project → Get App ID + Certificate
2. **Xiaomi MiMo API Key** — [Get key](https://mimo.xiaomi.com)

### Setup

```bash
git clone https://github.com/2319582090-spec/voxagent-ucws2026.git
cd voxagent-ucws2026
npm install

# Configure environment
cp env.local.example .env.local
# Edit .env.local with your keys

npm run dev
# Open http://localhost:3000
```

### Environment Variables

```env
NEXT_PUBLIC_AGORA_APP_ID=your_agora_app_id
NEXT_AGORA_APP_CERTIFICATE=your_agora_certificate
NEXT_PUBLIC_AGENT_UID=123456
NEXT_LLM_URL=https://token-plan-sgp.xiaomimimo.com/v1/chat/completions
NEXT_LLM_API_KEY=your_mimo_api_key
NEXT_LLM_MODEL=mimo-v2.5-pro
```

## 🌐 Live Demo

**https://voxagent-ucws2026.vercel.app**

## 📦 What's Included

- **28 professional UI components** (Voice Agent Design System)
- **Multi-language support** (English + Chinese)
- **Server-side tool calling** (weather, Singapore knowledge, time)
- **Agora Skills integration** (reference docs + CLI)
- **Storybook** for component development (`npm run storybook`)
- **Production-ready** deployment on Vercel

## 🧩 Companion Workspace App: mimo2codex++

This repo also includes a companion workspace app at `apps/mimo2codex-plusplus/`.  
Display name: **mimo2codex++**.

It is intended for:
- multi-account MiMo key management
- request distribution / concurrency handling
- per-key quota and usage visibility
- one-click Codex setup generation

Run only the companion app:

```bash
pnpm --filter mimo2codex-plusplus dev
```

## 🏆 Hackathon Integration

| Sponsor Tech | How We Use It |
|-------------|---------------|
| **Agora ConvoAI** | Voice pipeline (STT→LLM→TTS), RTC, RTM |
| **Agora Skills** | Official skill pack for Agora integration |
| **Xiaomi MiMo** | AI reasoning engine (v2.5 Pro) |
| **Ares STT** | Agora's built-in speech recognition |
| **MiniMax TTS** | Agora's built-in voice synthesis |

## 📄 License

MIT

---

Built with ❤️ for UCWS Singapore Hackathon 2026
