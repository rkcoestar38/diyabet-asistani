import { DEFAULT_MEAL_STARTS } from '../meals';
import { attention, blockSuggestions, evaluate, reasonCategory } from '../optimizer';
import { analyzeIcr, analyzeIsf, buildSuggestions, icrSample, isfSample } from '../ratios';
import type { LogEntry, RatioChange, TimeBlock } from '../types';

const DAY = 86400000;
const MIN = 60000;
const NOW = new Date(2026, 9, 15, 23).getTime();
const block: TimeBlock = { id: 'lunch', name: 'Öğle', meal: 'ogle', start: '12:00', icr: 10, isf: 40, target: 110, low: 80, high: 140 };
const profile = { dia: 4, peak: 75 };
const settings = { blocks: [block], ...profile, mealStarts: DEFAULT_MEAL_STARTS };
const meal = (day: number, post = 190): LogEntry[] => {
  const time = NOW - day * DAY - 8 * 60 * MIN;
  return [{ id: `m${day}`, time, meal: 'ogle', carbs: 60, bolus: 6, bg: 110 }, { id: `p${day}`, time: time + 240 * MIN, bg: post, post: true, afterId: `m${day}` }];
};
const change = (extra: Partial<RatioChange> = {}): RatioChange => ({ time: NOW - 2 * DAY, blockId: block.id, blockName: block.name, field: 'icr', from: 9, to: 10, source: 'manual', ...extra });

