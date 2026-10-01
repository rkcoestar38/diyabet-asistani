import {
  calcBolus,
  carbsForDose,
  carbsToTarget,
  checkBg,
  hypoPlan,
  roundToStep,
} from '../bolus';
import { carbsOnBoard, insulinOnBoard, iobFraction, recentBolus } from '../iob';
import { analyzeIcr, analyzeIsf, averageTdd, basalTestResult, estimateFromTdd, icrSample, isfSample } from '../ratios';
import { computeStats } from '../stats';
import { activeBlock, blockEnd, blockProblems, inLimit, parseHHMM, scheduleProblems } from '../schedule';
import { awaitingPost, mealBefore, postOf } from '../postmeal';
import { assessHypo, chooseRise, followUpSnack, hypoRiseSamples, personalRise, quickCarbOptions } from '../hypo';
import type { LogEntry, Settings, TimeBlock } from '../types';

const block: TimeBlock = { id: 'b', name: 'Öğle', start: '11:00', icr: 10, isf: 40, target: 110, low: 80, high: 140 };

const settings: Settings = {
  blocks: [block],
  rapidName: 'NovoRapid',
  dia: 4,
  peak: 75,
  penStep: 0.5,
  maxBolus: 15,
  reverseCorrection: true,
  basalName: 'Tresiba',
  basalDose: 20,
  basalTime: '22:00',
  basalReminder: false,
  exercise: { light: 25, moderate: 50, intense: 75 },
  hypoThreshold: 70,
  severeHypoThreshold: 54,
  hyperThreshold: 250,
  onboarded: true,
  ratioSource: 'doctor',
  tabletG: 4,
  mealStarts: { gece: '00:00', sabah: '06:00', sabahAra: '09:30', ogle: '12:00', ogleAra: '15:00', aksam: '18:30', aksamAra: '21:00' },
  countMethod: 'exchange',
};
const profile = { dia: 4, peak: 75 };

describe('roundToStep', () => {
  it('rounds to nearest step, ties down', () => {
    expect(roundToStep(7.75, 0.5)).toBe(7.5);
    expect(roundToStep(7.76, 0.5)).toBe(8);
    expect(roundToStep(7.2, 0.5)).toBe(7);
    expect(roundToStep(7.5, 1)).toBe(7);
    expect(roundToStep(7.6, 1)).toBe(8);
  });
  it('never returns negative', () => {
    expect(roundToStep(-2, 0.5)).toBe(0);
    expect(roundToStep(NaN, 0.5)).toBe(0);
  });
});

describe('calcBolus', () => {
  it('meal + correction (plan example)', () => {
    const r = calcBolus({ bg: 180, carbs: 60, block, iob: 0, settings });
    expect(r.status).toBe('ok');
    expect(r.meal).toBe(6);
    expect(r.correction).toBeCloseTo(1.75);
    expect(r.raw).toBeCloseTo(7.75);
    expect(r.dose).toBe(7.5);
  });

  it('meal insulin still covering digesting carbs only cancels the correction', () => {
    // 3 Ü aktif insülin, 30 g henüz emilmemiş karbonhidratı karşılıyor
    const r = calcBolus({ bg: 180, carbs: 60, block, iob: 3, cob: 30, settings });
    expect(r.iobUsed).toBeCloseTo(1.75);
    expect(r.correction).toBe(0);
    expect(r.dose).toBe(6);
  });

  it('insulin not covered by carbs is subtracted from the meal dose too', () => {
    const r = calcBolus({ bg: 180, carbs: 60, block, iob: 3, cob: 0, settings });
    expect(r.iobUsed).toBeCloseTo(3);
    expect(r.raw).toBeCloseTo(4.75);
  });

  it('bug 1: below target with uncovered IOB the dose is reduced', () => {
    // şeker 100, yemeksiz vurulmuş 3 Ü hâlâ etkili, 40 g yenecek → 4 − 0,25 − 3 = 0,75
    const r = calcBolus({ bg: 100, carbs: 40, block, iob: 3, cob: 0, settings });
    expect(r.raw).toBeCloseTo(0.75);
    expect(r.dose).toBe(0.5);
  });

  it('partial IOB reduces correction', () => {
    const r = calcBolus({ bg: 190, carbs: 0, block, iob: 1, settings });
    expect(r.correction).toBeCloseTo(1);
    expect(r.dose).toBe(1);
  });

  it('reverse correction lowers meal dose when below target', () => {
    const r = calcBolus({ bg: 90, carbs: 50, block, iob: 0, settings });
    expect(r.correction).toBeCloseTo(-0.5);
    expect(r.dose).toBe(4.5);
    const off = calcBolus({ bg: 90, carbs: 50, block, iob: 0, settings: { ...settings, reverseCorrection: false } });
    expect(off.dose).toBe(5);
  });

  it('never negative', () => {
    expect(calcBolus({ bg: 75, carbs: 0, block, iob: 0, settings }).dose).toBe(0);
  });

  it('blocks dosing when hypo', () => {
    const r = calcBolus({ bg: 65, carbs: 60, block, iob: 0, settings });
    expect(r.status).toBe('hypo');
    expect(r.dose).toBe(0);
    expect(r.warnings[0].level).toBe('danger');
  });

  it('rejects out of range input', () => {
    expect(calcBolus({ bg: 700, carbs: 10, block, iob: 0, settings }).status).toBe('invalid');
    expect(calcBolus({ bg: 120, carbs: 400, block, iob: 0, settings }).status).toBe('invalid');
    expect(calcBolus({ bg: 120, carbs: -5, block, iob: 0, settings }).status).toBe('invalid');
  });

  it('applies exercise reduction to total', () => {
    const r = calcBolus({ bg: 110, carbs: 60, block, iob: 0, settings, exercise: 'moderate' });
    expect(r.exerciseCut).toBeCloseTo(3);
    expect(r.dose).toBe(3);
  });

  it('warns above max bolus', () => {
    const r = calcBolus({ bg: 110, carbs: 200, block, iob: 0, settings });
    expect(r.dose).toBe(20);
    expect(r.warnings.some((w) => w.level === 'danger' && w.text.includes('azami'))).toBe(true);
  });

  it('warns on hyperglycemia / ketones', () => {
    const r = calcBolus({ bg: 300, carbs: 0, block, iob: 0, settings });
    expect(r.warnings.some((w) => w.text.includes('Keton'))).toBe(true);
  });

  it('warns about stacking and low eventual BG', () => {
    const r = calcBolus({ bg: 120, carbs: 0, block, iob: 2, settings, minutesSinceLastBolus: 45 });
    expect(r.eventualBg).toBe(40);
    expect(r.warnings.some((w) => w.text.includes('yığılma'))).toBe(true);
    expect(r.warnings.some((w) => w.text.includes('inebilir'))).toBe(true);
  });

  it('works without BG (meal only, with warning)', () => {
    const r = calcBolus({ carbs: 45, block, iob: 0, settings });
    expect(r.dose).toBe(4.5);
    expect(r.warnings[0].level).toBe('warn');
  });
});

