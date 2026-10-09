import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Btn, Card, Field, Notice, Screen, T, parseNum, tap } from '@/components/ui';
import { Radius, Space, useTheme } from '@/constants/theme';
import { currentTime, useCob, useIob, useNow } from '@/lib/hooks';
import { cancelNotification, scheduleRecheck } from '@/lib/notifications';
import { BG_MAX, BG_MIN, cautionText, fmt, isCaution } from '@/logic/bolus';
import { assessHypo, chooseRise, followUpSnack, hypoRiseSamples, quickCarbOptions } from '@/logic/hypo';
import { activeBlock } from '@/logic/schedule';
import { useLog } from '@/store/log';
import { useSettings } from '@/store/settings';
import { toast } from '@/store/toast';

const RECHECK_MIN = 15;
/** Bu süre içindeki hipo tedavileri aynı atak sayılır (tur sayısı, düzeldi mesajı) */
const EPISODE_MIN = 45;

const close = () => (router.canGoBack() ? router.back() : router.replace('/' as Href));

/**
 * Düşük şeker: şekere ve oranlara göre ne kadar hızlı karbonhidrat alınacağını gösterir.
 * Aldım → kayıt, ekran kapanır, 15 dk sonra hatırlatma. Tekrar ölçünce bu ekrana yeni değerle dönülür.
 */
