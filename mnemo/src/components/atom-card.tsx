import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { ATOM_COLORS, LANG_LABEL, TIER_OPACITY } from '@/constants/mnemo-theme';
import { confidenceTier } from '@/lib/memory/decay';
import { useMemoryStore } from '@/lib/memory/store';
import type { MemoryAtom } from '@/lib/memory/types';

// Glass card. Opacity = confidence tier: solid → frosted → ghost.
// Tap confirm ✓ (+0.1, Check-loop strengthen) · dismiss ✗ · long-press to correct.

export function AtomCard({ atom, eff }: { atom: MemoryAtom; eff: number }) {
  const { confirmAtom, dismissAtom, correctAtom } = useMemoryStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(atom.content);
  const c = ATOM_COLORS[atom.type];
  const tier = confidenceTier(eff);
  const money = atom.entities.money;

  return (
    <Pressable
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setEditing(true);
      }}
      style={[
        styles.card,
        { backgroundColor: c.bg, borderColor: c.border, opacity: TIER_OPACITY[tier] },
        atom.conflict_with ? styles.conflict : null,
      ]}>
      <View style={styles.headerRow}>
        <Text style={[styles.typeLabel, { color: c.text }]}>{c.label.toUpperCase()}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.lang}>{LANG_LABEL[atom.language_detected] ?? atom.language_detected}</Text>
          <Text style={styles.engine}>
            {atom.engine === 'gemma-local' ? '⚡ on-device' : atom.engine === 'flash-cloud' ? '☁ flash' : '~ heuristic'}
          </Text>
          <Text style={[styles.conf, { color: c.text }]}>{Math.round(eff * 100)}%</Text>
        </View>
      </View>

      {editing ? (
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => {
            correctAtom(atom.id, draft);
            setEditing(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }}
          autoFocus
          multiline
          style={styles.editInput}
          returnKeyType="done"
          blurOnSubmit
        />
      ) : (
        <Text style={styles.content}>{atom.content}</Text>
      )}

      <View style={styles.footerRow}>
        <Text style={styles.entities} numberOfLines={1}>
          {[...atom.entities.people, ...(money?.amount ? [`₹${money.amount.toLocaleString('en-IN')}`] : []), ...atom.entities.dates].join(' · ') || atom.tags.slice(0, 3).join(' · ')}
        </Text>
        <View style={styles.actions}>
          <Pressable
            hitSlop={8}
            onPress={() => {
              confirmAtom(atom.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}>
            <Text style={styles.actionTxt}>✓</Text>
          </Pressable>
          <Pressable
            hitSlop={8}
            onPress={() => dismissAtom(atom.id)}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}>
            <Text style={styles.actionTxt}>✗</Text>
          </Pressable>
        </View>
      </View>
      {atom.conflict_with ? <Text style={styles.conflictNote}>⚠ conflicts with another memory — tap ✓ on the right one</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    marginVertical: 5,
    marginHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  conflict: { borderStyle: 'dashed' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  metaRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  typeLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  lang: { fontSize: 11, color: '#9BA1A6', fontWeight: '700' },
  engine: { fontSize: 10, color: '#9BA1A6' },
  conf: { fontSize: 12, fontWeight: '800' },
  content: { fontSize: 15, color: '#EDEFF2', lineHeight: 21 },
  editInput: {
    fontSize: 15,
    color: '#EDEFF2',
    borderBottomWidth: 1,
    borderColor: '#F5C518',
    paddingVertical: 2,
  },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  entities: { fontSize: 12, color: '#B0B4BA', flex: 1, marginRight: 8 },
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  actionTxt: { color: '#EDEFF2', fontSize: 14, fontWeight: '700' },
  conflictNote: { marginTop: 6, fontSize: 11, color: '#F5C518' },
});