describe('carbsForDose', () => {
  it('inverse of meal dose at target', () => {
    expect(carbsForDose({ units: 5, bg: 110, block, iob: 0, settings }).carbs).toBe(50);
  });
  it('reserves part of dose for correction', () => {
    expect(carbsForDose({ units: 5, bg: 190, block, iob: 0, settings }).carbs).toBe(30);
  });
  it('allows more carbs when below target', () => {
    expect(carbsForDose({ units: 5, bg: 90, block, iob: 0, settings }).carbs).toBe(55);
  });
  it('accounts for exercise', () => {
    expect(carbsForDose({ units: 3, bg: 110, block, iob: 0, settings, exercise: 'moderate' }).carbs).toBe(60);
  });
  it('round-trips with calcBolus', () => {
    const r = carbsForDose({ units: 6, bg: 160, block, iob: 0.5, settings });
    const back = calcBolus({ bg: 160, carbs: r.carbs, block, iob: 0.5, settings });
    expect(back.raw).toBeLessThanOrEqual(6);
    expect(back.raw).toBeGreaterThan(5.8);
  });
  it('blocks when hypo', () => {
    expect(carbsForDose({ units: 3, bg: 60, block, iob: 0, settings }).status).toBe('hypo');
  });
});

describe('carbsToTarget / hypoPlan', () => {
  it('1 g raises isf/icr mg/dL', () => {
    // 4 mg/dL per gram, need +30 → 7.5 g → 10 g (5 g steps)
    expect(carbsToTarget(80, block, 0)).toEqual({ eventualBg: 80, carbs: 10, carbsForIob: 0 });
  });
  it('adds carbs for active insulin', () => {
    const p = carbsToTarget(100, block, 1);
    expect(p.eventualBg).toBe(60);
    expect(p.carbs).toBe(15); // (110-60)/4 = 12.5 → 15
    expect(p.carbsForIob).toBe(10);
  });
  it('hypo plan: at least 15 g; 20 g if severe; more with IOB', () => {
    expect(hypoPlan(65, block, 0, settings)).toMatchObject({ severe: false, carbsNow: 15, carbsWithIob: 15 });
    expect(hypoPlan(50, block, 0, settings).carbsNow).toBe(20);
    expect(hypoPlan(65, block, 2, settings).carbsWithIob).toBe(35); // (110-(-15))/4=31.25 → 35
  });
  it('checkBg thresholds', () => {
    expect(checkBg(69, settings).kind).toBe('hypo');
    expect(checkBg(70, settings).kind).toBe('ok');
    expect(checkBg(53, settings)).toMatchObject({ kind: 'hypo', severe: true });
    expect(checkBg(10, settings).kind).toBe('invalid');
  });
});

describe('iob', () => {
  it('starts at 1, decreases monotonically, ends at 0', () => {
    expect(iobFraction(0, profile)).toBe(1);
    expect(iobFraction(240, profile)).toBe(0);
    let prev = 1;
    for (let t = 10; t <= 240; t += 10) {
      const f = iobFraction(t, profile);
      expect(f).toBeLessThanOrEqual(prev);
      prev = f;
    }
    const twoHours = iobFraction(120, profile);
    expect(twoHours).toBeGreaterThan(0.3);
    expect(twoHours).toBeLessThan(0.6);
  });
  it('sums bolus entries', () => {
    const now = Date.now();
    const log: LogEntry[] = [
      { id: '1', time: now - 5 * 3600000, bolus: 10 },
      { id: '2', time: now, bolus: 4 },
      { id: '3', time: now - 30 * 60000, basal: 20 },
    ];
    expect(insulinOnBoard(log, now, profile)).toBeCloseTo(4);
    expect(recentBolus(log, now, 120)?.id).toBe('2');
  });
});

describe('schedule', () => {
  const blocks: TimeBlock[] = [
    { ...block, id: 'sabah', start: '06:00' },
    { ...block, id: 'ogle', start: '11:00' },
    { ...block, id: 'aksam', start: '17:00' },
    { ...block, id: 'gece', start: '22:00' },
  ];
  const at = (h: number, m = 0) => new Date(2026, 9, 1, h, m);
  it('selects block by time and wraps midnight', () => {
    expect(activeBlock(blocks, at(7))?.id).toBe('sabah');
    expect(activeBlock(blocks, at(11))?.id).toBe('ogle');
    expect(activeBlock(blocks, at(10, 59))?.id).toBe('sabah');
    expect(activeBlock(blocks, at(23))?.id).toBe('gece');
    expect(activeBlock(blocks, at(2))?.id).toBe('gece');
    expect(blockEnd(blocks, blocks[3])).toBe('06:00');
  });
  it('validates', () => {
    expect(parseHHMM('25:00')).toBeNaN();
    expect(blockProblems(block)).toEqual([]);
    expect(blockProblems({ ...block, icr: 0 }).length).toBe(1);
  });
});