describe('optimizer evidence policy', () => {
  it('moves the ratio in both insulin directions with new evidence', () => {
    const high = [1, 2, 3].flatMap((d) => meal(d, 190));
    const low = [1, 2, 3].flatMap((d) => meal(d, 70));
    expect(analyzeIcr(high, [block], profile, NOW)[0].suggested).toBe(8);
    expect(analyzeIcr(low, [block], profile, NOW)[0].suggested).toBe(12);
  });
  it('keeps historical evaluation but excludes old evidence from all suggestion surfaces', () => {
    const log = [50, 51, 52].flatMap((d) => meal(d));
    const ev = evaluate(log, settings, NOW);
    expect(ev.icr).toHaveLength(3);
    expect(analyzeIcr(log, [block], profile, NOW)[0].samples).toHaveLength(0);
    expect(blockSuggestions(ev.icr, [block], 'icr', NOW)[0].suggested).toBeUndefined();
    expect(attention(ev, settings, NOW)).toBeUndefined();
  });
  it('uses an exclusive 42-day lower boundary and excludes future samples', () => {
    const by = new Map([[block.id, [NOW - 42 * DAY, NOW + MIN, NOW - DAY].map((time) => ({ time, pre: 110, post: 190, value: 7.5 }))]]);
    expect(buildSuggestions([block], by, (b) => b.icr, 0.5, NOW, [], 'icr')[0].samples).toEqual([{ time: NOW - DAY, pre: 110, post: 190, value: 7.5 }]);
  });
  it('waits for new evidence after a matching change, including ISF changes affecting ICR', () => {
    const log = [1, 2, 3].flatMap((d) => meal(d));
    expect(analyzeIcr(log, [block], profile, NOW, [change()])[0].samples).toHaveLength(1);
    expect(analyzeIcr(log, [block], profile, NOW, [change({ field: 'isf' })])[0].samples).toHaveLength(1);
    expect(analyzeIcr(log, [block], profile, NOW, [change({ blockId: 'other' })])[0].samples).toHaveLength(3);
    expect(analyzeIcr(log, [block], profile, NOW, [change({ blockId: undefined })])[0].samples).toHaveLength(1);
    expect(analyzeIcr(log, [{ ...block, name: 'Yeni ad' }], profile, NOW, [change()])[0].samples).toHaveLength(1);
    expect(analyzeIcr(log, [block], profile, NOW, [change({ time: NOW + DAY })])[0].samples).toHaveLength(3);
  });
  it('stops suggesting from accepted evidence until three new meals support another change', () => {
    const original = [1, 2, 3].flatMap((d) => meal(d, 70));
    expect(analyzeIcr(original, [block], profile, NOW)[0].suggested).toBe(12);
    const updated = { ...block, icr: 12 };
    const history = [change({ time: NOW, from: 10, to: 12, source: 'suggestion' })];
    const updatedSettings = { ...settings, blocks: [updated] };
    expect(analyzeIcr(original, [updated], profile, NOW, history)[0]).toMatchObject({ samples: [] });
    expect(attention(evaluate(original, updatedSettings, NOW), updatedSettings, NOW, history)).toBeUndefined();
    const later = NOW + 4 * DAY;
    const firstTwo = [...original, ...[-1, -2].flatMap((d) => meal(d, 110))];
    expect(analyzeIcr(firstTwo, [updated], profile, later, history)[0].suggested).toBeUndefined();
    const fresh = [...firstTwo, ...meal(-3, 110)];
    expect(analyzeIcr(fresh, [updated], profile, later, history)[0]).toMatchObject({ suggested: 10, samples: expect.any(Array) });
    expect(analyzeIcr(fresh, [updated], profile, later, history)[0].samples).toHaveLength(3);
    expect(attention(evaluate(fresh, updatedSettings, later), updatedSettings, later, history)).toContain('Karbonhidrat');
  });
  it('groups actual stale and missing starting-glucose reasons as missing pre-meal glucose', () => {
    const expected = 'Yemek öncesi şeker eksik veya çok önce ölçülmüş';
    expect(reasonCategory('Şeker, yemekten 30 dakikadan uzun süre önce ölçülmüş.').reason).toBe(expected);
    expect(reasonCategory('Şeker, dozdan 30 dakikadan uzun süre önce ölçülmüş.').reason).toBe(expected);
    expect(reasonCategory('Başlangıç şekeri kaydedilmemiş.').reason).toBe(expected);
  });
  it('does not reuse future doses or future measurements', () => {
    const log = meal(1);
    expect(icrSample(log, log[0].id, [block], profile, log[0].time + 160 * MIN)).toMatchObject({ ok: false, pending: true });
    expect(icrSample(log, log[0].id, [block], profile, log[0].time - 1)).toMatchObject({ ok: false });
    expect(evaluate(meal(-1), settings, NOW).candidates.icr).toBe(0);
  });
  it('uses actual measurement time for inclusion, nearest reading and projection', () => {
    const [start] = meal(1);
    const log: LogEntry[] = [start, { id: 'late-save', time: start.time + 360 * MIN, bgTime: start.time + 240 * MIN, bg: 190, afterId: start.id, post: true }];
    expect(icrSample(log, start.id, [block], profile, NOW)).toMatchObject({ ok: true, sample: { post: 190, value: 7.5 } });
    const beforeWindow = [{ ...log[1], time: start.time + 240 * MIN, bgTime: start.time + 100 * MIN }];
    expect(icrSample([start, ...beforeWindow], start.id, [block], profile, NOW)).toMatchObject({ ok: false });
    const reordered: LogEntry[] = [start,
      { id: 'closer-save', time: start.time + 180 * MIN, bgTime: start.time + 240 * MIN, bg: 190 },
      { id: 'closer-read', time: start.time + 400 * MIN, bgTime: start.time + 180 * MIN, bg: 160 },
    ];
    expect(icrSample(reordered, start.id, [block], profile, NOW)).toMatchObject({ ok: true, sample: { post: 160 } });
    const measured: LogEntry = { id: 'measured', time: start.time + 180 * MIN, bg: 160 };
    const delayed = { ...measured, time: start.time + 400 * MIN, bgTime: measured.time };
    expect(icrSample([start, delayed], start.id, [block], profile, NOW)).toEqual(icrSample([start, measured], start.id, [block], profile, NOW));
  });
  it('rejects interference before a delayed actual reading and accepts reading before same-record dose', () => {
    const [start] = meal(1);
    const post: LogEntry = { id: 'post', time: start.time + 170 * MIN, bgTime: start.time + 240 * MIN, bg: 190 };
    const snack: LogEntry = { id: 'snack', time: start.time + 200 * MIN, carbs: 20 };
    expect(icrSample([start, post, snack], start.id, [block], profile, NOW)).toMatchObject({ ok: false });
    expect(icrSample([start, { ...post, time: start.time + 240 * MIN, bgTime: undefined, bolus: 2 }], start.id, [block], profile, NOW)).toMatchObject({ ok: true });
  });
  it('does not borrow a post reading belonging to another meal', () => {
    const log = meal(1);
    log[1].afterId = 'other-meal';
    expect(icrSample(log, log[0].id, [block], profile, NOW)).toMatchObject({ ok: false });
  });
  it('tracks missing pre-meal glucose and dose as rejections instead of hiding meals', () => {
    const ev = evaluate([{ ...meal(1)[0], bg: undefined }, { ...meal(2)[0], bolus: undefined }], settings, NOW);
    expect(ev.candidates.icr).toBe(2);
    expect(ev.rejected.reduce((n, r) => n + r.count, 0)).toBe(2);
    expect(ev.pending).toBe(0);
    expect(ev.records).toEqual(expect.arrayContaining([expect.objectContaining({ blockId: block.id, status: 'rejected' })]));
    const pending = evaluate([meal(1)[0]], settings, meal(1)[0].time + 100 * MIN);
    expect(pending.pending).toBe(1);
    expect(pending.rejected).toHaveLength(0);
    expect(pending.records).toEqual([expect.objectContaining({ blockId: block.id, status: 'pending' })]);
  });
  it('resets ISF evidence only for ISF changes', () => {
    const log: LogEntry[] = [1, 2, 3].flatMap((d) => { const time = NOW - d * DAY - 8 * 60 * MIN; return [{ id: `c${d}`, time, bg: 230, bolus: 3, meal: 'ogle' }, { id: `r${d}`, time: time + 240 * MIN, bg: 110 }]; });
    expect(analyzeIsf(log, [block], profile, NOW, [change()])[0].samples).toHaveLength(3);
    expect(analyzeIsf(log, [block], profile, NOW, [change({ field: 'isf' })])[0].samples).toHaveLength(1);
    const first = log[0];
    expect(isfSample([first, { ...log[1], bgTime: first.time + 100 * MIN }], first.id, [block], profile, NOW)).toMatchObject({ ok: false });
    const measured: LogEntry = { id: 'measured-correction', time: first.time + 180 * MIN, bg: 140 };
    expect(isfSample([first, { ...measured, time: first.time + 400 * MIN, bgTime: measured.time }], first.id, [block], profile, NOW)).toEqual(isfSample([first, measured], first.id, [block], profile, NOW));
    const weaker = log.map((e) => e.bolus ? e : { ...e, bg: 80 });
    const stronger = log.map((e) => e.bolus ? e : { ...e, bg: 170 });
    expect(analyzeIsf(weaker, [block], profile, NOW)[0].suggested).toBe(48);
    expect(analyzeIsf(stronger, [block], profile, NOW)[0].suggested).toBe(32);
  });
});
