// MNEMO — single import surface for the UI layer.
// Everything a screen needs comes from here: `import { ... } from '@/lib/mnemo'`.

// ---- memory graph ----
export { useMemoryStore, liveAtoms, memoryHealth } from './memory/store';
export { effectiveConfidence, confidenceTier, DECAY_RATE, DECAY_FLOOR } from './memory/decay';
export type { MemoryAtom, AtomType, AtomSource, LangCode } from './memory/types';

// ---- agent 1: Listener (Sense) ----
export { extractAtoms, extractFromAudio, heuristicExtract } from './agents/listener';
export type { ExtractionResult } from './agents/listener';

// ---- agent 2: Reasoner (Decide) ----
export {
  queryPerson,
  expiringPromises,
  financialLedger,
  weekAtoms,
  conflicts,
  atomsToContext,
} from './agents/reasoner';
export type { RankedAtom } from './agents/reasoner';

// ---- agent 3: Generator (Act) ----
export { generateBrief, generateWeekDeck, generateRecapVideo } from './agents/generator';
export type { Brief, WeekSlide, RecapResult } from './agents/generator';
export { translateMyDay, scanAndRemember, readAloud } from './agents/generator-extra';

// ---- voice ----
export {
  ensureMicPermission,
  prepareRecordingMode,
  recordingToBase64,
  useAudioRecorder,
  RecordingPresets,
} from './voice/recorder';
export { startLiveJournal } from './voice/live-session';
export type { LiveJournal, LiveJournalCallbacks } from './voice/live-session';

// ---- on-device Gemma ----
export { gemmaModelStatus, loadGemma, gemmaLoaded, downloadGemmaModel, cancelGemmaDownload } from './local/gemma';

// ---- orchestration (Antigravity layer) ----
export { useHandoffLog, handoff, runPipeline } from './orchestrator';
export type { HandoffEntry, AgentName } from './orchestrator';

// ---- config ----
export { getApiKey, setApiKey, cloudAvailable } from './gemini';
export { MODELS } from './models';

// ---- dashboard + digest + search ----
export { dashboardData } from './agents/dashboard';
export type { DashboardData } from './agents/dashboard';
export { dailyDigest } from './agents/digest';
export type { DailyDigest } from './agents/digest';
export { searchAtoms } from './memory/search';
export { entityMatch } from './memory/store';

// ---- capture sources ----
export { captureClipboard, captureImage, simulateNotification, simulateAppOpen } from './capture/sources';

// ---- live translate ----
export { startLiveTranslate } from './voice/live-translate';
export type { LiveTranslateSession, LiveTranslateCallbacks } from './voice/live-translate';

// ---- demo fixtures ----
export { seedDemo, wipeMemory, DEMO_ATOMS } from './demo-seed';
