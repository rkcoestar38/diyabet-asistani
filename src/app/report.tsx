import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Btn, Card, DateField, Field, KV, Notice, Pressy, Row, Screen, T, notify } from '@/components/ui';
import { Radius, useTheme } from '@/constants/theme';
import { sharePdf, shareText, toCsv } from '@/lib/files';
import { useNow } from '@/lib/hooks';
import { parseDateInput, toDateInput } from '@/lib/input';
import { fmt } from '@/logic/bolus';
import { buildReportHtml, dayLabel, rangeStats } from '@/logic/report';
import { startOfDay } from '@/logic/stats';
import { useLog } from '@/store/log';
import { useSettings } from '@/store/settings';

const DAY = 86400000;
type Preset = 'today' | '7' | '14' | '30' | 'custom';

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'today', label: 'Bugün' },
  { value: '7', label: 'Son 7 gün' },
  { value: '14', label: 'Son 14 gün' },
  { value: '30', label: 'Son 30 gün' },
  { value: 'custom', label: 'Tarih seç' },
];

export default function Report() {
  const c = useTheme();
  const now = useNow(60000);
  const entries = useLog((s) => s.entries);
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const history = useSettings((s) => s.ratioHistory);
  const today = startOfDay(now);

  const [preset, setPreset] = useState<Preset>('14');
  const [fromText, setFromText] = useState(toDateInput(today - 13 * DAY));
  const [toText, setToText] = useState(toDateInput(today));
  const [name, setName] = useState(settings.patientName ?? '');
  const [busy, setBusy] = useState(false);

  const range = useMemo<{ error: string } | { from: number; to: number }>(() => {
    if (preset === 'custom') {
      const f = parseDateInput(fromText);
      const t = parseDateInput(toText);
      if (f === undefined || t === undefined) return { error: 'Başlangıç ve bitiş tarihini yaz (sadece rakamlar yeterli, noktalar kendiliğinden gelir).' };
      if (t < f) return { error: 'Bitiş tarihi başlangıçtan önce olamaz.' };
      return { from: f, to: t + DAY };
    }
    const days = preset === 'today' ? 1 : Number(preset);
    return { from: today - (days - 1) * DAY, to: today + DAY };
  }, [preset, fromText, toText, today]);

  const bad = 'error' in range;
  const inRange = bad ? [] : entries.filter((e) => e.time >= range.from && e.time < range.to);
  const stats = rangeStats(inRange, settings);

  function pickPreset(p: Preset) {
    setPreset(p);
    if (p === 'custom') return;
    const days = p === 'today' ? 1 : Number(p);
    setFromText(toDateInput(today - (days - 1) * DAY));
    setToText(toDateInput(today));
  }

  async function exportPdf() {
    if ('error' in range) return;
    setBusy(true);
    try {
      update({ patientName: name.trim() || undefined });
      const html = buildReportHtml({
        entries,
        settings: { ...settings, patientName: name.trim() || undefined },
        from: range.from,
        to: range.to,
        ratioChanges: history,
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
        <Card title="Raporda olacaklar" icon="document-text-outline">
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
          <T variant="small">
            Ayrıca: saat dilimlerine göre karbonhidrat oranın ve düzeltme faktörün, hedef aralığın, insülin adların, şeker grafiği ve her günün ölçüm,
            yemek ve insülin saatleriyle tam kaydı.
          </T>
          <Field label="Raporda görünecek ad (isteğe bağlı)" keyboard="text" value={name} onChangeText={setName} />
        </Card>
      ) : null}

      <Btn title={busy ? 'Hazırlanıyor…' : 'PDF raporu paylaş'} icon="share-outline" disabled={busy || bad || inRange.length === 0} onPress={exportPdf} />
      {!bad && inRange.length === 0 ? <Notice level="info" text="Seçtiğin aralıkta kayıt yok. Başka bir aralık seç." /> : null}
      <Btn variant="secondary" icon="grid-outline" title="Excel için CSV paylaş" disabled={bad || inRange.length === 0} onPress={exportCsv} />
      <T variant="small" style={{ textAlign: 'center' }}>
        Paylaşım menüsünden WhatsApp, e-posta ya da yazdır seçebilirsin.
      </T>
    </Screen>
  );
}
