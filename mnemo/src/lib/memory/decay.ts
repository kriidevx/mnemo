import type { AtomType, MemoryAtom } from './types';

// Biologically-inspired decay. Promises decay fast (urgency), decisions slow (meant to stick),
// financial atoms never fully fade (money always matters).
export const DECAY_RATE: Record<AtomType, number> = {
  promise: 0.08,
  decision: 0.02,
  financial: 0.01,
  fact: 0.04,
  emotion: 0.05,
  task: 0.06,
  relationship: 0.03,
  location: 0.04,
  health: 0.03,
};

export const DECAY_FLOOR: Record<AtomType, number> = {
  promise: 0.3,
  decision: 0.3,
  financial: 0.6,
  fact: 0.3,
  emotion: 0.3,
  task: 0.3,
  relationship: 0.3,
  location: 0.3,
  health: 0.4,
};

const DAY_MS = 86_400_000;

/** Lazy decay computed on read: base × e^(-rate × days since last recall). */
export function effectiveConfidence(atom: MemoryAtom, now = Date.now()): number {
  const days = Math.max(0, (now - atom.last_recalled) / DAY_MS);
  const decayed = atom.confidence * Math.exp(-DECAY_RATE[atom.type] * days);
  return Math.max(decayed, Math.min(atom.confidence, DECAY_FLOOR[atom.type]));
}

/** Below floor → archived, not deleted. */
export function shouldArchive(atom: MemoryAtom, now = Date.now()): boolean {
  return effectiveConfidence(atom, now) <= DECAY_FLOOR[atom.type] && atom.type !== 'financial';
}

/** Glass tiers: solid → frosted → ghost. Drives card opacity + blur. */
export function confidenceTier(c: number): 'solid' | 'sure' | 'hazy' | 'ghost' {
  if (c >= 0.9) return 'solid';
  if (c >= 0.7) return 'sure';
  if (c >= 0.5) return 'hazy';
  return 'ghost';
}
