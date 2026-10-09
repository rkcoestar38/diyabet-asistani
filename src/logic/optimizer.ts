import { carbsOnBoard, insulinOnBoard } from './iob';
import { entryMeal } from './meals';
import { MAX_CHANGE, MIN_SAMPLES, basalTestResult, buildSuggestions, clampChange, icrSample, isfSample, median, type Sample, type Suggestion } from './ratios';
import type { LogEntry, MealType, Settings, TimeBlock } from './types';

const DAY = 86400000;
const HOUR = 3600000;

export type GroupKey = 'sabah' | 'ogle' | 'aksam' | 'diger';
export const GROUPS: { key: GroupKey; label: string; meals: MealType[] }[] = [
  { key: 'sabah', label: 'Kahvaltı', meals: ['sabah'] },
  { key: 'ogle', label: 'Öğle yemeği', meals: ['ogle'] },
  { key: 'aksam', label: 'Akşam yemeği', meals: ['aksam'] },
  { key: 'diger', label: 'Ara öğünler ve gece', meals: ['sabahAra', 'ogleAra', 'aksamAra', 'gece'] },
];
const groupOf = (m: MealType): GroupKey => GROUPS.find((g) => g.meals.includes(m))!.key;

/** Bir örnek: gerçekleşen oran, o sırada ayarlı olan ve ikisinin oranı (rel < 1: ayarlıdan fazla insülin gerekmiş) */
export type EvalSample = Sample & { entryId: string; meal: MealType; group: GroupKey; blockId: string; current: number; rel: number };

export type Evaluation = {
  icr: EvalSample[];
  isf: EvalSample[];
  /** Analize girmeye aday kayıt sayıları (yemek veya düzeltme + doz + öncesi şeker var) */
  candidates: { icr: number; isf: number };
  /** Analize girmeyen kayıtların nedenleri (çoktan aza); henüz beklenen testler sayılmaz */
  rejected: { reason: string; tip: string; count: number }[];
  pending: number;
};

const CATEGORIES: [RegExp, string, string][] = [
  [/saat sonra ölçüm kaydedilmemiş/, 'Yemekten 2,5–5 saat sonra şeker ölçümü yok', 'Yemekten 3 saat sonra şekerini ölçüp “Tokluk şekeri” olarak kaydet.'],
  [/dakikada başka bir yemek/, 'Ölçümden önce araya başka yemek, doz veya egzersiz girmiş', 'Öğünler arasında en az 3–4 saat bırakıldığında analiz daha doğru olur.'],
  [/hedef aralıkta/, 'Yemek öncesi şeker hedef aralığının dışındaydı', 'Hedef aralıktayken yenen öğünler oranı en güvenilir ölçer.'],
  [/Öncesinde/, 'Öncesinde etkisi süren insülin ya da sindirilen yemek vardı', 'Önceki dozdan ve yemekten sonra yeterince beklenen öğünler kullanılabilir.'],
  [/Yemek öncesi şeker kaydedilmemiş|çok önce ölçülmüş|Başlangıç şekeri/, 'Yemek öncesi şeker eksik veya çok önce ölçülmüş', 'Yemekten hemen önce şekerini ölç ve kaydet.'],
  [/Egzersiz|Hipo/, 'Egzersiz veya hipo tedavisi içeren öğün', 'Egzersizli öğünler oran analizine alınmaz.'],
  [/çok düştü|olağan dışı|çok küçük/, 'Sonuç güvenilir değil (şeker çok düştü, doz çok küçük ya da olağan dışı)', 'Kayıtları (karbonhidrat, doz, saat) kontrol et.'],
  [/10 g|vurulan doz|Düzeltme dozu/, 'Karbonhidrat çok az veya doz kaydedilmemiş', 'Dozu ve karbonhidratı her yemekte kaydet.'],
];

export function reasonCategory(reason: string): { reason: string; tip: string } {
  for (const [re, r, tip] of CATEGORIES) if (re.test(reason)) return { reason: r, tip };
  return { reason: 'Diğer', tip: '' };
}

