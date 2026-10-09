import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, Pressable } from 'react-native';

import { ToastHost } from '@/components/toast';
import { Font, useScheme, useTheme } from '@/constants/theme';
import { useHydrated } from '@/lib/hooks';
import { syncBasalReminder } from '@/lib/notifications';
import { syncToklukWidget } from '@/lib/widget-sync';
import { requestPersistentStorage } from '@/lib/web';
import { useSettings } from '@/store/settings';

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Tam ekran pencerelerde geri hareketi olmayabilir: her zaman görünen kapat düğmesi */
function HeaderClose({ color }: { color: string }) {
  return (
    <Pressable
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Kapat"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/' as Href))}>
      <Ionicons name="close" size={26} color={color} />
    </Pressable>
  );
}

export default function RootLayout() {
  const scheme = useScheme();
  const c = useTheme();
  const hydrated = useHydrated();
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const ready = hydrated && (fontsLoaded || !!fontError);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [ready]);

  // Her açılışta bazal hatırlatıcısını ayarlarla eşitle: telefondaki kayıtlı saat ayarlardan farklıysa (ör. eski bir deneme) düzelir
  useEffect(() => {
    if (!ready) return;
    const { basalReminder, basalTime, basalName } = useSettings.getState().settings;
    if (basalReminder) syncBasalReminder(true, basalTime, basalName).catch(() => undefined);
  }, [ready]);

  // Android ana ekran widget'ını (Tokluk) ön plana her dönüşte güncelle
  useEffect(() => {
    if (!ready) return;
    syncToklukWidget();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') syncToklukWidget();
    });
    return () => sub.remove();
  }, [ready]);

  // Web: tarayıcıdan verinin otomatik silinmemesini iste
  useEffect(() => {
    requestPersistentStorage();
  }, []);

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
        <Stack.Screen name="hypo" options={{ title: 'Düşük şeker', presentation: 'fullScreenModal', animation: 'slide_from_bottom', headerTintColor: c.danger, headerRight: () => <HeaderClose color={c.danger} /> }} />
        <Stack.Screen name="pick-foods" options={{ title: 'Yemek seç', presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="report" options={{ title: 'Doktor raporu' }} />
        <Stack.Screen name="test" options={{ title: 'Oran testi' }} />
        <Stack.Screen name="entry" options={{ title: 'Kayıt', presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
      <ToastHost />
    </ThemeProvider>
  );
}
