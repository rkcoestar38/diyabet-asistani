import { mealAt, mealLabel } from '@/logic/meals';
import { activeCountdownMeal } from '@/logic/postmeal';
import { useLog } from '@/store/log';
import { useSettings } from '@/store/settings';

import type { ToklukWidgetProps } from './ToklukWidget';

/** Tokluk hedefi: öğünden kaç dakika sonra */
export const TOKLUK_TARGET_MIN = 120;

const hhmm = (t: number) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * Ana ekran widget'ının verisini üretir. Görev işleyicisi (headless bile olsa) uygulama
 * JS bağlamında çalıştığından store'lara erişir; hazır olmayan durumda AsyncStorage'dan
 * yeniden doldurur.
 */
export async function getToklukWidgetProps(): Promise<ToklukWidgetProps> {
  await Promise.all([useSettings.persist.rehydrate(), useLog.persist.rehydrate()]);
  const now = Date.now();
  const { settings } = useSettings.getState();
  const { entries } = useLog.getState();
  const meal = activeCountdownMeal(entries, now);

  if (!meal) {
    return {
      state: 'idle',
      title: 'Diyabet Asistanı',
      big: '2. saat',
      sub: 'Yemek kaydedince tokluk geri sayımı burada başlar. Dokun, uygulamayı aç.',
      progress: 0,
      uri: 'diyabetasistani://calc',
    };
  }

  const label = mealLabel(meal.meal ?? mealAt(meal.time, settings.mealStarts));
  const elapsedMin = (now - meal.time) / 60000;
  const remainingMin = TOKLUK_TARGET_MIN - elapsedMin;
  const due = remainingMin <= 0;

  return {
    state: due ? 'due' : 'counting',
    title: `${label} · ${hhmm(meal.time)}`,
    big: due ? `+${Math.round(-remainingMin)} dk` : `${Math.round(remainingMin)} dk`,
    sub: due
      ? `Süre doldu. Dokun ve tokluk şekerini gir. Hedef < ${settings.postRange.high} mg/dL`
      : `Hedef saat ${hhmm(meal.time + TOKLUK_TARGET_MIN * 60000)} · hedef < ${settings.postRange.high} mg/dL`,
    progress: Math.min(1, Math.max(0, elapsedMin / TOKLUK_TARGET_MIN)),
    uri: `diyabetasistani://entry?after=${meal.id}`,
  };
}
