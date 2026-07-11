import { getGenAI } from '../gemini';
import { MODELS } from '../models';
import { handoff } from '../orchestrator';
import { atomsToContext, expiringPromises, weekAtoms } from './reasoner';

// End-of-day trigger — "today's memory card". Cloud Flash when available,
// on-device template otherwise (digest must work in airplane mode).

export interface DailyDigest {
  headline: string;
  body: string;
  expiringCount: number;
  generatedBy: 'flash-cloud' | 'on-device-template';
}

export async function dailyDigest(language = 'English'): Promise<DailyDigest> {
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const today = weekAtoms().filter((a) => a.created_at >= todayStart);
  const expiring = expiringPromises();

  const ai = await getGenAI();
  if (ai && today.length > 0) {
    try {
      handoff('reasoner', 'flash-cloud', 'compile daily digest', `${today.length} atoms today`);
      const res = await ai.models.generateContent({
        model: MODELS.flash,
        contents: `Write today's memory digest IN ${language} from these atoms: a one-line headline, then a warm 3-4 sentence recap (what was captured, promises made, money mentioned). Facts only.

TODAY:
${atomsToContext(today)}

${expiring.length ? `EXPIRING PROMISES:\n${atomsToContext(expiring)}` : ''}

JSON: {"headline": "...", "body": "..."}`,
        config: { responseMimeType: 'application/json', temperature: 0.4 },
      });
      const parsed = JSON.parse(res.text ?? '{}');
      if (parsed.headline) {
        return { headline: parsed.headline, body: parsed.body ?? '', expiringCount: expiring.length, generatedBy: 'flash-cloud' };
      }
    } catch (err) {
      handoff('flash-cloud', 'antigravity', 'digest generation failed → on-device template', String(err), 'fallback');
    }
  }

  // Offline template — counts, no prose model needed.
  const money = today.filter((a) => a.entities.money).length;
  return {
    headline: today.length === 0 ? 'A quiet day — nothing captured' : `${today.length} memories captured today`,
    body: [
      today.filter((a) => a.type === 'promise').length && `${today.filter((a) => a.type === 'promise').length} promise(s) made.`,
      today.filter((a) => a.type === 'decision').length && `${today.filter((a) => a.type === 'decision').length} decision(s) recorded.`,
      money && `${money} money mention(s).`,
      expiring.length && `⚠ ${expiring.length} promise(s) expiring — review them.`,
    ]
      .filter(Boolean)
      .join(' '),
    expiringCount: expiring.length,
    generatedBy: 'on-device-template',
  };
}
