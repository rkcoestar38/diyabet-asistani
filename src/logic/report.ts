import { fmt } from './bolus';
import { MEALS, entryMeal } from './meals';
import { activeBlock, blockEnd, sortBlocks } from './schedule';
import { computeStats, getDayOffset, startOfDay, toDayAxis } from './stats';
import type { LogEntry, MealType, Settings } from './types';

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const WEEKDAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const DAY = 86400000;

export function dayLabel(t: number, withWeekday = true): string {
  const d = new Date(t);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}${withWeekday ? `, ${WEEKDAYS[d.getDay()]}` : ''}`;
}

export function timeLabel(t: number): string {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const esc = (s: string | number | undefined) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const num = (n: number | undefined, d = 1) => (n === undefined ? '' : fmt(n, d));

const exerciseTr = { none: '', light: 'Hafif egzersiz', moderate: 'Orta egzersiz', intense: 'Yoğun egzersiz' } as const;

/** Bir kaydın "not" sütunu: hipo tedavisi, keton, egzersiz ve serbest not */
export function entryNotes(e: LogEntry): string {
  const parts: string[] = [];
  if (e.hypoCarbs) parts.push(`Hipo tedavisi ${fmt(e.hypoCarbs, 0)} g`);
  if (e.ketones !== undefined) parts.push(`Keton ${fmt(e.ketones)}`);
  if (e.post) parts.unshift('Tokluk ölçümü');
  if (e.exercise && e.exercise !== 'none') parts.push(exerciseTr[e.exercise]);
  if (e.note) parts.push(e.note);
  return parts.join(' · ');
}

/** Öğündeki her yemek ayrı satırda, kendi karbonhidratıyla ("Simit 100 g · 45 g KH"). Yapılandırılmış kayıt yoksa metin özeti. */
export function foodLines(e: LogEntry): string {
  if (e.items?.length) {
    return e.items
      .map((i) => (i.foodId === 'rule-meat' ? `${esc(i.name)} · +${fmt(i.carbs, 0)} g KH` : `${esc(i.name)} ${fmt(i.grams, 0)} g · ${fmt(i.carbs, 1)} g KH`))
      .join('<br>');
  }
  return e.foods ? esc(e.foods) : '';
}

export type RangeStats = ReturnType<typeof computeStats> & {
  avgCarbsPerDay?: number;
  avgBolusPerDay?: number;
  avgBasalPerDay?: number;
  avgTotalPerDay?: number;
};

/**
 * Aralık istatistikleri. Günlük ortalamalar (KH, insülin) bugünün yarım gününü dışarıda bırakır
 * (aralıkta en az bir tamamlanmış gün varsa); böylece sabah bakıldığında ortalamalar düşük çıkmaz.
 */
export function rangeStats(entries: LogEntry[], settings: Settings, now = Date.now()): RangeStats {
  const s = computeStats(entries, settings.blocks, settings.hypoThreshold);
  const today = startOfDay(now);
  const complete = entries.filter((e) => e.time < today);
  const basis = complete.length > 0 ? computeStats(complete, settings.blocks, settings.hypoThreshold) : s;
  const d = Math.max(basis.days, 1);
  return {
    ...s,
    avgCarbsPerDay: basis.days ? Math.round(basis.carbs / d) : undefined,
    avgBolusPerDay: basis.days ? Math.round((basis.bolus / d) * 10) / 10 : undefined,
    avgBasalPerDay: basis.days ? Math.round((basis.basal / d) * 10) / 10 : undefined,
    avgTotalPerDay: basis.days ? Math.round(((basis.bolus + basis.basal) / d) * 10) / 10 : undefined,
  };
}

export type MealStat = {
  meal: MealType;
  label: string;
  /** Bu öğüne ait kayıt sayısı */
  count: number;
  avgBg?: number;
  /** Öğün öncesi (yemek kaydıyla birlikte girilen) şeker ortalaması */
  avgBgBefore?: number;
  /** Yemekten sonraki (tokluk) ölçümlerin ortalaması */
  avgBgAfter?: number;
  /** Tokluk − açlık farkının ortalaması ve kaç çiftten hesaplandığı */
  avgRise?: number;
  pairs: number;
  avgCarbs?: number;
  avgBolus?: number;
  hypos: number;
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : undefined);
const r1 = (n: number | undefined, d = 1) => (n === undefined ? undefined : Math.round(n * 10 ** d) / 10 ** d);

/** Öğün türüne göre özet: her öğünde ortalama şeker, karbonhidrat, insülin ve hipo sayısı */
export function mealStats(entries: LogEntry[], settings: Settings): MealStat[] {
  return MEALS.map((m) => {
    const es = entries.filter((e) => entryMeal(e, settings.mealStarts) === m.id);
    const withCarbs = es.filter((e) => e.carbs && !e.post);
    const rises = es
      .filter((e) => e.post && e.bg !== undefined)
      .map((p) => ({ p, src: entries.find((x) => x.id === p.afterId) }))
      .filter((x) => x.src?.bg !== undefined)
      .map((x) => x.p.bg! - x.src!.bg!);
    return {
      meal: m.id,
      label: m.label,
      count: es.length,
      avgBg: r1(avg(es.filter((e) => e.bg !== undefined).map((e) => e.bg!)), 0),
      avgBgBefore: r1(avg(withCarbs.filter((e) => e.bg !== undefined).map((e) => e.bg!)), 0),
      avgRise: r1(avg(rises), 0),
      pairs: rises.length,
      avgBgAfter: r1(avg(es.filter((e) => e.post && e.bg !== undefined).map((e) => e.bg!)), 0),
      avgCarbs: r1(avg(withCarbs.map((e) => e.carbs!)), 0),
      avgBolus: r1(avg(es.filter((e) => e.bolus).map((e) => e.bolus!)), 1),
      hypos: es.filter((e) => e.hypoCarbs || (e.bg !== undefined && e.bg < settings.hypoThreshold)).length,
    };
  });
}

/** Seçilen aralığın günlük gruplaması (yeniden eskiye değil, eskiden yeniye) */
export function groupByDay(entries: LogEntry[]): { day: number; entries: LogEntry[] }[] {
  const map = new Map<number, LogEntry[]>();
  for (const e of [...entries].sort((a, b) => a.time - b.time)) {
    const k = startOfDay(e.time);
    map.set(k, [...(map.get(k) ?? []), e]);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([day, es]) => ({ day, entries: es }));
}

const TR_DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const TR_MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

/**
 * Şeker grafiği: yalnızca ölçüm olan günler çizilir (boş günler atlanır), her gün 24 saatlik eşit genişlikte.
 * En fazla 7 gün bir grafikte; daha fazlası alt alta ek grafiklere bölünür. Az günde saat ve insülin/karbonhidrat işaretleri görünür.
 * `from`/`to` yalnızca hangi kayıtların dikkate alınacağını belirler; eksen verinin kendisine göre kurulur.
 */
export function chartSvg(entries: LogEntry[], settings: Settings, from: number, to: number): string {
  const inRange = entries.filter((e) => e.time >= from && e.time < to);
  const bgs = inRange.filter((e) => e.bg !== undefined).sort((x, y) => (x.bgTime ?? x.time) - (y.bgTime ?? y.time));
  if (bgs.length === 0) return '';
  const days = [...new Set(bgs.map((e) => startOfDay(e.bgTime ?? e.time)))].sort((x, y) => x - y);
  const maxBg = Math.max(250, ...bgs.map((e) => e.bg!)) + 10;
  const minBg = 40;
  const blocks = sortBlocks(settings.blocks);
  const out: string[] = [];

  for (let i = 0; i < days.length; i += 7) {
    const chunk = days.slice(i, i + 7);
    const n = chunk.length;
    const W = 740;
    const detail = n <= 2; // saat etiketleri ve insülin/karbonhidrat işaretleri
    const H = detail ? 270 : 230;
    const pad = { l: 40, r: 14, t: 16, b: detail ? 66 : 34 };
    const pw = W - pad.l - pad.r;
    const ph = H - pad.t - pad.b;
    const dw = pw / n;
    const y = (v: number) => pad.t + (1 - (Math.min(Math.max(v, minBg), maxBg) - minBg) / (maxBg - minBg)) * ph;
    const idx = (t: number) => chunk.indexOf(startOfDay(t));
    const x = (t: number) => {
      const k = idx(t);
      return pad.l + (k < 0 ? 0 : k) * dw + ((t - chunk[Math.max(k, 0)]) / DAY) * dw;
    };
    const parts: string[] = [];

    // hedef aralık bandı (saat dilimlerine göre) ve gün ayraçları
    chunk.forEach((day, k) => {
      const x0 = pad.l + k * dw;
      blocks.forEach((blk) => {
        const [sh, sm] = blk.start.split(':').map(Number);
        const [eh, em] = blockEnd(settings.blocks, blk).split(':').map(Number);
        const bs = sh * 60 + sm;
        let be = eh * 60 + em;
        if (be <= bs) be = 1440;
        for (const [a, b] of toDayAxis(bs, be)) {
          const bx1 = x0 + (a / 1440) * dw;
          const bx2 = x0 + (b / 1440) * dw;
          parts.push(`<rect x="${bx1.toFixed(1)}" y="${y(blk.high).toFixed(1)}" width="${(bx2 - bx1).toFixed(1)}" height="${(y(blk.low) - y(blk.high)).toFixed(1)}" fill="#2e9e6b" opacity="0.14"/>`);
        }
      });
      parts.push(`<line x1="${x0.toFixed(1)}" x2="${x0.toFixed(1)}" y1="${pad.t}" y2="${pad.t + ph}" stroke="#b9c9c7"/>`);
      const d = new Date(day);
      parts.push(`<text x="${(x0 + dw / 2).toFixed(1)}" y="${pad.t + ph + 15}" font-size="10" font-weight="bold" fill="#10292d" text-anchor="middle">${d.getDate()} ${TR_MONTHS_SHORT[d.getMonth()]} ${TR_DAYS[d.getDay()]}</text>`);
      // saat çizgileri
      const step = n === 1 ? 3 : n === 2 ? 6 : n <= 4 ? 12 : 0;
      if (step) {
        for (let h = step; h < 24; h += step) {
          const hx = x0 + (h / 24) * dw;
          parts.push(`<line x1="${hx.toFixed(1)}" x2="${hx.toFixed(1)}" y1="${pad.t}" y2="${pad.t + ph}" stroke="#e2ebea"/>`);
          parts.push(`<text x="${hx.toFixed(1)}" y="${pad.t + ph + 28}" font-size="8" fill="#7a8d90" text-anchor="middle">${String(Math.floor((getDayOffset() / 60 + h) % 24)).padStart(2, '0')}:${String(getDayOffset() % 60).padStart(2, '0')}</text>`);
        }
      }
    });
    parts.push(`<line x1="${(pad.l + pw).toFixed(1)}" x2="${(pad.l + pw).toFixed(1)}" y1="${pad.t}" y2="${pad.t + ph}" stroke="#b9c9c7"/>`);
    for (const v of [70, 180, 250]) {
      parts.push(
        `<line x1="${pad.l}" x2="${pad.l + pw}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 70 ? '#c23a2e' : '#cbd5d3'}" stroke-dasharray="4 4"/><text x="${pad.l - 5}" y="${y(v) + 3}" font-size="9" text-anchor="end" fill="#52686c">${v}</text>`,
      );
    }

    // her günün çizgisi ayrı çizilir (günler arası uzun çizgi olmasın)
    chunk.forEach((day) => {
      const dayBgs = bgs.filter((e) => startOfDay(e.bgTime ?? e.time) === day);
      const path = dayBgs.map((e, k) => `${k ? 'L' : 'M'}${x(e.bgTime ?? e.time).toFixed(1)},${y(e.bg!).toFixed(1)}`).join(' ');
      parts.push(`<path d="${path}" fill="none" stroke="#0b7a86" stroke-width="1.6" opacity="0.75"/>`);
      dayBgs.forEach((e) => {
        const cx = x(e.bgTime ?? e.time);
        const col = e.bg! < settings.hypoThreshold ? '#c23a2e' : e.bg! > 180 ? '#b87400' : '#0b7a86';
        parts.push(`<circle cx="${cx.toFixed(1)}" cy="${y(e.bg!).toFixed(1)}" r="3" fill="${col}"/>`);
        if (detail) parts.push(`<text x="${cx.toFixed(1)}" y="${(y(e.bg!) - 7).toFixed(1)}" font-size="8.5" fill="${col}" text-anchor="middle" font-weight="bold">${e.bg}</text>`);
      });
    });

    // insülin ve karbonhidrat işaretleri (az günde)
    if (detail) {
      const base = pad.t + ph + 42;
      inRange
        .filter((e) => idx(e.time) >= 0 && (e.bolus || e.carbs || e.hypoCarbs))
        .forEach((e) => {
          const cx = x(e.time).toFixed(1);
          if (e.bolus) parts.push(`<text x="${cx}" y="${base}" font-size="9" fill="#1d5f8f" text-anchor="middle" font-weight="bold">${fmt(e.bolus)} Ü</text>`);
          const g = (e.carbs ?? 0) + (e.hypoCarbs ?? 0);
          if (g) parts.push(`<text x="${cx}" y="${base + 11}" font-size="9" fill="${e.hypoCarbs ? '#c23a2e' : '#8a5300'}" text-anchor="middle">${fmt(g, 0)} g</text>`);
        });
      parts.push(`<text x="${pad.l - 5}" y="${base}" font-size="8" fill="#1d5f8f" text-anchor="end">insülin</text><text x="${pad.l - 5}" y="${base + 11}" font-size="8" fill="#8a5300" text-anchor="end">KH</text>`);
    }

    const label = days.length > 7 ? `<div class="sub">${esc(dayLabel(chunk[0], false))} – ${esc(dayLabel(chunk[n - 1], false))}</div>` : '';
    out.push(`${label}<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" font-family="Arial, sans-serif">${parts.join('')}</svg>`);
  }
  return out.join('');
}

