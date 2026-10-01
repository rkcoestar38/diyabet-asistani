import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Collapsible, Help } from '@/components/guide';
import { LabelCalculator } from '@/components/label-calc';
import { SameAsBefore } from '@/components/same-meal';
import { UpdateBanner } from '@/components/update-banner';
import { WaterLevel } from '@/components/water';
import { WhenCard, useWhen } from '@/components/when';
import { Btn, Card, Field, KV, Notice, Pressy, Row, Screen, Segmented, T, Toggle, parseNum, useCountUp } from '@/components/ui';
import { Radius, Space, useTheme } from '@/constants/theme';
import { currentTime, useCob, useIob, useNow } from '@/lib/hooks';
import { toTimeInput } from '@/lib/input';
import { estimateBgAt } from '@/logic/bgtime';
import { calcBolus, carbsForDose, carbsToTarget, checkBg, fmt } from '@/logic/bolus';
import { carbsOnBoard, insulinOnBoard, recentBolus } from '@/logic/iob';
import { mealAt, mealLabel } from '@/logic/meals';
import { awaitingPost } from '@/logic/postmeal';
import { icrSample } from '@/logic/ratios';
import { activeBlock, blockEnd, parseHHMM, scheduleProblems, sortBlocks } from '@/logic/schedule';
import type { ExerciseLevel, Warning } from '@/logic/types';
import { useDraft } from '@/store/draft';
import { cartMeatRule, cartTotal, useFoods } from '@/store/foods';
import { useLog } from '@/store/log';
import { useSettings } from '@/store/settings';
import { useTests } from '@/store/tests';
import { toast } from '@/store/toast';

type Mode = 'meal' | 'correction' | 'reverse' | 'low';

const MODES: { value: Mode; label: string; hint: string }[] = [
  { value: 'meal', label: 'Yemek dozu', hint: 'Yiyeceğin karbonhidrat ve şekerine göre doz' },
  { value: 'correction', label: 'Sadece şekerimi düşür', hint: 'Yemek yemeden, yüksek şekeri hedefe indirmek için doz' },
  { value: 'reverse', label: 'Bu dozla kaç gram yerim?', hint: 'Belli bir dozla karşılanabilecek karbonhidrat' },
  { value: 'low', label: 'Şekerim düşüyor', hint: 'Hedefte kalmak için kaç gram karbonhidrat gerektiği' },
];

const EXERCISE_LABEL = { none: 'yok', light: 'hafif', moderate: 'orta', intense: 'yoğun' } as const;

