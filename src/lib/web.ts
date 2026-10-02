import { Platform } from 'react-native';

export const isWeb = Platform.OS === 'web';

/** iPhone / iPad Safari (iPadOS 13+ kendini Mac olarak tanıtır; dokunmatik ekran bakılır) */
export function isIos(): boolean {
  if (!isWeb || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);
}

/** "Ana Ekrana Ekle" ile açılmış mı (tarayıcı sekmesi değil, uygulama gibi) */
export function isStandalone(): boolean {
  if (!isWeb || typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** Tarayıcıdan verinin otomatik silinmemesini ister (destek yoksa sessizce false) */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!isWeb || typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    return (await navigator.storage.persisted?.()) || (await navigator.storage.persist());
  } catch {
    return false;
  }
}
