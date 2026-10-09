import type { LogEntry, Settings } from '@/logic/types';
import { DEFAULT_MEAL_STARTS } from '@/logic/meals';
import { FOODS } from '@/data/foods-tr';
import { useLog } from '@/store/log';
import { useSettings, DEFAULT_SETTINGS } from '@/store/settings';
import { useFoods } from '@/store/foods';

/** Besin adından gerçek kimlik üret: kimlikler slug(kategori-ad) biçiminde olduğundan ad ile ararız */
const foodId = (name: string) => FOODS.find((f) => f.name === name)?.id ?? '';

/**
 * Hemoglobin A1c (GMI) değeri tam olarak %6.6 çıkacak şekilde
 * ortalama glukoz = ~137.5 mg/dL (GMI = 3.31 + 0.02392 * 137.5 = 6.60)
 * olarak kalibre edilmiş, zengin ve gerçekçi 14 günlük diyabet günlüğü verisi.
 */

export function buildMockData(now = new Date()): { settings: Settings; entries: LogEntry[] } {
  const entries: LogEntry[] = [];
  let idCounter = 1000;
  const nextId = () => `mock-${++idCounter}`;

  // 14 günlük döngü (bugünden geriye doğru)
  const days = 14;

  // Çeşitli ve dengeli günlük şablonlar (toplam BG ortalaması ~137 mg/dL)
  const templates = [
    {
      // Tipik dengeli gün 1
      breakfastBg: 110,
      breakfastFoods: '2 Haşlanmış Yumurta, 40g Beyaz Peynir, 5 Siyah Zeytin, 2 Dilim Tam Buğday Ekmeği, Domates & Salatalık',
      breakfastCarbs: 32,
      breakfastBolus: 3.2,
      postBreakfastBg: 152,

      lunchBg: 122,
      lunchFoods: 'Ezogelin Çorbası, Izgara Tavuk Göğsü, 4 YK Bulgur Pilavı, Çoban Salata, 1 Kutu Ayran',
      lunchCarbs: 54,
      lunchBolus: 5.0,
      postLunchBg: 160,

      snackBg: 128,
      snackFoods: '1 Orta Boy Yeşil Elma, 6 Adet Çiğ Badem',
      snackCarbs: 18,
      snackBolus: 1.5,

      dinnerBg: 118,
      dinnerFoods: 'Fırında Somon Fileto, Fırınlanmış Baharatlı Patates, Mevsim Yeşillikleri Salatası',
      dinnerCarbs: 42,
      dinnerBolus: 4.2,
      postDinnerBg: 156,

      nightBg: 126,
      basalDose: 16,
    },
    {
      // Tipik dengeli gün 2 (hafif düşük öğün)
      breakfastBg: 104,
      breakfastFoods: 'Kıymalı Menemen, 1 Dilim Çavdar Ekmeği, 30g Lor Peyniri, Şekersiz Açık Çay',
      breakfastCarbs: 26,
      breakfastBolus: 2.6,
      postBreakfastBg: 144,

      lunchBg: 116,
      lunchFoods: 'Kuru Fasulye, 3 YK Bulgur Pilavı, Salatalıklı Cacık, Mevsim Salata',
      lunchCarbs: 52,
      lunchBolus: 4.8,
      postLunchBg: 154,

      snackBg: 124,
      snackFoods: '2 Adet Kuru Kayısı, 3 Tam Ceviz İçi',
      snackCarbs: 15,
      snackBolus: 1.2,

      dinnerBg: 115,
      dinnerFoods: 'Zeytinyağlı Kıymalı Ispanak, 1 Kase Yoğurt, 1 Dilim Tam Buğday Ekmeği',
      dinnerCarbs: 36,
      dinnerBolus: 3.6,
      postDinnerBg: 146,

      nightBg: 122,
      basalDose: 16,
    },
    {
      // Tipik gün 3 (biraz daha yüksek tokluk)
      breakfastBg: 118,
      breakfastFoods: 'Kaşarlı Tost (Tam Buğday), Söğüş Domates, Salatalık, Açık Çay',
      breakfastCarbs: 40,
      breakfastBolus: 4.0,
      postBreakfastBg: 164,

      lunchBg: 126,
      lunchFoods: 'Etli Taze Fasulye Yemeği, 4 YK Pirinç Pilavı, 1 Kase Yoğurt, Çoban Salata',
      lunchCarbs: 60,
      lunchBolus: 5.5,
      postLunchBg: 168,

      snackBg: 132,
      snackFoods: '1 Küçük Muz, 1 Çay Bardağı Süt',
      snackCarbs: 22,
      snackBolus: 2.0,

      dinnerBg: 125,
      dinnerFoods: 'Izgara Anne Köftesi, Fırın Sebze (Kabak & Biber), 1 Dilim Ekmek, Gavurdağı Salata',
      dinnerCarbs: 46,
      dinnerBolus: 4.6,
      postDinnerBg: 162,

      nightBg: 130,
      basalDose: 16,
    },
  ];

  for (let dayOffset = days - 1; dayOffset >= 0; dayOffset--) {
    const d = new Date(now);
    d.setDate(d.getDate() - dayOffset);

    const tmpl = templates[dayOffset % templates.length];

    // 1. Sabah Kahvaltısı (~08:30)
    d.setHours(8, 30, 0, 0);
    const bTime = d.getTime();
    const breakfastEntryId = nextId();
    entries.push({
      id: breakfastEntryId,
      time: bTime,
      bg: tmpl.breakfastBg,
      bgTime: bTime,
      meal: 'sabah',
      foods: tmpl.breakfastFoods,
      carbs: tmpl.breakfastCarbs,
      bolus: tmpl.breakfastBolus,
      mealBolus: tmpl.breakfastBolus,
      note: 'Kahvaltı öncesi açlık şekeri ve öğün bolusu',
    });

    // 2. Sabah Tokluk (~10:30, 2 saat sonra)
    d.setHours(10, 30, 0, 0);
    const postBTime = d.getTime();
    entries.push({
      id: nextId(),
      time: postBTime,
      bg: tmpl.postBreakfastBg,
      bgTime: postBTime,
      meal: 'sabah',
      post: true,
      afterId: breakfastEntryId,
      note: 'Kahvaltı sonrası 2. saat tokluk şekeri',
    });

    // 3. Öğle Yemeği (~13:00)
    d.setHours(13, 0, 0, 0);
    const lTime = d.getTime();
    const lunchEntryId = nextId();
    entries.push({
      id: lunchEntryId,
      time: lTime,
      bg: tmpl.lunchBg,
      bgTime: lTime,
      meal: 'ogle',
      foods: tmpl.lunchFoods,
      carbs: tmpl.lunchCarbs,
      bolus: tmpl.lunchBolus,
      mealBolus: tmpl.lunchBolus,
      note: 'Öğle yemeği ve bolus',
    });

    // 4. Öğle Tokluk (~15:00, 2 saat sonra)
    d.setHours(15, 0, 0, 0);
    const postLTime = d.getTime();
    entries.push({
      id: nextId(),
      time: postLTime,
      bg: tmpl.postLunchBg,
      bgTime: postLTime,
      meal: 'ogle',
      post: true,
      afterId: lunchEntryId,
      note: 'Öğle yemeği sonrası 2. saat tokluk',
    });

    // 5. İkindi Ara Öğün (~17:00)
    if (dayOffset % 2 === 0) {
      d.setHours(17, 0, 0, 0);
      const sTime = d.getTime();
      entries.push({
        id: nextId(),
        time: sTime,
        bg: tmpl.snackBg,
        bgTime: sTime,
        meal: 'ogleAra',
        foods: tmpl.snackFoods,
        carbs: tmpl.snackCarbs,
        bolus: tmpl.snackBolus,
        note: 'İkindi ara öğün',
      });
    }

    // 6. Akşam Yemeği (~19:30)
    d.setHours(19, 30, 0, 0);
    const dTime = d.getTime();
    const dinnerEntryId = nextId();
    entries.push({
      id: dinnerEntryId,
      time: dTime,
      bg: tmpl.dinnerBg,
      bgTime: dTime,
      meal: 'aksam',
      foods: tmpl.dinnerFoods,
      carbs: tmpl.dinnerCarbs,
      bolus: tmpl.dinnerBolus,
      mealBolus: tmpl.dinnerBolus,
      note: 'Akşam yemeği ve bolus',
    });

    // 7. Akşam Tokluk (~21:30, 2 saat sonra)
    d.setHours(21, 30, 0, 0);
    const postDTime = d.getTime();
    entries.push({
      id: nextId(),
      time: postDTime,
      bg: tmpl.postDinnerBg,
      bgTime: postDTime,
      meal: 'aksam',
      post: true,
      afterId: dinnerEntryId,
      note: 'Akşam yemeği sonrası 2. saat tokluk',
    });

    // 8. Gece Yatış & Bazal (~23:00)
    d.setHours(23, 0, 0, 0);
    const nTime = d.getTime();
    entries.push({
      id: nextId(),
      time: nTime,
      bg: tmpl.nightBg,
      bgTime: nTime,
      meal: 'gece',
      basal: tmpl.basalDose,
      note: 'Gece yatış şekeri ve 16 Ü Lantus dozu',
    });
  }

  // Gerçek hayat senaryoları:
  // 1 adet hafif hipo olayı (5 gün önce ikindi saatinde)
  const hypoDate = new Date(now);
  hypoDate.setDate(hypoDate.getDate() - 5);
  hypoDate.setHours(16, 45, 0, 0);
  entries.push({
    id: nextId(),
    time: hypoDate.getTime(),
    bg: 68,
    bgTime: hypoDate.getTime(),
    meal: 'ogleAra',
    hypoCarbs: 15,
    note: 'Hafif hipo atağı. 3 adet glukoz tableti ve su alındı.',
  });

  // Hipo tedavisi sonrası 15. dakika ölçümü
  hypoDate.setMinutes(hypoDate.getMinutes() + 15);
  entries.push({
    id: nextId(),
    time: hypoDate.getTime(),
    bg: 96,
    bgTime: hypoDate.getTime(),
    meal: 'ogleAra',
    note: 'Hipo sonrası 15. dk kontrol ölçümü (normale döndü)',
  });

  // 1 adet hafif hiper olayı (3 gün önce doğum günü kutlaması pastası sonrası)
  const hyperDate = new Date(now);
  hyperDate.setDate(hyperDate.getDate() - 3);
  hyperDate.setHours(20, 15, 0, 0);
  entries.push({
    id: nextId(),
    time: hyperDate.getTime(),
    bg: 198,
    bgTime: hyperDate.getTime(),
    meal: 'aksam',
    foods: '1 Dilim Doğum Günü Pastası (Meyveli)',
    carbs: 45,
    bolus: 5.5,
    mealBolus: 4.5,
    correctionBolus: 1.0,
    note: 'Özel gün tatlısı + 1.0 Ü düzeltme dozu',
  });

  // Sırala
  entries.sort((a, b) => a.time - b.time);

  // Ortalama BG değerini tam 137.5 mg/dL'ye ayarlayarak HbA1c (GMI) = %6.6 olmasını garanti et
  const bgs = entries.filter((e) => e.bg !== undefined);
  const currentSum = bgs.reduce((s, e) => s + e.bg!, 0);
  const targetSum = Math.round(137.5 * bgs.length);
  const diff = targetSum - currentSum;

  // Farkı rastgele seçilen birkaç ölçüme 1'er 2'şer puan dağıt
  let remaining = diff;
  let idx = 0;
  while (remaining !== 0 && idx < bgs.length) {
    const step = remaining > 0 ? 1 : -1;
    bgs[idx].bg = (bgs[idx].bg ?? 120) + step;
    remaining -= step;
    idx = (idx + 7) % bgs.length;
  }

  // Ayarlar
  const mockSettings: Settings = {
    ...DEFAULT_SETTINGS,
    onboarded: true,
    patientName: 'Kullanıcı',
    rapidName: 'NovoRapid',
    basalName: 'Lantus',
    basalDose: 16,
    basalTime: '23:00',
    basalReminder: false,
    dia: 4,
    peak: 75,
    penStep: 1,
    maxBolus: 15,
    hypoThreshold: 70,
    severeHypoThreshold: 54,
    hyperThreshold: 250,
    fastingRange: { low: 80, high: 130 },
    postRange: { low: 80, high: 180 },
    ratioSource: 'doctor',
    mealStarts: DEFAULT_MEAL_STARTS,
    blocks: [
      {
        id: 'block-sabah',
        name: 'Sabah (Kahvaltı)',
        meal: 'sabah',
        start: '07:00',
        icr: 10,
        isf: 40,
        target: 110,
        low: 80,
        high: 130,
      },
      {
        id: 'block-ogle',
        name: 'Öğle Yemeği',
        meal: 'ogle',
        start: '12:00',
        icr: 11,
        isf: 45,
        target: 115,
        low: 80,
        high: 130,
      },
      {
        id: 'block-aksam',
        name: 'Akşam Yemeği',
        meal: 'aksam',
        start: '18:00',
        icr: 10,
        isf: 40,
        target: 110,
        low: 80,
        high: 130,
      },
    ],
  };

  return { settings: mockSettings, entries };
}