export default function Calculator() {
  const c = useTheme();
  const now = useNow(10000);
  const settings = useSettings((s) => s.settings);
  const entries = useLog((s) => s.entries);
  const addLog = useLog((s) => s.add);
  const cart = useFoods((s) => s.cart);
  const clearCart = useFoods((s) => s.clearCart);
  const activeTest = useTests((s) => s.active);
  const startTest = useTests((s) => s.start);
  const when = useWhen(now);
  // Ekrana her dönüşte, uzun süre önce bırakılmış geçmişe dönük zaman/öğün seçimini sıfırla
  useFocusEffect(
    useCallback(() => {
      useDraft.getState().expire(15 * 60000);
    }, []),
  );
  const iobNow = useIob(now);
  const cobNow = useCob(now);

  const [mode, setMode] = useState<Mode>('meal');
  const [bgText, setBgText] = useState('');
  const cartSum = cartTotal(cart);
  const [carbText, setCarbText] = useState(() => (cartSum > 0 ? String(cartSum) : ''));
  // Tabaktaki yemekler değişince karbonhidrat alanı kendiliğinden güncellenir (onay gerekmez)
  const [seenCart, setSeenCart] = useState(cartSum);
  if (cartSum !== seenCart) {
    setSeenCart(cartSum);
    setCarbText(cart.length > 0 ? String(cartSum) : '');
  }
  const [unitText, setUnitText] = useState('');
  const [exercise, setExercise] = useState<ExerciseLevel>('none');
  // Elle seçilen dilim, yalnızca seçildiği andaki otomatik dilim geçerliyken kullanılır (saat ilerleyince sıfırlanır)
  const [override, setOverride] = useState<{ id: string; auto: string } | null>(null);
  const [givenText, setGivenText] = useState('');
  const [showLabel, setShowLabel] = useState(false);
  const [testOffer, setTestOffer] = useState<string | null>(null);
  const [useEstimate, setUseEstimate] = useState(true);
  const [basalLater, setBasalLater] = useState(false);
  const [postText, setPostText] = useState('');
  const [postLater, setPostLater] = useState<string | null>(null);

  const problems = scheduleProblems(settings.blocks);
  // Oran dilimi, doz zamanına göre seçilir (geçmişe dönük kayıtta o saatin oranı)
  const autoBlock = activeBlock(settings.blocks, new Date(when.doseTime));
  if (problems.length > 0 || !autoBlock) {
    return (
      <Screen>
        <Card title="Önce oranlarını düzelt" icon="alert-circle">
          <T>Ayarlardaki oranlarında hata var. Güvenliğin için hatalar düzeltilene kadar doz hesaplanmaz.</T>
          {problems.map((p) => (
            <Notice key={p} level="danger" text={p} />
          ))}
          <Btn title="Ayarlara git" icon="settings" onPress={() => router.navigate('/settings' as Href)} />
        </Card>
      </Screen>
    );
  }

  const profile = { dia: settings.dia, peak: settings.peak };
  const block =
    override && override.auto === autoBlock.id ? (settings.blocks.find((b) => b.id === override.id) ?? autoBlock) : autoBlock;
  const multi = settings.blocks.length > 1;
  // Doz anındaki aktif insülin/karbonhidrat (geçmişe dönük kayıtta o ana göre)
  const iob = when.retro ? insulinOnBoard(entries, when.doseTime, profile) : iobNow;
  const cob = when.retro ? carbsOnBoard(entries, when.doseTime) : cobNow;

  const bgMeasured = parseNum(bgText);
  const estimate = bgMeasured !== undefined && when.bgEarlier ? estimateBgAt(bgMeasured, when.bgTime, when.doseTime, entries, block, profile) : undefined;
  const bg = estimate && useEstimate ? Math.max(estimate.value, 0) : bgMeasured;
  const gapMin = Math.round((when.doseTime - when.bgTime) / 60000);
  // Ölçüm hipo aralığındaysa (yakın zamanda) tahmin ne olursa olsun hipo kabul edilir
  const checkValue = bgMeasured !== undefined && bg !== undefined && gapMin < 20 ? Math.min(bgMeasured, bg) : bg;

  const cartCarbs = cartTotal(cart);
  const carbs = parseNum(carbText) ?? (cart.length ? cartCarbs : 0);
  const last = recentBolus(entries, when.doseTime, 120);
  const minutesSinceLastBolus = last ? (when.doseTime - last.time) / 60000 : undefined;
  const fatty = cart.some((i) => i.fatty);

  const base = { bg, block, iob, cob, settings, exercise, minutesSinceLastBolus };
  const bolus = mode === 'meal' || mode === 'correction' ? calcBolus({ ...base, carbs: mode === 'meal' ? carbs : 0 }) : undefined;
  const reverse = mode === 'reverse' ? carbsForDose({ ...base, units: parseNum(unitText) ?? 0 }) : undefined;
  const bgCheck = checkBg(checkValue, settings);
  const low = mode === 'low' && bg !== undefined && bgCheck.kind !== 'invalid' ? carbsToTarget(bg, block, iob, cob) : undefined;

  const hasInput = bgMeasured !== undefined || carbs > 0 || (mode === 'reverse' && unitText !== '');
  const isHypo = bgCheck.kind === 'hypo';

  // Bazal: planlanan saat geçti ve kayıt yoksa sor
  const basalDue = (() => {
    if (!settings.basalDose || basalLater) return undefined;
    const m = parseHHMM(settings.basalTime);
    if (Number.isNaN(m)) return undefined;
    const d = new Date(now);
    d.setHours(Math.floor(m / 60), m % 60, 0, 0);
    let expected = d.getTime();
    if (expected > now) expected -= 86400000;
    if (now - expected > 14 * 3600000) return undefined;
    if (entries.some((e) => e.basal && e.time >= expected - 6 * 3600000)) return undefined;
    return expected;
  })();

  // Yemekten 1–4 saat sonra: tokluk şekerini sor
  const waiting = awaitingPost(entries, now);
  const postBgValue = parseNum(postText);
  function savePost() {
    if (!waiting || postBgValue === undefined) return;
    const entry = addLog({ time: currentTime(), bg: postBgValue, meal: waiting.meal ?? mealAt(waiting.time, settings.mealStarts), post: true, afterId: waiting.id });
    setPostText('');
    toast(`Tokluk şekeri ${postBgValue} kaydedildi`, { label: 'Geri al', onPress: () => useLog.getState().remove(entry.id) });
  }
  // Son 30 dakikadaki kayıtlı ölçüm (doz hesabında kullanılabilir)
  const recentReading = [...entries].reverse().find((e) => e.bg !== undefined && (e.bgTime ?? e.time) <= now && now - (e.bgTime ?? e.time) <= 30 * 60000);

  const gapWarnings: Warning[] =
    gapMin >= 120
      ? [{ level: 'danger', text: `Şeker ${gapMin} dakika önce ölçülmüş; çok eski. Doz için yeniden ölçmen en güvenlisi.` }]
      : gapMin >= 30
        ? [{ level: 'warn', text: `Şeker ${gapMin} dakika önce ölçülmüş. Mümkünse yeniden ölç.` }]
        : [];

  function resetForm() {
    setBgText('');
    setCarbText('');
    setGivenText('');
    setExercise('none');
    setUseEstimate(true);
    useDraft.getState().reset();
  }

  function save(dose: number) {
    const given = parseNum(givenText) ?? dose;
    const rule = cartMeatRule(cart);
    const items =
      mode === 'meal' && cart.length
        ? [
            ...cart.map((i) => ({ foodId: i.foodId, name: i.name, grams: i.grams, carbs: i.carbs, fatty: i.fatty })),
            ...(rule > 0 ? [{ foodId: 'rule-meat', name: 'Et kuralı (100 g üzeri et)', grams: 0, carbs: rule }] : []),
          ]
        : undefined;
    const savedAt = when.retro ? when.doseTime : currentTime();
    const entry = addLog({
      time: savedAt,
      bg: bgMeasured,
      bgTime: bgMeasured !== undefined && when.bgEarlier ? Math.min(when.bgTime, savedAt) : undefined,
      meal: when.meal,
      carbs: mode === 'meal' && carbs > 0 ? carbs : undefined,
      bolus: given > 0 ? given : undefined,
      mealBolus: bolus && given ? bolus.meal : undefined,
      correctionBolus: bolus && given ? bolus.correction : undefined,
      exercise: exercise !== 'none' ? exercise : undefined,
      items,
      foods: items ? items.map((i) => `${i.name} ${i.grams} g`).join(', ') : undefined,
    });
    resetForm();
    if (mode === 'meal') clearCart();
    // Uygun bir öğünse, oran testi olarak takip etmeyi öner
    if (!activeTest && mode === 'meal') {
      const r = icrSample([...entries, entry], entry.id, settings.blocks, profile);
      if (!r.ok && r.pending) {
        setTestOffer(entry.id);
        return;
      }
    }
    toast(given ? `${mealLabel(when.meal)}: ${fmt(given)} Ü kaydedildi` : 'Ölçüm kaydedildi', {
      label: 'Geri al',
      onPress: () => useLog.getState().remove(entry.id),
    });
  }

  function saveMeasurement() {
    if (bgMeasured === undefined) return;
    const entry = addLog({ time: when.bgEarlier || when.retro ? when.bgTime : currentTime(), bg: bgMeasured, meal: when.meal });
    resetForm();
    toast(`Şeker ${bgMeasured} kaydedildi (${toTimeInput(entry.time)})`, { label: 'Geri al', onPress: () => useLog.getState().remove(entry.id) });
  }

  const modeInfo = MODES.find((m) => m.value === mode)!;

  return (
    <Screen>
      <UpdateBanner />
      {/* Durum: su seviyesi = aktif insülin */}
      <>
        <WaterLevel level={Math.min(1, iobNow / Math.max(4, settings.maxBolus / 2))} height={168}>
          <View style={styles.statusRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Help term="iob" />
              <T variant="title" color="primary">
                {fmt(iobNow)} Ü
              </T>
              <T variant="small" color="text">
                {cobNow >= 1 ? `${Math.round(cobNow)} g karbonhidrat sindiriliyor` : 'Sindirilen karbonhidrat yok'}
              </T>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <T variant="label" style={{ marginBottom: 0 }}>
                {multi ? `${block.name} (${block.start}–${blockEnd(settings.blocks, block)})` : 'Oranın'}
              </T>
              <T variant="h2">1 Ü = {fmt(block.icr)} g</T>
              <T variant="small" color="text">
                1 Ü ↓{block.isf} · hedef {block.target}
              </T>
            </View>
          </View>
        </WaterLevel>
      </>
      {multi ? (
        <View style={styles.chips}>
          {sortBlocks(settings.blocks).map((b) => {
            const active = b.id === block.id;
            return (
              <Pressy
                key={b.id}
                onPress={() => setOverride(b.id === autoBlock.id ? null : { id: b.id, auto: autoBlock.id })}
                style={[styles.chip, { borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primarySoft : c.card }]}>
                <T variant="small" color={active ? 'primary' : 'muted'} style={{ fontWeight: '600' }}>
                  {b.name}
                  {b.id === autoBlock.id ? (when.retro ? ' (o saatte)' : ' (şimdi)') : ''}
                </T>
              </Pressy>
            );
          })}
        </View>
      ) : null}
      <>
        <Btn variant="dangerSoft" icon="alert-circle" title="Şekerim düşük (hipo)" onPress={() => router.push({ pathname: '/hypo', params: bgMeasured ? { bg: String(bgMeasured) } : {} })} />
      </>

      {basalDue !== undefined ? (
        <Card title="Bazal insülinini vurdun mu?" icon="moon">
          <T variant="muted">
            {settings.basalName || 'Bazal'} · {fmt(settings.basalDose)} Ü · saat {settings.basalTime}
          </T>
          <Row>
            <Btn small variant="ghost" title="Sonra" onPress={() => setBasalLater(true)} />
            <Btn small variant="secondary" title="Başka saatte" onPress={() => router.push({ pathname: '/entry', params: { basal: '1' } })} style={{ flexGrow: 1 }} />
            <Btn
              small
              icon="checkmark"
              title="Vurdum"
              style={{ flexGrow: 1 }}
              onPress={() => {
                const entry = addLog({ time: basalDue, basal: settings.basalDose });
                toast(`Bazal ${fmt(settings.basalDose)} Ü kaydedildi`, { label: 'Geri al', onPress: () => useLog.getState().remove(entry.id) });
              }}
            />
          </Row>
        </Card>
      ) : null}

      {settings.ratioSource === 'estimate' ? (
        <Pressable onPress={() => router.navigate('/(tabs)/learn')}>
          <Notice level="info" text="Oranların başlangıç tahmini. Gerçek oranlarını bulmak için Öğren > Oranlarımı bul testlerini yap. (Dokun)" />
        </Pressable>
      ) : null}
      {activeTest ? (
        <Pressable onPress={() => router.push('/test')}>
          <Notice level="info" text="Devam eden bir oran testin var. Durumunu görmek ve ölçümünü girmek için dokun." />
        </Pressable>
      ) : null}

      {testOffer ? (
        <Card title="Kaydedildi" icon="checkmark-circle">
          <T>
            Bu öğün, karbonhidrat oranını kontrol etmek için uygun görünüyor. 3 saat boyunca bir şey yemez ve sonra şekerini ölçersen,
            oranının tutup tutmadığını gösterebilirim.
          </T>
          <Row>
            <Btn variant="ghost" title="Hayır, teşekkürler" onPress={() => setTestOffer(null)} />
            <Btn
              title="Evet, takip et"
              icon="flask"
              style={{ flexGrow: 1 }}
              onPress={() => {
                startTest({ kind: 'icr', entryId: testOffer, startTime: currentTime() });
                setTestOffer(null);
                router.push('/test');
              }}
            />
          </Row>
        </Card>
      ) : null}

      {waiting && postLater !== waiting.id ? (
        <Card title="Tokluk şekerin nasıl?" icon="water-outline">
          <T variant="muted">
            {mealLabel(waiting.meal ?? mealAt(waiting.time, settings.mealStarts))} yemeğinden {Math.round((now - waiting.time) / 60000)} dk geçti. Şimdi ölçtüysen yaz; açlık şekerinle birlikte öğünün karşılaştırmasında görünür.
          </T>
          <Row>
            <Field label="Tokluk şekeri" suffix="mg/dL" value={postText} onChangeText={setPostText} keyboard="number" placeholder="—" />
            <Btn title="Kaydet" icon="checkmark" disabled={postBgValue === undefined} onPress={savePost} style={{ minWidth: 120 }} />
          </Row>
          <Btn small variant="ghost" title="Sonra" onPress={() => setPostLater(waiting.id)} />
        </Card>
      ) : null}

      {/* Öğün ve zaman */}
      {mode === 'meal' || mode === 'correction' ? (
        <Card title={when.retro ? 'Geçmişe dönük kayıt' : 'Hangi öğün?'} icon="restaurant-outline">
          <WhenCard now={now} />
        </Card>
      ) : null}

      {/* Girdiler */}
      <Card>
        <T variant="muted">{modeInfo.hint}</T>
        <Row>
          <Field label="Şekerin" suffix="mg/dL" value={bgText} onChangeText={setBgText} big keyboard="number" placeholder="—" />
          {mode === 'meal' ? (
            <Field label="Karbonhidrat" suffix="g" value={carbText} onChangeText={setCarbText} big step={5} base={cart.length ? cartCarbs : 0} placeholder={cart.length ? String(cartCarbs) : '0'} />
          ) : null}
          {mode === 'reverse' ? <Field label="Vuracağın doz" suffix="Ü" value={unitText} onChangeText={setUnitText} big step={0.5} placeholder="0" /> : null}
        </Row>
        {bgMeasured === undefined && recentReading ? (
          <Btn
            small
            variant="secondary"
            icon="water-outline"
            title={`Son ölçümü kullan: ${recentReading.bg} (${Math.round((now - (recentReading.bgTime ?? recentReading.time)) / 60000)} dk önce)`}
            onPress={() => {
              setBgText(String(recentReading.bg));
              const t = recentReading.bgTime ?? recentReading.time;
              useDraft.getState().set({ bgTime: now - t >= 5 * 60000 ? t : undefined });
            }}
          />
        ) : null}
        {bgMeasured !== undefined && (mode === 'meal' || mode === 'correction') ? (
          <Btn small variant="secondary" icon="water-outline" title={`Sadece ölçümü kaydet (${toTimeInput(when.bgTime)})`} onPress={saveMeasurement} />
        ) : null}
        {estimate && Math.abs(estimate.shift) >= 2 ? (
          <View style={{ gap: Space.sm }}>
            <Notice
              level="info"
              text={`Şeker ${toTimeInput(when.bgTime)}'te ${bgMeasured} ölçüldü (${gapMin} dk önce). O zamandan beri etki eden insülin ve karbonhidratla şu anki tahmini şeker ~${Math.max(estimate.value, 0)}.`}
            />
            <Toggle label="Hesabı tahmini şimdiki şekerle yap" value={useEstimate} onChange={setUseEstimate} />
          </View>
        ) : null}
        {gapWarnings.map((w) => (
          <Notice key={w.text} {...w} />
        ))}

        {mode === 'meal' ? (
          <>
            {cart.length > 0 ? (
              <View style={[styles.cartBox, { borderColor: c.primary }]}>
                <T style={{ flex: 1 }}>
                  Tabaktan hesaplandı: <T style={{ fontWeight: '700' }}>{cartCarbs} g</T> ({cart.length} yemek)
                </T>
                <Btn small variant="ghost" icon="close" title="Temizle" onPress={clearCart} />
              </View>
            ) : null}
            <SameAsBefore meal={when.meal} before={when.doseTime} />
            <Row>
              <Btn small variant="secondary" icon="restaurant" title={cart.length ? 'Yemek ekle / değiştir' : 'Yemek listesinden seç'} onPress={() => router.push('/pick-foods' as Href)} style={{ flexGrow: 1 }} />
              <Btn small variant="secondary" icon="barcode-outline" title="Etiketten hesapla" onPress={() => setShowLabel(!showLabel)} style={{ flexGrow: 1 }} />
            </Row>
            {showLabel ? (
              <LabelCalculator
                useLabel="Karbonhidrat olarak yaz"
                onUse={(g) => {
                  setCarbText(String(g));
                  setShowLabel(false);
                }}
              />
            ) : null}
          </>
        ) : null}

        {mode === 'meal' || mode === 'correction' || mode === 'reverse' ? (
          <Collapsible title={`Egzersiz: ${EXERCISE_LABEL[exercise]}${exercise !== 'none' ? ` (−%${settings.exercise[exercise]})` : ''}`} icon="bicycle">
            <T variant="muted">Önümüzdeki 1–2 saatte egzersiz yapacaksan doz azaltılır.</T>
            <Segmented<ExerciseLevel>
              options={[
                { value: 'none', label: 'Hayır' },
                { value: 'light', label: 'Hafif' },
                { value: 'moderate', label: 'Orta' },
                { value: 'intense', label: 'Yoğun' },
              ]}
              value={exercise}
              onChange={setExercise}
            />
            {exercise !== 'none' ? <T variant="small">Doz %{settings.exercise[exercise]} azaltılır (Ayarlar’dan değiştirilebilir).</T> : null}
          </Collapsible>
        ) : null}
      </Card>

      {/* Sonuç */}
      {hasInput && isHypo ? (
        <Card>
          <Warnings list={bgCheck.warnings} />
          <Btn variant="danger" icon="medkit" title="Hipo adımlarını aç" onPress={() => router.push({ pathname: '/hypo', params: { bg: String(checkValue) } })} />
        </Card>
      ) : null}

      {hasInput && !isHypo && bolus ? (
        <Card>
          {bolus.status === 'ok' ? (
            <>
              <View style={styles.resultHead}>
                <T variant="label">Önerilen doz</T>
                <DoseNumber value={bolus.dose} />
                <T variant="muted" style={{ textAlign: 'center' }}>
                  {explain(bolus, mode === 'meal' ? carbs : 0, bg, block.target)}
                </T>
              </View>
              <Collapsible title="Hesabın detayı">
                {mode === 'meal' ? <KV k={`Yemek: ${fmt(carbs)} g ÷ ${fmt(block.icr)}`} v={`${fmt(bolus.meal, 2)} Ü`} /> : null}
                {bg !== undefined ? (
                  <KV
                    k={`Düzeltme: (${bg} − ${block.target}) ÷ ${block.isf}`}
                    v={`${bolus.correctionRaw >= 0 ? '+' : ''}${fmt(bolus.correctionRaw, 2)} Ü`}
                  />
                ) : null}
                {estimate && useEstimate ? <KV k={`Kullanılan şeker (ölçülen ${bgMeasured})`} v={`~${bg}`} /> : null}
                {bolus.correctionRaw < 0 && !settings.reverseCorrection ? <KV k="Ters düzeltme kapalı" v="0 Ü" /> : null}
                {bolus.iobUsed > 0 ? <KV k="Vücudundaki aktif insülin düşüldü" v={`−${fmt(bolus.iobUsed, 2)} Ü`} /> : null}
                {bolus.exerciseCut > 0 ? <KV k="Egzersiz azaltması" v={`−${fmt(bolus.exerciseCut, 2)} Ü`} /> : null}
                <KV k="Hesaplanan" v={`${fmt(bolus.raw, 2)} Ü → ${fmt(settings.penStep)} adımla ${fmt(bolus.dose)} Ü`} />
                {bolus.eventualBg !== undefined && (iob > 0.05 || cob >= 1) ? (
                  <KV k="Aktif insülin ve KH bitince beklenen şeker (bu doz hariç)" v={`~${Math.max(bolus.eventualBg, 0)}`} />
                ) : null}
                {mode === 'correction' && bg !== undefined && bg > block.high ? (
                  <KV k={`Sadece aralığa (${block.high}) indirmek için`} v={`${fmt(Math.max(0, (bg - block.high) / block.isf - iob), 2)} Ü`} />
                ) : null}
              </Collapsible>
            </>
          ) : null}
          <Warnings list={bolus.warnings} />
          {mode === 'meal' && fatty ? (
            <Notice
              level="info"
              text="Tabağında yağlı/proteinli yiyecek var: şeker 3–5 saat sonra da yükselebilir. Yemekten 2–3 saat sonra tekrar ölç."
            />
          ) : null}
          {bolus.status === 'ok' ? <SaveBox dose={bolus.dose} givenText={givenText} setGivenText={setGivenText} onSave={save} /> : null}
        </Card>
      ) : null}

      {hasInput && !isHypo && reverse ? (
        <Card>
          {reverse.status === 'ok' ? (
            <View style={styles.resultHead}>
              <T variant="label">{unitText || 0} Ü ile yiyebileceğin</T>
              <T variant="big" color="primary">
                {reverse.carbs} g
              </T>
              <T variant="small">karbonhidrat {reverse.correction > 0 ? `(${fmt(reverse.correction, 2)} Ü şekerini düşürmeye ayrıldı)` : ''}</T>
            </View>
          ) : null}
          <Warnings list={reverse.warnings} />
        </Card>
      ) : null}

      {mode === 'low' && low && !isHypo ? (
        <Card>
          <View style={styles.resultHead}>
            <T variant="label">Hedefte ({block.target}) kalmak için</T>
            <T variant="big" color={low.carbs > 0 ? 'warn' : 'ok'}>
              {low.carbs} g
            </T>
            <T variant="small">karbonhidrat ye (bunun için insülin vurma)</T>
          </View>
          <KV k="1 g karbonhidrat şekeri yükseltir" v={`~${fmt(block.isf / block.icr)} mg/dL`} />
          <KV k="Aktif insülin ve KH bitince beklenen şeker" v={`~${Math.max(low.eventualBg, 0)} mg/dL`} />
          {low.carbs === 0 ? <Notice level="info" text="Aktif insülinin hesaba katıldığında hedefin altına inmen beklenmiyor." /> : null}
          <Warnings list={bgCheck.warnings} />
        </Card>
      ) : null}
      {mode === 'low' && bg === undefined ? <Notice level="info" text="Şekerini gir; hedefte kalmak için kaç gram karbonhidrat alman gerektiğini hesaplayayım." /> : null}

      {/* Diğer hesaplar */}
      <View style={{ gap: Space.sm }}>
        <T variant="label">{mode === 'meal' ? 'Başka bir şey mi hesaplamak istiyorsun?' : 'Hesap türü'}</T>
        <View style={styles.chips}>
          {MODES.map((m) => {
            const active = m.value === mode;
            return (
              <Pressable
                key={m.value}
                onPress={() => setMode(m.value)}
                style={[styles.chip, { borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primarySoft : c.card }]}>
                <T variant="small" color={active ? 'primary' : 'text'}>
                  {m.label}
                </T>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}

/** Sonucu tek cümleyle anlatır */
function explain(r: ReturnType<typeof calcBolus>, carbs: number, bg: number | undefined, target: number): string {
  const parts: string[] = [];
  if (carbs > 0) parts.push(`${fmt(carbs)} g karbonhidrat için ${fmt(r.meal)} Ü`);
  if (bg !== undefined && r.correctionRaw > 0.05) parts.push(`şekerini ${target}’e indirmek için ${fmt(r.correctionRaw)} Ü`);
  if (bg !== undefined && r.correctionRaw < -0.05) parts.push(`şekerin hedefin altında olduğu için −${fmt(-r.correctionRaw)} Ü`);
  if (r.iobUsed > 0.05) parts.push(`vücudunda hâlâ etki eden ${fmt(r.iobUsed)} Ü düşüldü`);
  if (r.exerciseCut > 0.05) parts.push(`egzersiz için ${fmt(r.exerciseCut)} Ü azaltıldı`);
  return parts.length ? parts.join(', ') + '.' : 'Şu an ek insülin gerekmiyor.';
}

/** Doz sayısı: değişince akıcı sayar */
function DoseNumber({ value }: { value: number }) {
  const shown = useCountUp(value, 650, 1);
  return (
    <T variant="big" color="primary">
      {fmt(shown)} Ü
    </T>
  );
}

function Warnings({ list }: { list: Warning[] }) {
  return (
    <>
      {list.map((w) => (
        <Notice key={w.text} {...w} />
      ))}
    </>
  );
}

function SaveBox({
  dose,
  givenText,
  setGivenText,
  onSave,
}: {
  dose: number;
  givenText: string;
  setGivenText: (s: string) => void;
  onSave: (dose: number) => void;
}) {
  return (
    <View style={{ gap: Space.sm }}>
      <Row>
        <Field label="Vurduğun doz (farklıysa değiştir)" suffix="Ü" value={givenText} placeholder={fmt(dose)} onChangeText={setGivenText} step={0.5} base={dose} />
        <Btn title="Kaydet" icon="checkmark" onPress={() => onSave(dose)} style={{ minWidth: 120 }} />
      </Row>
      <T variant="small">Dozlarını kaydetmen, aktif insülin hesabı ve oranlarını öğrenmen için önemli.</T>
    </View>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: 'row', gap: Space.md, alignItems: 'center' },
  iobBox: { borderRadius: Radius.md, padding: Space.md, alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  cartBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', borderRadius: Radius.md, padding: Space.md },
  resultHead: { alignItems: 'center', gap: 4 },
});
