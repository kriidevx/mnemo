import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';

import { extractAtoms } from '../agents/listener';
import { scanAndRemember } from '../agents/generator-extra';
import { queryPerson, type RankedAtom } from '../agents/reasoner';
import { useMemoryStore } from '../memory/store';
import type { MemoryAtom } from '../memory/types';
import { handoff } from '../orchestrator';

// Listener input sources beyond voice/text. Real: clipboard, camera/gallery.
// Simulated (need native services — see ROADMAP in README): notification
// listener, accessibility app-switch events.

let lastClipboard = '';

/** Pull clipboard text → atoms. Call on app foreground or via a "capture clipboard" action. */
export async function captureClipboard(): Promise<MemoryAtom[]> {
  const text = await Clipboard.getStringAsync();
  if (!text || text === lastClipboard || text.length < 8) return [];
  lastClipboard = text;
  handoff('input', 'listener', 'clipboard captured', text.slice(0, 60));
  const { atoms } = await extractAtoms(text, 'clipboard');
  if (atoms.length) useMemoryStore.getState().addAtoms(atoms);
  return atoms;
}

/** Camera or gallery → Scan & Remember. Returns atoms (already stored). */
export async function captureImage(fromCamera: boolean): Promise<MemoryAtom[]> {
  const perm = fromCamera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return [];
  const res = fromCamera
    ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 })
    : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });
  const asset = res.assets?.[0];
  if (res.canceled || !asset?.base64) return [];
  const atoms = await scanAndRemember(asset.base64, asset.mimeType ?? 'image/jpeg');
  if (atoms.length) useMemoryStore.getState().addAtoms(atoms);
  return atoms;
}

// ---- Simulated ambient triggers (native NotificationListenerService /
// AccessibilityService are post-hackathon roadmap; these drive the demo) ----

/** Simulate a WhatsApp notification arriving → Listener extracts silently. */
export async function simulateNotification(appName: string, text: string): Promise<MemoryAtom[]> {
  handoff('input', 'listener', `notification: ${appName}`, text.slice(0, 60));
  const { atoms } = await extractAtoms(text, 'whatsapp_notification');
  if (atoms.length) useMemoryStore.getState().addAtoms(atoms);
  return atoms;
}

/** Simulate opening a chat/app with a person → context trigger → ranked atoms for the Island. */
export function simulateAppOpen(person: string): { title: string; atoms: RankedAtom[] } {
  handoff('input', 'reasoner', `context trigger: opened WhatsApp → ${person}`, undefined, 'info');
  return { title: `WhatsApp → ${person}`, atoms: queryPerson(person) };
}
