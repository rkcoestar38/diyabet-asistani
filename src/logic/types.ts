/** Günün belli bir saatinden itibaren geçerli oranlar. Bir sonraki bloğun başlangıcına kadar geçerlidir. */
export type TimeBlock = {
  id: string;
  name: string;
  /** "HH:MM" */
  start: string;
  /** Karbonhidrat oranı: 1 ünite kaç gram karbonhidratı karşılar (g/Ü) */
  icr: number;
  /** Düzeltme faktörü: 1 ünite şekeri kaç mg/dL düşürür (mg/dL/Ü) */
  isf: number;
  /** Hedef şeker (mg/dL) */
  target: number;
  /** Hedef aralık alt/üst sınırı (mg/dL) */
  low: number;
  high: number;
};

export type ExerciseLevel = 'none' | 'light' | 'moderate' | 'intense';

export type InsulinProfile = {
  /** İnsülin etki süresi (saat) */
  dia: number;
  /** En yüksek etki zamanı (dakika) */
  peak: number;
};

export type Settings = {
  blocks: TimeBlock[];
  rapidName: string;
  dia: number;
  peak: number;
  /** Kalem adımı (0.5 veya 1 ünite) */
  penStep: number;
  /** Tek seferde izin verilen azami doz (uyarı sınırı) */
  maxBolus: number;
  /** Hedefin altındaki şekerde yemek dozunu azalt (ters düzeltme) */
  reverseCorrection: boolean;
  basalName: string;
  basalDose: number;
  basalTime: string;
  basalReminder: boolean;
  /** Egzersiz öncesi yemek dozu azaltma yüzdeleri */
  exercise: { light: number; moderate: number; intense: number };
  hypoThreshold: number;
  severeHypoThreshold: number;
  hyperThreshold: number;
  onboarded: boolean;
  /** Oranlar doktordan mı geldi, yoksa uygulamanın başlangıç tahmini mi? */
  ratioSource: 'doctor' | 'estimate';
  /** Doktor raporunun başlığında görünür (isteğe bağlı) */
  patientName?: string;
  /** Yiyecek karbonhidratı nasıl sayılır: değişim listesi (1 porsiyon = 15 g) veya gerçek bileşim */
  countMethod: 'exchange' | 'composition';
  /** Her öğünün başlangıç saati (SS:DD); öğün, kayıt saatine göre otomatik seçilir */
  mealStarts: Record<MealType, string>;
};

export type MealType = 'sabah' | 'sabahAra' | 'ogle' | 'ogleAra' | 'aksam' | 'aksamAra' | 'gece';

export type LogItem = { foodId: string; name: string; grams: number; carbs: number; fatty?: boolean };

export type LogEntry = {
  id: string;
  /** Unix ms: yemek/doz/kayıt zamanı */
  time: number;
  bg?: number;
  /** Şekerin ölçüldüğü zaman (verilmezse kayıt zamanı) */
  bgTime?: number;
  /** Hangi öğün (verilmezse saatinden çıkarılır) */
  meal?: MealType;
  /** Seçilen yemekler (yapılandırılmış); foods bunun metin özeti */
  items?: LogItem[];
  carbs?: number;
  /** Vurulan toplam hızlı insülin */
  bolus?: number;
  /** Önerilen dozun yemek ve düzeltme bileşenleri (analiz için) */
  mealBolus?: number;
  correctionBolus?: number;
  basal?: number;
  /** Hipo için alınan hızlı karbonhidrat (g) */
  hypoCarbs?: number;
  exercise?: ExerciseLevel;
  ketones?: number;
  foods?: string;
  note?: string;
};

export type Warning = { level: 'danger' | 'warn' | 'info'; text: string };
