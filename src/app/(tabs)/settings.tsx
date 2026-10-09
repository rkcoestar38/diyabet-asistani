import { useEffect, useRef, useState } from 'react';

import { Collapsible } from '@/components/guide';
import { Linking } from 'react-native';
import { currentVersion, fetchLatest, useUpdateStore } from '@/lib/update';
import { InsulinForm, NumField } from '@/components/settings-forms';
import { Btn, Card, Field, Notice, Row, Screen, Segmented, T, TimeField, Toggle, confirm, notify } from '@/components/ui';
import { useThemePref, type ThemePref } from '@/store/theme';
import { notificationsSupported, notificationsUnsupportedReason, scheduledBasal, syncBasalReminder } from '@/lib/notifications';
import { backupNow } from '@/lib/backup';
import { useTests } from '@/store/tests';
import { pickText } from '@/lib/files';
import { isWeb } from '@/lib/web';
import { DEFAULT_MEAL_STARTS, MEALS, mealScheduleProblems } from '@/logic/meals';
import { chooseRise, hypoRiseSamples } from '@/logic/hypo';
import { activeBlock, parseHHMM } from '@/logic/schedule';
import { useFoods } from '@/store/foods';
import { toast } from '@/store/toast';
import type { CountMethod as CountMethodValue } from '@/data/foods-tr';
import { useLog } from '@/store/log';
import { DEFAULT_SETTINGS, useSettings } from '@/store/settings';
import { applyMockData } from '@/data/seed-mock';


/** Düşük şeker ekranının hesabında kullanılan iki değer: tablet gramajı ve 1 g hızlı şekerin etkisi */
function HypoTreatment() {
  const s = useSettings((st) => st.settings);
  const update = useSettings((st) => st.update);
  const entries = useLog((st) => st.entries);
  const block = activeBlock(s.blocks, new Date());
  if (!block) return null;
  const choice = chooseRise(s.hypoRise, hypoRiseSamples(entries, s.blocks, { dia: s.dia, peak: s.peak }), block);
  const source =
    choice.source === 'manual' ? 'senin girdiğin değer' : choice.source === 'data' ? `${choice.samples} hipo kaydından öğrenildi` : 'oranlarından hesaplandı';
  return (
    <>
      <Row>
        <NumField label="1 glukoz tableti" suffix="g" step={0.5} min={1} max={20} value={s.tabletG} onCommit={(v) => update({ tabletG: Math.min(Math.max(v, 1), 20) })} />
        <NumField label="1 g şeker yükseltir" suffix="mg/dL" step={0.5} min={0.5} max={15} value={choice.rise} onCommit={(v) => update({ hypoRise: Math.min(Math.max(v, 0.5), 15) })} />
      </Row>
      <T variant="small">1 g hızlı şekerin etkisi: {source}. Hipo tedavilerini düşük şeker ekranından kaydettikçe kendiliğinden öğrenilir.</T>
      {s.hypoRise !== undefined ? <Btn small variant="secondary" icon="sync" title="Otomiğe dön" onPress={() => update({ hypoRise: undefined })} /> : null}
    </>
  );
}

