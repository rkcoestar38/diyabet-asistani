import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { storage } from './storage';

export type ThemePref = 'auto' | 'light' | 'dark';

type State = { pref: ThemePref; setPref: (p: ThemePref) => void };

export const useThemePref = create<State>()(
  persist((set) => ({ pref: 'auto', setPref: (pref) => set({ pref }) }), { name: 'theme', storage, version: 1 }),
);
