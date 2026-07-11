import { useMemo, useState } from 'react';
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
import { ATOM_COLORS, C } from '@/constants/mnemo-theme';
import {
  extractAtoms,
  liveAtoms,
  memoryHealth,
  searchAtoms,
  seedDemo,
  useMemoryStore,
  wipeMemory,
} from '@/lib/mnemo';

// MODE 8 — Life Dashboard home (spec §4): OLED timeline, health gauge,
// search, capture bar, today's memories with confidence-glass cards.

export default function MemoryScreen() {
  const atoms = useMemoryStore((s) => s.atoms);
  const [query, setQuery] = useState('');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const live = useMemo(() => liveAtoms(atoms).sort((a, b) => b.created_at - a.created_at), [atoms]);
  const health = useMemo(() => memoryHealth(atoms), [atoms]);
  const results = useMemo(() => (query.trim() ? searchAtoms(query) : null), [query, atoms]);
  const shown = results ?? live;

  const capture = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const { atoms: extracted, engine } = await extractAtoms(text, 'manual');
      if (extracted.length === 0) {
        setNotice('Nothing memorable found in that.');
      } else {
        useMemoryStore.getState().addAtoms(extracted);
        setInput('');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setNotice(engine === 'heuristic-offline' ? 'Captured offline — will refine when online.' : null);
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Capture failed — try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.safe}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>MNEMO</Text>
            <View style={styles.statusRow}>
              <View style={styles.liveDot} />
              <Text style={styles.status}>Ambient memory active</Text>
            </View>
          </View>
          <View style={styles.healthPill}>
            <Text style={styles.healthNum}>{Math.round(health.avgConfidence * 100)}%</Text>
            <Text style={styles.healthLabel}>{health.total} atoms</Text>
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

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
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
          {Object.keys(health.langs).length > 1 ? (
            <Text style={styles.langMix}>
              Languages: {Object.entries(health.langs).map(([l, n]) => `${l.toUpperCase()} ${n}`).join(' · ')}
            </Text>
          ) : null}
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
            editable={!busy}
          />
          <Pressable
            onPress={capture}
            disabled={busy || !input.trim()}
            style={({ pressed }) => [styles.captureBtn, (pressed || busy) && styles.pressed, !input.trim() && styles.disabled]}>
            <Text style={styles.captureBtnTxt}>{busy ? '…' : '↑'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 8 },
  brand: { color: C.text, fontSize: 28, fontWeight: '800', letterSpacing: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.success },
  status: { color: C.textSecondary, fontSize: 12 },
  healthPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(28,28,30,0.8)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 0.5,
    borderColor: C.separator,
  },
  healthNum: { color: '#FFA000', fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] },
  healthLabel: { color: C.textTertiary, fontSize: 10, marginTop: 1 },
  search: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
    backgroundColor: 'rgba(28,28,30,0.8)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: C.text,
    fontSize: 15,
    borderWidth: 0.5,
    borderColor: C.separator,
  },
  scroll: { paddingBottom: 24 },
  sectionTitle: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 6,
  },
  emptyWrap: { alignItems: 'center', paddingTop: 90, paddingHorizontal: 36, gap: 12 },
  emptyTitle: { color: C.text, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  emptyBody: { color: C.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  seedBtn: {
    marginTop: 8,
    backgroundColor: 'rgba(255,160,0,0.14)',
    borderColor: 'rgba(255,160,0,0.5)',
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  seedTxt: { color: '#FFA000', fontWeight: '700', fontSize: 14 },
  wipe: { alignSelf: 'center', marginTop: 18, padding: 8 },
  wipeTxt: { color: C.textTertiary, fontSize: 12 },
  langMix: { color: C.textTertiary, fontSize: 11, textAlign: 'center', marginTop: 10 },
  notice: { color: '#FFA000', fontSize: 12, textAlign: 'center', paddingBottom: 4 },
  captureBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
    paddingTop: 4,
  },
  captureInput: {
    flex: 1,
    backgroundColor: 'rgba(28,28,30,0.9)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: C.text,
    fontSize: 15,
    maxHeight: 110,
    borderWidth: 0.5,
    borderColor: C.separator,
  },
  captureBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFA000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtnTxt: { color: '#000', fontSize: 20, fontWeight: '800' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.35 },
});
