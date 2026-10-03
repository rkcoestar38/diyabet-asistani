import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BgChart } from '@/components/bg-chart';
import { Chip } from '@/components/when';
import { Btn, Card, Row, Screen, Segmented, T } from '@/components/ui';
import { Radius, Space, useTheme, type Palette } from '@/constants/theme';
import { useNow } from '@/lib/hooks';
import { fmt } from '@/logic/bolus';
import { computeStats, entriesBetween, startOfDay, bgLevel, type Stats } from '@/logic/stats';
import { activeBlock } from '@/logic/schedule';
import { MEALS, entryMeal } from '@/logic/meals';
import { postOf } from '@/logic/postmeal';
import type { LogEntry } from '@/logic/types';
import { useLog } from '@/store/log';
import { useSettings } from '@/store/settings';

const DAY = 86400000;
const exerciseTr = { none: '', light: 'Hafif egzersiz', moderate: 'Orta egzersiz', intense: 'Yoğun egzersiz' } as const;

export default function Log() {
  const c = useTheme();
  const entries = useLog((s) => s.entries);
  const settings = useSettings((s) => s.settings);
  const now = useNow(60000);
  const [dayRaw, setDay] = useState(() => startOfDay(now));
  // Sabah saati ayarı değişirse seçili günü yeni sınırlara oturt
  const day = startOfDay(dayRaw + 12 * 3600000);
  const [period, setPeriod] = useState<'7' | '14' | '30'>('14');
  // Görünüm: gün veya "ayın kaçıncı haftası" (1–7, 8–14, 15–21, 22–28, 29–sonu)
  const [view, setView] = useState<'day' | 'week'>('day');
  const [wk, setWk] = useState(() => {
    const d = new Date(startOfDay(now));
    return { y: d.getFullYear(), m: d.getMonth(), i: Math.floor((d.getDate() - 1) / 7) };
  });

  const today = startOfDay(now);
  const logicalDay = (y: number, m: number, d: number) => startOfDay(new Date(y, m, d, 12).getTime());
  const dim = new Date(wk.y, wk.m + 1, 0).getDate();
  const weekCount = Math.ceil(dim / 7);
  const weekStartDate = (i: number) => 1 + 7 * i;
  const weekSpan = (i: number) => Math.min(7, dim - 7 * i);
  const weekStart = (i: number) => logicalDay(wk.y, wk.m, weekStartDate(i));
  const weeksShown = Array.from({ length: weekCount }, (_, i) => i).filter((i) => weekStart(i) <= today);

  const span = view === 'day' ? 1 : weekSpan(wk.i);
  const from = view === 'day' ? day : weekStart(wk.i);
  const last = from + (span - 1) * DAY;
  const dayEntries = entriesBetween(entries, from, last + DAY);
  const dayStats = computeStats(dayEntries, settings.blocks, settings.hypoThreshold);
  const shortDate = (t: number) => new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  const periodDays = Number(period);
  const periodStats = computeStats(entriesBetween(entries, today - (periodDays - 1) * DAY, today + DAY), settings.blocks, settings.hypoThreshold);

  const monthName = new Date(wk.y, wk.m, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  const curMonth = new Date(today);
  const isCurMonth = wk.y === curMonth.getFullYear() && wk.m === curMonth.getMonth();
  const moveMonth = (delta: number) => {
    const d = new Date(wk.y, wk.m + delta, 1);
    const cur = d.getFullYear() === curMonth.getFullYear() && d.getMonth() === curMonth.getMonth();
    setWk({ y: d.getFullYear(), m: d.getMonth(), i: cur ? Math.floor((curMonth.getDate() - 1) / 7) : 0 });
  };

  const label =
    view === 'week'
      ? monthName
      : day === today
        ? 'Bugün'
        : day === today - DAY
          ? 'Dün'
          : new Date(day).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Screen>
      <View style={styles.dayNav}>
        <Pressable onPress={() => (view === 'week' ? moveMonth(-1) : setDay(day - DAY))} hitSlop={12} accessibilityLabel="Önceki">
          <Ionicons name="chevron-back" size={28} color={c.primary} />
        </Pressable>
        <T variant="h2" style={{ flex: 1, textAlign: 'center' }}>
          {label}
        </T>
        <Pressable
          onPress={() => (view === 'week' ? !isCurMonth && moveMonth(1) : day < today && setDay(day + DAY))}
          hitSlop={12}
          accessibilityLabel="Sonraki">
          <Ionicons name="chevron-forward" size={28} color={(view === 'week' ? !isCurMonth : day < today) ? c.primary : c.border} />
        </Pressable>
      </View>

      <Segmented
        options={[
          { value: 'day', label: 'Gün' },
          { value: 'week', label: 'Hafta' },
        ]}
        value={view}
        onChange={setView}
      />

      {view === 'week' ? (
        <View style={{ gap: Space.xs }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm }}>
            {weeksShown.map((i) => (
              <Chip key={i} label={`${i + 1}. hafta`} active={i === wk.i} onPress={() => setWk({ ...wk, i })} />
            ))}
          </View>
          <T variant="small">
            Ayın {weekStartDate(wk.i)}–{weekStartDate(wk.i) + weekSpan(wk.i) - 1}. günleri · {shortDate(from)} – {shortDate(last)}
          </T>
        </View>
      ) : null}

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="analytics" size={20} color={c.primary} />
            <T variant="h2" style={{ fontWeight: '800' }}>
              Glikoz trendi
            </T>
          </View>
          <T variant="small">
            Hedef: {settings.blocks[0]?.low}–{settings.blocks[0]?.high}
          </T>
        </View>
        <BgChart entries={dayEntries} blocks={settings.blocks} dayStart={from} days={span} hypo={settings.hypoThreshold} />
        <StatGrid s={dayStats} perDay={span > 1 ? Math.max(dayStats.days, 1) : undefined} dayCount={span > 1 ? dayStats.days : undefined} />
        {dayStats.readings > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: dayStats.hypos ? c.dangerBg : c.okBg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
            <Ionicons name={dayStats.hypos ? 'alert-circle' : 'shield-checkmark'} size={16} color={dayStats.hypos ? c.danger : c.ok} />
            <T variant="small" color={dayStats.hypos ? 'danger' : 'ok'} style={{ fontWeight: '700' }}>
              {dayStats.hypos ? `${dayStats.hypos} hipo olayı` : 'Hipo olayı yok'}
            </T>
          </View>
        ) : null}
      </Card>

      <Row>
        <Btn title="Kayıt ekle" icon="add" onPress={() => router.push('/entry')} style={{ flexGrow: 1 }} />
        <Btn title="Bazal kaydet" icon="moon-outline" variant="secondary" onPress={() => router.push({ pathname: '/entry', params: { basal: '1' } })} style={{ flexGrow: 1 }} />
      </Row>
      <Btn variant="secondary" icon="document-text-outline" title="Doktor raporu (PDF)" onPress={() => router.push('/report' as Href)} />

      {span === 1 ? (
        <Card title="Günün kayıtları" icon="list" right={<T variant="small">{dayEntries.length} giriş</T>}>
          {dayEntries.length === 0 ? (
            <T variant="muted">Bu gün için kayıt yok.</T>
          ) : (
            [...dayEntries].reverse().map((e) => <EntryRow key={e.id} e={e} hasPost={!!postOf(entries, e)} />)
          )}
        </Card>
      ) : (
        <Card title="Günlere göre" icon="calendar">
          <DayTable
            entries={dayEntries}
            from={from}
            days={span}
            onPick={(d) => {
              setDay(d);
              setView('day');
            }}
          />
        </Card>
      )}

      <Card title="Genel bakış" icon="stats-chart">
        <Segmented
          options={[
            { value: '7', label: '7 gün' },
            { value: '14', label: '14 gün' },
            { value: '30', label: '30 gün' },
          ]}
          value={period}
          onChange={setPeriod}
        />
        <StatGrid s={periodStats} perDay={Math.max(periodStats.days,1)} dayCount={periodStats.days} />
        <T variant="small">
          Uluslararası hedef: ölçümlerin %70’inden fazlası aralıkta, %4’ünden azı 70 altında. (Parmak ucu ölçümleri sürekli sensör kadar kesin
          değildir.)
        </T>
      </Card>
    </Screen>
  );
}

