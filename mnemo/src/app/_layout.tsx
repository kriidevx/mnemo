import { DarkTheme, Tabs, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Text, type ColorValue } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DynamicIsland } from '@/components/dynamic-island';
import { C } from '@/constants/mnemo-theme';

SplashScreen.preventAutoHideAsync();

const OLED = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: C.bg,
    card: '#0A0A0C',
    border: 'rgba(255,255,255,0.06)',
    text: C.text,
    primary: '#FFA000',
  },
};

function TabIcon({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <Text style={{ fontSize: 20, color, lineHeight: 24 }}>{glyph}</Text>;
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.bg }}>
      <ThemeProvider value={OLED}>
        <StatusBar style="light" />
        <Tabs
          screenOptions={{
            headerShown: false,
            sceneStyle: { backgroundColor: C.bg },
            tabBarStyle: {
              backgroundColor: 'rgba(10,10,12,0.94)',
              borderTopColor: 'rgba(255,255,255,0.06)',
              borderTopWidth: 0.5,
            },
            tabBarActiveTintColor: '#FFA000',
            tabBarInactiveTintColor: C.textTertiary,
            tabBarLabelStyle: { fontSize: 10, fontWeight: '600', letterSpacing: 0.3 },
          }}>
          <Tabs.Screen name="index" options={{ title: 'Memory', tabBarIcon: ({ color }) => <TabIcon glyph="◉" color={color} /> }} />
          <Tabs.Screen name="voice" options={{ title: 'Voice', tabBarIcon: ({ color }) => <TabIcon glyph="✱" color={color} /> }} />
          <Tabs.Screen name="scan" options={{ title: 'Capture', tabBarIcon: ({ color }) => <TabIcon glyph="⌘" color={color} /> }} />
          <Tabs.Screen name="studio" options={{ title: 'Studio', tabBarIcon: ({ color }) => <TabIcon glyph="✦" color={color} /> }} />
          <Tabs.Screen name="agents" options={{ title: 'Agents', tabBarIcon: ({ color }) => <TabIcon glyph="⎌" color={color} /> }} />
        </Tabs>
        <DynamicIsland />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
