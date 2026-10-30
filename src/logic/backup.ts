import type { Food, Portion } from '@/data/foods-tr';
import type { CartItem, SavedMeal } from '@/store/foods';
import type { ActiveTest, FinishedTest, TestKind } from '@/store/tests';

import { MEALS, mealScheduleProblems } from './meals';
import { parseHHMM, scheduleProblems } from './schedule';
import type { LogEntry, LogItem, RatioChange, Settings, TimeBlock } from './types';

export type BackupData = {
  settings: Settings;
  log: LogEntry[];
  foods: { customFoods: Food[]; favorites: string[]; meals: SavedMeal[] };
  ratioHistory: RatioChange[];
  tests: { active: ActiveTest | null; finished: FinishedTest[] };
};

function invalid(field: string): never {
  throw new Error(`Yedek dosyasında ${field} alanı geçersiz. Veriler değiştirilmedi.`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!isObject(value)) return invalid(field);
  return value;
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string') return invalid(field);
  return value;
}

function id(value: unknown, field: string): string {
  const result = text(value, field);
  return result.trim() ? result : invalid(field);
}

function number(value: unknown, field: string, positive = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || (positive ? value <= 0 : value < 0)) return invalid(field);
  return value;
}

function signedNumber(value: unknown, field: string): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : invalid(field);
}

function timestamp(value: unknown, field: string): number {
  const result = number(value, field);
  return Number.isFinite(new Date(result).getTime()) ? result : invalid(field);
}

function boolean(value: unknown, field: string): boolean {
  return typeof value === 'boolean' ? value : invalid(field);
}

function enumeration<const T extends string | number>(value: unknown, options: readonly T[], field: string): T {
  const match = options.find((option) => option === value);
  return match === undefined ? invalid(field) : match;
}

function optional<T>(value: unknown, parse: (value: unknown) => T): T | undefined {
  return value === undefined ? undefined : parse(value);
}

function array<T>(value: unknown, field: string, parse: (value: unknown) => T): T[] {
  return Array.isArray(value) ? value.map(parse) : invalid(field);
}

function unique<T extends { id: string }>(values: T[], field: string): T[] {
  return new Set(values.map((value) => value.id)).size === values.length ? values : invalid(field);
}

function time(value: unknown, field: string): string {
  const result = text(value, field);
  return Number.isNaN(parseHHMM(result)) ? invalid(field) : result;
}

const meal = (value: unknown) => enumeration(value, MEALS.map((m) => m.id), 'öğün');
const exercise = (value: unknown) => enumeration(value, ['none', 'light', 'moderate', 'intense'], 'egzersiz');
const optionalNumber = (value: unknown, field: string) => optional(value, (v) => number(v, field));
const optionalText = (value: unknown, field: string) => optional(value, (v) => text(v, field));
const optionalBoolean = (value: unknown, field: string) => optional(value, (v) => boolean(v, field));

function block(value: unknown): TimeBlock {
  const b = object(value, 'oran dilimi');
  return {
    id: id(b.id, 'oran dilimi kimliği'), name: text(b.name, 'oran dilimi adı'), start: time(b.start, 'oran başlangıç saati'),
    meal: optional(b.meal, (v) => enumeration(v, ['sabah', 'ogle', 'aksam'], 'ana öğün')),
    icr: number(b.icr, 'karbonhidrat oranı', true), isf: number(b.isf, 'düzeltme faktörü', true),
    target: number(b.target, 'hedef şeker', true), low: number(b.low, 'alt hedef', true), high: number(b.high, 'üst hedef', true),
  };
}

