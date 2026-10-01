import { create } from 'zustand';

import type { MealType } from '@/logic/types';

/**
 * Hesapla/Yemekler/Kayıt ekranlarının paylaştığı geçici taslak (kalıcı değil):
 * elle seçilen öğün, geçmişe dönük zaman ve şeker ölçüm saati.
 */
type State = {
  /** Elle seçilen öğün; yoksa saatten otomatik */
  meal?: MealType;
  /** Yemek/doz zamanı (ms); yoksa şimdi */
  when?: number;
  /** Şeker ölçüm zamanı (ms); yoksa yemek/doz zamanı */
  bgTime?: number;
  set: (p: Partial<Pick<State, 'meal' | 'when' | 'bgTime'>>) => void;
  reset: () => void;
};

export const useDraft = create<State>((set) => ({
  set: (p) => set(p),
  reset: () => set({ meal: undefined, when: undefined, bgTime: undefined }),
}));
