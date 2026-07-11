import { getGenAI } from '../gemini';
import { extractAtoms } from './listener';
import { atomsToContext, financialLedger, weekAtoms } from './reasoner';
import type { MemoryAtom } from '../memory/types';
import { MODELS } from '../models';
import { handoff } from '../orchestrator';

// Generator modes 4, 5, 7 + TTS read-aloud. Mode 5 (financial) is pure
// on-device Reasoner math — re-exported here so the whole Generator API
// lives in two files.

/** MODE 4 — "Translate My Day": all of today's atoms unified into one language. */
export async function translateMyDay(targetLanguage: string): Promise<string> {
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const atoms = weekAtoms().filter((a) => a.created_at >= todayStart);
  if (atoms.length === 0) return '';
  const ai = await getGenAI();
  if (!ai) throw new Error('No API key set');
  handoff('generator', 'flash-cloud', `translate day → ${targetLanguage}`, `${atoms.length} atoms, langs: ${[...new Set(atoms.map((a) => a.language_detected))].join(',')}`);
  const res = await ai.models.generateContent({
    model: MODELS.flash,
    contents: `These memory atoms were captured today in multiple languages. Present a unified daily summary ENTIRELY IN ${targetLanguage}. For each item, append its source language in brackets, e.g. "[originally Hindi]". Group by type (promises, decisions, money, other). Use only facts in the atoms.

ATOMS:
${atomsToContext(atoms)}`,
    config: { temperature: 0.3 },
  });
  return res.text ?? '';
}

/** MODE 5 — financial ledger. On-device only; money never touches cloud. */
export { financialLedger };

/** MODE 7 — "Scan & Remember": photo of whiteboard/receipt/card → memory atoms. */
export async function scanAndRemember(base64Image: string, mimeType: string): Promise<MemoryAtom[]> {
  const ai = await getGenAI();
  handoff('input', 'listener', 'camera capture received');
  if (ai) {
    try {
      handoff('listener', 'flash-cloud', 'OCR + structure image (multimodal)');
      const res = await ai.models.generateContent({
        model: MODELS.flash,
        contents: [
          {
            parts: [
              { inlineData: { mimeType, data: base64Image } },
              {
                text: 'Extract ALL text from this image (whiteboard, receipt, business card, or handwritten note — may be Hindi/Kannada/Tamil/Telugu/English). Return the raw extracted text only, preserving line structure.',
              },
            ],
          },
        ],
        config: { temperature: 0.1 },
      });
      const text = res.text ?? '';
      if (text.trim()) {
        handoff('flash-cloud', 'listener', 'OCR text extracted', text.slice(0, 60));
        const { atoms } = await extractAtoms(text, 'camera');
        return atoms;
      }
    } catch (err) {
      handoff('flash-cloud', 'antigravity', 'image OCR failed', String(err), 'error');
    }
  }
  return [];
}

/** Read any text aloud — briefs, daily summary — in the user's language. Returns base64 audio. */
export async function readAloud(text: string, voiceName = 'Kore'): Promise<string> {
  const ai = await getGenAI();
  if (!ai) throw new Error('No API key set');
  handoff('generator', 'tts', 'read aloud', text.slice(0, 50));
  const res = await ai.models.generateContent({
    model: MODELS.tts,
    contents: text,
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
    } as any,
  });
  return res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data ?? '';
}