function settings(value: unknown, defaults: Settings): Settings {
  const s = object(value, 'ayarlar');
  const get = <T>(key: string, fallback: T, parse: (value: unknown) => T): T => s[key] === undefined ? fallback : parse(s[key]);
  const blocks = unique(array(s.blocks, 'oran dilimleri', block), 'yinelenen oran dilimi kimliği');
  if (!blocks.length || scheduleProblems(blocks).length) invalid('oran dilimleri');
  const starts = s.mealStarts === undefined ? {} : object(s.mealStarts, 'öğün saatleri');
  const mealTime = (key: keyof Settings['mealStarts']) => starts[key] === undefined ? defaults.mealStarts[key] : time(starts[key], 'öğün saati');
  const mealStarts = { gece: mealTime('gece'), sabah: mealTime('sabah'), sabahAra: mealTime('sabahAra'), ogle: mealTime('ogle'), ogleAra: mealTime('ogleAra'), aksam: mealTime('aksam'), aksamAra: mealTime('aksamAra') };
  if (mealScheduleProblems(mealStarts).length) invalid('öğün saatleri');
  const reductions = s.exercise === undefined ? {} : object(s.exercise, 'egzersiz azaltmaları');
  const reduction = (key: keyof Settings['exercise']) => {
    const result = reductions[key] === undefined ? defaults.exercise[key] : number(reductions[key], 'egzersiz azaltması');
    return result <= 100 ? result : invalid('egzersiz azaltması');
  };
  const range = (key: 'fastingRange' | 'postRange') => {
    const r = s[key] === undefined ? {} : object(s[key], key);
    const low = r.low === undefined ? defaults[key].low : number(r.low, 'şeker aralığı alt sınırı', true);
    const high = r.high === undefined ? defaults[key].high : number(r.high, 'şeker aralığı üst sınırı', true);
    return low < high ? { low, high } : invalid('şeker aralığı');
  };
  const result: Settings = {
    blocks, mealStarts,
    rapidName: get('rapidName', defaults.rapidName, (v) => text(v, 'hızlı insülin adı')),
    dia: get('dia', defaults.dia, (v) => number(v, 'insülin etki süresi', true)),
    peak: get('peak', defaults.peak, (v) => number(v, 'insülin tepe zamanı', true)),
    penStep: get('penStep', defaults.penStep, (v) => enumeration(v, [0.5, 1], 'kalem adımı')),
    maxBolus: get('maxBolus', defaults.maxBolus, (v) => number(v, 'azami doz', true)),
    reverseCorrection: get('reverseCorrection', defaults.reverseCorrection, (v) => boolean(v, 'ters düzeltme')),
    basalName: get('basalName', defaults.basalName, (v) => text(v, 'bazal insülin adı')),
    basalDose: get('basalDose', defaults.basalDose, (v) => number(v, 'bazal doz')),
    basalTime: get('basalTime', defaults.basalTime, (v) => time(v, 'bazal saati')),
    basalReminder: get('basalReminder', defaults.basalReminder, (v) => boolean(v, 'bazal hatırlatıcı')),
    exercise: { light: reduction('light'), moderate: reduction('moderate'), intense: reduction('intense') },
    hypoThreshold: get('hypoThreshold', defaults.hypoThreshold, (v) => number(v, 'hipo eşiği', true)),
    severeHypoThreshold: get('severeHypoThreshold', defaults.severeHypoThreshold, (v) => number(v, 'ciddi hipo eşiği', true)),
    hyperThreshold: get('hyperThreshold', defaults.hyperThreshold, (v) => number(v, 'yüksek şeker eşiği', true)),
    onboarded: get('onboarded', defaults.onboarded, (v) => boolean(v, 'kurulum durumu')),
    ratioSource: get('ratioSource', defaults.ratioSource, (v) => enumeration(v, ['doctor', 'estimate'], 'oran kaynağı')),
    patientName: optionalText(s.patientName, 'hasta adı'),
    countMethod: get('countMethod', defaults.countMethod, (v) => enumeration(v, ['exchange', 'composition'], 'sayım yöntemi')),
    hypoRise: optional(s.hypoRise, (v) => number(v, 'hipo yükselme katsayısı', true)),
    tabletG: get('tabletG', defaults.tabletG, (v) => number(v, 'tablet karbonhidratı', true)),
    fastingRange: range('fastingRange'), postRange: range('postRange'),
  };
  if (!(result.severeHypoThreshold <= result.hypoThreshold && result.hypoThreshold < result.hyperThreshold)) invalid('şeker eşiklerinin sırası');
  return result;
}

function logItem(value: unknown): LogItem {
  const item = object(value, 'yemek bileşeni');
  return { id: optionalText(item.id, 'bileşen kimliği'), foodId: id(item.foodId, 'yiyecek kimliği'), name: text(item.name, 'yiyecek adı'), grams: number(item.grams, 'yiyecek gramı'), carbs: number(item.carbs, 'yiyecek karbonhidratı'), fatty: optionalBoolean(item.fatty, 'yağlı yiyecek') };
}

function logEntry(value: unknown): LogEntry {
  const e = object(value, 'günlük kaydı');
  return {
    id: id(e.id, 'kayıt kimliği'), time: timestamp(e.time, 'kayıt zamanı'),
    bg: optional(e.bg, (v) => number(v, 'şeker ölçümü', true)), bgTime: optional(e.bgTime, (v) => timestamp(v, 'ölçüm zamanı')),
    meal: optional(e.meal, meal), post: optionalBoolean(e.post, 'tokluk ölçümü'), afterId: optionalText(e.afterId, 'bağlı öğün kimliği'),
    items: optional(e.items, (v) => array(v, 'yemek bileşenleri', logItem)),
    carbs: optionalNumber(e.carbs, 'karbonhidrat'), bolus: optionalNumber(e.bolus, 'hızlı insülin'),
    mealBolus: optionalNumber(e.mealBolus, 'öğün dozu'), correctionBolus: optional(e.correctionBolus, (v) => signedNumber(v, 'düzeltme bileşeni')),
    basal: optionalNumber(e.basal, 'bazal doz'), hypoCarbs: optionalNumber(e.hypoCarbs, 'hipo karbonhidratı'),
    exercise: optional(e.exercise, exercise), ketones: optionalNumber(e.ketones, 'keton'),
    foods: optionalText(e.foods, 'yemek açıklaması'), note: optionalText(e.note, 'kayıt notu'),
  };
}

