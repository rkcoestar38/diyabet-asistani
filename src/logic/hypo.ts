import { BG_MAX, BG_MIN, HYPO_MAX_G, carbsToTarget, hypoPlan, projectBg, type HypoPlan } from './bolus';
import { carbsOnBoard, insulinOnBoard } from './iob';
import { activeBlock } from './schedule';
import type { InsulinProfile, LogEntry, Settings, TimeBlock } from './types';

/** Tedaviden sonraki ölçümün geçerli sayılacağı aralık (dk): hızlı karbonhidratın etkisini ölçen 15 dk'lık kontrol */
const CHECK_MIN = 10;
const CHECK_MAX = 40;

export type RiseSample = { time: number; carbs: number; before: number; after: number; rise: number };

/**
 * Kayıtlardan, 1 g hızlı karbonhidratın şekeri gerçekte kaç mg/dL yükselttiği.
 * Hipo tedavisi (bg + hipo karbonhidratı) ve 10–40 dk içindeki sonraki ölçüm bir örnektir.
 * Arada başka yemek/doz/tedavi varsa, öncesinde sindirilen yemek varsa atlanır; bu arada etki eden insülin düzeltilir.
 */
export function hypoRiseSamples(log: LogEntry[], blocks: TimeBlock[], profile: InsulinProfile): RiseSample[] {
  const sorted = [...log].sort((a, b) => a.time - b.time);
  const out: RiseSample[] = [];
  sorted.forEach((e, i) => {
    if (!e.hypoCarbs || e.hypoCarbs < 5 || e.hypoCarbs > 60 || e.bg === undefined || e.carbs) return;
    const block = activeBlock(blocks, new Date(e.time));
    if (!block) return;
    let next: LogEntry | undefined;
    for (let j = i + 1; j < sorted.length; j++) {
      const f = sorted[j];
      const dt = (f.time - e.time) / 60000;
      if (dt > CHECK_MAX) break;
      if (dt >= CHECK_MIN && f.bg !== undefined) {
        next = f;
        break;
      }
      if (f.carbs || f.hypoCarbs || f.bolus) return; // arada müdahale var
    }
    if (!next) return;
    const meals = sorted.filter((x) => x.id !== e.id && !x.hypoCarbs);
    if (carbsOnBoard(meals, e.time) > 5) return; // sindirilen yemek sonucu bozar
    const acted = insulinOnBoard(sorted, e.time, profile) - insulinOnBoard(sorted, next.time, profile);
    const rise = (next.bg! - e.bg + Math.max(0, acted) * block.isf) / e.hypoCarbs;
    if (rise < 0.5 || rise > 15) return; // olağan dışı: yanlış kayıt veya ek müdahale
    out.push({ time: e.time, carbs: e.hypoCarbs, before: e.bg, after: next.bg!, rise });
  });
  return out;
}

/** Güvenilir bir kişisel değer için en az örnek */
export const MIN_RISE_SAMPLES = 3;

/** Örneklerin ortancası (aykırı değerlerden etkilenmez); yeterli örnek yoksa undefined */
export function personalRise(samples: RiseSample[]): number | undefined {
  if (samples.length < MIN_RISE_SAMPLES) return undefined;
  const v = samples.map((s) => s.rise).sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  const med = v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  return Math.round(med * 10) / 10;
}

export type RiseChoice = { rise: number; source: 'manual' | 'data' | 'ratios'; samples: number; learned?: number };

/** Hesapta kullanılacak değer: elle girilen > kayıtlardan öğrenilen > oranlardan (ISF ÷ KH oranı) */
export function chooseRise(manual: number | undefined, samples: RiseSample[], block: TimeBlock): RiseChoice {
  const learned = personalRise(samples);
  const fallback = Math.round((block.isf / block.icr) * 10) / 10;
  if (manual !== undefined && manual > 0) return { rise: manual, source: 'manual', samples: samples.length, learned };
  if (learned !== undefined) return { rise: learned, source: 'data', samples: samples.length, learned };
  return { rise: fallback, source: 'ratios', samples: samples.length };
}

