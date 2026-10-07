import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useGlobalSearchParams, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Collapsible } from '@/components/guide';
import { Chip, MealChips, wrapRow } from '@/components/when';
import { Btn, Card, DateField, Field, Notice, Row, Screen, Segmented, T, TimeField, Toggle, confirm, parseNum } from '@/components/ui';
import { Radius, Space, useTheme } from '@/constants/theme';
import { carbsFor, FOODS } from '@/data/foods-tr';
import { currentTime, useNow } from '@/lib/hooks';
import { parseDateInput, parseTimeInput, toDateInput, toTimeInput } from '@/lib/input';
import { cancelNotification, schedulePostMealReminder } from '@/lib/notifications';
import { BG_MAX, BG_MIN, fmt } from '@/logic/bolus';
import { mealAt, mealLabel } from '@/logic/meals';
import { mealBefore } from '@/logic/postmeal';
import type { ExerciseLevel, LogEntry, LogItem, MealType } from '@/logic/types';
import { cartMeatRule, cartTotal, useFoods } from '@/store/foods';
import { useLog } from '@/store/log';
import { useSettings } from '@/store/settings';
import { uid } from '@/store/storage';
import { toast } from '@/store/toast';

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
  const c = useTheme();
  const localParams = useLocalSearchParams<{ id?: string; basal?: string; after?: string; mode?: string }>();
  const globalParams = useGlobalSearchParams<{ id?: string; basal?: string; after?: string; mode?: string }>();
  const params = { ...globalParams, ...localParams };
  const webMode = typeof window !== 'undefined' && window.location?.search
    ? new URLSearchParams(window.location.search).get('mode') ?? undefined
    : undefined;
  const modeVal = (Array.isArray(params.mode) ? params.mode[0] : params.mode) || webMode;
  const isBgMode = modeVal === 'bg' && !params.id && !params.basal;

  const entries = useLog((s) => s.entries);
  const existing = entries.find((e) => e.id === params.id);
  const afterSrc = entries.find((e) => e.id === params.after);
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
  const [meal, setMeal] = useState<MealType | undefined>(existing?.meal ?? afterSrc?.meal);
  // Tokluk (yemekten sonra) ölçümü mü? Yemek kaydının "Tokluk ekle" düğmesinden açılınca otomatik işaretli
  const [post, setPost] = useState(existing?.post ?? !!afterSrc);
  const [bg, setBg] = useState(str(existing?.bg));
  // Boş = yemek/kayıt zamanıyla aynı anda ölçüldü
  const [bgTimeText, setBgTimeText] = useState(existing?.bgTime ? toTimeInput(existing.bgTime) : '');
  const [carbs, setCarbs] = useState(str(existing?.carbs));
  const [items, setItems] = useState<LogItem[] | undefined>(existing?.items);
  const [bolus, setBolus] = useState(str(existing?.bolus));
  const [basal, setBasal] = useState(str(existing?.basal ?? (params.basal && settings.basalDose ? settings.basalDose : undefined)));
  const [exercise, setExercise] = useState<ExerciseLevel>(existing?.exercise ?? 'none');
  const [note, setNote] = useState(existing?.note ?? '');

  // "Şimdi" seçiliyken saat, kaydetme anındaki gerçek zaman olur
  const untouched = dateText === undefined && timeText === undefined && !existing;
  const ts = untouched ? now : parseDateTime(date, time);
  const autoMeal = ts !== undefined ? mealAt(ts, settings.mealStarts) : 'sabah';
  const mealValue = meal ?? autoMeal;

  // Bazal saat penceresi: 20:30 (1230 dk) ile 02:00 (120 dk) arası veya doğrudan parametre ile açılmışsa
  const entryDate = new Date(ts ?? now);
  const entryMinutes = entryDate.getHours() * 60 + entryDate.getMinutes();
  const isBasalWindow = entryMinutes >= 20 * 60 + 30 || entryMinutes < 2 * 60;
  const showBasal = params.basal === '1' || isBasalWindow;

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
  };
  const errors: string[] = [];
  if (ts === undefined) errors.push('Tarih ve saati tam yaz.');
  else if (ts > now + 5 * 60000) errors.push('Gelecekteki bir zaman girilemez.');
  if (bgTimeText && parseTimeInput(bgTimeText) === undefined) errors.push('Ölçüm saatini tam yaz (ör. 07:25).');
  if (values.bg !== undefined && !(values.bg >= BG_MIN && values.bg <= BG_MAX)) errors.push(`Şeker ${BG_MIN}–${BG_MAX} arasında olmalı.`);
  if (values.carbs !== undefined && !(values.carbs >= 0 && values.carbs <= 400)) errors.push('Karbonhidrat geçersiz.');
  if (values.bolus !== undefined && !(values.bolus >= 0 && values.bolus <= 100)) errors.push('Hızlı insülin geçersiz.');
  if (values.basal !== undefined && !(values.basal >= 0 && values.basal <= 200)) errors.push('Bazal geçersiz.');

  const empty = isBgMode
    ? values.bg === undefined
    : Object.values(values).every((v) => v === undefined) && !note.trim() && exercise === 'none';

  const cartCarbs = cartTotal(cart);
  const applyCart = () => {
    const rule = cartMeatRule(cart);
    setItems([
      ...cart.map((i) => ({ foodId: i.foodId, name: i.name, grams: i.grams, carbs: i.carbs, fatty: i.fatty })),
      ...(rule > 0 ? [{ foodId: 'rule-meat', name: 'Et kuralı (100 g üzeri et)', grams: 0, carbs: rule }] : []),
    ]);
    setCarbs(String(cartCarbs));
  };
  // Tabaktaki yemekler değişince (veya ekran tabakla açılınca) kayda aktarılır
  const cartSig = cart.map((i) => i.id).join(',');
  const [seenSig, setSeenSig] = useState(existing ? cartSig : '');
  if (cartSig !== seenSig) {
    setSeenSig(cartSig);
    if (cart.length > 0) applyCart();
  }
  const itemsTotal = items ? Math.round(items.reduce((s, i) => s + i.carbs, 0)) : 0;

  function updateItemGrams(foodId: string, deltaOrGrams: number, isDelta = false) {
    if (!items) return;
    const allFoods = [...useFoods.getState().customFoods, ...FOODS];
    const method = settings.countMethod;
    const updated = items
      .map((it) => {
        if (it.foodId !== foodId) return it;
        const newGrams = isDelta ? Math.max(0, it.grams + deltaOrGrams) : Math.max(0, deltaOrGrams);
        if (newGrams === 0) return null;
        const f = allFoods.find((food) => food.id === it.foodId);
        const c = f ? carbsFor(f, newGrams, method) : Math.round((it.carbs / Math.max(it.grams, 1)) * newGrams);
        return { ...it, grams: newGrams, carbs: c };
      })
      .filter((it): it is LogItem => it !== null);

    setItems(updated.length ? updated : undefined);
    const totalC = updated.length ? Math.round(updated.reduce((s, it) => s + it.carbs, 0)) : 0;
    setCarbs(totalC > 0 ? String(totalC) : '');
  }

  function removeItem(foodId: string) {
    if (!items) return;
    const updated = items.filter((it) => it.foodId !== foodId);
    setItems(updated.length ? updated : undefined);
    const totalC = updated.length ? Math.round(updated.reduce((s, it) => s + it.carbs, 0)) : 0;
    setCarbs(totalC > 0 ? String(totalC) : '');
  }

  function openFoodPicker() {
    if (items?.length) {
      useFoods.getState().setCart(
        items.filter((i) => i.foodId !== 'rule-meat').map((i) => ({
          id: uid(),
          foodId: i.foodId,
          name: i.name,
          grams: i.grams,
          carbs: i.carbs,
          fatty: i.fatty,
        }))
      );
    }
    router.push('/pick-foods' as Href);
  }

  function save() {
    const savedAt = untouched ? currentTime() : ts!;
    const entry: Omit<LogEntry, 'id'> = {
      time: savedAt,
      bgTime: values.bg !== undefined ? bgTime : undefined,
      meal: mealValue,
      ...Object.fromEntries(Object.entries(values).filter(([_, v]) => v !== undefined && v !== 0)),
      items: items?.length ? items : undefined,
      foods: items?.length ? items.map((i) => `${i.name} ${fmt(i.grams, 0)} g`).join(', ') : undefined,
      exercise: exercise === 'none' ? undefined : exercise,
      note: note.trim() || undefined,
    };
    // Tokluk ölçümü kendi başına girildiyse hangi yemeğe ait olduğunu bul
    const owner = post ? (afterSrc ?? mealBefore(entries, bgTime ?? savedAt, existing?.id)) : undefined;
    const postFields = post ? { post: true, afterId: owner?.id } : { post: undefined, afterId: undefined };

    let savedId: string | undefined;
    if (existing) {
      // Elle düzenlemede doz bileşenleri artık geçerli olmayabilir
      const changedDose = entry.bolus !== existing.bolus || entry.carbs !== existing.carbs || entry.bg !== existing.bg;
      update(existing.id, {
        bg: undefined, carbs: undefined, bolus: undefined, basal: undefined, hypoCarbs: existing.hypoCarbs, ketones: undefined,
        bgTime: undefined, items: undefined, foods: undefined, exercise: undefined, note: undefined,
        ...(changedDose ? { mealBolus: undefined, correctionBolus: undefined } : {}),
        ...entry,
        ...postFields,
      });
      savedId = existing.id;
    } else {
      const created = add({ ...entry, ...(post ? postFields : {}) });
      savedId = created.id;
    }

    if (post) {
      cancelNotification('tokluk-hatirlatici').catch(() => {});
    } else if (values.carbs !== undefined || (items && items.length > 0)) {
      schedulePostMealReminder(120, mealLabel(mealValue)).catch(() => {});
    }

    if (items && cart.length) clearCart();
    router.back();

    if (!existing && savedId) {
      const idToUndo = savedId;
      toast(values.bg !== undefined && isBgMode ? `Şeker ${values.bg} mg/dL kaydedildi` : 'Kayıt kaydedildi', {
        label: 'Geri al',
        onPress: () => remove(idToUndo),
      });
    }
  }

  if (isBgMode) {
    return (
      <Screen>
        <Card title="Şeker Ölçümü" icon="water">
          <View style={{ gap: 8 }}>
            <T variant="label" style={{ marginBottom: 0 }}>
              Ne zaman?
            </T>
            <View style={wrapRow}>
              {OFFSETS.map((o) => (
                <Chip
                  key={o.label}
                  label={o.label}
                  active={o.minutes === 0 && untouched}
                  onPress={() => setWhen(o.minutes === 0 ? undefined : now - o.minutes * 60000)}
                />
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

          <View style={{ gap: 6 }}>
            <T variant="label" style={{ marginBottom: 0 }}>
              Ölçüm durumu
            </T>
            <Segmented
              options={[
                { value: 'pre', label: 'Açlık / Yemek öncesi' },
                { value: 'post', label: 'Tokluk (yemek sonrası)' },
              ]}
              value={post ? 'post' : 'pre'}
              onChange={(v) => setPost(v === 'post')}
            />
          </View>

          <Row>
            <Field label="Şeker" suffix="mg/dL" value={bg} onChangeText={setBg} big keyboard="number" placeholder="—" />
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

          <Field label="Not (isteğe bağlı)" keyboard="text" value={note} onChangeText={setNote} placeholder="ör. egzersiz öncesi, baş ağrısı" />
        </Card>

        <Collapsible title="Yemek veya insülin bilgisi ekle" icon="options-outline">
          <Row>
            <Field label="Karbonhidrat" suffix="g" value={carbs} onChangeText={setCarbs} step={5} />
          </Row>
          <Row>
            <Field label={settings.rapidName ? `Hızlı insülin (${settings.rapidName})` : 'Hızlı insülin'} suffix="Ü" value={bolus} onChangeText={setBolus} step={0.5} />
            {showBasal ? (
              <Field label={`Bazal${settings.basalName ? ` (${settings.basalName})` : ''}`} suffix="Ü" value={basal} onChangeText={setBasal} step={1} />
            ) : null}
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
        </Collapsible>

        {errors.map((e) => (
          <Notice key={e} level="danger" text={e} />
        ))}
        <Btn title="Şekeri Kaydet" icon="checkmark" disabled={errors.length > 0 || empty} onPress={save} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Card title={existing ? 'Kaydı Düzenle' : 'Yeni Kayıt'} icon="create-outline">
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
        <Toggle label="Tokluk şekeri (yemekten sonra ölçüldü)" value={post} onChange={setPost} />
        {post && afterSrc ? (
          <Notice level="info" text={`${mealLabel(afterSrc.meal ?? mealAt(afterSrc.time, settings.mealStarts))} yemeğinin tokluk şekeri olarak kaydedilecek.`} />
        ) : null}
      </Card>

      <Card title="Şeker Ölçümü" icon="water-outline">
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
      </Card>

      <Card title="Yemek ve İnsülin" icon="restaurant-outline">
        <Row>
          <Field label="Karbonhidrat" suffix="g" value={carbs} onChangeText={setCarbs} step={5} />
        </Row>
        {items?.length ? (
          <View style={{ gap: 8 }}>
            <T variant="small" style={{ fontWeight: '600' }}>
              Seçilen yemekler ({itemsTotal} g KH)
            </T>
            {items.map((i) => (
              <View
                key={i.foodId}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: Radius.md,
                  backgroundColor: c.cardAlt,
                  gap: 8,
                }}>
                <View style={{ flex: 1 }}>
                  <T style={{ fontWeight: '600' }}>{i.name}</T>
                  <T variant="small" color="muted">
                    {fmt(i.carbs)} g KH
                  </T>
                </View>
                {i.foodId !== 'rule-meat' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Pressable
                      onPress={() => updateItemGrams(i.foodId, -10, true)}
                      hitSlop={6}
                      accessibilityLabel={`${i.name} 10 gram azalt`}
                      style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="remove" size={14} color={c.text} />
                    </Pressable>
                    <T style={{ minWidth: 42, textAlign: 'center', fontWeight: '700' }}>{fmt(i.grams, 0)} g</T>
                    <Pressable
                      onPress={() => updateItemGrams(i.foodId, 10, true)}
                      hitSlop={6}
                      accessibilityLabel={`${i.name} 10 gram artır`}
                      style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="add" size={14} color={c.text} />
                    </Pressable>
                  </View>
                ) : null}
                <Pressable onPress={() => removeItem(i.foodId)} hitSlop={8} accessibilityLabel={`${i.name} sil`}>
                  <Ionicons name="close-circle" size={20} color={c.muted} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        <Row>
          <Btn small variant="secondary" icon="list" title={items?.length ? 'Yemek ekle / değiştir' : 'Yemek listesinden seç'} onPress={openFoodPicker} style={{ flexGrow: 1 }} />
          {items?.length ? <Btn small variant="ghost" icon="close" title="Temizle" onPress={() => { setItems(undefined); setCarbs(''); }} /> : null}
        </Row>

        <Row>
          <Field label={settings.rapidName ? `Hızlı insülin (${settings.rapidName})` : 'Hızlı insülin'} suffix="Ü" value={bolus} onChangeText={setBolus} step={0.5} />
          {showBasal ? (
            <Field label={`Bazal${settings.basalName ? ` (${settings.basalName})` : ''}`} suffix="Ü" value={basal} onChangeText={setBasal} step={1} />
          ) : null}
        </Row>
      </Card>

      <Card title="Ek Detaylar" icon="document-text-outline">
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
      </Card>

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
              entries.filter((x) => x.afterId === existing.id).forEach((x) => remove(x.id));
              remove(existing.id);
              router.back();
            }, 'Sil')
          }
        />
      ) : null}
    </Screen>
  );
}