/** Doktorun dikkatini çekecek kural tabanlı gözlemler (yorum değil, sayısal tespit) */
export function observations(entries: LogEntry[], settings: Settings): string[] {
  const out: string[] = [];
  for (const m of mealStats(entries, settings)) {
    if (m.pairs >= 2 && m.avgRise !== undefined && m.avgRise >= 60) out.push(`${m.label}: tokluk şekeri açlığa göre ortalama +${m.avgRise} mg/dL yüksek (${m.pairs} öğün).`);
    if (m.pairs >= 2 && m.avgRise !== undefined && m.avgRise <= -40) out.push(`${m.label}: tokluk şekeri açlığa göre ortalama ${m.avgRise} mg/dL düşük (${m.pairs} öğün).`);
    const pre = entries.filter((e) => entryMeal(e, settings.mealStarts) === m.meal && e.carbs && !e.post && e.bg !== undefined);
    const high = pre.filter((e) => { const b = activeBlock(settings.blocks, new Date(e.bgTime ?? e.time)); return b && e.bg! > b.high; });
    if (pre.length >= 3 && high.length / pre.length >= 0.5) out.push(`${m.label}: öğün öncesi şeker ${pre.length} ölçümün ${high.length}'inde hedef aralığın üstünde.`);
  }
  const hypoTimes = entries.filter((e) => e.hypoCarbs || (e.bg !== undefined && e.bg < settings.hypoThreshold)).map((e) => new Date(e.bgTime ?? e.time).getHours());
  if (hypoTimes.length >= 2) {
    const night = hypoTimes.filter((h) => h < 6).length;
    if (night / hypoTimes.length >= 0.5) out.push(`Hipoların ${night}/${hypoTimes.length}'i gece (00:00–06:00) saatlerinde; bazal doz ve akşam dozu gözden geçirilebilir.`);
  }
  const bgs = entries.filter((e) => e.bg !== undefined);
  const days = new Set(bgs.map((e) => new Date(e.bgTime ?? e.time).toDateString())).size;
  if (days > 0 && bgs.length / days < 3) out.push(`Günde ortalama ${(bgs.length / days).toFixed(1)} ölçüm var; veri az olduğu için ortalama ve GMI yaklaşık değerlerdir.`);
  return out;
}

