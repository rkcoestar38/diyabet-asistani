import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { LogEntry } from '@/logic/types';

import { storage, uid } from './storage';

type State = {
  entries: LogEntry[];
  /** time verilmezse şimdiki zaman kullanılır */
  add: (e: Omit<LogEntry, 'id' | 'time'> & { time?: number }) => LogEntry;
  update: (id: string, patch: Partial<LogEntry>) => void;
  remove: (id: string) => void;
  replaceAll: (entries: LogEntry[]) => void;
};

export const useLog = create<State>()(
  persist(
    (set) => ({
      entries: [],
      add: (e) => {
        const entry = { ...e, time: e.time ?? Date.now(), id: uid() };
        set((st) => ({ entries: [...st.entries, entry].sort((a, b) => a.time - b.time) }));
        return entry;
      },
      update: (id, patch) =>
        set((st) => ({
          entries: st.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)).sort((a, b) => a.time - b.time),
        })),
      remove: (id) => set((st) => ({ entries: st.entries.filter((e) => e.id !== id) })),
      replaceAll: (entries) => set({ entries: [...entries].sort((a, b) => a.time - b.time) }),
    }),
    { name: 'log', storage, version: 1 },
  ),
);
