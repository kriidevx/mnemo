import * as FileSystem from 'expo-file-system/legacy';
import { MODELS } from '../models';
import { handoff } from '../orchestrator';

// On-device Gemma via llama.rn. Native module is absent in Expo Go — guarded require
// so the app still runs there (falls back to cloud/heuristic in the Listener).
let llamaMod: typeof import('llama.rn') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  llamaMod = require('llama.rn');
} catch {
  llamaMod = null;
}

const MODEL_DIR = `${FileSystem.documentDirectory}models/`;
const MODEL_PATH = `${MODEL_DIR}${MODELS.gemmaLocalFile}`;

let ctx: Awaited<ReturnType<NonNullable<typeof llamaMod>['initLlama']>> | null = null;

export async function gemmaModelStatus(): Promise<{
  nativeModule: boolean;
  modelFile: boolean;
  loaded: boolean;
  path: string;
}> {
  let modelFile = false;
  try {
    const info = await FileSystem.getInfoAsync(MODEL_PATH);
    modelFile = info.exists;
  } catch {
    modelFile = false;
  }
  return { nativeModule: llamaMod != null, modelFile, loaded: ctx != null, path: MODEL_PATH };
}

export async function loadGemma(): Promise<boolean> {
  if (ctx) return true;
  if (!llamaMod) return false;
  const status = await gemmaModelStatus();
  if (!status.modelFile) return false;
  try {
    handoff('antigravity', 'gemma-local', 'loading Gemma 4 model into memory', MODELS.gemmaLocalFile, 'info');
    ctx = await llamaMod.initLlama({ model: MODEL_PATH, n_ctx: 2048, n_gpu_layers: 99 });
    return true;
  } catch (err) {
    handoff('gemma-local', 'antigravity', 'model load failed', String(err), 'error');
    ctx = null;
    return false;
  }
}

export function gemmaLoaded(): boolean {
  return ctx != null;
}

/** Run a completion fully on-device. Returns raw text (Listener parses JSON out of it). */
export async function gemmaComplete(prompt: string): Promise<string> {
  if (!ctx) throw new Error('Gemma not loaded');
  const res = await ctx.completion({
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    n_predict: 768,
  });
  return res.text ?? '';
}
