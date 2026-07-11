import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { create } from 'zustand';

import { ATOM_COLORS } from '@/constants/mnemo-theme';
import { useMemoryStore } from '@/lib/memory/store';
import type { RankedAtom } from '@/lib/agents/reasoner';

// The Dynamic Island — pill at top of screen that expands when a context
// trigger fires. Max 2 atoms, auto-dismiss after 8s, tap ✓ to confirm.

interface IslandState {
  visible: boolean;
  title: string;
  atoms: RankedAtom[];
  show: (title: string, atoms: RankedAtom[]) => void;
  hide: () => void;
}

export const useIsland = create<IslandState>((set) => ({
  visible: false,
  title: '',
  atoms: [],
  show: (title, atoms) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); // "I remembered something"
    set({ visible: true, title, atoms: atoms.slice(0, 2) });
  },
  hide: () => set({ visible: false }),
}));

export function DynamicIsland() {
  const { visible, title, atoms, hide } = useIsland();
  const confirmAtom = useMemoryStore((s) => s.confirmAtom);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(hide, 8000);
    return () => clearTimeout(t);
  }, [visible, hide]);

  if (!visible) return null;

  return (
    <Animated.View entering={FadeInUp.springify()} exiting={FadeOutUp} style={styles.wrap} pointerEvents="box-none">
      <View style={styles.island}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>🧠 {title}</Text>
          <Pressable hitSlop={10} onPress={hide}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>
        {atoms.length === 0 ? (
          // Honesty over hallucination.
          <Text style={styles.empty}>Nothing notable — Mnemo won't make things up.</Text>
        ) : (
          atoms.map((a) => (
            <View key={a.id} style={[styles.atomRow, { borderLeftColor: ATOM_COLORS[a.type].border }]}>
              <Text style={styles.atomText} numberOfLines={2}>
                {a.content}
              </Text>
              <View style={styles.atomMeta}>
                <Text style={styles.confText}>{Math.round(a.eff * 100)}%</Text>
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    confirmAtom(a.id);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  }}>
                  <Text style={styles.confirm}>✓</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 54, left: 0, right: 0, zIndex: 100, alignItems: 'center' },
  island: {
    width: '92%',
    backgroundColor: 'rgba(10,12,16,0.97)',
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(245,197,24,0.35)',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  title: { color: '#F5C518', fontWeight: '800', fontSize: 13, letterSpacing: 0.4 },
  close: { color: '#9BA1A6', fontSize: 13 },
  empty: { color: '#B0B4BA', fontSize: 13, fontStyle: 'italic' },
  atomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 3,
    paddingLeft: 10,
    paddingVertical: 6,
    marginTop: 4,
  },
  atomText: { color: '#EDEFF2', fontSize: 14, flex: 1, lineHeight: 19 },
  atomMeta: { alignItems: 'center', marginLeft: 10, gap: 4 },
  confText: { color: '#9BA1A6', fontSize: 11, fontWeight: '700' },
  confirm: { color: '#4ADE80', fontSize: 18, fontWeight: '800' },
});
