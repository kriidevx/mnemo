import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';

// Voice capture (lib layer, no UI). Two paths:
// 1. record-then-extract: expo-audio records m4a → base64 → extractFromAudio (single Flash multimodal call)
// 2. live streaming: see live-session.ts (Flash Live, real-time)

export { RecordingPresets, useAudioRecorder };

export async function ensureMicPermission(): Promise<boolean> {
  const status = await AudioModule.requestRecordingPermissionsAsync();
  return status.granted;
}

export async function prepareRecordingMode(): Promise<void> {
  await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
}

/** Read a finished recording file → base64 + mime, ready for extractFromAudio. */
export async function recordingToBase64(uri: string): Promise<{ base64: string; mimeType: string }> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const mimeType = uri.endsWith('.wav') ? 'audio/wav' : uri.endsWith('.mp3') ? 'audio/mp3' : 'audio/mp4';
  return { base64, mimeType };
}
