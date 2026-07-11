import { liveAtoms, useMemoryStore } from '../memory/store';
import type { AtomType, MemoryAtom } from '../memory/types';
import { handoff } from '../orchestrator';

// AGENT 2 — THE REASONER (Decide).
// Queries the memory graph on context triggers, ranks atoms
// (recency × confidence × type priority), resolves what to surface.
// Runs entirely on-device — pure graph math, no model call needed for ranking.

const TYPE_PRIORITY: Record<AtomType, number> = {
  promise: 1.0,
  financial: 0.95,
  decision: 0.85,
  task: 0.8,
  health: 0.7,
  relationship: 0.6,
  fact: 0.5,
  location: 0.45,
  emotion: 0.4,
};

export interface RankedAtom extends MemoryAtom {
  eff: number;
  score: number;
}

const WEEK_MS = 7 * 86_400_000;

function rank(atoms: (MemoryAtom & { eff: number })[], now = Date.now()): RankedAtom[] {
  return atoms
    .map((a) => {
      const ageDays = (now - a.created_at) / 86_400_000;
      const recency = Math.exp(-0.15 * ageDays);
      return { ...a, score: recency * a.eff * TYPE_PRIORITY[a.type] };
    })
    .sort((x, y) => y.score - x.score);
}

/** Context trigger: user opened a conversation/meeting with a person. */
export function queryPerson(name: string): RankedAtom[] {
  const atoms = liveAtoms(useMemoryStore.getState().atoms);
  const n = name.toLowerCase();
  const hits = atoms.filter(
    (a) =>
      a.entities.people.some((p) => p.toLowerCase().includes(n)) ||
      a.tags.includes(n) ||
      a.content.toLowerCase().includes(n)
  );
  const ranked = rank(hits);
  handoff('reasoner', 'antigravity', `person query "${name}"`, `${ranked.length} atom(s), top: ${ranked[0]?.content.slice(0, 50) ?? 'none'}`);
  useMemoryStore.getState().recallAtoms(ranked.slice(0, 4).map((a) => a.id));
  return ranked;
}

/** Promises nearing expiry (dated today/past, or created >3 days ago and unresolved). */
export function expiringPromises(): RankedAtom[] {
  const now = Date.now();
  const atoms = liveAtoms(useMemoryStore.getState().atoms).filter((a) => a.type === 'promise');
  const today = new Date().toISOString().slice(0, 10);
  const urgent = atoms.filter(
    (a) => a.entities.dates.some((d) => d <= today) || now - a.created_at > 3 * 86_400_000
  );
  return rank(urgent, now);
}

/** Financial ledger — owed to you vs you owe, computed on-device only.
 *  Pass `source` to derive from an already-subscribed atom array, and
 *  `log: false` when calling from render paths (handoff() writes a store). */
export function financialLedger(source?: MemoryAtom[], log = true) {
  const atoms = liveAtoms(source ?? useMemoryStore.getState().atoms).filter(
    (a) => a.type === 'financial' || a.entities.money
  );
  const oweRe = /\b(owe|dena|pay|payable|udhaar liya)\b/i;
  const owedRe = /\b(owed|lena|receive|receivable|pending|outstanding|udhaar diya)\b/i;
  const iOwe: RankedAtom[] = [];
  const owedToMe: RankedAtom[] = [];
  const unclassified: RankedAtom[] = [];
  for (const a of rank(atoms)) {
    if (oweRe.test(a.content) && !owedRe.test(a.content)) iOwe.push(a);
    else if (owedRe.test(a.content)) owedToMe.push(a);
    else unclassified.push(a); // money mentioned, direction unknown — never inflate totals
  }
  if (log) {
    handoff('reasoner', 'antigravity', 'financial ledger computed on-device', `${iOwe.length} payable, ${owedToMe.length} receivable`, 'info');
  }
  return { iOwe, owedToMe, unclassified };
}

/** Everything from the past 7 days — feeds "My Week" and recap video. */
export function weekAtoms(): RankedAtom[] {
  const now = Date.now();
  const atoms = liveAtoms(useMemoryStore.getState().atoms).filter((a) => now - a.created_at <= WEEK_MS);
  return rank(atoms, now);
}

/** Atoms flagged as conflicting — surfaced faded, both sides. */
export function conflicts(): RankedAtom[] {
  const atoms = liveAtoms(useMemoryStore.getState().atoms).filter((a) => a.conflict_with);
  return rank(atoms);
}

/** Compact plain-text dump of atoms for Generator prompts. */
export function atomsToContext(atoms: RankedAtom[]): string {
  return atoms
    .map((a) => {
      const money = a.entities.money ? ` [₹${a.entities.money.amount?.toLocaleString('en-IN')}]` : '';
      const dates = a.entities.dates.length ? ` (dates: ${a.entities.dates.join(', ')})` : '';
      const conflict = a.conflict_with ? ' [CONFLICTED — verify with user]' : '';
      return `- [${a.type}, conf ${(a.eff * 100).toFixed(0)}%, ${a.language_detected}] ${a.content}${money}${dates} — people: ${a.entities.people.join(', ') || '—'}${conflict}`;
    })
    .join('\n');
}
