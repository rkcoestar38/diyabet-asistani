import { CARB_ABSORPTION_MIN, carbsOnBoard, insulinOnBoard, iobFraction } from './iob';
import { blockFor } from './meals';
import { startOfDay } from './stats';
import type { InsulinProfile, LogEntry, TimeBlock } from './types';

export type TddEstimate = {
  /** 500 kuralı: g/Ü */
  icr: number;
  /** 1800 kuralı: mg/dL/Ü */
  isf: number;
  basalLow: number;
  basalHigh: number;
};

/**
 * Günlük toplam insülinden (bazal + hızlı) başlangıç oranı tahmini.
 * Güvenli tarafta kalmak için KH oranı yukarı (1 g'a), düzeltme faktörü yukarı (5 mg/dL'ye) yuvarlanır:
 * ikisi de biraz daha az insülin demektir.
 */
export function estimateFromTdd(tdd: number): TddEstimate | undefined {
  if (!(tdd >= 5 && tdd <= 300)) return undefined;
  return {
    icr: Math.ceil(500 / tdd),
    isf: Math.ceil(1800 / tdd / 5) * 5,
    basalLow: Math.round(tdd * 0.4 * 2) / 2,
    basalHigh: Math.round(tdd * 0.5 * 2) / 2,
  };
}

/** Kayıtlardaki ortalama günlük toplam insülin: son `days` günün tamamlanmış günleri (bugün hariç). */
export function averageTdd(log: LogEntry[], now: number, days: number): { tdd: number; days: number } | undefined {
  const today = startOfDay(now);
  const from = today - days * 86400000;
  const perDay = new Map<number, { bolus: number; basal: number }>();
  for (const e of log) {
    if (e.time < from || e.time >= today) continue;
    const key = startOfDay(e.time);
    const d = perDay.get(key) ?? { bolus: 0, basal: 0 };
    d.bolus += e.bolus ?? 0;
    d.basal += e.basal ?? 0;
    perDay.set(key, d);
  }
  // Yalnızca hem bazal hem hızlı kaydı olan günler anlamlıdır
  const full = [...perDay.values()].filter((d) => d.basal > 0 && d.bolus > 0);
  if (full.length === 0) return undefined;
  const tdd = full.reduce((s, d) => s + d.bolus + d.basal, 0) / full.length;
  return { tdd: Math.round(tdd * 10) / 10, days: full.length };
}

export const MIN_SAMPLES = 3;
/** Tek seferde önerilen en fazla değişiklik (%) */
export const MAX_CHANGE = 0.2;

/** Oran testi pencereleri (dakika): ilk kabul edilen, en geç, ideal ölçüm zamanı */
export const ICR_WINDOW = { min: 150, max: 300, ideal: 180 };
export const ISF_WINDOW = { min: 150, max: 300, ideal: 180 };

export type Sample = { time: number; pre: number; post: number; value: number };

export type SampleResult =
  | { ok: true; blockId: string; sample: Sample }
  | { ok: false; reason: string; /** Henüz ölçüm zamanı gelmedi (test sürüyor) */ pending?: boolean };

export type Suggestion = {
  blockId: string;
  current: number;
  /** Örneklerin ortancası (sınırlandırılmamış) */
  observed?: number;
  /** ±%20 ile sınırlanmış öneri */
  suggested?: number;
  samples: Sample[];
};

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Yeni kayıtların ağırlığı: bu kadar gün eski bir öğün, en yenisinin yarısı kadar sayılır */
export const HALF_LIFE_DAYS = 14;

/**
 * Ağırlıklı ortanca: en yeni öğüne göre yaşı arttıkça ağırlığı yarılanır. Vücut değiştikçe öneri yeni kayıtlara
 * daha çok yaslanır; ortanca olduğu için tek bir hatalı kayıt sonucu bozmaz.
 */
