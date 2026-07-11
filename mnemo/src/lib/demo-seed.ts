import { useMemoryStore } from './memory/store';
import type { MemoryAtom } from './memory/types';

// Demo seed — the exact PRD demo narrative (Rohan quote, Priya launch, SP Road, Urban Kitchen).
// Lets the Generator modes demo instantly without capturing a week of real life first.
// NOT mock product data — this is test fixture for a memory app; wiped with one tap.

const now = Date.now();
const DAY = 86_400_000;

function atom(partial: Partial<MemoryAtom> & Pick<MemoryAtom, 'type' | 'content'>): MemoryAtom {
  return {
    id: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
    entities: { people: [], orgs: [], money: null, dates: [] },
    source: 'manual',
    language_detected: 'en',
    confidence: 0.9,
    created_at: now,
    last_recalled: now,
    recalled_count: 0,
    tags: [],
    linked_atoms: [],
    engine: 'gemma-local',
    ...partial,
  };
}

export const DEMO_ATOMS: MemoryAtom[] = [
  atom({
    type: 'promise',
    content: 'Send revised Zenith quote to Rohan — ₹4,200',
    entities: { people: ['Rohan'], orgs: ['Zenith'], money: { amount: 4200, currency: 'INR' }, dates: [new Date(now + DAY).toISOString().slice(0, 10)] },
    source: 'voice_input',
    language_detected: 'mixed',
    confidence: 0.92,
    created_at: now - 1 * DAY,
    last_recalled: now - 1 * DAY,
    tags: ['zenith', 'invoicing', 'rohan'],
  }),
  atom({
    type: 'decision',
    content: 'Launch pushed to August — Priya confirmed',
    entities: { people: ['Priya'], orgs: [], money: null, dates: ['2026-08-01'] },
    source: 'voice_input',
    confidence: 0.95,
    created_at: now - 2 * DAY,
    last_recalled: now - 2 * DAY,
    tags: ['launch', 'priya'],
  }),
  atom({
    type: 'financial',
    content: 'Urban Kitchen pending payment to us — ₹4,200 outstanding',
    entities: { people: [], orgs: ['Urban Kitchen'], money: { amount: 4200, currency: 'INR' }, dates: [] },
    source: 'whatsapp_notification',
    confidence: 0.88,
    created_at: now - 4 * DAY,
    last_recalled: now - 4 * DAY,
    tags: ['payments', 'urban-kitchen'],
  }),
  atom({
    type: 'financial',
    content: 'I owe Rohan ₹460 for the SP Road components run',
    entities: { people: ['Rohan'], orgs: [], money: { amount: 460, currency: 'INR' }, dates: [] },
    source: 'manual',
    language_detected: 'en',
    confidence: 0.9,
    created_at: now - 3 * DAY,
    last_recalled: now - 3 * DAY,
    tags: ['sp-road', 'rohan'],
  }),
  atom({
    type: 'location',
    content: 'At SP Road: bought ESP32, forgot the XL6009 boost converter',
    entities: { people: [], orgs: [], money: null, dates: [] },
    source: 'voice_input',
    confidence: 0.8,
    created_at: now - 3 * DAY,
    last_recalled: now - 3 * DAY,
    tags: ['sp-road', 'electronics'],
  }),
  atom({
    type: 'task',
    content: 'Follow up with BlueCrate on bottle pricing',
    entities: { people: [], orgs: ['BlueCrate'], money: null, dates: [] },
    source: 'calendar',
    confidence: 0.75,
    created_at: now - 2 * DAY,
    last_recalled: now - 2 * DAY,
    tags: ['bluecrate', 'pricing'],
  }),
  // Deliberate conflict pair — demos Reasoner conflict surfacing (both faded, user resolves).
  atom({
    type: 'decision',
    content: 'Demo day set for Friday this week',
    entities: { people: ['Priya'], orgs: [], money: null, dates: [] },
    source: 'whatsapp_notification',
    confidence: 0.62,
    created_at: now - 5 * DAY,
    last_recalled: now - 5 * DAY,
    tags: ['launch', 'demo-day'],
  }),
];

export function seedDemo(): void {
  useMemoryStore.getState().addAtoms(DEMO_ATOMS);
}

export function wipeMemory(): void {
  useMemoryStore.getState().wipe();
}