function observationsHtml(entries: LogEntry[], settings: Settings): string {
  const o = observations(entries, settings);
  return o.length ? `<h2>Dikkat çeken noktalar</h2><ul>${o.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
}

export type ReportInput = {
  entries: LogEntry[];
  settings: Settings;
  from: number;
  /** Aralığın bitişi (dahil değil; ertesi günün başlangıcı) */
  to: number;
  ratioChanges?: { time: number; blockName: string; field: 'icr' | 'isf'; from: number; to: number }[];
  generatedAt?: number;
};

/** Doktora gösterilecek tek sayfalık/çok sayfalık rapor (HTML). PDF'e dönüştürülür. */
export function buildReportHtml({ entries, settings, from, to, ratioChanges = [], generatedAt = Date.now() }: ReportInput): string {
  const inRange = entries.filter((e) => e.time >= from && e.time < to).sort((a, b) => a.time - b.time);
  const st = rangeStats(inRange, settings);
  const periodLabel = dayLabel(from, false) === dayLabel(to - 1, false) ? dayLabel(from) : `${dayLabel(from, false)} – ${dayLabel(to - 1, false)}`;
  const blocks = sortBlocks(settings.blocks);
  const single = blocks.length === 1;

  const ratioRows = blocks
    .map(
      (b) =>
        `<tr><td>${single ? 'Tüm gün' : `${esc(b.name)} (${esc(b.start)}–${esc(blockEnd(settings.blocks, b))})`}</td><td>1 Ü = ${fmt(b.icr)} g</td><td>1 Ü ↓ ${fmt(b.isf, 0)} mg/dL</td><td>${b.target}</td><td>${b.low}–${b.high}</td></tr>`,
    )
    .join('');

  const changes = ratioChanges
    .filter((c) => c.time >= from && c.time < to)
    .map((c) => `<li>${esc(dayLabel(c.time, false))} ${timeLabel(c.time)}: ${esc(c.blockName)} ${c.field === 'icr' ? 'karbonhidrat oranı' : 'düzeltme faktörü'} ${fmt(c.from)} → ${fmt(c.to)}</li>`)
    .join('');

  const stat = (label: string, value: string) => `<div class=\"stat\"><div class=\"v\">${value}</div><div class=\"l\">${label}</div></div>`;
  const pct = (v: number | undefined) => (v === undefined ? '—' : `%${v}`);

  const days = groupByDay(inRange)
    .map(({ day, entries: es }) => {
      const s = rangeStats(es, settings);
      const head = `<h3>${esc(dayLabel(day))}</h3><div class=\"daysum\">${[
        s.avg !== undefined ? `Ort. şeker ${s.avg}` : '',
        s.readings ? `${s.readings} ölçüm (${s.min}–${s.max})` : '',
        s.carbs ? `${s.carbs} g KH` : '',
        s.bolus ? `${fmt(s.bolus)} Ü hızlı` : '',
        s.basal ? `${fmt(s.basal)} Ü bazal` : '',
        s.hypos ? `${s.hypos} hipo` : '',
      ]
        .filter(Boolean)
        .join(' · ')}</div>`;
      const rows = es
        .map((e) => {
          const bgCls = e.bg === undefined ? '' : e.bg < settings.hypoThreshold ? 'lo' : (() => { const b = activeBlock(settings.blocks, new Date(e.bgTime ?? e.time)); return b && e.bg > b.high ? 'hi' : ''; })();
          const food = foodLines(e);
          const mealName = MEALS.find((m) => m.id === entryMeal(e, settings.mealStarts))?.short ?? '';
          const measured = e.bg === undefined ? '' : e.bgTime && e.time - e.bgTime >= 5 * 60000 ? timeLabel(e.bgTime) : '<span class="same">aynı</span>';
          return `<tr><td>${timeLabel(e.time)}</td><td>${esc(mealName)}</td><td class=\"${bgCls}\">${num(e.bg, 0)}</td><td>${measured}</td><td>${num(e.carbs, 0)}</td><td>${food}</td><td>${num(e.bolus)}</td><td>${num(e.basal)}</td><td>${esc(entryNotes(e))}</td></tr>`;
        })
        .join('');
      return `<div class=\"day\">${head}<table class=\"log\"><thead><tr><th>Saat</th><th>Öğün</th><th>Şeker (mg/dL)</th><th>Ölçüm saati</th><th>KH (g)</th><th>Yemek</th><th>Hızlı (Ü)</th><th>Bazal (Ü)</th><th>Not</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    })
    .join('');

  const svg = chartSvg(inRange, settings, from, to);
  const mealRows = mealStats(inRange, settings)
    .filter((m) => m.count > 0)
    .map(
      (m) =>
        '<tr><td>' + esc(m.label) + '</td><td>' + m.count + '</td><td>' + (m.avgBgBefore ?? '—') + '</td><td>' + (m.avgBgAfter ?? '—') + '</td><td>' + (m.avgRise !== undefined ? (m.avgRise > 0 ? '+' : '') + m.avgRise + ' (' + m.pairs + ')' : '—') + '</td><td>' + (m.avgBg ?? '—') + '</td><td>' + (m.avgCarbs !== undefined ? m.avgCarbs + ' g' : '—') + '</td><td>' + (m.avgBolus !== undefined ? fmt(m.avgBolus) + ' Ü' : '—') + '</td><td>' + m.hypos + '</td></tr>',
    )
    .join('');

  return `<!DOCTYPE html><html lang=\"tr\"><head><meta charset=\"utf-8\"/><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"/>
<title>Diyabet raporu</title>
<style>
@page { size: A4; margin: 14mm; }
* { box-sizing: border-box; }
body { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #10292d; font-size: 11px; line-height: 1.4; margin: 0; }
h1 { font-size: 20px; margin: 0 0 2px; color: #085e68; }
h2 { font-size: 13px; margin: 16px 0 6px; padding-bottom: 3px; border-bottom: 2px solid #0b7a86; color: #085e68; }
h3 { font-size: 12px; margin: 12px 0 2px; }
.sub { color: #52686c; margin-bottom: 8px; }
.stats { display: flex; flex-wrap: wrap; gap: 6px; }
.stat { flex: 1 1 22%; min-width: 22%; background: #eef5f4; border-radius: 6px; padding: 6px 8px; }
.stat .v { font-size: 15px; font-weight: 700; }
.stat .l { color: #52686c; font-size: 9.5px; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 3px 5px; border-bottom: 1px solid #dbe6e5; vertical-align: top; }
th { background: #eef5f4; font-size: 9.5px; color: #3d5559; }
table.log td:nth-child(3), table.log td:nth-child(5), table.log td:nth-child(7), table.log td:nth-child(8) { text-align: right; white-space: nowrap; }
table.log th:nth-child(3), table.log th:nth-child(5), table.log th:nth-child(7), table.log th:nth-child(8) { text-align: right; }
table.log td:nth-child(1), table.log td:nth-child(2), table.log td:nth-child(4) { white-space: nowrap; }
table.meals td:not(:first-child), table.meals th:not(:first-child) { text-align: right; }
.lo { color: #c23a2e; font-weight: 700; } .hi { color: #b87400; font-weight: 700; }
.day { break-inside: avoid; } .daysum { color: #52686c; margin-bottom: 3px; }
ul { margin: 4px 0 0 16px; padding: 0; }
.same { color: #9aabae; }
.tir { display: flex; height: 10px; border-radius: 5px; overflow: hidden; margin-top: 8px; background: #e5eceb; }
.tirl { display: flex; justify-content: space-between; color: #52686c; font-size: 9.5px; margin-top: 3px; }
.foot { margin-top: 14px; color: #7a8d90; font-size: 9px; }
</style></head><body>
<h1>Diyabet raporu</h1>
<div class=\"sub\">${esc(settings.patientName ? settings.patientName + ' · ' : '')}${esc(periodLabel)} · ${Math.round((to - from) / DAY)} günlük aralıkta ${st.days} günün kaydı · ${inRange.length} kayıt</div>

<h2>Özet</h2>
<div class=\"stats\">
${stat('Ortalama şeker (mg/dL)', st.avg !== undefined ? String(st.avg) : '—')}
${stat('Hedef aralıkta', pct(st.inRange))}
${stat('Hedefin altında', pct(st.below))}
${stat('Hedefin üstünde', pct(st.above))}
${stat('Ölçüm sayısı (en düşük–en yüksek)', st.readings ? `${st.readings} (${st.min}–${st.max})` : '—')}
${stat('Tahmini HbA1c (GMI)', st.gmi !== undefined && st.readings >= 5 ? `%${st.gmi}` : '—')}
${stat('Değişkenlik: SS / CV', st.sd !== undefined ? `${st.sd} / %${st.cv ?? '—'}` : '—')}
${stat('Hipo atağı', String(st.hypos))}
${stat('Günlük karbonhidrat (ort.)', st.avgCarbsPerDay !== undefined ? `${st.avgCarbsPerDay} g` : '—')}
${stat(st.avgBasalPerDay === 0 && settings.basalDose ? 'Günlük hızlı insülin (bazal kaydı yok)' : 'Günlük toplam insülin (ort.)', st.avgTotalPerDay !== undefined ? `${fmt(st.avgTotalPerDay)} Ü` : '—')}
${stat('Günlük hızlı insülin (ort.)', st.avgBolusPerDay !== undefined ? `${fmt(st.avgBolusPerDay)} Ü` : '—')}
${st.avgBasalPerDay === 0 && settings.basalDose ? stat('Bazal', `kayıt yok · ayarlı ${fmt(settings.basalDose)} Ü`) : stat('Günlük bazal (ort.)', st.avgBasalPerDay !== undefined ? `${fmt(st.avgBasalPerDay)} Ü` : '—')}
</div>
${st.readings ? `<div class="tir"><div style="width:${st.below ?? 0}%;background:#c23a2e"></div><div style="width:${st.inRange ?? 0}%;background:#2e9e6b"></div><div style="width:${st.above ?? 0}%;background:#e0a02e"></div></div><div class="tirl"><span>Hedefin altı %${st.below ?? 0}</span><span>Hedef aralık %${st.inRange ?? 0}</span><span>Hedefin üstü %${st.above ?? 0}</span></div>` : ''}

${observationsHtml(inRange, settings)}

${mealRows ? `<h2>Öğünlere göre özet</h2><table class=\"meals\"><thead><tr><th>Öğün</th><th>Kayıt</th><th>Öğün öncesi (açlık) ort.</th><th>Tokluk ort.</th><th>Tokluk − açlık (çift)</th><th>Tüm ölçümler ort.</th><th>Ort. karbonhidrat</th><th>Ort. hızlı insülin</th><th>Hipo</th></tr></thead><tbody>${mealRows}</tbody></table>` : ''}

<h2>Kullanılan oranlar ve insülinler</h2>
<table><thead><tr><th>Saat dilimi</th><th>Karbonhidrat oranı</th><th>Düzeltme faktörü</th><th>Hedef (mg/dL)</th><th>Hedef aralık</th></tr></thead><tbody>${ratioRows}</tbody></table>
<div class=\"sub\" style=\"margin-top:6px\">Hızlı insülin: ${esc(settings.rapidName || 'adı girilmedi')} (etki süresi ${fmt(settings.dia)} sa, kalem adımı ${fmt(settings.penStep)} Ü)${settings.basalName || settings.basalDose ? ` · Bazal: ${esc(settings.basalName || '—')}${settings.basalDose ? ` ${fmt(settings.basalDose)} Ü` : ''}${settings.basalTime ? `, saat ${esc(settings.basalTime)}` : ''}` : ''}</div>
${changes ? `<div class=\"sub\">Bu aralıkta yapılan oran değişiklikleri:</div><ul>${changes}</ul>` : ''}

${svg ? `<h2>Şeker grafiği</h2>${svg}<div class=\"sub\">Yeşil bant: hedef aralık · kırmızı çizgi: ${settings.hypoThreshold} mg/dL</div>` : ''}

<h2>Günlük kayıtlar (ölçüm, yemek ve insülin saatleriyle)</h2>
${days || '<p>Bu aralıkta kayıt yok.</p>'}

<div class=\"foot\">Diyabet Asistanı ile oluşturuldu · ${esc(dayLabel(generatedAt, false))} ${timeLabel(generatedAt)}</div>
</body></html>`;
}
