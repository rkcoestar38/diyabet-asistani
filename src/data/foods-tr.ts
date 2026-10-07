/**
 * Yaklaşık karbonhidrat değerleri. İki sayım yöntemi vardır:
 * - 'composition' (gerçek bileşim): 100 g/ml başına kullanılabilir (lif hariç) karbonhidrat; TürKomp ve etiketlerle uyumlu.
 * - 'exchange' (değişim listesi): 1 ekmek/meyve değişimi = 15 g KHO (süt/yoğurt 1 bardak = 10 g, sebze/et/yumurta/peynir/yağ = 0 g).
 *   Türkiye Beslenme Rehberi (TÜBER 2022) değişim listesine ve hastane eğitiminde kullanılan kurallara göre.
 * Tarif, porsiyon ve markaya göre değişir; paketli ürünlerde her zaman etiketi esas al.
 */
export type CountMethod = 'exchange' | 'composition';

export type PortionCategory = 'boyut' | 'olcu' | 'porsiyon' | 'adet';

export type Portion = {
  label: string;
  grams: number;
  category?: PortionCategory;
  unit?: string;
};

export const PORTION_CATEGORY_LABELS: Record<PortionCategory, string> = {
  boyut: 'Boyut (Küçük / Orta / Büyük)',
  olcu: 'Ev Ölçüsü (Kaşık / Bardak / Kase)',
  porsiyon: 'Porsiyon & Dilim',
  adet: 'Adet & Tane',
};

export function getPortionCategory(p: Portion): PortionCategory {
  if (p.category) return p.category;
  const l = p.label.toLocaleLowerCase('tr-TR');
  if (l.includes('küçük') || l.includes('kucuk') || l.includes('orta') || l.includes('büyük') || l.includes('buyuk') || l.includes('boy')) {
    return 'boyut';
  }
  if (
    l.includes('kaşık') ||
    l.includes('kasik') ||
    l.includes('bardak') ||
    l.includes('kase') ||
    l.includes('avuç') ||
    l.includes('avuc') ||
    l.includes('kepçe') ||
    l.includes('kepce') ||
    l.includes('fincan') ||
    l.includes('kupa')
  ) {
    return 'olcu';
  }
  if (l.includes('porsiyon') || l.includes('tabak') || l.includes('çeyrek') || l.includes('yarım') || l.includes('dilim')) {
    return 'porsiyon';
  }
  return 'adet';
}

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

export const P = (label: string, grams: number, category?: PortionCategory, unit?: string): Portion => ({
  label,
  grams,
  ...(category ? { category } : {}),
  ...(unit ? { unit } : {}),
});

type Row = [name: string, carbsPer100: number, portions: Portion[], flags?: 'fatty' | 'fast'];

