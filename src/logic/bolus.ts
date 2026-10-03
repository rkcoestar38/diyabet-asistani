import type { ExerciseLevel, Settings, TimeBlock, Warning } from './types';

export const BG_MIN = 20;
export const BG_MAX = 600;
export const CARBS_MAX = 300;

/** En yakın adıma yuvarlar; tam ortadaysa aşağı yuvarlar (güvenli taraf). Negatifse 0. */
export function roundToStep(x: number, step: number): number {
  if (!(x > 0)) return 0;
  const r = Math.ceil(x / step - 0.5) * step;
  return Math.round(r * 100) / 100;
}

/** 1 gram karbonhidratın şekeri yaklaşık kaç mg/dL yükselttiği */
export function bgRisePerGram(block: TimeBlock): number {
  return block.isf / block.icr;
}

export function exerciseReduction(level: ExerciseLevel | undefined, s: Settings): number {
  if (!level || level === 'none') return 0;
  return Math.min(Math.max(s.exercise[level], 0), 90) / 100;
}

export type BgCheck =
  | { kind: 'ok'; warnings: Warning[] }
  | { kind: 'invalid'; warnings: Warning[] }
  | { kind: 'hypo'; severe: boolean; warnings: Warning[] };

export function checkBg(bg: number | undefined, s: Settings): BgCheck {
  if (bg === undefined) {
    return {
      kind: 'ok',
      warnings: [{ level: 'warn', text: 'Şeker girilmedi: düzeltme ve güvenlik kontrolleri yapılamıyor. Mümkünse önce ölç.' }],
    };
  }
  if (!(bg >= BG_MIN && bg <= BG_MAX)) {
    return {
      kind: 'invalid',
      warnings: [{ level: 'danger', text: `Şeker ${BG_MIN}–${BG_MAX} mg/dL arasında olmalı. Cihaz "LO" veya "HI" gösteriyorsa tekrar ölç.` }],
    };
  }
  if (bg < s.hypoThreshold) {
    const severe = bg < s.severeHypoThreshold;
    return {
      kind: 'hypo',
      severe,
      warnings: [
        severe
          ? { level: 'danger', text: `Şekerin ${bg} mg/dL — ciddi düşük! İnsülin VURMA. Hemen hızlı karbonhidrat al. Bilincin bulanıklaşırsa yanındakiler glukagon uygulamalı ve 112 aranmalı.` }
          : { level: 'danger', text: `Şekerin ${bg} mg/dL — düşük. İnsülin vurma, önce hipoyu düzelt.` },
      ],
    };
  }
  const warnings: Warning[] = [];
  if (bg >= s.hyperThreshold) {
    warnings.push({
      level: 'warn',
      text: `Şekerin ${bg} mg/dL. Keton ölç. Kan ketonu ≥1,5 mmol/L veya idrarda ++ keton, bulantı/kusma/karın ağrısı varsa doktorunu ara veya acile git; egzersiz yapma, bol su iç.`,
    });
  }
  return { kind: 'ok', warnings };
}

export type BolusInput = {
  bg?: number;
  carbs: number;
  block: TimeBlock;
  iob: number;
  /** Henüz emilmemiş (aktif) karbonhidrat, g */
  cob?: number;
  settings: Settings;
  exercise?: ExerciseLevel;
  /** Son 2 saat içinde doz yapıldıysa (insülin yığılması uyarısı) */
  minutesSinceLastBolus?: number;
};

export type BolusResult = {
  status: 'ok' | 'hypo' | 'invalid';
  /** Karbonhidrat için gereken doz */
  meal: number;
  /** (şeker − hedef) / ISF, aktif insülin düşülmeden */
  correctionRaw: number;
  /** Düzeltme − aktif insülin düşümü (negatif olabilir) */
  correction: number;
  /** Hesaba katılan aktif insülin */
  iobUsed: number;
  /** Egzersiz nedeniyle düşülen ünite */
  exerciseCut: number;
  /** Yuvarlanmamış doz */
  raw: number;
  /** Kalem adımına yuvarlanmış önerilen doz */
  dose: number;
  /** Aktif insülin ve aktif karbonhidrat bittiğinde, bu yemek ve doz dikkate alınmadan beklenen şeker */
  eventualBg?: number;
  warnings: Warning[];
};