export default function Hypo() {
  const params = useLocalSearchParams<{ bg?: string }>();
  const c = useTheme();
  const settings = useSettings((s) => s.settings);
  const entries = useLog((s) => s.entries);
  const addLog = useLog((s) => s.add);
  const now = useNow(10000);
  const iob = useIob(now);
  const cob = useCob(now);
  const block = activeBlock(settings.blocks, new Date(now));
  const [bgText, setBgText] = useState(params.bg ?? '');

  if (!block) {
    return (
      <Screen>
        <Card
          title="Oranların eksik"
          icon="alert-circle"
          right={
            <Pressable onPress={close} hitSlop={10} accessibilityLabel="Kapat">
              <Ionicons name="close" size={24} color={c.muted} />
            </Pressable>
          }>
          <T>Ne kadar karbonhidrat alacağını hesaplamak için oranların gerekli. Şimdilik 15 g hızlı şeker al, 15 dk sonra ölç.</T>
          <Btn title="Ayarlara git" icon="settings" onPress={() => router.navigate('/settings' as Href)} />
          <Btn variant="ghost" title="Kapat" onPress={close} />
        </Card>
      </Screen>
    );
  }

  const bg = parseNum(bgText);
  const rise = chooseRise(settings.hypoRise, hypoRiseSamples(entries, settings.blocks, { dia: settings.dia, peak: settings.peak }), block).rise;
  const a = assessHypo(bg, block, iob, cob, settings, rise);
  const preventive = a.status === 'falling';
  const plan = a.status === 'low' || a.status === 'severe' ? a.plan : undefined;
  const amount = a.status === 'falling' ? a.carbs : plan ? plan.carbsNow : 0;
  const treat = bg !== undefined && amount > 0;
  // Son 45 dakikadaki tedaviler: tekrar ölçümde "hâlâ düşük" veya "düzeldi" demek için
  const recent = entries.filter((e) => e.hypoCarbs && now - e.time >= 0 && now - e.time <= EPISODE_MIN * 60000).length;
  const round = recent + 1;

  async function treated() {
    tap('warning');
    const time = currentTime();
    // Önleyici miktar hipo atağı sayılmasın: yemek olarak kaydedilir
    const entry = preventive
      ? addLog({ time, bg, carbs: amount, note: 'Önleyici karbonhidrat (şeker düşüyordu)' })
      : addLog({ time, bg, hypoCarbs: amount, note: round > 1 ? `Hipo tedavisi (${round}. tur)` : 'Hipo tedavisi' });
    const notifId = await scheduleRecheck(RECHECK_MIN);
    toast(`${amount} g kaydedildi. ${RECHECK_MIN} dk sonra tekrar ölç.`, {
      label: 'Geri al',
      onPress: () => {
        useLog.getState().remove(entry.id);
        cancelNotification(notifId);
      },
    });
    close();
  }

  const caution = bg !== undefined && !treat && a.status !== 'invalid' && isCaution(bg, settings);
  const recovered = bg !== undefined && !treat && recent > 0 && a.status !== 'invalid';
  const snack = recovered ? followUpSnack(bg, block, iob, cob, settings, rise).snack : 0;

  return (
    <Screen>
      {treat && round > 1 && !preventive ? <Notice level="danger" text={`Şekerin hâlâ düşük. ${round}. tur.`} /> : null}

      <Card
        title="Düşük Şeker (Hipo)"
        icon="warning-outline"
        right={
          <Pressable onPress={close} hitSlop={10} accessibilityLabel="Kapat">
            <Ionicons name="close" size={24} color={c.muted} />
          </Pressable>
        }>
        <Field label="Şekerin" suffix="mg/dL" value={bgText} onChangeText={setBgText} big keyboard="number" placeholder="—" />
        {bg === undefined ? <T variant="small">Ölçemiyorsan 15 g hızlı şeker al, 15 dk sonra ölç.</T> : null}
        {a.status === 'invalid' ? <Notice level="danger" text={`Değer ${BG_MIN}–${BG_MAX} mg/dL arasında olmalı.`} /> : null}
      </Card>

      {treat ? (
        <Card>
          <View style={styles.center}>
            <T variant="label" style={{ marginBottom: 0 }}>
              {preventive ? 'Düşmemesi için al' : 'Hemen al'}
            </T>
            <T variant="big" color="danger" style={styles.hero}>
              {amount} g
            </T>
            <T variant="muted">hızlı karbonhidrat</T>
            {plan ? (
              <View style={[styles.pill, { backgroundColor: c.okBg }]}>
                <T variant="small" color="ok" style={{ fontWeight: '700' }}>
                  {bg} → ~{plan.expectedBg} mg/dL
                </T>
              </View>
            ) : null}
          </View>

          {a.status === 'severe' ? <Notice level="danger" text="Bilinç bulanıksa ağızdan bir şey verilmez. Glukagon uygulanmalı, 112 aranmalı." /> : null}

          <View style={{ gap: Space.xs }}>
            {quickCarbOptions(amount, settings.tabletG).map((o) => (
              <View key={o.text} style={[styles.option, { backgroundColor: c.cardAlt, borderColor: c.border }]}>
                <Ionicons name={o.icon} size={20} color={c.danger} />
                <T style={{ flex: 1, fontWeight: '700' }}>{o.text}</T>
                <T variant="small">{o.sub}</T>
              </View>
            ))}
          </View>

          {preventive ? (
            <T variant="small">{`Vücudunda ${fmt(iob)} Ü aktif insülin var; şekerin ~${Math.max(a.eventualBg, 0)}'e inebilir.`}</T>
          ) : plan && plan.carbsWithIob > plan.carbsNow ? (
            <T variant="small">{`Aktif insülin (${fmt(iob)} Ü) yüzünden 15 dk sonra bir tur daha gerekebilir.`}</T>
          ) : null}

          <Btn title="Aldım" icon="checkmark" variant="danger" onPress={treated} />
          <T variant="small" style={{ textAlign: 'center' }}>
            {RECHECK_MIN} dk sonra tekrar ölç ve buraya gir.
          </T>
          <Btn variant="ghost" title="Vazgeç / Kapat" onPress={close} />
        </Card>
      ) : null}

      {bg !== undefined && !treat && a.status !== 'invalid' ? (
        <Card>
          <View style={styles.center}>
            <Ionicons
              name={caution ? 'alert-circle' : 'checkmark-circle'}
              size={40}
              color={caution || a.status === 'veryHigh' || a.status === 'high' ? c.warn : c.ok}
            />
            <T variant="h2">{recovered ? 'Şekerin düzeldi' : caution ? 'Düşüğe yakınsın' : 'Şekerin düşük değil'}</T>
            {!caution ? (
              <T variant="muted" style={{ textAlign: 'center' }}>
                {a.status === 'veryHigh' ? 'Karbonhidrat alma. Şekerin yüksek; keton ölç.' : 'Karbonhidrat gerekmiyor.'}
              </T>
            ) : null}
          </View>
          {caution ? <Notice level="warn" text={cautionText(bg)} /> : null}
          {snack > 0 ? (
            <Notice level="info" text={`Tekrar düşmemesi için ~${snack} g yavaş karbonhidrat ye (1 dilim ekmek ≈ 15 g). Bunun için insülin vurma.`} />
          ) : null}
          {'watch' in a && a.watch ? (
            <Notice level="warn" text={`Aktif insülinle ~${Math.max(a.eventualBg, 0)} mg/dL'ye inebilir. 30 dk sonra tekrar ölç.`} />
          ) : null}
          <Btn variant="secondary" title="Kapat" onPress={close} />
        </Card>
      ) : null}

      {bg === undefined ? <Btn variant="ghost" title="Kapat" onPress={close} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: Space.xs },
  hero: { fontSize: 64, lineHeight: 72 },
  pill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4, marginTop: 4 },
  option: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 12 },
});
