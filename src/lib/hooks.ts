import { useEffect, useState, useSyncExternalStore } from 'react';

import { carbsOnBoard, insulinOnBoard } from '@/logic/iob';
import { useFoods } from '@/store/foods';
import { useLog } from '@/store/log';
import { useSettings } from '@/store/settings';
import { useTests } from '@/store/tests';
import { useUpdateStore } from '@/lib/update';

const stores = [useSettings, useLog, useFoods, useTests, useUpdateStore];

function subscribe(cb: () => void) {
  const unsubs = stores.map((s) => s.persist.onFinishHydration(cb));
  return () => unsubs.forEach((u) => u());
}
const allHydrated = () => stores.every((s) => s.persist.hasHydrated());

export function useHydrated() {
  return useSyncExternalStore(subscribe, allHydrated, allHydrated);
}

/** Her `ms` milisaniyede bir güncellenen zaman */
export function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function useCob(now: number) {
  const entries = useLog((s) => s.entries);
  return carbsOnBoard(entries, now);
}

export function useIob(now: number) {
  const entries = useLog((s) => s.entries);
  const { dia, peak } = useSettings((s) => s.settings);
  return insulinOnBoard(entries, now, { dia, peak });
}