describe('ratios', () => {
  it('500/1800 rules', () => {
    // 500/40 = 12,5 → 13 (yukarı, daha az insülin); 1800/40 = 45
    expect(estimateFromTdd(40)).toEqual({ icr: 13, isf: 45, basalLow: 16, basalHigh: 20 });
    expect(estimateFromTdd(45)?.isf).toBe(40);
    expect(estimateFromTdd(50)?.isf).toBe(40);
    expect(estimateFromTdd(0)).toBeUndefined();
  });

  it('average TDD only from days with basal and bolus', () => {
    const d = (day: number, h: number) => new Date(2026, 8, day, h).getTime();
    const log: LogEntry[] = [
      { id: 'a', time: d(28, 8), bolus: 10 },
      { id: 'b', time: d(28, 22), basal: 20 },
      { id: 'c', time: d(29, 8), bolus: 20 },
      { id: 'd', time: d(29, 22), basal: 20 },
      { id: 'e', time: d(30, 8), bolus: 5 },
    ];
    expect(averageTdd(log, d(30, 23), 7)).toEqual({ tdd: 35, days: 2 });
  });

  const blocks = [block];
  const meal = (day: number, post: number, extra: Partial<LogEntry> = {}): LogEntry[] => {
    const t = new Date(2026, 8, day, 12).getTime();
    return [
      { id: `m${day}`, time: t, bg: 110, carbs: 60, bolus: 6, ...extra },
      { id: `p${day}`, time: t + 4 * 3600000, bg: post },
    ];
  };

  it('no suggestion with fewer than 3 samples', () => {
    const s = analyzeIcr([...meal(1, 110), ...meal(2, 110)], blocks, profile);
    expect(s[0].samples).toHaveLength(2);
    expect(s[0].suggested).toBeUndefined();
  });

  it('keeps ratio when post-meal returns to target', () => {
    const s = analyzeIcr([...meal(1, 110), ...meal(2, 110), ...meal(3, 110)], blocks, profile);
    expect(s[0].observed).toBeCloseTo(10);
    expect(s[0].suggested).toBe(10);
  });

  it('suggests stronger ratio when consistently high, capped at 20%', () => {
    // post 190 → needed +2 U → 60 g / 8 U = 7.5 g/U, capped to 8
    const s = analyzeIcr([...meal(1, 190), ...meal(2, 190), ...meal(3, 190)], blocks, profile);
    expect(s[0].observed).toBeCloseTo(7.5);
    expect(s[0].suggested).toBe(8);
  });

  it('ignores meals with exercise, hypo or intervening dose', () => {
    const t = new Date(2026, 8, 4, 12).getTime();
    const log = [
      ...meal(1, 190, { exercise: 'moderate' }),
      ...meal(2, 190),
      { id: 'x', time: new Date(2026, 8, 2, 13).getTime(), bolus: 1 },
      ...meal(3, 190, { bg: 200 }),
      { id: 'y', time: t, bg: 110, carbs: 60, bolus: 6 },
    ];
    expect(analyzeIcr(log, blocks, profile)[0].samples).toHaveLength(0);
  });

  it('ISF from correction-only doses', () => {
    const corr = (day: number, post: number): LogEntry[] => {
      const t = new Date(2026, 8, day, 15).getTime();
      return [
        { id: `c${day}`, time: t, bg: 230, bolus: 3 },
        { id: `q${day}`, time: t + 5 * 3600000, bg: post },
      ];
    };
    const s = analyzeIsf([...corr(1, 110), ...corr(2, 110), ...corr(3, 110)], blocks, profile);
    expect(s[0].observed).toBeCloseTo(40);
    expect(s[0].suggested).toBe(40);
    const weak = analyzeIsf([...corr(1, 170), ...corr(2, 170), ...corr(3, 170)], blocks, profile);
    expect(weak[0].observed).toBeCloseTo(20);
    expect(weak[0].suggested).toBe(32);
  });
});

describe('stats', () => {
  it('computes averages and time in range per block', () => {
    const t = (h: number) => new Date(2026, 9, 1, h).getTime();
    const log: LogEntry[] = [
      { id: '1', time: t(8), bg: 60, hypoCarbs: 15 },
      { id: '2', time: t(9), bg: 100 },
      { id: '3', time: t(12), bg: 200, carbs: 50, bolus: 6 },
      { id: '4', time: t(15), bg: 120 },
      { id: '5', time: t(22), basal: 20 },
    ];
    const s = computeStats(log, [block], 70);
    expect(s).toMatchObject({ readings: 4, avg: 120, min: 60, max: 200, inRange: 50, below: 25, above: 25, carbs: 65, bolus: 6, basal: 20, hypos: 1, days: 1 });
  });
});

describe('carbs on board', () => {
  it('decays linearly; fast carbs absorb quicker', () => {
    const now = Date.now();
    const log: LogEntry[] = [
      { id: '1', time: now - 90 * 60000, carbs: 60 },
      { id: '2', time: now - 15 * 60000, hypoCarbs: 15 },
      { id: '3', time: now - 4 * 3600000, carbs: 80 },
    ];
    expect(carbsOnBoard(log, now)).toBeCloseTo(30 + 10);
  });
  it('right after a covered meal, projection is not alarming', () => {
    // 60 g yendi ve 6 Ü vuruldu (oran 1/10, ISF 40): ikisi birbirini dengeler
    const r = calcBolus({ bg: 110, carbs: 0, block, iob: 6, cob: 60, settings });
    expect(r.eventualBg).toBe(110);
    expect(r.warnings.some((w) => w.text.includes('inebilir'))).toBe(false);
    expect(carbsToTarget(110, block, 6, 60).carbs).toBe(0);
  });
  it('active carbs reduce hypo extra carbs', () => {
    expect(hypoPlan(65, block, 2, settings, 20).carbsWithIob).toBe(15);
  });
});