export default function SettingsScreen() {
  const s = useSettings((st) => st.settings);
  const update = useSettings((st) => st.update);
  const themePref = useThemePref((st) => st.pref);
  const setThemePref = useThemePref((st) => st.setPref);
  const [basalTime, setBasalTime] = useState(s.basalTime);
  const [basalName, setBasalName] = useState(s.basalName);
  // İsim yazılırken hatırlatıcıyı her tuşta değil, yazım durunca yeniden kur
  const nameReschedule = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Telefonda gerçekte kurulu saat: ayardaki saatle uyuşmuyorsa kullanıcı görsün
  const [sched, setSched] = useState<{ hour: number; minute: number } | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    scheduledBasal().then((r) => alive && setSched(r ?? null));
    return () => {
      alive = false;
    };
  }, [s.basalReminder, s.basalTime]);
  const schedText = sched ? `${String(sched.hour).padStart(2, '0')}:${String(sched.minute).padStart(2, '0')}` : undefined;

  async function setReminder(enabled: boolean, time = s.basalTime, name = s.basalName) {
    update({ basalReminder: enabled });
    const ok = await syncBasalReminder(enabled, time, name);
    if (ok) setSched((await scheduledBasal()) ?? null);
    if (enabled && !ok) {
      update({ basalReminder: false });
      notify('Hatırlatıcı kurulamadı', notificationsSupported ? 'Bildirim izni verilmedi veya saat geçersiz.' : notificationsUnsupportedReason);
    }
  }

  return (
    <Screen>
      <>
        <Card title="Görünüm" icon="color-palette-outline">
          <Segmented<ThemePref>
            options={[
              { value: 'auto', label: 'Otomatik' },
              { value: 'light', label: 'Açık' },
              { value: 'dark', label: 'Koyu' },
            ]}
            value={themePref}
            onChange={setThemePref}
          />
          <T variant="small">Otomatik: telefonunun açık/koyu ayarını izler.</T>
        </Card>
      </>
      <>
        <InsulinForm />
      </>

      <CountMethodSettings />

      <MealTimes />

      <Collapsible title="Bazal (uzun etkili) insülin" icon="moon">
        <Row>
          <Field
            label="İnsülin adı"
            keyboard="text"
            value={basalName}
            placeholder="ör. Tresiba, Lantus, Toujeo"
            onChangeText={(v) => {
              setBasalName(v);
              update({ basalName: v });
              // Hatırlatıcı metnindeki eski insülin adı kalmasın: yazım bitince yeniden kur
              if (nameReschedule.current) clearTimeout(nameReschedule.current);
              if (s.basalReminder) {
                nameReschedule.current = setTimeout(() => setReminder(true, basalTime, v), 800);
              }
            }}
          />
          <NumField label="Günlük doz" suffix="Ü" step={1} min={1} max={200} value={s.basalDose} onCommit={(basalDose) => update({ basalDose })} />
        </Row>
        <TimeField
          label="Vurma saati"
          value={basalTime}
          onChange={(v) => {
            setBasalTime(v);
            if (!Number.isNaN(parseHHMM(v))) {
              update({ basalTime: v });
              if (s.basalReminder) setReminder(true, v);
            }
          }}
        />
        <Toggle label="Her gün bu saatte hatırlat" value={s.basalReminder} onChange={(v) => setReminder(v, basalTime, basalName)} />
        {!notificationsSupported ? <T variant="small">{notificationsUnsupportedReason}</T> : null}
        {notificationsSupported && s.basalReminder ? (
          schedText ? (
            <T variant="small" color={schedText === s.basalTime ? 'ok' : 'danger'}>
              Telefonda kurulu hatırlatıcı: her gün {schedText}
              {schedText === s.basalTime ? '' : ` (ayardaki saat ${s.basalTime}; değiştirip tekrar aç)`}
            </T>
          ) : sched === null ? (
            <T variant="small" color="danger">Telefonda kurulu bir hatırlatıcı bulunamadı; düğmeyi kapatıp tekrar aç.</T>
          ) : null
        ) : null}
      </Collapsible>

      <Collapsible title="Hedef aralıklar (Günlük grafiği)" icon="analytics-outline">
        <T variant="small">Yemekten sonraki 3 saatteki ölçümler tok, diğerleri aç sayılır. Grafikteki bant ve renkler buna göre çizilir.</T>
        <Row>
          <NumField label="Aç alt" suffix="mg/dL" step={5} min={60} max={140} value={s.fastingRange.low} onCommit={(v) => v < s.fastingRange.high && update({ fastingRange: { ...s.fastingRange, low: v } })} />
          <NumField label="Aç üst" suffix="mg/dL" step={5} min={80} max={200} value={s.fastingRange.high} onCommit={(v) => v > s.fastingRange.low && update({ fastingRange: { ...s.fastingRange, high: v } })} />
        </Row>
        <Row>
          <NumField label="Tok alt" suffix="mg/dL" step={5} min={60} max={200} value={s.postRange.low} onCommit={(v) => v < s.postRange.high && update({ postRange: { ...s.postRange, low: v } })} />
          <NumField label="Tok üst" suffix="mg/dL" step={5} min={120} max={300} value={s.postRange.high} onCommit={(v) => v > s.postRange.low && update({ postRange: { ...s.postRange, high: v } })} />
        </Row>
      </Collapsible>

      <Collapsible title="Uyarı eşikleri" icon="warning-outline">
        <Row>
          <NumField label="Hipo eşiği" suffix="mg/dL" step={5} min={60} max={90} value={s.hypoThreshold} onCommit={(v) => update({ hypoThreshold: Math.min(Math.max(v, 60), 90) })} />
          <NumField
            label="Ciddi hipo"
            suffix="mg/dL"
            min={40}
            max={60}
            value={s.severeHypoThreshold}
            onCommit={(v) => update({ severeHypoThreshold: Math.min(Math.max(v, 40), 60) })}
          />
        </Row>
        <NumField label="Keton kontrolü için yüksek şeker" suffix="mg/dL" step={10} min={180} max={350} value={s.hyperThreshold} onCommit={(v) => update({ hyperThreshold: Math.min(Math.max(v, 180), 350) })} />
        <HypoTreatment />
      </Collapsible>

      <Collapsible title="Egzersiz öncesi doz azaltma" icon="bicycle">
        <T variant="small">Yemekten sonraki 1–2 saat içinde egzersiz yapacaksan yemek dozu bu oranlarda azaltılır. Kendi tecrübene göre ayarla.</T>
        <Row>
          <NumField label="Hafif" suffix="%" step={5} min={0} max={90} value={s.exercise.light} onCommit={(v) => update({ exercise: { ...s.exercise, light: Math.min(v, 90) } })} />
          <NumField label="Orta" suffix="%" step={5} min={0} max={90} value={s.exercise.moderate} onCommit={(v) => update({ exercise: { ...s.exercise, moderate: Math.min(v, 90) } })} />
          <NumField label="Yoğun" suffix="%" step={5} min={0} max={90} value={s.exercise.intense} onCommit={(v) => update({ exercise: { ...s.exercise, intense: Math.min(v, 90) } })} />
        </Row>
      </Collapsible>

      {isWeb ? null : <AppVersion />}

      <Backup />

      <Notice
        level="info"
        text="Tüm veriler yalnızca bu cihazda saklanır; telefon değiştirmeden önce yedek al."
      />
    </Screen>
  );
}

