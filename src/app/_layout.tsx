import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/figtree';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { ToastHost } from '@/components/toast';
import { Font, useScheme, useTheme } from '@/constants/theme';
import { useHydrated } from '@/lib/hooks';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useScheme();
  const c = useTheme();
  const hydrated = useHydrated();
  const [fontsLoaded, fontError] = useFonts({
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
  });
  const ready = hydrated && (fontsLoaded || !!fontError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const header = {
    headerStyle: { backgroundColor: c.bg },
    headerTitleStyle: { fontFamily: Font.bold, color: c.text, fontSize: 18 },
    headerTintColor: c.primary,
    headerShadowVisible: false,
    contentStyle: { backgroundColor: c.bg },
    animation: 'slide_from_right' as const,
  };
  return (
    <ThemeProvider
      value={{ ...base, colors: { ...base.colors, primary: c.primary, background: c.bg, card: c.bg, text: c.text, border: c.border } }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerBackTitle: 'Geri', ...header }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ title: 'Diyabet Asistanı', headerBackVisible: false, gestureEnabled: false }} />
        <Stack.Screen name="hypo" options={{ title: 'Düşük şeker', presentation: 'fullScreenModal', animation: 'slide_from_bottom', headerTintColor: c.danger }} />
        <Stack.Screen name="pick-foods" options={{ title: 'Yemek seç', presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="report" options={{ title: 'Doktor raporu' }} />
        <Stack.Screen name="test" options={{ title: 'Oran testi' }} />
        <Stack.Screen name="entry" options={{ title: 'Kayıt', presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
      <ToastHost />
    </ThemeProvider>
  );
}