export function recentMedian(samples: { time: number; value: number }[]): number {
  if (samples.length === 0) return NaN;
  const latest = Math.max(...samples.map((x) => x.time));
  const w = samples.map((x) => ({ v: x.value, w: 0.5 ** ((latest - x.time) / (HALF_LIFE_DAYS * 86400000)) })).sort((a, b) => a.v - b.v);
  const total = w.reduce((t, x) => t + x.w, 0);
  let acc = 0;
  for (let i = 0; i < w.length; i++) {
    acc += w[i].w;
    if (acc > total / 2 + 1e-9) return w[i].v;
    if (Math.abs(acc - total / 2) <= 1e-9) return (w[i].v + w[i + 1].v) / 2;
  }
  return w[w.length - 1].v;
}

export function clampChange(current: number, observed: number): number {
  return Math.min(current * (1 + MAX_CHANGE), Math.max(current * (1 - MAX_CHANGE), observed));
}

const isIntervention = (e: LogEntry) => !!(e.bolus || e.carbs || e.hypoCarbs || (e.exercise && e.exercise !== 'none'));

/** Kayıttan önce hâlâ etki eden insülin veya sindirilmekte olan karbonhidrat varsa sonucu bozar. */
function priorActivity(sorted: LogEntry[], i: number, profile: InsulinProfile): string | undefined {
  const e = sorted[i];
  const before = sorted.slice(0, i).filter((x) => x.time <= e.time && x.id !== e.id);
  if (insulinOnBoard(before, e.time, profile) > 0.3) return 'Öncesinde hâlâ etki eden insülin vardı (son dozdan bu yana yeterince süre geçmemiş).';
  if (carbsOnBoard(before, e.time) > 5) return 'Öncesinde sindirilmekte olan karbonhidrat vardı (son yemekten bu yana yeterince süre geçmemiş).';
  return undefined;
}

type FollowUp = { entry?: LogEntry; reason?: string; pending?: boolean };

/**
 * Başlangıçtan `min`–`max` dakika sonraki, idealine en yakın ölçüm.
 * Bir sonraki öğün/doz kaydı aynı zamanda bir ölçüm içeriyorsa o ölçüm (müdahaleden önce yapıldığı için) kullanılır.
 */
function followUp(sorted: LogEntry[], idx: number, win: { min: number; max: number; ideal: number }, now: number): FollowUp {
  const start = sorted[idx];
  let best: LogEntry | undefined;
  const better = (e: LogEntry) =>
    !best || Math.abs((e.time - start.time) / 60000 - win.ideal) < Math.abs((best.time - start.time) / 60000 - win.ideal);
  for (let j = idx + 1; j < sorted.length; j++) {
    const e = sorted[j];
    const dt = (e.time - start.time) / 60000;
    if (dt > win.max) break;
    const inWindow = dt >= win.min;
    if (e.bg !== undefined && inWindow && better(e)) best = e;
    if (isIntervention(e)) {
      if (!inWindow) return { reason: `${Math.round(dt)}. dakikada başka bir yemek, doz, hipo tedavisi veya egzersiz kaydı var; sonuç ölçülemedi.` };
      break;
    }
  }
  if (best) return { entry: best };
  const elapsed = (now - start.time) / 60000;
  if (elapsed < win.max) return { pending: true, reason: elapsed < win.min ? `Ölçüm için ${Math.ceil(win.min - elapsed)} dk daha bekle.` : 'Şimdi şekerini ölç ve kaydet.' };
  return { reason: `${Math.round(win.min / 60)}–${Math.round(win.max / 60)} saat sonra ölçüm kaydedilmemiş.` };
}

function locate(sorted: LogEntry[], entryId: string) {
  return sorted.findIndex((e) => e.id === entryId);
}

/**
 * Tek bir öğünden gerçekleşen KH oranı.
 * Ölçüm anında hâlâ etki eden insülin düşülür, henüz emilmemiş karbonhidratın etkisi eklenir
 * ("her şey bittiğinde şeker nerede olacak").
 */
