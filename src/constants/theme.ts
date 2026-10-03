import { useColorScheme } from 'react-native';

import { useThemePref } from '@/store/theme';

/**
 * "Sea Glass Clinical Calm" (Stitch): sisli yeşil-gri zemin, derin deniz mürekkebi, tek eylem rengi turkuaz.
 * Marka (turkuaz) ile klinik durum (yeşil/kehribar/mercan) renkleri kesin ayrıdır; mercan yalnızca hipo/tehlike içindir.
 */
const light = {
  bg: '#EDF3F2',
  card: '#FFFFFF',
  cardAlt: '#F4F8F8',
  text: '#10292D',
  muted: '#52686C',
  border: '#D6E3E2',
  primary: '#0B7A86',
  primaryStrong: '#085E68',
  onPrimary: '#FFFFFF',
  primarySoft: '#E0F2F4',
  water: '#7CCBD2',
  waterDeep: '#0B7A86',
  danger: '#C23A2E',
  dangerBg: '#FDF0EE',
  onDanger: '#FFFFFF',
  warn: '#8A5300',
  warnBg: '#FEF7EA',
  ok: '#1F7A4D',
  okBg: '#EAF5EE',
  info: '#1D5F8F',
  infoBg: '#EAF2F9',
  tabBar: '#FFFFFF',
  shadow: '#0B3A40',
};

export type Palette = typeof light;

const dark: Palette = {
  bg: '#081417',
  card: '#0F2327',
  cardAlt: '#162E33',
  text: '#E8F3F3',
  muted: '#8DA3A7',
  border: 'rgba(76, 195, 207, 0.16)',
  primary: '#4CC3CF',
  primaryStrong: '#7AD6DF',
  onPrimary: '#04191C',
  primarySoft: '#13383E',
  water: '#2A8E99',
  waterDeep: '#4CC3CF',
  danger: '#FF8A7A',
  dangerBg: '#381310',
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

/** Plus Jakarta Sans (tabular rakamlar ui.tsx'te); yüklenene kadar sistem yazı tipi */
export const Font = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

/** Seviye 1 derinlik: dağınık, çok hafif "deniz sisi" gölgesi (koyu temada gölge yok, ince kenarlık kullanılır) */
export function elevation(scheme: 'light' | 'dark') {
  return scheme === 'light'
    ? { shadowColor: '#10292D', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 2 }
    : {};
}
