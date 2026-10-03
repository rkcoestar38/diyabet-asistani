import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Btn, Card, DateField, Field, KV, Notice, Pressy, Row, Screen, T, Toggle, notify } from '@/components/ui';
import { Radius, useTheme } from '@/constants/theme';
import { sharePdf, shareText, toCsv } from '@/lib/files';
import { useNow } from '@/lib/hooks';
import { parseDateInput, toDateInput } from '@/lib/input';
import { fmt } from '@/logic/bolus';
import { DEFAULT_REPORT_SECTIONS, buildReportHtml, dayLabel, rangeStats, type ReportSections } from '@/logic/report';
import { getDayOffset, startOfDay } from '@/logic/stats';
import { useLog } from '@/store/log';
import { useSettings } from '@/store/settings';
import { useTests } from '@/store/tests';

const DAY = 86400000;
type Preset = 'today' | '7' | '14' | '30' | 'custom';

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'today', label: 'Bugün' },
  { value: '7', label: 'Son 7 gün' },
  { value: '14', label: 'Son 14 gün' },
  { value: '30', label: 'Son 30 gün' },
  { value: 'custom', label: 'Tarih seç' },
];

const SECTION_OPTIONS: { key: keyof ReportSections; label: string }[] = [
  { key: 'summary', label: 'Özet istatistikler ve hedef aralık (TIR)' },
  { key: 'observations', label: 'Dikkat çeken noktalar (Doktor gözlemleri)' },
  { key: 'meals', label: 'Öğünlere göre özet' },
  { key: 'ratios', label: 'Kullanılan oranlar ve insülinler' },
  { key: 'analysis', label: 'Gidişat ve bazal analizi' },
  { key: 'chart', label: 'Şeker grafiği' },
  { key: 'dailyLogs', label: 'Detaylı günlük kayıtlar' },
];

