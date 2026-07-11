import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { MODELS } from '../models';
import { handoff } from '../orchestrator';

// On-device Gemma via llama.rn (llama.cpp). Native module is absent in Expo Go —
// guarded require so the app still runs there (falls back to cloud/heuristic).
//
// Model file is found via two routes:
//  1. adb push (scripts/fetch-gemma.sh) → app's EXTERNAL files dir — llama.rn's
//     native code fopen()s the absolute path directly, no permission needed.
//  2. In-app download (downloadGemmaModel) → INTERNAL documentDirectory.
let llamaMod: typeof import('llama.rn') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  llamaMod = require('llama.rn');
} catch {
  llamaMod = null;
}

const INTERNAL_PATH = `${FileSystem.documentDirectory}models/${MODELS.gemmaLocalFile}`;
const EXTERNAL_PATH =
  Platform.OS === 'android'
    ? `/storage/emulated/0/Android/data/com.mnemo.app/files/models/${MODELS.gemmaLocalFile}`
    : null;

let ctx: Awaited<ReturnType<NonNullable<typeof llamaMod>['initLlama']>> | null = null;
let resolvedPath: string | null = null;

async function findModelFile(): Promise<string | null> {
  for (const p of [INTERNAL_PATH, EXTERNAL_PATH ? `file://${EXTERNAL_PATH}` : null]) {
    if (!p) continue;
    try {
      const info = await FileSystem.getInfoAsync(p);
      if (info.exists && (info.size ?? 0) > 100_000_000) return p; // sanity: >100MB = real weights
    } catch {
      // path not accessible on this platform — keep looking
    }
  }
  return null;
}

export async function gemmaModelStatus(): Promise<{
  nativeModule: boolean;
  modelFile: boolean;
  loaded: boolean;
  path: string;
  adbPushTarget: string;
}> {
  const found = await findModelFile();
  resolvedPath = found;
  return {
    nativeModule: llamaMod != null,
    modelFile: found != null,
    loaded: ctx != null,
    path: found ?? INTERNAL_PATH,
    adbPushTarget: EXTERNAL_PATH ?? INTERNAL_PATH,
  };
}

export async function loadGemma(): Promise<boolean> {
  if (ctx) return true;
  if (!llamaMod) return false;
  const path = resolvedPath ?? (await findModelFile());
  if (!path) return false;
  try {
    handoff('antigravity', 'gemma-local', 'loading Gemma into memory', path.split('/').pop(), 'info');
    ctx = await llamaMod.initLlama({
      model: path.replace('file://', ''),
      n_ctx: 2048,
      n_gpu_layers: 99,
    });
    handoff('gemma-local', 'antigravity', 'Gemma resident — offline extraction live', undefined, 'info');
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

// ---- Route 2: in-app resumable download ----

let activeDownload: FileSystem.DownloadResumable | null = null;

export async function downloadGemmaModel(
  url: string,
  onProgress: (pct: number) => void
): Promise<{ ok: boolean; error?: string }> {
  try {
    await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}models/`, { intermediates: true });
    handoff('antigravity', 'gemma-local', 'downloading model weights', url.slice(0, 60), 'info');
    activeDownload = FileSystem.createDownloadResumable(url, INTERNAL_PATH, {}, (p) => {
      if (p.totalBytesExpectedToWrite > 0) {
        onProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
      }
    });
    const res = await activeDownload.downloadAsync();
    activeDownload = null;
    if (!res || res.status !== 200) {
      return { ok: false, error: `download failed (HTTP ${res?.status ?? '?'})` };
    }
    resolvedPath = INTERNAL_PATH;
    handoff('gemma-local', 'antigravity', 'model weights downloaded', undefined, 'info');
    return { ok: true };
  } catch (err) {
    activeDownload = null;
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function cancelGemmaDownload(): Promise<void> {
  await activeDownload?.cancelAsync();
  activeDownload = null;
}
