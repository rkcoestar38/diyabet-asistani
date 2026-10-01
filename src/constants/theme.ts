import { useColorScheme } from 'react-native';

import { useThemePref } from '@/store/theme';

/**
 * "Deniz camı": sisli yeşil-gri zemin, derin deniz mürekkebi, tek eylem rengi turkuaz.
 * Mercan yalnızca tehlike/hipo, kehribar yalnızca uyarı için ayrılmıştır.
 */
const light = {
  bg: '#EDF3F2',
  card: '#FFFFFF',
  cardAlt: '#F5F9F8',
  text: '#10292D',
  muted: '#52686C',
  border: '#D6E3E2',
  primary: '#0B7A86',
  primaryStrong: '#085E68',
  onPrimary: '#FFFFFF',
  primarySoft: '#DDF0F1',
  water: '#7CCBD2',
  waterDeep: '#0B7A86',
  danger: '#C23A2E',
  dangerBg: '#FCE9E6',
  onDanger: '#FFFFFF',
  warn: '#8A5300',
  warnBg: '#FFF1D6',
  ok: '#1F7A4D',
  okBg: '#DDF3E6',
  info: '#1D5F8F',
  infoBg: '#E1EEF8',
  tabBar: '#FFFFFF',
  shadow: '#0B3A40',
};

export type Palette = typeof light;

const dark: Palette = {
  bg: '#081417',
  card: '#0F2327',
  cardAlt: '#132B30',
  text: '#E8F3F3',
  muted: '#93AEB1',
  border: '#1E3A3F',
  primary: '#4CC3CF',
  primaryStrong: '#7AD6DF',
  onPrimary: '#04191C',
  primarySoft: '#123A40',
  water: '#2A8E99',
  waterDeep: '#4CC3CF',
  danger: '#FF8A7A',
  dangerBg: '#3A1A17',
  onDanger: '#2A0A06',
  warn: '#FFC266',
  warnBg: '#33260D',
  ok: '#6FD39C',
  okBg: '#10301F',
  info: '#7FBDF0',
  infoBg: '#12283A',
  tabBar: '#0B1C1F',
  shadow: '#000000',
};

export const palettes = { light, dark };

/** Seçili temaya göre (otomatik = telefon ayarı) 'light' | 'dark' */
export function useScheme(): 'light' | 'dark' {
  const pref = useThemePref((s) => s.pref);
  const system = useColorScheme();
  return pref === 'auto' ? (system === 'dark' ? 'dark' : 'light') : pref;
}

export function useTheme(): Palette {
  return palettes[useScheme()];
}

export const Space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const Radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

/** Figtree; yüklenene kadar sistem yazı tipi */
export const Font = {
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  extrabold: 'Figtree_800ExtraBold',
} as const;

/** Tek tip derinlik: ince gölge; kenarlık ayrıca kullanılmaz (koyu temada kenarlık, gölge yok) */
export function elevation(scheme: 'light' | 'dark') {
  return scheme === 'light'
    ? { shadowColor: '#0B3A40', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2 }
    : {};
}
