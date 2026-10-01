import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Ring } from '@/components/ring';
import { Btn, Card, Field, Notice, Row, Screen, T, parseNum } from '@/components/ui';
import { Space } from '@/constants/theme';
import { useCob, useIob, useNow } from '@/lib/hooks';
import { cancelNotification, notificationsSupported, scheduleRecheck } from '@/lib/notifications';
import { BG_MAX, BG_MIN, fmt, hypoPlan } from '@/logic/bolus';
import { activeBlock } from '@/logic/schedule';
import { useLog } from '@/store/log';
import { useSettings } from '@/store/settings';

const WAIT_MIN = 15;

type Phase = { kind: 'treat' } | { kind: 'wait'; since: number; notifId?: string } | { kind: 'done'; bg: number };

export default function Hypo() {
  const params = useLocalSearchParams<{ bg?: string }>();
  const settings = useSettings((s) => s.settings);
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
  const plan = bg !== undefined ? hypoPlan(bg, block, iob, settings, cob) : undefined;
  const [takenText, setTakenText] = useState('');

  async function treated() {
    const grams = parseNum(takenText) ?? plan?.carbsNow ?? 15;
    addLog({ time: Date.now(), bg, hypoCarbs: grams, note: round > 1 ? `Hipo tedavisi (${round}. tur)` : 'Hipo tedavisi' });
    const notifId = await scheduleRecheck(WAIT_MIN);
    setPhase({ kind: 'wait', since: Date.now(), notifId });
  }

  function recheck() {
    const value = parseNum(recheckText);
    if (value === undefined || !(value >= BG_MIN && value <= BG_MAX)) return;
    if (phase.kind === 'wait') cancelNotification(phase.notifId);
    if (value < settings.hypoThreshold) {
      addLog({ time: Date.now(), bg: value, note: 'Hipo kontrol ölçümü' });
      setBgText(String(value));
      setTakenText('');
      setRecheckText('');
      setRound((r) => r + 1);
      setPhase({ kind: 'treat' });
    } else {
      addLog({ time: Date.now(), bg: value, note: 'Hipo düzeldi' });
      setPhase({ kind: 'done', bg: value });
    }
  }

  const remaining = phase.kind === 'wait' ? Math.max(0, WAIT_MIN * 60 - Math.floor((now - phase.since) / 1000)) : 0;

  return (
    <Screen>
      {phase.kind === 'treat' ? (
        <>
          {round > 1 ? <Notice level="danger" text={`Şekerin hâlâ düşük. ${round}. tur: tekrar hızlı karbonhidrat al.`} /> : null}
          <Card>
            <Field label="Şekerin" suffix="mg/dL" value={bgText} onChangeText={setBgText} big keyboard="number" placeholder="—" />
            {bg === undefined ? (
              <T variant="muted">Ölçemiyorsan ve belirtilerin varsa (titreme, terleme, çarpıntı, baş dönmesi) ölçmeden tedavi et.</T>
            ) : null}
          </Card>

          {plan?.severe || bg === undefined ? (
            <Notice
              level="danger"
              text="Ciddi düşük şeker: Bilinç bulanıksa ağızdan bir şey VERİLMEMELİ. Yanındakiler glukagon (enjeksiyon veya burun spreyi) uygulamalı ve 112'yi aramalı."
            />
          ) : null}

          <Card title="1. Hemen hızlı karbonhidrat al" icon="flash">
            <View style={styles.center}>
              <T variant="big" color="danger">
                {plan?.carbsNow ?? 15} g
              </T>
              <T variant="muted">hızlı etkili karbonhidrat</T>
            </View>
            <T>• 4 glukoz tableti (paketteki gramajı kontrol et)</T>
            <T>• 150 ml meyve suyu veya normal (şekerli) kola</T>
            <T>• 3 tatlı kaşığı şeker veya 5 küp şeker suda eritilmiş</T>
            <T>• 1 yemek kaşığı bal</T>
            <T variant="small">Çikolata, bisküvi gibi yağlı yiyecekler şekeri yavaş yükseltir — hipo için uygun değil.</T>
            {plan && plan.carbsWithIob > plan.carbsNow ? (
              <Notice
                level="warn"
                text={`Vücudunda ${fmt(iob)} Ü aktif insülin var. Hedefe ulaşmak için toplamda yaklaşık ${plan.carbsWithIob} g gerekebilir; ilk ${plan.carbsNow} g'dan sonra 15 dk bekle ve tekrar ölç.`}
              />
            ) : null}
            <Row>
              <Field label="Aldığın miktar" suffix="g" value={takenText} placeholder={String(plan?.carbsNow ?? 15)} onChangeText={setTakenText} step={5} base={plan?.carbsNow ?? 15} />
              <Btn title="Aldım, sayacı başlat" icon="timer-outline" variant="danger" onPress={treated} style={{ flexGrow: 1 }} />
            </Row>
          </Card>
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
            <Btn title="Kaydet" icon="checkmark" onPress={recheck} disabled={(() => { const v = parseNum(recheckText); return v === undefined || !(v >= BG_MIN && v <= BG_MAX); })()} style={{ flexGrow: 1 }} />
          </Row>
        </Card>
      ) : null}

      {phase.kind === 'done' ? (
        <Card title="3. Şekerin düzeldi" icon="checkmark-circle">
          <Notice level="info" text={`Şekerin ${phase.bg} mg/dL. Aferin!`} />
          <T>
            Bir sonraki öğüne 1 saatten fazla varsa şimdi yaklaşık 15 g kompleks karbonhidrat ye (ör. 1 dilim ekmek + peynir veya 1 bardak süt);
            bunun için insülin vurma.
          </T>
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
});
