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
import { bgLevelIn, computeStats, entriesBetween, rangeFor, startOfDay, type Stats } from '@/logic/stats';
import { entryMeal, mealLabel } from '@/logic/meals';
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
  const calendarWeekSpan = (i: number) => Math.min(7, dim - 7 * i);
  const weekStart = (i: number) => logicalDay(wk.y, wk.m, weekStartDate(i));
  const weeksShown = Array.from({ length: weekCount }, (_, i) => i).filter((i) => weekStart(i) <= today);

  // Seçili haftanın takvim başlangıcı ve sonu
  const wStart = weekStart(wk.i);
  const calSpan = calendarWeekSpan(wk.i);
  const calEnd = wStart + (calSpan - 1) * DAY;

  // Kullanıcı kuralı: Henüz veri olmayan gelecek boş günler görünmesin!
  // Eğer bu hafta halen devam ediyorsa (veya günümüzdeysek), sadece bugüne (today) kadar olan günleri göster.
  // Gün ilerledikçe (yarın olduğunda) yeni gün de grafikte yerini alır.
  const visibleLastDay = Math.min(calEnd, today);
  const activeWeekSpan = Math.max(1, Math.round((visibleLastDay - wStart) / DAY) + 1);

  const span = view === 'day' ? 1 : activeWeekSpan;
  const from = view === 'day' ? day : wStart;
  const last = from + (span - 1) * DAY;
  const dayEntries = entriesBetween(entries, from, last + DAY);
  const ranges = { fastingRange: settings.fastingRange, postRange: settings.postRange, all: entries };
  const dayStats = computeStats(dayEntries, settings.blocks, settings.hypoThreshold, ranges);
  const shortDate = (t: number) => new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  const periodDays = Number(period);
  const periodStats = computeStats(entriesBetween(entries, today - (periodDays - 1) * DAY, today + DAY), settings.blocks, settings.hypoThreshold, ranges);

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
            {span === 1
              ? `Ayın ${weekStartDate(wk.i)}. günü · ${shortDate(from)}`
              : `Ayın ${weekStartDate(wk.i)}–${weekStartDate(wk.i) + span - 1}. günleri · ${shortDate(from)} – ${shortDate(last)}`}
            {activeWeekSpan < calSpan ? ' (devam ediyor)' : ''}
          </T>
        </View>
      ) : null}

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="analytics" size={20} color={c.primary} />
          <T variant="h2" style={{ fontWeight: '800' }}>
            Glikoz trendi
          </T>
        </View>
        <BgChart
          entries={dayEntries}
          all={entries}
          ranges={settings}
          dayStart={from}
          days={span}
          hypo={settings.hypoThreshold}
          isWeek={view === 'week'}
        />
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

      {view === 'day' ? (
        <Card title="Günün kayıtları" icon="list" right={<T variant="small">{dayEntries.length} giriş</T>}>
          {dayEntries.length === 0 ? (
            <T variant="muted">Bu gün için kayıt yok.</T>
          ) : (
            [...dayEntries].reverse().map((e) => <EntryRow key={e.id} e={e} />)
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
        <StatGrid s={periodStats} perDay={Math.max(periodStats.days, 1)} dayCount={periodStats.days} />
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
    .map((d) => ({ d, s: computeStats(entriesBetween(entries, d, d + DAY), settings.blocks, settings.hypoThreshold, { ...settings, all: entries }) }))
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
      {dayCount !== undefined && dayCount > 0 ? (
        <T variant="small" color="muted" style={{ width: '100%', textAlign: 'right' }}>
          {dayCount} günün kaydı
        </T>
      ) : null}
    </View>
  );
}

function EntryRow({ e }: { e: LogEntry }) {
  const c = useTheme();
  const settings = useSettings((s) => s.settings);
  const entries = useLog((s) => s.entries);
  const post = postOf(entries, e);
  const timeStr = new Date(e.time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const meal = entryMeal(e, settings.mealStarts);
  const mLabel = mealLabel(meal);
  const range = rangeFor(e, entries, settings);
  const lvl = e.bg !== undefined ? bgLevelIn(e.bg, range, settings.hypoThreshold) : undefined;
  const isHypo = lvl === 'danger' && e.bg !== undefined && e.bg < settings.hypoThreshold;
  // Açlık bağlamı: bu ölçüm açlık aralığıyla mı değerlendirildi (tokluk penceresi dışında mı)
  const isFasting = e.bg !== undefined && range.low === settings.fastingRange.low && range.high === settings.fastingRange.high;
  const gapHours = post ? ((post.time - e.time) / 3600000).toFixed(1) : undefined;
  const delta = post?.bg !== undefined && e.bg !== undefined ? post.bg - e.bg : undefined;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/entry', params: { id: e.id } })}
      style={({ pressed }) => [
        styles.entryRow,
        {
          borderColor: isHypo ? c.danger : c.border,
          backgroundColor: isHypo ? c.dangerBg : c.card,
          opacity: pressed ? 0.7 : 1,
        },
      ]}>
      <View style={{ flex: 1, gap: Space.xxs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Space.xs }}>
          <T style={{ fontWeight: '700' }}>{timeStr}</T>
          <T color="muted">·</T>
          <T color="muted">{mLabel}</T>
          {isFasting ? (
            <View style={{ backgroundColor: c.primarySoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
              <T variant="small" color="primary">
                Açlık
              </T>
            </View>
          ) : null}
        </View>
        {e.note ? <T variant="small" color="muted">{e.note}</T> : null}
        {e.exercise && e.exercise !== 'none' ? <T variant="small" color="muted">{exerciseTr[e.exercise]}</T> : null}
        {post && post.bg !== undefined ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Ionicons name="timer-outline" size={14} color={c.muted} />
            <T variant="small" color="muted">
              {gapHours} sa sonra: {post.bg} mg/dL {delta !== undefined ? `(${delta > 0 ? `+${delta}` : delta})` : ''}
            </T>
          </View>
        ) : !e.post && meal !== 'gece' && !meal.includes('Ara') ? (
          <T variant="small" color="warn">
            Tokluk ölçümü eksik
          </T>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: Space.xxs }}>
        {e.bg !== undefined ? (
          <T variant="h2" color={lvl} style={{ fontWeight: '800' }}>
            {e.bg}
          </T>
        ) : null}
        <View style={{ flexDirection: 'row', gap: Space.xs }}>
          {e.bolus ? <T variant="small" color="primary">{`${fmt(e.bolus)} Ü`}</T> : null}
          {e.carbs ? <T variant="small" color="warn">{`${e.carbs}g KH`}</T> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dayNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Space.xs,
  },
  tRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: Space.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.sm,
  },
  stat: {
    flexGrow: 1,
    minWidth: '45%',
    padding: Space.sm,
    borderRadius: Radius.md,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Space.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
});