/** Hafta/ay görünümünde her günün özeti; satıra dokununca o günün kayıtları açılır */
function DayTable({ entries, from, days, onPick }: { entries: LogEntry[]; from: number; days: number; onPick: (day: number) => void }) {
  const c = useTheme();
  const settings = useSettings((s) => s.settings);
  const rows = Array.from({ length: days }, (_, i) => from + (days - 1 - i) * DAY)
    .map((d) => ({ d, s: computeStats(entriesBetween(entries, d, d + DAY), settings.blocks, settings.hypoThreshold) }))
    .filter((r) => r.s.readings > 0 || r.s.carbs > 0 || r.s.bolus > 0);
  if (rows.length === 0) return <T variant="muted">Bu aralıkta kayıt yok.</T>;
  const cell = { fontVariant: ['tabular-nums' as const] };
  return (
    <View>
      <View style={styles.tRow}>
        <T variant="small" style={{ flex: 1.3 }}>Gün</T>
        <T variant="small" style={{ flex: 0.8, textAlign: 'right' }}>Ort.</T>
        <T variant="small" style={{ flex: 1, textAlign: 'right' }}>Aralıkta</T>
        <T variant="small" style={{ flex: 1.2, textAlign: 'right' }}>En düşük–yüksek</T>
        <T variant="small" style={{ flex: 0.6, textAlign: 'right' }}>Hipo</T>
      </View>
      {rows.map(({ d, s }) => (
        <Pressable key={d} onPress={() => onPick(d)} style={({ pressed }) => [styles.tRow, { borderTopColor: c.border, borderTopWidth: StyleSheet.hairlineWidth, opacity: pressed ? 0.6 : 1 }]}>
          <T style={{ flex: 1.3, fontWeight: '600' }}>{new Date(d).toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' })}</T>
          <T style={[{ flex: 0.8, textAlign: 'right' }, cell]}>{s.avg ?? '—'}</T>
          <T style={[{ flex: 1, textAlign: 'right' }, cell]} color={s.inRange === undefined ? undefined : s.inRange >= 70 ? 'ok' : s.inRange >= 50 ? 'warn' : 'danger'}>
            {s.inRange !== undefined ? `%${s.inRange}` : '—'}
          </T>
          <T style={[{ flex: 1.2, textAlign: 'right' }, cell]}>{s.min !== undefined ? `${s.min}–${s.max}` : '—'}</T>
          <T style={[{ flex: 0.6, textAlign: 'right' }, cell]} color={s.hypos ? 'danger' : undefined}>{s.hypos || '—'}</T>
        </Pressable>
      ))}
    </View>
  );
}

function StatGrid({ s, perDay, dayCount }: { s: Stats; perDay?: number; dayCount?: number }) {
  const c = useTheme();
  if (s.readings === 0 && !s.bolus && !s.carbs && !s.basal) return <T variant="muted">Henüz veri yok.</T>;
  const items: [string, string, (keyof Palette)?][] = [
    ['Ortalama', s.avg !== undefined ? `${s.avg}` : '—'],
    [perDay ? 'KH / gün' : 'Toplam KH', `${perDay ? Math.round(s.carbs / perDay) : s.carbs} g`],
    [perDay ? 'Hızlı / gün' : 'Hızlı insülin', `${fmt(perDay ? s.bolus / perDay : s.bolus)} Ü`],
    [perDay ? 'Bazal / gün' : 'Bazal', s.basal ? `${fmt(perDay ? s.basal / perDay : s.basal)} Ü` : '—'],
    ['Hipo', `${s.hypos}`, s.hypos ? 'danger' : undefined],
    ...(perDay && s.readings >= 5 ? ([['Tahmini HbA1c', s.gmi !== undefined ? `%${s.gmi}` : '—'], ['Değişkenlik (CV)', s.cv !== undefined ? `%${s.cv}` : '—']] as [string, string][]) : []),
  ];
  return (
    <View style={styles.grid}>
      {s.readings > 0 ? (
        <View style={{ width: '100%', gap: 4 }}>
          <View style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: c.border }}>
            <View style={{ flex: s.below ?? 0, backgroundColor: c.danger }} />
            <View style={{ flex: s.inRange ?? 0, backgroundColor: c.ok }} />
            <View style={{ flex: s.above ?? 0, backgroundColor: c.warn }} />
          </View>
          <T variant="small">
            Hedefin altında %{s.below ?? 0} · Aralıkta %{s.inRange ?? 0} · Üstünde %{s.above ?? 0}
          </T>
        </View>
      ) : null}
      {items.map(([k, v, color]) => (
        <View key={k} style={[styles.stat, { backgroundColor: c.bg }]}>
          <T variant="small">{k}</T>
          <T variant="h2" color={color}>
            {v}
          </T>
        </View>
      ))}
      <T variant="small" style={{ width: '100%' }}>
        {dayCount !== undefined ? `${dayCount} günün kaydı · ` : ''}{s.readings} ölçüm{s.min !== undefined ? ` · en düşük ${s.min} · en yüksek ${s.max}` : ''}
      </T>
    </View>
  );
}

