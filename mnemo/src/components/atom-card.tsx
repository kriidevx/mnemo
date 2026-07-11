import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

import { ATOM_COLORS, C, LANG_LABEL, SOURCE_LABEL, glassProps } from '@/constants/mnemo-theme';
import { useMemoryStore } from '@/lib/memory/store';
import type { MemoryAtom } from '@/lib/memory/types';

// Glass card (spec §2.1 + §3.2). Swipe right → confirm (+0.1), swipe left →
// archive, tap → deep dive (source trace + entities + links), long-press → inline correct.

export function AtomCard({ atom, eff }: { atom: MemoryAtom; eff: number }) {
  const { confirmAtom, dismissAtom, correctAtom } = useMemoryStore();
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(atom.content);
  const swipeRef = useRef<SwipeableMethods>(null);
  const c = ATOM_COLORS[atom.type];
  const g = glassProps(eff);
  const money = atom.entities.money;
  const isExpiring =
    atom.type === 'promise' && atom.entities.dates.some((d) => d <= new Date().toISOString().slice(0, 10));

  const onSwipe = (dir: 'left' | 'right') => {
    swipeRef.current?.close();
    if (dir === 'right') {
      confirmAtom(atom.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      dismissAtom(atom.id);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
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
        <Pressable
          onPress={() => setExpanded((e) => !e)}
          onLongPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setEditing(true);
          }}
          style={[styles.wrap, { opacity: g.opacity }]}>
          <BlurView intensity={eff >= 0.9 ? 24 : eff >= 0.7 ? 40 : 60} tint="dark" style={styles.blur}>
            <View
              style={[
                styles.inner,
                { borderColor: `rgba(255,255,255,${g.borderAlpha})`, borderWidth: g.borderWidth },
                isExpiring && { borderColor: 'rgba(255,69,58,0.55)', borderWidth: 1.5 },
                atom.conflict_with != null && styles.conflict,
              ]}>
              <View style={styles.headerRow}>
                <View style={styles.typeRow}>
                  <View style={[styles.iconDot, { backgroundColor: `${c.accent}26`, borderColor: c.accent }]}>
                    <Text style={[styles.iconTxt, { color: c.accent }]}>{c.icon}</Text>
                  </View>
                  <Text style={[styles.typeLabel, { color: eff >= 0.7 ? c.accent : c.faded }]}>
                    {c.label.toUpperCase()}
                  </Text>
                  {isExpiring ? <Text style={styles.expiring}>DUE</Text> : null}
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.langPill}>{LANG_LABEL[atom.language_detected] ?? 'EN'}</Text>
                  <Text style={[styles.conf, { color: c.accent }]}>{Math.round(eff * 100)}%</Text>
                </View>
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
                  blurOnSubmit
                />
              ) : (
                <Text style={styles.content}>{atom.content}</Text>
              )}

              {money?.amount ? (
                <Text style={styles.money}>₹{money.amount.toLocaleString('en-IN')}</Text>
              ) : null}

              {expanded ? (
                <Animated.View entering={FadeIn.duration(200)} style={styles.deepDive}>
                  <Text style={styles.trace}>
                    Extracted from {SOURCE_LABEL[atom.source] ?? atom.source} ·{' '}
                    {new Date(atom.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })} ·{' '}
                    {atom.engine === 'gemma-local' ? 'on-device' : atom.engine === 'flash-cloud' ? 'cloud' : 'offline heuristic'}
                  </Text>
                  {atom.entities.people.length + atom.entities.orgs.length > 0 ? (
                    <View style={styles.chipRow}>
                      {[...atom.entities.people, ...atom.entities.orgs].map((e) => (
                        <View key={e} style={[styles.chip, { borderColor: `${c.accent}55` }]}>
                          <Text style={[styles.chipTxt, { color: c.accent }]}>{e}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {atom.linked_atoms.length > 0 ? (
                    <Text style={styles.links}>⌘ {atom.linked_atoms.length} linked memor{atom.linked_atoms.length === 1 ? 'y' : 'ies'}</Text>
                  ) : null}
                  <Text style={styles.tier}>{g.tier} · recalled {atom.recalled_count}×</Text>
                </Animated.View>
              ) : null}

              {atom.conflict_with != null ? (
                <Text style={styles.conflictNote}>Conflicts with another memory — swipe → on the correct one</Text>
              ) : null}
            </View>
          </BlurView>
        </Pressable>
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
  wrap: { marginHorizontal: 16, marginVertical: 5 },
  blur: { borderRadius: 20, overflow: 'hidden' },
  inner: { borderRadius: 20, padding: 14, backgroundColor: 'rgba(28,28,30,0.55)' },
  conflict: { borderStyle: 'dashed', borderColor: 'rgba(255,160,0,0.45)' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  iconTxt: { fontSize: 12, fontWeight: '700' },
  typeLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2 },
  expiring: { fontSize: 10, fontWeight: '800', color: C.danger, letterSpacing: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  langPill: {
    fontSize: 10,
    fontWeight: '700',
    color: C.textSecondary,
    borderWidth: 0.5,
    borderColor: C.separator,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  conf: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  content: { fontSize: 16, color: C.text, lineHeight: 22, letterSpacing: -0.2 },
  editInput: { fontSize: 16, color: C.text, borderBottomWidth: 1, borderColor: '#FFA000', paddingVertical: 2 },
  money: { fontSize: 22, fontWeight: '700', color: '#34C759', marginTop: 6, fontVariant: ['tabular-nums'] },
  deepDive: { marginTop: 10, gap: 8, borderTopWidth: 0.5, borderTopColor: C.separator, paddingTop: 10 },
  trace: { fontSize: 12, color: C.textSecondary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3 },
  chipTxt: { fontSize: 12, fontWeight: '600' },
  links: { fontSize: 12, color: C.textSecondary },
  tier: { fontSize: 11, color: C.textTertiary },
  conflictNote: { marginTop: 8, fontSize: 11, color: '#FFA000' },
  hint: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  hintTxt: { fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
});
