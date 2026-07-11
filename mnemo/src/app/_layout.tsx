import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Tabs } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';

import { AtomSheet } from '@/components/atom-sheet';
import { DynamicIsland } from '@/components/dynamic-island';
import { C } from '@/constants/mnemo-theme';

SplashScreen.preventAutoHideAsync();

const PAPER = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: C.bg,
    card: C.bg,
    border: C.cardBorder,
    text: C.text,
    primary: C.ink,
  },
};

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
      <Text style={{ fontSize: 40 }}>◉</Text>
      <Text style={{ color: C.text, fontSize: 18, fontWeight: '700' }}>Something went wrong</Text>
      <Text style={{ color: C.textTertiary, fontSize: 12, textAlign: 'center' }} numberOfLines={4}>
        {error.message}
      </Text>
      <Pressable
        onPress={retry}
        style={({ pressed }) => ({
          backgroundColor: pressed ? '#3A3A3C' : C.ink,
          borderRadius: 24,
          paddingHorizontal: 28,
          paddingVertical: 12,
        })}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>Try again</Text>
      </Pressable>
    </View>
  );
}

// Prototype tab-bar glyphs, 1:1 SVG paths.
function HomeIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" fill={color} />
    </Svg>
  );
}
function VoiceIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Rect x={9} y={3} width={6} height={11} rx={3} fill={color} />
      <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function StudioIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" fill={color} />
    </Svg>
  );
}
function LedgerIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={9} fill="none" stroke={color} strokeWidth={1.8} />
      <SvgText x={12} y={16.5} textAnchor="middle" fontSize={11} fontWeight="700" fill={color}>
        ₹
      </SvgText>
    </Svg>
  );
}
function AgentsIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={5} r={2.4} fill={color} />
      <Circle cx={5.5} cy={18} r={2.4} fill={color} />
      <Circle cx={18.5} cy={18} r={2.4} fill={color} />
      <Path d="M12 7.5 6.5 16M12 7.5 17.5 16M8 18h8" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg }}>
      <ThemeProvider value={PAPER}>
        <StatusBar style="dark" />
        <Tabs
          screenOptions={{
            headerShown: false,
            sceneStyle: { backgroundColor: C.bg },
            tabBarStyle: {
              backgroundColor: 'rgba(250,250,248,0.94)',
              borderTopColor: C.cardBorder,
              borderTopWidth: 0.75,
            },
            tabBarActiveTintColor: C.ink,
            tabBarInactiveTintColor: C.tabDim,
            tabBarLabelStyle: { fontSize: 10, fontWeight: '600', letterSpacing: 0.2 },
          }}>
          <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <HomeIcon color={color} /> }} />
          <Tabs.Screen name="voice" options={{ title: 'Voice', tabBarIcon: ({ color }) => <VoiceIcon color={color} /> }} />
          <Tabs.Screen name="studio" options={{ title: 'Studio', tabBarIcon: ({ color }) => <StudioIcon color={color} /> }} />
          <Tabs.Screen name="ledger" options={{ title: 'Ledger', tabBarIcon: ({ color }) => <LedgerIcon color={color} /> }} />
          <Tabs.Screen name="agents" options={{ title: 'Agents', tabBarIcon: ({ color }) => <AgentsIcon color={color} /> }} />
        </Tabs>
        <DynamicIsland />
        <AtomSheet />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
