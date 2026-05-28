# 🎤 VoxAgent — Singapore's AI Voice Assistant

> Real-time voice AI agent powered by **Xiaomi MiMo** + **Agora Conversational AI**. Built for **UCWS Singapore Hackathon 2026** — Agent Track.

![VoxAgent Banner](https://img.shields.io/badge/UCWS%20Hackathon-2026-blue?style=for-the-badge)
![Track](https://img.shields.io/badge/Track-Agent-green?style=for-the-badge)
![AI](https://img.shields.io/badge/AI-Xiaomi%20MiMo-orange?style=for-the-badge)
![Voice](https://img.shields.io/badge/Voice-Agora%20ConvoAI-purple?style=for-the-badge)

## 🌟 What is VoxAgent?

VoxAgent is a **real-time voice AI assistant** built specifically for Singapore. Talk to **Luna** — your AI companion — and get instant answers about hawker food, MRT directions, weather, local events, and anything else.

### Key Features

- 🎙️ **Real-time voice conversation** — speak naturally, get spoken answers with sub-second latency
- 🧠 **Powered by Xiaomi MiMo v2.5 Pro** — advanced reasoning with chain-of-thought
- 🇸🇬 **Singapore-localized** — knows MRT, hawker centres, Singlish, local culture
- 🌐 **Multi-language** — English, Mandarin, Malay, Tamil
- 🔧 **Multi-tool agent** — web search, document analysis, calculations
- 🎨 **Beautiful UI** — 28 professional components, voice waveform, live subtitles
- ⚡ **Low latency** — Agora's SD-RTN delivers voice globally in real-time

## 🏗️ Architecture

```
Browser Mic → Agora RTC → Agora Cloud
Agora Cloud: STT (Deepgram) → LLM (Xiaomi MiMo) → TTS (MiniMax)
TTS Audio → Agora RTC → Browser Speaker
```

**Tech Stack:**
- **Frontend:** Next.js 16 + TypeScript + Tailwind CSS
- **Voice Engine:** Agora Conversational AI Engine
- **AI Brain:** Xiaomi MiMo v2.5 Pro (OpenAI-compatible API)
- **STT:** Deepgram Nova-3
- **TTS:** MiniMax Speech 2.6 Turbo
- **Deployment:** Vercel

## 🚀 Quick Start

### Prerequisites

1. **Agora Account** — [Sign up](https://console.agora.io) and create a project
2. **Xiaomi MiMo API Key** — [Get key](https://mimo.xiaomi.com)

### Setup

```bash
# Clone the repo
git clone https://github.com/2319582090-spec/voxagent-ucws2026.git
cd voxagent-ucws2026

# Install dependencies
npm install

# Configure environment
cp env.local.example .env.local
# Edit .env.local with your keys:
# NEXT_PUBLIC_AGORA_APP_ID=your_app_id
# NEXT_AGORA_APP_CERTIFICATE=your_certificate
# NEXT_LLM_URL=https://token-plan-sgp.xiaomimimo.com/v1/chat/completions
# NEXT_LLM_API_KEY=your_mimo_key
# NEXT_LLM_MODEL=mimo-v2.5-pro

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and start talking!

## 🎯 UCWS Hackathon 2026

- **Track:** Agent
- **Demo:** [Live Demo](https://voxagent-ucws2026.vercel.app)
- **GitHub:** [Source Code](https://github.com/2319582090-spec/voxagent-ucws2026)

### What Makes VoxAgent Special

| Feature | VoxAgent | Typical Voice Agent |
|---|---|---|
| AI Brain | Xiaomi MiMo v2.5 Pro | GPT-4o |
| Voice Latency | <500ms | 1-2s |
| Singapore Context | ✅ Deep local knowledge | ❌ Generic |
| Multi-language | ✅ EN/ZH/MS/TA | ❌ English only |
| Reasoning Chain | ✅ Visible thought process | ❌ Black box |
| Open Source | ✅ MIT License | ❌ Proprietary |

## 📄 License

MIT — Built on [Agora Conversational AI Next.js Quickstart](https://github.com/hai-ai-studio/agora-agent-nextjs)

## 🙏 Acknowledgements

- [Agora](https://agora.io) — Real-time voice infrastructure
- [Xiaomi MiMo](https://mimo.xiaomi.com) — AI reasoning engine
- [hai-ai-studio](https://github.com/hai-ai-studio/agora-agent-nextjs) — Base template

---

**Built with ❤️ for UCWS Singapore Hackathon 2026**