export default function Report() {
  const c = useTheme();
  const now = useNow(60000);
  const entries = useLog((s) => s.entries);
  const settings = useSettings((s) => s.settings);
  const history = useSettings((s) => s.ratioHistory);
  const finishedTests = useTests((s) => s.finished);
  const today = startOfDay(now);

  const [preset, setPreset] = useState<Preset>('14');
  const [fromText, setFromText] = useState(toDateInput(today - 13 * DAY));
  const [toText, setToText] = useState(toDateInput(today));
  const [name, setName] = useState(settings.patientName ?? '');
  const [sections, setSections] = useState<ReportSections>(DEFAULT_REPORT_SECTIONS);
  const [busy, setBusy] = useState(false);

  const range = useMemo<{ error: string } | { from: number; to: number }>(() => {
    if (preset === 'custom') {
      const f = parseDateInput(fromText);
      const t = parseDateInput(toText);
      if (f === undefined || t === undefined) return { error: 'Başlangıç ve bitiş tarihini yaz (sadece rakamlar yeterli, noktalar kendiliğinden gelir).' };
      if (t < f) return { error: 'Bitiş tarihi başlangıçtan önce olamaz.' };
      return { from: f + getDayOffset() * 60000, to: t + DAY + getDayOffset() * 60000 };
    }
    const days = preset === 'today' ? 1 : Number(preset);
    return { from: today - (days - 1) * DAY, to: today + DAY };
  }, [preset, fromText, toText, today]);

  const bad = 'error' in range;
  const inRange = bad ? [] : entries.filter((e) => e.time >= range.from && e.time < range.to);
  const stats = rangeStats(inRange, settings);
  const hasAnySection = Object.values(sections).some(Boolean);

  function pickPreset(p: Preset) {
    setPreset(p);
    if (p === 'custom') return;
    const days = p === 'today' ? 1 : Number(p);
    setFromText(toDateInput(today - (days - 1) * DAY));
    setToText(toDateInput(today));
  }

  function selectAllSections() {
    setSections({
      summary: true,
      observations: true,
      meals: true,
      ratios: true,
      analysis: true,
      chart: true,
      dailyLogs: true,
    });
  }

  function selectSummaryOnly() {
    setSections({
      summary: true,
      observations: false,
      meals: false,
      ratios: false,
      analysis: false,
      chart: false,
      dailyLogs: false,
    });
  }

  function clearAllSections() {
    setSections({
      summary: false,
      observations: false,
      meals: false,
      ratios: false,
      analysis: false,
      chart: false,
      dailyLogs: false,
    });
  }

  async function exportPdf() {
    if ('error' in range || !hasAnySection) return;
    setBusy(true);
    try {
      const html = buildReportHtml({
        entries,
        settings: { ...settings, patientName: name.trim() || undefined },
        from: range.from,
        to: range.to,
        ratioChanges: history,
        basalTests: finishedTests.filter((t) => t.kind === 'basal'),
        sections,
      });
      const tag = `${toDateInput(range.from).replace(/\./g, '-')}_${toDateInput(range.to - DAY).replace(/\./g, '-')}`;
      await sharePdf(html, `diyabet-raporu-${tag}.pdf`);
    } catch (e) {
      notify('Rapor oluşturulamadı', String(e));
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    if ('error' in range) return;
    try {
      await shareText(`diyabet-kayitlar-${toDateInput(range.from).replace(/\./g, '-')}.csv`, toCsv(inRange, settings.mealStarts), 'text/csv');
    } catch (e) {
      notify('Dışa aktarılamadı', String(e));
    }
  }

  return (
    <Screen>
      <Card title="Hangi günler?" icon="calendar-outline">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {PRESETS.map((p) => {
            const active = p.value === preset;
            return (
              <Pressy
                key={p.value}
                onPress={() => pickPreset(p.value)}
                style={{
                  borderWidth: 1.5,
                  borderRadius: Radius.pill,
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  borderColor: active ? c.primary : c.border,
                  backgroundColor: active ? c.primarySoft : c.cardAlt,
                }}>
                <T variant="small" color={active ? 'primary' : 'text'} style={{ fontWeight: '600' }}>
                  {p.label}
                </T>
              </Pressy>
            );
          })}
        </View>
        {preset === 'custom' ? (
          <Row>
            <DateField label="Başlangıç" value={fromText} onChange={setFromText} />
            <DateField label="Bitiş" value={toText} onChange={setToText} />
          </Row>
        ) : null}
        {'error' in range ? <Notice level="danger" text={range.error} /> : null}
      </Card>

      {!('error' in range) ? (
        <Card title="Dönem özeti" icon="document-text-outline">
          <T variant="muted">
            {dayLabel(range.from, false)}
            {range.to - DAY > range.from ? ` – ${dayLabel(range.to - DAY, false)}` : ''}
          </T>
          <KV k="Kayıtlı gün" v={`${stats.days}`} />
          <KV k="Şeker ölçümü" v={`${stats.readings}`} />
          <KV k="Ortalama şeker" v={stats.avg !== undefined ? `${stats.avg} mg/dL` : '—'} />
          <KV k="Hedef aralıkta" v={stats.inRange !== undefined ? `%${stats.inRange}` : '—'} />
          <KV k="Günlük karbonhidrat (ort.)" v={stats.avgCarbsPerDay !== undefined ? `${stats.avgCarbsPerDay} g` : '—'} />
          <KV k="Günlük toplam insülin (ort.)" v={stats.avgTotalPerDay !== undefined ? `${fmt(stats.avgTotalPerDay)} Ü` : '—'} />
          <Field label="Raporda görünecek ad (isteğe bağlı)" keyboard="text" value={name} onChangeText={setName} />
        </Card>
      ) : null}

      {!('error' in range) ? (
        <Card title="Rapora eklenecek bölümler" icon="options-outline">
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end', alignItems: 'center', marginBottom: 4 }}>
            <Pressy onPress={selectAllSections}>
              <T variant="small" color="primary" style={{ fontWeight: '600' }}>
                Tümünü seç
              </T>
            </Pressy>
            <T variant="small" color="muted">
              ·
            </T>
            <Pressy onPress={selectSummaryOnly}>
              <T variant="small" color="primary" style={{ fontWeight: '600' }}>
                Sadece özet
              </T>
            </Pressy>
            <T variant="small" color="muted">
              ·
            </T>
            <Pressy onPress={clearAllSections}>
              <T variant="small" color="muted" style={{ fontWeight: '600' }}>
                Temizle
              </T>
            </Pressy>
          </View>
          {SECTION_OPTIONS.map((opt) => (
            <Toggle
              key={opt.key}
              label={opt.label}
              value={sections[opt.key]}
              onChange={(val) => setSections((prev) => ({ ...prev, [opt.key]: val }))}
            />
          ))}
        </Card>
      ) : null}

      <Btn
        title={busy ? 'Hazırlanıyor…' : 'PDF raporu paylaş'}
        icon="share-outline"
        disabled={busy || bad || inRange.length === 0 || !hasAnySection}
        onPress={exportPdf}
      />
      {!bad && inRange.length === 0 ? <Notice level="info" text="Seçtiğin aralıkta kayıt yok. Başka bir aralık seç." /> : null}
      {!bad && inRange.length > 0 && !hasAnySection ? <Notice level="warn" text="Rapora eklenecek en az bir bölüm seçmelisin." /> : null}
      <Btn variant="secondary" icon="grid-outline" title="Excel için CSV paylaş" disabled={bad || inRange.length === 0} onPress={exportCsv} />
      <T variant="small" style={{ textAlign: 'center' }}>
        Paylaşım menüsünden WhatsApp, e-posta ya da yazdır seçebilirsin.
      </T>
    </Screen>
  );
}
