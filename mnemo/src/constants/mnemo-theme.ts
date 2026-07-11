import type { AtomType } from '@/lib/memory/types';

// MNEMO design tokens — OLED-black glass system (teammate UI spec §2).
// User override: NO purple anywhere — spec's task purple replaced with teal.

export const C = {
  bg: '#000000',
  card: 'rgba(28,28,30,0.72)',
  cardSolid: '#1C1C1E',
  text: '#F5F5F7',
  textSecondary: '#98989D',
  textTertiary: '#636366',
  separator: 'rgba(255,255,255,0.08)',
  danger: '#FF453A',
  success: '#30D158',
} as const;

export const ATOM_COLORS: Record<AtomType, { accent: string; faded: string; label: string; icon: string }> = {
  promise: { accent: '#FFA000', faded: '#8A6A2E', label: 'Promise', icon: '!' },
  decision: { accent: '#4A90D9', faded: '#44607E', label: 'Decision', icon: 'D' },
  financial: { accent: '#34C759', faded: '#3E6B4A', label: 'Financial', icon: '₹' },
  task: { accent: '#2BB8A8', faded: '#3A6862', label: 'Task', icon: 'T' },
  emotion: { accent: '#E0699B', faded: '#7E4B60', label: 'Emotion', icon: '♥' },
  relationship: { accent: '#E0699B', faded: '#7E4B60', label: 'People', icon: '☺' },
  fact: { accent: '#98989D', faded: '#5A5A5E', label: 'Fact', icon: 'i' },
  location: { accent: '#5AC8FA', faded: '#3F6F84', label: 'Location', icon: '◎' },
  health: { accent: '#FF6B5E', faded: '#8A4640', label: 'Health', icon: '+' },
};

export const LANG_LABEL: Record<string, string> = {
  hi: 'HI', kn: 'KN', ta: 'TA', te: 'TE', en: 'EN', mixed: 'HI-EN',
};

// Confidence-Opacity System (spec §2.1): opacity, border alpha, border width.
export function glassProps(conf: number): { opacity: number; borderAlpha: number; borderWidth: number; tier: string } {
  if (conf >= 0.9) return { opacity: 1, borderAlpha: 0.25, borderWidth: 1.5, tier: 'Certain' };
  if (conf >= 0.7) return { opacity: 0.8, borderAlpha: 0.15, borderWidth: 1, tier: 'Pretty sure' };
  if (conf >= 0.5) return { opacity: 0.55, borderAlpha: 0.08, borderWidth: 0.75, tier: 'Uncertain' };
  return { opacity: 0.32, borderAlpha: 0.05, borderWidth: 0.5, tier: 'Vague' };
}

export const SOURCE_LABEL: Record<string, string> = {
  whatsapp_notification: 'WhatsApp notification',
  voice_input: 'Voice',
  clipboard: 'Clipboard',
  calendar: 'Calendar',
  manual: 'Typed',
  camera: 'Camera scan',
  call_transcript: 'Call',
};