describe('bug fixes', () => {
  const H = 3600000;
  const day = (d: number, h: number, m = 0) => new Date(2026, 8, d, h, m).getTime();
  const NOW = day(20, 12);

  it('bug 2: implausible ratios are rejected', () => {
    expect(inLimit('icr', 1)).toBe(false);
    expect(inLimit('icr', 10)).toBe(true);
    expect(inLimit('isf', 4)).toBe(false);
    expect(blockProblems({ ...block, icr: 1 }).length).toBe(1);
  });

  it('bug 3: remaining carbs are accounted for — a correct ratio is recognised at any time in the window', () => {
    // Doğru oranla (1 Ü = 10 g) modelin öngördüğü şeker: hedef + emilen KH etkisi − etki eden insülin
    for (const minutes of [150, 180, 240]) {
      const absorbed = Math.min(1, minutes / 180);
      const acted = 1 - iobFraction(minutes, profile);
      const post = 110 + 60 * absorbed * 4 - 6 * acted * 40;
      const log: LogEntry[] = [];
      for (let d = 1; d <= 3; d++) {
        log.push({ id: `m${d}`, time: day(d, 12), bg: 110, carbs: 60, bolus: 6 });
        log.push({ id: `p${d}`, time: day(d, 12) + minutes * 60000, bg: post });
      }
      expect(analyzeIcr(log, [block], profile, NOW)[0].observed).toBeCloseTo(10, 0);
    }
  });

  it('bug 3b: readings earlier than 2.5 hours are not used', () => {
    const log: LogEntry[] = [
      { id: 'm', time: day(1, 12), bg: 110, carbs: 60, bolus: 6 },
      { id: 'p', time: day(1, 14), bg: 150 },
    ];
    expect(icrSample(log, 'm', [block], profile, NOW).ok).toBe(false);
  });

  it('bug 4: meals with insulin still active from an earlier dose are excluded, with a reason', () => {
    const log: LogEntry[] = [
      { id: 'c', time: day(1, 12, 30), bg: 200, bolus: 3 },
      { id: 'm', time: day(1, 13), bg: 130, carbs: 60, bolus: 6 },
      { id: 'p', time: day(1, 16), bg: 90 },
    ];
    const r = icrSample(log, 'm', [block], profile, NOW);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/insülin/);
  });

  it('bug 5: the next meal’s pre-meal reading counts as the follow-up', () => {
    const log: LogEntry[] = [];
    for (let d = 1; d <= 3; d++) {
      log.push({ id: `m${d}`, time: day(d, 12), bg: 110, carbs: 60, bolus: 6 });
      log.push({ id: `n${d}`, time: day(d, 15), bg: 110, carbs: 20, bolus: 2 });
    }
    const s = analyzeIcr(log, [block], profile, NOW)[0];
    expect(s.samples.length).toBeGreaterThanOrEqual(3);
  });

  it('bug 5b: an intervention before the window invalidates the sample', () => {
    const log: LogEntry[] = [
      { id: 'm', time: day(1, 12), bg: 110, carbs: 60, bolus: 6 },
      { id: 'x', time: day(1, 13), bg: 160, carbs: 20, bolus: 2 },
      { id: 'p', time: day(1, 15), bg: 120 },
    ];
    expect(icrSample(log, 'm', [block], profile, NOW).ok).toBe(false);
  });

  it('pending test reports how long to wait', () => {
    const log: LogEntry[] = [{ id: 'm', time: day(1, 12), bg: 110, carbs: 60, bolus: 6 }];
    const r = icrSample(log, 'm', [block], profile, day(1, 13));
    expect(r).toMatchObject({ ok: false, pending: true });
    expect(!r.ok && r.reason).toMatch(/90 dk/);
  });

  it('ISF sample from a clean correction', () => {
    const log: LogEntry[] = [
      { id: 'c', time: day(1, 16), bg: 230, bolus: 3 },
      { id: 'p', time: day(1, 21), bg: 110 },
    ];
    const r = isfSample(log, 'c', [block], profile, NOW);
    expect(r.ok && r.sample.value).toBeCloseTo(40);
  });

  it('bug 6: today’s partial day is excluded from average TDD', () => {
    const log: LogEntry[] = [
      { id: 'a', time: day(30, 8), bolus: 20 },
      { id: 'b', time: day(30, 22), basal: 20 },
      { id: 'c', time: new Date(2026, 9, 1, 8).getTime(), bolus: 5 },
      { id: 'd', time: new Date(2026, 9, 1, 8, 5).getTime(), basal: 20 },
    ];
    expect(averageTdd(log, new Date(2026, 9, 1, 9).getTime(), 7)).toEqual({ tdd: 40, days: 1 });
  });

  it('bug 7: duplicate start times are reported', () => {
    const p = scheduleProblems([block, { ...block, id: 'x', name: 'Kopya' }]);
    expect(p.some((x) => x.includes('aynı saatte'))).toBe(true);
    expect(scheduleProblems([block])).toEqual([]);
  });

  it('bug 8: a two-round hypo is one episode', () => {
    const t = day(1, 3);
    const log: LogEntry[] = [
      { id: '1', time: t, bg: 60, hypoCarbs: 15 },
      { id: '2', time: t + 15 * 60000, bg: 65, note: 'Hipo kontrol ölçümü' },
      { id: '3', time: t + 15 * 60000 + 5000, hypoCarbs: 15 },
      { id: '4', time: t + 30 * 60000, bg: 95 },
      { id: '5', time: t + 6 * H, bg: 62, hypoCarbs: 15 },
    ];
    expect(computeStats(log, [block], 70).hypos).toBe(2);
  });

  it('bug 9: days with data are counted for per-day averages', () => {
    const log: LogEntry[] = [
      { id: '1', time: day(1, 8), carbs: 50 },
      { id: '2', time: day(1, 12), carbs: 50 },
      { id: '3', time: day(3, 8), carbs: 100 },
    ];
    expect(computeStats(log, [block], 70).days).toBe(2);
  });

  it('bug 13: target must be inside the target range', () => {
    expect(blockProblems({ ...block, target: 150 })).toContain('Hedef şeker, hedef aralığın içinde olmalı');
  });

  it('basal test: drift and broken tests', () => {
    const s = day(1, 22);
    const ok = basalTestResult(
      [
        { id: '1', time: s, bg: 140 },
        { id: '2', time: s + 5 * H, bg: 120 },
        { id: '3', time: s + 9 * H, bg: 130 },
      ],
      s,
      s + 10 * H,
    );
    expect(ok).toMatchObject({ drift: -10, verdict: 'ok' });
    const falling = basalTestResult(
      [
        { id: '1', time: s, bg: 160 },
        { id: '2', time: s + 8 * H, bg: 90 },
      ],
      s,
      s + 10 * H,
    );
    expect(falling.verdict).toBe('falling');
    const broken = basalTestResult([{ id: '1', time: s, bg: 140 }, { id: '2', time: s + H, hypoCarbs: 15 }], s, s + 10 * H);
    expect(broken.broken).toMatch(/hipo/);
  });
});

