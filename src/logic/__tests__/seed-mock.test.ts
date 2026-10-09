import { buildMockData } from '@/data/seed-mock';
import { computeStats } from '@/logic/stats';

describe('buildMockData', () => {
  it('generates a rich dataset with HbA1c (GMI) exactly 6.6%', () => {
    const { settings, entries } = buildMockData(new Date(2026, 9, 9, 1, 0, 0));

    expect(entries.length).toBeGreaterThan(50);

    const stats = computeStats(entries, settings.blocks, settings.hypoThreshold, {
      fastingRange: settings.fastingRange,
      postRange: settings.postRange,
      all: entries,
    });

    // HbA1c (GMI) must be exactly 6.6% as requested
    expect(stats.gmi).toBe(6.6);

    // Realistic stats
    expect(stats.readings).toBeGreaterThanOrEqual(50);
    expect(stats.days).toBe(14);
    expect(stats.inRange).toBeGreaterThanOrEqual(80);
    expect(stats.avg).toBeGreaterThanOrEqual(135);
    expect(stats.avg).toBeLessThanOrEqual(140);
    expect(stats.carbs).toBeGreaterThan(1000);
    expect(stats.bolus).toBeGreaterThan(50);
    expect(stats.basal).toBeGreaterThan(100);
  });
});