/**
 * Yemek + düzeltme dozu.
 * - Yemek dozu = KH / KH oranı
 * - Düzeltme = (şeker − hedef) / ISF. Şeker hedefin altındaysa (ve ters düzeltme açıksa) negatif olur.
 * - Aktif insülin düşümü = şu ikisinin büyüğü:
 *     a) aktif insülinin pozitif düzeltmeyi karşılayan kısmı (düzeltmeler üst üste binmesin),
 *     b) aktif insülinin henüz emilmemiş karbonhidratla karşılanmayan kısmı ("açıkta" insülin).
 *   Böylece önceki yemeğin insülini yeni yemeğin dozunu sıfırlamaz, ama yemeksiz vurulmuş
 *   bir düzeltme dozu yeni yemeğin dozundan düşülür.
 * - Egzersiz azaltması toplam doza uygulanır.
 */
export function calcBolus(input: BolusInput): BolusResult {
  const { bg, carbs, block, iob, settings: s, exercise } = input;
  const empty: BolusResult = {
    status: 'ok', meal: 0, correctionRaw: 0, correction: 0, iobUsed: 0, exerciseCut: 0, raw: 0, dose: 0, warnings: [],
  };

  if (!(carbs >= 0 && carbs <= CARBS_MAX)) {
    return { ...empty, status: 'invalid', warnings: [{ level: 'danger', text: `Karbonhidrat 0–${CARBS_MAX} g arasında olmalı.` }] };
  }
  const bgCheck = checkBg(bg, s);
  if (bgCheck.kind !== 'ok') return { ...empty, status: bgCheck.kind, warnings: bgCheck.warnings };
  const warnings = [...bgCheck.warnings];

  const meal = carbs / block.icr;
  const correctionRaw = bg === undefined ? 0 : (bg - block.target) / block.isf;
  const correctionTerm = correctionRaw > 0 || s.reverseCorrection ? correctionRaw : 0;
  const uncoveredIob = Math.max(0, iob - (input.cob ?? 0) / block.icr);
  const iobUsed = Math.min(iob, Math.max(uncoveredIob, Math.max(0, correctionRaw)));
  const correction = correctionTerm - iobUsed;

  const beforeExercise = Math.max(0, meal + correction);
  const reduction = exerciseReduction(exercise, s);
  const exerciseCut = beforeExercise * reduction;
  const raw = beforeExercise - exerciseCut;
  const dose = roundToStep(raw, s.penStep);
  const eventualBg = bg === undefined ? undefined : projectBg(bg, block, iob, input.cob ?? 0);

  if (eventualBg !== undefined && eventualBg < block.low) {
    const extra = Math.ceil(((block.target - eventualBg) / bgRisePerGram(block)) / 5) * 5;
    warnings.push({
      level: 'warn',
      text: `Vücudunda ${fmt(iob)} Ü aktif insülin var; ek karbonhidrat almazsan şekerin ~${Math.max(eventualBg, 0)} mg/dL'ye inebilir. Dozu azaltmayı veya ~${extra} g ek karbonhidratı düşün.`,
    });
  }
  if (input.minutesSinceLastBolus !== undefined && input.minutesSinceLastBolus < 120) {
    warnings.push({
      level: 'warn',
      text: `${Math.round(input.minutesSinceLastBolus)} dk önce insülin vurdun.${iobUsed > 0 ? ' Aktif insülin hesaptan düşüldü;' : ''} Üst üste doz (yığılma) riskine dikkat et.`,
    });
  }
  if (dose > s.maxBolus) {
    warnings.push({
      level: 'danger',
      text: `Önerilen doz (${fmt(dose)} Ü), belirlediğin azami tek doz sınırını (${fmt(s.maxBolus)} Ü) aşıyor. Girdileri kontrol et.`,
    });
  }
  if (reduction > 0 && bg !== undefined && bg < 126) {
    warnings.push({
      level: 'info',
      text: 'Egzersiz öncesi şekerin 126 mg/dL altında: başlamadan önce 15–30 g karbonhidrat almayı düşün ve egzersiz sırasında ölç.',
    });
  }

  return { status: 'ok', meal, correctionRaw, correction, iobUsed, exerciseCut, raw, dose, eventualBg, warnings };
}

export type CarbsForDoseResult = {
  status: 'ok' | 'hypo' | 'invalid';
  carbs: number;
  correction: number;
  warnings: Warning[];
};