describe('input formatting', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const inp = require('../../lib/input') as typeof import('../../lib/input');
  it('formats time as you type', () => {
    expect(inp.formatTimeInput('1')).toBe('1');
    expect(inp.formatTimeInput('9')).toBe('09');
    expect(inp.formatTimeInput('093')).toBe('09:3');
    expect(inp.formatTimeInput('0930')).toBe('09:30');
    expect(inp.formatTimeInput('1745')).toBe('17:45');
    expect(inp.formatTimeInput('17:45')).toBe('17:45');
    expect(inp.formatTimeInput('2999')).toBe('23:59');
    expect(inp.formatTimeInput('1275')).toBe('12:55');
    expect(inp.formatTimeInput('abc')).toBe('');
  });
  it('parses time', () => {
    expect(inp.parseTimeInput('07:05')).toBe(425);
    expect(inp.parseTimeInput('7:05')).toBeUndefined();
    expect(inp.parseTimeInput('24:00')).toBeUndefined();
  });
  it('formats and parses dates', () => {
    expect(inp.formatDateInput('01102026')).toBe('01.10.2026');
    expect(inp.formatDateInput('011')).toBe('01.1');
    expect(inp.parseDateInput('01.10.2026')).toBe(new Date(2026, 9, 1).getTime());
    expect(inp.parseDateInput('31.02.2026')).toBeUndefined();
    expect(inp.toDateInput(new Date(2026, 9, 1, 15).getTime())).toBe('01.10.2026');
  });
});

describe('doctor report', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const rep = require('../report') as typeof import('../report');
  const day = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime();
  const entries: LogEntry[] = [
    { id: '1', time: day(1, 7, 30), bg: 128 },
    { id: '2', time: day(1, 8), bg: 112, carbs: 55, bolus: 5.5, foods: 'Simit 100 g & ayran' },
    { id: '3', time: day(1, 13), bg: 62, hypoCarbs: 15, note: 'Hipo tedavisi' },
    { id: '4', time: day(2, 22), basal: 20 },
    { id: '5', time: day(5, 9), bg: 300 },
  ];
  it('includes every value the doctor needs, only within range', () => {
    const html = rep.buildReportHtml({ entries, settings: { ...settings, patientName: 'Test Kişi' }, from: day(1, 0), to: day(3, 0), generatedAt: day(3, 12) });
    expect(html).toContain('Test Kişi');
    expect(html).toContain('07:30');
    expect(html).toContain('Simit 100 g &amp; ayran');
    expect(html).toContain('1 Ü = 10 g');
    expect(html).toContain('NovoRapid');
    expect(html).toContain('Tresiba');
    expect(html).toContain('<svg');
    expect(html).toContain('Hipo tedavisi 15 g');
    expect(html).not.toContain('>300<');
  });
  it('computes range stats and handles an empty range', () => {
    const s = rep.rangeStats(entries.slice(0, 4), settings, day(10, 12));
    expect(s.days).toBe(2);
    expect(s.avgBasalPerDay).toBe(10);
    expect(rep.buildReportHtml({ entries: [], settings, from: day(1, 0), to: day(2, 0) })).toContain('Bu aralıkta kayıt yok');
  });
});

describe('meals and measurement time', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require('../meals') as typeof import('../meals');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bt = require('../bgtime') as typeof import('../bgtime');
  const at = (h: number, min = 0) => new Date(2026, 9, 1, h, min).getTime();
  const S = m.DEFAULT_MEAL_STARTS;

  it('picks the meal from the time of day and wraps midnight', () => {
    expect(m.mealAt(at(7), S)).toBe('sabah');
    expect(m.mealAt(at(10), S)).toBe('sabahAra');
    expect(m.mealAt(at(12, 30), S)).toBe('ogle');
    expect(m.mealAt(at(16), S)).toBe('ogleAra');
    expect(m.mealAt(at(19), S)).toBe('aksam');
    expect(m.mealAt(at(22), S)).toBe('aksamAra');
    expect(m.mealAt(at(3), S)).toBe('gece');
    expect(m.mealAt(at(0, 0), S)).toBe('gece');
    expect(m.mealAt(at(5, 59), S)).toBe('gece');
    expect(m.mealAt(at(6), S)).toBe('sabah');
  });
  it('respects custom start times and explicit entry meal', () => {
    const custom = { ...S, sabah: '08:00' };
    expect(m.mealAt(at(7), custom)).toBe('gece');
    expect(m.entryMeal({ id: 'x', time: at(7), meal: 'ogle' }, S)).toBe('ogle');
    expect(m.entryMeal({ id: 'x', time: at(7) }, S)).toBe('sabah');
    expect(m.mealRange('sabah', S)).toBe('06:00–09:30');
    expect(m.mealRange('aksamAra', S)).toBe('21:00–00:00');
  });
  it('finds the same meal on previous days', () => {
    const item = { foodId: 'f', name: 'Simit', grams: 100, carbs: 55 };
    const entries: LogEntry[] = [
      { id: '1', time: new Date(2026, 8, 29, 7).getTime(), items: [item] },
      { id: '2', time: new Date(2026, 8, 30, 8).getTime(), items: [item] },
      { id: '3', time: new Date(2026, 8, 30, 13).getTime(), items: [item] },
      { id: '4', time: new Date(2026, 8, 30, 8, 30).getTime(), items: [item] },
    ];
    const r = m.previousMeals(entries, 'sabah', S, at(7));
    expect(r.map((e) => e.id)).toEqual(['4', '1']);
  });

  const block1: TimeBlock = { id: 'b', name: 'x', start: '00:00', icr: 10, isf: 40, target: 110, low: 80, high: 140 };
  it('no adjustment for fresh readings', () => {
    expect(bt.estimateBgAt(150, at(12), at(12, 3), [], block1, profile)).toMatchObject({ value: 150, shift: 0 });
  });
  it('insulin taken after the reading lowers the estimate', () => {
    const e = bt.estimateBgAt(180, at(12), at(12, 30), [{ id: 'b', time: at(12, 10), bolus: 4 }], block1, profile);
    expect(e.value).toBeLessThan(180);
    expect(e.shift).toBeLessThan(0);
  });
  it('carbs eaten after the reading raise it; unrelated old doses decay in between', () => {
    const up = bt.estimateBgAt(100, at(12), at(12, 60), [{ id: 'c', time: at(12, 5), carbs: 60 }], block1, profile);
    expect(up.shift).toBeGreaterThan(40);
    const decay = bt.estimateBgAt(180, at(12), at(13), [{ id: 'd', time: at(10), bolus: 3 }], block1, profile);
    expect(decay.value).toBeLessThan(180);
  });
  it('doses given before the reading do not double count', () => {
    const e = bt.estimateBgAt(150, at(12), at(12, 5), [{ id: 'd', time: at(8), bolus: 4 }], block1, profile);
    expect(Math.abs(e.shift)).toBeLessThan(6);
  });
});

