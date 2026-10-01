import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { storage } from './storage';

export type TestKind = 'icr' | 'isf' | 'basal';

export type ActiveTest = {
  kind: TestKind;
  /** Başlangıç kaydı (KH ve düzeltme testlerinde) */
  entryId?: string;
  startTime: number;
};

export type FinishedTest = { kind: TestKind; entryId?: string; startTime: number; endTime: number };

type State = {
  active: ActiveTest | null;
  finished: FinishedTest[];
  start: (t: ActiveTest) => void;
  finish: () => void;
  cancel: () => void;
};

/** Rehberli oran testleri: aynı anda tek test yürür; bitenler sonuç listesinde gösterilir. */
export const useTests = create<State>()(
  persist(
    (set, get) => ({
      active: null,
      finished: [],
      start: (t) => set({ active: t }),
      finish: () => {
        const a = get().active;
        if (!a) return;
        set((st) => ({ active: null, finished: [{ ...a, endTime: Date.now() }, ...st.finished].slice(0, 100) }));
      },
      cancel: () => set({ active: null }),
    }),
    { name: 'tests', storage, version: 1 },
  ),
);
