import { calcBolus, carbsForDose } from '../bolus';
import { hypoRiseSamples } from '../hypo';
import { DEFAULT_MEAL_STARTS } from '../meals';
import { activeCountdownMeal } from '../postmeal';
import { mealStats } from '../report';
import { computeStats } from '../stats';
import type { LogEntry, Settings, TimeBlock } from '../types';

const MIN = 60000;
const time = new Date(2026, 9, 15, 12).getTime();
const block: TimeBlock = { id: 'lunch', name: 'Öğle', start: '00:00', icr: 10, isf: 40, target: 110, low: 80, high: 180 };
const profile = { dia: 4, peak: 75 };
const settings: Settings = {
  blocks: [block], ...profile, rapidName: '', basalName: '', penStep: 1, maxBolus: 20,
  reverseCorrection: true, basalDose: 0, basalTime: '22:00', basalReminder: false,
  exercise: { light: 25, moderate: 50, intense: 75 }, hypoThreshold: 70,
  severeHypoThreshold: 54, hyperThreshold: 250, onboarded: true, ratioSource: 'doctor',
  countMethod: 'exchange', mealStarts: DEFAULT_MEAL_STARTS, tabletG: 4,
  fastingRange: { low: 80, high: 130 }, postRange: { low: 80, high: 180 },
};
const treatment: LogEntry = { id: 'treatment', time, bg: 60, hypoCarbs: 15 };
const check: LogEntry = { id: 'check', time: time + 15 * MIN, bg: 100 };

describe('application logic regressions', () => {
  it('counts low readings by measurement time and treatment separately at its own time', () => {
    const first: LogEntry = { id: 'first', time, bg: 60 };
    const delayed: LogEntry = { id: 'delayed', time: time + 120 * MIN, bgTime: time + 15 * MIN, bg: 60 };
    expect(computeStats([first, delayed], [block], 70).hypos).toBe(1);
    expect(computeStats([first, { ...delayed, hypoCarbs: 15 }], [block], 70).hypos).toBe(2);
    expect(computeStats([{ ...first, hypoCarbs: 15 }], [block], 70).hypos).toBe(1);
  });
  it('uses the actual hypo check time even when saved after the check window', () => {
    const samples = hypoRiseSamples([treatment, { ...check, time: time + 60 * MIN, bgTime: check.time }], [block], profile);
    expect(samples).toHaveLength(1);
    expect(samples[0].rise).toBeCloseTo(40 / 15);
  });
  it('rejects a check measured before the hypo check window despite its later save time', () => {
    expect(hypoRiseSamples([treatment, { ...check, bgTime: time + 5 * MIN }], [block], profile)).toEqual([]);
  });
  it('does not let a dose given after the check change its learned response', () => {
    const prior: LogEntry = { id: 'prior', time: time - 60 * MIN, bolus: 4 };
    const samples = hypoRiseSamples([prior, treatment, { ...check, bolus: 2 }], [block], profile);
    expect(samples).toHaveLength(1);
    expect(samples[0].rise).toBeCloseTo(3.7626545809547367);
  });
  it('uses the actual check time to distinguish intervention before and after measurement', () => {
    const snack: LogEntry = { id: 'snack', time: time + 20 * MIN, carbs: 20 };
    const saved: LogEntry = { ...check, time: time + 60 * MIN, bgTime: check.time };
    expect(hypoRiseSamples([treatment, snack, saved], [block], profile)).toHaveLength(1);
    expect(hypoRiseSamples([treatment, snack, { ...saved, bgTime: time + 25 * MIN }], [block], profile)).toEqual([]);
  });
  it('attributes linked post-meal readings to the source meal even if recorded in another meal slot', () => {
    const lunch: LogEntry = { id: 'lunch', time, bg: 100, carbs: 50, meal: 'ogle' };
    const post: LogEntry = { id: 'post', time: time + 180 * MIN, bg: 190, post: true, afterId: lunch.id, meal: 'ogleAra' };
    const stats = mealStats([lunch, post], settings);
    expect(stats.find((s) => s.meal === 'ogle')).toMatchObject({ count: 2, pairs: 1, avgBgAfter: 190, avgRise: 90 });
    expect(stats.find((s) => s.meal === 'ogleAra')).toMatchObject({ count: 0, pairs: 0 });
  });
  it('retains active-insulin and recent-dose warnings in reverse calculations without duplicates', () => {
    const input = { bg: 110, block, iob: 2, cob: 0, settings, minutesSinceLastBolus: 30 };
    expect(carbsForDose({ ...input, units: 3 }).warnings).toEqual(calcBolus({ ...input, carbs: 0 }).warnings);
    const unknown = carbsForDose({ ...input, bg: undefined, units: 3 });
    expect(unknown.warnings.filter((w) => w.text.includes('Şeker girilmedi'))).toHaveLength(1);
  });
  it('does not let a future meal replace a current countdown', () => {
    const current: LogEntry = { id: 'current', time: time - 30 * MIN, carbs: 50 };
    const future: LogEntry = { id: 'future', time: time + 60 * MIN, carbs: 50 };
    expect(activeCountdownMeal([current, future], time)?.id).toBe('current');
    expect(activeCountdownMeal([future], time)).toBeUndefined();
  });
});