describe('meal-based reporting', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const rep = require('../report') as typeof import('../report');
  const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime();
  const es: LogEntry[] = [
    { id: '1', time: at(1, 7, 40), bg: 120, bgTime: at(1, 7, 25), carbs: 50, bolus: 6, meal: 'sabah' },
    { id: '2', time: at(2, 8), bg: 140, carbs: 60, bolus: 7 },
    { id: '3', time: at(1, 10), bg: 95 },
    { id: '4', time: at(1, 13), bg: 62, hypoCarbs: 15 },
    { id: '5', time: at(1, 19), bg: 110, carbs: 70, bolus: 7, meal: 'aksam' },
  ];
  it('summarises per meal using explicit meal or time of day', () => {
    const st = rep.mealStats(es, settings);
    const by = Object.fromEntries(st.map((m) => [m.meal, m]));
    expect(by.sabah).toMatchObject({ count: 2, avgCarbs: 55, avgBolus: 6.5, avgBgBefore: 130 });
    expect(by.sabahAra.count).toBe(1);
    expect(by.ogle.hypos).toBe(1);
    expect(by.aksam.avgCarbs).toBe(70);
    expect(by.gece.count).toBe(0);
  });
  it('report shows meal, measurement time and the meal summary', () => {
    const html = rep.buildReportHtml({ entries: es, settings, from: at(1, 0), to: at(3, 0), generatedAt: at(3, 9) });
    expect(html).toContain('Öğünlere göre özet');
    expect(html).toContain('<th>Ölçüm saati</th>');
    expect(html).toContain('07:25');
    expect(html).toContain('Akşam yemeği');
  });
});

describe('update versions', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const u = require('../../lib/update') as typeof import('../../lib/update');
  it('parses and compares versions', () => {
    expect(u.parseVersion('v1.2.3')).toEqual([1, 2, 3]);
    expect(u.compareVersions('1.0.1', '1.0.0')).toBe(1);
    expect(u.compareVersions('v1.10.0', '1.9.9')).toBe(1);
    expect(u.compareVersions('1.0', '1.0.0')).toBe(0);
    expect(u.compareVersions('1.0.0', '1.0.1')).toBe(-1);
    expect(u.compareVersions('2.0.0-beta', '1.9.0')).toBe(1);
  });
});

describe('exchange list counting', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const d = require('../../data/foods-tr') as typeof import('../../data/foods-tr');
  const food = (name: string) => d.FOODS.find((f) => f.name === name)!;
  const portion = (name: string, i = 0) => food(name).portions[i];
  const ex = (name: string, i = 0) => d.carbsFor(food(name), portion(name, i).grams, 'exchange');

  it('basic exchange portions are 15 g (milk and yoghurt 10 g per glass)', () => {
    expect(ex('Beyaz ekmek')).toBeCloseTo(15);
    expect(ex('Elma')).toBeCloseTo(15);
    expect(ex('Portakal')).toBeCloseTo(15);
    expect(ex('Muz')).toBeCloseTo(15);
    expect(ex('Üzüm')).toBeCloseTo(15);
    expect(ex('Çavdar ekmeği')).toBeCloseTo(15);
    expect(ex('Simit', 0)).toBeGreaterThan(0);
    expect(d.carbsFor(food('Süt'), 200, 'exchange')).toBeCloseTo(10);
    expect(d.carbsFor(food('Yoğurt'), 200, 'exchange')).toBeCloseTo(10);
  });
  it('soups: one small bowl = one bread exchange (15 g)', () => {
    for (const n of ['Mercimek çorbası', 'Tarhana çorbası', 'Yayla çorbası', 'Ezogelin çorbası', 'Tavuk şehriye çorbası']) {
      expect(ex(n, 0)).toBeCloseTo(15);
    }
  });
  it('dietitian rules for lahmacun, wrap and hamburger', () => {
    expect(ex('Lahmacun')).toBeCloseTo(45);
    expect(ex('Tavuk döner dürüm')).toBeCloseTo(45);
    const h = ex('Hamburger');
    expect(h).toBeGreaterThanOrEqual(35);
    expect(h).toBeLessThanOrEqual(40);
  });
  it('eggs, meat, cheese and oils count as zero', () => {
    for (const n of ['Haşlanmış yumurta', 'Omlet', 'Izgara et / tavuk / balık', 'Izgara köfte', 'Tavuk sote', 'Beyaz peynir', 'Zeytin']) {
      expect(d.carbsFor(food(n), 500, 'exchange')).toBe(0);
    }
    expect(d.carbsFor(food('Haşlanmış yumurta'), 500, 'composition')).toBe(0);
  });
  it('meat rule: more than 100 g meat in one meal adds 10 g, only in exchange mode', () => {
    const m = (grams: number) => ({ meat: true, grams });
    expect(d.meatRule([m(100)])).toBe(0);
    expect(d.meatRule([m(101)])).toBe(10);
    expect(d.meatRule([m(60), m(60)])).toBe(10);
    expect(d.meatRule([m(60), { meat: false, grams: 200 }])).toBe(0);
    expect(d.meatRule([m(200)], 'composition')).toBe(0);
  });
  it('foods without a list entry fall back to real composition', () => {
    const f = food('Su böreği');
    expect(d.per100(f, 'exchange')).toBe(f.carbsPer100);
    expect(d.per100(food('Lahmacun'), 'composition')).toBe(food('Lahmacun').carbsPer100);
  });
});

describe('tokluk (yemek sonrası) şeker', () => {
  const m = (id: string, time: number, extra: object = {}) => ({ id, time, carbs: 40, bolus: 4, ...extra }) as import('../types').LogEntry;
  const t0 = 1_700_000_000_000;
  it('1–4 saat arasındaki, tokluğu girilmemiş yemeği bulur', () => {
    const log = [m('a', t0)];
    expect(awaitingPost(log, t0 + 30 * 60000)).toBeUndefined();
    expect(awaitingPost(log, t0 + 120 * 60000)?.id).toBe('a');
    expect(awaitingPost(log, t0 + 300 * 60000)).toBeUndefined();
  });
  it('tokluk girilince artık sormaz', () => {
    const log = [m('a', t0), { id: 'p', time: t0 + 7200000, bg: 150, post: true, afterId: 'a' } as import('../types').LogEntry];
    expect(postOf(log, log[0])?.id).toBe('p');
    expect(awaitingPost(log, t0 + 8000000)).toBeUndefined();
  });
  it('tokluk ölçümünü en yakın önceki yemeğe bağlar', () => {
    const log = [m('a', t0), m('b', t0 + 3600000)];
    expect(mealBefore(log, t0 + 3 * 3600000)?.id).toBe('b');
    expect(mealBefore(log, t0 + 8 * 3600000)).toBeUndefined();
  });
});

