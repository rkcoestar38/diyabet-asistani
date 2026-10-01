import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Chip, MealChips, wrapRow } from '@/components/when';
import { Btn, Card, DateField, Field, Notice, Row, Screen, Segmented, T, TimeField, confirm, parseNum } from '@/components/ui';
import { Space } from '@/constants/theme';
import { useNow } from '@/lib/hooks';
import { parseDateInput, parseTimeInput, toDateInput, toTimeInput } from '@/lib/input';
import { BG_MAX, BG_MIN, fmt } from '@/logic/bolus';
import { mealAt } from '@/logic/meals';
import type { ExerciseLevel, LogEntry, LogItem, MealType } from '@/logic/types';
import { cartMeatRule, cartTotal, useFoods } from '@/store/foods';
import { useLog } from '@/store/log';
import { useSettings } from '@/store/settings';

const str = (n?: number) => (n === undefined ? '' : String(n).replace('.', ','));

function parseDateTime(date: string, time: string): number | undefined {
  const d = parseDateInput(date);
  const t = parseTimeInput(time);
  if (d === undefined || t === undefined) return undefined;
  const res = new Date(d);
  res.setHours(Math.floor(t / 60), t % 60, 0, 0);
  return res.getTime();
}

const OFFSETS: { label: string; minutes: number }[] = [
  { label: 'Şimdi', minutes: 0 },
  { label: '15 dk önce', minutes: 15 },
  { label: '30 dk önce', minutes: 30 },
  { label: '1 saat önce', minutes: 60 },
  { label: '2 saat önce', minutes: 120 },
];
const BG_OFFSETS = [
  { label: 'Aynı anda', minutes: 0 },
  { label: '5 dk önce', minutes: 5 },
  { label: '15 dk önce', minutes: 15 },
  { label: '30 dk önce', minutes: 30 },
  { label: '1 saat önce', minutes: 60 },
];

