import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DEFAULT_MEAL_STARTS } from '@/logic/meals';
import type { Settings, TimeBlock } from '@/logic/types';

import { storage, uid } from './storage';

const block = (name: string, start: string, from?: Partial<TimeBlock>): TimeBlock => ({
  icr: 10,
  isf: 50,
  target: 110,
  low: 80,
  high: 140,
  ...from,
  id: uid(),
  name,
  start,
});

/** Tek oran modu: tüm gün için tek dilim */
export const isSingleBlock = (blocks: TimeBlock[]) => blocks.length === 1;

const DAY_PARTS: [string, string][] = [
  ['Sabah', '06:00'],
  ['Öğle', '11:00'],
  ['Akşam', '17:00'],
  ['Gece', '22:00'],
];

export const DEFAULT_SETTINGS: Settings = {
  blocks: [block('Tüm gün', '00:00')],
  rapidName: 'NovoRapid',
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
  addBlock: () => void;
  removeBlock: (id: string) => void;
  /** Saate göre farklı oranları aç (mevcut değerler 4 dilime kopyalanır) veya kapat (şu anki dilim tüm güne uygulanır) */
  setTimeBlocks: (enabled: boolean, keepFrom?: TimeBlock) => void;
  replaceAll: (s: Settings, history?: RatioChange[]) => void;
};

export const useSettings = create<State>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      ratioHistory: [],
      update: (patch) => set((st) => ({ settings: { ...st.settings, ...patch } })),
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
      addBlock: () =>
        set((st) => ({ settings: { ...st.settings, blocks: [...st.settings.blocks, block('Yeni dilim', '12:00')] } })),
      removeBlock: (id) =>
        set((st) =>
          st.settings.blocks.length <= 1
            ? st
            : { settings: { ...st.settings, blocks: st.settings.blocks.filter((b) => b.id !== id) } },
        ),
      setTimeBlocks: (enabled, keepFrom) =>
        set((st) => {
          const base = keepFrom ?? st.settings.blocks[0];
          const blocks = enabled ? DAY_PARTS.map(([n, t]) => block(n, t, base)) : [block('Tüm gün', '00:00', base)];
          return { settings: { ...st.settings, blocks } };
        }),
      replaceAll: (settings, ratioHistory) => set((st) => ({ settings, ratioHistory: ratioHistory ?? st.ratioHistory })),
    }),
    {
      name: 'settings',
      storage,
      version: 1,
      merge: (persisted, current) => {
        const p = persisted as Partial<State> | undefined;
        return { ...current, ...p, settings: { ...DEFAULT_SETTINGS, ...p?.settings, mealStarts: { ...DEFAULT_MEAL_STARTS, ...p?.settings?.mealStarts } } };
      },
    },
  ),
);
