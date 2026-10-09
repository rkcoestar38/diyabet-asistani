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

/** `ranges` verilirse ölçümler aç/tok aralığına göre sınıflanır (`all`: bağlam için tüm kayıtlar), verilmezse oran dilimlerinin aralığına göre */
export function computeStats(entries: LogEntry[], blocks: TimeBlock[], hypoThreshold: number, ranges?: BgRanges & { all?: LogEntry[] }): Stats {
  const bgs = entries.filter((e) => e.bg !== undefined);
  let inRange = 0;
  let below = 0;
  let above = 0;
  for (const e of bgs) {
    const b = ranges ? rangeFor(e, ranges.all ?? entries, ranges) : activeBlock(blocks, new Date(e.bgTime ?? e.time));
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

/** Bir şekerin durumu: palet anahtarı olarak (danger = hipo veya hedef aralık dışı kırmızı, ok = hedef aralığında yeşil). */
export function bgLevel(bg: number, block: TimeBlock | undefined, hypoThreshold: number): 'danger' | 'ok' | 'warn' {
  if (bg < hypoThreshold) return 'danger';
  if (block && (bg > block.high || bg < block.low)) return 'danger';
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

/** Yemekten sonra bu kadar dakika içindeki ölçümler tokluk şekeri sayılır */
export const POST_WINDOW_MIN = 180;

export type BgRanges = { fastingRange: { low: number; high: number }; postRange: { low: number; high: number } };

/** Tokluk şekeri mi: "tokluk" olarak işaretlenmiş ya da son 3 saatte karbonhidratlı yemek yenmiş. Yemeğin kendi öncesi ölçümü açlık sayılır. */
export function isPostReading(e: LogEntry, all: LogEntry[]): boolean {
  if (e.post) return true;
  const t = e.bgTime ?? e.time;
  return all.some((m) => (m.carbs ?? 0) > 0 && m.time < t && t - m.time <= POST_WINDOW_MIN * 60000);
}

/** Ölçümün bağlamına göre (aç/tok) hedef aralığı */
export function rangeFor(e: LogEntry, all: LogEntry[], r: BgRanges): { low: number; high: number } {
  return isPostReading(e, all) ? r.postRange : r.fastingRange;
}

/** Aç/tok aralığına göre şekerin durumu (palet anahtarı): açlık 80-120 ok, tokluk 80-180 ok; dışındakiler kırmızı (danger) */
export function bgLevelIn(bg: number, range: { low: number; high: number }, hypoThreshold: number): 'danger' | 'ok' | 'warn' {
  if (bg < hypoThreshold) return 'danger';
  return bg < range.low || bg > range.high ? 'danger' : 'ok';
}

/** Yemeklerden sonraki tokluk pencereleri (birleşik, sıralı) */
export function postWindows(all: LogEntry[], from: number, to: number): [number, number][] {
  const span = POST_WINDOW_MIN * 60000;
  const starts = all.filter((m) => (m.carbs ?? 0) > 0 && m.time + span > from && m.time < to).map((m) => m.time).sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (const s of starts) {
    const last = out[out.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], s + span);
    else out.push([s, s + span]);
  }
  return out.map(([a, b]) => [Math.max(a, from), Math.min(b, to)]);
}