export default function Entry() {
  const params = useLocalSearchParams<{ id?: string; basal?: string }>();
  const existing = useLog((s) => s.entries.find((e) => e.id === params.id));
  const { add, update, remove } = useLog();
  const settings = useSettings((s) => s.settings);
  const cart = useFoods((s) => s.cart);
  const clearCart = useFoods((s) => s.clearCart);

  const now = useNow(10000);
  // Düzenlenen kayıtta kayıtlı zaman; yeni kayıtta kullanıcı dokunmadıkça canlı "şimdi"
  const [dateText, setDateText] = useState<string | undefined>(existing ? toDateInput(existing.time) : undefined);
  const [timeText, setTimeText] = useState<string | undefined>(existing ? toTimeInput(existing.time) : undefined);
  const date = dateText ?? toDateInput(now);
  const time = timeText ?? toTimeInput(now);
  const setDate = setDateText;
  const setTime = setTimeText;
  const setWhen = (t: number | undefined) => {
    setDateText(t === undefined ? undefined : toDateInput(t));
    setTimeText(t === undefined ? undefined : toTimeInput(t));
  };
  const [meal, setMeal] = useState<MealType | undefined>(existing?.meal);
  const [bg, setBg] = useState(str(existing?.bg));
  // Boş = yemek/kayıt zamanıyla aynı anda ölçüldü
  const [bgTimeText, setBgTimeText] = useState(existing?.bgTime ? toTimeInput(existing.bgTime) : '');
  const [carbs, setCarbs] = useState(str(existing?.carbs));
  const [items, setItems] = useState<LogItem[] | undefined>(existing?.items);
  const [bolus, setBolus] = useState(str(existing?.bolus));
  const [basal, setBasal] = useState(str(existing?.basal ?? (params.basal && settings.basalDose ? settings.basalDose : undefined)));
  const [hypoCarbs, setHypoCarbs] = useState(str(existing?.hypoCarbs));
  const [ketones, setKetones] = useState(str(existing?.ketones));
  const [exercise, setExercise] = useState<ExerciseLevel>(existing?.exercise ?? 'none');
  const [note, setNote] = useState(existing?.note ?? '');

  // "Şimdi" seçiliyken saat, kaydetme anındaki gerçek zaman olur
  const untouched = dateText === undefined && timeText === undefined && !existing;
  const ts = untouched ? now : parseDateTime(date, time);
  const autoMeal = ts !== undefined ? mealAt(ts, settings.mealStarts) : 'sabah';
  const mealValue = meal ?? autoMeal;

  // Şeker ölçüm zamanı: aynı gün, kayıt zamanından önce (gece yarısını aşarsa bir önceki gün)
  let bgTime: number | undefined;
  if (bgTimeText && ts !== undefined) {
    const m = parseTimeInput(bgTimeText);
    if (m !== undefined) {
      const d = new Date(ts);
      d.setHours(Math.floor(m / 60), m % 60, 0, 0);
      bgTime = d.getTime() > ts ? d.getTime() - 86400000 : d.getTime();
    }
  }
  if (bgTime !== undefined && ts !== undefined && ts - bgTime < 5 * 60000) bgTime = undefined;

  const values = {
    bg: parseNum(bg),
    carbs: parseNum(carbs),
    bolus: parseNum(bolus),
    basal: parseNum(basal),
    hypoCarbs: parseNum(hypoCarbs),
    ketones: parseNum(ketones),
  };
  const errors: string[] = [];
  if (ts === undefined) errors.push('Tarih ve saati tam yaz.');
  else if (ts > now + 5 * 60000) errors.push('Gelecekteki bir zaman girilemez.');
  if (bgTimeText && parseTimeInput(bgTimeText) === undefined) errors.push('Ölçüm saatini tam yaz (ör. 07:25).');
  if (values.bg !== undefined && !(values.bg >= BG_MIN && values.bg <= BG_MAX)) errors.push(`Şeker ${BG_MIN}–${BG_MAX} arasında olmalı.`);
  if (values.carbs !== undefined && !(values.carbs >= 0 && values.carbs <= 400)) errors.push('Karbonhidrat geçersiz.');
  if (values.bolus !== undefined && !(values.bolus >= 0 && values.bolus <= 100)) errors.push('Hızlı insülin geçersiz.');
  if (values.basal !== undefined && !(values.basal >= 0 && values.basal <= 200)) errors.push('Bazal geçersiz.');
  const empty = Object.values(values).every((v) => v === undefined) && !note.trim() && exercise === 'none';

  const cartCarbs = cartTotal(cart);
  const applyCart = () => {
    const rule = cartMeatRule(cart);
    setItems([
      ...cart.map((i) => ({ foodId: i.foodId, name: i.name, grams: i.grams, carbs: i.carbs, fatty: i.fatty })),
      ...(rule > 0 ? [{ foodId: 'rule-meat', name: 'Et kuralı (100 g üzeri et)', grams: 0, carbs: rule }] : []),
    ]);
    setCarbs(String(cartCarbs));
  };
  // Tabaktaki yemekler değişince (veya ekran tabakla açılınca) kayda kendiliğinden aktarılır; onay gerekmez.
  // Var olan kayıt düzenlenirken, kayıtlı yemekler yalnızca yeni yemek seçilirse değişir.
  const cartSig = cart.map((i) => i.id).join(',');
  const [seenSig, setSeenSig] = useState(existing ? cartSig : '');
  if (cartSig !== seenSig) {
    setSeenSig(cartSig);
    if (cart.length > 0) applyCart();
  }
  const itemsTotal = items ? Math.round(items.reduce((s, i) => s + i.carbs, 0)) : 0;

  function save() {
    const savedAt = untouched ? Date.now() : ts!;
    const entry: Omit<LogEntry, 'id'> = {
      time: savedAt,
      bgTime: values.bg !== undefined ? bgTime : undefined,
      meal: mealValue,
      ...Object.fromEntries(Object.entries(values).filter(([k, v]) => v !== undefined && (k === 'ketones' || v !== 0))),
      items: items?.length ? items : undefined,
      foods: items?.length ? items.map((i) => `${i.name} ${fmt(i.grams, 0)} g`).join(', ') : undefined,
      exercise: exercise === 'none' ? undefined : exercise,
      note: note.trim() || undefined,
    };
    if (existing) {
      // Elle düzenlemede doz bileşenleri artık geçerli olmayabilir
      const changedDose = entry.bolus !== existing.bolus || entry.carbs !== existing.carbs || entry.bg !== existing.bg;
      update(existing.id, {
        bg: undefined, carbs: undefined, bolus: undefined, basal: undefined, hypoCarbs: undefined, ketones: undefined,
        bgTime: undefined, items: undefined, foods: undefined, exercise: undefined, note: undefined,
        ...(changedDose ? { mealBolus: undefined, correctionBolus: undefined } : {}),
        ...entry,
      });
    } else {
      add(entry);
    }
    if (items && cart.length) clearCart();
    router.back();
  }

  return (
    <Screen>
      <Card>
        <View style={{ gap: 8 }}>
          <T variant="label" style={{ marginBottom: 0 }}>
            Ne zaman?
          </T>
          <View style={wrapRow}>
            {OFFSETS.map((o) => (
              <Chip key={o.label} label={o.label} active={o.minutes === 0 && untouched} onPress={() => setWhen(o.minutes === 0 ? undefined : now - o.minutes * 60000)} />
            ))}
            <Chip label="Bugün" onPress={() => { setDate(toDateInput(now)); setTime(time); }} active={date === toDateInput(now)} />
            <Chip label="Dün" onPress={() => { setDate(toDateInput(now - 86400000)); setTime(time); }} active={date === toDateInput(now - 86400000)} />
          </View>
        </View>
        <Row>
          <DateField label="Tarih" value={date} onChange={setDate} />
          <TimeField label="Saat" value={time} onChange={setTime} />
        </Row>

        <View style={{ gap: 6 }}>
          <T variant="label" style={{ marginBottom: 0 }}>
            Hangi öğün?
          </T>
          <MealChips value={mealValue} auto={meal === undefined} onChange={setMeal} />
        </View>

        <Row>
          <Field label="Şeker" suffix="mg/dL" value={bg} onChangeText={setBg} keyboard="number" />
          <TimeField label="Ölçüm saati" value={bgTimeText} onChange={setBgTimeText} />
        </Row>
        {values.bg !== undefined ? (
          <View style={wrapRow}>
            {BG_OFFSETS.map((o) => (
              <Chip
                key={o.label}
                label={o.label}
                active={o.minutes === 0 ? bgTimeText === '' : ts !== undefined && bgTimeText === toTimeInput(ts - o.minutes * 60000)}
                onPress={() => setBgTimeText(o.minutes === 0 || ts === undefined ? '' : toTimeInput(ts - o.minutes * 60000))}
              />
            ))}
          </View>
        ) : null}

        <Row>
          <Field label="Karbonhidrat" suffix="g" value={carbs} onChangeText={setCarbs} step={5} />
        </Row>
        {items?.length ? (
          <View style={{ gap: 4 }}>
            <T variant="small" style={{ fontWeight: '600' }}>
              Seçilen yemekler ({itemsTotal} g)
            </T>
            <T variant="small">{items.map((i) => `${i.name} ${fmt(i.grams, 0)} g`).join(', ')}</T>
          </View>
        ) : null}
        <Row>
          <Btn small variant="secondary" icon="list" title={items?.length ? 'Yemekleri değiştir' : 'Yemek listesinden seç'} onPress={() => router.push('/pick-foods' as Href)} style={{ flexGrow: 1 }} />
          {items?.length ? <Btn small variant="ghost" icon="close" title="Temizle" onPress={() => setItems(undefined)} /> : null}
        </Row>

        <Row>
          <Field label={`Hızlı insülin (${settings.rapidName})`} suffix="Ü" value={bolus} onChangeText={setBolus} step={0.5} />
          <Field label={`Bazal${settings.basalName ? ` (${settings.basalName})` : ''}`} suffix="Ü" value={basal} onChangeText={setBasal} step={1} />
        </Row>
        <Row>
          <Field label="Hipo için alınan KH" suffix="g" value={hypoCarbs} onChangeText={setHypoCarbs} step={5} base={10} />
          <Field label="Kan ketonu" suffix="mmol/L" value={ketones} onChangeText={setKetones} />
        </Row>
        <View style={{ gap: Space.xs }}>
          <T variant="label">Egzersiz</T>
          <Segmented<ExerciseLevel>
            options={[
              { value: 'none', label: 'Yok' },
              { value: 'light', label: 'Hafif' },
              { value: 'moderate', label: 'Orta' },
              { value: 'intense', label: 'Yoğun' },
            ]}
            value={exercise}
            onChange={setExercise}
          />
        </View>
        <Field label="Not" keyboard="text" value={note} onChangeText={setNote} placeholder="ör. hastaydım, stresliydim, adet dönemi" />
        {values.ketones !== undefined && values.ketones >= 1.5 ? (
          <Notice level="danger" text="Kan ketonu 1,5 mmol/L ve üzeri: doktorunu ara veya acile başvur. 3,0 üzeri acil durumdur." />
        ) : values.ketones !== undefined && values.ketones >= 0.6 ? (
          <Notice level="warn" text="Keton hafif yüksek (0,6–1,5). Bol su iç, düzeltme dozunu yap, 2 saat sonra şeker ve keton tekrar ölç." />
        ) : null}
        {errors.map((e) => (
          <Notice key={e} level="danger" text={e} />
        ))}
        <Btn title="Kaydet" icon="checkmark" disabled={errors.length > 0 || empty} onPress={save} />
        {existing ? (
          <Btn
            variant="ghost"
            icon="trash-outline"
            title="Kaydı sil"
            onPress={() =>
              confirm('Kaydı sil', 'Bu kayıt silinsin mi?', () => {
                remove(existing.id);
                router.back();
              }, 'Sil')
            }
          />
        ) : null}
      </Card>
    </Screen>
  );
}
