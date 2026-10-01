/**
 * Yaklaşık karbonhidrat değerleri (100 g / 100 ml başına, lif hariç kullanılabilir karbonhidrat).
 * Tarif, porsiyon ve markaya göre değişir; paketli ürünlerde her zaman etiketi esas al.
 */
export type Portion = { label: string; grams: number };

export type Food = {
  id: string;
  name: string;
  category: string;
  carbsPer100: number;
  portions: Portion[];
  /** Yağlı/proteinli: şeker geç yükselebilir */
  fatty?: boolean;
  /** Hipo tedavisine uygun hızlı karbonhidrat */
  fast?: boolean;
  custom?: boolean;
};

export const CATEGORIES = [
  'Ekmek & Hamur İşi',
  'Pilav, Makarna & Tahıl',
  'Çorbalar',
  'Ana Yemekler',
  'Fast Food & Sokak',
  'Salata & Meze',
  'Kahvaltılık',
  'Süt & İçecekler',
  'Meyveler',
  'Kuruyemiş',
  'Tatlılar & Atıştırmalık',
  'Sebzeler',
  'Hipo İçin',
] as const;

const P = (label: string, grams: number): Portion => ({ label, grams });

type Row = [name: string, carbsPer100: number, portions: Portion[], flags?: 'fatty' | 'fast'];

