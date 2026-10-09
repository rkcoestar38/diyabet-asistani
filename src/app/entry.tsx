import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useGlobalSearchParams, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Collapsible } from '@/components/guide';
import {
  Btn,
  Card,
  DateField,
  Field,
  Notice,
  Pressy,
  Row,
  Screen,
  Segmented,
  T,
  TimeField,
  Toggle,
  confirm,
  parseNum,
  tap,
} from '@/components/ui';
import { Font, Radius, Space, useTheme } from '@/constants/theme';
import { carbsFor, FOODS } from '@/data/foods-tr';
import { currentTime, useNow } from '@/lib/hooks';
import { parseDateInput, parseTimeInput, toDateInput, toTimeInput } from '@/lib/input';
import { cancelNotification, schedulePostMealReminder } from '@/lib/notifications';
import { syncToklukWidget } from '@/lib/widget-sync';
import { BG_MAX, BG_MIN, fmt } from '@/logic/bolus';
import { MEALS, mealAt, mealLabel } from '@/logic/meals';
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

function getBgFeedback(bg: number | undefined, isPost: boolean) {
  if (bg === undefined) return null;
  if (bg < 70) {
    return {
      kind: 'hypo' as const,
      label: '🚨 Düşük Şeker (Hipo)',
      detail: 'Acil 15g hızlı karbonhidrat tüket (meyve suyu, kesme şeker).',
      badgeBg: '#FDF0EE',
      textColor: '#C23A2E',
      borderColor: '#F8B4AF',
    };
  }
  if (bg < 80) {
    return {
      kind: 'low-edge' as const,
      label: '⚠️ Sınırda Düşük (70–79 mg/dL)',
      detail: 'Hedefin hafif altında; düşüş eğilimine dikkat et.',
      badgeBg: '#FEF7EA',
      textColor: '#8A5300',
      borderColor: '#FCDFA6',
    };
  }
  if (isPost) {
    if (bg <= 180) {
      return {
        kind: 'target' as const,
        label: '✓ Hedefte (Tokluk 80–180 mg/dL)',
        detail: 'Yemek sonrası 2. saat glikoz seviyen optimal aralıkta.',
        badgeBg: '#EAF5EE',
        textColor: '#1F7A4D',
        borderColor: '#B0E2C6',
      };
    }
    if (bg <= 220) {
      return {
        kind: 'high-mild' as const,
        label: '▲ Hafif Yüksek (Tokluk > 180)',
        detail: 'Hedefin biraz üzerinde; aktif insülini göz önünde bulundur.',
        badgeBg: '#FEF7EA',
        textColor: '#8A5300',
        borderColor: '#FCDFA6',
      };
    }
    return {
      kind: 'high' as const,
      label: '▲ Yüksek Şeker (> 220)',
      detail: 'Hedefin belirgin üzerinde. Bol su iç ve düzeltme dozu değerlendir.',
      badgeBg: '#FDF0EE',
      textColor: '#C23A2E',
      borderColor: '#F8B4AF',
    };
  } else {
    if (bg <= 120) {
      return {
        kind: 'target' as const,
        label: '✓ Hedefte (Açlık 80–120 mg/dL)',
        detail: 'Açlık şekerin harika, tam hedeflenen aralıkta.',
        badgeBg: '#EAF5EE',
        textColor: '#1F7A4D',
        borderColor: '#B0E2C6',
      };
    }
    if (bg <= 150) {
      return {
        kind: 'high-mild' as const,
        label: '▲ Hafif Yüksek (Açlık > 120)',
        detail: 'Açlık hedefini biraz aşıyor.',
        badgeBg: '#FEF7EA',
        textColor: '#8A5300',
        borderColor: '#FCDFA6',
      };
    }
    return {
      kind: 'high' as const,
      label: '▲ Yüksek Şeker (> 150)',
      detail: 'Açlık hedefin üzerinde. Öğün bolusunda düzeltme gerekebilir.',
      badgeBg: '#FDF0EE',
      textColor: '#C23A2E',
      borderColor: '#F8B4AF',
    };
  }
}

