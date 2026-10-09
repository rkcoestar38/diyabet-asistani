export type Pt = { x: number; y: number };
export type Bezier = { from: Pt; c1: Pt; c2: Pt; to: Pt };

/** İki ölçüm bu süreden yakınsa düz çizgiyle, bu süreye kadar kesik çizgiyle bağlanır; daha uzun boşluk bağlanmaz */
export const SOLID_GAP = 5 * 3600000;
export const MAX_GAP = 9 * 3600000;

/**
 * Monoton kübik eğri (Fritsch–Butland): ölçümlerin arasından yumuşak geçer ama iki ölçüm arasında
 * hiçbir zaman daha yüksek veya daha düşük bir değer göstermez (olmayan bir tepe/dip çizmez).
 */
export function monotoneBeziers(p: Pt[]): Bezier[] {
  const n = p.length;
  if (n < 2) return [];
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(p[i + 1].x - p[i].x);
    m.push(dx[i] > 0 ? (p[i + 1].y - p[i].y) / dx[i] : 0);
  }
  const t: number[] = new Array(n);
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) t[i] = 0;
    else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      t[i] = (w1 + w2) / (w1 / m[i - 1] + w2 / m[i]);
    }
  }
  return m.map((_, i) => {
    const h = dx[i] / 3;
    return {
      from: p[i],
      c1: { x: p[i].x + h, y: p[i].y + t[i] * h },
      c2: { x: p[i + 1].x - h, y: p[i + 1].y - t[i + 1] * h },
      to: p[i + 1],
    };
  });
}

/**
 * Yumuşatılmış Catmull-Rom / Cardinal kübik eğri:
 * Sert zig-zagları ve akordeon kırılmalarını engeller; ölçüm noktalarından akıcı,
 * organik ve estetik bir dalga gibi geçer. İsteğe bağlı olarak dikey taşmayı sınırlar.
 */
export function smoothBeziers(p: Pt[], tension = 0.35, minY?: number, maxY?: number): Bezier[] {
  const n = p.length;
  if (n < 2) return [];
  if (n === 2) {
    const hx = (p[1].x - p[0].x) / 3;
    const hy = (p[1].y - p[0].y) / 3;
    return [
      {
        from: p[0],
        c1: { x: p[0].x + hx, y: p[0].y + hy },
        c2: { x: p[1].x - hx, y: p[1].y - hy },
        to: p[1],
      },
    ];
  }

  const k = tension / 2;
  const out: Bezier[] = [];

  for (let i = 0; i < n - 1; i++) {
    const p0 = i > 0 ? p[i - 1] : { x: 2 * p[0].x - p[1].x, y: 2 * p[0].y - p[1].y };
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = i < n - 2 ? p[i + 2] : { x: 2 * p2.x - p1.x, y: 2 * p2.y - p1.y };

    let c1y = p1.y + (p2.y - p0.y) * k;
    let c2y = p2.y - (p3.y - p1.y) * k;

    if (minY !== undefined && maxY !== undefined) {
      c1y = Math.min(Math.max(c1y, minY), maxY);
      c2y = Math.min(Math.max(c2y, minY), maxY);
    }

    out.push({
      from: p1,
      c1: { x: p1.x + (p2.x - p0.x) * k, y: c1y },
      c2: { x: p2.x - (p3.x - p1.x) * k, y: c2y },
      to: p2,
    });
  }
  return out;
}

/** Zamana göre sıralı ölçümleri, aralarında `maxGap`'ten uzun boşluk olan yerlerden böler */
export function splitByGap<V extends { t: number }>(list: V[], maxGap = MAX_GAP): V[][] {
  const out: V[][] = [];
  for (const v of list) {
    const run = out[out.length - 1];
    if (run && v.t - run[run.length - 1].t <= maxGap) run.push(v);
    else out.push([v]);
  }
  return out;
}

const f = (n: number) => n.toFixed(1);
const piece = (b: Bezier) => `M${f(b.from.x)},${f(b.from.y)} C${f(b.c1.x)},${f(b.c1.y)} ${f(b.c2.x)},${f(b.c2.y)} ${f(b.to.x)},${f(b.to.y)}`;

/**
 * Bir ölçüm dizisinin SVG yolları: `solid` yakın ölçümler arası, `dashed` uzun (ama bağlanabilir) boşluklar,
 * `area` eğrinin altındaki dolgu (`baseY` taban çizgisi).
 */
export function curvePaths(
  run: { t: number; x: number; y: number }[],
  baseY: number,
  solidGap = SOLID_GAP,
  useSmooth = true,
  minY?: number,
  maxY?: number,
) {
  const segs = useSmooth ? smoothBeziers(run, 0.35, minY, maxY) : monotoneBeziers(run);
  const solid = segs.filter((_, i) => run[i + 1].t - run[i].t <= solidGap).map(piece).join(' ');
  const dashed = segs.filter((_, i) => run[i + 1].t - run[i].t > solidGap).map(piece).join(' ');
  const area = segs.length
    ? `M${f(run[0].x)},${f(baseY)} L${f(run[0].x)},${f(run[0].y)} ${segs.map((b) => `C${f(b.c1.x)},${f(b.c1.y)} ${f(b.c2.x)},${f(b.c2.y)} ${f(b.to.x)},${f(b.to.y)}`).join(' ')} L${f(run[run.length - 1].x)},${f(baseY)} Z`
    : '';
  return { solid, dashed, area };
}

/** Eğrinin parça parça yolları (her parça iki ölçüm arası): parça başına renk geçişi için */
export function curveSegments(
  run: { t: number; x: number; y: number }[],
  solidGap = SOLID_GAP,
  useSmooth = true,
  minY?: number,
  maxY?: number,
) {
  const segs = useSmooth ? smoothBeziers(run, 0.35, minY, maxY) : monotoneBeziers(run);
  return segs.map((b, i) => ({ d: piece(b), dashed: run[i + 1].t - run[i].t > solidGap, i }));
}
