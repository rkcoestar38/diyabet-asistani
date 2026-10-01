import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

export const storage = createJSONStorage(() => AsyncStorage);

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
