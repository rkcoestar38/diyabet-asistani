import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { View } from 'react-native';

import { Collapsible } from '@/components/guide';
import { DateField, Pressy, Row, T, TimeField } from '@/components/ui';
import { Radius, Space, useTheme } from '@/constants/theme';
import { parseDateInput, parseTimeInput, toDateInput, toTimeInput } from '@/lib/input';
import { MEALS, mealAt, mealLabel, mealRange } from '@/logic/meals';
import type { IconName } from '@/components/ui';
import type { MealType } from '@/logic/types';
import { useDraft } from '@/store/draft';
import { useSettings } from '@/store/settings';

export function Chip({ label, onPress, active, icon }: { label: string; onPress: () => void; active?: boolean; icon?: IconName }) {
  const c = useTheme();
  return (
    <Pressy
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1.5,
        borderRadius: Radius.pill,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderColor: active ? c.primary : c.border,
        backgroundColor: active ? c.primarySoft : c.cardAlt,
      }}>
      {icon ? <Ionicons name={icon} size={15} color={active ? c.primary : c.muted} /> : null}
      <T variant="small" color={active ? 'primary' : 'text'} style={{ fontWeight: '600' }}>
        {label}
      </T>
    </Pressy>
  );
}

export const wrapRow = { flexDirection: 'row', flexWrap: 'wrap', gap: 8 } as const;

/** Yedi öğün: seçili olan vurgulanır; `auto` doğruysa "saate göre otomatik" ipucu görünür. */
export function MealChips({ value, onChange, auto }: { value: MealType; onChange: (m: MealType) => void; auto: boolean }) {
  const starts = useSettings((s) => s.settings.mealStarts);
  return (
    <View style={{ gap: Space.sm }}>
      <View style={wrapRow}>
        {MEALS.map((m) => (
          <Chip key={m.id} label={m.short} icon={m.icon as IconName} active={m.id === value} onPress={() => onChange(m.id)} />
        ))}
      </View>
      <T variant="small">
        {mealLabel(value)} ({mealRange(value, starts)}){auto ? ' · saate göre otomatik seçildi, istersen değiştir' : ''}
      </T>
    </View>
  );
}

const DOSE_OFFSETS = [
  { label: 'Şimdi', minutes: 0 },
  { label: '15 dk önce', minutes: 15 },
  { label: '30 dk önce', minutes: 30 },
  { label: '1 saat önce', minutes: 60 },
  { label: '2 saat önce', minutes: 120 },
];
const BG_OFFSETS = [
  { label: 'Aynı anda', minutes: 0 },
  { label: '5 dk önce', minutes: 5 },
  { label: '10 dk önce', minutes: 10 },
  { label: '15 dk önce', minutes: 15 },
  { label: '30 dk önce', minutes: 30 },
  { label: '1 saat önce', minutes: 60 },
];

/** Taslaktan hesaplanan zamanlar ve öğün */
export function useWhen(now: number) {
  const draft = useDraft();
  const starts = useSettings((s) => s.settings.mealStarts);
  const doseTime = draft.when ?? now;
  const bgTime = Math.min(draft.bgTime ?? doseTime, doseTime);
  const autoMeal = mealAt(doseTime, starts);
  const meal = draft.meal ?? autoMeal;
  return { doseTime, bgTime, meal, autoMeal, isAuto: draft.meal === undefined, retro: draft.when !== undefined, bgEarlier: doseTime - bgTime >= 5 * 60000 };
}

function summary(doseTime: number, bgTime: number, now: number, retro: boolean) {
  const when = retro ? `${toDateInput(doseTime) === toDateInput(now) ? 'Bugün' : toDateInput(doseTime)} ${toTimeInput(doseTime)}` : 'Şimdi';
  const gap = Math.round((doseTime - bgTime) / 60000);
  const bg = gap >= 5 ? `şeker ${toTimeInput(bgTime)}'te ölçüldü` : 'şeker aynı anda';
  return `${when} · ${bg}`;
}

