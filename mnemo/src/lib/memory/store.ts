import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { handoff } from '../orchestrator';
import { effectiveConfidence, shouldArchive } from './decay';
import type { LangCode, MemoryAtom } from './types';

interface MemoryState {
  atoms: MemoryAtom[];
  addAtoms: (atoms: MemoryAtom[]) => void;
  /** Swipe right — Check loop confirm: confidence +0.1, recall reset */
  confirmAtom: (id: string) => void;
  /** Long-press correct — Check loop fix: user rewrites content, confidence → 0.95 */
  correctAtom: (id: string, content: string) => void;
  dismissAtom: (id: string) => void;
  recallAtoms: (ids: string[]) => void;
  wipe: () => void;
}

export const useMemoryStore = create<MemoryState>()(
  persist(
    (set) => ({
      atoms: [],
      addAtoms: (incoming) =>
        set((s) => {
          const linked = linkAndDetectConflicts(incoming, s.atoms);
          handoff('store', 'store', `${incoming.length} atom(s) inserted`, undefined, 'info');
          return { atoms: [...linked.updatedExisting, ...linked.newAtoms] };
        }),
      confirmAtom: (id) =>
        set((s) => ({
          atoms: s.atoms.map((a) =>
            a.id === id
              ? {
                  ...a,
                  confidence: Math.min(1, a.confidence + 0.1),
                  last_recalled: Date.now(),
                  recalled_count: a.recalled_count + 1,
                }
              : a
          ),
        })),
      correctAtom: (id, content) =>
        set((s) => ({
          atoms: s.atoms.map((a) =>
            a.id === id
              ? { ...a, content, confidence: 0.95, last_recalled: Date.now(), conflict_with: undefined }
              : a
          ),
        })),
      dismissAtom: (id) =>
        set((s) => ({ atoms: s.atoms.map((a) => (a.id === id ? { ...a, archived: true } : a)) })),
      recallAtoms: (ids) =>
        set((s) => ({
          atoms: s.atoms.map((a) =>
            ids.includes(a.id)
              ? { ...a, last_recalled: Date.now(), recalled_count: a.recalled_count + 1 }
              : a
          ),
        })),
      wipe: () => set({ atoms: [] }),
    }),
    { name: 'mnemo.memory', storage: createJSONStorage(() => AsyncStorage) }
  )
);

/** Live (non-archived, above floor) atoms with decay applied at read time. */
export function liveAtoms(atoms: MemoryAtom[]): (MemoryAtom & { eff: number })[] {
  const now = Date.now();
  return atoms
    .filter((a) => !a.archived && !shouldArchive(a, now))
    .map((a) => ({ ...a, eff: effectiveConfidence(a, now) }));
}

export function memoryHealth(atoms: MemoryAtom[]) {
  const live = liveAtoms(atoms);
  const langs: Partial<Record<LangCode, number>> = {};
  for (const a of live) langs[a.language_detected] = (langs[a.language_detected] ?? 0) + 1;
  const avg = live.length ? live.reduce((s, a) => s + a.eff, 0) / live.length : 0;
  return { total: live.length, avgConfidence: avg, langs };
}

/**
 * Graph maintenance on insert:
 * - link new atoms to existing ones sharing a person/org entity (cross-language recall works
 *   because entities are English-normalized at extraction)
 * - conflict detection: two decisions sharing an entity/tag with different content within 14d
 *   → both flagged, both surfaced faded. Newer keeps higher base confidence (timestamp rule).
 */
function linkAndDetectConflicts(newAtoms: MemoryAtom[], existing: MemoryAtom[]) {
  const updatedExisting = [...existing];
  const out: MemoryAtom[] = [];
  const FOURTEEN_D = 14 * 86_400_000;

  for (const atom of newAtoms) {
    const a = { ...atom };
    const aEnts = entKey(a);
    for (let i = 0; i < updatedExisting.length; i++) {
      const b = updatedExisting[i];
      if (b.archived) continue;
      const shared = entKey(b).some((e) => aEnts.some((x) => entityMatch(x, e)));
      if (!shared) continue;
      if (!a.linked_atoms.includes(b.id)) a.linked_atoms = [...a.linked_atoms, b.id];
      if (!b.linked_atoms.includes(a.id))
        updatedExisting[i] = { ...b, linked_atoms: [...b.linked_atoms, a.id] };
      const conflict =
        a.type === 'decision' &&
        b.type === 'decision' &&
        Math.abs(a.created_at - b.created_at) < FOURTEEN_D &&
        a.content.trim().toLowerCase() !== b.content.trim().toLowerCase() &&
        a.tags.some((t) => b.tags.includes(t));
      if (conflict) {
        a.conflict_with = b.id;
        updatedExisting[i] = { ...updatedExisting[i], conflict_with: a.id };
        handoff('reasoner', 'antigravity', 'conflict detected', `"${a.content}" vs "${b.content}"`, 'conflict');
      }
    }
    out.push(a);
  }
  return { newAtoms: out, updatedExisting };
}

function entKey(a: MemoryAtom): string[] {
  return [...a.entities.people, ...a.entities.orgs].map((e) => e.toLowerCase());
}

// Honorifics/suffixes stripped so "Rohan bhai" == "Rohan", "Priya ji" == "Priya".
const HONORIFICS = /\b(bhai|bhaiya|ji|anna|akka|garu|sir|madam|amma|appa|da|na)\b/g;

export function entityMatch(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(HONORIFICS, '').replace(/\s+/g, ' ').trim();
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  return na === nb || na.startsWith(`${nb} `) || nb.startsWith(`${na} `);
}
