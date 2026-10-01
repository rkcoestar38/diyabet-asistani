import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Collapsible } from '@/components/guide';
import { Ring } from '@/components/ring';
import { Btn, Card, Field, Notice, Row, Screen, T, parseNum } from '@/components/ui';
import { Space, useTheme } from '@/constants/theme';
import { currentTime, useCob, useIob, useNow } from '@/lib/hooks';
import { cancelNotification, notificationsSupported, scheduleRecheck } from '@/lib/notifications';
import { BG_MAX, BG_MIN, HYPO_MAX_G, HYPO_MIN_G, fmt } from '@/logic/bolus';
import { assessHypo, chooseRise, followUpSnack, hypoRiseSamples, quickCarbOptions } from '@/logic/hypo';
import { activeBlock } from '@/logic/schedule';
import { useLog } from '@/store/log';
import { useSettings } from '@/store/settings';

const WAIT_MIN = 15;

type Phase = { kind: 'treat' } | { kind: 'wait'; since: number; notifId?: string } | { kind: 'done'; bg: number };

export default function Hypo() {
  const params = useLocalSearchParams<{ bg?: string }>();
  const c = useTheme();
  const settings = useSettings((s) => s.settings);
  const updateSettings = useSettings((s) => s.update);
  const entries = useLog((s) => s.entries);
  const addLog = useLog((s) => s.add);
  const now = useNow(1000);
  const iob = useIob(now);
  const cob = useCob(now);
  const block = activeBlock(settings.blocks, new Date(now))!;

  const [bgText, setBgText] = useState(params.bg ?? '');
  const [recheckText, setRecheckText] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'treat' });
  const [round, setRound] = useState(1);
  const bg = parseNum(bgText);
  // 1 g hızlı karbonhidratın etkisi: elle girilen > kendi hipo tedavi kayıtların > oranlarından
  const samples = hypoRiseSamples(entries, settings.blocks, { dia: settings.dia, peak: settings.peak });
  const choice = chooseRise(settings.hypoRise, samples, block);
  const [riseText, setRiseText] = useState<string | undefined>();
  const [tabletText, setTabletText] = useState<string | undefined>();
  const [takenText, setTakenText] = useState('');
  const fmtRise = (n: number) => String(n).replace('.', ',');

  // Karar: karbonhidrat yalnızca şeker düşükse (veya ölçüm yoksa belirtiye göre) önerilir
  const a = assessHypo(bg, block, iob, cob, settings, choice.rise);
  const treat = a.status === 'unknown' || a.status === 'low' || a.status === 'severe' || a.status === 'falling';
  const preventive = a.status === 'falling';
  const amount = a.status === 'unknown' || a.status === 'falling' ? a.carbs : a.status === 'low' || a.status === 'severe' ? a.plan.carbsNow : 0;
  const plan = a.status === 'low' || a.status === 'severe' ? a.plan : undefined;

  async function treated() {
    const grams = parseNum(takenText) ?? amount;
    const time = currentTime();
    // Önleyici miktar hipo atağı sayılmasın: yemek olarak kaydedilir
    if (preventive) addLog({ time, bg, carbs: grams, note: 'Önleyici karbonhidrat (şeker düşüyordu)' });
    else addLog({ time, bg, hypoCarbs: grams, note: round > 1 ? `Hipo tedavisi (${round}. tur)` : 'Hipo tedavisi' });
    const notifId = await scheduleRecheck(WAIT_MIN);
    setPhase({ kind: 'wait', since: currentTime(), notifId });
  }

  function recheck() {
    const value = parseNum(recheckText);
    if (value === undefined || !(value >= BG_MIN && value <= BG_MAX)) return;
    if (phase.kind === 'wait') cancelNotification(phase.notifId);
    if (value < settings.hypoThreshold) {
      addLog({ time: currentTime(), bg: value, note: 'Hipo kontrol ölçümü' });
      setBgText(String(value));
      setTakenText('');
      setRecheckText('');
      setRound((r) => r + 1);
      setPhase({ kind: 'treat' });
    } else {
      addLog({ time: currentTime(), bg: value, note: 'Hipo düzeldi' });
      setPhase({ kind: 'done', bg: value });
    }
  }

  const remaining = phase.kind === 'wait' ? Math.max(0, WAIT_MIN * 60 - Math.floor((now - phase.since) / 1000)) : 0;
  const recheckValue = parseNum(recheckText);
  const done = phase.kind === 'done' ? followUpSnack(phase.bg, block, iob, cob, settings, choice.rise) : undefined;

  return (
    <Screen>
      {phase.kind === 'treat' ? (
        <>
          {round > 1 ? <Notice level="danger" text={`Şekerin hâlâ düşük. ${round}. tur: tekrar hızlı karbonhidrat al.`} /> : null}
          <Card>
            <Field label="Şekerin" suffix="mg/dL" value={bgText} onChangeText={setBgText} big keyboard="number" placeholder="—" />
            {a.status === 'unknown' ? (
              <T variant="muted">Mümkünse önce ölç. Ölçemiyorsan ve belirtilerin varsa (titreme, terleme, çarpıntı, baş dönmesi) ölçmeden tedavi et.</T>
            ) : null}
          </Card>

          {a.status === 'severe' || a.status === 'unknown' ? (
            <Notice
              level="danger"
              text="Ciddi düşük şeker: Bilinç bulanıksa ağızdan bir şey VERİLMEMELİ. Yanındakiler glukagon (enjeksiyon veya burun spreyi) uygulamalı ve 112'yi aramalı."
            />
          ) : null}

          {a.status === 'invalid' ? <Notice level="danger" text={`Değer ${BG_MIN}–${BG_MAX} mg/dL arasında olmalı. Ölçümü kontrol et veya yeniden ölç.`} /> : null}

          {/* Düşük DEĞİL: karbonhidrat önerilmez */}
          {a.status === 'ok' || a.status === 'belowRange' || a.status === 'high' || a.status === 'veryHigh' ? (
            <Card title="Şekerin düşük değil" icon="checkmark-circle">
              <Notice
                level={a.status === 'veryHigh' ? 'danger' : a.status === 'high' ? 'warn' : 'info'}
                text={
                  a.status === 'veryHigh'
                    ? `Şekerin ${bg} mg/dL: yüksek. Karbonhidrat ALMA. Keton ölç; ketonun varsa doktoruna başvur.`
                    : a.status === 'high'
                      ? `Şekerin ${bg} mg/dL: hedef aralığın (${block.low}–${block.high}) üstünde. Karbonhidrat ALMA.`
                      : a.status === 'belowRange'
                        ? `Şekerin ${bg} mg/dL: hedef aralığın (${block.low}–${block.high}) biraz altında ama düşük (${settings.hypoThreshold} altı) değil. Şimdilik karbonhidrat gerekmiyor.`
                        : `Şekerin ${bg} mg/dL: hedef aralıkta. Karbonhidrat gerekmiyor.`
                }
              />
              {a.watch ? (
                <Notice
                  level="warn"
                  text={`Vücudunda ${fmt(iob)} Ü aktif insülin var; ileride şekerin ~${Math.max(a.eventualBg, 0)} mg/dL'ye inebilir. Şimdi karbonhidrat alma, 30–60 dk sonra tekrar ölç; ${settings.hypoThreshold} altına inerse buraya dön.`}
                />
              ) : null}
              <T variant="muted">Belirtilerin (titreme, terleme, çarpıntı) varsa 15 dk sonra yeniden ölç; parmak ucu ölçümü bazen yanıltabilir.</T>
              <Row>
                <Btn variant="secondary" icon="calculator" title="Doz hesapla" onPress={() => router.navigate('/calc' as Href)} style={{ flexGrow: 1 }} />
                <Btn variant="ghost" title="Kapat" onPress={() => router.back()} />
              </Row>
            </Card>
          ) : null}

          {treat ? (
            <Card title={preventive ? '1. Şekerin düşecek: küçük bir önlem al' : '1. Hemen hızlı karbonhidrat al'} icon="flash">
              {a.status === 'falling' ? (
                <Notice
                  level="warn"
                  text={`Şekerin ${bg} ama hedefin altında ve vücudunda ${fmt(iob)} Ü aktif insülin var; ~${Math.max(a.eventualBg, 0)} mg/dL'ye inmesi bekleniyor. Önlem olarak küçük bir miktar al.`}
                />
              ) : null}
              <View style={styles.center}>
                <T variant="big" color="danger">
                  {amount} g
                </T>
                <T variant="muted">hızlı etkili karbonhidrat</T>
              </View>
              {plan ? (
                <T variant="muted" style={{ textAlign: 'center' }}>
                  Şekerin {bg} → yaklaşık <T style={{ fontWeight: '700' }}>{plan.expectedBg}</T> mg/dL (hedef {block.target}). 15 dk sonra tekrar ölç.
                </T>
              ) : a.status === 'unknown' ? (
                <T variant="muted" style={{ textAlign: 'center' }}>
                  Belirti varken ölçmeden standart miktar. 15 dk sonra mutlaka ölç.
                </T>
              ) : (
                <T variant="muted" style={{ textAlign: 'center' }}>
                  15 dk sonra tekrar ölç.
                </T>
              )}
              <T variant="label" style={{ marginBottom: 0 }}>
                Bunlardan birini al ({amount} g için):
              </T>
              {quickCarbOptions(amount, settings.tabletG).map((o) => (
                <View key={o.text} style={styles.option}>
                  <Ionicons name={o.icon} size={18} color={c.danger} />
                  <T style={{ flex: 1 }}>{o.text}</T>
                </View>
              ))}
              <T variant="small">Çikolata, bisküvi gibi yağlı yiyecekler şekeri yavaş yükseltir; hipo için uygun değil.</T>
              {plan && plan.carbsWithIob > plan.carbsNow ? (
                <Notice
                  level="warn"
                  text={`Vücudunda ${fmt(iob)} Ü aktif insülin var. Hedefe ulaşmak için toplamda yaklaşık ${plan.carbsWithIob} g gerekebilir; ilk ${plan.carbsNow} g’dan sonra 15 dk bekle ve tekrar ölç.`}
                />
              ) : null}
              <Row>
                <Field label="Aldığın miktar" suffix="g" value={takenText} placeholder={String(amount)} onChangeText={setTakenText} step={5} base={amount} />
                <Btn title="Aldım, sayacı başlat" icon="timer-outline" variant="danger" onPress={treated} style={{ flexGrow: 1 }} />
              </Row>
            </Card>
          ) : null}

          {treat ? (
            <Collapsible title="Bu miktar nasıl hesaplandı?" icon="calculator">
              <T variant="muted">
                Şekerini hedefe ({block.target}) çıkaracak gram = (hedef − şekerin) ÷ 1 g’ın etkisi. 5 g’a yuvarlanır, tek seferde en az {HYPO_MIN_G}, en çok {HYPO_MAX_G} g
                (fazlası şekeri aşırı yükseltir). Ağır düşüklükte en az 20 g. Karbonhidrat yalnızca şekerin {settings.hypoThreshold} altındaysa, ölçemiyorsan belirtiye göre veya
                hedefin altındayken aktif insülinle düşmesi bekleniyorsa önerilir.
              </T>
              <T>
                1 g hızlı karbonhidrat şekerini yaklaşık <T style={{ fontWeight: '700' }}>{fmtRise(choice.rise)} mg/dL</T> yükseltiyor
                {choice.source === 'manual'
                  ? ' (senin girdiğin değer).'
                  : choice.source === 'data'
                    ? ` (${choice.samples} hipo tedavi kaydından otomatik hesaplandı).`
                    : ` (oranlarından: ${block.isf} ÷ ${fmtRise(block.icr)}). Kayıtlarından öğrenmesi için hipo tedavisini bu ekrandan kaydet; ${3 - Math.min(3, choice.samples)} kayıt daha yeterli.`}
              </T>
              <Row>
                <Field
                  label="1 g şekeri kaç mg/dL yükseltir"
                  suffix="mg/dL"
                  value={riseText ?? fmtRise(choice.rise)}
                  onChangeText={(v) => {
                    setRiseText(v);
                    const n = parseNum(v);
                    if (n !== undefined && n >= 0.5 && n <= 15) updateSettings({ hypoRise: n });
                  }}
                  step={0.5}
                />
                <Field
                  label="1 glukoz tableti"
                  suffix="g"
                  value={tabletText ?? String(settings.tabletG)}
                  onChangeText={(v) => {
                    setTabletText(v);
                    const n = parseNum(v);
                    if (n !== undefined && n >= 1 && n <= 20) updateSettings({ tabletG: n });
                  }}
                  step={0.5}
                />
              </Row>
              {settings.hypoRise !== undefined ? (
                <Btn
                  small
                  variant="secondary"
                  icon="sync"
                  title={choice.learned !== undefined ? `Otomatiğe dön (kayıtlarından ${fmtRise(choice.learned)})` : 'Otomatiğe dön (oranlarından)'}
                  onPress={() => {
                    updateSettings({ hypoRise: undefined });
                    setRiseText(undefined);
                  }}
                />
              ) : null}
              <T variant="small">Tablet gramajı paketin arkasında yazar. Emin değilsen paketten kontrol et.</T>
            </Collapsible>
          ) : null}
        </>
      ) : null}

      {phase.kind === 'wait' ? (
        <Card title="2. 15 dakika bekle" icon="timer">
          <Ring progress={1 - remaining / (WAIT_MIN * 60)} tone={remaining === 0 ? 'ok' : 'danger'}>
            <T variant="big" color={remaining === 0 ? 'ok' : 'text'}>
              {String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}
            </T>
            <T variant="small">{remaining === 0 ? 'Şimdi ölç' : 'dakika kaldı'}</T>
          </Ring>
          <View style={styles.center}>
            <T variant="muted" style={{ textAlign: 'center' }}>
              {remaining === 0 ? 'Süre doldu.' : 'Dinlen, egzersiz yapma, araç kullanma.'}
            </T>
            {notificationsSupported && phase.notifId ? (
              <T variant="small">Süre dolunca bildirim gelecek.</T>
            ) : (
              <T variant="small">Bu ekranı açık tut; süre dolunca halka yeşile döner.</T>
            )}
          </View>
          <Row>
            <Field label="Yeni ölçüm" suffix="mg/dL" value={recheckText} onChangeText={setRecheckText} keyboard="number" />
            <Btn title="Kaydet" icon="checkmark" onPress={recheck} disabled={recheckValue === undefined || !(recheckValue >= BG_MIN && recheckValue <= BG_MAX)} style={{ flexGrow: 1 }} />
          </Row>
        </Card>
      ) : null}

      {phase.kind === 'done' && done ? (
        <Card title="3. Şekerin düzeldi" icon="checkmark-circle">
          <Notice level="info" text={`Şekerin ${phase.bg} mg/dL. Aferin!`} />
          {done.snack > 0 ? (
            <T>
              Şekerin hedefin altında veya aktif insülin yüzünden tekrar düşebilir. Yaklaşık {done.snack} g kompleks karbonhidrat ye (15 g ≈ 1 dilim ekmek; 10 g ≈ 1 bardak süt); bunun için
              insülin vurma. 30–60 dk sonra tekrar ölç.
            </T>
          ) : (
            <T>Şekerin hedef aralıkta ve aktif insülin yüzünden düşmesi beklenmiyor; ek karbonhidrat gerekmiyor. Yaklaşık 1 saat sonra yine ölç.</T>
          )}
          <T variant="muted">
            Gece veya egzersiz sonrası hipo yaşadıysan önümüzdeki saatlerde daha sık ölç. Sık hipo yaşıyorsan Günlük sekmesinden saatlerine bak; raporu doktoruna gösterebilirsin.
          </T>
          <Btn title="Kapat" onPress={() => router.back()} />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: Space.xs },
  option: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingVertical: 2 },
});