/** Tüm kayıtlardan uygun KH ve düzeltme örneklerini toplar; uygun olmayanların nedenlerini sayar. */
export function evaluate(log: LogEntry[], settings: Pick<Settings, 'blocks' | 'dia' | 'peak' | 'mealStarts'>, now: number): Evaluation {
  const profile = { dia: settings.dia, peak: settings.peak };
  const blockById = new Map(settings.blocks.map((b) => [b.id, b]));
  const out: Evaluation = { icr: [], isf: [], candidates: { icr: 0, isf: 0 }, rejected: [], pending: 0 };
  const reasons = new Map<string, { tip: string; count: number }>();

  for (const e of log) {
    if (e.post || !e.bolus || e.bg === undefined || e.hypoCarbs) continue;
    const kind = e.carbs ? 'icr' : 'isf';
    out.candidates[kind]++;
    const r = (kind === 'icr' ? icrSample : isfSample)(log, e.id, settings.blocks, profile, now);
    if (r.ok) {
      const meal = entryMeal(e, settings.mealStarts);
      const current = blockById.get(r.blockId)?.[kind] ?? 0;
      out[kind].push({ ...r.sample, entryId: e.id, meal, group: groupOf(meal), blockId: r.blockId, current, rel: current ? r.sample.value / current : 1 });
    } else if (r.pending) out.pending++;
    else {
      const c = reasonCategory(r.reason);
      const x = reasons.get(c.reason) ?? { tip: c.tip, count: 0 };
      x.count++;
      reasons.set(c.reason, x);
    }
  }
  out.rejected = [...reasons.entries()].map(([reason, v]) => ({ reason, tip: v.tip, count: v.count })).sort((a, b) => b.count - a.count);
  return out;
}

/** Öneriler yalnızca bu kadar günün kayıtlarından hesaplanır: vücut değiştiyse eski kayıtlar güncel oranı yansıtmaz */
export const RECENT_DAYS = 42;

/** Değerlendirmenin yalnızca son RECENT_DAYS günlük örnekleri (öneri ve öğün özeti için) */
export function recentEval(ev: Evaluation, now: number): Evaluation {
  const keep = (l: EvalSample[]) => l.filter((x) => x.time > now - RECENT_DAYS * DAY && x.time <= now);
  return { ...ev, icr: keep(ev.icr), isf: keep(ev.isf) };
}

export type GroupStat = { key: string; label: string; n: number; current?: number; observed?: number; suggested?: number };

/** Öğün grubuna göre (kahvaltı, öğle, akşam…) ortanca gerçekleşen oran; yeterli örnek (≥3) varsa ±%20 sınırlı öneri */
export function mealGroupStats(samples: EvalSample[], kind: 'icr' | 'isf'): GroupStat[] {
  const step = kind === 'icr' ? 0.5 : 1;
  return GROUPS.map((g) => {
    const s = samples.filter((x) => x.group === g.key);
    if (s.length === 0) return { key: g.key, label: g.label, n: 0 };
    const current = median(s.map((x) => x.current));
    if (s.length < MIN_SAMPLES) return { key: g.key, label: g.label, n: s.length, current };
    const observed = median(s.map((x) => x.value));
    return {
      key: g.key,
      label: g.label,
      n: s.length,
      current: Math.round(current * 10) / 10,
      observed: Math.round(observed * 10) / 10,
      suggested: Math.round(clampChange(current, observed) / step) * step,
    };
  });
}

/** Saat dilimine göre öneriler (uygulanabilir olanlar) */
export function blockSuggestions(samples: EvalSample[], blocks: TimeBlock[], kind: 'icr' | 'isf'): Suggestion[] {
  const by = new Map<string, Sample[]>();
  for (const s of samples) by.set(s.blockId, [...(by.get(s.blockId) ?? []), s]);
  return buildSuggestions(blocks, by, (b) => b[kind], kind === 'icr' ? 0.5 : 1);
}

export type Period = { from: number; to: number; icr: { n: number; value?: number }; isf: { n: number; value?: number } };

/** Dönemlere (14 gün) göre gerçekleşen ortanca oranlar; en yeni dönem ilk sırada. Dönemde ≥2 örnek varsa değer gösterilir. */
export function periodSeries(ev: Evaluation, now: number, days = 14, count = 6): Period[] {
  const span = days * DAY;
  return Array.from({ length: count }, (_, k) => {
    const to = now - k * span;
    const from = to - span;
    const pick = (list: EvalSample[]) => {
      const s = list.filter((x) => x.time > from && x.time <= to);
      return { n: s.length, value: s.length >= 2 ? Math.round(median(s.map((x) => x.value)) * 10) / 10 : undefined };
    };
    return { from, to, icr: pick(ev.icr), isf: pick(ev.isf) };
  });
}

export type Trend = {
  recent: { n: number; rel?: number };
  earlier: { n: number; rel?: number };
  /** Son dönemin ayarlıya oranı − 1 (örn. −0,15: gerçekleşen oran ayarlıdan %15 düşük = daha fazla insülin gerekiyor) */
  gap?: number;
  /** Önceki döneme göre gerçekleşen oranın değişimi (%) */
  changePct?: number;
  verdict: 'more' | 'less' | 'stable' | 'unknown';
};

/**
 * Son `recentDays` gün ile önceki `earlierDays` günün karşılaştırması. Yeterli (≥3) örnek yoksa 'unknown'.
 * 'more': gerçekleşen oran ayarlıdan en az %10 düşük (daha fazla insülin), 'less': en az %10 yüksek.
 */