/** Hızlı karbonhidrat kaynakları: verilen gram için porsiyon (gerçek yaşamda ölçülebilen birimlerle) */
export function quickCarbOptions(grams: number, tabletG: number): { icon: 'medical' | 'water' | 'cube' | 'nutrition'; text: string; sub: string }[] {
  const half = (n: number) => {
    const r = Math.round(n * 2) / 2;
    return r % 1 === 0 ? String(r) : `${Math.floor(r)}½`.replace(/^0½$/, '½');
  };
  return [
    { icon: 'medical', text: `${Math.max(1, Math.round(grams / Math.max(tabletG, 1)))} glukoz tableti`, sub: `Tablet başına ${tabletG} g` },
    { icon: 'water', text: `${Math.max(10, Math.round(grams / 0.1 / 10) * 10)} ml meyve suyu`, sub: '100 ml ≈ 10 g KH' },
    { icon: 'water', text: `${Math.max(10, Math.round(grams / 0.106 / 10) * 10)} ml şekerli kola`, sub: 'Normal şekerli (diyet değil)' },
    { icon: 'cube', text: `${Math.max(1, Math.round(grams / 4))} kesme şeker`, sub: '≈ 4 g / adet, suda eritilmiş' },
    { icon: 'nutrition', text: `${half(grams / 16)} yemek kaşığı bal`, sub: '≈ 16 g hızlı KH' },
  ];
}

export type HypoAssessment =
  /** Geçersiz değer (ölçüm aralığı dışı) */
  | { status: 'invalid' }
  /** Ölçüm yok: belirti varsa ölçmeden standart 15 g */
  | { status: 'unknown'; carbs: number }
  /** Şeker hipo sınırının altında: tedavi et. severe = ağır (glukagon uyarısı) */
  | { status: 'low' | 'severe'; plan: HypoPlan }
  /** Şeker henüz düşük değil ama hedefin altında ve aktif insülin yüzünden hipoya inmesi bekleniyor: küçük önleyici miktar */
  | { status: 'falling'; carbs: number; eventualBg: number }
  /** Hipo yok. belowRange = hedef aralığın biraz altı; watch = aktif insülin yüzünden ileride düşebilir (karbonhidrat gerekmez, sık ölç) */
  | { status: 'belowRange' | 'ok' | 'high' | 'veryHigh'; eventualBg: number; watch: boolean };

/**
 * Düşük şeker ekranının kararı: hangi durumda karbonhidrat önerilir, hangisinde ÖNERİLMEZ.
 * Karbonhidrat yalnızca hipo (şeker < hipo sınırı), ölçüm yoksa belirtiye bağlı standart tedavi ve
 * "hedefin altında + aktif insülinle hipoya iniyor" durumunda önerilir. Şeker hipo sınırının üstündeyse asla tedavi önerilmez.
 */
export function assessHypo(bg: number | undefined, block: TimeBlock, iob: number, cob: number, s: Settings, rise: number): HypoAssessment {
  if (bg === undefined) return { status: 'unknown', carbs: 15 };
  if (!(bg >= BG_MIN && bg <= BG_MAX)) return { status: 'invalid' };
  if (bg < s.hypoThreshold) {
    const plan = hypoPlan(bg, block, iob, s, cob, rise);
    return { status: plan.severe ? 'severe' : 'low', plan };
  }
  const eventualBg = projectBg(bg, block, iob, cob, rise);
  const watch = eventualBg < s.hypoThreshold;
  if (bg < block.low && watch) {
    const total = carbsToTarget(bg, block, iob, cob, rise).carbs;
    return { status: 'falling', carbs: Math.min(HYPO_MAX_G, Math.max(5, total)), eventualBg };
  }
  const status = bg >= s.hyperThreshold ? 'veryHigh' : bg > block.high ? 'high' : bg < block.low ? 'belowRange' : 'ok';
  return { status, eventualBg, watch };
}

/** Hipo düzeldikten sonra (kontrol ölçümü hipo sınırının üstünde): ek kompleks karbonhidrat gerekir mi, ne kadar? */
export function followUpSnack(bg: number, block: TimeBlock, iob: number, cob: number, s: Settings, rise: number): { snack: number; eventualBg: number } {
  const eventualBg = projectBg(bg, block, iob, cob, rise);
  const needs = bg < block.low || eventualBg < s.hypoThreshold;
  const snack = needs ? Math.min(HYPO_MAX_G, carbsToTarget(bg, block, iob, cob, rise).carbs) : 0;
  return { snack, eventualBg };
}