/** Yiyecek karbonhidratı nasıl sayılsın: hastane/diyetisyen değişim listesi mi, gerçek bileşim mi */
function CountMethodSettings() {
  const method = useSettings((st) => st.settings.countMethod);
  const update = useSettings((st) => st.update);
  const clearCart = useFoods((st) => st.clearCart);
  return (
    <Collapsible title="Sayım yöntemi" icon="calculator-outline" initiallyOpen>
      <Segmented<CountMethodValue>
        options={[
          { value: 'exchange', label: 'Değişim listesi' },
          { value: 'composition', label: 'Gerçek bileşim' },
        ]}
        value={method}
        onChange={(v) => {
          if (v === method) return;
          update({ countMethod: v });
          clearCart();
          toast('Sayım yöntemi değişti; tabaktaki yemekler temizlendi');
        }}
      />
      {method === 'exchange' ? (
        <>
          <T variant="muted">
            Hastane eğitimindeki değişim listesi: 1 ekmek, tahıl veya meyve değişimi = 15 g karbonhidrat (KHO), 1 süt grubu değişimi = 10 g. Sebze, et, yumurta,
            peynir ve yağ = 0 g. Karbonhidrat oranını (K/İ) doktorun bu yönteme göre belirliyorsa bunu seç.
          </T>
          <T variant="small">
            Özel kurallar: öğünde toplam 100 g üzeri et +10 g KHO; kuruyemiş ve yağlı tohum 100 g = 10 g KHO; sebze yemeğindeki pirinç/bulgurun her yemek kaşığı +1 g KHO
            (listedeki “Sebze yemeğindeki pirinç / bulgur” yiyeceğini seçip kaşık sayısını yaz). Listede olmayan yiyeceklerde gerçek bileşim değerleri kullanılır.
          </T>
        </>
      ) : (
        <T variant="muted">
          Yiyeceğin gerçek karbonhidrat miktarı (TürKomp ve paket etiketleriyle uyumlu). Oranını bu şekilde sayarak belirlediysen bunu seç. Meyve ve
          ekmekte değişim listesinden %10–40 daha düşük sonuç verir.
        </T>
      )}
    </Collapsible>
  );
}

/** Öğünlerin başlangıç saatleri: kayıt saatine göre öğün buna bakılarak otomatik seçilir */
function MealTimes() {
  const starts = useSettings((st) => st.settings.mealStarts);
  const update = useSettings((st) => st.update);
  const [texts, setTexts] = useState<Record<string, string>>({ ...starts });
  const problems = mealScheduleProblems(starts);

  return (
    <Collapsible title="Öğün saatleri" icon="restaurant-outline">
      <T variant="muted">Öğünün başladığı saat. Kayıt eklerken öğün, saatine göre buradan otomatik seçilir; istersen elle değiştirirsin.</T>
      <Row>
        {MEALS.map((m) => (
          <TimeField
            key={m.id}
            label={m.label}
            value={texts[m.id] ?? ''}
            onChange={(v) => {
              setTexts((prev) => ({ ...prev, [m.id]: v }));
              if (!Number.isNaN(parseHHMM(v)) && /^\d{2}:\d{2}$/.test(v)) update({ mealStarts: { ...starts, [m.id]: v } });
            }}
          />
        ))}
      </Row>
      {problems.map((p) => (
        <Notice key={p} level="warn" text={p} />
      ))}
      <Btn
        small
        variant="ghost"
        icon="refresh"
        title="Varsayılana dön"
        onPress={() => {
          update({ mealStarts: DEFAULT_MEAL_STARTS });
          setTexts({ ...DEFAULT_MEAL_STARTS });
        }}
      />
    </Collapsible>
  );
}

