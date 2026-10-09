import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistStorage } from 'zustand/middleware';

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * AsyncStorage üzerinde güvenli zustand deposu.
 * Bozuk JSON (ör. yarıda kalan yazma) uygulamanın splash ekranında kilitlenmesine yol açmasın:
 * o anahtar yok sayılır, store varsayılanlarıyla açılır.
 */
export const storage: PersistStorage<unknown> = {
  getItem: async (name) => {
    const str = await AsyncStorage.getItem(name);
    if (str == null) return null;
    try {
      const parsed = JSON.parse(str) as { version?: number; state?: unknown };
      return { state: parsed.state, version: parsed.version };
    } catch {
      console.warn(`[storage] "${name}" anahtarı bozuk; varsayılanlarla devam ediliyor`);
      return null;
    }
  },
  setItem: (name, newValue) => AsyncStorage.setItem(name, JSON.stringify(newValue)),
  removeItem: (name) => AsyncStorage.removeItem(name),
};
