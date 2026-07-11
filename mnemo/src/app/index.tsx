import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { AtomCard } from '@/components/atom-card';
import { useIsland } from '@/components/dynamic-island';
import { C } from '@/constants/mnemo-theme';
import {
  captureClipboard,
  captureImage,
  expiringPromises,
  extractAtoms,
  financialLedger,
  liveAtoms,
  memoryHealth,
  searchAtoms,
  seedDemo,
  simulateAppOpen,
  simulateNotification,
  useMemoryStore,
  wipeMemory,
  type MemoryAtom,
} from '@/lib/mnemo';

// Home (prototype): greeting header, ambient-trigger chips, stats strip,
// search, today's memory feed, capture composer. Capture sources (camera,
// clipboard, notification demo) live in the chips row.

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const atoms = useMemoryStore((s) => s.atoms);
  const island = useIsland();
  const [query, setQuery] = useState('');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const live = useMemo(() => liveAtoms(atoms).sort((a, b) => b.created_at - a.created_at), [atoms]);
  const health = useMemo(() => memoryHealth(atoms), [atoms]);
  const results = useMemo(() => (query.trim() ? searchAtoms(query) : null), [query, atoms]);
  const shown = results ?? live;
  const langLine = Object.keys(health.langs).map((l) => l.toUpperCase().replace('MIXED', 'HI-EN')).join(' · ') || '—';

  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);
  const flash = (msg: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(msg);
    noticeTimer.current = setTimeout(() => setNotice(null), 3000);
  };

  const runCapture = async (label: string, fn: () => Promise<MemoryAtom[]>) => {
    if (busy) return;
    setBusy(label);
    try {
      const extracted = await fn();
      if (extracted.length) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        flash(`Captured — ${extracted.length} memory atom${extracted.length > 1 ? 's' : ''} created.`);
      } else {
        flash('Nothing extracted.');
      }
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Capture failed.');
    } finally {
      setBusy(null);
    }
  };

  const capture = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy('type');
    try {
      const { atoms: extracted, engine } = await extractAtoms(text, 'manual');
      if (extracted.length === 0) {
        flash('Nothing memorable found in that.');
      } else {
        useMemoryStore.getState().addAtoms(extracted);
        setInput('');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        flash(engine === 'heuristic-offline' ? 'Captured offline — will refine when online.' : 'Captured — new memory atom created.');
      }
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Capture failed — try again.');
    } finally {
      setBusy(null);
    }
  };

  // Top people from the memory graph (frequency-ranked); demo names only as
  // an empty-graph fallback so the trigger chips never query nobody.
  const topPeople = useMemo(() => {
    const freq = new Map<string, number>();
    for (const a of live) for (const p of a.entities.people) freq.set(p, (freq.get(p) ?? 0) + 1);
    const ranked = [...freq.entries()].sort((x, y) => y[1] - x[1]).map(([p]) => p);
    return ranked.length ? ranked.slice(0, 2) : ['Rohan', 'Priya'];
  }, [live]);

  const chips: { key: string; label: string; onPress: () => void }[] = [
    {
      key: 'message',
      label: `💬 Message ${topPeople[0]}`,
      onPress: () => {
        const { title, atoms: ranked } = simulateAppOpen(topPeople[0]);
        island.show(title, ranked);
      },
    },
    {
      key: 'meeting',
      label: '📅 Meeting in 5 min',
      onPress: () => {
        const who = topPeople[1] ?? topPeople[0];
        const { atoms: ranked } = simulateAppOpen(who);
        island.show(`Meeting with ${who} in 5 min`, ranked);
      },
    },
    {
      key: 'payments',
      label: '₹ Open payments',
      onPress: () => {
        const led = financialLedger();
        island.show('Payments', [...led.iOwe, ...led.owedToMe]);
      },
    },
    {
      key: 'expiring',
      label: '⏰ Expiring promises',
      onPress: () => island.show('Promises nearing expiry', expiringPromises()),
    },
    { key: 'camera', label: busy === 'camera' ? '📷 Scanning…' : '📷 Scan', onPress: () => runCapture('camera', () => captureImage(true)) },
    { key: 'gallery', label: busy === 'gallery' ? '🖼 Reading…' : '🖼 Gallery', onPress: () => runCapture('gallery', () => captureImage(false)) },
    { key: 'clip', label: busy === 'clip' ? '📋 Reading…' : '📋 Clipboard', onPress: () => runCapture('clip', captureClipboard) },
    {
      key: 'notif',
      label: busy === 'notif' ? '🔔 Listening…' : '🔔 Notification demo',
      onPress: () =>
        runCapture('notif', () => simulateNotification('WhatsApp', 'Rohan bhai, kal tak Zenith quote bhej dena — ₹4,200 wala')),
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>{greeting()}</Text>
              <Text style={styles.brand}>Mnemo</Text>
            </View>
            <View style={styles.avatar}>
              <Text style={styles.avatarTxt}>M</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {chips.map((chip) => (
              <Pressable key={chip.key} style={({ pressed }) => [styles.chip, pressed && styles.pressed]} onPress={chip.onPress}>
                <Text style={styles.chipTxt}>{chip.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.statsCard}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{Math.round(health.avgConfidence * 100)}%</Text>
              <Text style={styles.statLabel}>CONFIDENCE</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNum}>{health.total}</Text>
              <Text style={styles.statLabel}>MEMORIES</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={[styles.stat, { flex: 1, alignItems: 'flex-start' }]}>
              <Text style={styles.statLang} numberOfLines={1}>{langLine}</Text>
              <Text style={styles.statLabel}>LANGUAGES</Text>
            </View>
          </View>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search memory graph…"
            placeholderTextColor={C.textTertiary}
            style={styles.search}
            clearButtonMode="while-editing"
          />

          {shown.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyTitle}>{query ? 'No memories match.' : 'Your memory starts here.'}</Text>
              {!query ? (
                <>
                  <Text style={styles.emptyBody}>
                    Speak, type, or scan — Mnemo structures your life into memory atoms. Or load the demo story.
                  </Text>
                  <Pressable
                    style={({ pressed }) => [styles.seedBtn, pressed && styles.pressed]}
                    onPress={() => {
                      seedDemo();
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }}>
                    <Text style={styles.seedTxt}>Load demo memories</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>{query ? `Results · ${shown.length}` : "Today's memories"}</Text>
              {shown.map((a) => (
                <AtomCard key={a.id} atom={a} eff={a.eff} />
              ))}
              {!query && live.length > 0 ? (
                <Pressable style={({ pressed }) => [styles.wipe, pressed && styles.pressed]} onPress={wipeMemory}>
                  <Text style={styles.wipeTxt}>Wipe memory</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </ScrollView>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        <View style={styles.captureBar}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Capture a thought — any language…"
            placeholderTextColor={C.textTertiary}
            style={styles.captureInput}
            multiline
            editable={busy !== 'type'}
          />
          <Pressable
            onPress={capture}
            disabled={!!busy || !input.trim()}
            style={({ pressed }) => [styles.captureBtn, (pressed || busy === 'type') && styles.pressed, !input.trim() && styles.disabled]}>
            <Text style={styles.captureBtnTxt}>{busy === 'type' ? '…' : '↑'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingBottom: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 8 },
  greeting: { fontSize: 13, color: C.textSecondary, fontWeight: '500' },
  brand: { color: C.text, fontSize: 30, fontWeight: '700', letterSpacing: -0.7, marginTop: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  avatarTxt: { color: '#fff', fontSize: 14, fontWeight: '600' },
  chipRow: { gap: 8, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 2 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.separator,
  },
  chipTxt: { fontSize: 13, fontWeight: '600', color: C.text },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stat: { alignItems: 'flex-start' },
  statNum: { fontSize: 19, fontWeight: '800', color: C.text, fontVariant: ['tabular-nums'] },
  statLang: { fontSize: 13, fontWeight: '600', color: C.text },
  statLabel: { fontSize: 10, color: C.textTertiary, fontWeight: '600', letterSpacing: 0.3, marginTop: 1 },
  statDivider: { width: 1, height: 26, backgroundColor: 'rgba(0,0,0,0.08)' },
  search: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: C.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: C.text,
    fontSize: 14.5,
    borderWidth: 1,
    borderColor: C.separator,
  },
  sectionTitle: {
    color: C.textTertiary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginHorizontal: 22,
    marginTop: 18,
    marginBottom: 8,
  },
  emptyWrap: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 36, gap: 12 },
  emptyTitle: { color: C.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  emptyBody: { color: C.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  seedBtn: {
    marginTop: 8,
    backgroundColor: C.ink,
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  seedTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  wipe: { alignSelf: 'center', marginTop: 18, padding: 8 },
  wipeTxt: { color: C.textTertiary, fontSize: 12 },
  notice: { color: C.success, fontSize: 11.5, textAlign: 'center', paddingBottom: 6, backgroundColor: C.bg },
  captureBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 8,
    backgroundColor: C.bg,
    borderTopWidth: 0.75,
    borderTopColor: C.cardBorder,
  },
  captureInput: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: C.text,
    fontSize: 14.5,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: C.inputBorder,
  },
  captureBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.35 },
});
