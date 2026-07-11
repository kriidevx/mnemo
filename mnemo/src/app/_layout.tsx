import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Tabs } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Pressable, Text, View, type ColorValue } from 'react-native';
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
          backgroundColor: pressed ? '#CC8000' : '#FFA000',
          borderRadius: 24,
          paddingHorizontal: 28,
          paddingVertical: 12,
        })}>
        <Text style={{ color: '#000', fontWeight: '700' }}>Try again</Text>
      </Pressable>
    </View>
  );
}

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
