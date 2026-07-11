import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { create } from 'zustand';

import { ATOM_DARK_ACCENT, C } from '@/constants/mnemo-theme';
import { useMemoryStore } from '@/lib/memory/store';
import type { RankedAtom } from '@/lib/agents/reasoner';

// The Pill — dark glass overlay dropping below the status bar (prototype
// "island"). Context triggers show max 2 atoms, auto-dismiss after 8s.

interface IslandState {
  visible: boolean;
  title: string;
  atoms: RankedAtom[];
  /** bumps on every show() so the auto-hide timer restarts even when already visible */
  shownAt: number;
  show: (title: string, atoms: RankedAtom[]) => void;
  hide: () => void;
}

export const useIsland = create<IslandState>((set) => ({
  visible: false,
  title: '',
  atoms: [],
  shownAt: 0,
  show: (title, atoms) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); // "I remembered something"
    set({ visible: true, title, atoms: atoms.slice(0, 2), shownAt: Date.now() });
  },
  hide: () => set({ visible: false }),
}));

export function DynamicIsland() {
  const { visible, title, atoms, shownAt, hide } = useIsland();
  const confirmAtom = useMemoryStore((s) => s.confirmAtom);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(hide, 8000);
    return () => clearTimeout(t);
  }, [visible, shownAt, hide]);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeInUp.springify().damping(16).stiffness(140)}
      exiting={FadeOutUp.duration(220)}
      style={styles.wrap}
      pointerEvents="box-none">
      <View style={styles.island}>
        <View style={styles.titleRow}>
          <View style={styles.liveDot} />
          <Text style={styles.title}>{title}</Text>
          <Pressable hitSlop={10} onPress={hide}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>
        {atoms.length === 0 ? (
          <Text style={styles.empty}>Nothing notable — Mnemo won't make things up.</Text>
        ) : (
          atoms.map((a) => (
            <View key={a.id} style={[styles.atomRow, { borderLeftColor: ATOM_DARK_ACCENT[a.type] }]}>
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
  wrap: { position: 'absolute', top: 58, left: 0, right: 0, zIndex: 100, alignItems: 'center' },
  island: {
    width: '88%',
    backgroundColor: C.islandBg,
    borderRadius: 24,
    padding: 14,
    paddingHorizontal: 16,
    borderWidth: 0.75,
    borderColor: 'rgba(255,255,255,0.1)',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.islandAccent },
  title: { color: C.islandText, fontWeight: '700', fontSize: 13, letterSpacing: 0.1, flex: 1 },
  close: { color: C.islandDim, fontSize: 14, paddingHorizontal: 4 },
  empty: { color: C.islandDim, fontSize: 13, fontStyle: 'italic' },
  atomRow: { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, paddingLeft: 10, paddingVertical: 6, marginTop: 2 },
  atomText: { color: C.islandText, fontSize: 13.5, flex: 1, lineHeight: 18 },
  atomMeta: { alignItems: 'center', marginLeft: 10, gap: 4 },
  confText: { color: C.islandDim, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  confirm: { color: C.islandSuccess, fontSize: 18, fontWeight: '800' },
});
