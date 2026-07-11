/* Smoke-test every Google model Mnemo uses. Run: npx tsx scripts/smoke-api.ts
   Reads EXPO_PUBLIC_GEMINI_API_KEY from .env. Never prints the key. */
import { readFileSync } from 'node:fs';
import { GoogleGenAI } from '@google/genai';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const key = env.match(/EXPO_PUBLIC_GEMINI_API_KEY=(.+)/)?.[1]?.trim();
if (!key) {
  console.error('No key in .env');
  process.exit(1);
}
const ai = new GoogleGenAI({ apiKey: key });

const results: Record<string, string> = {};

async function test(name: string, fn: () => Promise<string>) {
  try {
    const detail = await fn();
    results[name] = `PASS ${detail}`;
  } catch (e) {
    results[name] = `FAIL ${(e as Error).message?.slice(0, 140)}`;
  }
}

const EXTRACT_PROMPT = `Extract memory atoms as a JSON array from: "Rohan bhai ko kal tak revised quote bhejni hai, ₹4200 wala Zenith order. Team call decision — launch pushed to August, Priya confirmed." Each: {"type":"promise|decision|financial|fact","content":"...","entities":{"people":[],"orgs":[],"money":{"amount":null,"currency":"INR"},"dates":[]},"language_detected":"hi|en|mixed","confidence":0.0,"tags":[]}. JSON only.`;

async function main() {
await test('flash-extraction (gemini-3.5-flash)', async () => {
  const r = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: EXTRACT_PROMPT,
    config: { responseMimeType: 'application/json' },
  });
  const atoms = JSON.parse(r.text ?? '[]');
  return `${atoms.length} atoms, first: ${atoms[0]?.type} "${atoms[0]?.content?.slice(0, 50)}"`;
});

await test('nb2-lite image (gemini-3.1-flash-lite-image)', async () => {
  const t0 = Date.now();
  const r = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite-image',
    contents: 'Minimal flat vector illustration, warm palette, no text: a founder reviewing a week of memories',
  });
  const img = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!img?.data) throw new Error('no image data returned');
  return `${((Date.now() - t0) / 1000).toFixed(1)}s, ${Math.round(img.data.length * 0.75 / 1024)}KB ${img.mimeType}`;
});

await test('tts (gemini-3.1-flash-tts-preview)', async () => {
  const r = await ai.models.generateContent({
    model: 'gemini-3.1-flash-tts-preview',
    contents: 'आपका हफ़्ता शानदार रहा। तीन वादे पूरे हुए।',
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
    } as never,
  });
  const audio = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!audio?.data) throw new Error('no audio returned');
  return `${Math.round(audio.data.length * 0.75 / 1024)}KB ${audio.mimeType}`;
});

await test('omni video op start (gemini-omni-flash-preview)', async () => {
  const op = await (ai.models as never as { generateVideos: (a: object) => Promise<{ name?: string; done?: boolean }> }).generateVideos({
    model: 'gemini-omni-flash-preview',
    prompt: 'A 5-second flat-illustration animation of a calendar page turning.',
  });
  return `operation started: ${op.name ?? 'unnamed'} done=${op.done ?? false}`;
});

await test('live connect (gemini-3.1-flash-live-preview)', async () => {
  const session = await ai.live.connect({
    model: 'gemini-3.1-flash-live-preview',
    config: { responseModalities: ['TEXT' as never], inputAudioTranscription: {} },
    callbacks: { onmessage: () => {}, onerror: () => {}, onclose: () => {} },
  });
  session.close();
  return 'session opened + closed';
});

await test('live translate connect (gemini-3.5-live-translate-preview)', async () => {
  const session = await ai.live.connect({
    model: 'gemini-3.5-live-translate-preview',
    config: { responseModalities: ['TEXT' as never] },
    callbacks: { onmessage: () => {}, onerror: () => {}, onclose: () => {} },
  });
  session.close();
  return 'session opened + closed';
});

console.log('\n=== MNEMO API SMOKE TEST ===');
for (const [k, v] of Object.entries(results)) console.log(`${v.startsWith('PASS') ? '✅' : '❌'} ${k}: ${v}`);
const fails = Object.values(results).filter((v) => v.startsWith('FAIL')).length;
console.log(`\n${Object.keys(results).length - fails}/${Object.keys(results).length} passed`);
process.exit(fails ? 1 : 0);
}
void main();