/**
 * Mock verileri Zustand store'larına (useSettings, useLog, useFoods) uygular ve kaydeder.
 */
export function applyMockData(now = new Date()) {
  const { settings, entries } = buildMockData(now);
  useSettings.getState().replaceAll(settings, [
    {
      time: now.getTime() - 14 * 86400000,
      blockName: 'Sabah (Kahvaltı)',
      field: 'icr',
      from: 12,
      to: 10,
      source: 'Endokrinolog viziti',
    },
  ]);
  useLog.getState().replaceAll(entries);
  useFoods.getState().replaceAll({
    customFoods: [],
    favorites: ['Haşlanmış yumurta', 'Tam buğday ekmeği', 'Bulgur pilavı', 'Elma'].map(foodId).filter(Boolean),
    meals: [
      {
        id: 'meal-klasik-kahvalti',
        name: 'Klasik Kahvaltı',
        items: [
          { id: 'item-1', foodId: foodId('Haşlanmış yumurta'), name: 'Yumurta', grams: 100, carbs: 1 },
          { id: 'item-2', foodId: foodId('Tam buğday ekmeği'), name: 'Tam Buğday Ekmeği', grams: 50, carbs: 24 },
          { id: 'item-3', foodId: foodId('Beyaz peynir'), name: 'Beyaz Peynir', grams: 40, carbs: 1 },
        ],
      },
    ],
  });
}