/** Öğün seçimi + (katlanabilir) yemek/doz zamanı ve şeker ölçüm saati */
export function WhenCard({ now }: { now: number }) {
  const draft = useDraft();
  const w = useWhen(now);
  // Yalnızca kullanıcı yazarken tamamlanmamış metinleri tutar; geri kalan her şey taslaktan ve canlı saatten türetilir.
  const [typing, setTyping] = useState<{ date?: string; time?: string; bg?: string }>({});

  const dateShown = typing.date ?? toDateInput(w.doseTime);
  const timeShown = typing.time ?? toTimeInput(w.doseTime);
  const bgShown = typing.bg ?? toTimeInput(w.bgTime);

  const setDose = (t: number | undefined) => {
    draft.set({ when: t, bgTime: undefined });
    setTyping({});
  };

  function commitDateTime(d: string, t: string) {
    const day = parseDateInput(d);
    const min = parseTimeInput(t);
    if (day === undefined || min === undefined) return;
    const res = new Date(day);
    res.setHours(Math.floor(min / 60), min % 60, 0, 0);
    if (res.getTime() > Date.now() + 60000) return;
    draft.set({ when: res.getTime(), bgTime: undefined });
    setTyping({});
  }

  function setBgOffset(minutes: number) {
    draft.set({ bgTime: minutes === 0 ? undefined : w.doseTime - minutes * 60000 });
    setTyping((t) => ({ ...t, bg: undefined }));
  }

  function commitBgTime(text: string) {
    const min = parseTimeInput(text);
    if (min === undefined) return;
    const d = new Date(w.doseTime);
    d.setHours(Math.floor(min / 60), min % 60, 0, 0);
    let t = d.getTime();
    if (t > w.doseTime) t -= 86400000; // yemekten sonraki saat girildiyse bir önceki gün (gece yarısı aşımı)
    draft.set({ bgTime: t });
    setTyping((p) => ({ ...p, bg: undefined }));
  }

  return (
    <View style={{ gap: Space.md }}>
      <MealChips value={w.meal} auto={w.isAuto} onChange={(m) => draft.set({ meal: m })} />
      {w.retro ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm }}>
          <T variant="small" style={{ flex: 1 }}>
            Kayıt {toDateInput(w.doseTime) === toDateInput(now) ? 'bugün' : toDateInput(w.doseTime)} {toTimeInput(w.doseTime)} için girilecek
          </T>
          <Chip label="Şimdiye dön" icon="refresh" onPress={() => setDose(undefined)} />
        </View>
      ) : null}
      <Collapsible title="Zaman" icon="time-outline">
        <T variant="muted">{summary(w.doseTime, w.bgTime, now, w.retro)}</T>
        <View style={{ gap: 6 }}>
          <T variant="label" style={{ marginBottom: 0 }}>
            Yemek / doz zamanı
          </T>
          <View style={wrapRow}>
            {DOSE_OFFSETS.map((o) => (
              <Chip key={o.label} label={o.label} active={o.minutes === 0 ? !w.retro : false} onPress={() => setDose(o.minutes === 0 ? undefined : Date.now() - o.minutes * 60000)} />
            ))}
            <Chip label="Dün" onPress={() => setDose(Date.now() - 86400000)} />
          </View>
          <Row>
            <DateField
              label="Tarih"
              value={dateShown}
              onChange={(v) => {
                setTyping((p) => ({ ...p, date: v }));
                commitDateTime(v, timeShown);
              }}
            />
            <TimeField
              label="Saat"
              value={timeShown}
              onChange={(v) => {
                setTyping((p) => ({ ...p, time: v }));
                commitDateTime(dateShown, v);
              }}
            />
          </Row>
        </View>
        <View style={{ gap: 6 }}>
          <T variant="label" style={{ marginBottom: 0 }}>
            Şekeri ne zaman ölçtün?
          </T>
          <View style={wrapRow}>
            {BG_OFFSETS.map((o) => (
              <Chip key={o.label} label={o.label} active={Math.round((w.doseTime - w.bgTime) / 60000) === o.minutes} onPress={() => setBgOffset(o.minutes)} />
            ))}
          </View>
          <TimeField
            label="Ölçüm saati"
            value={bgShown}
            onChange={(v) => {
              setTyping((p) => ({ ...p, bg: v }));
              commitBgTime(v);
            }}
          />
          <T variant="small">Ölçüm yemekten önceyse, aradaki insülin ve karbonhidratın etkisi hesaba katılıp şimdiki şeker tahmin edilir.</T>
        </View>
      </Collapsible>
    </View>
  );
}
