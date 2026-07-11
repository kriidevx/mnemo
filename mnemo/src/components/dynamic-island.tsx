import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { create } from 'zustand';

import { ATOM_COLORS, C } from '@/constants/mnemo-theme';
import { useMemoryStore } from '@/lib/memory/store';
import type { RankedAtom } from '@/lib/agents/reasoner';

// The Pill (spec §3.1) — ambient overlay 16dp below the status bar. Expands on
// context triggers, shows max 2 atoms, auto-dismisses after 8s, spring physics.

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
    <Animated.View
      entering={FadeInUp.springify().damping(16).stiffness(140)}
      exiting={FadeOutUp.duration(220)}
      style={styles.wrap}
      pointerEvents="box-none">
      <BlurView intensity={70} tint="dark" style={styles.blur}>
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
              <View key={a.id} style={[styles.atomRow, { borderLeftColor: ATOM_COLORS[a.type].accent }]}>
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
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 58, left: 0, right: 0, zIndex: 100, alignItems: 'center' },
  blur: { borderRadius: 26, overflow: 'hidden', width: '92%' },
  island: {
    backgroundColor: 'rgba(12,12,14,0.82)',
    borderRadius: 26,
    padding: 14,
    borderWidth: 0.75,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFA000' },
  title: { color: C.text, fontWeight: '700', fontSize: 13, letterSpacing: 0.2, flex: 1 },
  close: { color: C.textTertiary, fontSize: 13 },
  empty: { color: C.textSecondary, fontSize: 13, fontStyle: 'italic' },
  atomRow: { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, paddingLeft: 10, paddingVertical: 6, marginTop: 4 },
  atomText: { color: C.text, fontSize: 14, flex: 1, lineHeight: 19 },
  atomMeta: { alignItems: 'center', marginLeft: 10, gap: 4 },
  confText: { color: C.textSecondary, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  confirm: { color: C.success, fontSize: 18, fontWeight: '800' },
});
