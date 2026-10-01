import type { TimeBlock } from './types';

export function parseHHMM(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return NaN;
  return h * 60 + min;
}

export function formatHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function sortBlocks(blocks: TimeBlock[]): TimeBlock[] {
  return [...blocks].sort((a, b) => parseHHMM(a.start) - parseHHMM(b.start));
}

/**
 * Verilen andaki geçerli bloğu bulur. Bloklar başlangıç saatinden bir sonraki bloğa kadar geçerlidir;
 * son blok gece yarısını aşarak ilk bloğa kadar sürer.
 */
export function activeBlock(blocks: TimeBlock[], date: Date): TimeBlock | undefined {
  const valid = sortBlocks(blocks).filter((b) => !Number.isNaN(parseHHMM(b.start)));
  if (valid.length === 0) return undefined;
  const now = date.getHours() * 60 + date.getMinutes();
  let found = valid[valid.length - 1];
  for (const b of valid) {
    if (parseHHMM(b.start) <= now) found = b;
  }
  return found;
}

/** Bloğun bitiş saati (bir sonraki bloğun başlangıcı) */
export function blockEnd(blocks: TimeBlock[], block: TimeBlock): string {
  const sorted = sortBlocks(blocks);
  const i = sorted.findIndex((b) => b.id === block.id);
  return sorted[(i + 1) % sorted.length].start;
}

/** Ayar alanlarının kabul edilen aralıkları. Yazarken bu aralığın dışındaki ara değerler kaydedilmez. */
export const LIMITS = {
  icr: { min: 2, max: 100, label: 'Karbonhidrat oranı', unit: 'g/Ü' },
  isf: { min: 10, max: 500, label: 'Düzeltme faktörü', unit: 'mg/dL/Ü' },
  target: { min: 80, max: 180, label: 'Hedef şeker', unit: 'mg/dL' },
  low: { min: 60, max: 130, label: 'Aralık alt sınırı', unit: 'mg/dL' },
  high: { min: 120, max: 250, label: 'Aralık üst sınırı', unit: 'mg/dL' },
} as const;

export function inLimit(field: keyof typeof LIMITS, v: number) {
  return v >= LIMITS[field].min && v <= LIMITS[field].max;
}

export function blockProblems(b: TimeBlock): string[] {
  const p: string[] = [];
  if (Number.isNaN(parseHHMM(b.start))) p.push('Başlangıç saati SS:DD biçiminde olmalı');
  for (const f of ['icr', 'isf', 'target', 'low', 'high'] as const) {
    if (!inLimit(f, b[f])) p.push(`${LIMITS[f].label} ${LIMITS[f].min}–${LIMITS[f].max} ${LIMITS[f].unit} arasında olmalı`);
  }
  if (!(b.low < b.high)) p.push('Aralığın alt sınırı üst sınırından küçük olmalı');
  else if (!(b.target >= b.low && b.target <= b.high)) p.push('Hedef şeker, hedef aralığın içinde olmalı');
  return p;
}

/** Tüm saat dilimleri birlikte: tek tek hatalar + aynı başlangıç saatine sahip dilimler */
export function scheduleProblems(blocks: TimeBlock[]): string[] {
  const p = blocks.flatMap((b) => blockProblems(b).map((x) => `${b.name}: ${x}`));
  const seen = new Map<number, string>();
  for (const b of blocks) {
    const m = parseHHMM(b.start);
    if (Number.isNaN(m)) continue;
    const other = seen.get(m);
    if (other) p.push(`"${other}" ve "${b.name}" aynı saatte (${b.start}) başlıyor; birinin saatini değiştir`);
    else seen.set(m, b.name);
  }
  return p;
}
