export type AtomType =
  | 'promise'
  | 'decision'
  | 'financial'
  | 'fact'
  | 'emotion'
  | 'task'
  | 'relationship'
  | 'location'
  | 'health';

export type AtomSource =
  | 'whatsapp_notification'
  | 'voice_input'
  | 'clipboard'
  | 'calendar'
  | 'manual'
  | 'camera'
  | 'call_transcript';

export type LangCode = 'hi' | 'kn' | 'ta' | 'te' | 'en' | 'mixed';

export interface MemoryAtom {
  id: string;
  type: AtomType;
  content: string;
  entities: {
    people: string[];
    orgs: string[];
    money: { amount: number | null; currency: string } | null;
    dates: string[];
  };
  source: AtomSource;
  language_detected: LangCode;
  /** 0-1 extraction certainty (base, before decay) */
  confidence: number;
  created_at: number;
  last_recalled: number;
  recalled_count: number;
  tags: string[];
  linked_atoms: string[];
  /** set when Reasoner detects a contradicting atom */
  conflict_with?: string;
  /** extraction engine that produced it — shown in UI for honesty */
  engine: 'gemma-local' | 'flash-cloud' | 'heuristic-offline';
  archived?: boolean;
}