describe('klinik göstergeler ve gözlemler', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const rep = require('../report') as typeof import('../report');
  const mk = (id: string, time: number, extra: object) => ({ id, time, ...extra }) as LogEntry;
  it('GMI, SS ve CV hesaplanır', () => {
    const es = [100, 140, 180, 220].map((bg, i) => mk(String(i), 1_700_000_000_000 + i * 3600000, { bg }));
    const s = computeStats(es, settings.blocks, 70);
    expect(s.avg).toBe(160);
    expect(s.gmi).toBe(7.1);
    expect(s.sd).toBe(52);
    expect(s.cv).toBe(32);
  });
  it('tokluk−açlık farkını öğün başına bulur ve gözlem üretir', () => {
    const t = new Date(2026, 8, 1, 12, 30).getTime();
    const es: LogEntry[] = [];
    for (let d = 0; d < 3; d++) {
      const base = t + d * 86400000;
      es.push(mk(`m${d}`, base, { bg: 100, carbs: 50, bolus: 5, meal: 'ogle' }));
      es.push(mk(`p${d}`, base + 7200000, { bg: 190, post: true, afterId: `m${d}`, meal: 'ogle' }));
    }
    const m = rep.mealStats(es, settings).find((x) => x.meal === 'ogle')!;
    expect(m.avgRise).toBe(90);
    expect(m.pairs).toBe(3);
    expect(rep.observations(es, settings).some((o) => o.includes('+90'))).toBe(true);
  });
});

describe('gün sınırı (gece kayıtları önceki güne ait)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const st = require('../stats') as typeof import('../stats');
  afterEach(() => st.setDayOffset(0));
  it('06:00 başlangıçta 2 Ekim 03:00, 1 Ekim gününe yazılır', () => {
    st.setDayOffset(360);
    const night = new Date(2026, 9, 2, 3, 0).getTime();
    const morning = new Date(2026, 9, 2, 7, 0).getTime();
    expect(st.startOfDay(night)).toBe(new Date(2026, 9, 1, 6, 0).getTime());
    expect(st.startOfDay(morning)).toBe(new Date(2026, 9, 2, 6, 0).getTime());
  });
  it('varsayılan (0) gece yarısıdır', () => {
    expect(st.startOfDay(new Date(2026, 9, 2, 3, 0).getTime())).toBe(new Date(2026, 9, 2, 0, 0).getTime());
  });
  it('bantlar gün başlangıcına göre kaydırılır', () => {
    st.setDayOffset(360);
    // 00:00–24:00 tek bant: 06:00'ya kadar kısmı eksenin sonuna gider
    expect(st.toDayAxis(0, 1440)).toEqual([[1080, 1440], [0, 1080]]);
    expect(st.toDayAxis(600, 900)).toEqual([[240, 540]]);
  });
});

describe('rapor grafiği gün sınırı', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const st = require('../stats') as typeof import('../stats');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const rep = require('../report') as typeof import('../report');
  afterEach(() => st.setDayOffset(0));
  it('saat etiketleri günün başlangıcından (06:00) sayılır ve gece ölçümü önceki gün grafiğinde yer alır', () => {
    st.setDayOffset(360);
    const es: LogEntry[] = [
      { id: 'a', time: new Date(2026, 9, 1, 12).getTime(), bg: 120 },
      { id: 'b', time: new Date(2026, 9, 2, 3).getTime(), bg: 95 },
    ];
    const svg = rep.chartSvg(es, settings, new Date(2026, 9, 1, 6).getTime(), new Date(2026, 9, 3, 6).getTime());
    expect(svg).toContain('09:00');
    expect(svg).toContain('>03:00<'); // eksenin sonu: gece 03:00 hâlâ aynı günün içinde
    expect((svg.match(/<svg /g) ?? []).length).toBe(1);
    expect(svg).toContain('>1 Eki Per<');
    expect(svg).not.toContain('2 Eki');
  });
});

describe('hipo tedavisi şekere ve kişisel etkiye göre', () => {
  const profileH = { dia: 4, peak: 75 };
  it('miktar şekere göre değişir (5 g adımlarla, 10–30 g arası)', () => {
    // 1 g = 4 mg/dL, hedef 110
    expect(hypoPlan(69, block, 0, settings).carbsNow).toBe(15); // 41/4 = 10,25 → 15
    expect(hypoPlan(100, block, 0, settings).carbsNow).toBe(10); // alt sınır
    expect(hypoPlan(60, block, 0, settings).carbsNow).toBe(15); // 12,5 → 15
    expect(hypoPlan(60, block, 0, settings, 0, 2).carbsNow).toBe(25); // 1 g = 2 mg/dL → 25 g
    expect(hypoPlan(60, block, 0, settings, 0, 1).carbsNow).toBe(30); // üst sınır
    expect(hypoPlan(50, block, 0, settings).carbsNow).toBe(20); // ağır: en az 20
  });
  it('beklenen şekeri ve kullanılan etkiyi döner', () => {
    const p = hypoPlan(60, block, 0, settings, 0, 3);
    expect(p.rise).toBe(3);
    expect(p.expectedBg).toBe(60 + p.carbsNow * 3);
  });
  const tH = new Date(2026, 8, 20, 15, 0).getTime();
  const treat = (i: number, pre: number, post: number): LogEntry[] => [
    { id: `t${i}`, time: tH + i * 86400000, bg: pre, hypoCarbs: 15 },
    { id: `c${i}`, time: tH + i * 86400000 + 15 * 60000, bg: post },
  ];
  it('tedavi + 15 dk sonraki ölçümden 1 g etkisini öğrenir', () => {
    const log = [...treat(0, 55, 115), ...treat(1, 60, 108), ...treat(2, 58, 118)]; // +60, +48, +60 → 4, 3,2, 4 mg/dL/g
    const samples = hypoRiseSamples(log, [block], profileH);
    expect(samples).toHaveLength(3);
    expect(personalRise(samples)).toBe(4);
    expect(chooseRise(undefined, samples, block)).toMatchObject({ source: 'data', rise: 4 });
    expect(chooseRise(5.5, samples, block)).toMatchObject({ source: 'manual', rise: 5.5 });
  });
  it('az örnekte oranlardan hesaplar; araya yemek girenleri saymaz', () => {
    const two = [...treat(0, 55, 115), ...treat(1, 60, 108)];
    expect(chooseRise(undefined, hypoRiseSamples(two, [block], profileH), block)).toMatchObject({ source: 'ratios', rise: 4 });
    const interrupted: LogEntry[] = [
      { id: 'x', time: tH, bg: 55, hypoCarbs: 15 },
      { id: 'y', time: tH + 5 * 60000, carbs: 30, bolus: 3 },
      { id: 'z', time: tH + 15 * 60000, bg: 140 },
    ];
    expect(hypoRiseSamples(interrupted, [block], profileH)).toHaveLength(0);
  });
  it('porsiyonlar grama göre ölçeklenir', () => {
    const o = quickCarbOptions(15, 4).map((x) => x.text);
    expect(o[0]).toContain('4 glukoz tableti');
    expect(o[1]).toContain('150 ml meyve suyu');
    expect(quickCarbOptions(25, 4)[0].text).toContain('6 glukoz tableti');
    expect(quickCarbOptions(10, 5)[0].text).toContain('2 glukoz tableti');
  });
});

