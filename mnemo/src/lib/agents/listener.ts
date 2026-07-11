import { getGenAI } from '../gemini';
import { gemmaComplete, gemmaLoaded, loadGemma } from '../local/gemma';
import type { AtomSource, AtomType, LangCode, MemoryAtom } from '../memory/types';
import { MODELS } from '../models';
import { handoff } from '../orchestrator';

// AGENT 1 — THE LISTENER (Sense).
// Local-first extraction chain: Gemma on-device → Gemini Flash cloud → offline heuristic.
// Escalation rule (Antigravity): local confidence < 0.6 AND cloud reachable → re-extract on Flash.

const EXTRACTION_PROMPT = `You are the Listener agent of Mnemo, a memory runtime. Extract structured "memory atoms" from raw life input. Input may be Hindi, Kannada, Tamil, Telugu, English, or code-mixed — process natively, do NOT translate the content, but normalize entity names to Latin script.

Return ONLY a JSON array. Each atom:
{
  "type": "promise|decision|financial|fact|emotion|task|relationship|location|health",
  "content": "concise statement in the original language's meaning, English-normalized",
  "entities": { "people": [], "orgs": [], "money": {"amount": null, "currency": "INR"} or null, "dates": ["YYYY-MM-DD"] },
  "language_detected": "hi|kn|ta|te|en|mixed",
  "confidence": 0.0-1.0,
  "tags": ["lowercase", "topic", "tags"]
}

Rules: resolve relative dates against today (%TODAY%). "kal" after a commitment = tomorrow. One atom per distinct fact/promise/decision. Empty array if nothing memorable. No markdown, no prose — JSON array only.

INPUT (%SOURCE%): """%INPUT%"""`;

export interface ExtractionResult {
  atoms: MemoryAtom[];
  engine: MemoryAtom['engine'];
  escalated: boolean;
}

export async function extractAtoms(
  input: string,
  source: AtomSource,
  opts: { preferLocal?: boolean } = {}
): Promise<ExtractionResult> {
  handoff('input', 'listener', `raw ${source} received`, input.slice(0, 80));
  const prompt = EXTRACTION_PROMPT.replace('%TODAY%', new Date().toISOString().slice(0, 10))
    .replace('%SOURCE%', source)
    .replace('%INPUT%', input);

  // 1. On-device Gemma first — private, offline, instant.
  if (opts.preferLocal !== false) {
    if (!gemmaLoaded()) await loadGemma();
    if (gemmaLoaded()) {
      try {
        handoff('listener', 'gemma-local', 'extract atoms on-device');
        const raw = await gemmaComplete(prompt);
        let atoms = parseAtoms(raw, source, 'gemma-local');
        handoff('gemma-local', 'listener', `${atoms.length} atom(s) extracted on-device`);
        const weak = atoms.filter((a) => a.confidence < 0.6);
        if (weak.length > 0) {
          const cloud = await tryCloudExtract(prompt, source);
          if (cloud) {
            handoff('antigravity', 'flash-cloud', 'ESCALATE: local confidence < 0.6', `${weak.length} weak atom(s)`, 'escalation');
            atoms = mergePreferHigherConfidence(atoms, cloud);
            return { atoms, engine: 'gemma-local', escalated: true };
          }
          handoff('antigravity', 'listener', 'offline — weak atoms flagged low-conf, queued for re-processing', undefined, 'fallback');
        }
        return { atoms, engine: 'gemma-local', escalated: false };
      } catch (err) {
        handoff('gemma-local', 'antigravity', 'on-device extraction failed', String(err), 'error');
      }
    }
  }

  // 2. Cloud Flash.
  const cloudAtoms = await tryCloudExtract(prompt, source);
  if (cloudAtoms) {
    handoff('flash-cloud', 'listener', `${cloudAtoms.length} atom(s) extracted (cloud)`);
    return { atoms: cloudAtoms, engine: 'flash-cloud', escalated: false };
  }

  // 3. Offline heuristic — never returns nothing silently. Low confidence, honest about it.
  handoff('antigravity', 'listener', 'no Gemma model + no connectivity → heuristic extractor', undefined, 'fallback');
  const atoms = heuristicExtract(input, source);
  return { atoms, engine: 'heuristic-offline', escalated: false };
}

async function tryCloudExtract(prompt: string, source: AtomSource): Promise<MemoryAtom[] | null> {
  try {
    const ai = await getGenAI();
    if (!ai) return null;
    handoff('listener', 'flash-cloud', 'extract atoms via Gemini 3.5 Flash');
    const res = await ai.models.generateContent({
      model: MODELS.flash,
      contents: prompt,
      config: { responseMimeType: 'application/json', temperature: 0.2 },
    });
    return parseAtoms(res.text ?? '[]', source, 'flash-cloud');
  } catch (err) {
    handoff('flash-cloud', 'antigravity', 'cloud extraction failed', String(err), 'error');
    return null;
  }
}

