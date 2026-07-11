import { liveAtoms, useMemoryStore } from './store';
import type { MemoryAtom } from './types';

// FTS-style on-device search (the SQLite FTS5 role from the PRD, in-memory).
// Token match over content + entities + tags; archived atoms included when
// `includeArchived` — "archived, not deleted — recoverable but not surfaced".

export function searchAtoms(
  query: string,
  opts: { includeArchived?: boolean } = {}
): (MemoryAtom & { eff: number })[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const tokens = q.split(/\s+/);
  const all = useMemoryStore.getState().atoms;
  const pool = opts.includeArchived
    ? all.map((a) => ({ ...a, eff: 0 }))
    : liveAtoms(all);

  return pool
    .map((a) => {
      const hay = [
        a.content,
        ...a.entities.people,
        ...a.entities.orgs,
        ...a.tags,
        ...a.entities.dates,
        a.entities.money?.amount?.toString() ?? '',
      ]
        .join(' ')
        .toLowerCase();
      const hits = tokens.filter((t) => hay.includes(t)).length;
      return { atom: a, hits };
    })
    .filter((r) => r.hits === tokens.length || (tokens.length > 2 && r.hits >= tokens.length - 1))
    .sort((x, y) => y.hits - x.hits)
    .map((r) => r.atom);
}
