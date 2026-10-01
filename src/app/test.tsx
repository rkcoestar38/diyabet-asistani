import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Steps } from '@/components/guide';
import { LabelCalculator } from '@/components/label-calc';
import { Btn, Card, Field, KV, Notice, Row, Screen, T, confirm, parseNum } from '@/components/ui';
import { useCob, useIob, useNow } from '@/lib/hooks';
import { BG_MAX, BG_MIN, calcBolus, fmt } from '@/logic/bolus';
import { ICR_WINDOW, ISF_WINDOW, MIN_SAMPLES, analyzeIcr, analyzeIsf, basalTestResult, icrSample, isfSample, type SampleResult } from '@/logic/ratios';
import { activeBlock } from '@/logic/schedule';
import type { LogEntry } from '@/logic/types';
import { useLog } from '@/store/log';
import { useSettings } from '@/store/settings';
import { TEST_INFO } from '@/lib/test-info';
import { useTests, type TestKind } from '@/store/tests';

export default function TestScreen() {
  const params = useLocalSearchParams<{ kind?: TestKind }>();
  const active = useTests((s) => s.active);
  if (active) return <ActiveTest />;
  return <StartTest kind={params.kind ?? 'icr'} />;
}

function bgError(bg: number | undefined) {
  return bg !== undefined && !(bg >= BG_MIN && bg <= BG_MAX) ? `Şeker ${BG_MIN}–${BG_MAX} arasında olmalı.` : undefined;
}

function StartTest({ kind }: { kind: TestKind }) {
  const now = useNow();
  const settings = useSettings((s) => s.settings);
  const entries = useLog((s) => s.entries);
  const addLog = useLog((s) => s.add);
  const start = useTests((s) => s.start);
  const iob = useIob(now);
  const cob = useCob(now);
  const info = TEST_INFO[kind];
  const block = activeBlock(settings.blocks, new Date(now))!;
  const profile = { dia: settings.dia, peak: settings.peak };

  const [bgText, setBgText] = useState('');
  const [carbText, setCarbText] = useState('');
  const [givenText, setGivenText] = useState('');
  const [showLabel, setShowLabel] = useState(false);
  const bg = parseNum(bgText);
  const carbs = kind === 'icr' ? (parseNum(carbText) ?? 0) : 0;

  const bolus = kind !== 'basal' && bg !== undefined ? calcBolus({ bg, carbs, block, iob, cob, settings }) : undefined;
  const given = parseNum(givenText) ?? bolus?.dose;

  // Başlamadan önce uygunluk: geçici kayıtla örnek hesaplanır; "beklemede" sonucu testin geçerli başladığını gösterir.
  let check: SampleResult | undefined;
  let basalProblem: string | undefined;
  if (bg !== undefined && !bgError(bg)) {
    const tmp: LogEntry = { id: '__tmp', time: now, bg, carbs: carbs || undefined, bolus: given || undefined };
    if (kind === 'icr' && carbs >= 10 && given) check = icrSample([...entries, tmp], tmp.id, settings.blocks, profile, now);
    if (kind === 'isf' && given) check = isfSample([...entries, tmp], tmp.id, settings.blocks, profile, now);
    if (kind === 'basal') {
      if (bg < 100 || bg > 200) basalProblem = 'Bazal teste şekerin 100–200 arasındayken başla.';
      else if (iob > 0.3) basalProblem = `Vücudunda hâlâ ${fmt(iob)} Ü aktif insülin var; son dozdan en az 4 saat sonra başla.`;
      else if (cob > 5) basalProblem = 'Son yemeğin hâlâ sindiriliyor; son yemekten en az 4 saat sonra başla.';
    }
  }
  const ready =
    bg !== undefined &&
    !bgError(bg) &&
    (kind === 'basal' ? !basalProblem : !!check && !check.ok && !!check.pending && bolus?.status === 'ok');

  function begin() {
    const entry = addLog({
      bg,
      carbs: kind === 'icr' ? carbs : undefined,
      bolus: kind === 'basal' ? undefined : given,
      mealBolus: kind === 'icr' && bolus ? bolus.meal : undefined,
      correctionBolus: kind !== 'basal' && bolus ? bolus.correction : undefined,
      note: `${info.title} başlangıcı`,
    });
    start({ kind, entryId: kind === 'basal' ? undefined : entry.id, startTime: entry.time });
  }

  return (
    <Screen>
      <Card title={info.title} icon="flask">
        <T>{info.what}</T>
        <T variant="muted">
          <T variant="muted" style={{ fontWeight: '700' }}>
            Ne zaman?{' '}
          </T>
          {info.when}
        </T>
        <Steps items={info.steps} />
      </Card>

      <Card title="Başlayalım" icon="play-circle">
        <Row>
          <Field label="Şu anki şekerin" suffix="mg/dL" value={bgText} onChangeText={setBgText} big placeholder="—" />
          {kind === 'icr' ? <Field label="Öğünün karbonhidratı" suffix="g" value={carbText} onChangeText={setCarbText} big step={5} placeholder="0" /> : null}
        </Row>
        {kind === 'icr' ? (
          <>
            <Btn small variant="secondary" icon="barcode-outline" title="Etiketten hesapla" onPress={() => setShowLabel(!showLabel)} />
            {showLabel ? (
              <LabelCalculator
                onUse={(g) => {
                  setCarbText(String(g));
                  setShowLabel(false);
                }}
              />
            ) : null}
          </>
        ) : null}
        {bgError(bg) ? <Notice level="danger" text={bgError(bg)!} /> : null}

        {bolus && bolus.status !== 'ok' ? bolus.warnings.map((w) => <Notice key={w.text} {...w} />) : null}
        {bolus?.status === 'ok' && (kind === 'isf' || carbs >= 10) ? (
          <>
            <View style={{ alignItems: 'center' }}>
              <T variant="label">Şu anki oranına göre doz</T>
              <T variant="big" color="primary">
                {fmt(bolus.dose)} Ü
              </T>
            </View>
            <Field label="Vurduğun doz (farklıysa değiştir)" suffix="Ü" value={givenText} placeholder={fmt(bolus.dose)} onChangeText={setGivenText} step={0.5} base={bolus.dose} />
          </>
        ) : null}
        {bolus?.status === 'ok' && bolus.dose === 0 && (kind === 'isf' || carbs >= 10) ? (
          <Notice level="info" text="Şu an doz gerekmiyor; bu test için uygun zaman değil." />
        ) : null}
        {kind === 'icr' && bg !== undefined && carbs > 0 && carbs < 10 ? <Notice level="info" text="Test için en az 10 g karbonhidratlı bir öğün gerekli." /> : null}

        {check && !(!check.ok && check.pending) ? (
          <Notice level="warn" text={`Şu an test için uygun değil: ${check.ok ? '' : check.reason}`} />
        ) : null}
        {basalProblem ? <Notice level="warn" text={basalProblem} /> : null}

        <Btn title="Testi başlat" icon="play" disabled={!ready} onPress={begin} />
        <T variant="small">Testi başlatınca ölçüm{kind === 'basal' ? '' : ' ve dozun'} günlüğe kaydedilir.</T>
      </Card>
    </Screen>
  );
}

