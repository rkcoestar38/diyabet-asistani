import type { LogEntry } from './types';

const MIN = 60000;
/** Tokluk şekeri için yemekten sonra beklenen aralık (dakika) */
export const POST_FROM = 60;
export const POST_UNTIL = 240;

/** Bir yemek kaydına bağlı tokluk ölçümü */
export const postOf = (entries: LogEntry[], meal: LogEntry) => entries.find((x) => x.post && x.afterId === meal.id);

/** Tokluk ölçümü yapılabilecek, henüz yapılmamış en son yemek (60–240 dk önce) */
export function awaitingPost(entries: LogEntry[], now: number): LogEntry | undefined {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    const age = (now - e.time) / MIN;
    if (age > POST_UNTIL) return undefined;
    if (e.post || !e.carbs || e.carbs < 1 || age < POST_FROM) continue;
    return postOf(entries, e) ? undefined : e;
  }
  return undefined;
}

/** Yeni bir tokluk ölçümünün hangi yemeğe ait olduğu: `at` zamanından önceki en yakın yemek (6 saate kadar) */
export function mealBefore(entries: LogEntry[], at: number, excludeId?: string): LogEntry | undefined {
  let best: LogEntry | undefined;
  for (const e of entries) {
    if (e.id === excludeId || e.post || !e.carbs || e.time > at) continue;
    if (at - e.time > 6 * 60 * MIN) continue;
    if (!best || e.time > best.time) best = e;
  }
  return best;
}
