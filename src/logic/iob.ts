import type { InsulinProfile, LogEntry } from './types';

/**
 * Bir dozdan geriye kalan aktif insülin oranı (0–1).
 * Üstel insülin etki eğrisi (OpenAPS/Loop'ta kullanılan model).
 */
export function iobFraction(minutesSince: number, { dia, peak }: InsulinProfile): number {
  const td = Math.max(dia, 3) * 60;
  const tp = Math.min(Math.max(peak, 30), td / 2 - 1);
  if (minutesSince <= 0) return 1;
  if (minutesSince >= td) return 0;
  const t = minutesSince;
  const tau = (tp * (1 - tp / td)) / (1 - (2 * tp) / td);
  const a = (2 * tau) / td;
  const S = 1 / (1 - a + (1 + a) * Math.exp(-td / tau));
  const f =
    1 - S * (1 - a) * ((t ** 2 / (tau * td * (1 - a)) - t / tau - 1) * Math.exp(-t / tau) + 1);
  return Math.min(1, Math.max(0, f));
}

/** Kayıtlı hızlı insülin dozlarından şu anki aktif insülin (ünite). */
export function insulinOnBoard(log: LogEntry[], now: number, profile: InsulinProfile): number {
  let total = 0;
  for (const e of log) {
    if (!e.bolus || e.time > now) continue;
    total += e.bolus * iobFraction((now - e.time) / 60000, profile);
  }
  return total;
}

/** Son `minutes` dakika içindeki en son hızlı insülin kaydı */
export function recentBolus(log: LogEntry[], now: number, minutes: number): LogEntry | undefined {
  return log
    .filter((e) => e.bolus && e.time <= now && now - e.time < minutes * 60000)
    .sort((a, b) => b.time - a.time)[0];
}

/** Karbonhidratların emilim süresi (dk). Hipo için alınan hızlı karbonhidrat daha çabuk emilir. */
export const CARB_ABSORPTION_MIN = 180;
export const FAST_CARB_ABSORPTION_MIN = 45;

/** Henüz emilmemiş karbonhidrat (g); doğrusal emilim varsayımıyla. */
export function carbsOnBoard(log: LogEntry[], now: number): number {
  let total = 0;
  for (const e of log) {
    if (e.time > now) continue;
    const min = (now - e.time) / 60000;
    if (e.carbs) total += e.carbs * Math.max(0, 1 - min / CARB_ABSORPTION_MIN);
    if (e.hypoCarbs) total += e.hypoCarbs * Math.max(0, 1 - min / FAST_CARB_ABSORPTION_MIN);
  }
  return total;
}
