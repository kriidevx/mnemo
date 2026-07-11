import { liveAtoms, memoryHealth, useMemoryStore } from '../memory/store';
import { conflicts, expiringPromises, financialLedger, type RankedAtom } from './reasoner';

// MODE 8 — Life Dashboard DATA layer (UI renders this; Mnemo's pitch stays
// "contextual ambient cards", never "a dashboard app").

export interface DashboardData {
  todayCards: RankedAtom[];
  expiring: RankedAtom[];      // red glow = overdue
  peopleYouOwe: { person: string; items: RankedAtom[] }[];
  financial: ReturnType<typeof financialLedger>;
  conflicts: RankedAtom[];
  health: ReturnType<typeof memoryHealth>;
}

export function dashboardData(): DashboardData {
  const all = useMemoryStore.getState().atoms;
  const live = liveAtoms(all);
  const todayStart = new Date().setHours(0, 0, 0, 0);

  const todayCards = live
    .filter((a) => a.created_at >= todayStart)
    .map((a) => ({ ...a, score: a.eff }))
    .sort((x, y) => y.score - x.score);

  // People you haven't settled with — promise/financial atoms grouped by person.
  const owedMap = new Map<string, RankedAtom[]>();
  for (const a of [...expiringPromises(), ...financialLedger().iOwe]) {
    for (const p of a.entities.people) {
      const k = p.toLowerCase();
      if (!owedMap.has(k)) owedMap.set(k, []);
      const list = owedMap.get(k)!;
      if (!list.some((x) => x.id === a.id)) list.push(a);
    }
  }

  return {
    todayCards,
    expiring: expiringPromises(),
    peopleYouOwe: [...owedMap.entries()].map(([person, items]) => ({
      person: items[0].entities.people.find((p) => p.toLowerCase() === person) ?? person,
      items,
    })),
    financial: financialLedger(),
    conflicts: conflicts(),
    health: memoryHealth(all),
  };
}
