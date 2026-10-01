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
  /** Son değişiklik zamanı */
  touchedAt?: number;
  set: (p: Partial<Pick<State, 'meal' | 'when' | 'bgTime'>>) => void;
  reset: () => void;
  /** Taslak `maxAgeMs`'den eskiyse sıfırlar: terk edilmiş bir seçim (örn. "1 saat önce") sonraki kayda taşınmaz */
  expire: (maxAgeMs: number) => void;
};

export const useDraft = create<State>((set, get) => ({
  set: (p) => set({ ...p, touchedAt: Date.now() }),
  reset: () => set({ meal: undefined, when: undefined, bgTime: undefined, touchedAt: undefined }),
  expire: (maxAgeMs) => {
    const { touchedAt, meal, when, bgTime } = get();
    if ((meal !== undefined || when !== undefined || bgTime !== undefined) && (touchedAt === undefined || Date.now() - touchedAt > maxAgeMs)) {
      set({ meal: undefined, when: undefined, bgTime: undefined, touchedAt: undefined });
    }
  },
}));