export function icrSample(log: LogEntry[], entryId: string, blocks: TimeBlock[], profile: InsulinProfile, now = Date.now()): SampleResult {
  const sorted = [...log].sort((a, b) => a.time - b.time);
  const i = locate(sorted, entryId);
  const e = sorted[i];
  if (!e) return { ok: false, reason: 'Kayıt bulunamadı.' };
  if (!e.carbs || e.carbs < 10) return { ok: false, reason: 'En az 10 g karbonhidratlı bir öğün gerekli.' };
  if (!e.bolus) return { ok: false, reason: 'Öğün için vurulan doz kaydedilmemiş.' };
  if (e.bg === undefined) return { ok: false, reason: 'Yemek öncesi şeker kaydedilmemiş.' };
  if (e.hypoCarbs) return { ok: false, reason: 'Hipo tedavisi içeren öğünler kullanılamaz.' };
  if (e.bgTime !== undefined && e.time - e.bgTime > 30 * 60000) return { ok: false, reason: 'Şeker, yemekten 30 dakikadan uzun süre önce ölçülmüş.' };
  if (e.exercise && e.exercise !== 'none') return { ok: false, reason: 'Egzersizli öğünler kullanılamaz.' };
  const block = blockFor(blocks, e.time, e.meal);
  if (!block) return { ok: false, reason: 'Öğün oranı bulunamadı.' };
  if (e.bg < block.low || e.bg > block.high) return { ok: false, reason: `Yemek öncesi şeker hedef aralıkta (${block.low}–${block.high}) değildi.` };
  const prior = priorActivity(sorted, i, profile);
  if (prior) return { ok: false, reason: prior };
  const fu = followUp(sorted, i, ICR_WINDOW, now);
  if (!fu.entry) return { ok: false, reason: fu.reason!, pending: fu.pending };
  const post = fu.entry.bg!;
  const minutes = (fu.entry.time - e.time) / 60000;
  const remainingInsulin = e.bolus * iobFraction(minutes, profile);
  const remainingCarbs = e.carbs * Math.max(0, 1 - minutes / CARB_ABSORPTION_MIN);
  const eventual = post - remainingInsulin * block.isf + remainingCarbs * (block.isf / block.icr);
  const needed = e.bolus + (eventual - block.target) / block.isf;
  const mealPart = needed - (e.bg - block.target) / block.isf;
  if (mealPart <= 0.1) return { ok: false, reason: 'Şeker çok düştü; sonuç güvenilir değil.' };
  const value = e.carbs / mealPart;
  if (!(value > 1 && value < 100)) return { ok: false, reason: 'Sonuç olağan dışı; kayıtları kontrol et.' };
  return { ok: true, blockId: block.id, sample: { time: e.time, pre: e.bg, post, value } };
}

/** Tek bir düzeltme dozundan gerçekleşen düzeltme faktörü. */
export function isfSample(log: LogEntry[], entryId: string, blocks: TimeBlock[], profile: InsulinProfile, now = Date.now()): SampleResult {
  const sorted = [...log].sort((a, b) => a.time - b.time);
  const i = locate(sorted, entryId);
  const e = sorted[i];
  if (!e) return { ok: false, reason: 'Kayıt bulunamadı.' };
  if (e.carbs) return { ok: false, reason: 'Düzeltme testi karbonhidratsız olmalı.' };
  if (!e.bolus) return { ok: false, reason: 'Düzeltme dozu kaydedilmemiş.' };
  if (e.bg === undefined) return { ok: false, reason: 'Başlangıç şekeri kaydedilmemiş.' };
  if (e.hypoCarbs || (e.exercise && e.exercise !== 'none')) return { ok: false, reason: 'Egzersiz veya hipo içeren kayıtlar kullanılamaz.' };
  if (e.bgTime !== undefined && e.time - e.bgTime > 30 * 60000) return { ok: false, reason: 'Şeker, dozdan 30 dakikadan uzun süre önce ölçülmüş.' };
  const block = blockFor(blocks, e.time, e.meal);
  if (!block) return { ok: false, reason: 'Öğün oranı bulunamadı.' };
  if (e.bg <= block.high) return { ok: false, reason: `Başlangıç şekeri hedef aralığın üstünde (${block.high}+) olmalı.` };
  const prior = priorActivity(sorted, i, profile);
  if (prior) return { ok: false, reason: prior };
  const fu = followUp(sorted, i, ISF_WINDOW, now);
  if (!fu.entry) return { ok: false, reason: fu.reason!, pending: fu.pending };
  const post = fu.entry.bg!;
  const minutes = (fu.entry.time - e.time) / 60000;
  const acted = e.bolus * (1 - iobFraction(minutes, profile));
  if (acted <= 0.2) return { ok: false, reason: 'Doz çok küçük; sonuç güvenilir değil.' };
  const value = (e.bg - post) / acted;
  if (!(value > 5 && value < 500)) return { ok: false, reason: 'Sonuç olağan dışı; kayıtları kontrol et.' };
  return { ok: true, blockId: block.id, sample: { time: e.time, pre: e.bg, post, value } };
}

