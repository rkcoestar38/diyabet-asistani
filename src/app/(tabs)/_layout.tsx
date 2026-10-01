import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import { useEffect } from 'react';
import type { ColorValue } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import type { IconName } from '@/components/ui';
import { Font, useTheme } from '@/constants/theme';
import { useSettings } from '@/store/settings';

/** Seçilince dolu ikona geçer ve yay gibi zıplar */
function TabIcon({ name, focused, color }: { name: IconName; focused: boolean; color: ColorValue }) {
  const reduce = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (focused && !reduce) s.value = withSequence(withTiming(0.82, { duration: 90 }), withSpring(1, { damping: 8, stiffness: 320 }));
  }, [focused, reduce, s]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const outline = `${name}-outline` as IconName;
  return (
    <Animated.View style={anim}>
      <Ionicons name={focused ? name : outline} size={24} color={color} />
    </Animated.View>
  );
}

const screens: { name: string; title: string; label: string; icon: IconName }[] = [
  { name: 'index', title: 'Diyabet Asistanı', label: 'Ana sayfa', icon: 'home' },
  { name: 'calc', title: 'Doz hesapla', label: 'Doz', icon: 'calculator' },
  { name: 'log', title: 'Günlük', label: 'Günlük', icon: 'journal' },
  { name: 'learn', title: 'Öğren', label: 'Öğren', icon: 'school' },
  { name: 'settings', title: 'Ayarlar', label: 'Ayarlar', icon: 'settings' },
];

export default function TabLayout() {
  const c = useTheme();
  const onboarded = useSettings((s) => s.settings.onboarded);
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.tabBar, borderTopColor: c.border, borderTopWidth: 1, height: 64, paddingTop: 6, paddingBottom: 8 },
        tabBarLabelStyle: { fontFamily: Font.semibold, fontSize: 11 },
        headerStyle: { backgroundColor: c.bg },
        headerShadowVisible: false,
        headerTintColor: c.text,
        headerTitleStyle: { fontFamily: Font.extrabold, fontSize: 22, color: c.text },
        headerTitleAlign: 'left',
        sceneStyle: { backgroundColor: c.bg },
        animation: 'shift',
      }}>
      {screens.map((s) => (
        <Tabs.Screen
          key={s.name}
          name={s.name}
          options={{ title: s.title, tabBarLabel: s.label, tabBarIcon: ({ color, focused }) => <TabIcon name={s.icon} color={color} focused={focused} /> }}
        />
      ))}
      {/* Yemek listesi alt çubukta yer almaz; Ana sayfa ve Doz hesapla ekranlarından açılır */}
      <Tabs.Screen name="foods" options={{ title: 'Yemek listesi', href: null }} />
    </Tabs>
  );
}
