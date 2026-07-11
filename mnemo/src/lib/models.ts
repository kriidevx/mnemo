// Every model in the Google AI stack Mnemo uses. One source of truth — never hardcode elsewhere.
export const MODELS = {
  /** Structured reasoning, briefs, narratives, escalation target */
  flash: 'gemini-3.5-flash',
  /** Real-time voice streaming (Voice Journal) */
  flashLive: 'gemini-3.1-flash-live-preview',
  /** Cross-language memory bridge */
  liveTranslate: 'gemini-3.5-live-translate-preview',
  /** Recap narration, read-aloud */
  tts: 'gemini-3.1-flash-tts-preview',
  /** Video recap generation */
  omni: 'gemini-omni-flash-preview',
  /** Slide visuals, card backgrounds — sub-4s image gen */
  nb2lite: 'gemini-3.1-flash-lite-image',
  /** Master orchestrator (Interactions API) */
  antigravity: 'antigravity-preview-05-2026',
  /** On-device via llama.rn — model file name expected in documentDirectory/models/ */
  gemmaLocalFile: 'gemma-4-e2b-it.gguf',
} as const;
