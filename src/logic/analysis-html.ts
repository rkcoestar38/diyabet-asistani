import { fmt } from './bolus';
import {
  basalSentence,
  basalSummary,
  blockSuggestions,
  evaluate,
  fastingWindows,
  manualBasalTests,
  mealGroupStats,
  periodSeries,
  recentEval,
  trendOf,
  trendSentence,
} from './optimizer';
import { MIN_SAMPLES } from './ratios';
import type { LogEntry, Settings } from './types';

const esc = (s: string | number | undefined) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const date = (t: number) => new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
const dateTime = (t: number) => new Date(t).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const dash = (v: number | undefined, unit = '') => (v === undefined ? '—' : `${fmt(v)}${unit}`);

/**
 * Doktor raporu: kayıtlardan hesaplanan oran ve bazal değerlendirmesi.
 * Yemek öncesi şeker, karbonhidrat, doz ve 2,5–5 saat sonraki ölçümden gerçekleşen oranlar; öğün ve dönem bazında; gece bazal eğilimi.
 */
export function analysisHtml(input: {
  entries: LogEntry[];
  settings: Settings;
  /** Değerlendirmenin bitişi (genelde rapor aralığının sonu veya şimdi) */
  now: number;
  basalTests?: { startTime: number; endTime: number }[];
}): string {
  const { entries, settings, now, basalTests = [] } = input;
  const all = evaluate(entries, settings, now);
  const ev = recentEval(all, now); // öneriler ve öğün özeti son 6 haftadan
  const windows = fastingWindows(entries, settings, now);
  const basal = basalSummary(windows, settings.basalDose);
  const manual = manualBasalTests(entries, basalTests.filter((t) => t.endTime <= now).slice(0, 8));
  const nothing = all.candidates.icr + all.candidates.isf === 0 && windows.length === 0 && manual.length === 0;
  if (nothing) return '';

  const icrGroups = mealGroupStats(ev.icr, 'icr').filter((g) => g.n > 0);
  const icrRows = icrGroups
    .map(
      (g) =>
        `<tr><td>${esc(g.label)}</td><td>${dash(g.current)}</td><td>${dash(g.observed)}</td><td>${g.n}${g.n < MIN_SAMPLES ? ' (yetersiz)' : ''}</td><td>${g.suggested !== undefined && g.current !== undefined && Math.abs(g.suggested - g.current) >= 0.5 ? `<b>${fmt(g.suggested)}</b>` : g.suggested !== undefined ? 'değişiklik gerekmiyor' : '—'}</td></tr>`,
    )
    .join('');

  const single = settings.blocks.length === 1;
  const isfRows = blockSuggestions(ev.isf, settings.blocks, 'isf')
    .filter((s) => s.samples.length > 0)
    .map((s) => {
      const b = settings.blocks.find((x) => x.id === s.blockId)!;
      const changed = s.suggested !== undefined && Math.abs(s.suggested - s.current) >= 1;
      return `<tr><td>${single ? 'Tüm gün' : esc(b.name)}</td><td>${fmt(s.current)}</td><td>${dash(s.observed)}</td><td>${s.samples.length}${s.samples.length < MIN_SAMPLES ? ' (yetersiz)' : ''}</td><td>${changed ? `<b>${fmt(s.suggested!)}</b>` : s.suggested !== undefined ? 'değişiklik gerekmiyor' : '—'}</td></tr>`;
    })
    .join('');

  const periods = periodSeries(all, now);
  const periodRows = periods
    .filter((p) => p.icr.n > 0 || p.isf.n > 0)
    .map(
      (p) =>
        `<tr><td>${date(p.from + 1)} – ${date(p.to)}</td><td>${p.icr.value !== undefined ? `1 Ü = ${fmt(p.icr.value)} g` : '—'} (${p.icr.n})</td><td>${p.isf.value !== undefined ? `1 Ü = ${fmt(p.isf.value, 0)} mg/dL` : '—'} (${p.isf.n})</td></tr>`,
    )
    .join('');

  const tIcr = trendOf(all.icr, now);
  const tIsf = trendOf(all.isf, now);
  const trendLines = [trendSentence('icr', tIcr), trendSentence('isf', tIsf)].map((t) => `<li>${esc(t)}</li>`).join('');

  const nights = windows
    .slice(-10)
    .reverse()
    .map((w) => `<tr><td>${esc(dateTime(w.from))} → ${esc(dateTime(w.to))}</td><td>${w.fromBg} → ${w.toBg}</td><td>${w.drift > 0 ? '+' : ''}${w.drift}</td><td>${w.perHour > 0 ? '+' : ''}${fmt(w.perHour)}</td></tr>`)
    .join('');
  const manualRows = manual
    .map(
      (m) =>
        `<tr><td>${esc(dateTime(m.start))} → ${esc(dateTime(m.end))}</td><td>${m.readings}</td><td>${m.drift !== undefined ? `${m.drift > 0 ? '+' : ''}${m.drift}` : '—'}</td><td>${m.broken ? 'geçersiz: ' + esc(m.broken) : m.verdict === 'ok' ? 'sabit' : m.verdict === 'rising' ? 'yükseldi' : m.verdict === 'falling' ? 'düştü' : 'yetersiz ölçüm'}</td></tr>`,
    )
    .join('');

  const used = all.icr.length + all.isf.length;
  const total = all.candidates.icr + all.candidates.isf;
  const reasons = all.rejected.slice(0, 5).map((r) => `<li>${esc(r.reason)}: ${r.count} kayıt</li>`).join('');

  return `<h2>Oran ve doz değerlendirmesi (kayıtlardan)</h2>
<div class="sub">Yemek öncesi şeker, karbonhidrat, doz ve yemekten 2,5–5 saat sonraki ölçümden hesaplanan gerçekleşen oranlar (ortanca). Öğün ve doz önerileri son 6 haftanın kayıtlarından, en az ${MIN_SAMPLES} uygun kayıtla hesaplanır; ayarlıdan en fazla %20 farklıdır ve otomatik uygulanmaz.</div>
${icrRows ? `<table class="meals"><thead><tr><th>Karbonhidrat oranı</th><th>Ayarlı (g/Ü)</th><th>Gerçekleşen (g/Ü)</th><th>Kayıt</th><th>Öneri</th></tr></thead><tbody>${icrRows}</tbody></table>` : '<div class="sub">Karbonhidrat oranı için uygun kayıt yok.</div>'}
${isfRows ? `<table class="meals" style="margin-top:6px"><thead><tr><th>Düzeltme faktörü</th><th>Ayarlı (mg/dL/Ü)</th><th>Gerçekleşen (mg/dL/Ü)</th><th>Kayıt</th><th>Öneri</th></tr></thead><tbody>${isfRows}</tbody></table>` : ''}
<h3>Zaman içindeki değişim</h3>
<ul>${trendLines}</ul>
${periodRows ? `<table class="meals"><thead><tr><th>Dönem (14 gün)</th><th>Gerçekleşen KH oranı (kayıt)</th><th>Gerçekleşen düzeltme (kayıt)</th></tr></thead><tbody>${periodRows}</tbody></table>` : ''}
<h3>Bazal insülin (gece, yemeksiz ve dozsuz ölçümlerden)</h3>
<ul><li>${esc(basalSentence(basal))}${basal.suggestedDose !== undefined ? ` Bazal doz: ayarlı ${fmt(settings.basalDose)} Ü; değerlendirilebilecek doz ${fmt(basal.suggestedDose)} Ü (doktor onayıyla).` : ''}</li></ul>
${nights ? `<table class="meals"><thead><tr><th>Gece (ölçüm saatleri)</th><th>Şeker (mg/dL)</th><th>Değişim</th><th>mg/dL/saat</th></tr></thead><tbody>${nights}</tbody></table>` : ''}
${manualRows ? `<div class="sub" style="margin-top:6px">Rehberli bazal testleri:</div><table class="meals"><thead><tr><th>Test</th><th>Ölçüm</th><th>Değişim (mg/dL)</th><th>Sonuç</th></tr></thead><tbody>${manualRows}</tbody></table>` : ''}
${total > 0 ? `<div class="sub" style="margin-top:6px">Veri: ${total} yemek/düzeltme kaydından ${used}'i analize uygun${all.pending ? `, ${all.pending}'i henüz bekleniyor` : ''}.${reasons ? '' : ''}</div>${reasons ? `<ul>${reasons}</ul>` : ''}` : ''}`;
}
