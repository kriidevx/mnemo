# MNEMO — Life Operating System

**Google DeepMind Bangalore Hackathon.** You live. Mnemo remembers, synthesizes, and generates — on your device, in any language you think in.

Problem statement: **PS2 — Autonomous Orchestration with Managed Agents (Antigravity)** + **Gemma 4 special prize** (local-first agent).

## What it does

Three on-device agents in a Sense → Decide → Act → Check loop:

1. **Listener (Sense)** — extracts structured "memory atoms" from voice, text, camera. Gemma 4 on-device first; escalates to Gemini 3.5 Flash only when local confidence < 0.6 and connectivity exists. Handles Hindi/Kannada/Tamil/Telugu/English code-switching natively.
2. **Reasoner (Decide)** — ranks the memory graph on context triggers (recency × confidence × type priority), detects conflicts, surfaces max 2 atoms via a Dynamic Island. Biologically-inspired decay: promises fade fast, decisions stick, money never fades.
3. **Generator (Act)** — on command, turns memory into artifacts: meeting briefs (Flash), visual week decks (NB2 Lite), narrated recap videos (Omni Flash + Flash TTS), cross-language day summaries (unified into any language).

Every agent handoff, escalation, conflict mediation, and pipeline fallback is logged to a visible orchestration feed — judges see the multi-agent system working, not trust it.

## Repo layout

```
mnemo/                 Expo (React Native) app
  src/lib/mnemo.ts     ← single API surface for the UI
  src/lib/agents/      Listener, Reasoner, Generator
  src/lib/memory/      atom schema, graph store, decay math
  src/lib/voice/       expo-audio recorder + Flash Live streaming
  src/lib/local/       Gemma via llama.rn (on-device)
  src/lib/orchestrator.ts  Antigravity pipeline runner + handoff log
  HANDOVER.md          screen → API map for the UI layer
```

## Setup

```bash
cd mnemo
npm install
cp .env.example .env          # add EXPO_PUBLIC_GEMINI_API_KEY
npx expo run:android          # dev build (needed for llama.rn / on-device Gemma)
# Expo Go works too — on-device path falls back to cloud/heuristic automatically
```

On-device Gemma (airplane-mode demo): download a Gemma GGUF and push it to the path shown in Settings → Gemma status (`documentDirectory/models/gemma-4-e2b-it.gguf`).

## Models used

| Model | Role |
|---|---|
| Gemma 4 (on-device, llama.rn) | Listener extraction, offline backbone |
| gemini-3.5-flash | Reasoning, briefs, narratives, escalation target |
| gemini-3.1-flash-live-preview | Real-time voice journal |
| gemini-3.5-live-translate-preview | Cross-language bridge |
| gemini-3.1-flash-tts-preview | Recap narration, read-aloud |
| gemini-omni-flash-preview | Recap video generation |
| gemini-3.1-flash-lite-image (NB2 Lite) | Slide visuals, scene stills |
| antigravity-preview-05-2026 | Orchestration layer |