function EntryRow({ e, hasPost }: { e: LogEntry; hasPost: boolean }) {
  const c = useTheme();
  const starts = useSettings((s) => s.settings.mealStarts);
  const meal = MEALS.find((m) => m.id === entryMeal(e, starts));
  const parts: string[] = [];
  if (e.post) parts.push('Tokluk');
  if (e.carbs) parts.push(`${fmt(e.carbs)} g KH`);
  if (e.bolus) parts.push(`${fmt(e.bolus)} Ü hızlı`);
  if (e.basal) parts.push(`${fmt(e.basal)} Ü bazal`);
  if (e.hypoCarbs) parts.push(`Hipo: ${e.hypoCarbs} g`);
  if (e.ketones !== undefined) parts.push(`Keton ${fmt(e.ketones)}`);
  if (e.exercise && e.exercise !== 'none') parts.push(exerciseTr[e.exercise]);
  const hypo = useSettings((s) => s.settings.hypoThreshold);
  const blocks = useSettings((s) => s.settings.blocks);
  const bgColor = e.bg === undefined ? 'muted' : bgLevel(e.bg, activeBlock(blocks, new Date(e.bgTime ?? e.time)), hypo);
  const row = (
    <Pressable
      onPress={() => router.push({ pathname: '/entry', params: { id: e.id } })}
      style={({ pressed }) => [styles.entry, { borderColor: c.border, opacity: pressed ? 0.6 : 1 }]}>
      <View style={{ width: 62 }}>
        <T variant="muted">{new Date(e.time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</T>
        {meal ? (
          <T variant="small" color="primary" numberOfLines={1}>
            {meal.short}
          </T>
        ) : null}
        {e.bgTime ? <T variant="small">ölç. {new Date(e.bgTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</T> : null}
      </View>
      <View style={[styles.bgPill, { backgroundColor: c.bg }]}>
        <T style={{ fontWeight: '700' }} color={bgColor}>
          {e.bg ?? '—'}
        </T>
      </View>
      <View style={{ flex: 1 }}>
        <T>{parts.join(' · ') || (e.bg !== undefined ? 'Ölçüm' : 'Not')}</T>
        {e.foods || e.note ? (
          <T variant="small" numberOfLines={2}>
            {[e.foods, e.note].filter(Boolean).join(' — ')}
          </T>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.muted} />
    </Pressable>
  );
  if (!e.carbs || e.post || hasPost) return row;
  return (
    <View>
      {row}
      <Pressable onPress={() => router.push({ pathname: '/entry', params: { after: e.id } })} hitSlop={6} style={{ paddingVertical: 6, paddingLeft: 62 + Space.sm }}>
        <T variant="small" color="primary" style={{ fontWeight: '600' }}>
          + Tokluk şekeri ekle
        </T>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 9 },
  dayNav: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  stat: { flexGrow: 1, flexBasis: '22%', minWidth: 75, borderRadius: Radius.md, padding: Space.sm },
  entry: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  bgPill: { minWidth: 52, alignItems: 'center', borderRadius: Radius.sm, paddingVertical: 4 },
});
