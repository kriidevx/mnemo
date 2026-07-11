import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { C } from '@/constants/mnemo-theme';

// Voice-journal waveform (spec §MODE 6) — GPU-driven bars via Reanimated.
// Prototype recording palette: blue/teal family on the light canvas.

const BAR_COUNT = 24;
const COLORS = [C.blue, C.sky, C.teal];
const IDLE = 'rgba(0,0,0,0.12)';

function Bar({ index, active }: { index: number; active: boolean }) {
  const h = useSharedValue(6);

  useEffect(() => {
    if (active) {
      const peak = 14 + Math.abs(Math.sin(index * 1.7)) * 42;
      h.value = withDelay(
        index * 36,
        withRepeat(
          withSequence(
            withTiming(peak, { duration: 380 + (index % 5) * 60, easing: Easing.inOut(Easing.quad) }),
            withTiming(8, { duration: 420 + (index % 3) * 80, easing: Easing.inOut(Easing.quad) })
          ),
          -1,
          true
        )
      );
    } else {
      h.value = withTiming(6, { duration: 240 });
    }
  }, [active, index, h]);

  const style = useAnimatedStyle(() => ({ height: h.value }));
  return <Animated.View style={[styles.bar, { backgroundColor: active ? COLORS[index % COLORS.length] : IDLE }, style]} />;
}

export function Waveform({ active }: { active: boolean }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <Bar key={i} index={i} active={active} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, height: 72 },
  bar: { width: 4, borderRadius: 2, opacity: 0.9 },
});