function ActiveTest() {
  const now = useNow(15000);
  const settings = useSettings((s) => s.settings);
  const entries = useLog((s) => s.entries);
  const addLog = useLog((s) => s.add);
  const active = useTests((s) => s.active)!;
  const finish = useTests((s) => s.finish);
  const cancel = useTests((s) => s.cancel);
  const [bgText, setBgText] = useState('');
  const profile = { dia: settings.dia, peak: settings.peak };
  const info = TEST_INFO[active.kind];
  const bg = parseNum(bgText);
  const minutes = Math.floor((now - active.startTime) / 60000);

  function addReading() {
    if (bg === undefined || bgError(bg)) return;
    addLog({ bg, note: `${info.title} ölçümü` });
    setBgText('');
    if (bg < settings.hypoThreshold) {
      if (active.kind === 'basal') finish();
      router.push({ pathname: '/hypo', params: { bg: String(bg) } });
    }
  }

  const header = (
    <Card title={info.title} icon="flask">
      <KV k="Başlangıç" v={new Date(active.startTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} />
      <KV k="Geçen süre" v={`${Math.floor(minutes / 60)} sa ${minutes % 60} dk`} />
    </Card>
  );

  const readingBox = (label: string) => (
    <Row>
      <Field label={label} suffix="mg/dL" value={bgText} onChangeText={setBgText} />
      <Btn title="Kaydet" icon="checkmark" disabled={bg === undefined || !!bgError(bg)} onPress={addReading} style={{ flexGrow: 1 }} />
    </Row>
  );

  const cancelBtn = (
    <Btn
      variant="ghost"
      icon="close"
      title="Testi iptal et"
      onPress={() => confirm('Testi iptal et', 'Bu test sonuçlandırılmadan kapatılacak.', cancel, 'İptal et')}
    />
  );

  if (active.kind === 'basal') {
    const r = basalTestResult(entries, active.startTime, now);
    return (
      <Screen>
        {header}
        <Card title="Ölçümler" icon="list">
          {r.readings.map((x) => (
            <KV key={x.time} k={new Date(x.time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} v={`${x.bg} mg/dL`} />
          ))}
          {r.broken ? <Notice level="danger" text={r.broken} /> : null}
          {!r.broken ? readingBox('Yeni ölçüm (2 saatte bir)') : null}
        </Card>
        {r.drift !== undefined ? <BasalVerdict r={r} hours={minutes / 60} /> : null}
        <Btn
          title={minutes >= 360 ? 'Testi bitir' : 'Testi bitir (en az 6 saat önerilir)'}
          icon="flag"
          disabled={r.readings.length < 2}
          onPress={finish}
        />
        {cancelBtn}
      </Screen>
    );
  }

  const sampler = active.kind === 'icr' ? icrSample : isfSample;
  const r = sampler(entries, active.entryId!, settings.blocks, profile, now);
  const win = active.kind === 'icr' ? ICR_WINDOW : ISF_WINDOW;

  if (r.ok) {
    return (
      <Screen>
        {header}
        <SampleResultCard kind={active.kind} result={r} />
        <Btn title="Testi tamamla" icon="checkmark-done" onPress={() => finish()} />
      </Screen>
    );
  }

  return (
    <Screen>
      {header}
      {r.pending ? (
        <Card title={minutes < win.min ? 'Bekleme zamanı' : 'Ölçüm zamanı!'} icon="timer">
          <T>{r.reason}</T>
          <T variant="muted">
            Bu sırada yemek yeme, düzeltme dozu vurma ve spor yapma. Şekerin düşer veya kendini kötü hissedersen testi bırak ve tedavi et.
          </T>
          {readingBox(minutes < win.min ? 'Erken ölçüm (sadece kayıt için)' : 'Şu anki şekerin')}
        </Card>
      ) : (
        <Card title="Test sonuçlanamadı" icon="alert-circle">
          <Notice level="warn" text={r.reason} />
          <T variant="muted">Sorun değil; uygun bir zamanda testi yeniden yapabilirsin.</T>
          <Btn title="Kapat" onPress={cancel} />
        </Card>
      )}
      {r.pending ? cancelBtn : null}
    </Screen>
  );
}

/** Tek test sonucu + dilim ilerlemesi */
function SampleResultCard({ kind, result }: { kind: 'icr' | 'isf'; result: Extract<SampleResult, { ok: true }> }) {
  const settings = useSettings((s) => s.settings);
  const entries = useLog((s) => s.entries);
  const block = settings.blocks.find((b) => b.id === result.blockId)!;
  const profile = { dia: settings.dia, peak: settings.peak };
  const current = kind === 'icr' ? block.icr : block.isf;
  const v = result.sample.value;
  const diff = (v - current) / current;
  const suggestions = (kind === 'icr' ? analyzeIcr : analyzeIsf)(entries, settings.blocks, profile);
  const progress = suggestions.find((s) => s.blockId === block.id)!;

  let verdict: string;
  if (Math.abs(diff) <= 0.1) verdict = 'Oranın bu testte iyi çalıştı.';
  else if (diff < 0)
    verdict =
      kind === 'icr'
        ? 'Bu öğünde şekerin hedefin üstünde kaldı: biraz daha fazla insülin gerekmiş olabilir.'
        : 'Düzeltme dozu şekerini beklenenden az düşürdü.';
  else
    verdict =
      kind === 'icr'
        ? 'Bu öğünde şekerin hedefin altına indi: biraz daha az insülin gerekmiş olabilir.'
        : 'Düzeltme dozu şekerini beklenenden fazla düşürdü.';

  return (
    <Card title="Sonuç" icon="ribbon">
      <KV k="Başlangıç şekeri" v={`${result.sample.pre} mg/dL`} />
      <KV k="Ölçülen şeker" v={`${result.sample.post} mg/dL`} />
      <KV k={kind === 'icr' ? 'Bu testte gerçekleşen oran' : 'Bu testte 1 Ü düşürdü'} v={kind === 'icr' ? `1 Ü = ${fmt(v)} g` : `${Math.round(v)} mg/dL`} strong />
      <KV k="Ayarındaki değer" v={kind === 'icr' ? `1 Ü = ${fmt(current)} g` : `${current} mg/dL`} />
      <Notice level={Math.abs(diff) <= 0.1 ? 'info' : 'warn'} text={verdict} />
      <T variant="muted">
        Tek bir test yanıltıcı olabilir (stres, hastalık, yanlış sayım…). {block.name === 'Tüm gün' ? 'Toplam' : `${block.name} dilimi için`}{' '}
        {progress.samples.length}/{MIN_SAMPLES} uygun test var.{' '}
        {progress.suggested !== undefined ? 'Yeterli test birikti; önerini Öğren > Oranlarımı bul bölümünde görebilirsin.' : 'Birkaç test daha yapınca öneri hazırlayacağım.'}
      </T>
    </Card>
  );
}

function BasalVerdict({ r, hours }: { r: ReturnType<typeof basalTestResult>; hours: number }) {
  const text =
    r.verdict === 'ok'
      ? `Şekerin ${fmt(hours)} saatte ${r.drift! >= 0 ? '+' : ''}${r.drift} mg/dL değişti: bazal dozun bu saatler için uygun görünüyor.`
      : r.verdict === 'rising'
        ? `Şekerin ${r.drift} mg/dL yükseldi. Bazal dozun bu saatler için yetersiz olabilir.`
        : `Şekerin ${-r.drift!} mg/dL düştü. Bazal dozun bu saatler için fazla olabilir.`;
  return (
    <Card title="Şu ana kadarki sonuç" icon="analytics">
      <Notice level={r.verdict === 'ok' ? 'info' : 'warn'} text={text} />
      <T variant="small">Normal kabul edilen değişim: test boyunca ±30 mg/dL.</T>
    </Card>
  );
}
