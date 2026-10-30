import { DEFAULT_SETTINGS } from '@/store/settings';
import { parseBackup } from '../backup';
import { calcBolus } from '../bolus';

jest.mock('@/store/storage', () => ({ storage: { getItem: async () => null, setItem: async () => undefined, removeItem: async () => undefined }, uid: () => Math.random().toString(36) }));

const fixture = () => ({
  app: 'diyabet-asistani', version: 2, settings: { ...DEFAULT_SETTINGS },
  log: [{ id: 'synthetic-meal', time: 1700000000000, carbs: 60, bolus: 6, bg: 110 }],
  foods: { customFoods: [{ id: 'custom-synthetic', name: 'Synthetic', category: 'Özel', carbsPer100: 15, portions: [{ label: 'Porsiyon', grams: 100 }], custom: true }], favorites: ['custom-synthetic'], meals: [{ id: 'saved-synthetic', name: 'Synthetic meal', items: [{ id: 'item-synthetic', foodId: 'custom-synthetic', name: 'Synthetic', grams: 100, carbs: 15 }] }] },
  ratioHistory: [{ time: 1700000000000, blockId: DEFAULT_SETTINGS.blocks[0].id, blockName: 'Sabah', field: 'icr', from: 10, to: 12, source: 'Synthetic' }],
  tests: { active: { kind: 'icr', entryId: 'synthetic-meal', startTime: 1700000000000 }, finished: [{ kind: 'basal', startTime: 1700000000000, endTime: 1700000001000 }] },
});

describe('backup validation boundary', () => {
  it('round trips a fully structured synthetic v2 backup', () => {
    const source = fixture();
    const result = parseBackup(JSON.stringify(source), DEFAULT_SETTINGS);
    expect(result.log).toEqual(source.log);
    expect(result.foods).toEqual(source.foods);
    expect(result.tests).toEqual(source.tests);
    expect(result.ratioHistory).toEqual(source.ratioHistory);
    expect(result.settings.blocks).toEqual(source.settings.blocks);
  });
  it('supports v1 missing optional settings and optional collections', () => {
    const result = parseBackup(JSON.stringify({ app: 'diyabet-asistani', version: 1, settings: { blocks: DEFAULT_SETTINGS.blocks }, log: [] }), DEFAULT_SETTINGS);
    expect(result.settings.mealStarts).toEqual(DEFAULT_SETTINGS.mealStarts);
    expect(result.settings.exercise).toEqual(DEFAULT_SETTINGS.exercise);
    expect(result.foods).toEqual({ customFoods: [], favorites: [], meals: [] });
    expect(result.tests).toEqual({ active: null, finished: [] });
    expect(result.ratioHistory).toEqual([]);
  });
  it.each([3, 999, -1, '2', null])('rejects unsupported version %p', (version) => {
    expect(() => parseBackup(JSON.stringify({ ...fixture(), version }), DEFAULT_SETTINGS)).toThrow();
  });
  it.each([
    { log: [null] }, { log: [{ id: 'bad', time: 'yesterday' }] },
    { log: [{ id: 'bad', time: 1700000000000, bolus: -1 }] },
    { foods: { customFoods: {}, favorites: [], meals: [] } },
    { foods: { customFoods: null, favorites: [], meals: [] } },
    { foods: { customFoods: [{ id: 'custom-empty', name: 'Synthetic', category: 'Özel', carbsPer100: 15, portions: [] }], favorites: [], meals: [] } },
    { foods: { customFoods: [], favorites: [null], meals: [] } },
    { foods: { customFoods: [], favorites: [], meals: [{ id: 'bad', name: 'bad', items: [null] }] } },
    { tests: { active: { kind: 'unknown', startTime: 1700000000000 }, finished: [] } },
    { tests: { active: null, finished: [{ kind: 'basal', startTime: 2000, endTime: 1000 }] } },
    { ratioHistory: [{ time: 1700000000000, blockName: 'bad', field: 'bad', from: 10, to: 0, source: 'bad' }] },
    { ratioHistory: null },
  ])('rejects malformed nested collections %p', (patch) => {
    expect(() => parseBackup(JSON.stringify({ ...fixture(), ...patch }), DEFAULT_SETTINGS)).toThrow();
  });
  it.each([
    { blocks: {} }, { blocks: [] }, { blocks: [{ ...DEFAULT_SETTINGS.blocks[0], icr: 0 }] },
    { dia: null }, { peak: '75' }, { penStep: 0 }, { exercise: { light: -1 } },
    { mealStarts: { sabah: null } }, { fastingRange: { low: 200, high: 80 } },
    { countMethod: 'wrong' }, { basalTime: '25:00' }, { basalReminder: 'true' },
  ])('rejects invalid settings %p', (patch) => {
    expect(() => parseBackup(JSON.stringify({ ...fixture(), settings: { ...DEFAULT_SETTINGS, ...patch } }), DEFAULT_SETTINGS)).toThrow();
  });
  it('rejects duplicates and never mutates supplied defaults', () => {
    const before = JSON.stringify(DEFAULT_SETTINGS);
    const source = fixture();
    source.log.push({ ...source.log[0] });
    expect(() => parseBackup(JSON.stringify(source), DEFAULT_SETTINGS)).toThrow();
    expect(JSON.stringify(DEFAULT_SETTINGS)).toBe(before);
  });
  it('rejects malformed JSON with a readable error', () => {
    expect(() => parseBackup('{', DEFAULT_SETTINGS)).toThrow('Yedek');
  });
  it('preserves negative reverse-correction components while rejecting negative administered insulin', () => {
    const source = fixture();
    const calculation = calcBolus({ bg: 90, carbs: 60, block: source.settings.blocks[0], iob: 0, cob: 0, settings: source.settings });
    expect(calculation.correction).toBeLessThan(0);
    const log = [{ ...source.log[0], bg: 90, bolus: calculation.dose, mealBolus: calculation.meal, correctionBolus: calculation.correction }];
    expect(parseBackup(JSON.stringify({ ...source, log }), DEFAULT_SETTINGS).log[0]).toEqual(log[0]);
  });
});
