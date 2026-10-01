import { CARB_ABSORPTION_MIN, FAST_CARB_ABSORPTION_MIN, iobFraction } from './iob';
import type { InsulinProfile, LogEntry, TimeBlock } from './types';

export type BgEstimate = {
  /** Ölçümden bu yana geçen dakika */
  minutes: number;
  /** Aradaki insülin ve karbonhidratın etkisiyle tahmini şimdiki şeker */
  value: number;
  /** value − ölçülen */
  shift: number;
};

const absorbed = (min: number, total: number) => (min <= 0 ? 0 : Math.min(1, min / total));

/**
 * Şeker `bgTime`'da ölçüldü, doz `atTime`'da hesaplanıyor. O arada etki eden insülin şekeri düşürür,
 * emilen karbonhidrat yükseltir. `entries`, hesaplanan kaydı içermemelidir.
 * 5 dakikadan kısa farklarda düzeltme yapılmaz.
 */
export function estimateBgAt(
  bg: number,
  bgTime: number,
  atTime: number,
  entries: LogEntry[],
  block: TimeBlock,
  profile: InsulinProfile,
): BgEstimate {
  const minutes = Math.max(0, (atTime - bgTime) / 60000);
  if (minutes < 5) return { minutes, value: bg, shift: 0 };
  let acted = 0;
  let carbsIn = 0;
  for (const e of entries) {
    if (e.time > atTime) continue;
    if (e.bolus) {
      const before = iobFraction((bgTime - e.time) / 60000, profile);
      const after = iobFraction((atTime - e.time) / 60000, profile);
      acted += e.bolus * (before - after);
    }
    if (e.carbs) carbsIn += e.carbs * (absorbed((atTime - e.time) / 60000, CARB_ABSORPTION_MIN) - absorbed((bgTime - e.time) / 60000, CARB_ABSORPTION_MIN));
    if (e.hypoCarbs) carbsIn += e.hypoCarbs * (absorbed((atTime - e.time) / 60000, FAST_CARB_ABSORPTION_MIN) - absorbed((bgTime - e.time) / 60000, FAST_CARB_ABSORPTION_MIN));
  }
  const shift = -acted * block.isf + carbsIn * (block.isf / block.icr);
  return { minutes, value: Math.round(bg + shift), shift: Math.round(shift) };
}

/** Bir kaydın şeker ölçüm zamanı */
export const bgTimeOf = (e: LogEntry) => e.bgTime ?? e.time;