const DATA: Record<(typeof CATEGORIES)[number], Row[]> = {
  'Ekmek & Hamur İşi': [
    ['Beyaz ekmek', 50, [P('1 ince dilim', 25, 'boyut', 'dilim'), P('1 dilim', 35, 'boyut', 'dilim'), P('1 kalın dilim', 50, 'boyut', 'dilim')]],
    ['Tam buğday ekmeği', 41, [P('1 ince dilim', 25, 'boyut', 'dilim'), P('1 dilim', 35, 'boyut', 'dilim'), P('1 kalın dilim', 50, 'boyut', 'dilim')]],
    ['Kepekli ekmek', 43, [P('1 ince dilim', 25, 'boyut', 'dilim'), P('1 dilim', 30, 'boyut', 'dilim'), P('1 kalın dilim', 45, 'boyut', 'dilim')]],
    ['Çavdar ekmeği', 45, [P('1 ince dilim', 25, 'boyut', 'dilim'), P('1 dilim', 30, 'boyut', 'dilim'), P('1 kalın dilim', 45, 'boyut', 'dilim')]],
    ['Tost ekmeği', 47, [P('1 dilim', 25, 'adet', 'dilim'), P('2 dilim (1 tostluk)', 50, 'adet', 'dilim')]],
    ['Ramazan pidesi', 52, [P('1 dilim (küçük avuç)', 30, 'boyut', 'dilim'), P('1/4 pide (çeyrek)', 70, 'porsiyon', 'çeyrek'), P('1/2 pide (yarım)', 140, 'porsiyon', 'yarım')]],
    ['Lavaş', 55, [P('1 küçük boy', 35, 'boyut', 'adet'), P('1 standart boy', 60, 'boyut', 'adet'), P('1 büyük boy (dürüm)', 90, 'boyut', 'adet')]],
    ['Bazlama', 50, [P('1/4 adet', 50, 'porsiyon', 'çeyrek'), P('1/2 adet', 100, 'porsiyon', 'yarım'), P('1 tam adet', 200, 'boyut', 'adet')]],
    ['Simit', 55, [P('1/4 adet (çeyrek)', 25, 'porsiyon', 'çeyrek'), P('1/2 adet (yarım)', 50, 'porsiyon', 'yarım'), P('1 tam adet', 100, 'boyut', 'adet')]],
    ['Poğaça (peynirli)', 42, [P('1 küçük adet', 50, 'boyut', 'adet'), P('1 standart adet', 70, 'boyut', 'adet'), P('1 büyük adet', 90, 'boyut', 'adet')], 'fatty'],
    ['Açma', 47, [P('1/2 adet', 40, 'porsiyon', 'yarım'), P('1 standart adet', 80, 'boyut', 'adet')], 'fatty'],
    ['Su böreği', 25, [P('1 küçük dilim', 100, 'boyut', 'dilim'), P('1 porsiyon (standart dilim)', 150, 'porsiyon', 'porsiyon'), P('1 büyük dilim', 200, 'boyut', 'dilim')], 'fatty'],
    ['Sigara böreği', 30, [P('1 adet', 30, 'adet', 'adet'), P('2 adet', 60, 'adet', 'adet'), P('3 adet (1 porsiyon)', 90, 'porsiyon', 'adet')], 'fatty'],
    ['Kol böreği (ıspanaklı)', 30, [P('1 dilim', 100, 'boyut', 'dilim'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Gözleme (peynirli)', 30, [P('1/2 adet', 100, 'porsiyon', 'yarım'), P('1 tam adet', 200, 'boyut', 'adet')], 'fatty'],
    ['Kruvasan', 45, [P('1 küçük adet', 40, 'boyut', 'adet'), P('1 standart adet', 60, 'boyut', 'adet')], 'fatty'],
    ['Galeta', 72, [P('1 adet ince', 10, 'adet', 'adet'), P('1 büyük boy / kalın', 15, 'boyut', 'adet'), P('2 adet', 20, 'adet', 'adet')]],
    ['Grissini', 70, [P('1 adet', 6, 'adet', 'adet'), P('3 adet', 18, 'adet', 'adet'), P('5 adet', 30, 'adet', 'adet')]],
    ['Kaşarlı tost', 30, [P('1 adet tek kat', 100, 'boyut', 'adet'), P('1 standart adet', 150, 'boyut', 'adet')], 'fatty'],
    ['Yulaf ekmeği', 40, [P('1 ince dilim', 25, 'boyut', 'dilim'), P('1 dilim', 35, 'boyut', 'dilim')]],
    ['Hamburger ekmeği', 50, [P('1/2 adet (tek kapak)', 25, 'porsiyon', 'yarım'), P('1 tam adet', 50, 'boyut', 'adet'), P('1 büyük gurme boy', 80, 'boyut', 'adet')]],
    ['Böreklik yufka', 58, [P('1/8 adet', 15, 'porsiyon', 'dilim'), P('1/6 adet', 25, 'porsiyon', 'dilim'), P('1/4 adet', 40, 'porsiyon', 'çeyrek')]],
    ['Tuzlu / diyet bisküvi', 63, [P('1 adet', 6, 'adet', 'adet'), P('4 adet', 25, 'adet', 'adet')]],
    ['Un (buğday / pirinç / bezelye)', 76, [P('1 tatlı kaşığı', 7, 'olcu', 'kaşık'), P('1 yemek kaşığı silme', 10, 'olcu', 'kaşık'), P('3 silme yemek kaşığı', 20, 'olcu', 'kaşık'), P('1 su bardağı', 120, 'olcu', 'bardak')]],
  ],
  'Pilav, Makarna & Tahıl': [
    ['Pirinç pilavı', 30, [P('1 yemek kaşığı', 15, 'olcu', 'kaşık'), P('2 yemek kaşığı tepeleme', 50, 'olcu', 'kaşık'), P('1 kepçe', 100, 'olcu', 'kepçe'), P('1 su bardağı', 140, 'olcu', 'bardak'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Bulgur pilavı', 20, [P('1 yemek kaşığı', 15, 'olcu', 'kaşık'), P('3 yemek kaşığı tepeleme', 75, 'olcu', 'kaşık'), P('1 kepçe', 100, 'olcu', 'kepçe'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Makarna (haşlanmış)', 30, [P('1 yemek kaşığı', 15, 'olcu', 'kaşık'), P('3 yemek kaşığı', 50, 'olcu', 'kaşık'), P('1 kepçe', 80, 'olcu', 'kepçe'), P('1 su bardağı', 120, 'olcu', 'bardak'), P('1 porsiyon', 180, 'porsiyon', 'porsiyon')]],
    ['Tam buğday makarna (haşlanmış)', 26, [P('1 kepçe', 80, 'olcu', 'kepçe'), P('1 su bardağı', 120, 'olcu', 'bardak'), P('1 porsiyon', 180, 'porsiyon', 'porsiyon')]],
    ['Erişte (haşlanmış)', 28, [P('3 yemek kaşığı', 50, 'olcu', 'kaşık'), P('1 kepçe', 80, 'olcu', 'kepçe'), P('1 porsiyon', 180, 'porsiyon', 'porsiyon')]],
    ['Şehriye pilavı', 30, [P('2 yemek kaşığı tepeleme', 50, 'olcu', 'kaşık'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Kuskus (pişmiş)', 23, [P('3 yemek kaşığı', 65, 'olcu', 'kaşık'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Yulaf ezmesi (kuru)', 60, [P('1 yemek kaşığı', 10, 'olcu', 'kaşık'), P('2 yemek kaşığı dolusu', 25, 'olcu', 'kaşık'), P('1 çay bardağı', 30, 'olcu', 'bardak'), P('1 kase', 40, 'olcu', 'kase')]],
    ['Mısır gevreği', 84, [P('3 yemek kaşığı', 20, 'olcu', 'kaşık'), P('1 kase (standart)', 30, 'olcu', 'kase'), P('1 büyük kase', 50, 'olcu', 'kase')]],
    ['Granola', 64, [P('2 yemek kaşığı', 25, 'olcu', 'kaşık'), P('1 kase', 50, 'olcu', 'kase')]],
    ['Müsli', 66, [P('2 yemek kaşığı', 25, 'olcu', 'kaşık'), P('1 kase', 50, 'olcu', 'kase')]],
    ['Haşlanmış patates', 17, [P('1 küçük boy', 90, 'boyut', 'adet'), P('1 orta boy', 150, 'boyut', 'adet'), P('1 büyük boy', 220, 'boyut', 'adet'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Fırın patates', 20, [P('1 küçük porsiyon', 100, 'boyut', 'porsiyon'), P('1 orta boy', 150, 'boyut', 'adet'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Patates püresi', 15, [P('1 kepçe', 80, 'olcu', 'kepçe'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Haşlanmış mısır', 19, [P('1 küçük koçan (yenen)', 90, 'boyut', 'adet'), P('1 orta boy koçan (yenen)', 120, 'boyut', 'adet')]],
    ['Patlamış mısır', 74, [P('1 küçük kase', 10, 'boyut', 'kase'), P('3 su bardağı dolusu', 25, 'olcu', 'bardak'), P('1 büyük kase', 40, 'boyut', 'kase')]],
    ['Kuru fasulye / nohut / kuru barbunya (kuru)', 58, [P('3 yemek kaşığı dolusu', 25, 'olcu', 'kaşık'), P('1 çay bardağı', 60, 'olcu', 'bardak')]],
    ['Yeşil mercimek (kuru)', 55, [P('2 yemek kaşığı dolusu', 25, 'olcu', 'kaşık'), P('1 çay bardağı', 60, 'olcu', 'bardak')]],
    ['Yarma (aşurelik buğday)', 68, [P('3 yemek kaşığı dolusu', 25, 'olcu', 'kaşık')]],
    ['Kestane', 38, [P('2 orta boy', 20, 'boyut', 'adet'), P('4 orta boy', 40, 'boyut', 'adet'), P('6 büyük boy', 70, 'boyut', 'adet')]],
    ['Bardak mısır (yağsız)', 17, [P('4 yemek kaşığı taneli', 90, 'olcu', 'kaşık'), P('1 küçük bardak', 100, 'boyut', 'bardak'), P('1 büyük bardak', 180, 'boyut', 'bardak')]],
  ],
  'Çorbalar': [
    ['Mercimek çorbası', 8, [P('1 kepçe', 75, 'olcu', 'kepçe'), P('1 küçük kase (150 ml)', 150, 'olcu', 'kase'), P('1 standart kase (200 ml)', 200, 'olcu', 'kase'), P('1 büyük kase (250 ml)', 250, 'porsiyon', 'kase')]],
    ['Ezogelin çorbası', 9, [P('1 kepçe', 75, 'olcu', 'kepçe'), P('1 küçük kase (150 ml)', 150, 'olcu', 'kase'), P('1 standart kase (200 ml)', 200, 'olcu', 'kase'), P('1 büyük kase (250 ml)', 250, 'porsiyon', 'kase')]],
    ['Tarhana çorbası', 7, [P('1 kepçe', 75, 'olcu', 'kepçe'), P('1 küçük kase (150 ml)', 150, 'olcu', 'kase'), P('1 standart kase (200 ml)', 200, 'olcu', 'kase'), P('1 büyük kase (250 ml)', 250, 'porsiyon', 'kase')]],
    ['Yayla çorbası', 6, [P('1 kepçe', 75, 'olcu', 'kepçe'), P('1 küçük kase (150 ml)', 150, 'olcu', 'kase'), P('1 standart kase (200 ml)', 200, 'olcu', 'kase'), P('1 büyük kase (250 ml)', 250, 'porsiyon', 'kase')]],
    ['Domates çorbası', 7, [P('1 kepçe', 75, 'olcu', 'kepçe'), P('1 küçük kase (150 ml)', 150, 'olcu', 'kase'), P('1 standart kase (200 ml)', 200, 'olcu', 'kase'), P('1 büyük kase (250 ml)', 250, 'porsiyon', 'kase')]],
    ['Tavuk şehriye çorbası', 5, [P('1 kepçe', 75, 'olcu', 'kepçe'), P('1 küçük kase (150 ml)', 150, 'olcu', 'kase'), P('1 standart kase (200 ml)', 200, 'olcu', 'kase'), P('1 büyük kase (250 ml)', 250, 'porsiyon', 'kase')]],
    ['Sebze çorbası', 5, [P('1 kepçe', 75, 'olcu', 'kepçe'), P('1 kase', 250, 'olcu', 'kase')]],
    ['İşkembe çorbası', 2, [P('1 kepçe', 75, 'olcu', 'kepçe'), P('1 kase', 250, 'olcu', 'kase')]],
    ['Şehriye çorbası', 6, [P('1 kepçe', 75, 'olcu', 'kepçe'), P('1 küçük kase (150 ml)', 150, 'olcu', 'kase'), P('1 kase (250 ml)', 250, 'olcu', 'kase')]],
    ['Pirinç çorbası', 7, [P('1 kepçe', 75, 'olcu', 'kepçe'), P('1 küçük kase (150 ml)', 150, 'olcu', 'kase'), P('1 kase (250 ml)', 250, 'olcu', 'kase')]],
  ],
  'Ana Yemekler': [
    ['Kuru fasulye', 13, [P('4 yemek kaşığı', 100, 'olcu', 'kaşık'), P('1 porsiyon', 200, 'porsiyon', 'porsiyon')]],
    ['Nohut yemeği', 15, [P('4 yemek kaşığı', 100, 'olcu', 'kaşık'), P('1 porsiyon', 200, 'porsiyon', 'porsiyon')]],
    ['Barbunya pilaki', 12, [P('4 yemek kaşığı', 100, 'olcu', 'kaşık'), P('1 porsiyon', 200, 'porsiyon', 'porsiyon')]],
    ['Yeşil mercimek yemeği', 12, [P('4 yemek kaşığı', 100, 'olcu', 'kaşık'), P('1 porsiyon', 200, 'porsiyon', 'porsiyon')]],
    ['Etli taze fasulye', 5, [P('1 porsiyon', 200, 'porsiyon', 'porsiyon')]],
    ['Zeytinyağlı taze fasulye', 6, [P('1 porsiyon', 200, 'porsiyon', 'porsiyon')]],
    ['Karnıyarık', 7, [P('1 küçük adet', 180, 'boyut', 'adet'), P('1 standart adet', 250, 'boyut', 'adet')], 'fatty'],
    ['İmam bayıldı', 8, [P('1 küçük adet', 150, 'boyut', 'adet'), P('1 standart adet', 200, 'boyut', 'adet')], 'fatty'],
    ['Türlü', 7, [P('1 porsiyon', 250, 'porsiyon', 'porsiyon')]],
    ['Zeytinyağlı yaprak sarma', 22, [P('1 adet', 20, 'adet', 'adet'), P('4 adet (1 ekmek değişimi)', 80, 'adet', 'adet'), P('7–8 adet (1 porsiyon)', 150, 'porsiyon', 'porsiyon')]],
    ['Biber dolması (etli)', 12, [P('1 küçük adet', 80, 'boyut', 'adet'), P('1 standart adet', 120, 'boyut', 'adet'), P('1 büyük adet', 160, 'boyut', 'adet')]],
    ['Kıymalı ıspanak', 4, [P('1 porsiyon', 200, 'porsiyon', 'porsiyon')]],
    ['Menemen', 5, [P('1 küçük porsiyon', 120, 'boyut', 'porsiyon'), P('1 porsiyon', 200, 'porsiyon', 'porsiyon')]],
    ['Omlet', 1, [P('1 yumurtalı', 60, 'boyut', 'adet'), P('2 yumurtalı', 120, 'boyut', 'adet')]],
    ['Haşlanmış yumurta', 1, [P('1 küçük boy (S)', 45, 'boyut', 'adet'), P('1 orta boy (M)', 50, 'boyut', 'adet'), P('1 büyük boy (L)', 60, 'boyut', 'adet')]],
    ['Izgara köfte', 6, [P('1 misket / küçük adet', 15, 'boyut', 'adet'), P('1 standart adet', 30, 'boyut', 'adet'), P('1 büyük adet (kasap)', 50, 'boyut', 'adet'), P('1 porsiyon (5-6 adet)', 180, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Izgara et / tavuk / balık', 0, [P('1 küçük porsiyon', 100, 'boyut', 'porsiyon'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon'), P('1 büyük porsiyon', 200, 'boyut', 'porsiyon')]],
    ['Tavuk sote', 4, [P('1 porsiyon', 200, 'porsiyon', 'porsiyon')]],
    ['Hünkar beğendi', 10, [P('1 porsiyon', 300, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Musakka', 8, [P('1 porsiyon', 250, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Mantı (yoğurtlu)', 20, [P('6 yemek kaşığı (1 küçük porsiyon)', 150, 'olcu', 'kaşık'), P('1 standart tabak (1 porsiyon)', 250, 'porsiyon', 'porsiyon'), P('1 büyük tabak', 300, 'boyut', 'porsiyon')], 'fatty'],
    ['İçli köfte', 25, [P('1 küçük adet', 50, 'boyut', 'adet'), P('1 standart adet', 70, 'boyut', 'adet'), P('1 büyük adet', 90, 'boyut', 'adet')], 'fatty'],
    ['Mercimek köftesi', 25, [P('1 adet / sıkım', 30, 'adet', 'adet'), P('3 adet', 90, 'adet', 'adet'), P('5 adet (1 porsiyon)', 150, 'porsiyon', 'adet')]],
    ['Sebze yemeğindeki pirinç / bulgur (kaşık sayısı)', 450, [P('1 yemek kaşığı', 1, 'olcu', 'kaşık')]],
  ],
  'Fast Food & Sokak': [
    ['Lahmacun', 35, [P('1 adet', 120, 'adet', 'adet'), P('1 küçük / fındık lahmacun', 60, 'boyut', 'adet'), P('1 büyük boy', 160, 'boyut', 'adet')], 'fatty'],
    ['Kıymalı / kaşarlı pide', 30, [P('1/4 adet (çeyrek)', 65, 'porsiyon', 'çeyrek'), P('1/2 adet (yarım)', 125, 'porsiyon', 'yarım'), P('1 tam adet', 250, 'boyut', 'adet')], 'fatty'],
    ['Pizza', 30, [P('1 küçük dilim', 70, 'boyut', 'dilim'), P('1 standart dilim', 110, 'boyut', 'dilim'), P('1 büyük dilim', 150, 'boyut', 'dilim')], 'fatty'],
    ['Hamburger', 25, [P('1 adet', 220, 'adet', 'adet'), P('1 küçük boy (junior)', 150, 'boyut', 'adet'), P('1 büyük boy / double', 320, 'boyut', 'adet')], 'fatty'],
    ['Islak hamburger', 30, [P('1 adet', 120, 'adet', 'adet'), P('2 adet', 240, 'adet', 'adet')], 'fatty'],
    ['Tavuk döner dürüm', 22, [P('1 adet', 300, 'adet', 'adet'), P('1 küçük boy (yarım)', 180, 'boyut', 'adet'), P('1 tombik ekmek arası', 250, 'boyut', 'adet')], 'fatty'],
    ['Döner ekmek arası', 25, [P('1 çeyrek ekmek döner', 150, 'porsiyon', 'çeyrek'), P('1 yarım ekmek döner', 300, 'porsiyon', 'yarım'), P('1 tam ekmek döner', 600, 'boyut', 'adet')], 'fatty'],
    ['İskender', 15, [P('1 porsiyon', 400, 'porsiyon', 'porsiyon'), P('1.5 porsiyon', 600, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Tantuni dürüm', 25, [P('1 adet standart', 250, 'boyut', 'adet'), P('1 çift lavaş tantuni', 320, 'boyut', 'adet')], 'fatty'],
    ['Kumpir', 20, [P('1 sade/orta kumpir', 350, 'boyut', 'adet'), P('1 standart bol malzemeli kumpir', 450, 'boyut', 'adet')], 'fatty'],
    ['Patates kızartması', 35, [P('1 küçük boy paket', 80, 'boyut', 'porsiyon'), P('1 orta boy paket (1 porsiyon)', 120, 'boyut', 'porsiyon'), P('1 büyük boy paket', 160, 'boyut', 'porsiyon')], 'fatty'],
    ['Çiğ köfte (köftesi)', 33, [P('1 parmak / sıkım', 20, 'adet', 'adet'), P('5 sıkım', 100, 'adet', 'adet')]],
    ['Çiğ köfte dürüm', 35, [P('1 küçük adet', 160, 'boyut', 'adet'), P('1 standart adet', 220, 'boyut', 'adet'), P('1 mega dürüm', 300, 'boyut', 'adet')]],
    ['Midye dolma', 20, [P('1 küçük adet', 12, 'boyut', 'adet'), P('1 standart adet', 18, 'boyut', 'adet'), P('5 adet', 90, 'adet', 'adet')]],
    ['Balık ekmek', 25, [P('1/2 ekmek arası', 300, 'porsiyon', 'yarım')]],
    ['Kokoreç (yarım ekmek)', 15, [P('1/4 ekmek (çeyrek)', 150, 'porsiyon', 'çeyrek'), P('1/2 ekmek (yarım)', 300, 'porsiyon', 'yarım')], 'fatty'],
  ],
  'Salata & Meze': [
    ['Çoban / yeşil salata', 4, [P('1 küçük kase', 100, 'boyut', 'kase'), P('1 standart kase', 150, 'olcu', 'kase'), P('1 büyük kase', 250, 'boyut', 'kase')]],
    ['Kısır', 22, [P('2 yemek kaşığı', 50, 'olcu', 'kaşık'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Humus', 14, [P('1 tatlı kaşığı', 10, 'olcu', 'kaşık'), P('1 yemek kaşığı', 20, 'olcu', 'kaşık'), P('2 yemek kaşığı', 40, 'olcu', 'kaşık')]],
    ['Cacık', 4, [P('1 çay bardağı', 100, 'olcu', 'bardak'), P('1 standart kase', 200, 'olcu', 'kase')]],
    ['Haydari', 4, [P('1 yemek kaşığı', 20, 'olcu', 'kaşık'), P('1 porsiyon', 100, 'porsiyon', 'porsiyon')]],
    ['Acılı ezme', 8, [P('1 yemek kaşığı', 20, 'olcu', 'kaşık'), P('1 porsiyon', 100, 'porsiyon', 'porsiyon')]],
    ['Patates salatası', 15, [P('2 yemek kaşığı', 60, 'olcu', 'kaşık'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Rus salatası', 10, [P('1 yemek kaşığı', 30, 'olcu', 'kaşık'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
  ],
  'Kahvaltılık': [
    ['Beyaz peynir', 1, [P('1 ince dilim (kibrit kutusu)', 30, 'boyut', 'dilim'), P('1 orta dilim', 50, 'boyut', 'dilim'), P('1 kalın dilim', 75, 'boyut', 'dilim')]],
    ['Kaşar peyniri', 1, [P('1 ince dilim', 20, 'boyut', 'dilim'), P('1 orta dilim', 30, 'boyut', 'dilim'), P('1 yemek kaşığı rendelenmiş', 15, 'olcu', 'kaşık')]],
    ['Zeytin', 4, [P('1 adet', 4, 'adet', 'adet'), P('5 adet (1 küçük porsiyon)', 20, 'olcu', 'adet'), P('10 adet', 40, 'olcu', 'adet')]],
    ['Bal', 82, [P('1 çay kaşığı', 5, 'olcu', 'kaşık'), P('1 tatlı kaşığı', 10, 'olcu', 'kaşık'), P('1 yemek kaşığı', 20, 'olcu', 'kaşık')]],
    ['Reçel', 65, [P('1 çay kaşığı', 5, 'olcu', 'kaşık'), P('1 tatlı kaşığı', 10, 'olcu', 'kaşık'), P('1 yemek kaşığı', 20, 'olcu', 'kaşık')]],
    ['Pekmez', 75, [P('1 tatlı kaşığı', 10, 'olcu', 'kaşık'), P('1 yemek kaşığı', 20, 'olcu', 'kaşık')]],
    ['Tahin', 21, [P('1 tatlı kaşığı', 8, 'olcu', 'kaşık'), P('1 yemek kaşığı', 15, 'olcu', 'kaşık')]],
    ['Kakaolu fındık kreması', 57, [P('1 tatlı kaşığı', 15, 'olcu', 'kaşık'), P('1 yemek kaşığı', 30, 'olcu', 'kaşık')], 'fatty'],
    ['Fıstık ezmesi', 20, [P('1 tatlı kaşığı', 10, 'olcu', 'kaşık'), P('1 yemek kaşığı', 15, 'olcu', 'kaşık')]],
    ['Krem peynir', 4, [P('1 tatlı kaşığı', 10, 'olcu', 'kaşık'), P('1 yemek kaşığı', 20, 'olcu', 'kaşık')]],
    ['Lor peyniri', 3, [P('1 yemek kaşığı', 25, 'olcu', 'kaşık'), P('1 çay bardağı', 60, 'olcu', 'bardak')]],
    ['Tulum peyniri', 1, [P('1 dilim', 30, 'boyut', 'dilim')]],
    ['Zeytinyağı / sıvı yağ', 0, [P('1 tatlı kaşığı', 5, 'olcu', 'kaşık'), P('1 yemek kaşığı', 10, 'olcu', 'kaşık')]],
    ['Sucuk', 2, [P('3 ince dilim', 30, 'adet', 'dilim'), P('5 dilim', 50, 'adet', 'dilim')]],
    ['Domates', 4, [P('1 ince dilim', 30, 'boyut', 'dilim'), P('1 küçük boy', 80, 'boyut', 'adet'), P('1 orta boy', 120, 'boyut', 'adet'), P('1 büyük boy', 180, 'boyut', 'adet')]],
    ['Salatalık', 3, [P('1 küçük boy', 70, 'boyut', 'adet'), P('1 orta boy', 120, 'boyut', 'adet'), P('1 büyük boy', 180, 'boyut', 'adet')]],
  ],
  'Süt & İçecekler': [
    ['Süt', 4.8, [P('1 çay bardağı (100 ml)', 100, 'olcu', 'bardak'), P('1 su bardağı (200 ml)', 200, 'olcu', 'bardak'), P('1 büyük kupa (250 ml)', 250, 'olcu', 'kupa')]],
    ['Yoğurt', 4.5, [P('1 yemek kaşığı', 30, 'olcu', 'kaşık'), P('1 çay bardağı (100 ml)', 100, 'olcu', 'bardak'), P('1 standart kase (200 ml)', 200, 'olcu', 'kase'), P('1 büyük kase (300 ml)', 300, 'olcu', 'kase')]],
    ['Süzme yoğurt', 4, [P('2 yemek kaşığı', 60, 'olcu', 'kaşık'), P('1 kase', 150, 'olcu', 'kase')]],
    ['Meyveli yoğurt', 14, [P('1 kutu (küçük)', 125, 'boyut', 'adet'), P('1 büyük kutu', 200, 'boyut', 'adet')]],
    ['Ayran', 3, [P('1 küçük kutu / bardak (175 ml)', 175, 'boyut', 'bardak'), P('1 kutu / su bardağı (200 ml)', 200, 'olcu', 'bardak'), P('1 büyük bardak (300 ml)', 300, 'boyut', 'bardak')]],
    ['Kefir', 4.5, [P('1 çay bardağı (100 ml)', 100, 'olcu', 'bardak'), P('1 su bardağı (200 ml)', 200, 'olcu', 'bardak')]],
    ['Kola (normal)', 10.6, [P('1 su bardağı (200 ml)', 200, 'olcu', 'bardak'), P('1 kutu (330 ml)', 330, 'adet', 'kutu')], 'fast'],
    ['Gazoz', 10, [P('1 su bardağı (200 ml)', 200, 'olcu', 'bardak'), P('1 kutu (330 ml)', 330, 'adet', 'kutu')], 'fast'],
    ['Portakal suyu', 10, [P('1 çay bardağı (100 ml)', 100, 'olcu', 'bardak'), P('1 su bardağı (200 ml)', 200, 'olcu', 'bardak')], 'fast'],
    ['Vişne / şeftali nektarı', 13, [P('1 çay bardağı (100 ml)', 100, 'olcu', 'bardak'), P('1 su bardağı (200 ml)', 200, 'olcu', 'bardak'), P('1 kutu (200 ml)', 200, 'adet', 'kutu')], 'fast'],
    ['Limonata', 10, [P('1 su bardağı (200 ml)', 200, 'olcu', 'bardak'), P('1 büyük bardak (300 ml)', 300, 'olcu', 'bardak')]],
    ['Soğuk çay (ice tea)', 7, [P('1 su bardağı (200 ml)', 200, 'olcu', 'bardak'), P('1 kutu (330 ml)', 330, 'adet', 'kutu')]],
    ['Şekersiz / zero içecekler', 0, [P('1 su bardağı (200 ml)', 200, 'olcu', 'bardak'), P('1 kutu (330 ml)', 330, 'adet', 'kutu')]],
    ['Salep', 15, [P('1 standart kupa (250 ml)', 250, 'olcu', 'kupa')]],
    ['Sıcak çikolata', 11, [P('1 fincan / kupa (250 ml)', 250, 'olcu', 'kupa')]],
    ['Boza', 20, [P('1 çay bardağı (100 ml)', 100, 'olcu', 'bardak'), P('1 su bardağı (200 ml)', 200, 'olcu', 'bardak')]],
    ['Bira', 3.6, [P('1 kutu (330 ml)', 330, 'adet', 'kutu'), P('1 şişe (500 ml)', 500, 'adet', 'şişe')]],
  ],
  'Meyveler': [
    ['Elma', 12, [P('1 dilim', 25, 'porsiyon', 'dilim'), P('1 küçük boy', 100, 'boyut', 'adet'), P('1 orta boy', 140, 'boyut', 'adet'), P('1 büyük boy', 190, 'boyut', 'adet')]],
    ['Armut', 12, [P('1 küçük boy', 120, 'boyut', 'adet'), P('1 orta boy', 160, 'boyut', 'adet'), P('1 büyük boy', 210, 'boyut', 'adet')]],
    ['Muz', 20, [P('1 dilim', 15, 'porsiyon', 'dilim'), P('1 küçük boy (soyulmuş)', 80, 'boyut', 'adet'), P('1 orta boy (soyulmuş)', 120, 'boyut', 'adet'), P('1 büyük boy (soyulmuş)', 160, 'boyut', 'adet')]],
    ['Portakal', 9, [P('1 küçük boy', 100, 'boyut', 'adet'), P('1 orta boy', 150, 'boyut', 'adet'), P('1 büyük boy', 200, 'boyut', 'adet')]],
    ['Mandalina', 10, [P('1 küçük boy', 50, 'boyut', 'adet'), P('1 orta boy', 80, 'boyut', 'adet'), P('1 büyük boy', 110, 'boyut', 'adet')]],
    ['Greyfurt', 7, [P('1/2 orta boy', 150, 'boyut', 'yarım'), P('1 tam adet', 300, 'boyut', 'adet')]],
    ['Üzüm', 16, [P('10 tane', 50, 'adet', 'adet'), P('15–20 tane (1 çay bardağı)', 75, 'olcu', 'bardak'), P('1 su bardağı', 150, 'olcu', 'bardak')]],
    ['Kiraz', 14, [P('5 adet', 35, 'adet', 'adet'), P('10–12 büyük adet', 80, 'adet', 'adet'), P('1 su bardağı', 140, 'olcu', 'bardak')]],
    ['Vişne', 11, [P('15 tane', 80, 'adet', 'adet'), P('1 su bardağı', 150, 'olcu', 'bardak')]],
    ['Çilek', 6, [P('1 orta adet', 15, 'adet', 'adet'), P('1 çay bardağı', 80, 'olcu', 'bardak'), P('1 kase / su bardağı', 150, 'olcu', 'kase')]],
    ['Karpuz', 7, [P('1 ince / küçük dilim (yenen)', 150, 'boyut', 'dilim'), P('1 orta dilim (yenen)', 250, 'boyut', 'dilim'), P('1 büyük dilim (yenen)', 350, 'boyut', 'dilim'), P('1 kase küp doğranmış', 200, 'olcu', 'kase')]],
    ['Kavun', 7, [P('1 ince / küçük dilim', 120, 'boyut', 'dilim'), P('1 standart dilim', 200, 'boyut', 'dilim'), P('1 büyük dilim', 300, 'boyut', 'dilim'), P('1 kase küp doğranmış', 180, 'olcu', 'kase')]],
    ['Şeftali', 9, [P('1 küçük boy', 100, 'boyut', 'adet'), P('1 orta boy', 150, 'boyut', 'adet'), P('1 büyük boy', 210, 'boyut', 'adet')]],
    ['Kayısı', 9, [P('1 adet orta', 30, 'boyut', 'adet'), P('3-4 adet orta (1 porsiyon)', 100, 'porsiyon', 'adet')]],
    ['Erik', 10, [P('1 adet mürdüm', 30, 'boyut', 'adet'), P('5 adet yeşil erik', 75, 'adet', 'adet'), P('10 adet orta yeşil erik', 150, 'olcu', 'adet')]],
    ['İncir (taze)', 16, [P('1 küçük adet', 40, 'boyut', 'adet'), P('1 orta adet', 60, 'boyut', 'adet'), P('1 büyük adet', 80, 'boyut', 'adet')]],
    ['Nar (taneleri)', 14, [P('2 yemek kaşığı', 30, 'olcu', 'kaşık'), P('1/2 orta boy nar (tane)', 80, 'boyut', 'adet'), P('1 kase tane', 150, 'olcu', 'kase')]],
    ['Kivi', 10, [P('1 küçük boy', 65, 'boyut', 'adet'), P('1 orta boy', 85, 'boyut', 'adet'), P('1 büyük boy', 110, 'boyut', 'adet')]],
    ['Ananas', 12, [P('1 ince dilim', 60, 'boyut', 'dilim'), P('1 standart dilim (2 parmak kalın)', 100, 'boyut', 'dilim')]],
    ['Ayva', 13, [P('1/4 adet (çeyrek)', 60, 'porsiyon', 'çeyrek'), P('1/2 küçük boy', 100, 'boyut', 'yarım'), P('1 orta boy', 200, 'boyut', 'adet')]],
    ['Dut', 10, [P('1 çay bardağı', 70, 'olcu', 'bardak'), P('1 kase', 140, 'olcu', 'kase')]],
    ['Böğürtlen / ahududu', 5, [P('1 çay bardağı', 70, 'olcu', 'bardak'), P('1 kase', 125, 'olcu', 'kase')]],
    ['Avokado', 2, [P('1/4 adet', 40, 'porsiyon', 'çeyrek'), P('1/2 adet', 70, 'porsiyon', 'yarım'), P('1 tam adet', 140, 'boyut', 'adet')]],
    ['Hurma (kuru)', 66, [P('1 küçük adet', 8, 'boyut', 'adet'), P('1 büyük Medine hurması', 15, 'boyut', 'adet'), P('2–3 adet hurma', 25, 'adet', 'adet')], 'fast'],
    ['Kuru üzüm', 70, [P('1 tatlı kaşığı', 5, 'olcu', 'kaşık'), P('1 yemek kaşığı', 10, 'olcu', 'kaşık'), P('2 yemek kaşığı (1 avuç)', 20, 'olcu', 'avuç')], 'fast'],
    ['Kuru kayısı', 50, [P('1 adet orta', 8, 'boyut', 'adet'), P('3 adet (1 porsiyon)', 25, 'porsiyon', 'adet')]],
    ['Kuru incir', 55, [P('1 küçük adet', 15, 'boyut', 'adet'), P('1 büyük adet', 25, 'boyut', 'adet')]],
    ['Kuru dut', 65, [P('1 yemek kaşığı', 8, 'olcu', 'kaşık'), P('2 yemek kaşığı (1 porsiyon)', 20, 'olcu', 'kaşık')]],
  ],
  'Kuruyemiş': [
    ['Fındık', 7, [P('1 tatlı kaşığı', 8, 'olcu', 'kaşık'), P('1 yemek kaşığı', 15, 'olcu', 'kaşık'), P('1 küçük avuç', 20, 'boyut', 'avuç'), P('1 avuç', 30, 'boyut', 'avuç')]],
    ['Ceviz', 7, [P('2 adet tam (4 yarım)', 15, 'adet', 'adet'), P('1 avuç (yaklaşık 8 yarım)', 30, 'boyut', 'avuç')]],
    ['Badem', 9, [P('10 adet', 15, 'adet', 'adet'), P('1 küçük avuç', 20, 'boyut', 'avuç'), P('1 avuç (yaklaşık 20 adet)', 30, 'boyut', 'avuç')]],
    ['Antep fıstığı', 18, [P('15 adet içi', 15, 'adet', 'adet'), P('1 avuç', 30, 'boyut', 'avuç')]],
    ['Kaju', 27, [P('10 adet', 15, 'adet', 'adet'), P('1 avuç', 30, 'boyut', 'avuç')]],
    ['Leblebi', 50, [P('1 yemek kaşığı', 10, 'olcu', 'kaşık'), P('1/2 çay bardağı', 25, 'olcu', 'bardak'), P('1 avuç', 30, 'boyut', 'avuç')]],
    ['Ay çekirdeği (iç)', 12, [P('1 yemek kaşığı', 10, 'olcu', 'kaşık'), P('1 avuç', 30, 'boyut', 'avuç')]],
  ],
  'Tatlılar & Atıştırmalık': [
    ['Baklava', 50, [P('1 küçük dilim', 35, 'boyut', 'dilim'), P('1 standart dilim', 40, 'boyut', 'dilim'), P('2 dilim (1 porsiyon)', 80, 'porsiyon', 'dilim')], 'fatty'],
    ['Künefe', 35, [P('1/2 porsiyon', 75, 'porsiyon', 'yarım'), P('1 tam porsiyon', 150, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Tel kadayıf', 50, [P('1 dilim', 80, 'boyut', 'dilim'), P('1 büyük dilim', 120, 'boyut', 'dilim')], 'fatty'],
    ['Revani', 50, [P('1 küçük dilim', 60, 'boyut', 'dilim'), P('1 dilim', 80, 'boyut', 'dilim'), P('1 büyük dilim', 120, 'boyut', 'dilim')]],
    ['Şekerpare', 55, [P('1 küçük adet', 30, 'boyut', 'adet'), P('1 adet', 40, 'boyut', 'adet'), P('2 adet', 80, 'adet', 'adet')]],
    ['Tulumba', 50, [P('1 küçük adet', 15, 'boyut', 'adet'), P('1 standart adet', 25, 'boyut', 'adet'), P('1 büyük boy adet', 60, 'boyut', 'adet')], 'fatty'],
    ['Lokma', 50, [P('1 adet', 15, 'adet', 'adet'), P('4 adet (1 porsiyon)', 60, 'porsiyon', 'adet')], 'fatty'],
    ['Sütlaç', 20, [P('1/2 kase', 100, 'porsiyon', 'yarım'), P('1 standart kase', 200, 'olcu', 'kase')], 'fatty'],
    ['Kazandibi', 25, [P('1 küçük porsiyon', 100, 'boyut', 'porsiyon'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Muhallebi', 18, [P('1 küçük kase', 100, 'boyut', 'kase'), P('1 kase', 150, 'olcu', 'kase')]],
    ['Tavuk göğsü', 22, [P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Keşkül', 18, [P('1 kase', 150, 'olcu', 'kase')]],
    ['Aşure', 25, [P('1 küçük kase', 120, 'boyut', 'kase'), P('1 kase', 200, 'olcu', 'kase')]],
    ['Güllaç', 22, [P('1 dilim', 150, 'boyut', 'dilim')]],
    ['Lokum', 85, [P('1 küçük adet', 10, 'boyut', 'adet'), P('1 standart adet', 15, 'boyut', 'adet')], 'fast'],
    ['Tahin helvası', 55, [P('1 ince dilim', 25, 'boyut', 'dilim'), P('1 dilim', 40, 'boyut', 'dilim')], 'fatty'],
    ['İrmik helvası', 45, [P('2 yemek kaşığı', 50, 'olcu', 'kaşık'), P('1 porsiyon', 100, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Dondurma', 24, [P('1 top', 50, 'adet', 'adet'), P('2 top', 100, 'adet', 'adet')], 'fatty'],
    ['Puding', 20, [P('1 küçük kase', 100, 'boyut', 'kase'), P('1 kase', 150, 'olcu', 'kase')]],
    ['Kek', 50, [P('1 ince dilim', 40, 'boyut', 'dilim'), P('1 dilim', 60, 'boyut', 'dilim'), P('1 büyük dilim', 90, 'boyut', 'dilim')], 'fatty'],
    ['Yaş pasta', 40, [P('1 küçük dilim', 80, 'boyut', 'dilim'), P('1 standart dilim', 120, 'boyut', 'dilim'), P('1 büyük dilim', 160, 'boyut', 'dilim')], 'fatty'],
    ['Profiterol', 30, [P('1 küçük kase (3 top)', 100, 'boyut', 'kase'), P('1 porsiyon (5 top)', 150, 'porsiyon', 'kase')], 'fatty'],
    ['Cheesecake', 25, [P('1 dilim', 120, 'boyut', 'dilim')], 'fatty'],
    ['Kurabiye', 60, [P('1 küçük adet', 15, 'boyut', 'adet'), P('1 standart adet', 25, 'boyut', 'adet')], 'fatty'],
    ['Bisküvi (sade)', 70, [P('1 adet', 8, 'adet', 'adet'), P('4 adet', 32, 'adet', 'adet')]],
    ['Gofret', 60, [P('1 küçük boy', 25, 'boyut', 'adet'), P('1 standart paket', 35, 'boyut', 'adet')], 'fatty'],
    ['Sütlü çikolata', 55, [P('1 kare', 5, 'adet', 'kare'), P('4 kare / 1 satır', 20, 'adet', 'kare'), P('1 tablet paket', 80, 'boyut', 'paket')], 'fatty'],
    ['Bitter çikolata (%70)', 35, [P('1 kare', 5, 'adet', 'kare'), P('4 kare / 1 satır', 20, 'adet', 'kare')], 'fatty'],
    ['Cips', 50, [P('1 küçük paket', 40, 'boyut', 'paket'), P('1 büyük paket', 100, 'boyut', 'paket')], 'fatty'],
  ],
  'Sebzeler': [
    ['Havuç', 7, [P('1 küçük boy', 50, 'boyut', 'adet'), P('1 orta boy', 80, 'boyut', 'adet'), P('1 büyük boy', 120, 'boyut', 'adet'), P('1 kase rendelenmiş', 100, 'olcu', 'kase')]],
    ['Bezelye', 10, [P('3 yemek kaşığı', 60, 'olcu', 'kaşık'), P('1 porsiyon', 100, 'porsiyon', 'porsiyon')]],
    ['Kırmızı pancar', 8, [P('1 küçük boy', 60, 'boyut', 'adet'), P('1 porsiyon', 100, 'porsiyon', 'porsiyon')]],
    ['Brokoli / karnabahar', 3, [P('1 kase haşlanmış', 100, 'olcu', 'kase'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Kabak', 3, [P('1 orta boy', 150, 'boyut', 'adet'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Patlıcan', 3, [P('1 orta boy', 150, 'boyut', 'adet'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
  ],
  'Hipo İçin': [
    ['Glukoz tableti (etiketi kontrol et)', 90, [P('1 tablet', 4, 'adet', 'tablet'), P('3 tablet', 12, 'adet', 'tablet'), P('4 tablet', 16, 'adet', 'tablet')], 'fast'],
    ['Küp şeker', 100, [P('1 adet', 3, 'adet', 'adet'), P('3 adet', 9, 'adet', 'adet'), P('4 adet (12 g)', 12, 'adet', 'adet'), P('5 adet (15 g kuralı)', 15, 'adet', 'adet')], 'fast'],
    ['Toz şeker', 100, [P('1 çay kaşığı', 3, 'olcu', 'kaşık'), P('1 tatlı kaşığı', 5, 'olcu', 'kaşık'), P('1 yemek kaşığı', 12, 'olcu', 'kaşık')], 'fast'],
    ['Meyve suyu (hipo için)', 11, [P('1 çay bardağı (100 ml)', 100, 'olcu', 'bardak'), P('150 ml (ideal hipo dozu)', 150, 'olcu', 'kutu'), P('1 küçük kutu (200 ml)', 200, 'adet', 'kutu')], 'fast'],
    ['Bal (hipo için)', 82, [P('1 tatlı kaşığı', 10, 'olcu', 'kaşık'), P('1 yemek kaşığı', 20, 'olcu', 'kaşık')], 'fast'],
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
const x = (carbs: number, grams: number) => Math.round((carbs / grams) * 100 * 10000) / 10000;

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

/**
 * Kayseri Şehir Hastanesi diyabet eğitimi değişim listesi (güncel; yukarıdaki genel değişim değerlerinin ÜZERİNE yazar).
 * 1 porsiyon: ekmek/tahıl/meyve = 15 g KHO, süt grubu = 10 g KHO, sebze/et/yumurta/peynir/yağ = 0 g.
 * Özel kurallar: 100 g üzeri et +10 g; kuruyemiş / yağlı tohum 100 g = 10 g; sebze yemeğindeki pirinç/bulgur 1 yemek kaşığı = 1 g.
 */
const HOSPITAL: Record<string, number> = {
  // Ekmek ve tahıl (15 g)
  'Kepekli ekmek': x(15, 25), 'Çavdar ekmeği': x(15, 25), 'Yulaf ekmeği': x(15, 25), 'Hamburger ekmeği': x(15, 25),
  'Böreklik yufka': x(15, 25), 'Galeta': x(15, 20), 'Tuzlu / diyet bisküvi': x(15, 25), 'Un (buğday / pirinç / bezelye)': x(15, 20),
  'Pirinç pilavı': x(15, 50), 'Bulgur pilavı': x(15, 75), 'Makarna (haşlanmış)': x(15, 50), 'Erişte (haşlanmış)': x(15, 50),
  'Kuru fasulye / nohut / kuru barbunya (kuru)': x(15, 25), 'Yeşil mercimek (kuru)': x(15, 25), 'Yarma (aşurelik buğday)': x(15, 25),
  'Şehriye çorbası': x(15, 150), 'Pirinç çorbası': x(15, 150),
  'Bezelye': x(15, 125), 'Kestane': x(15, 40), 'Haşlanmış patates': x(15, 100), 'Haşlanmış mısır': x(15, 90),
  'Bardak mısır (yağsız)': x(15, 90), 'Patlamış mısır': x(15, 25), 'Leblebi': x(15, 25), 'Mısır gevreği': x(15, 20), 'Yulaf ezmesi (kuru)': x(15, 25),
  // Süt grubu (10 g)
  'Süt': x(10, 200), 'Yoğurt': x(10, 200), 'Ayran': x(10, 300), 'Kefir': x(10, 200),
  // Meyve (15 g) ve meyve suyu (100 ml = 15 g)
  'Elma': x(15, 130), 'Armut': x(15, 140), 'Portakal': x(15, 180), 'Mandalina': x(15, 175), 'Muz': x(15, 140), 'Çilek': x(15, 300),
  'Karpuz': x(15, 220), 'Kavun': x(15, 170), 'Üzüm': x(15, 100), 'Şeftali': x(15, 220),
  'Kuru kayısı': x(15, 25), 'Kuru incir': x(15, 25), 'Hurma (kuru)': x(15, 25),
  'Portakal suyu': x(15, 100), 'Vişne / şeftali nektarı': x(15, 100),
  // Sebze (pişmiş yemekler, yeşillik, çiğ domates/salatalık) = 0 g
  'Domates': 0, 'Salatalık': 0, 'Havuç': 0, 'Brokoli / karnabahar': 0, 'Kabak': 0, 'Patlıcan': 0, 'Kırmızı pancar': 0,
  'Çoban / yeşil salata': 0, 'Etli taze fasulye': 0, 'Zeytinyağlı taze fasulye': 0, 'Türlü': 0, 'Kıymalı ıspanak': 0,
  'Karnıyarık': 0, 'İmam bayıldı': 0, 'Menemen': 0,
  'Sebze yemeğindeki pirinç / bulgur (kaşık sayısı)': 100, // kaşık sayısı "gram" yerine girilir: 1 yemek kaşığı = 1 g KHO
  // Peynir, yağ: 0 g; kuruyemiş / yağlı tohum: 100 g = 10 g
  'Lor peyniri': 0, 'Tulum peyniri': 0, 'Zeytinyağı / sıvı yağ': 0,
  'Fındık': 10, 'Ceviz': 10, 'Badem': 10, 'Antep fıstığı': 10, 'Kaju': 10, 'Ay çekirdeği (iç)': 10, 'Fıstık ezmesi': 10, 'Tahin': 10,
  // Hazır / komplike yemekler
  'Zeytinyağlı yaprak sarma': x(15, 150), // 7–8 orta boy = 1 sebze + 1 ekmek + 3 yağ = 15 g
};

const HOSPITAL_PORTIONS: Record<string, Portion[]> = {
  'Kepekli ekmek': [{ label: '1 ince dilim', grams: 25 }],
  'Çavdar ekmeği': [{ label: '1 ince dilim', grams: 25 }],
  'Galeta': [{ label: '1,5 büyük boy', grams: 20 }],
  'Pirinç pilavı': [{ label: '2 yemek kaşığı dolusu', grams: 50 }, { label: '1 porsiyon', grams: 150 }],
  'Bulgur pilavı': [{ label: '3 yemek kaşığı dolusu', grams: 75 }, { label: '1 porsiyon', grams: 150 }],
  'Makarna (haşlanmış)': [{ label: '3 yemek kaşığı dolusu', grams: 50 }, { label: '1 porsiyon', grams: 180 }],
  'Erişte (haşlanmış)': [{ label: '3 yemek kaşığı dolusu', grams: 50 }, { label: '1 porsiyon', grams: 180 }],
  'Şehriye çorbası': BOWL,
  'Pirinç çorbası': BOWL,
  'Bezelye': [{ label: '3 yemek kaşığı dolusu', grams: 125 }],
  'Haşlanmış patates': [{ label: '1 küçük boy', grams: 100 }, { label: '1 orta boy', grams: 150 }],
  'Haşlanmış mısır': [{ label: '1 küçük koçan', grams: 90 }],
  'Patlamış mısır': [{ label: '3 su bardağı dolusu', grams: 25 }],
  'Leblebi': [{ label: '1/2 çay bardağı', grams: 25 }, { label: '1 avuç', grams: 30 }],
  'Mısır gevreği': [{ label: '3 yemek kaşığı', grams: 20 }, { label: '1 kase', grams: 30 }],
  'Yulaf ezmesi (kuru)': [{ label: '2 yemek kaşığı', grams: 25 }, { label: '1 kase', grams: 40 }],
  'Yoğurt': [{ label: '1 su bardağı (200 ml)', grams: 200 }, { label: '1 çay bardağı (100 ml)', grams: 100 }, { label: '1 kase', grams: 200 }],
  'Ayran': [{ label: '1,5 su bardağı (300 ml)', grams: 300 }, { label: '1 su bardağı (200 ml)', grams: 200 }, { label: '1 kutu', grams: 200 }],
  'Süt': [{ label: '1 su bardağı (200 ml)', grams: 200 }],
  'Kefir': [{ label: '1 su bardağı (200 ml)', grams: 200 }],
  'Elma': [{ label: '1 orta boy', grams: 130 }],
  'Armut': [{ label: '1 küçük boy', grams: 140 }],
  'Portakal': [{ label: '1 orta boy', grams: 180 }],
  'Mandalina': [{ label: '2 orta boy', grams: 175 }, { label: '1 orta boy', grams: 87.5 }],
  'Muz': [{ label: '1 küçük boy', grams: 140 }],
  'Çilek': [{ label: '18 orta boy', grams: 300 }],
  'Karpuz': [{ label: '1 dilim (1/8 orta boyun yarısı, kabuksuz)', grams: 220 }],
  'Kavun': [{ label: '1/8 küçük boy, kabuksuz', grams: 170 }],
  'Üzüm': [{ label: '25 adet', grams: 100 }],
  'Şeftali': [{ label: '1 orta boy', grams: 220 }],
  'Kuru kayısı': [{ label: '25 g (≈ 3 adet)', grams: 25 }],
  'Kuru incir': [{ label: '25 g (≈ 1 büyük)', grams: 25 }],
  'Hurma (kuru)': [{ label: '25 g (≈ 2–3 adet)', grams: 25 }],
  'Portakal suyu': [{ label: '1 çay bardağı (100 ml)', grams: 100 }, { label: '1 su bardağı (200 ml)', grams: 200 }],
  'Vişne / şeftali nektarı': [{ label: '1 çay bardağı (100 ml)', grams: 100 }, { label: '1 su bardağı (200 ml)', grams: 200 }],
  'Zeytinyağlı yaprak sarma': [{ label: '7–8 orta boy', grams: 150 }, { label: '1 adet', grams: 20 }],
  'Simit': [{ label: '1 adet (100 g)', grams: 100 }, { label: '1/2 adet', grams: 50 }, { label: '1/4 adet', grams: 25 }],
};

function inferPortionCategory(label: string): PortionCategory {
  const l = label.toLowerCase();
  if (l.includes('boy') || l.includes('dilim') || l.includes('kalın') || l.includes('ince')) return 'boyut';
  if (l.includes('kaşık') || l.includes('bardak') || l.includes('kase') || l.includes('kupa') || l.includes('kepçe') || l.includes('avuç')) return 'olcu';
  if (l.includes('porsiyon') || l.includes('çeyrek') || l.includes('yarım') || l.includes('paket') || l.includes('tabak')) return 'porsiyon';
  return 'adet';
}

function mergePortions(primary: Portion[], secondary?: Portion[]): Portion[] {
  const result: Portion[] = [...primary];
  const seenGrams = new Set(primary.map((p) => p.grams));
  const seenLabels = new Set(primary.map((p) => p.label));

  if (secondary) {
    for (const p of secondary) {
      if (!seenGrams.has(p.grams) && !seenLabels.has(p.label)) {
        seenGrams.add(p.grams);
        seenLabels.add(p.label);
        result.push(p);
      }
    }
  }

  return result.map((p) => ({
    ...p,
    category: p.category ?? inferPortionCategory(p.label),
  }));
}

const MEAT = new Set(['Izgara köfte', 'Izgara et / tavuk / balık', 'Tavuk sote']);

/** Yumurta ve saf et gerçek bileşimde de 0 g karbonhidrattır (TürKomp 0,00 g) */
const ZERO_BASE = new Set(['Haşlanmış yumurta', 'Omlet', 'Izgara et / tavuk / balık']);

export const FOODS: Food[] = Object.entries(DATA).flatMap(([category, rows]) =>
  rows.map(([name, carbsPer100, portions, flag]) => ({
    id: slug(`${category}-${name}`),
    name,
    category,
    carbsPer100: ZERO_BASE.has(name) ? 0 : carbsPer100,
    exPer100: HOSPITAL[name] ?? EXCHANGE[name],
    meat: MEAT.has(name) || undefined,
    portions: mergePortions(HOSPITAL_PORTIONS[name] ?? PORTIONS[name] ?? portions, portions),
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
