import { fmt } from './bolus';
import { MEALS, entryMeal } from './meals';
import { activeBlock, blockEnd, sortBlocks } from './schedule';
import { computeStats, startOfDay } from './stats';
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
  if (e.exercise && e.exercise !== 'none') parts.push(exerciseTr[e.exercise]);
  if (e.note) parts.push(e.note);
  return parts.join(' · ');
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
    const withCarbs = es.filter((e) => e.carbs);
    return {
      meal: m.id,
      label: m.label,
      count: es.length,
      avgBg: r1(avg(es.filter((e) => e.bg !== undefined).map((e) => e.bg!)), 0),
      avgBgBefore: r1(avg(withCarbs.filter((e) => e.bg !== undefined).map((e) => e.bg!)), 0),
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

/** Aralık içindeki şeker ölçümlerinin çizgi grafiği (SVG metni); hedef aralık bandı ile */
export function chartSvg(entries: LogEntry[], settings: Settings, from: number, to: number): string {
  const W = 720;
  const H = 220;
  const pad = { l: 38, r: 10, t: 10, b: 28 };
  const bgs = entries.filter((e) => e.bg !== undefined).sort((a, b) => (a.bgTime ?? a.time) - (b.bgTime ?? b.time));
  if (bgs.length === 0) return '';
  const maxBg = Math.max(250, ...bgs.map((e) => e.bg!)) + 10;
  const minBg = 40;
  const pw = W - pad.l - pad.r;
  const ph = H - pad.t - pad.b;
  const x = (t: number) => pad.l + ((t - from) / Math.max(to - from, 1)) * pw;
  const y = (v: number) => pad.t + (1 - (Math.min(Math.max(v, minBg), maxBg) - minBg) / (maxBg - minBg)) * ph;

  // Hedef aralık bandı: dilimlere göre günlük tekrar eden zaman aralıkları
  const first = startOfDay(from);
  const bands: string[] = [];
  const blocks = sortBlocks(settings.blocks);
  for (let day = first; day < to; day += DAY) {
    blocks.forEach((b, i) => {
      const [sh, sm] = b.start.split(':').map(Number);
      const [eh, em] = blockEnd(settings.blocks, b).split(':').map(Number);
      const bs = day + (sh * 60 + sm) * 60000;
      let be = day + (eh * 60 + em) * 60000;
      if (be <= bs) be = day + DAY; // son dilim gece yarısına kadar
      const x1 = Math.max(x(bs), pad.l);
      const x2 = Math.min(x(be), W - pad.r);
      if (x2 > x1) bands.push(`<rect x=\"${x1.toFixed(1)}\" y=\"${y(b.high).toFixed(1)}\" width=\"${(x2 - x1).toFixed(1)}\" height=\"${(y(b.low) - y(b.high)).toFixed(1)}\" fill=\"#2e9e6b\" opacity=\"0.14\"/>`);
      void i;
    });
  }
  const grid = [70, 180, 250]
    .map((v) => `<line x1=\"${pad.l}\" x2=\"${W - pad.r}\" y1=\"${y(v)}\" y2=\"${y(v)}\" stroke=\"${v === 70 ? '#c23a2e' : '#cbd5d3'}\" stroke-dasharray=\"4 4\"/><text x=\"${pad.l - 4}\" y=\"${y(v) + 3}\" font-size=\"9\" text-anchor=\"end\" fill=\"#52686c\">${v}</text>`)
    .join('');
  // Gün çizgileri ve etiketleri
  const days = Math.max(1, Math.round((to - from) / DAY));
  const stepDays = days <= 8 ? 1 : days <= 16 ? 2 : 5;
  const dayLines: string[] = [];
  for (let i = 0, t = first; t <= to; i++, t += DAY) {
    if (t < from) continue;
    dayLines.push(`<line x1=\"${x(t).toFixed(1)}\" x2=\"${x(t).toFixed(1)}\" y1=\"${pad.t}\" y2=\"${H - pad.b}\" stroke=\"#e2ebea\"/>`);
    if (i % stepDays === 0) dayLines.push(`<text x=\"${(x(t) + 2).toFixed(1)}\" y=\"${H - 12}\" font-size=\"9\" fill=\"#52686c\">${new Date(t).getDate()}.${new Date(t).getMonth() + 1}</text>`);
  }
  const path = bgs.map((e, i) => `${i ? 'L' : 'M'}${x(e.bgTime ?? e.time).toFixed(1)},${y(e.bg!).toFixed(1)}`).join(' ');
  const dots = bgs
    .map((e) => `<circle cx=\"${x(e.bgTime ?? e.time).toFixed(1)}\" cy=\"${y(e.bg!).toFixed(1)}\" r=\"2.6\" fill=\"${e.bg! < settings.hypoThreshold ? '#c23a2e' : e.bg! > 180 ? '#b87400' : '#0b7a86'}\"/>`)
    .join('');
  return `<svg viewBox=\"0 0 ${W} ${H}\" width=\"100%\" xmlns=\"http://www.w3.org/2000/svg\" font-family=\"Arial, sans-serif\">${bands.join('')}${dayLines.join('')}${grid}<path d=\"${path}\" fill=\"none\" stroke=\"#0b7a86\" stroke-width=\"1.4\" opacity=\"0.7\"/>${dots}</svg>`;
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
          const food = e.foods ? esc(e.foods) : '';
          const mealName = MEALS.find((m) => m.id === entryMeal(e, settings.mealStarts))?.short ?? '';
          const measured = e.bg !== undefined ? timeLabel(e.bgTime ?? e.time) : '';
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
        '<tr><td>' + esc(m.label) + '</td><td>' + m.count + '</td><td>' + (m.avgBgBefore ?? '—') + '</td><td>' + (m.avgBg ?? '—') + '</td><td>' + (m.avgCarbs !== undefined ? m.avgCarbs + ' g' : '—') + '</td><td>' + (m.avgBolus !== undefined ? fmt(m.avgBolus) + ' Ü' : '—') + '</td><td>' + m.hypos + '</td></tr>',
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
.foot { margin-top: 14px; color: #7a8d90; font-size: 9px; }
</style></head><body>
<h1>Diyabet raporu</h1>
<div class=\"sub\">${esc(settings.patientName ? settings.patientName + ' · ' : '')}${esc(periodLabel)} · ${st.days} günün kaydı · ${inRange.length} kayıt</div>

<h2>Özet</h2>
<div class=\"stats\">
${stat('Ortalama şeker (mg/dL)', st.avg !== undefined ? String(st.avg) : '—')}
${stat('Hedef aralıkta', pct(st.inRange))}
${stat('Hedefin altında', pct(st.below))}
${stat('Hedefin üstünde', pct(st.above))}
${stat('Ölçüm sayısı (en düşük–en yüksek)', st.readings ? `${st.readings} (${st.min}–${st.max})` : '—')}
${stat('Hipo atağı', String(st.hypos))}
${stat('Günlük karbonhidrat (ort.)', st.avgCarbsPerDay !== undefined ? `${st.avgCarbsPerDay} g` : '—')}
${stat('Günlük toplam insülin (ort.)', st.avgTotalPerDay !== undefined ? `${fmt(st.avgTotalPerDay)} Ü` : '—')}
${stat('Günlük hızlı insülin (ort.)', st.avgBolusPerDay !== undefined ? `${fmt(st.avgBolusPerDay)} Ü` : '—')}
${stat('Günlük bazal (ort.)', st.avgBasalPerDay !== undefined ? `${fmt(st.avgBasalPerDay)} Ü` : '—')}
</div>

${mealRows ? `<h2>Öğünlere göre özet</h2><table class=\"meals\"><thead><tr><th>Öğün</th><th>Kayıt</th><th>Öğün öncesi ort. şeker</th><th>Ort. şeker</th><th>Ort. karbonhidrat</th><th>Ort. hızlı insülin</th><th>Hipo</th></tr></thead><tbody>${mealRows}</tbody></table>` : ''}

<h2>Kullanılan oranlar ve insülinler</h2>
<table><thead><tr><th>Saat dilimi</th><th>Karbonhidrat oranı</th><th>Düzeltme faktörü</th><th>Hedef (mg/dL)</th><th>Hedef aralık</th></tr></thead><tbody>${ratioRows}</tbody></table>
<div class=\"sub\" style=\"margin-top:6px\">Hızlı insülin: ${esc(settings.rapidName || '—')} (etki süresi ${fmt(settings.dia)} sa, kalem adımı ${fmt(settings.penStep)} Ü)${settings.basalName || settings.basalDose ? ` · Bazal: ${esc(settings.basalName || '—')}${settings.basalDose ? ` ${fmt(settings.basalDose)} Ü` : ''}${settings.basalTime ? `, saat ${esc(settings.basalTime)}` : ''}` : ''}</div>
${changes ? `<div class=\"sub\">Bu aralıkta yapılan oran değişiklikleri:</div><ul>${changes}</ul>` : ''}

${svg ? `<h2>Şeker grafiği</h2>${svg}<div class=\"sub\">Yeşil bant: hedef aralık · kırmızı çizgi: ${settings.hypoThreshold} mg/dL</div>` : ''}

<h2>Günlük kayıtlar (ölçüm, yemek ve insülin saatleriyle)</h2>
${days || '<p>Bu aralıkta kayıt yok.</p>'}

<div class=\"foot\">Diyabet Asistanı ile oluşturuldu · ${esc(dayLabel(generatedAt, false))} ${timeLabel(generatedAt)}</div>
</body></html>`;
}
