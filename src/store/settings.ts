import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DEFAULT_MEAL_STARTS, mealBlocks } from '@/logic/meals';
import { parseHHMM } from '@/logic/schedule';
import { setDayOffset } from '@/logic/stats';
import type { Settings, TimeBlock } from '@/logic/types';

import { storage, uid } from './storage';

export const DEFAULT_SETTINGS: Settings = {
  blocks: mealBlocks([], DEFAULT_MEAL_STARTS, uid),
  rapidName: '',
  dia: 4,
  peak: 75,
  penStep: 1,
  maxBolus: 15,
  reverseCorrection: true,
  basalName: '',
  basalDose: 0,
  basalTime: '22:00',
  basalReminder: false,
  exercise: { light: 25, moderate: 50, intense: 75 },
  hypoThreshold: 70,
  severeHypoThreshold: 54,
  hyperThreshold: 250,
  onboarded: false,
  ratioSource: 'doctor',
  mealStarts: DEFAULT_MEAL_STARTS,
  tabletG: 4,
  countMethod: 'exchange',
  fastingRange: { low: 80, high: 130 },
  postRange: { low: 80, high: 180 },
};

export type RatioChange = {
  time: number;
  blockName: string;
  field: 'icr' | 'isf';
  from: number;
  to: number;
  source: string;
};

type State = {
  settings: Settings;
  ratioHistory: RatioChange[];
  update: (patch: Partial<Settings>) => void;
  updateBlock: (id: string, patch: Partial<TimeBlock>, source?: string) => void;
  replaceAll: (s: Settings, history?: RatioChange[]) => void;
};

export const useSettings = create<State>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      ratioHistory: [],
      // Öğün saatleri değişince oran dilimlerinin başlangıçları da değişir
      update: (patch) =>
        set((st) => {
          const next = { ...st.settings, ...patch };
          if (patch.mealStarts) next.blocks = mealBlocks(next.blocks, next.mealStarts, uid);
          return { settings: next };
        }),
      updateBlock: (id, patch, source) =>
        set((st) => {
          const old = st.settings.blocks.find((b) => b.id === id);
          const history = [...st.ratioHistory];
          if (old && source) {
            for (const field of ['icr', 'isf'] as const) {
              const to = patch[field];
              if (to !== undefined && to !== old[field]) {
                history.unshift({ time: Date.now(), blockName: old.name, field, from: old[field], to, source });
              }
            }
          }
          return {
            ratioHistory: history.slice(0, 200),
            settings: {
              ...st.settings,
              blocks: st.settings.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
            },
          };
        }),
      replaceAll: (settings, ratioHistory) =>
        set((st) => ({ settings: { ...settings, blocks: mealBlocks(settings.blocks, settings.mealStarts ?? DEFAULT_MEAL_STARTS, uid) }, ratioHistory: ratioHistory ?? st.ratioHistory })),
    }),
    {
      name: 'settings',
      storage,
      version: 3,
      // v2: "NovoRapid" yalnızca eski bir varsayılandı; kullanıcı seçmediyse yanlış insülin adı raporlanmasın
      // v3: açlık üst varsayılanı 120→130; yalnızca eski varsayılanı taşı, kullanıcının kendi değerine dokunma
      migrate: (persisted, version) => {
        const p = persisted as { settings?: { rapidName?: string; fastingRange?: { low?: number; high?: number } } } | undefined;
        if (version < 2 && p?.settings?.rapidName === 'NovoRapid') p.settings.rapidName = '';
        if (version < 3 && p?.settings?.fastingRange?.low === 80 && p?.settings?.fastingRange.high === 120) {
          p.settings.fastingRange = { low: 80, high: 130 };
        }
        return persisted as never;
      },
      merge: (persisted, current) => {
        const p = persisted as Partial<State> | undefined;
        const mealStarts = { ...DEFAULT_MEAL_STARTS, ...p?.settings?.mealStarts };
        // v1.0.8: tek oran / saat dilimleri yerine her zaman sabah, öğle, akşam oranları
        const blocks = mealBlocks(Array.isArray(p?.settings?.blocks) ? p.settings.blocks : DEFAULT_SETTINGS.blocks, mealStarts, uid);
        // Aralıklar yalnızca şekil bakımından doğrulanır; kullanıcı değeri asla varsayılanla ezilmez
        const numOr = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
        const rangeOr = (r: unknown, def: { low: number; high: number }) => {
          const o = r as { low?: unknown; high?: unknown } | undefined;
          return o ? { low: numOr(o.low, def.low), high: numOr(o.high, def.high) } : { ...def };
        };
        return {
          ...current,
          ...p,
          settings: {
            ...DEFAULT_SETTINGS,
            ...p?.settings,
            mealStarts,
            blocks,
            fastingRange: rangeOr(p?.settings?.fastingRange, DEFAULT_SETTINGS.fastingRange),
            postRange: rangeOr(p?.settings?.postRange, DEFAULT_SETTINGS.postRange),
          },
        };
      },
    },
  ),
);

// Günün başlangıcı = sabah öğününün başlangıç saati (gece kayıtları önceki güne yazılır). Ayar değişince veya yüklenince güncellenir.
const syncDayStart = (st: State) => setDayOffset(parseHHMM(st.settings.mealStarts?.sabah ?? DEFAULT_MEAL_STARTS.sabah));
syncDayStart(useSettings.getState());
useSettings.subscribe(syncDayStart);
