import type { AtomType } from '@/lib/memory/types';

// MNEMO design tokens — warm-paper light system, ported 1:1 from the
// approved prototype (Mnemo Prototype.dc.html). Supersedes the old OLED spec.

export const C = {
  bg: '#FAFAF8',
  card: '#FFFFFF',
  text: '#1C1C1E',
  textSecondary: '#8E8E93',
  textTertiary: '#A0A0A5',
  tabDim: '#B5B5BA',
  separator: 'rgba(0,0,0,0.07)',
  cardBorder: 'rgba(0,0,0,0.06)',
  inputBorder: 'rgba(0,0,0,0.08)',
  danger: '#D14F3E',
  success: '#1E9E5A',
  amber: '#C97A00',
  amberSoft: 'rgba(201,122,0,0.45)',
  amberWash: 'rgba(201,122,0,0.08)',
  blue: '#3D6FC4',
  teal: '#1E948A',
  sky: '#2E93C9',
  ink: '#1C1C1E',
  // island stays dark glass over the light app — exact prototype recipe
  islandBg: 'rgba(28,28,30,0.94)',
  islandText: '#F5F5F7',
  islandDim: 'rgba(235,235,245,0.5)',
  islandAccent: '#FFA000',
  islandSuccess: '#30D158',
} as const;

export const ATOM_COLORS: Record<AtomType, { accent: string; bg: string; faded: string; label: string; icon: string }> = {
  promise: { accent: '#C97A00', bg: 'rgba(201,122,0,0.10)', faded: '#BCAAA4', label: 'Promise', icon: '!' },
  decision: { accent: '#3D6FC4', bg: 'rgba(61,111,196,0.09)', faded: '#90A4AE', label: 'Decision', icon: 'D' },
  financial: { accent: '#1E9E5A', bg: 'rgba(30,158,90,0.10)', faded: '#A5D6A7', label: 'Financial', icon: '₹' },
  task: { accent: '#1E948A', bg: 'rgba(30,148,138,0.10)', faded: '#80CBC4', label: 'Task', icon: 'T' },
  location: { accent: '#2E93C9', bg: 'rgba(46,147,201,0.10)', faded: '#90CAF9', label: 'Location', icon: '◎' },
  relationship: { accent: '#BE5679', bg: 'rgba(190,86,121,0.10)', faded: '#F48FB1', label: 'People', icon: '☺' },
  emotion: { accent: '#BE5679', bg: 'rgba(190,86,121,0.10)', faded: '#F48FB1', label: 'Emotion', icon: '♥' },
  fact: { accent: '#8A8A8E', bg: 'rgba(138,138,142,0.10)', faded: '#BDBDBD', label: 'Fact', icon: 'i' },
  health: { accent: '#D14F3E', bg: 'rgba(209,79,62,0.10)', faded: '#EF9A9A', label: 'Health', icon: '+' },
};

// Bright accent variants for the dark island surface — the light-canvas
// ATOM_COLORS accents are too dim against near-black glass.
export const ATOM_DARK_ACCENT: Record<AtomType, string> = {
  promise: '#FFA000',
  decision: '#4A90D9',
  financial: '#34C759',
  task: '#2BB8A8',
  location: '#5AC8FA',
  relationship: '#E0699B',
  emotion: '#E0699B',
  fact: '#98989D',
  health: '#FF6B5E',
};

export const LANG_LABEL: Record<string, string> = {
  hi: 'HI', kn: 'KN', ta: 'TA', te: 'TE', en: 'EN', mixed: 'HI-EN',
};

// Confidence-Opacity System — prototype tierOf(): the card physically fades
// as Mnemo becomes less certain.
export function glassProps(conf: number): { opacity: number; borderWidth: number; tier: string } {
  if (conf >= 0.9) return { opacity: 1, borderWidth: 1, tier: 'Certain' };
  if (conf >= 0.7) return { opacity: 0.92, borderWidth: 1, tier: 'Pretty sure' };
  if (conf >= 0.5) return { opacity: 0.74, borderWidth: 0.75, tier: 'Uncertain' };
  return { opacity: 0.56, borderWidth: 0.5, tier: 'Vague' };
}

export const SOURCE_LABEL: Record<string, string> = {
  whatsapp_notification: 'WhatsApp',
  voice_input: 'Voice',
  clipboard: 'Clipboard',
  calendar: 'Calendar',
  manual: 'Typed',
  camera: 'Camera scan',
  call_transcript: 'Call',
};

export function timeLabel(createdAt: number): string {
  const days = Math.floor((Date.now() - createdAt) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}