export function trendOf(samples: EvalSample[], now: number, recentDays = 28, earlierDays = 56): Trend {
  const recentS = samples.filter((s) => s.time > now - recentDays * DAY && s.time <= now);
  const earlierS = samples.filter((s) => s.time > now - (recentDays + earlierDays) * DAY && s.time <= now - recentDays * DAY);
  const recent = { n: recentS.length, rel: recentS.length >= MIN_SAMPLES ? median(recentS.map((s) => s.rel)) : undefined };
  const earlier = { n: earlierS.length, rel: earlierS.length >= MIN_SAMPLES ? median(earlierS.map((s) => s.rel)) : undefined };
  const gap = recent.rel !== undefined ? recent.rel - 1 : undefined;
  const changePct = recent.rel !== undefined && earlier.rel !== undefined ? Math.round((recent.rel / earlier.rel - 1) * 100) : undefined;
  const verdict = gap === undefined ? 'unknown' : gap <= -0.1 ? 'more' : gap >= 0.1 ? 'less' : 'stable';
  return { recent, earlier, gap, changePct, verdict };
}

export function trendSentence(kind: 'icr' | 'isf', t: Trend): string {
  const name = kind === 'icr' ? 'Karbonhidrat oranın' : 'Düzeltme faktörün';
  if (t.verdict === 'unknown') return `${name} için yeterli uygun kayıt yok (son 4 haftada ${t.recent.n}, en az ${MIN_SAMPLES} gerekli).`;
  const pct = Math.abs(Math.round((t.gap ?? 0) * 100));
  const base =
    t.verdict === 'stable'
      ? `${name} kayıtlara göre ayarlıya yakın çalışıyor (fark %${pct}).`
      : t.verdict === 'more'
        ? `${name} ayarlıdan yaklaşık %${pct} daha düşük çıkıyor: son 4 haftada daha fazla insülin gerekmiş görünüyor.`
        : `${name} ayarlıdan yaklaşık %${pct} daha yüksek çıkıyor: son 4 haftada daha az insülin gerekmiş görünüyor.`;
  if (t.changePct === undefined) return base;
  const dir = t.changePct < -3 ? `önceki dönemden %${-t.changePct} daha düşük` : t.changePct > 3 ? `önceki dönemden %${t.changePct} daha yüksek` : 'önceki dönemle aynı';
  return `${base} Gerçekleşen oran ${dir}.`;
}

/* ---------------- Bazal: gece / uzun açlık ---------------- */

/** Gece penceresinin başlangıç şekeri üst sınırı (mg/dL) */
export const FASTING_START_MAX = 180;

export type FastingWindow = { from: number; to: number; fromBg: number; toBg: number; hours: number; drift: number; perHour: number };

const isIntervention = (e: LogEntry) => !!(e.bolus || e.carbs || e.hypoCarbs || (e.exercise && e.exercise !== 'none'));

/**
 * Gece boyunca yemek ve hızlı insülin olmadan ölçülen iki şeker arasındaki değişim (bazal etkisi).
 * Koşullar: ilk ölçüm 20:00–04:00 arası ve 180 mg/dL'yi aşmayan, iki ölçüm arası 4–12 saat, arada ve öncesinde (insülin/yemek etkisi bitmiş) müdahale yok, hipo yok.
 * Sabah ölçümü öğün öncesi olabilir (aynı kayıtta doz/yemek olsa bile ölçüm onlardan önceydi).
 */
export function fastingWindows(log: LogEntry[], settings: Pick<Settings, 'dia' | 'peak' | 'hypoThreshold'>, now: number, days = 30): FastingWindow[] {
  const profile = { dia: settings.dia, peak: settings.peak };
  const t = (e: LogEntry) => e.bgTime ?? e.time;
  const sorted = [...log].sort((a, b) => a.time - b.time);
  const readings = sorted.filter((e) => e.bg !== undefined && e.time >= now - days * DAY).sort((a, b) => t(a) - t(b));
  const out: FastingWindow[] = [];
  for (let i = 0; i + 1 < readings.length; i++) {
    const a = readings[i];
    const b = readings[i + 1];
    const ta = t(a);
    const tb = t(b);
    const hours = (tb - ta) / HOUR;
    const h = new Date(ta).getHours();
    if (hours < 4 || hours > 12 || !(h >= 20 || h < 4)) continue;
    // Başlangıç şekeri yüksekse (yemekten kalan yükseklik) düşüş bazal etkisi değil, yemek sonrası iniş olabilir: 180 üstü başlangıçlar alınmaz
    if (isIntervention(a) || a.bg! < settings.hypoThreshold || b.bg! < settings.hypoThreshold || a.bg! > FASTING_START_MAX) continue;
    if (sorted.some((e) => e.id !== a.id && e.id !== b.id && e.time > ta && e.time < tb && isIntervention(e))) continue;
    const before = sorted.filter((e) => e.time <= ta && e.id !== a.id);
    if (insulinOnBoard(before, ta, profile) > 0.3 || carbsOnBoard(before, ta) > 5) continue;
    const drift = b.bg! - a.bg!;
    out.push({ from: ta, to: tb, fromBg: a.bg!, toBg: b.bg!, hours: Math.round(hours * 10) / 10, drift, perHour: Math.round((drift / hours) * 10) / 10 });
  }
  return out;
}