const DATA: Record<(typeof CATEGORIES)[number], Row[]> = {
  'Ekmek & Hamur İşi': [
    ['Beyaz ekmek', 50, [P('1 ince dilim', 25), P('1 dilim', 35)]],
    ['Tam buğday ekmeği', 41, [P('1 ince dilim', 25), P('1 dilim', 35)]],
    ['Kepekli ekmek', 43, [P('1 dilim', 30)]],
    ['Çavdar ekmeği', 45, [P('1 dilim', 30)]],
    ['Tost ekmeği', 47, [P('1 dilim', 25)]],
    ['Ramazan pidesi', 52, [P('1/4 pide', 70), P('1 dilim', 30)]],
    ['Lavaş', 55, [P('1 adet', 60)]],
    ['Bazlama', 50, [P('1/4 adet', 50), P('1 adet', 200)]],
    ['Simit', 55, [P('1 adet', 100), P('1/2 adet', 50)]],
    ['Poğaça (peynirli)', 42, [P('1 adet', 70)], 'fatty'],
    ['Açma', 47, [P('1 adet', 80)], 'fatty'],
    ['Su böreği', 25, [P('1 porsiyon', 150)], 'fatty'],
    ['Sigara böreği', 30, [P('1 adet', 30)], 'fatty'],
    ['Kol böreği (ıspanaklı)', 30, [P('1 dilim', 100)], 'fatty'],
    ['Gözleme (peynirli)', 30, [P('1 adet', 200)], 'fatty'],
    ['Kruvasan', 45, [P('1 adet', 60)], 'fatty'],
    ['Galeta', 72, [P('1 adet', 10)]],
    ['Grissini', 70, [P('1 adet', 6)]],
    ['Kaşarlı tost', 30, [P('1 adet', 150)], 'fatty'],
  ],
  'Pilav, Makarna & Tahıl': [
    ['Pirinç pilavı', 30, [P('1 yemek kaşığı', 15), P('1 porsiyon', 150)]],
    ['Bulgur pilavı', 20, [P('1 yemek kaşığı', 15), P('1 porsiyon', 150)]],
    ['Makarna (haşlanmış)', 30, [P('1 yemek kaşığı', 15), P('1 porsiyon', 180)]],
    ['Tam buğday makarna (haşlanmış)', 26, [P('1 porsiyon', 180)]],
    ['Erişte (haşlanmış)', 28, [P('1 porsiyon', 180)]],
    ['Şehriye pilavı', 30, [P('1 porsiyon', 150)]],
    ['Kuskus (pişmiş)', 23, [P('1 porsiyon', 150)]],
    ['Yulaf ezmesi (kuru)', 60, [P('1 yemek kaşığı', 10), P('1 kase', 40)]],
    ['Mısır gevreği', 84, [P('1 kase', 30)]],
    ['Granola', 64, [P('1 kase', 50)]],
    ['Müsli', 66, [P('1 kase', 50)]],
    ['Haşlanmış patates', 17, [P('1 orta boy', 150)]],
    ['Fırın patates', 20, [P('1 porsiyon', 150)]],
    ['Patates püresi', 15, [P('1 porsiyon', 150)]],
    ['Haşlanmış mısır', 19, [P('1 koçan (yenen)', 100)]],
    ['Patlamış mısır', 74, [P('1 kase', 10)]],
  ],
  'Çorbalar': [
    ['Mercimek çorbası', 8, [P('1 kase', 250)]],
    ['Ezogelin çorbası', 9, [P('1 kase', 250)]],
    ['Tarhana çorbası', 7, [P('1 kase', 250)]],
    ['Yayla çorbası', 6, [P('1 kase', 250)]],
    ['Domates çorbası', 7, [P('1 kase', 250)]],
    ['Tavuk şehriye çorbası', 5, [P('1 kase', 250)]],
    ['Sebze çorbası', 5, [P('1 kase', 250)]],
    ['İşkembe çorbası', 2, [P('1 kase', 250)]],
  ],
  'Ana Yemekler': [
    ['Kuru fasulye', 13, [P('1 porsiyon', 200)]],
    ['Nohut yemeği', 15, [P('1 porsiyon', 200)]],
    ['Barbunya pilaki', 12, [P('1 porsiyon', 200)]],
    ['Yeşil mercimek yemeği', 12, [P('1 porsiyon', 200)]],
    ['Etli taze fasulye', 5, [P('1 porsiyon', 200)]],
    ['Zeytinyağlı taze fasulye', 6, [P('1 porsiyon', 200)]],
    ['Karnıyarık', 7, [P('1 adet', 250)], 'fatty'],
    ['İmam bayıldı', 8, [P('1 adet', 200)], 'fatty'],
    ['Türlü', 7, [P('1 porsiyon', 250)]],
    ['Zeytinyağlı yaprak sarma', 22, [P('1 adet', 20)]],
    ['Biber dolması (etli)', 12, [P('1 adet', 120)]],
    ['Kıymalı ıspanak', 4, [P('1 porsiyon', 200)]],
    ['Menemen', 5, [P('1 porsiyon', 200)]],
    ['Omlet', 1, [P('2 yumurtalı', 120)]],
    ['Haşlanmış yumurta', 1, [P('1 adet', 50)]],
    ['Izgara köfte', 6, [P('1 adet', 30), P('1 porsiyon', 180)], 'fatty'],
    ['Izgara et / tavuk / balık', 0, [P('1 porsiyon', 150)]],
    ['Tavuk sote', 4, [P('1 porsiyon', 200)]],
    ['Hünkar beğendi', 10, [P('1 porsiyon', 300)], 'fatty'],
    ['Musakka', 8, [P('1 porsiyon', 250)], 'fatty'],
    ['Mantı (yoğurtlu)', 20, [P('1 porsiyon', 300)], 'fatty'],
    ['İçli köfte', 25, [P('1 adet', 70)], 'fatty'],
    ['Mercimek köftesi', 25, [P('1 adet', 30)]],
  ],
  'Fast Food & Sokak': [
    ['Lahmacun', 35, [P('1 adet', 120)], 'fatty'],
    ['Kıymalı / kaşarlı pide', 30, [P('1 adet', 250)], 'fatty'],
    ['Pizza', 30, [P('1 dilim', 110)], 'fatty'],
    ['Hamburger', 25, [P('1 adet', 220)], 'fatty'],
    ['Islak hamburger', 30, [P('1 adet', 120)], 'fatty'],
    ['Tavuk döner dürüm', 22, [P('1 adet', 300)], 'fatty'],
    ['Döner ekmek arası', 25, [P('1 adet', 300)], 'fatty'],
    ['İskender', 15, [P('1 porsiyon', 400)], 'fatty'],
    ['Tantuni dürüm', 25, [P('1 adet', 250)], 'fatty'],
    ['Kumpir', 20, [P('1 adet', 450)], 'fatty'],
    ['Patates kızartması', 35, [P('1 porsiyon', 120)], 'fatty'],
    ['Çiğ köfte (köftesi)', 33, [P('1 parmak', 20)]],
    ['Çiğ köfte dürüm', 35, [P('1 adet', 220)]],
    ['Midye dolma', 20, [P('1 adet', 15)]],
    ['Balık ekmek', 25, [P('1 adet', 300)]],
    ['Kokoreç (yarım ekmek)', 15, [P('1 adet', 300)], 'fatty'],
  ],
  'Salata & Meze': [
    ['Çoban / yeşil salata', 4, [P('1 kase', 150)]],
    ['Kısır', 22, [P('1 porsiyon', 150)]],
    ['Humus', 14, [P('1 yemek kaşığı', 20)]],
    ['Cacık', 4, [P('1 kase', 200)]],
    ['Haydari', 4, [P('1 yemek kaşığı', 20)]],
    ['Acılı ezme', 8, [P('1 yemek kaşığı', 20)]],
    ['Patates salatası', 15, [P('1 porsiyon', 150)]],
    ['Rus salatası', 10, [P('1 porsiyon', 150)]],
  ],
  'Kahvaltılık': [
    ['Beyaz peynir', 1, [P('1 dilim', 30)]],
    ['Kaşar peyniri', 1, [P('1 dilim', 20)]],
    ['Zeytin', 4, [P('1 adet', 4)]],
    ['Bal', 82, [P('1 tatlı kaşığı', 10), P('1 yemek kaşığı', 20)]],
    ['Reçel', 65, [P('1 tatlı kaşığı', 10), P('1 yemek kaşığı', 20)]],
    ['Pekmez', 75, [P('1 yemek kaşığı', 20)]],
    ['Tahin', 21, [P('1 yemek kaşığı', 15)]],
    ['Kakaolu fındık kreması', 57, [P('1 tatlı kaşığı', 15)], 'fatty'],
    ['Fıstık ezmesi', 20, [P('1 yemek kaşığı', 15)]],
    ['Krem peynir', 4, [P('1 yemek kaşığı', 20)]],
    ['Sucuk', 2, [P('3 dilim', 30)]],
    ['Domates', 4, [P('1 orta boy', 120)]],
    ['Salatalık', 3, [P('1 orta boy', 150)]],
  ],
  'Süt & İçecekler': [
    ['Süt', 4.8, [P('1 su bardağı', 200)]],
    ['Yoğurt', 4.5, [P('1 kase', 200)]],
    ['Süzme yoğurt', 4, [P('1 kase', 150)]],
    ['Meyveli yoğurt', 14, [P('1 kutu', 125)]],
    ['Ayran', 3, [P('1 kutu', 200), P('1 büyük bardak', 300)]],
    ['Kefir', 4.5, [P('1 su bardağı', 200)]],
    ['Kola (normal)', 10.6, [P('1 kutu', 330), P('1 su bardağı', 200)], 'fast'],
    ['Gazoz', 10, [P('1 kutu', 330)], 'fast'],
    ['Portakal suyu', 10, [P('1 su bardağı', 200)], 'fast'],
    ['Vişne / şeftali nektarı', 13, [P('1 su bardağı', 200), P('1 kutu', 200)], 'fast'],
    ['Limonata', 10, [P('1 su bardağı', 200)]],
    ['Soğuk çay (ice tea)', 7, [P('1 kutu', 330)]],
    ['Şekersiz / zero içecekler', 0, [P('1 kutu', 330)]],
    ['Salep', 15, [P('1 kupa', 250)]],
    ['Sıcak çikolata', 11, [P('1 kupa', 250)]],
    ['Boza', 20, [P('1 su bardağı', 200)]],
    ['Bira', 3.6, [P('1 şişe', 500)]],
  ],
  'Meyveler': [
    ['Elma', 12, [P('1 orta boy', 150)]],
    ['Armut', 12, [P('1 orta boy', 170)]],
    ['Muz', 20, [P('1 orta boy (soyulmuş)', 120)]],
    ['Portakal', 9, [P('1 orta boy (soyulmuş)', 150)]],
    ['Mandalina', 10, [P('1 adet (soyulmuş)', 80)]],
    ['Greyfurt', 7, [P('1/2 adet', 150)]],
    ['Üzüm', 16, [P('1 su bardağı', 150)]],
    ['Kiraz', 14, [P('10 adet', 70)]],
    ['Vişne', 11, [P('1 su bardağı', 150)]],
    ['Çilek', 6, [P('1 kase', 150)]],
    ['Karpuz', 7, [P('1 dilim (yenen)', 300)]],
    ['Kavun', 7, [P('1 dilim (yenen)', 250)]],
    ['Şeftali', 9, [P('1 orta boy', 150)]],
    ['Kayısı', 9, [P('1 adet', 40)]],
    ['Erik', 10, [P('1 adet', 30)]],
    ['İncir (taze)', 16, [P('1 adet', 50)]],
    ['Nar (taneleri)', 14, [P('1 kase', 150)]],
    ['Kivi', 10, [P('1 adet', 75)]],
    ['Ananas', 12, [P('1 dilim', 80)]],
    ['Ayva', 13, [P('1/2 adet', 150)]],
    ['Dut', 10, [P('1 kase', 140)]],
    ['Böğürtlen / ahududu', 5, [P('1 kase', 125)]],
    ['Avokado', 2, [P('1/2 adet', 70)]],
    ['Hurma (kuru)', 66, [P('1 adet', 8)], 'fast'],
    ['Kuru üzüm', 70, [P('1 yemek kaşığı', 10)], 'fast'],
    ['Kuru kayısı', 50, [P('1 adet', 8)]],
    ['Kuru incir', 55, [P('1 adet', 20)]],
    ['Kuru dut', 65, [P('1 yemek kaşığı', 8)]],
  ],
  'Kuruyemiş': [
    ['Fındık', 7, [P('1 avuç', 30)]],
    ['Ceviz', 7, [P('1 avuç', 30)]],
    ['Badem', 9, [P('1 avuç', 30)]],
    ['Antep fıstığı', 18, [P('1 avuç', 30)]],
    ['Kaju', 27, [P('1 avuç', 30)]],
    ['Leblebi', 50, [P('1 avuç', 30)]],
    ['Ay çekirdeği (iç)', 12, [P('1 avuç', 30)]],
  ],
  'Tatlılar & Atıştırmalık': [
    ['Baklava', 50, [P('1 dilim', 40)], 'fatty'],
    ['Künefe', 35, [P('1 porsiyon', 150)], 'fatty'],
    ['Tel kadayıf', 50, [P('1 dilim', 80)], 'fatty'],
    ['Revani', 50, [P('1 dilim', 80)]],
    ['Şekerpare', 55, [P('1 adet', 40)]],
    ['Tulumba', 50, [P('1 adet', 25)], 'fatty'],
    ['Lokma', 50, [P('1 adet', 15)], 'fatty'],
    ['Sütlaç', 20, [P('1 kase', 200)]],
    ['Kazandibi', 25, [P('1 porsiyon', 150)]],
    ['Muhallebi', 18, [P('1 kase', 150)]],
    ['Tavuk göğsü', 22, [P('1 porsiyon', 150)]],
    ['Keşkül', 18, [P('1 kase', 150)]],
    ['Aşure', 25, [P('1 kase', 200)]],
    ['Güllaç', 22, [P('1 dilim', 150)]],
    ['Lokum', 85, [P('1 adet', 15)], 'fast'],
    ['Tahin helvası', 55, [P('1 dilim', 40)], 'fatty'],
    ['İrmik helvası', 45, [P('1 porsiyon', 100)], 'fatty'],
    ['Dondurma', 24, [P('1 top', 50)], 'fatty'],
    ['Puding', 20, [P('1 kase', 150)]],
    ['Kek', 50, [P('1 dilim', 60)], 'fatty'],
    ['Yaş pasta', 40, [P('1 dilim', 120)], 'fatty'],
    ['Profiterol', 30, [P('1 porsiyon', 150)], 'fatty'],
    ['Cheesecake', 25, [P('1 dilim', 120)], 'fatty'],
    ['Kurabiye', 60, [P('1 adet', 20)], 'fatty'],
    ['Bisküvi (sade)', 70, [P('1 adet', 8)]],
    ['Gofret', 60, [P('1 paket', 35)], 'fatty'],
    ['Sütlü çikolata', 55, [P('1 kare', 5), P('1 tablet', 80)], 'fatty'],
    ['Bitter çikolata (%70)', 35, [P('1 kare', 5)], 'fatty'],
    ['Cips', 50, [P('1 küçük paket', 40)], 'fatty'],
  ],
  'Sebzeler': [
    ['Havuç', 7, [P('1 orta boy', 70)]],
    ['Bezelye', 10, [P('1 porsiyon', 100)]],
    ['Kırmızı pancar', 8, [P('1 porsiyon', 100)]],
    ['Brokoli / karnabahar', 3, [P('1 porsiyon', 150)]],
    ['Kabak', 3, [P('1 porsiyon', 150)]],
    ['Patlıcan', 3, [P('1 porsiyon', 150)]],
  ],
  'Hipo İçin': [
    ['Glukoz tableti (etiketi kontrol et)', 90, [P('1 tablet', 4)], 'fast'],
    ['Küp şeker', 100, [P('1 adet', 3)], 'fast'],
    ['Toz şeker', 100, [P('1 tatlı kaşığı', 5), P('1 yemek kaşığı', 12)], 'fast'],
    ['Meyve suyu (hipo için)', 11, [P('150 ml', 150)], 'fast'],
    ['Bal (hipo için)', 82, [P('1 yemek kaşığı', 20)], 'fast'],
  ],
};

function slug(s: string) {
  return s
    .toLocaleLowerCase('tr-TR')
    .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export const FOODS: Food[] = Object.entries(DATA).flatMap(([category, rows]) =>
  rows.map(([name, carbsPer100, portions, flag]) => ({
    id: slug(`${category}-${name}`),
    name,
    category,
    carbsPer100,
    portions,
    fatty: flag === 'fatty' || undefined,
    fast: flag === 'fast' || undefined,
  })),
);

/** Türkçe karakter ve büyük/küçük harf duyarsız arama için */
export function normalize(s: string) {
  return slug(s).replace(/-/g, ' ');
}

export function carbsFor(food: Food, grams: number) {
  return (food.carbsPer100 * grams) / 100;
}
