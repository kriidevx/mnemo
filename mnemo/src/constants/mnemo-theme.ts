import type { AtomType } from '@/lib/memory/types';

// Glass-card color language from the PRD.
export const ATOM_COLORS: Record<AtomType, { bg: string; border: string; text: string; label: string }> = {
  promise: { bg: 'rgba(245,197,24,0.16)', border: '#F5C518', text: '#8a6d00', label: 'Promise' },
  decision: { bg: 'rgba(30,64,175,0.14)', border: '#1E40AF', text: '#1E40AF', label: 'Decision' },
  financial: { bg: 'rgba(22,131,73,0.14)', border: '#168349', text: '#116636', label: 'Financial' },
  task: { bg: 'rgba(124,58,237,0.14)', border: '#7C3AED', text: '#6D28D9', label: 'Task' },
  emotion: { bg: 'rgba(236,112,155,0.14)', border: '#EC709B', text: '#BE3468', label: 'Emotion' },
  relationship: { bg: 'rgba(236,112,155,0.14)', border: '#EC709B', text: '#BE3468', label: 'Relationship' },
  fact: { bg: 'rgba(96,100,108,0.14)', border: '#60646C', text: '#3d4046', label: 'Fact' },
  location: { bg: 'rgba(13,148,136,0.14)', border: '#0D9488', text: '#0F766E', label: 'Location' },
  health: { bg: 'rgba(220,38,38,0.12)', border: '#DC2626', text: '#B91C1C', label: 'Health' },
};

export const LANG_LABEL: Record<string, string> = {
  hi: 'हिं', kn: 'ಕ', ta: 'த', te: 'తె', en: 'EN', mixed: 'MIX',
};

// Confidence tier → glass opacity (the "Mnemo is sure / vaguely remembers" language).
export const TIER_OPACITY = { solid: 1, sure: 0.85, hazy: 0.62, ghost: 0.4 } as const;

export const MNEMO_BG = '#0B0E13';
export const MNEMO_CARD = 'rgba(255,255,255,0.92)';
export const MNEMO_ACCENT = '#F5C518';
