import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useAtomSheet } from '@/components/atom-sheet';
import { ATOM_COLORS, C, SOURCE_LABEL, glassProps, timeLabel } from '@/constants/mnemo-theme';
import { useMemoryStore } from '@/lib/memory/store';
import type { MemoryAtom } from '@/lib/memory/types';

// Prototype feed card: white, radius 20, confidence → opacity, icon dot,
// DUE/VERIFY badges, ✓ Confirm / Archive buttons. Swipe right → confirm,
// swipe left → archive, tap → deep-dive sheet, long-press → inline correct.

export function AtomCard({ atom, eff }: { atom: MemoryAtom; eff: number }) {
  const { confirmAtom, dismissAtom, correctAtom } = useMemoryStore();
  const openSheet = useAtomSheet((s) => s.open);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(atom.content);
  const swipeRef = useRef<SwipeableMethods>(null);
  const c = ATOM_COLORS[atom.type];
  const g = glassProps(eff);
  const money = atom.entities.money;
  const isExpiring =
    atom.type === 'promise' && atom.entities.dates.some((d) => d <= new Date().toISOString().slice(0, 10));

  const confirm = () => {
    confirmAtom(atom.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };
  const dismiss = () => {
    dismissAtom(atom.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const onSwipe = (dir: 'left' | 'right') => {
    swipeRef.current?.close();
    if (dir === 'right') confirm();
    else dismiss();
  };

  return (
    <Animated.View entering={FadeIn.duration(280)} exiting={FadeOut.duration(200)} layout={LinearTransition.springify()}>
      <ReanimatedSwipeable
        ref={swipeRef}
        friction={1.6}
        rightThreshold={56}
        leftThreshold={56}
        renderLeftActions={() => <SwipeHint label="Confirm" color={C.success} align="flex-start" />}
        renderRightActions={() => <SwipeHint label="Archive" color={C.textTertiary} align="flex-end" />}
        onSwipeableOpen={(dir) => onSwipe(dir === 'left' ? 'right' : 'left')}>
        <View
          style={[
            styles.card,
            { opacity: g.opacity, borderWidth: g.borderWidth },
            isExpiring && styles.expiringBorder,
            atom.conflict_with != null && styles.conflict,
          ]}>
          <Pressable
            onPress={() => openSheet(atom.id)}
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setEditing(true);
            }}
            style={styles.bodyRow}>
            <View style={[styles.iconDot, { backgroundColor: c.bg }]}>
              <Text style={[styles.iconTxt, { color: c.accent }]}>{c.icon}</Text>
            </View>
            <View style={styles.bodyCol}>
              <View style={styles.metaRow}>
                <Text style={[styles.typeLabel, { color: eff >= 0.7 ? c.accent : c.faded }]}>{c.label.toUpperCase()}</Text>
                {isExpiring ? <Text style={styles.due}>DUE</Text> : null}
                {atom.conflict_with != null ? <Text style={styles.verify}>VERIFY</Text> : null}
                <View style={{ flex: 1 }} />
                <Text style={styles.conf}>{Math.round(eff * 100)}%</Text>
              </View>

              {editing ? (
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  onSubmitEditing={() => {
                    correctAtom(atom.id, draft.trim() || atom.content);
                    setEditing(false);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }}
                  onBlur={() => setEditing(false)}
                  autoFocus
                  multiline
                  style={styles.editInput}
                  returnKeyType="done"
                  submitBehavior="blurAndSubmit"
                />
              ) : (
                <Text style={styles.content}>{atom.content}</Text>
              )}

              {money?.amount != null ? <Text style={styles.money}>₹{money.amount.toLocaleString('en-IN')}</Text> : null}

              <Text style={styles.trace}>
                {timeLabel(atom.created_at)} · {SOURCE_LABEL[atom.source] ?? atom.source}
              </Text>
            </View>
          </Pressable>

          <View style={styles.actions}>
            <Pressable style={({ pressed }) => [styles.confirmBtn, pressed && styles.pressed]} onPress={confirm}>
              <Text style={styles.confirmTxt}>✓ Confirm</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.archiveBtn, pressed && styles.pressed]} onPress={dismiss}>
              <Text style={styles.archiveTxt}>Archive</Text>
            </Pressable>
          </View>
        </View>
      </ReanimatedSwipeable>
    </Animated.View>
  );
}

function SwipeHint({ label, color, align }: { label: string; color: string; align: 'flex-start' | 'flex-end' }) {
  return (
    <View style={[styles.hint, { alignItems: align }]}>
      <Text style={[styles.hintTxt, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 5,
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 14,
    borderColor: C.separator,
  },
  expiringBorder: { borderColor: 'rgba(209,79,62,0.45)', borderWidth: 1.5 },
  conflict: { borderStyle: 'dashed', borderColor: C.amberSoft },
  bodyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  iconDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  iconTxt: { fontSize: 11, fontWeight: '800' },
  bodyCol: { flex: 1, minWidth: 0 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  typeLabel: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8 },
  due: { fontSize: 9.5, fontWeight: '800', color: C.danger, letterSpacing: 0.5 },
  verify: { fontSize: 9.5, fontWeight: '700', color: C.amber },
  conf: { fontSize: 11, color: C.textTertiary, fontWeight: '600', fontVariant: ['tabular-nums'] },
  content: { fontSize: 14.5, color: C.text, lineHeight: 20 },
  editInput: { fontSize: 14.5, color: C.text, borderBottomWidth: 1, borderColor: C.amber, paddingVertical: 2 },
  money: { fontSize: 20, fontWeight: '700', color: C.success, marginTop: 4, fontVariant: ['tabular-nums'] },
  trace: { fontSize: 11.5, color: C.textTertiary, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10, paddingLeft: 36 },
  confirmBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(30,158,90,0.09)' },
  confirmTxt: { color: C.success, fontSize: 12, fontWeight: '700' },
  archiveBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.04)' },
  archiveTxt: { color: C.textSecondary, fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  hint: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  hintTxt: { fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
});