/** Extract audio (base64) → atoms in ONE multimodal Flash call (transcribe + extract). */
export async function extractFromAudio(
  base64Audio: string,
  mimeType: string
): Promise<ExtractionResult & { transcript: string }> {
  handoff('input', 'listener', 'voice input received (audio)');
  const ai = await getGenAI();
  if (!ai) {
    return { atoms: [], engine: 'heuristic-offline', escalated: false, transcript: '' };
  }
  handoff('listener', 'flash-cloud', 'transcribe + extract (multimodal, single call)');
  const res = await ai.models.generateContent({
    model: MODELS.flash,
    contents: [
      {
        parts: [
          { inlineData: { mimeType, data: base64Audio } },
          {
            text:
              `First transcribe this audio verbatim (it may be Hindi/Kannada/Tamil/Telugu/English or code-mixed). ` +
              `Then extract memory atoms. Return JSON: {"transcript": "...", "atoms": [ ...same atom schema... ]}. ` +
              EXTRACTION_PROMPT.replace('%INPUT%', '(the audio above)').replace('%SOURCE%', 'voice_input').replace('%TODAY%', new Date().toISOString().slice(0, 10)),
          },
        ],
      },
    ],
    config: { responseMimeType: 'application/json', temperature: 0.2 },
  });
  try {
    const parsed = JSON.parse(res.text ?? '{}');
    const atoms = normalizeAtoms(Array.isArray(parsed.atoms) ? parsed.atoms : [], 'voice_input', 'flash-cloud');
    handoff('flash-cloud', 'listener', `${atoms.length} atom(s) from voice`, parsed.transcript?.slice(0, 60));
    return { atoms, engine: 'flash-cloud', escalated: false, transcript: parsed.transcript ?? '' };
  } catch {
    return { atoms: [], engine: 'flash-cloud', escalated: false, transcript: '' };
  }
}

// ---------- parsing ----------

function parseAtoms(raw: string, source: AtomSource, engine: MemoryAtom['engine']): MemoryAtom[] {
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  try {
    return normalizeAtoms(JSON.parse(jsonMatch[0]), source, engine);
  } catch {
    return [];
  }
}

const VALID_TYPES: AtomType[] = ['promise', 'decision', 'financial', 'fact', 'emotion', 'task', 'relationship', 'location', 'health'];
const VALID_LANGS: LangCode[] = ['hi', 'kn', 'ta', 'te', 'en', 'mixed'];

function normalizeAtoms(items: unknown[], source: AtomSource, engine: MemoryAtom['engine']): MemoryAtom[] {
  const now = Date.now();
  return (items as Record<string, any>[])
    .filter((i) => i && typeof i.content === 'string' && i.content.trim())
    .map((i) => ({
      id: Math.random().toString(36).slice(2) + now.toString(36),
      type: VALID_TYPES.includes(i.type) ? (i.type as AtomType) : 'fact',
      content: i.content.trim(),
      entities: {
        people: arr(i.entities?.people),
        orgs: arr(i.entities?.orgs),
        money:
          i.entities?.money && i.entities.money.amount != null
            ? { amount: Number(i.entities.money.amount), currency: i.entities.money.currency ?? 'INR' }
            : null,
        dates: arr(i.entities?.dates),
      },
      source,
      language_detected: VALID_LANGS.includes(i.language_detected) ? i.language_detected : 'en',
      confidence: clamp01(Number(i.confidence) || 0.5),
      created_at: now,
      last_recalled: now,
      recalled_count: 0,
      tags: arr(i.tags).map((t: string) => t.toLowerCase()),
      linked_atoms: [],
      engine,
    }));
}

function mergePreferHigherConfidence(local: MemoryAtom[], cloud: MemoryAtom[]): MemoryAtom[] {
  // Antigravity mediation: same-content atoms → keep higher-confidence classification.
  const out = [...local];
  for (const c of cloud) {
    const idx = out.findIndex((l) => similar(l.content, c.content));
    if (idx === -1) out.push(c);
    else if (c.confidence > out[idx].confidence) out[idx] = { ...c, id: out[idx].id };
  }
  return out;
}

function similar(a: string, b: string): boolean {
  const na = a.toLowerCase().replace(/\W+/g, ' ').trim();
  const nb = b.toLowerCase().replace(/\W+/g, ' ').trim();
  return na === nb || na.includes(nb) || nb.includes(na);
}

// ---------- offline heuristic (last resort, honest 0.35 confidence) ----------

const PROMISE_HINTS = /\b(bhej|send|due|deliver|pay|call|quote|submit|kal tak|by tomorrow|by monday|promise)\b/i;
const DECISION_HINTS = /\b(decided|pushed to|confirmed|final|launch|postponed|cancel)\b/i;
const MONEY_RE = /₹\s?([\d,]+)/;

export function heuristicExtract(input: string, source: AtomSource): MemoryAtom[] {
  const now = Date.now();
  const type: AtomType = MONEY_RE.test(input) && !DECISION_HINTS.test(input)
    ? PROMISE_HINTS.test(input) ? 'promise' : 'financial'
    : DECISION_HINTS.test(input) ? 'decision'
    : PROMISE_HINTS.test(input) ? 'promise'
    : 'fact';
  const money = input.match(MONEY_RE);
  const people = Array.from(input.matchAll(/\b([A-Z][a-z]{2,})\b/g)).map((m) => m[1])
    .filter((w) => !['The', 'Team', 'Launch', 'Monday', 'Tomorrow'].includes(w));
  const hasDevanagari = /[ऀ-ॿ]/.test(input);
  const hasKannada = /[ಀ-೿]/.test(input);
  return [{
    id: Math.random().toString(36).slice(2) + now.toString(36),
    type,
    content: input.trim().slice(0, 200),
    entities: {
      people: [...new Set(people)].slice(0, 3),
      orgs: [],
      money: money ? { amount: Number(money[1].replace(/,/g, '')), currency: 'INR' } : null,
      dates: [],
    },
    source,
    language_detected: hasDevanagari ? 'hi' : hasKannada ? 'kn' : /\b(bhai|kal|tak|wala|hai)\b/i.test(input) ? 'mixed' : 'en',
    confidence: 0.35,
    created_at: now,
    last_recalled: now,
    recalled_count: 0,
    tags: [type],
    linked_atoms: [],
    engine: 'heuristic-offline',
  }];
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
}
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, isNaN(n) ? 0.5 : n));
}
