import * as FileSystem from 'expo-file-system/legacy';

// Gemini TTS returns raw 16-bit PCM (audio/L16, usually 24kHz). Players need a
// WAV container — prepend the 44-byte header and drop to a cache file.

export async function pcmBase64ToWavFile(pcmB64: string, sampleRate = 24000): Promise<string> {
  const pcmLen = Math.floor((pcmB64.length * 3) / 4) - (pcmB64.endsWith('==') ? 2 : pcmB64.endsWith('=') ? 1 : 0);
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  v.setUint32(4, 36 + pcmLen, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  writeStr(36, 'data');
  v.setUint32(40, pcmLen, true);

  let headerB64 = '';
  {
    const bytes = new Uint8Array(header);
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    headerB64 = btoa(bin);
  }

  // Concatenate at byte level: decode both, re-encode once (headers are tiny).
  const full = concatB64(headerB64, pcmB64);
  const path = `${FileSystem.cacheDirectory}mnemo-tts-${Date.now()}.wav`;
  await FileSystem.writeAsStringAsync(path, full, { encoding: FileSystem.EncodingType.Base64 });
  return path;
}

function concatB64(a: string, b: string): string {
  const bytesA = b64ToBytes(a);
  const bytesB = b64ToBytes(b);
  const out = new Uint8Array(bytesA.length + bytesB.length);
  out.set(bytesA, 0);
  out.set(bytesB, bytesA.length);
  let bin = '';
  const CHUNK = 8192;
  for (let i = 0; i < out.length; i += CHUNK) {
    bin += String.fromCharCode(...out.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
