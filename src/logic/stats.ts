import { activeBlock } from './schedule';
import type { LogEntry, TimeBlock } from './types';

export type Stats = {
  readings: number;
  avg?: number;
  min?: number;
  max?: number;
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
  return {
    readings: n,
    avg: n ? Math.round(values.reduce((s, v) => s + v, 0) / n) : undefined,
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

export function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
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
