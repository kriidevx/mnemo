import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { AtomCard } from '@/components/atom-card';
import { useIsland } from '@/components/dynamic-island';
import { C } from '@/constants/mnemo-theme';
import {
  captureClipboard,
  captureImage,
  simulateAppOpen,
  simulateNotification,
  type MemoryAtom,
} from '@/lib/mnemo';

// Capture screen — Scan & Remember (camera/gallery), clipboard pull, and the
// ambient-trigger demo controls (simulated WhatsApp notification + app-open).

export default function ScanScreen() {
  const [busy, setBusy] = useState<string | null>(null);
  const [captured, setCaptured] = useState<MemoryAtom[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [notifText, setNotifText] = useState('Rohan bhai, kal tak Zenith quote bhej dena — ₹4,200 wala');
  const [person, setPerson] = useState('Rohan');
  const island = useIsland();

  const run = async (label: string, fn: () => Promise<MemoryAtom[]>) => {
    if (busy) return;
    setBusy(label);
    setNotice(null);
    try {
      const atoms = await fn();
      if (atoms.length) {
        setCaptured((prev) => [...atoms, ...prev]);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setNotice('Nothing extracted.');
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Capture</Text>

        <Text style={styles.section}>SCAN & REMEMBER</Text>
        <View style={styles.row}>
          <Big label={busy === 'camera' ? 'Scanning…' : 'Camera'} hint="Whiteboard, receipt, card" onPress={() => run('camera', () => captureImage(true))} />
          <Big label={busy === 'gallery' ? 'Reading…' : 'Gallery'} hint="Pick an existing photo" onPress={() => run('gallery', () => captureImage(false))} />
        </View>
        <Big full label={busy === 'clip' ? 'Reading…' : 'Pull from clipboard'} hint="Copied text → memory atoms" onPress={() => run('clip', captureClipboard)} />

        <Text style={styles.section}>AMBIENT TRIGGERS (DEMO)</Text>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Incoming notification</Text>
          <TextInput value={notifText} onChangeText={setNotifText} style={styles.input} multiline placeholderTextColor={C.textTertiary} />
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            onPress={() => run('notif', () => simulateNotification('WhatsApp', notifText))}>
            <Text style={styles.actionTxt}>{busy === 'notif' ? 'Listening…' : 'Deliver notification'}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Open WhatsApp chat with…</Text>
          <TextInput value={person} onChangeText={setPerson} style={styles.input} placeholderTextColor={C.textTertiary} />
          <Pressable
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
            onPress={() => {
              const { title, atoms } = simulateAppOpen(person.trim() || 'Rohan');
              island.show(title, atoms);
            }}>
            <Text style={styles.actionTxt}>Trigger context</Text>
          </Pressable>
          <Text style={styles.hint}>The pill drops down with what Mnemo remembers about them.</Text>
        </View>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {captured.length > 0 ? <Text style={styles.section}>CAPTURED</Text> : null}
        {captured.map((a) => (
          <AtomCard key={a.id} atom={a} eff={a.confidence} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Big({ label, hint, onPress, full }: { label: string; hint: string; onPress: () => void; full?: boolean }) {
  return (
    <Pressable style={({ pressed }) => [styles.big, full && styles.bigFull, pressed && styles.pressed]} onPress={onPress}>
      <Text style={styles.bigLabel}>{label}</Text>
      <Text style={styles.bigHint}>{hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 32 },
  title: { color: C.text, fontSize: 24, fontWeight: '800', marginTop: 12, marginHorizontal: 20 },
  section: {
    color: C.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginHorizontal: 20,
    marginTop: 22,
    marginBottom: 8,
  },
  row: { flexDirection: 'row', gap: 10, marginHorizontal: 16 },
  big: {
    flex: 1,
    backgroundColor: 'rgba(28,28,30,0.85)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 0.5,
    borderColor: C.separator,
  },
  bigFull: { marginHorizontal: 16, marginTop: 10, flex: undefined },
  bigLabel: { color: C.text, fontSize: 16, fontWeight: '700' },
  bigHint: { color: C.textTertiary, fontSize: 12, marginTop: 3 },
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: 'rgba(28,28,30,0.85)',
    borderRadius: 18,
    padding: 14,
    borderWidth: 0.5,
    borderColor: C.separator,
    gap: 10,
  },
  cardLabel: { color: C.textSecondary, fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 12,
    padding: 10,
    color: C.text,
    fontSize: 14,
    borderWidth: 0.5,
    borderColor: C.separator,
  },
  actionBtn: {
    backgroundColor: 'rgba(255,160,0,0.14)',
    borderColor: 'rgba(255,160,0,0.5)',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionTxt: { color: '#FFA000', fontWeight: '700', fontSize: 14 },
  hint: { color: C.textTertiary, fontSize: 11 },
  notice: { color: '#FFA000', fontSize: 12, textAlign: 'center', marginTop: 12 },
  pressed: { opacity: 0.7 },
});