export default function Entry() {
  const c = useTheme();
  const localParams = useLocalSearchParams<{ id?: string; basal?: string; after?: string; mode?: string }>();
  const globalParams = useGlobalSearchParams<{ id?: string; basal?: string; after?: string; mode?: string }>();
  const params = { ...globalParams, ...localParams };
  const webMode =
    typeof window !== 'undefined' && window.location?.search
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
  const [dateText, setDateText] = useState<string | undefined>(existing ? toDateInput(existing.time) : undefined);
  const [timeText, setTimeText] = useState<string | undefined>(existing ? toTimeInput(existing.time) : undefined);
  const [showCustomTime, setShowCustomTime] = useState(Boolean(existing));

  const date = dateText ?? toDateInput(now);
  const time = timeText ?? toTimeInput(now);
  const setDate = setDateText;
  const setTime = setTimeText;
  const setWhen = (t: number | undefined) => {
    setDateText(t === undefined ? undefined : toDateInput(t));
    setTimeText(t === undefined ? undefined : toTimeInput(t));
  };
  const [meal, setMeal] = useState<MealType | undefined>(existing?.meal ?? afterSrc?.meal);
  const [post, setPost] = useState(existing?.post ?? !!afterSrc);
  const [bg, setBg] = useState(str(existing?.bg));
  const [bgTimeText, setBgTimeText] = useState(existing?.bgTime ? toTimeInput(existing.bgTime) : '');
  const [carbs, setCarbs] = useState(str(existing?.carbs));
  const [items, setItems] = useState<LogItem[] | undefined>(existing?.items);
  const [bolus, setBolus] = useState(str(existing?.bolus));
  const [basal, setBasal] = useState(
    str(existing?.basal ?? (params.basal && settings.basalDose ? settings.basalDose : undefined))
  );
  const [exercise, setExercise] = useState<ExerciseLevel>(existing?.exercise ?? 'none');
  const [note, setNote] = useState(existing?.note ?? '');

  const untouched = dateText === undefined && timeText === undefined && !existing;
  const ts = untouched ? now : parseDateTime(date, time);
  const autoMeal = ts !== undefined ? mealAt(ts, settings.mealStarts) : 'sabah';
  const mealValue = meal ?? autoMeal;

  const entryDate = new Date(ts ?? now);
  const entryMinutes = entryDate.getHours() * 60 + entryDate.getMinutes();
  const isBasalWindow = entryMinutes >= 20 * 60 + 30 || entryMinutes < 2 * 60;
  const showBasal = params.basal === '1' || isBasalWindow;

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
  if (values.bg !== undefined && !(values.bg >= BG_MIN && values.bg <= BG_MAX))
    errors.push(`Şeker ${BG_MIN}–${BG_MAX} arasında olmalı.`);
  if (values.carbs !== undefined && !(values.carbs >= 0 && values.carbs <= 400))
    errors.push('Karbonhidrat geçersiz.');
  if (values.bolus !== undefined && !(values.bolus >= 0 && values.bolus <= 100))
    errors.push('Hızlı insülin geçersiz.');
  if (values.basal !== undefined && !(values.basal >= 0 && values.basal <= 200)) errors.push('Bazal geçersiz.');

  const empty = isBgMode
    ? values.bg === undefined
    : Object.values(values).every((v) => v === undefined) && !note.trim() && exercise === 'none';

  const cartCarbs = cartTotal(cart);
  const applyCart = () => {
    const rule = cartMeatRule(cart);
    setItems([
      ...cart.map((i) => ({ id: uid(), foodId: i.foodId, name: i.name, grams: i.grams, carbs: i.carbs, fatty: i.fatty })),
      ...(rule > 0 ? [{ id: uid(), foodId: 'rule-meat', name: 'Et kuralı (100 g üzeri et)', grams: 0, carbs: rule }] : []),
    ]);
    setCarbs(String(cartCarbs));
  };

  const cartSig = cart.map((i) => i.id).join(',');
  const [seenSig, setSeenSig] = useState(existing ? cartSig : '');
  if (cartSig !== seenSig) {
    setSeenSig(cartSig);
    if (cart.length > 0) applyCart();
  }
  const itemsTotal = items ? Math.round(items.reduce((s, i) => s + i.carbs, 0)) : 0;

  // Satır kimliği: yeni kayıtlarda satıra özgü id; eski kayıtlarda foodId'ye geri düş (aynı yemek iki satırsa eski davranış)
  const idOf = (it: LogItem) => it.id ?? it.foodId;
  function updateItemGrams(rowId: string, deltaOrGrams: number, isDelta = false) {
    if (!items) return;
    const allFoods = [...useFoods.getState().customFoods, ...FOODS];
    const method = settings.countMethod;
    const updated = items
      .map((it) => {
        if (idOf(it) !== rowId) return it;
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

  function removeItem(rowId: string) {
    if (!items) return;
    const updated = items.filter((it) => idOf(it) !== rowId);
    setItems(updated.length ? updated : undefined);
    const totalC = updated.length ? Math.round(updated.reduce((s, it) => s + it.carbs, 0)) : 0;
    setCarbs(totalC > 0 ? String(totalC) : '');
  }

  function openFoodPicker() {
    if (items?.length) {
      useFoods.getState().setCart(
        items
          .filter((i) => i.foodId !== 'rule-meat')
          .map((i) => ({
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

  function adjustBg(delta: number) {
    tap('light');
    const cur = values.bg ?? (post ? 130 : 100);
    const next = Math.max(BG_MIN, Math.min(BG_MAX, cur + delta));
    setBg(String(next));
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
    const owner = post ? (afterSrc ?? mealBefore(entries, bgTime ?? savedAt, existing?.id)) : undefined;
    const postFields = post ? { post: true, afterId: owner?.id } : { post: undefined, afterId: undefined };

    let savedId: string | undefined;
    if (existing) {
      const changedDose = entry.bolus !== existing.bolus || entry.carbs !== existing.carbs || entry.bg !== existing.bg;
      update(existing.id, {
        bg: undefined,
        carbs: undefined,
        bolus: undefined,
        basal: undefined,
        hypoCarbs: existing.hypoCarbs,
        ketones: undefined,
        bgTime: undefined,
        items: undefined,
        foods: undefined,
        exercise: undefined,
        note: undefined,
        ...(changedDose ? { mealBolus: undefined, correctionBolus: undefined } : {}),
        ...entry,
        ...postFields,
      });
      savedId = existing.id;
    } else {
      const created = add({ ...entry, ...(post ? postFields : {}) });
      savedId = created.id;
    }
    // Ana ekran widget'ı da bu kayda göre güncellensin
    syncToklukWidget();

    if (post) {
      cancelNotification('tokluk-hatirlatici').catch(() => {});
    } else if (values.carbs !== undefined || (items && items.length > 0)) {
      // Hatırlatıcı öğün saatinden itibaren sayılır; süre geçtiyse kurulmaz
      schedulePostMealReminder(120, mealLabel(mealValue), savedAt).catch(() => {});
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

  const feedback = getBgFeedback(values.bg, post);

  // ==========================================
  // COMPACT & REVOLUTIONIZED ŞEKER ÖLÇÜMÜ MODU
  // ==========================================
  if (isBgMode) {
    return (
      <Screen>
        {/* 1. HERO ŞEKER GÖSTERGESİ VE DİNAMİK ROZET */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: c.card,
              borderColor: feedback ? feedback.borderColor : c.border,
            },
          ]}>
          {/* Durum Hapı: Açlık vs Tokluk (Kompakt ve asla taşmaz) */}
          <View style={styles.pillRow}>
            <Pressy
              onPress={() => {
                tap('light');
                setPost(false);
              }}
              style={[
                styles.modePill,
                !post
                  ? { backgroundColor: c.primarySoft, borderColor: c.primary }
                  : { backgroundColor: c.cardAlt, borderColor: c.border },
              ]}>
              <Ionicons name="sunny-outline" size={16} color={!post ? c.primary : c.muted} />
              <T style={{ fontWeight: !post ? '700' : '600', fontSize: 14, color: !post ? c.primary : c.text }}>
                Açlık
              </T>
            </Pressy>

            <Pressy
              onPress={() => {
                tap('light');
                setPost(true);
              }}
              style={[
                styles.modePill,
                post
                  ? { backgroundColor: c.primarySoft, borderColor: c.primary }
                  : { backgroundColor: c.cardAlt, borderColor: c.border },
              ]}>
              <Ionicons name="restaurant-outline" size={16} color={post ? c.primary : c.muted} />
              <T style={{ fontWeight: post ? '700' : '600', fontSize: 14, color: post ? c.primary : c.text }}>
                Tokluk (2. saat)
              </T>
            </Pressy>
          </View>

          {/* Sayı Giriş Alanı */}
          <View style={styles.numberInputContainer}>
            <TextInput
              value={bg}
              onChangeText={setBg}
              placeholder="—"
              placeholderTextColor={c.muted}
              keyboardType="number-pad"
              autoFocus
              selectTextOnFocus
              maxLength={4}
              style={[
                styles.heroNumberInput,
                {
                  color: feedback ? feedback.textColor : c.text,
                  fontFamily: Font.bold,
                },
              ]}
            />
            <T variant="lead" style={{ color: c.muted, marginLeft: 6, fontWeight: '700' }}>
              mg/dL
            </T>
          </View>

          {/* Hızlı Değer Düzeltici Tuşlar (-10, -1, +1, +10) */}
          <View style={styles.stepperRow}>
            {[-10, -1, +1, +10].map((delta) => (
              <Pressy
                key={delta}
                onPress={() => adjustBg(delta)}
                style={[styles.stepBtn, { backgroundColor: c.cardAlt, borderColor: c.border }]}>
                <T variant="small" style={{ fontWeight: '700', color: c.text }}>
                  {delta > 0 ? `+${delta}` : delta}
                </T>
              </Pressy>
            ))}
          </View>

          {/* Dinamik Klinik Geri Bildirim Rozeti */}
          {feedback ? (
            <View
              style={[
                styles.feedbackBadge,
                {
                  backgroundColor: feedback.badgeBg,
                  borderColor: feedback.borderColor,
                },
              ]}>
              <T style={{ fontWeight: '700', color: feedback.textColor, fontSize: 13 }}>
                {feedback.label}
              </T>
              <T variant="small" style={{ color: feedback.textColor, opacity: 0.9, marginTop: 2 }}>
                {feedback.detail}
              </T>
            </View>
          ) : (
            <View style={[styles.feedbackBadge, { backgroundColor: c.cardAlt, borderColor: c.border }]}>
              <T variant="small" color="muted">
                {post ? 'Öğünden 2 saat sonra ölçülen şeker' : 'Yemek öncesi veya sabah açlık şekeri'}
              </T>
            </View>
          )}

          {/* Hipo Uyarısı ve Hızlı Çözüm Butonu */}
          {feedback?.kind === 'hypo' ? (
            <Pressy
              onPress={() => router.push('/hypo' as Href)}
              style={[styles.hypoQuickBtn, { backgroundColor: c.danger }]}>
              <Ionicons name="medical" size={16} color="#FFFFFF" />
              <T style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                15 Kuralı / Düşük Şeker Rehberini Aç
              </T>
            </Pressy>
          ) : null}
        </View>

        {/* 2. ZAMAN & ÖĞÜN SEÇİMİ (Yalnızca Şimdi ve Tarih / Saat) */}
        <Card title="Öğün ve Zaman" icon="time-outline">
          {/* Öğün Hapları */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {MEALS.map((m) => {
              const active = m.id === mealValue;
              return (
                <Pressy
                  key={m.id}
                  onPress={() => {
                    tap('light');
                    setMeal(m.id);
                  }}
                  style={[
                    styles.mealPill,
                    {
                      borderColor: active ? c.primary : c.border,
                      backgroundColor: active ? c.primarySoft : c.cardAlt,
                    },
                  ]}>
                  <T
                    variant="small"
                    style={{
                      fontWeight: active ? '700' : '500',
                      color: active ? c.primary : c.text,
                    }}>
                    {m.label}
                  </T>
                </Pressy>
              );
            })}
          </View>

          {/* Sadece Şimdi ve Tarih / Saat Seçeneği */}
          <View style={{ marginTop: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressy
                onPress={() => {
                  tap('light');
                  setShowCustomTime(false);
                  setWhen(undefined);
                }}
                style={[
                  styles.timePill,
                  {
                    flex: 1,
                    justifyContent: 'center',
                    borderColor: untouched && !showCustomTime ? c.primary : c.border,
                    backgroundColor: untouched && !showCustomTime ? c.primarySoft : c.cardAlt,
                  },
                ]}>
                <Ionicons name="flash-outline" size={15} color={untouched && !showCustomTime ? c.primary : c.muted} />
                <T
                  variant="small"
                  style={{
                    fontWeight: untouched && !showCustomTime ? '700' : '500',
                    color: untouched && !showCustomTime ? c.primary : c.muted,
                  }}>
                  Şimdi ({time})
                </T>
              </Pressy>

              <Pressy
                onPress={() => {
                  tap('light');
                  setShowCustomTime(!showCustomTime);
                }}
                style={[
                  styles.timePill,
                  {
                    flex: 1,
                    justifyContent: 'center',
                    borderColor: showCustomTime ? c.primary : c.border,
                    backgroundColor: showCustomTime ? c.primarySoft : c.cardAlt,
                  },
                ]}>
                <Ionicons
                  name={showCustomTime ? 'chevron-up' : 'calendar-outline'}
                  size={15}
                  color={showCustomTime ? c.primary : c.muted}
                />
                <T
                  variant="small"
                  style={{
                    fontWeight: showCustomTime ? '700' : '500',
                    color: showCustomTime ? c.primary : c.muted,
                  }}>
                  Tarih / Saat
                </T>
              </Pressy>
            </View>

            {/* Genişletilmiş Tarih & Saat Alanı (Yalnızca tıklandığında açılır) */}
            {showCustomTime ? (
              <Row style={{ marginTop: 10 }}>
                <DateField label="Tarih" value={date} onChange={setDate} />
                <TimeField label="Saat" value={time} onChange={setTime} />
              </Row>
            ) : null}
          </View>
        </Card>

        {/* 3. SADE NOT GİRİŞİ */}
        <Card title="Not (İsteğe Bağlı)" icon="document-text-outline">
          <Field
            label="Kısa Not"
            keyboard="text"
            value={note}
            onChangeText={setNote}
            placeholder="Örn: 30 dk yürüyüş sonrası, baş ağrısı vardı"
          />
        </Card>

        {/* 4. İSTEĞE BAĞLI YEMEK VEYA İNSÜLİN BİLGİSİ */}
        <Collapsible title="Yemek veya insülin dozu da ekle" icon="options-outline">
          <Row>
            <Field label="Karbonhidrat" suffix="g" value={carbs} onChangeText={setCarbs} step={5} />
          </Row>
          <Row>
            <Field
              label={settings.rapidName ? `Hızlı insülin (${settings.rapidName})` : 'Hızlı insülin'}
              suffix="Ü"
              value={bolus}
              onChangeText={setBolus}
              step={0.5}
            />
            {showBasal ? (
              <Field
                label={`Bazal${settings.basalName ? ` (${settings.basalName})` : ''}`}
                suffix="Ü"
                value={basal}
                onChangeText={setBasal}
                step={1}
              />
            ) : null}
          </Row>
        </Collapsible>

        {errors.map((e) => (
          <Notice key={e} level="danger" text={e} />
        ))}

        {/* 5. GÖZ ALICI BÜYÜK KAYDET EYLEMİ */}
        <Btn
          title={values.bg !== undefined ? `✓ ${values.bg} mg/dL Kaydet` : 'Şeker Değerini Kaydet'}
          icon="checkmark-circle"
          disabled={errors.length > 0 || empty}
          onPress={save}
        />
      </Screen>
    );
  }

  // ==========================================
  // STANDART KAYIT / DÜZENLEME EKRANI
  // ==========================================
  return (
    <Screen>
      <Card title={existing ? 'Kaydı Düzenle' : 'Yeni Diyabet Kaydı'} icon="create-outline">
        <View style={{ gap: 8 }}>
          <T variant="label" style={{ marginBottom: 0 }}>
            Ne zaman?
          </T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressy
              onPress={() => {
                tap('light');
                setShowCustomTime(false);
                setWhen(undefined);
              }}
              style={[
                styles.timePill,
                {
                  flex: 1,
                  justifyContent: 'center',
                  borderColor: untouched && !showCustomTime ? c.primary : c.border,
                  backgroundColor: untouched && !showCustomTime ? c.primarySoft : c.cardAlt,
                },
              ]}>
              <Ionicons name="flash-outline" size={15} color={untouched && !showCustomTime ? c.primary : c.muted} />
              <T
                variant="small"
                style={{
                  fontWeight: untouched && !showCustomTime ? '700' : '500',
                  color: untouched && !showCustomTime ? c.primary : c.muted,
                }}>
                Şimdi ({time})
              </T>
            </Pressy>

            <Pressy
              onPress={() => {
                tap('light');
                setShowCustomTime(true);
              }}
              style={[
                styles.timePill,
                {
                  flex: 1,
                  justifyContent: 'center',
                  borderColor: showCustomTime ? c.primary : c.border,
                  backgroundColor: showCustomTime ? c.primarySoft : c.cardAlt,
                },
              ]}>
              <Ionicons name="calendar-outline" size={15} color={showCustomTime ? c.primary : c.muted} />
              <T
                variant="small"
                style={{
                  fontWeight: showCustomTime ? '700' : '500',
                  color: showCustomTime ? c.primary : c.muted,
                }}>
                Tarih / Saat
              </T>
            </Pressy>
          </View>
        </View>

        {showCustomTime ? (
          <Row>
            <DateField label="Tarih" value={date} onChange={setDate} />
            <TimeField label="Saat" value={time} onChange={setTime} />
          </Row>
        ) : null}

        <View style={{ gap: 6 }}>
          <T variant="label" style={{ marginBottom: 0 }}>
            Hangi öğün?
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {MEALS.map((m) => {
              const active = m.id === mealValue;
              return (
                <Pressy
                  key={m.id}
                  onPress={() => {
                    tap('light');
                    setMeal(m.id);
                  }}
                  style={[
                    styles.mealPill,
                    {
                      borderColor: active ? c.primary : c.border,
                      backgroundColor: active ? c.primarySoft : c.cardAlt,
                    },
                  ]}>
                  <T
                    variant="small"
                    style={{
                      fontWeight: active ? '700' : '500',
                      color: active ? c.primary : c.text,
                    }}>
                    {m.label}
                  </T>
                </Pressy>
              );
            })}
          </View>
        </View>

        <Toggle label="Tokluk şekeri (yemekten sonra ölçüldü)" value={post} onChange={setPost} />
        {post && afterSrc ? (
          <Notice
            level="info"
            text={`${mealLabel(
              afterSrc.meal ?? mealAt(afterSrc.time, settings.mealStarts)
            )} yemeğinin tokluk şekeri olarak kaydedilecek.`}
          />
        ) : null}
      </Card>

      <Card title="Şeker Ölçümü" icon="water-outline">
        <Row>
          <Field label="Şeker" suffix="mg/dL" value={bg} onChangeText={setBg} keyboard="number" />
          <TimeField label="Ölçüm saati" value={bgTimeText} onChange={setBgTimeText} />
        </Row>
        {feedback ? (
          <View
            style={[
              styles.feedbackBadge,
              { backgroundColor: feedback.badgeBg, borderColor: feedback.borderColor, marginTop: 4 },
            ]}>
            <T style={{ fontWeight: '700', color: feedback.textColor, fontSize: 13 }}>
              {feedback.label}
            </T>
            <T variant="small" style={{ color: feedback.textColor, opacity: 0.9, marginTop: 2 }}>
              {feedback.detail}
            </T>
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
                key={i.id ?? i.foodId}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 8,
                  paddingHorizontal: 12,
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
                      onPress={() => updateItemGrams(i.id ?? i.foodId, -10, true)}
                      hitSlop={6}
                      accessibilityLabel={`${i.name} 10 gram azalt`}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: c.card,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Ionicons name="remove" size={14} color={c.text} />
                    </Pressable>
                    <T style={{ minWidth: 44, textAlign: 'center', fontWeight: '700' }}>
                      {fmt(i.grams, 0)} g
                    </T>
                    <Pressable
                      onPress={() => updateItemGrams(i.id ?? i.foodId, 10, true)}
                      hitSlop={6}
                      accessibilityLabel={`${i.name} 10 gram artır`}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        backgroundColor: c.card,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      <Ionicons name="add" size={14} color={c.text} />
                    </Pressable>
                  </View>
                ) : null}
                <Pressable onPress={() => removeItem(i.id ?? i.foodId)} hitSlop={8} accessibilityLabel={`${i.name} sil`}>
                  <Ionicons name="close-circle" size={20} color={c.muted} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        <Row>
          <Btn
            small
            variant="secondary"
            icon="list"
            title={items?.length ? 'Yemek ekle / değiştir' : 'Yemek listesinden seç'}
            onPress={openFoodPicker}
            style={{ flexGrow: 1 }}
          />
          {items?.length ? (
            <Btn
              small
              variant="ghost"
              icon="close"
              title="Temizle"
              onPress={() => {
                setItems(undefined);
                setCarbs('');
              }}
            />
          ) : null}
        </Row>

        <Row>
          <Field
            label={settings.rapidName ? `Hızlı insülin (${settings.rapidName})` : 'Hızlı insülin'}
            suffix="Ü"
            value={bolus}
            onChangeText={setBolus}
            step={0.5}
          />
          {showBasal ? (
            <Field
              label={`Bazal${settings.basalName ? ` (${settings.basalName})` : ''}`}
              suffix="Ü"
              value={basal}
              onChangeText={setBasal}
              step={1}
            />
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
        <Field
          label="Not"
          keyboard="text"
          value={note}
          onChangeText={setNote}
          placeholder="Örn: spor sonrası, baş ağrısı, stresli dönem"
        />
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
            confirm(
              'Kaydı sil',
              'Bu kayıt silinsin mi?',
              () => {
                entries.filter((x) => x.afterId === existing.id).forEach((x) => remove(x.id));
                remove(existing.id);
                router.back();
              },
              'Sil'
            )
          }
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    padding: Space.lg,
    gap: Space.md,
    shadowColor: '#10292D',
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  numberInputContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  heroNumberInput: {
    fontSize: 58,
    lineHeight: 64,
    minWidth: 140,
    textAlign: 'center',
    fontWeight: '800',
    padding: 0,
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  stepBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 1,
    minWidth: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackBadge: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hypoQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
  },
  mealPill: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
  },
});