export type BasalSummary = {
  n: number;
  /** Ortanca saatlik değişim (mg/dL/sa) */
  perHour?: number;
  /** Ortanca toplam değişim (mg/dL) */
  drift?: number;
  verdict: 'unknown' | 'ok' | 'rising' | 'falling';
  /** Önerilen yeni bazal doz (ünite); yalnızca belirgin eğilimde ve ayarlı bazal doz varsa */
  suggestedDose?: number;
};

/** Eşik: ortanca saatlik değişim bu değerin üstünde/altındaysa gece boyunca şeker yükseliyor/düşüyor sayılır (≈ 6 saatte 30 mg/dL) */
export const BASAL_PER_HOUR = 5;

export function basalSummary(windows: FastingWindow[], basalDose: number): BasalSummary {
  if (windows.length < MIN_SAMPLES) return { n: windows.length, verdict: 'unknown' };
  const perHour = Math.round(median(windows.map((w) => w.perHour)) * 10) / 10;
  const drift = Math.round(median(windows.map((w) => w.drift)));
  const verdict = perHour > BASAL_PER_HOUR ? 'rising' : perHour < -BASAL_PER_HOUR ? 'falling' : 'ok';
  let suggestedDose: number | undefined;
  if (verdict !== 'ok' && basalDose > 0) {
    const step = Math.max(1, Math.round(basalDose * (MAX_CHANGE / 2))); // ≈ %10, en az 1 Ü
    suggestedDose = verdict === 'rising' ? basalDose + step : Math.max(1, basalDose - step);
  }
  return { n: windows.length, perHour, drift, verdict, suggestedDose };
}

export function basalSentence(b: BasalSummary): string {
  const n = (v: number) => String(v).replace('.', ',');
  if (b.verdict === 'unknown') return `Yeterli gece verisi yok (${b.n} uygun gece, en az ${MIN_SAMPLES} gerekli). Yemeksiz ve dozsuz geçirdiğin gecelerde yatmadan önce ve sabah ölç.`;
  if (b.verdict === 'ok') return `Gece boyunca şekerin sabit kalıyor (ortanca ${b.perHour! > 0 ? '+' : ''}${n(b.perHour!)} mg/dL/saat); bazal doz uygun görünüyor.`;
  return b.verdict === 'rising'
    ? `Gece boyunca şekerin ortanca saatte ${n(b.perHour!)} mg/dL yükseliyor (toplam ~${b.drift}). Bazal doz yetersiz veya sabaha karşı yükselme (şafak etkisi) olabilir.`
    : `Gece boyunca şekerin ortanca saatte ${n(Math.abs(b.perHour!))} mg/dL düşüyor (toplam ~${b.drift}). Bazal doz fazla olabilir; gece hipo riskine dikkat.`;
}

export type ManualBasalTest = { start: number; end: number; drift?: number; perHour?: number; verdict?: string; broken?: string; readings: number };

/** Rehberli bazal testlerinin sonuçları (Öğren > Bazal insülin testi) */
export function manualBasalTests(log: LogEntry[], tests: { startTime: number; endTime: number }[]): ManualBasalTest[] {
  return tests.map((t) => {
    const r = basalTestResult(log, t.startTime, t.endTime);
    return { start: t.startTime, end: t.endTime, drift: r.drift, perHour: r.perHour, verdict: r.verdict, broken: r.broken, readings: r.readings.length };
  });
}

/** Ana sayfa kartı için: önerilmesi gereken değişiklik var mı? */
export function attention(all: Evaluation, settings: Pick<Settings, 'blocks'>, now: number): string | undefined {
  // Öneriler tüm geçmişten, yeni kayıtlar ağırlıklı (öğün kartlarındaki öneriyle aynı)
  for (const kind of ['icr', 'isf'] as const) {
    for (const s of blockSuggestions(all[kind].filter((x) => x.time <= now), settings.blocks, kind)) {
      if (s.suggested !== undefined && Math.abs(s.suggested - s.current) >= (kind === 'icr' ? 0.5 : 1)) {
        return kind === 'icr' ? 'Karbonhidrat oranın için güncelleme önerisi var.' : 'Düzeltme faktörün için güncelleme önerisi var.';
      }
    }
  }
  return undefined;
}