function portion(value: unknown): Portion {
  const p = object(value, 'porsiyon');
  return { label: text(p.label, 'porsiyon adı'), grams: number(p.grams, 'porsiyon gramı', true), category: optional(p.category, (v) => enumeration(v, ['boyut', 'olcu', 'porsiyon', 'adet'], 'porsiyon kategorisi')), unit: optionalText(p.unit, 'porsiyon birimi') };
}

function food(value: unknown): Food {
  const f = object(value, 'özel yiyecek');
  const portions = array(f.portions, 'porsiyonlar', portion);
  if (portions.length === 0) invalid('yiyeceğin en az bir porsiyonu');
  return {
    id: id(f.id, 'yiyecek kimliği'), name: text(f.name, 'yiyecek adı'), category: text(f.category, 'yiyecek kategorisi'),
    carbsPer100: number(f.carbsPer100, 'yiyecek karbonhidratı'), exPer100: optionalNumber(f.exPer100, 'değişim karbonhidratı'),
    meat: optionalBoolean(f.meat, 'et işareti'), fatty: optionalBoolean(f.fatty, 'yağlı yiyecek'), fast: optionalBoolean(f.fast, 'hızlı karbonhidrat'), custom: optionalBoolean(f.custom, 'özel yiyecek işareti'),
    portions,
  };
}

function cartItem(value: unknown): CartItem {
  const item = object(value, 'tabak bileşeni');
  return {
    ...logItem(item), id: id(item.id, 'tabak bileşeni kimliği'), meat: optionalBoolean(item.meat, 'et işareti'),
    portionLabel: optionalText(item.portionLabel, 'porsiyon adı'), portionGrams: optional(item.portionGrams, (v) => number(v, 'porsiyon gramı', true)),
  };
}

function savedMeal(value: unknown): SavedMeal {
  const m = object(value, 'kayıtlı tabak');
  return { id: id(m.id, 'tabak kimliği'), name: text(m.name, 'tabak adı'), items: array(m.items, 'tabak bileşenleri', cartItem) };
}

function ratioChange(value: unknown): RatioChange {
  const r = object(value, 'oran geçmişi');
  return {
    time: timestamp(r.time, 'oran değişikliği zamanı'), blockId: optionalText(r.blockId, 'oran dilimi kimliği'), blockName: text(r.blockName, 'oran dilimi adı'),
    field: enumeration(r.field, ['icr', 'isf'], 'oran türü'), from: number(r.from, 'önceki oran', true), to: number(r.to, 'yeni oran', true), source: text(r.source, 'oran değişikliği kaynağı'),
  };
}

function test(value: unknown): ActiveTest {
  const t = object(value, 'oran testi');
  const kind: TestKind = enumeration(t.kind, ['icr', 'isf', 'basal'], 'test türü');
  const entryId = optionalText(t.entryId, 'test başlangıç kaydı');
  if (kind !== 'basal' && !entryId) invalid('test başlangıç kaydı');
  return { kind, entryId, startTime: timestamp(t.startTime, 'test başlangıç zamanı') };
}

function finishedTest(value: unknown): FinishedTest {
  const t = object(value, 'tamamlanan test');
  const result = { ...test(t), endTime: timestamp(t.endTime, 'test bitiş zamanı') };
  return result.endTime >= result.startTime ? result : invalid('test tarih sırası');
}

export function parseBackup(textValue: string, defaults: Settings): BackupData {
  let parsed: unknown;
  try { parsed = JSON.parse(textValue); } catch { throw new Error('Yedek dosyası okunamadı. Geçerli bir JSON dosyası seç.'); }
  const root = object(parsed, 'yedek');
  if (root.app !== 'diyabet-asistani') invalid('uygulama kimliği');
  enumeration(root.version, [1, 2], 'yedek sürümü');
  const foodData = root.foods === undefined ? {} : object(root.foods, 'yiyecekler');
  const testData = root.tests === undefined ? {} : object(root.tests, 'testler');
  const log = unique(array(root.log, 'günlük', logEntry), 'yinelenen kayıt kimliği');
  const active = testData.active === undefined || testData.active === null ? null : test(testData.active);
  if (active?.entryId && !log.some((e) => e.id === active.entryId)) invalid('aktif testin başlangıç kaydı');
  return {
    settings: settings(root.settings, defaults), log,
    foods: {
      customFoods: unique(array(foodData.customFoods === undefined ? [] : foodData.customFoods, 'özel yiyecekler', food), 'yinelenen yiyecek kimliği'),
      favorites: array(foodData.favorites === undefined ? [] : foodData.favorites, 'favoriler', (v) => id(v, 'favori kimliği')),
      meals: unique(array(foodData.meals === undefined ? [] : foodData.meals, 'kayıtlı tabaklar', savedMeal), 'yinelenen tabak kimliği'),
    },
    ratioHistory: array(root.ratioHistory === undefined ? [] : root.ratioHistory, 'oran geçmişi', ratioChange),
    tests: { active, finished: array(testData.finished === undefined ? [] : testData.finished, 'tamamlanan testler', finishedTest) },
  };
}