/** Uygulama sürümü ve elle güncelleme denetimi */
function AppVersion() {
  const set = useUpdateStore((st) => st.set);
  const available = useUpdateStore((st) => st.available);
  const [state, setState] = useState<{ busy: boolean; msg?: string }>({ busy: false });

  async function check() {
    setState({ busy: true });
    try {
      const { latest, isNewer } = await fetchLatest();
      set({ lastCheck: Date.now(), available: isNewer ? latest : undefined, dismissed: undefined });
      setState({ busy: false, msg: isNewer ? `Yeni sürüm var: ${latest.version}` : 'Uygulaman güncel.' });
    } catch (e) {
      setState({ busy: false, msg: e instanceof Error ? e.message : 'Denetlenemedi. İnternet bağlantını kontrol et.' });
    }
  }

  return (
    <Collapsible title={`Uygulama sürümü ${currentVersion()}`} icon="information-circle-outline">
      <T variant="muted">Uygulama açılışta yeni sürümü kendiliğinden arar. Elle de bakabilirsin.</T>
      <Btn variant="secondary" icon="refresh" title={state.busy ? 'Denetleniyor…' : 'Güncellemeleri denetle'} disabled={state.busy} onPress={check} />
      {state.msg ? <T variant="small">{state.msg}</T> : null}
      {available ? (
        <Btn icon="download-outline" title={`${available.version} sürümünü indir`} onPress={() => Linking.openURL(available.apkUrl ?? available.pageUrl)} />
      ) : null}
    </Collapsible>
  );
}

function Backup() {
  async function exportBackup() {
    await backupNow();
  }

  async function importBackup() {
    try {
      const text = await pickText();
      if (!text) return;
      const data = JSON.parse(text);
      if (data?.app !== 'diyabet-asistani' || !Array.isArray(data.log) || !data.settings?.blocks) {
        notify('Geçersiz dosya', 'Bu dosya bir Diyabet Asistanı yedeği değil.');
        return;
      }
      confirm(
        'Yedeği geri yükle',
        `${data.log.length} kayıt ve ayarlar yüklenecek. Bu cihazdaki mevcut veriler yedektekilerle DEĞİŞTİRİLECEK.`,
        () => {
          useSettings.getState().replaceAll({ ...DEFAULT_SETTINGS, ...data.settings, onboarded: true }, data.ratioHistory ?? []);
          useLog.getState().replaceAll(data.log);
          useFoods.getState().replaceAll({
            customFoods: data.foods?.customFoods ?? [],
            favorites: data.foods?.favorites ?? [],
            meals: data.foods?.meals ?? [],
          });
          // Oran testi geçmişi (v2 yedeklerde var; eskilerde yoktur)
          useTests.setState({
            finished: Array.isArray(data.tests?.finished) ? data.tests.finished : [],
            active: data.tests?.active ?? null,
          });
          notify('Geri yüklendi', 'Verilerin yüklendi. Oranlarını Ayarlar/Oranlar sekmesinden kontrol et.');
        },
        'Geri yükle',
      );
    } catch (e) {
      notify('Okunamadı', String(e));
    }
  }

  return (
    <Card title={__DEV__ ? 'Yedekleme ve Demo' : 'Yedekleme'} icon="cloud-upload-outline">
      <Btn variant="secondary" icon="download-outline" title="Yedek al (JSON)" onPress={exportBackup} />
      <Btn variant="secondary" icon="refresh" title="Yedekten geri yükle" onPress={importBackup} />
      {__DEV__ ? (
        <Btn
          variant="secondary"
          icon="sparkles"
          title="Demo / Mock Verisi Yükle (HbA1c %6.6)"
          onPress={() =>
            confirm(
              'Demo Verisi Yükle',
              '14 günlük yemek ve glukoz kayıtları yüklenecek (Tahmini HbA1c: %6.6). Mevcut kayıtlar değiştirilecek.',
              () => {
                applyMockData();
                notify('Demo Verileri Yüklendi', '14 günlük kayıtlar ve ayarlar başarıyla yüklendi.');
              },
              'Yükle',
            )
          }
        />
      ) : null}
      <Btn
        variant="ghost"
        icon="trash-outline"
        title="Tüm günlük kayıtlarını sil"
        onPress={() =>
          confirm('Tüm kayıtları sil', 'Günlükteki TÜM kayıtlar kalıcı olarak silinecek. Önce yedek almanı öneririm.', () => useLog.getState().replaceAll([]), 'Hepsini sil')
        }
      />
    </Card>
  );
}
