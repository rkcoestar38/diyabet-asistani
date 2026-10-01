/**
 * Yaklaşık karbonhidrat değerleri. İki sayım yöntemi vardır:
 * - 'composition' (gerçek bileşim): 100 g/ml başına kullanılabilir (lif hariç) karbonhidrat; TürKomp ve etiketlerle uyumlu.
 * - 'exchange' (değişim listesi): 1 ekmek/meyve değişimi = 15 g KHO (süt/yoğurt 1 bardak = 10 g, sebze = 6 g, et/yağ = 0 g).
 *   Türkiye Beslenme Rehberi (TÜBER 2022) değişim listesine ve hastane eğitiminde kullanılan kurallara göre.
 * Tarif, porsiyon ve markaya göre değişir; paketli ürünlerde her zaman etiketi esas al.
 */
export type CountMethod = 'exchange' | 'composition';

export type Portion = { label: string; grams: number };

export type Food = {
  id: string;
  name: string;
  category: string;
  /** Gerçek bileşim: 100 g başına karbonhidrat */
  carbsPer100: number;
  /** Değişim listesi yöntemindeki 100 g başına karşılığı (yoksa carbsPer100 kullanılır) */
  exPer100?: number;
  /** Et/tavuk/balık: öğünde toplam 100 g üzeri ise değişim yönteminde +10 g KHO kuralı uygulanır */
  meat?: boolean;
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

/** Değişim listesinde "X g yiyecek = Y g KHO" olarak verilen bir karşılığı 100 g başına değere çevirir */
const x = (carbs: number, grams: number) => Math.round((carbs / grams) * 100 * 100) / 100;

/** Değişim listesi (TÜBER 2022 + hastane eğitimi kuralları) değerleri: yiyecek adı → 100 g başına KHO */
const EXCHANGE: Record<string, number> = {
  // Ekmek ve tahıl grubu: 1 değişim = 15 g KHO
  'Beyaz ekmek': x(15, 25), 'Tam buğday ekmeği': x(15, 25), 'Tost ekmeği': x(15, 25),
  'Kepekli ekmek': x(15, 30), 'Çavdar ekmeği': x(15, 30),
  'Bazlama': x(15, 30), 'Lavaş': x(15, 30), 'Simit': x(15, 25), 'Galeta': x(15, 20), 'Grissini': x(15, 20),
  'Yulaf ezmesi (kuru)': x(15, 20), 'Müsli': x(15, 20),
  'Haşlanmış patates': x(15, 100), 'Fırın patates': x(15, 100), 'Patates püresi': x(15, 100),
  'Haşlanmış mısır': x(15, 100), 'Patlamış mısır': x(15, 25), 'Leblebi': x(15, 25), 'Bal': x(15, 20),
  // Süt ve yoğurt: 1 bardak = 10 g KHO
  'Süt': x(10, 200), 'Yoğurt': x(10, 200), 'Ayran': x(10, 300), 'Kefir': x(10, 200),
  // Çorbalar: 1 küçük kase (150 ml) = 1 ekmek değişimi = 15 g KHO
  'Mercimek çorbası': x(15, 150), 'Ezogelin çorbası': x(15, 150), 'Tarhana çorbası': x(15, 150),
  'Yayla çorbası': x(15, 150), 'Tavuk şehriye çorbası': x(15, 150), 'Domates çorbası': x(15, 150),
  // Meyve grubu: 1 değişim = 15 g KHO
  'Böğürtlen / ahududu': x(15, 100), 'Ananas': x(15, 100), 'Armut': x(15, 125), 'Ayva': x(15, 100), 'Çilek': x(15, 150),
  'Dut': x(15, 100), 'Elma': x(15, 100), 'Erik': x(15, 150), 'Greyfurt': x(15, 150), 'İncir (taze)': x(15, 100),
  'Kayısı': x(15, 100), 'Karpuz': x(15, 200), 'Kavun': x(15, 170), 'Kiraz': x(15, 80), 'Kivi': x(15, 90),
  'Mandalina': x(15, 100), 'Muz': x(15, 60), 'Nar (taneleri)': x(15, 80), 'Portakal': x(15, 100), 'Şeftali': x(15, 100),
  'Üzüm': x(15, 75), 'Vişne': x(15, 80),
  'Kuru incir': x(15, 25), 'Kuru kayısı': x(15, 22), 'Kuru üzüm': x(15, 20), 'Hurma (kuru)': x(15, 25), 'Kuru dut': x(15, 20),
  // Sebze grubu: 1 değişim = 6 g KHO
  'Domates': x(6, 150), 'Salatalık': x(6, 300), 'Havuç': x(6, 100), 'Brokoli / karnabahar': x(6, 150),
  'Kabak': x(6, 150), 'Patlıcan': x(6, 150),
  // Et, yumurta, peynir, yağ, yağlı tohum grubu: 0 g KHO
  'Haşlanmış yumurta': 0, 'Omlet': 0, 'Izgara köfte': 0, 'Izgara et / tavuk / balık': 0, 'Tavuk sote': 0,
  'Beyaz peynir': 0, 'Kaşar peyniri': 0, 'Krem peynir': 0, 'Sucuk': 0, 'Zeytin': 0, 'Avokado': 0,
  'Fındık': 0, 'Ceviz': 0, 'Badem': 0, 'Antep fıstığı': 0, 'Kaju': 0, 'Ay çekirdeği (iç)': 0,
  // Yemekler ve hazır yiyecekler (porsiyonun ilk ölçüsüne göre)
  'Lahmacun': x(45, 120), // diyetisyen kuralı: 3 ekmek + 2 et + 1 yağ = 45 g
  'Hamburger': x(37.5, 220), // ~2,5 ekmek (35–40 g)
  'Tavuk döner dürüm': x(45, 300), // 3 ekmek
  'Döner ekmek arası': x(60, 300), // yarım ekmek: 4 ekmek
  'Pizza': x(30, 110), // 1 dilim = 2 ekmek
  'Poğaça (peynirli)': x(30, 70), // 2 ekmek
  'Kaşarlı tost': x(37.5, 150), // 2,5 ekmek
  'Kıymalı / kaşarlı pide': x(60, 250), // 4 ekmek
  'Çiğ köfte dürüm': x(90, 220), // 6 ekmek
  'Patates kızartması': x(45, 120), // orta boy 3 ekmek
  'Baklava': x(22.5, 40), // 1 dilim = 1,5 ekmek
  'Künefe': x(60, 150), 'Revani': x(60, 100), 'İrmik helvası': x(75, 150), 'Sütlü çikolata': x(15, 20),
  'Kola (normal)': x(37.5, 330), 'Boza': x(37.5, 200),
  'Zeytinyağlı yaprak sarma': x(15, 80), // 4 adet = 1 ekmek
  'Karnıyarık': x(6, 250), 'Menemen': x(12, 200), 'İçli köfte': x(22.5, 70), 'Humus': x(7.5, 40),
};

const BOWL: Portion[] = [{ label: '1 küçük kase (150 ml)', grams: 150 }, { label: '1 kase (250 ml)', grams: 250 }];

/** Değişim listesindeki ölçülere uygun porsiyon tanımları (her iki yöntemde de geçerli) */
const PORTIONS: Record<string, Portion[]> = {
  'Beyaz ekmek': [{ label: '1 ince dilim', grams: 25 }, { label: '1 dilim', grams: 35 }],
  'Pirinç pilavı': [{ label: '2 yemek kaşığı (tepeleme)', grams: 50 }, { label: '1 porsiyon', grams: 150 }],
  'Bulgur pilavı': [{ label: '3 yemek kaşığı (tepeleme)', grams: 75 }, { label: '1 porsiyon', grams: 150 }],
  'Makarna (haşlanmış)': [{ label: '3 yemek kaşığı', grams: 50 }, { label: '1 porsiyon', grams: 180 }],
  'Erişte (haşlanmış)': [{ label: '3 yemek kaşığı', grams: 50 }, { label: '1 porsiyon', grams: 180 }],
  'Kuskus (pişmiş)': [{ label: '3 yemek kaşığı', grams: 65 }, { label: '1 porsiyon', grams: 150 }],
  'Şehriye pilavı': [{ label: '2 yemek kaşığı (tepeleme)', grams: 50 }, { label: '1 porsiyon', grams: 150 }],
  'Mercimek çorbası': BOWL,
  'Ezogelin çorbası': BOWL,
  'Tarhana çorbası': BOWL,
  'Yayla çorbası': BOWL,
  'Tavuk şehriye çorbası': BOWL,
  'Domates çorbası': BOWL,
  'Elma': [{ label: '1 orta boy', grams: 100 }],
  'Armut': [{ label: '1 küçük boy', grams: 125 }, { label: '1 orta boy', grams: 170 }],
  'Portakal': [{ label: '1 orta boy (soyulmuş)', grams: 100 }],
  'Mandalina': [{ label: '1 büyük adet (soyulmuş)', grams: 100 }],
  'Muz': [{ label: '1 küçük boy (soyulmuş)', grams: 60 }, { label: '1 orta boy (soyulmuş)', grams: 120 }],
  'Şeftali': [{ label: '1 orta boy', grams: 100 }],
  'Kayısı': [{ label: '4 orta adet', grams: 100 }],
  'Kiraz': [{ label: '11 büyük adet', grams: 80 }],
  'Kivi': [{ label: '1 adet', grams: 90 }],
  'Üzüm': [{ label: '15 tane', grams: 75 }],
  'Vişne': [{ label: '15 tane', grams: 80 }],
  'Çilek': [{ label: '12 adet', grams: 150 }],
  'Karpuz': [{ label: '1 dilim (yenen, ~200 g)', grams: 200 }, { label: '1 büyük dilim (yenen)', grams: 300 }],
  'Kavun': [{ label: '1 dilim (yenen, ~170 g)', grams: 170 }, { label: '1 büyük dilim (yenen)', grams: 250 }],
  'Greyfurt': [{ label: '1/2 orta boy', grams: 150 }],
  'İncir (taze)': [{ label: '1–2 adet', grams: 100 }],
  'Erik': [{ label: '10 orta adet', grams: 150 }],
  'Nar (taneleri)': [{ label: '1/2 orta boy', grams: 80 }],
  'Ananas': [{ label: '1 dilim (2 parmak kalın)', grams: 100 }],
  'Ayva': [{ label: '1/2 küçük boy', grams: 100 }],
  'Domates': [{ label: '1 büyük boy', grams: 150 }],
  'Salatalık': [{ label: '2 orta boy', grams: 300 }],
  'Havuç': [{ label: '1 orta boy', grams: 100 }],
  'Mantı (yoğurtlu)': [{ label: '6 yemek kaşığı (1 porsiyon)', grams: 150 }, { label: '1 büyük tabak', grams: 300 }],
  'Tulumba': [{ label: '1 büyük adet', grams: 60 }],
  'Humus': [{ label: '1 yemek kaşığı', grams: 20 }, { label: '2 yemek kaşığı', grams: 40 }],
};

const MEAT = new Set(['Izgara köfte', 'Izgara et / tavuk / balık', 'Tavuk sote']);

/** Yumurta ve saf et gerçek bileşimde de 0 g karbonhidrattır (TürKomp 0,00 g) */
const ZERO_BASE = new Set(['Haşlanmış yumurta', 'Omlet', 'Izgara et / tavuk / balık']);

export const FOODS: Food[] = Object.entries(DATA).flatMap(([category, rows]) =>
  rows.map(([name, carbsPer100, portions, flag]) => ({
    id: slug(`${category}-${name}`),
    name,
    category,
    carbsPer100: ZERO_BASE.has(name) ? 0 : carbsPer100,
    exPer100: EXCHANGE[name],
    meat: MEAT.has(name) || undefined,
    portions: PORTIONS[name] ?? portions,
    fatty: flag === 'fatty' || undefined,
    fast: flag === 'fast' || undefined,
  })),
);

/** Türkçe karakter ve büyük/küçük harf duyarsız arama için */
export function normalize(s: string) {
  return slug(s).replace(/-/g, ' ');
}

/** Seçili yönteme göre 100 g başına karbonhidrat */
export function per100(food: Food, method: CountMethod = 'exchange'): number {
  return method === 'exchange' && food.exPer100 !== undefined ? food.exPer100 : food.carbsPer100;
}

export function carbsFor(food: Food, grams: number, method: CountMethod = 'exchange') {
  return (per100(food, method) * grams) / 100;
}

/** Değişim yönteminde: öğünde toplam 100 g üzeri et varsa +10 g KHO */
export const MEAT_RULE_GRAMS = 100;
export const MEAT_RULE_CARBS = 10;
export function meatRule(items: { meat?: boolean; grams: number }[], method: CountMethod = 'exchange'): number {
  if (method !== 'exchange') return 0;
  const grams = items.reduce((sum, i) => sum + (i.meat ? i.grams : 0), 0);
  return grams > MEAT_RULE_GRAMS ? MEAT_RULE_CARBS : 0;
}
