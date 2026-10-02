import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { storage } from './storage';

type State = {
  /** Son başarılı yedek zamanı */
  lastAt?: number;
  /** "Sonra" denince bu zamana kadar hatırlatma yok */
  snoozedUntil?: number;
  /** "Ana ekrana ekle" ipucunu kapattı */
  installHidden: boolean;
  markDone: () => void;
  snooze: (days: number) => void;
  hideInstall: () => void;
};

export const useBackup = create<State>()(
  persist(
    (set) => ({
      installHidden: false,
      markDone: () => set({ lastAt: Date.now(), snoozedUntil: undefined }),
      snooze: (days) => set({ snoozedUntil: Date.now() + days * 86400000 }),
      hideInstall: () => set({ installHidden: true }),
    }),
    { name: 'backup', storage, version: 1 },
  ),
);

/** Yedek hatırlatması: yeterince kayıt var ve son yedek yok / eski */
export function backupDue(entryCount: number, lastAt: number | undefined, snoozedUntil: number | undefined, now: number, everyDays = 14): boolean {
  if (entryCount < 10) return false;
  if (snoozedUntil !== undefined && now < snoozedUntil) return false;
  return lastAt === undefined || now - lastAt > everyDays * 86400000;
}
