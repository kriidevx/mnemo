import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { create } from 'zustand';

import { ATOM_COLORS, C, LANG_LABEL, SOURCE_LABEL, glassProps, timeLabel } from '@/constants/mnemo-theme';
import { effectiveConfidence } from '@/lib/memory/decay';
import { useMemoryStore } from '@/lib/memory/store';
import type { MemoryAtom } from '@/lib/memory/types';

// Atom deep-dive bottom sheet (prototype "openSheet"): source trace, entities,
// conflict box, linked memories, confirm/archive. Tap a link to hop atoms.

interface SheetState {
  atomId: string | null;
  open: (id: string) => void;
  close: () => void;
}

export const useAtomSheet = create<SheetState>((set) => ({
  atomId: null,
  open: (id) => set({ atomId: id }),
  close: () => set({ atomId: null }),
}));

export function AtomSheet() {
  const { atomId, open, close } = useAtomSheet();
  // Select nothing while closed so the root-mounted sheet is free of
  // re-renders on every memory change.
  const atoms = useMemoryStore((s) => (atomId ? s.atoms : null));
  const { confirmAtom, dismissAtom } = useMemoryStore.getState();

  const atom = atomId && atoms ? atoms.find((a) => a.id === atomId) : undefined;
  if (!atom || !atoms) return null;

  const eff = effectiveConfidence(atom);
  const g = glassProps(eff);
  const c = ATOM_COLORS[atom.type];
  const money = atom.entities.money?.amount;
  const chips = [...atom.entities.people, ...atom.entities.orgs];
  const conflict = atom.conflict_with ? atoms.find((a) => a.id === atom.conflict_with) : undefined;
  const linked = atom.linked_atoms
    .map((id) => atoms.find((a) => a.id === id))
    .filter((a): a is MemoryAtom => !!a);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
            <View style={styles.headRow}>
              <View style={[styles.iconDot, { backgroundColor: c.bg }]}>
                <Text style={[styles.iconTxt, { color: c.accent }]}>{c.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.typeLabel, { color: c.accent }]}>{c.label.toUpperCase()}</Text>
                <Text style={styles.tierLine}>
                  {g.tier} · {Math.round(eff * 100)}% confidence · recalled {atom.recalled_count}×
                </Text>
              </View>
              <Pressable hitSlop={8} onPress={close} style={styles.closeBtn}>
                <Text style={styles.closeTxt}>✕</Text>
              </Pressable>
            </View>

            <Text style={styles.content}>{atom.content}</Text>
            {money != null ? <Text style={styles.money}>₹{money.toLocaleString('en-IN')}</Text> : null}

            {chips.length > 0 ? (
              <View style={styles.chipRow}>
                {chips.map((e) => (
                  <View key={e} style={[styles.chip, { borderColor: `${c.accent}55` }]}>
                    <Text style={[styles.chipTxt, { color: c.accent }]}>{e}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <Text style={styles.trace}>
              Extracted from {SOURCE_LABEL[atom.source] ?? atom.source} · {timeLabel(atom.created_at)} ·{' '}
              {LANG_LABEL[atom.language_detected] ?? 'EN'} ·{' '}
              {atom.engine === 'gemma-local' ? 'on-device ⚡' : atom.engine === 'flash-cloud' ? 'cloud ☁' : 'offline heuristic'}
            </Text>

            {conflict ? (
              <View style={styles.conflictBox}>
                <Text style={styles.conflictLabel}>CONFLICTS WITH ANOTHER MEMORY</Text>
                <Pressable onPress={() => open(conflict.id)}>
                  <Text style={styles.conflictTxt}>{conflict.content}</Text>
                </Pressable>
                <Text style={styles.conflictHint}>Confirm the correct memory to resolve — the other fades out.</Text>
              </View>
            ) : null}

            {linked.length > 0 ? (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.linkedLabel}>LINKED MEMORIES</Text>
                {linked.map((l) => {
                  const lc = ATOM_COLORS[l.type];
                  return (
                    <Pressable key={l.id} onPress={() => open(l.id)} style={styles.linkedRow}>
                      <View style={[styles.linkedDot, { backgroundColor: lc.bg }]}>
                        <Text style={[styles.linkedIcon, { color: lc.accent }]}>{lc.icon}</Text>
                      </View>
                      <Text style={styles.linkedTxt} numberOfLines={2}>{l.content}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                style={({ pressed }) => [styles.confirmBtn, pressed && styles.pressed]}
                onPress={() => {
                  confirmAtom(atom.id);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  close();
                }}>
                <Text style={styles.confirmTxt}>✓ Confirm</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.archiveBtn, pressed && styles.pressed]}
                onPress={() => {
                  dismissAtom(atom.id);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  close();
                }}>
                <Text style={styles.archiveTxt}>Archive</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '78%',
    backgroundColor: C.bg,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 30,
  },
  grabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.15)', alignSelf: 'center', marginBottom: 16 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  iconDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  iconTxt: { fontSize: 13, fontWeight: '800' },
  typeLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  tierLine: { color: C.textSecondary, fontSize: 11.5, marginTop: 1 },
  closeBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' },
  closeTxt: { color: '#6E6E73', fontSize: 13 },
  content: { fontSize: 18, fontWeight: '600', color: C.text, lineHeight: 26, letterSpacing: -0.2 },
  money: { fontSize: 26, fontWeight: '700', color: C.success, marginTop: 8, fontVariant: ['tabular-nums'] },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  chip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  chipTxt: { fontSize: 12.5, fontWeight: '600' },
  trace: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 0.75,
    borderTopColor: 'rgba(0,0,0,0.08)',
    color: C.textSecondary,
    fontSize: 12.5,
    lineHeight: 18,
  },
  conflictBox: {
    marginTop: 12,
    padding: 13,
    borderRadius: 14,
    backgroundColor: C.amberWash,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: C.amberSoft,
  },
  conflictLabel: { color: C.amber, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  conflictHint: { color: C.textSecondary, fontSize: 11.5, marginTop: 6, fontStyle: 'italic' },
  conflictTxt: { color: C.text, fontSize: 13.5, lineHeight: 18 },
  linkedLabel: { color: C.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  linkedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    borderRadius: 14,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
    marginBottom: 8,
  },
  linkedDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  linkedIcon: { fontSize: 10.5, fontWeight: '800' },
  linkedTxt: { flex: 1, fontSize: 13.5, color: C.text, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  confirmBtn: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 16, backgroundColor: 'rgba(30,158,90,0.1)' },
  confirmTxt: { color: C.success, fontWeight: '700', fontSize: 14 },
  archiveBtn: { flex: 1, alignItems: 'center', padding: 12, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.04)' },
  archiveTxt: { color: '#6E6E73', fontWeight: '700', fontSize: 14 },
  pressed: { opacity: 0.7 },
});
