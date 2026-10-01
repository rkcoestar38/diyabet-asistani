import { activeBlock } from './schedule';
import type { LogEntry, TimeBlock } from './types';

export type Stats = {
  readings: number;
  avg?: number;
  min?: number;
  max?: number;
  /** Standart sapma ve değişkenlik katsayısı (%) */
  sd?: number;
  cv?: number;
  /** Ortalamadan tahmini HbA1c (GMI, %) */
  gmi?: number;
  /** Hedef aralıkta / altında / üstünde olan ölçüm yüzdeleri */
  inRange?: number;
  below?: number;
  above?: number;
  carbs: number;
  bolus: number;
  basal: number;
  /** Ayrı hipo atakları (60 dk içindeki düşük ölçüm ve tedaviler tek atak sayılır) */
  hypos: number;
  /** En az bir kaydı olan gün sayısı */
  days: number;
};

/** Bir hipo atağı içindeki kayıtları birleştirmek için süre */
const EPISODE_GAP_MIN = 60;

export function computeStats(entries: LogEntry[], blocks: TimeBlock[], hypoThreshold: number): Stats {
  const bgs = entries.filter((e) => e.bg !== undefined);
  let inRange = 0;
  let below = 0;
  let above = 0;
  for (const e of bgs) {
    const b = activeBlock(blocks, new Date(e.bgTime ?? e.time));
    if (!b) continue;
    if (e.bg! < b.low) below++;
    else if (e.bg! > b.high) above++;
    else inRange++;
  }
  const n = bgs.length;
  const pct = (x: number) => (n ? Math.round((x / n) * 100) : undefined);
  const values = bgs.map((e) => e.bg!);
  const mean = n ? values.reduce((s, v) => s + v, 0) / n : 0;
  const sd = n > 1 ? Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) : undefined;
  return {
    readings: n,
    sd: sd !== undefined ? Math.round(sd) : undefined,
    cv: sd !== undefined && mean > 0 ? Math.round((sd / mean) * 100) : undefined,
    gmi: n ? Math.round((3.31 + 0.02392 * mean) * 10) / 10 : undefined,
    avg: n ? Math.round(mean) : undefined,
    min: n ? Math.min(...values) : undefined,
    max: n ? Math.max(...values) : undefined,
    inRange: pct(inRange),
    below: pct(below),
    above: pct(above),
    carbs: Math.round(entries.reduce((s, e) => s + (e.carbs ?? 0) + (e.hypoCarbs ?? 0), 0)),
    bolus: Math.round(entries.reduce((s, e) => s + (e.bolus ?? 0), 0) * 10) / 10,
    basal: Math.round(entries.reduce((s, e) => s + (e.basal ?? 0), 0) * 10) / 10,
    hypos: countEpisodes(entries.filter((e) => e.hypoCarbs || (e.bg !== undefined && e.bg < hypoThreshold)).map((e) => e.time)),
    days: new Set(entries.map((e) => startOfDay(e.time))).size,
  };
}

/** Bir şekerin durumu: palet anahtarı olarak (danger = hipo, ok = hedef aralığında, warn = aralığın dışında). Uygulamanın her yerinde aynı kural. */
export function bgLevel(bg: number, block: TimeBlock | undefined, hypoThreshold: number): 'danger' | 'ok' | 'warn' {
  if (bg < hypoThreshold) return 'danger';
  if (block && (bg > block.high || bg < block.low)) return 'warn';
  return 'ok';
}

/**
 * "Gün" gece yarısında değil, sabah öğününün başladığı saatte (varsayılan 06:00) başlar.
 * Böylece gece 03:00'te girilen ölçüm, o gecenin ait olduğu önceki günde görünür.
 */
let dayOffsetMin = 0;
export const setDayOffset = (min: number) => {
  dayOffsetMin = Number.isFinite(min) ? min : 0;
};
export const getDayOffset = () => dayOffsetMin;

export function startOfDay(t: number): number {
  const d = new Date(t - dayOffsetMin * 60000);
  d.setHours(0, 0, 0, 0);
  return d.getTime() + dayOffsetMin * 60000;
}

/** Saat dakikası aralığını (0–1440, gece yarısından) günün başlangıcına göre kaydırılmış eksene çevirir (en çok iki parça) */
export function toDayAxis(s: number, e: number): [number, number][] {
  const off = dayOffsetMin;
  const out: [number, number][] = [];
  const push = (a: number, b: number) => {
    if (b <= a) return;
    const st = (a - off + 1440) % 1440;
    out.push([st, st + (b - a)]);
  };
  if (s < off && e > off) {
    push(s, off);
    push(off, e);
  } else push(s, e);
  return out;
}

export function entriesBetween(entries: LogEntry[], from: number, to: number) {
  return entries.filter((e) => e.time >= from && e.time < to);
}

function countEpisodes(times: number[]): number {
  const sorted = [...times].sort((a, b) => a - b);
  let count = 0;
  let last = -Infinity;
  for (const t of sorted) {
    if (t - last > EPISODE_GAP_MIN * 60000) count++;
    last = t;
  }
  return count;
}