/** Ters hesap: belli bir dozla kaç gram karbonhidrat karşılanır? (Düzeltme ve aktif insülin dahil) */
export function carbsForDose(input: Omit<BolusInput, 'carbs'> & { units: number }): CarbsForDoseResult {
  const { units, bg, block, settings: s, exercise } = input;
  if (!(units >= 0 && units <= 100)) {
    return { status: 'invalid', carbs: 0, correction: 0, warnings: [{ level: 'danger', text: 'Doz 0–100 Ü arasında olmalı.' }] };
  }
  const bgCheck = checkBg(bg, s);
  if (bgCheck.kind !== 'ok') return { status: bgCheck.kind, carbs: 0, correction: 0, warnings: bgCheck.warnings };
  const ref = calcBolus({ ...input, carbs: 0 });
  const reduction = exerciseReduction(exercise, s);
  // toplam = (yemek + düzeltme) × (1 − azaltma)  ⇒  yemek = toplam / (1 − azaltma) − düzeltme
  const mealUnits = units / (1 - reduction) - ref.correction;
  const carbs = Math.max(0, Math.floor(mealUnits * block.icr));
  const warnings = [...bgCheck.warnings];
  if (mealUnits <= 0) {
    warnings.push({ level: 'info', text: 'Bu doz yalnızca yüksek şekeri düzeltmeye yetiyor; karbonhidrat için pay kalmıyor.' });
  }
  if (units > s.maxBolus) {
    warnings.push({ level: 'danger', text: `${fmt(units)} Ü, azami tek doz sınırını (${fmt(s.maxBolus)} Ü) aşıyor.` });
  }
  return { status: 'ok', carbs, correction: ref.correction, warnings };
}

export type LowPlan = {
  /** Aktif insülin bittiğinde beklenen şeker */
  eventualBg: number;
  /** Hedefe çıkmak için gereken karbonhidrat (5 g'a yuvarlanmış) */
  carbs: number;
  /** Bunun aktif insülin nedeniyle eklenen kısmı */
  carbsForIob: number;
};

/** Aktif insülin ve aktif karbonhidratın etkisi bittiğinde beklenen şeker */
export function projectBg(bg: number, block: TimeBlock, iob: number, cob: number, rise = bgRisePerGram(block)): number {
  return Math.round(bg - iob * block.isf + cob * rise);
}

/** Şekeri hedefe çıkarmak için gereken karbonhidrat (aktif insülin ve aktif karbonhidrat dahil). */
export function carbsToTarget(bg: number, block: TimeBlock, iob: number, cob = 0, rise = bgRisePerGram(block)): LowPlan {
  const eventualBg = projectBg(bg, block, iob, cob, rise);
  const total = Math.max(0, (block.target - eventualBg) / rise);
  const iobCarbNeed = rise > 0 ? (iob * block.isf) / rise : iob * block.icr;
  const forIob = Math.min(total, Math.max(0, iobCarbNeed - cob));
  return {
    eventualBg: Math.round(eventualBg),
    carbs: Math.ceil(total / 5) * 5,
    carbsForIob: Math.round(forIob),
  };
}

export type HypoPlan = {
  severe: boolean;
  /** Şimdi alınması önerilen hızlı karbonhidrat (g): şekere ve 1 g'ın etkisine göre */
  carbsNow: number;
  /** Aktif insülin nedeniyle önerilen toplam (carbsNow'un üzerinde ise) */
  carbsWithIob: number;
  /** Bu miktarla yaklaşık beklenen şeker (15-30 dk sonra) */
  expectedBg: number;
  /** Hesapta kullanılan: 1 g hızlı karbonhidratın şekeri kaç mg/dL yükselttiği */
  rise: number;
};

/** Tek seferde önerilen en az / en çok hızlı karbonhidrat (g); fazlası yüksek şekere (rebound) yol açar */
export const HYPO_MIN_G = 10;
export const HYPO_MAX_G = 30;

/**
 * Hipo tedavisi: şekeri hedefe (bloğun hedefi) çıkaracak miktar, 1 g'ın etkisine (`rise`) göre 5 g'a yuvarlanır.
 * Ağır hipoda en az 20 g. Aktif insülin fazlaysa toplam ihtiyaç ayrıca gösterilir.
 */
export function hypoPlan(bg: number, block: TimeBlock, iob: number, s: Settings, cob = 0, rise = bgRisePerGram(block)): HypoPlan {
  const severe = bg < s.severeHypoThreshold;
  const need = Math.max(0, (block.target - bg) / rise);
  const now = Math.min(HYPO_MAX_G, Math.max(severe ? 20 : HYPO_MIN_G, Math.ceil(need / 5) * 5));
  const plan = carbsToTarget(bg, block, iob, cob, rise);
  return { severe, carbsNow: now, carbsWithIob: Math.max(now, plan.carbs), expectedBg: Math.round(bg + now * rise), rise };
}

export function fmt(n: number, digits = 1): string {
  const r = Math.round(n * 10 ** digits) / 10 ** digits;
  return r.toLocaleString('tr-TR', { maximumFractionDigits: digits });
}