function collect(
  log: LogEntry[],
  blocks: TimeBlock[],
  profile: InsulinProfile,
  candidate: (e: LogEntry) => boolean,
  sampler: typeof icrSample,
  now: number,
) {
  const byBlock = new Map<string, Sample[]>();
  for (const e of log) {
    if (!candidate(e)) continue;
    const r = sampler(log, e.id, blocks, profile, now);
    if (!r.ok) continue;
    const list = byBlock.get(r.blockId) ?? [];
    list.push(r.sample);
    byBlock.set(r.blockId, list);
  }
  return byBlock;
}

/** Karbonhidrat oranı analizi: dilim başına uygun öğünlerin ortancası. */
export function analyzeIcr(log: LogEntry[], blocks: TimeBlock[], profile: InsulinProfile, now = Date.now()): Suggestion[] {
  const byBlock = collect(log, blocks, profile, (e) => !!(e.carbs && e.bolus && e.bg !== undefined), icrSample, now);
  return buildSuggestions(blocks, byBlock, (b) => b.icr, 0.5);
}

/** Düzeltme faktörü analizi: dilim başına uygun yemeksiz düzeltmelerin ortancası. */
export function analyzeIsf(log: LogEntry[], blocks: TimeBlock[], profile: InsulinProfile, now = Date.now()): Suggestion[] {
  const byBlock = collect(log, blocks, profile, (e) => !!(!e.carbs && e.bolus && e.bg !== undefined), isfSample, now);
  return buildSuggestions(blocks, byBlock, (b) => b.isf, 1);
}

export function buildSuggestions(
  blocks: TimeBlock[],
  byBlock: Map<string, Sample[]>,
  current: (b: TimeBlock) => number,
  step: number,
): Suggestion[] {
  return blocks.map((b) => {
    const samples = byBlock.get(b.id) ?? [];
    const cur = current(b);
    if (samples.length < MIN_SAMPLES) return { blockId: b.id, current: cur, samples };
    const observed = recentMedian(samples);
    const suggested = Math.round(clampChange(cur, observed) / step) * step;
    return { blockId: b.id, current: cur, observed: Math.round(observed * 10) / 10, suggested, samples };
  });
}

export type BasalResult = {
  readings: { time: number; bg: number }[];
  /** İlk ve son ölçüm arasındaki fark (mg/dL) */
  drift?: number;
  /** Saat başına değişim */
  perHour?: number;
  verdict?: 'ok' | 'rising' | 'falling';
  /** Test boyunca yemek/doz/hipo kaydı varsa test bozulur */
  broken?: string;
};

/** Bazal test: başlangıçtan itibaren yemek ve hızlı insülin olmadan alınan ölçümler. */
export function basalTestResult(log: LogEntry[], start: number, end: number): BasalResult {
  const window = log.filter((e) => e.time >= start && e.time <= end).sort((a, b) => a.time - b.time);
  const broken = window.find((e) => e.bolus || e.carbs || e.hypoCarbs);
  const readings = window.filter((e) => e.bg !== undefined).map((e) => ({ time: e.time, bg: e.bg! }));
  const res: BasalResult = { readings };
  if (broken) {
    res.broken = broken.hypoCarbs
      ? 'Test sırasında hipo yaşandı. Bazal dozun fazla olabilir; testi durdur.'
      : 'Test sırasında yemek yendi veya hızlı insülin vuruldu; test geçersiz.';
  }
  if (readings.length >= 2) {
    const first = readings[0];
    const last = readings[readings.length - 1];
    res.drift = last.bg - first.bg;
    const hours = (last.time - first.time) / 3600000;
    res.perHour = hours > 0 ? Math.round(res.drift / hours) : undefined;
    res.verdict = res.drift > 30 ? 'rising' : res.drift < -30 ? 'falling' : 'ok';
  }
  return res;
}
