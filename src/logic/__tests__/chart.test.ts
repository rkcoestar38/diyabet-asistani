import { curvePaths, monotoneBeziers, splitByGap } from '../chart';

const H = 3600000;

describe('monotoneBeziers', () => {
  it('iki ölçüm arasında olmayan tepe veya dip çizmez', () => {
    const pts = [
      { x: 0, y: 100 },
      { x: 10, y: 40 },
      { x: 20, y: 45 },
      { x: 60, y: 200 },
      { x: 70, y: 190 },
    ];
    for (const b of monotoneBeziers(pts)) {
      const lo = Math.min(b.from.y, b.to.y);
      const hi = Math.max(b.from.y, b.to.y);
      for (const c of [b.c1, b.c2]) {
        expect(c.y).toBeGreaterThanOrEqual(lo - 1e-9);
        expect(c.y).toBeLessThanOrEqual(hi + 1e-9);
      }
    }
  });

  it('tek ölçümde eğri yoktur, iki ölçümde düz çizgidir', () => {
    expect(monotoneBeziers([{ x: 0, y: 1 }])).toHaveLength(0);
    const [b] = monotoneBeziers([
      { x: 0, y: 0 },
      { x: 30, y: 30 },
    ]);
    expect(b.c1).toEqual({ x: 10, y: 10 });
    expect(b.c2).toEqual({ x: 20, y: 20 });
  });

  it('aynı saatteki iki ölçümde sayı dışı değer üretmez', () => {
    const out = monotoneBeziers([
      { x: 0, y: 100 },
      { x: 0, y: 120 },
      { x: 10, y: 90 },
    ]);
    for (const b of out) for (const c of [b.c1, b.c2]) expect(Number.isFinite(c.y)).toBe(true);
  });
});

describe('splitByGap', () => {
  it('9 saatten uzun boşlukta böler, gece ölçümlerini günler arasında bağlar', () => {
    const runs = splitByGap([{ t: 0 }, { t: 8 * H }, { t: 18 * H }, { t: 20 * H }]);
    expect(runs.map((r) => r.length)).toEqual([2, 2]);
  });
});

describe('curvePaths', () => {
  it('yakın ölçümler düz, uzun boşluk kesik çizgiyle çizilir', () => {
    const run = [
      { t: 0, x: 0, y: 50 },
      { t: 2 * H, x: 10, y: 60 },
      { t: 9 * H, x: 40, y: 55 }, // 7 sa boşluk: kesik
    ];
    const p = curvePaths(run, 100);
    expect(p.solid.match(/M/g)).toHaveLength(1);
    expect(p.dashed.match(/M/g)).toHaveLength(1);
    expect(p.area.endsWith('Z')).toBe(true);
  });
});