describe('düşük şeker ekranı: karbonhidrat ne zaman önerilir / önerilmez', () => {
  // block: KH oranı 10, ISF 40 → 1 g = 4 mg/dL; hedef 110, aralık 80–140; hipo 70, ağır 54, yüksek 250
  const a = (bg: number | undefined, iob = 0, cob = 0) => assessHypo(bg, block, iob, cob, settings, 4);
  const noCarbs = ['belowRange', 'ok', 'high', 'veryHigh', 'invalid'];
  it('ölçüm yoksa belirtiye göre standart 15 g', () => {
    expect(a(undefined)).toEqual({ status: 'unknown', carbs: 15 });
  });
  it('geçersiz değerde tedavi önerilmez', () => {
    expect(a(5).status).toBe('invalid');
    expect(a(700).status).toBe('invalid');
  });
  it('hipo sınırının altında tedavi önerilir; ağırda en az 20 g', () => {
    expect(a(65)).toMatchObject({ status: 'low', plan: { carbsNow: 15 } });
    expect(a(69).status).toBe('low');
    expect(a(45)).toMatchObject({ status: 'severe' });
    expect((a(45) as { plan: { carbsNow: number } }).plan.carbsNow).toBeGreaterThanOrEqual(20);
  });
  it('şeker hipo sınırının üstündeyse (yüksek dahil) ASLA tedavi önerilmez', () => {
    for (const bg of [70, 75, 85, 100, 120, 140, 141, 180, 249, 250, 300, 450, 600]) {
      for (const iob of [0, 1, 3, 6]) {
        const r = a(bg, iob);
        expect(['unknown', 'low', 'severe']).not.toContain(r.status);
        if (bg >= 80) expect(r.status).not.toBe('falling');
      }
    }
  });
  it('durumlar doğru sınıflanır', () => {
    expect(a(75).status).toBe('belowRange');
    expect(a(120).status).toBe('ok');
    expect(a(180).status).toBe('high');
    expect(a(250).status).toBe('veryHigh');
    expect(noCarbs).toContain(a(300, 4).status);
  });
  it('yüksek şekerde aktif insülin fazla olsa da karbonhidrat önerilmez, yalnızca izleme uyarısı', () => {
    const r = a(250, 6);
    expect(r).toMatchObject({ status: 'veryHigh', watch: true });
  });
  it('hedefin altında + aktif insülinle hipoya iniyorsa küçük önleyici miktar', () => {
    const r = a(75, 1);
    expect(r.status).toBe('falling');
    const g = (r as { carbs: number }).carbs;
    expect(g).toBeGreaterThanOrEqual(5);
    expect(g).toBeLessThanOrEqual(30);
  });
  it('hedef aralıktaki şekerde aktif insülin yüzünden izle, ama karbonhidrat verme', () => {
    expect(a(90, 1)).toMatchObject({ status: 'ok', watch: true });
  });
  it('hipo sonrası: ek karbonhidrat yalnızca gerekirse', () => {
    const f = (bg: number, iob = 0) => followUpSnack(bg, block, iob, 0, settings, 4).snack;
    expect(f(72)).toBe(10);
    expect(f(120)).toBe(0);
    expect(f(90, 2)).toBeGreaterThan(0);
    expect(f(90, 2)).toBeLessThanOrEqual(30);
  });
});

describe('raporda yemek başına karbonhidrat', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const rep = require('../report') as typeof import('../report');
  it('her yemek kendi gramı ve karbonhidratıyla ayrı satırda yazılır', () => {
    const e: LogEntry = {
      id: 'f', time: 1, carbs: 55, bolus: 5,
      items: [
        { foodId: 'simit', name: 'Simit', grams: 100, carbs: 45 },
        { foodId: 'yumurta', name: 'Haşlanmış yumurta', grams: 50, carbs: 0 },
        { foodId: 'rule-meat', name: 'Et kuralı (100 g üzeri et)', grams: 0, carbs: 10 },
      ],
    };
    expect(rep.foodLines(e)).toBe('Simit 100 g · 45 g KH<br>Haşlanmış yumurta 50 g · 0 g KH<br>Et kuralı (100 g üzeri et) · +10 g KH');
    expect(rep.foodLines({ id: 'g', time: 1, foods: 'Ayran' })).toBe('Ayran');
  });
  it('PDF HTML\'inde görünür', () => {
    const e: LogEntry = { id: 'f', time: new Date(2026, 9, 1, 12).getTime(), carbs: 45, bolus: 4, items: [{ foodId: 'simit', name: 'Simit', grams: 100, carbs: 45 }] };
    const html = rep.buildReportHtml({ entries: [e], settings, from: new Date(2026, 9, 1).getTime(), to: new Date(2026, 9, 2).getTime() });
    expect(html).toContain('Simit 100 g · 45 g KH');
  });
});
