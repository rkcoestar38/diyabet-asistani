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
  /** Paketli ürün barkodu (Open Food Facts kaydı); etiketle doğrulamak için */
  barcode?: string;
  custom?: boolean;
};

export const CATEGORIES = [
  'Ekmek & Hamur İşi',
  'Pilav, Makarna & Tahıl',
  'Çorbalar',
  'Ana Yemekler',
  'Et, Balık & Sakatat',
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
    ['Çok tahıllı / tahıllı ekmek', 42, [P('1 ince dilim', 25, 'boyut', 'dilim'), P('1 dilim', 35, 'boyut', 'dilim'), P('1 kalın dilim', 50, 'boyut', 'dilim')]],
    ['Mısır ekmeği', 44, [P('1 dilim', 40, 'boyut', 'dilim'), P('1 küçük parça', 60, 'boyut', 'adet'), P('1 büyük dilim', 90, 'boyut', 'dilim')], 'fatty'],
    ['Roll / sandviç ekmeği', 48, [P('1 küçük adet', 50, 'boyut', 'adet'), P('1 standart adet', 70, 'boyut', 'adet'), P('1 büyük adet', 110, 'boyut', 'adet')]],
    ['Burger ekmeği (susamlı)', 50, [P('1 adet', 55, 'adet', 'adet'), P('1 büyük adet', 80, 'boyut', 'adet')]],
    ['Tam buğday lavaş / dürüm', 50, [P('1 küçük boy', 40, 'boyut', 'adet'), P('1 standart boy (dürüm)', 70, 'boyut', 'adet')]],
    ['Pide (sade, Ramazan dışı)', 50, [P('1/4 adet (çeyrek)', 80, 'porsiyon', 'çeyrek'), P('1/2 adet (yarım)', 160, 'porsiyon', 'yarım'), P('1 tam adet', 320, 'boyut', 'adet')]],
    ['Krep / pankek (sade)', 30, [P('1 küçük adet', 40, 'boyut', 'adet'), P('1 standart adet', 70, 'boyut', 'adet'), P('3 adet (1 porsiyon)', 200, 'porsiyon', 'adet')], 'fatty'],
    ['Peynirli / ıspanaklı börek (tepsi)', 28, [P('1 küçük dilim', 90, 'boyut', 'dilim'), P('1 standart dilim', 150, 'porsiyon', 'dilim'), P('1 büyük dilim', 220, 'boyut', 'dilim')], 'fatty'],
    ['Kıymalı börek', 27, [P('1 küçük dilim', 100, 'boyut', 'dilim'), P('1 standart dilim', 160, 'porsiyon', 'dilim')], 'fatty'],
    ['Çörek', 48, [P('1 küçük adet', 60, 'boyut', 'adet'), P('1 standart halka dilim', 80, 'boyut', 'adet'), P('1 büyük adet', 120, 'boyut', 'adet')], 'fatty'],
    ['Katmer', 42, [P('1/4 adet', 60, 'porsiyon', 'çeyrek'), P('1/2 adet', 120, 'porsiyon', 'yarım'), P('1 tam adet', 240, 'boyut', 'adet')], 'fatty'],
    ['Gözleme (ıspanaklı / patatesli)', 28, [P('1/2 adet', 110, 'porsiyon', 'yarım'), P('1 tam adet', 220, 'boyut', 'adet')], 'fatty'],
    ['Etimek (peksimet)', 75, [P('1 adet', 8, 'adet', 'adet'), P('2 adet', 16, 'adet', 'adet'), P('4 adet', 32, 'adet', 'adet')]],
    ['Diyet bisküvi (yulaflı / tahıllı)', 65, [P('1 adet', 7, 'adet', 'adet'), P('3 adet', 21, 'adet', 'adet'), P('5 adet', 35, 'adet', 'adet')]],
    ['Nişasta (buğday / mısır)', 88, [P('1 tatlı kaşığı', 7, 'olcu', 'kaşık'), P('1 yemek kaşığı', 12, 'olcu', 'kaşık')]],
    ['Galeta unu (ekmek kırıntısı)', 72, [P('1 yemek kaşığı', 9, 'olcu', 'kaşık'), P('3 yemek kaşığı', 27, 'olcu', 'kaşık')]],
    ['Yulaf kepeği', 66, [P('1 yemek kaşığı', 8, 'olcu', 'kaşık'), P('2 yemek kaşığı', 16, 'olcu', 'kaşık')]],
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
    ['Bulgur (kuru)', 68, [P('1 yemek kaşığı dolusu', 13, 'olcu', 'kaşık'), P('3 yemek kaşığı dolusu', 40, 'olcu', 'kaşık'), P('1 çay bardağı', 60, 'olcu', 'bardak')]],
    ['Pirinç (kuru)', 78, [P('1 yemek kaşığı silme', 13, 'olcu', 'kaşık'), P('1 çay bardağı', 60, 'olcu', 'bardak'), P('1 su bardağı', 150, 'olcu', 'bardak')]],
    ['Makarna (kuru / pişmemiş)', 73, [P('1 yemek kaşığı', 10, 'olcu', 'kaşık'), P('1 avuç / 1 küçük porsiyon', 50, 'boyut', 'avuç'), P('1 porsiyon (90 g)', 90, 'porsiyon', 'porsiyon')]],
    ['Kinoa (haşlanmış)', 21, [P('3 yemek kaşığı', 60, 'olcu', 'kaşık'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Nohut (haşlanmış)', 27, [P('3 yemek kaşığı', 70, 'olcu', 'kaşık'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Kuru fasulye (haşlanmış)', 23, [P('3 yemek kaşığı', 70, 'olcu', 'kaşık'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Mercimek (haşlanmış)', 20, [P('3 yemek kaşığı', 70, 'olcu', 'kaşık'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Barbunya (kuru / pişmemiş)', 60, [P('2 yemek kaşığı dolusu', 25, 'olcu', 'kaşık'), P('1 çay bardağı', 60, 'olcu', 'bardak')]],
    ['Geri kalan tahıl / kuskus (kuru)', 70, [P('1 yemek kaşığı', 10, 'olcu', 'kaşık'), P('3 yemek kaşığı', 30, 'olcu', 'kaşık')]],
    ['Karabuğday (haşlanmış)', 20, [P('3 yemek kaşığı', 60, 'olcu', 'kaşık'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['İnce bulgur (haşlanmış)', 19, [P('3 yemek kaşığı', 60, 'olcu', 'kaşık'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Pirinç patlağı / şişirilmiş pirinç', 80, [P('1 yemek kaşığı', 5, 'olcu', 'kaşık'), P('1 küçük kase', 15, 'olcu', 'kase')]],
    ['Mısır tanesi (haşlanmış)', 19, [P('3 yemek kaşığı', 50, 'olcu', 'kaşık'), P('1 küçük kase', 100, 'olcu', 'kase')]],
    ['Pirinç keki (patlak pirinç)', 82, [P('1 adet', 8, 'adet', 'adet'), P('2 adet', 16, 'adet', 'adet')]],
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
    ['Ciğer çorbası (Arnavut / sakatat)', 4, [P('1 kepçe', 75, 'olcu', 'kepçe'), P('1 kase (250 ml)', 250, 'olcu', 'kase')]],
    ['Tutmaç çorbası', 10, [P('1 kepçe', 75, 'olcu', 'kepçe'), P('1 kase (250 ml)', 250, 'olcu', 'kase')]],
    ['Havuç çorbası', 7, [P('1 kepçe', 75, 'olcu', 'kepçe'), P('1 kase (250 ml)', 250, 'olcu', 'kase')]],
    ['Kabak çorbası', 5, [P('1 kepçe', 75, 'olcu', 'kepçe'), P('1 kase (250 ml)', 250, 'olcu', 'kase')]],
    ['Mantar çorbası', 5, [P('1 kepçe', 75, 'olcu', 'kepçe'), P('1 kase (250 ml)', 250, 'olcu', 'kase')]],
    ['Mısır çorbası', 9, [P('1 kepçe', 75, 'olcu', 'kepçe'), P('1 kase (250 ml)', 250, 'olcu', 'kase')]],
    ['Paça çorbası', 1, [P('1 kepçe', 75, 'olcu', 'kepçe'), P('1 kase (250 ml)', 250, 'olcu', 'kase')], 'fatty'],
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
    ['Etli nohut', 14, [P('4 yemek kaşığı', 100, 'olcu', 'kaşık'), P('1 porsiyon', 200, 'porsiyon', 'porsiyon')]],
    ['Etli kuru fasulye', 12, [P('4 yemek kaşığı', 100, 'olcu', 'kaşık'), P('1 porsiyon', 200, 'porsiyon', 'porsiyon')]],
    ['Tas kebabı', 6, [P('1 porsiyon', 200, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Saç kavurma', 1, [P('1 porsiyon', 150, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Kuzu tandır', 0, [P('1 küçük porsiyon', 100, 'boyut', 'porsiyon'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Fırın tavuk (but / baget)', 0, [P('1 but / baget', 120, 'boyut', 'adet'), P('2 baget', 200, 'adet', 'adet')], 'fatty'],
    ['Tavuk şinitzel', 12, [P('1 küçük adet', 100, 'boyut', 'adet'), P('1 standart adet', 150, 'boyut', 'adet')], 'fatty'],
    ['Tavuk kanat (fırın)', 0, [P('3-4 adet', 150, 'adet', 'adet')], 'fatty'],
    ['Karnabahar kızartması', 12, [P('1 porsiyon', 150, 'porsiyon', 'porsiyon'), P('1 büyük porsiyon', 220, 'boyut', 'porsiyon')], 'fatty'],
    ['Fırında sebze (biber, patlıcan, kabak)', 6, [P('1 porsiyon', 200, 'porsiyon', 'porsiyon')]],
    ['Kabak mücver', 13, [P('1 adet', 40, 'adet', 'adet'), P('3 adet (1 porsiyon)', 120, 'porsiyon', 'adet')], 'fatty'],
    ['Patlıcan musakka (beşamel)', 9, [P('1 porsiyon', 250, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Zeytinyağlı yeşil fasulye (soğuk)', 5, [P('1 porsiyon', 200, 'porsiyon', 'porsiyon')]],
    ['Fasulye pilaki', 14, [P('1/2 porsiyon', 100, 'porsiyon', 'yarım'), P('1 porsiyon', 200, 'porsiyon', 'porsiyon')]],
    ['Zeytinyağlı enginar', 6, [P('1 adet', 150, 'adet', 'adet')]],
    ['Zeytinyağlı pırasa', 5, [P('1 porsiyon', 200, 'porsiyon', 'porsiyon')]],
    ['Zeytinyağlı bamya', 6, [P('1 porsiyon', 200, 'porsiyon', 'porsiyon')]],
    ['Zeytinyağlı kereviz', 5, [P('1 porsiyon', 200, 'porsiyon', 'porsiyon')]],
    ['Etli bezelye', 7, [P('1 porsiyon', 200, 'porsiyon', 'porsiyon')]],
    ['Fırında tavuk şiş', 0, [P('1 şiş', 100, 'adet', 'adet'), P('2 şiş', 200, 'adet', 'adet')], 'fatty'],
    ['Hamsi tava (unlanmış)', 6, [P('6-8 adet (1 porsiyon)', 150, 'porsiyon', 'adet')], 'fatty'],
    ['Köfte (fırın / yağsız)', 6, [P('1 adet', 30, 'adet', 'adet'), P('4 adet (1 porsiyon)', 120, 'porsiyon', 'adet')]],
    ['Sulu köfte', 8, [P('1 porsiyon', 250, 'porsiyon', 'porsiyon')]],
    ['Kuru köfte (ekonomik köfte)', 12, [P('1 adet', 40, 'adet', 'adet'), P('3 adet (1 porsiyon)', 120, 'porsiyon', 'adet')], 'fatty'],
    ['İzmir köfte', 7, [P('1 porsiyon', 250, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Beyti / kebap porsiyon', 12, [P('1/2 porsiyon', 160, 'porsiyon', 'yarım'), P('1 porsiyon', 320, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Adana / Urfa kebap', 8, [P('1 porsiyon (pide ile)', 250, 'porsiyon', 'porsiyon'), P('1.5 porsiyon', 350, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Döner (porsiyon, pilav/ekmeksiz)', 4, [P('1 küçük porsiyon', 100, 'boyut', 'porsiyon'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Fırında tavuk göğsü (derisiz)', 0, [P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Sucuklu yumurta', 2, [P('1 porsiyon (2 yumurta)', 150, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Pastırma', 1, [P('2 ince dilim', 20, 'adet', 'dilim'), P('4 dilim', 40, 'adet', 'dilim')]],
    ['Kavurma (dana)', 0, [P('2 yemek kaşığı', 30, 'olcu', 'kaşık'), P('1 küçük porsiyon', 50, 'boyut', 'porsiyon')], 'fatty'],
    ['Salam', 2, [P('1 dilim', 10, 'adet', 'dilim'), P('3 dilim', 30, 'adet', 'dilim')]],
    ['Sosis', 3, [P('1 adet', 40, 'adet', 'adet'), P('2 adet', 80, 'adet', 'adet')]],
  ],
  'Et, Balık & Sakatat': [
    // Sakatat bileşim değerleri: USDA FoodData Central, SR Legacy, pişmiş 100 g
    ['Ciğer (dana, pişmiş)', 5, [P('1 küçük porsiyon', 100, 'boyut', 'porsiyon'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon'), P('1 büyük porsiyon', 200, 'boyut', 'porsiyon')], 'fatty'],
    ['Ciğer (kuzu, pişmiş)', 2.5, [P('1 küçük porsiyon', 100, 'boyut', 'porsiyon'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Arnavut ciğeri (kızarmış)', 8, [P('1 küçük porsiyon', 100, 'boyut', 'porsiyon'), P('1 standart porsiyon', 150, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Edirne tava ciğeri', 10, [P('1 porsiyon (4-5 yaprak)', 150, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Ciğer şis / ciğer kavurma', 5, [P('1 şiş', 100, 'adet', 'adet'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Tavuk ciğeri (sote)', 1, [P('1 porsiyon', 150, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Karaciğer yapraklı dürüm / ciğer dürüm', 25, [P('1 adet', 250, 'adet', 'adet')], 'fatty'],
    ['Kokoreç (porsiyon, ekmeksiz)', 2, [P('1 porsiyon', 150, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Kelle / paça eti (haşlanmış)', 1, [P('1 porsiyon', 150, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Dil (dana / kuzu, haşlanmış)', 0, [P('2 ince dilim', 60, 'boyut', 'dilim'), P('1 porsiyon', 120, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Böbrek (sote)', 0, [P('1 porsiyon', 150, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Yürek (dana / kuzu)', 0, [P('1 porsiyon', 150, 'porsiyon', 'porsiyon')], 'fatty'],
    ['İşkembe (haşlanmış)', 2, [P('1 porsiyon', 150, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Beyin (haşlanmış)', 1.5, [P('1/2 adet', 60, 'porsiyon', 'yarım'), P('1 porsiyon', 120, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Piliç (tavuk but, derisiz)', 0, [P('1 but', 120, 'adet', 'adet'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Hindi göğsü (haşlanmış / fırın)', 0, [P('1 porsiyon', 120, 'porsiyon', 'porsiyon'), P('2 parça', 150, 'adet', 'adet')]],
    ['Hamsi (taze, ızgara)', 0, [P('8-10 adet', 150, 'adet', 'adet')]],
    ['Levrek (ızgara / fırın)', 0, [P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Çipura (ızgara / fırın)', 0, [P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Somon (ızgara)', 0, [P('1 porsiyon', 150, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Sardalya (ızgara)', 0, [P('8 adet', 120, 'adet', 'adet')], 'fatty'],
    ['Ton balığı (suda / yağsız)', 0, [P('1 yarım kutu (süzülmüş)', 60, 'porsiyon', 'yarım'), P('1 kutu (süzülmüş)', 120, 'adet', 'kutu')]],
    ['Karides (ızgara / haşlanmış)', 1, [P('8-10 adet', 100, 'adet', 'adet'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Kalamar (tava)', 10, [P('1 porsiyon', 150, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Ahtapot (haşlanmış / ızgara)', 2, [P('1 porsiyon', 120, 'porsiyon', 'porsiyon')]],
    ['İstiridye (midye içi)', 3, [P('6 adet', 60, 'adet', 'adet')]],
    ['Alabalık (fırın)', 0, [P('1 adet (orta)', 200, 'boyut', 'adet')], 'fatty'],
    ['Palamut / lüfer (ızgara)', 0, [P('1 porsiyon', 150, 'porsiyon', 'porsiyon')], 'fatty'],
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
    ['Tantuni (ekmek arası)', 25, [P('1 küçük adet', 150, 'boyut', 'adet'), P('1 standart adet', 220, 'boyut', 'adet')], 'fatty'],
    ['Adana dürüm', 22, [P('1 adet', 300, 'adet', 'adet'), P('1 küçük boy', 220, 'boyut', 'adet')], 'fatty'],
    ['Urfa / kıyma kebabı (ekmek arası ölçüsü)', 20, [P('1/2 ekmek (yarım)', 200, 'porsiyon', 'yarım'), P('1 tam ekmek', 400, 'boyut', 'adet')], 'fatty'],
    ['Dürüm (tavuk / et sade)', 25, [P('1 küçük adet', 200, 'boyut', 'adet'), P('1 standart adet', 300, 'adet', 'adet')], 'fatty'],
    ['Tost (karışık / kaşar-domates)', 29, [P('1 adet', 120, 'adet', 'adet'), P('1 çift katlı', 180, 'boyut', 'adet')], 'fatty'],
    ['Dönerli porsiyon (pilavla)', 20, [P('1 porsiyon', 400, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Nugget (tavuk)', 20, [P('4 adet', 80, 'adet', 'adet'), P('6 adet (1 porsiyon)', 120, 'porsiyon', 'adet')], 'fatty'],
    ['Sosisli sandviç (hot dog)', 27, [P('1 adet', 150, 'adet', 'adet')], 'fatty'],
    ['Waffle / krep (dondurulmuş)', 45, [P('1 adet', 40, 'adet', 'adet'), P('2 adet', 80, 'adet', 'adet')], 'fatty'],
    ['İşkembe / kelle paça (sokak porsiyonu)', 3, [P('1 kase', 300, 'olcu', 'kase')]],
    ['Falafel dürüm / porsiyon', 20, [P('1 dürüm', 250, 'adet', 'adet'), P('5 adet (porsiyon)', 120, 'porsiyon', 'adet')], 'fatty'],
    ['Pastırmalı yumurta (sokak kahvaltısı)', 3, [P('1 porsiyon', 180, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Simit + peynirli (kahvaltı menü)', 43, [P('1 adet simit + peynir', 120, 'adet', 'adet')], 'fatty'],
    ['Dondurulmuş hazır pizza (kişi boy)', 30, [P('1 adet kişilik', 250, 'adet', 'adet')], 'fatty'],
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
    ['Çoban salatası (limonlu)', 3, [P('1 küçük kase', 120, 'boyut', 'kase'), P('1 standart kase', 180, 'olcu', 'kase')]],
    ['Gavurdağı salatası', 6, [P('1 porsiyon', 200, 'porsiyon', 'porsiyon')]],
    ['Sezar salata', 4, [P('1 porsiyon (soslu)', 250, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Ton balıklı salata', 4, [P('1 büyük kase', 280, 'boyut', 'kase')], 'fatty'],
    ['Tavuklu salata', 4, [P('1 büyük kase', 300, 'boyut', 'kase')]],
    ['Zeytinyağlı semizotu (yoğurtlu)', 3, [P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Muhammara', 12, [P('1 yemek kaşığı', 20, 'olcu', 'kaşık'), P('1 porsiyon', 80, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Mercimekli meze (kısıra benzer, domates-biberli)', 18, [P('2 yemek kaşığı', 50, 'olcu', 'kaşık'), P('1 porsiyon', 100, 'porsiyon', 'porsiyon')]],
    ['Mütebbel (patlıcanlı)', 10, [P('1 yemek kaşığı', 25, 'olcu', 'kaşık'), P('1 porsiyon', 100, 'porsiyon', 'porsiyon')], 'fatty'],
    ['Tarator', 6, [P('1 yemek kaşığı', 20, 'olcu', 'kaşık'), P('1 porsiyon', 100, 'porsiyon', 'porsiyon')]],
    ['Yoğurtlu semizotu', 4, [P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['İçli ekmek dolması (meze)', 12, [P('1 yemek kaşığı', 20, 'olcu', 'kaşık'), P('1 porsiyon', 100, 'porsiyon', 'porsiyon')]],
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
    ['Haşlanmış yumurta beyazı', 1, [P('1 adet', 35, 'adet', 'adet'), P('2 adet', 70, 'adet', 'adet')]],
    ['Kaşarlı omlet', 2, [P('1 yumurtalı', 90, 'boyut', 'adet'), P('2 yumurtalı', 160, 'boyut', 'adet')], 'fatty'],
    ['Yumurtalı ekmek (yumurta ekmeği)', 25, [P('1 adet', 70, 'adet', 'adet')], 'fatty'],
    ['Sahanda yumurta', 1, [P('1 yumurta', 60, 'adet', 'adet'), P('2 yumurta', 120, 'adet', 'adet')], 'fatty'],
    ['Beyaz peynir (yağsız / light)', 1, [P('1 dilim', 30, 'boyut', 'dilim'), P('1 kalın dilim', 50, 'boyut', 'dilim')]],
    ['Ezine peyniri', 1, [P('1 dilim', 30, 'boyut', 'dilim')]],
    ['Köy peyniri', 1, [P('1 dilim', 35, 'boyut', 'dilim')]],
    ['Dil peyniri', 1, [P('1 dilim', 20, 'adet', 'dilim'), P('2 dilim', 40, 'adet', 'dilim')]],
    ['Hellim (ızgara)', 2, [P('1 dilim', 30, 'boyut', 'dilim')], 'fatty'],
    ['Çökelek', 2, [P('1 yemek kaşığı', 25, 'olcu', 'kaşık'), P('1 çay bardağı', 60, 'olcu', 'bardak')]],
    ['Tereyağı', 0, [P('1 tatlı kaşığı', 5, 'olcu', 'kaşık'), P('1 yemek kaşığı', 10, 'olcu', 'kaşık')], 'fatty'],
    ['Krema (yemeklik)', 3, [P('1 yemek kaşığı', 15, 'olcu', 'kaşık')], 'fatty'],
    ['Kaymak', 3, [P('1 tatlı kaşığı', 8, 'olcu', 'kaşık'), P('1 yemek kaşığı', 15, 'olcu', 'kaşık')], 'fatty'],
    ['Yeşil zeytin', 4, [P('3 adet', 12, 'adet', 'adet'), P('5 adet', 20, 'adet', 'adet')]],
    ['Siyah zeytin', 4, [P('3 adet', 12, 'adet', 'adet'), P('5 adet', 20, 'adet', 'adet')]],
    ['Fındık ezmesi', 15, [P('1 tatlı kaşığı', 10, 'olcu', 'kaşık'), P('1 yemek kaşığı', 15, 'olcu', 'kaşık')], 'fatty'],
    ['Pesto / renkli kahvaltılık sos', 4, [P('1 tatlı kaşığı', 7, 'olcu', 'kaşık'), P('1 yemek kaşığı', 15, 'olcu', 'kaşık')], 'fatty'],
    ['Ihlamur / bitki çayı (şekersiz)', 0, [P('1 fincan', 200, 'olcu', 'kupa')]],
    ['Yeşil / siyah çay (şekersiz)', 0, [P('1 çay bardağı', 100, 'olcu', 'bardak'), P('1 kupa', 200, 'olcu', 'kupa')]],
    ['Yumurta sarısı', 1, [P('1 adet', 15, 'adet', 'adet'), P('2 adet', 30, 'adet', 'adet')]],
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
    ['Şarap', 0.3, [P('1 kadeh (100 ml)', 100, 'olcu', 'kadeh'), P('1 büyük kadeh (150 ml)', 150, 'olcu', 'kadeh')]],
    ['Rakı (sade)', 0, [P('1 kadeh (50 ml)', 50, 'olcu', 'kadeh')]],
    ['Yayık ayranı', 3, [P('1 su bardağı (200 ml)', 200, 'olcu', 'bardak')]],
    ['Laktozsuz süt', 4.8, [P('1 su bardağı (200 ml)', 200, 'olcu', 'bardak'), P('1 kupa (250 ml)', 250, 'olcu', 'kupa')]],
    ['Yağsız süt', 4.9, [P('1 su bardağı (200 ml)', 200, 'olcu', 'bardak'), P('1 kupa (250 ml)', 250, 'olcu', 'kupa')]],
    ['Bitkisel süt (badem / soya, şekersiz)', 2, [P('1 su bardağı (200 ml)', 200, 'olcu', 'bardak')]],
    ['Süzme peynirli / meyveli ayran (şekersiz)', 3, [P('1 su bardağı (200 ml)', 200, 'olcu', 'bardak')]],
    ['Elma suyu', 11.3, [P('1 çay bardağı (100 ml)', 100, 'olcu', 'bardak'), P('1 su bardağı (200 ml)', 200, 'olcu', 'bardak')], 'fast'],
    ['Portakal / mandalina nektarı', 11, [P('1 çay bardağı (100 ml)', 100, 'olcu', 'bardak'), P('1 kutu (200 ml)', 200, 'adet', 'kutu')], 'fast'],
    ['Meyve suyu (100%, şekersiz)', 10, [P('1 çay bardağı (100 ml)', 100, 'olcu', 'bardak'), P('1 su bardağı (200 ml)', 200, 'olcu', 'bardak')], 'fast'],
    ['Oral rehidrasyon / izotonik içecek', 6, [P('1 şişe (500 ml)', 500, 'adet', 'şişe'), P('1 bardak (250 ml)', 250, 'olcu', 'bardak')], 'fast'],
    ['Şekerli çay / kahve (bir küp şeker)', 100, [P('1 çay bardağı + 1 küp şeker', 100, 'olcu', 'bardak'), P('1 kupa + 1 küp şeker', 200, 'olcu', 'kupa')], 'fast'],
    ['Kefirli ayran (kefir)', 4.5, [P('1 su bardağı (200 ml)', 200, 'olcu', 'bardak')]],
    ['Greyfurt suyu (taze)', 9, [P('1 çay bardağı (100 ml)', 100, 'olcu', 'bardak'), P('1 su bardağı (200 ml)', 200, 'olcu', 'bardak')], 'fast'],
    ['Maden suyu (sade)', 0, [P('1 şişe (200 ml)', 200, 'adet', 'şişe')]],
    ['Kola zero / diyet içecek (large)', 0, [P('1 kutu (330 ml)', 330, 'adet', 'kutu'), P('1 şişe (500 ml)', 500, 'adet', 'şişe')]],
    ['Şekersiz limonata (ev yapımı)', 2, [P('1 su bardağı (200 ml)', 200, 'olcu', 'bardak')]],
    ['Enerji içeceği (şekerli)', 11, [P('1 kutu (250 ml)', 250, 'adet', 'kutu')], 'fast'],
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
    ['Kayısı (kuru, gün kurusu)', 58, [P('2 adet', 16, 'adet', 'adet'), P('4 adet (1 porsiyon)', 30, 'porsiyon', 'adet')]],
    ['Erik (kuru)', 55, [P('2 adet', 16, 'adet', 'adet'), P('4 adet', 32, 'adet', 'adet')]],
    ['Kayısı (dut kurusu)', 66, [P('1 yemek kaşığı', 8, 'olcu', 'kaşık'), P('3 yemek kaşığı', 25, 'olcu', 'kaşık')]],
    ['Frenk üzümü / kuş üzümü', 12, [P('1 çay bardağı', 80, 'olcu', 'bardak'), P('1 kase', 140, 'olcu', 'kase')]],
    ['Trabzon hurması (cennet hurması)', 18, [P('1/2 orta boy', 120, 'porsiyon', 'yarım'), P('1 orta boy', 200, 'boyut', 'adet')]],
    ['Mango', 15, [P('1/2 orta boy (küp)', 100, 'porsiyon', 'yarım'), P('1 orta boy (soyulmuş)', 200, 'boyut', 'adet')]],
    ['Kivi (altın)', 14, [P('1 küçük boy', 70, 'boyut', 'adet'), P('1 orta boy', 90, 'boyut', 'adet')]],
    ['Üzüm (kırmızı / salkım)', 16, [P('10 tane', 50, 'adet', 'adet'), P('1 küçük salkım', 100, 'boyut', 'adet')]],
    ['Böğürtlen', 5, [P('1 çay bardağı', 80, 'olcu', 'bardak'), P('1 kase', 150, 'olcu', 'kase')]],
    ['Ahududu', 5, [P('1 çay bardağı', 80, 'olcu', 'bardak'), P('1 kase', 150, 'olcu', 'kase')]],
    ['Yaban mersini (blueberry)', 12, [P('1 çay bardağı', 90, 'olcu', 'bardak'), P('1 kase', 150, 'olcu', 'kase')]],
    ['Kayısı (konserve, hafif şuruplu)', 12, [P('1 orta adet + 1 yemek kaşığı şurup', 60, 'porsiyon', 'adet')], 'fast'],
    ['Şeftali (konserve)', 12, [P('1/2 adet + 1 yemek kaşığı şurup', 60, 'porsiyon', 'adet')], 'fast'],
    ['Karpuz (kış kavunu alternatifi)', 7, [P('1 dilim', 200, 'boyut', 'dilim')]],
    ['Mor elma', 12, [P('1 orta boy', 130, 'boyut', 'adet')]],
    ['Kumkuat (küçük mandalina)', 12, [P('5 adet', 100, 'adet', 'adet')]],
    ['Pomelo', 9, [P('1/2 orta boy', 150, 'porsiyon', 'yarım')]],
    ['Avokado (yarım, çatal kaşık)', 2, [P('1/2 adet', 70, 'porsiyon', 'yarım')]],
    ['Dondurulmuş meyve (karışık, şekersiz)', 10, [P('1 çay bardağı', 100, 'olcu', 'bardak'), P('1 kase', 150, 'olcu', 'kase')]],
  ],
  'Kuruyemiş': [
    ['Fındık', 7, [P('1 tatlı kaşığı', 8, 'olcu', 'kaşık'), P('1 yemek kaşığı', 15, 'olcu', 'kaşık'), P('1 küçük avuç', 20, 'boyut', 'avuç'), P('1 avuç', 30, 'boyut', 'avuç')]],
    ['Ceviz', 7, [P('2 adet tam (4 yarım)', 15, 'adet', 'adet'), P('1 avuç (yaklaşık 8 yarım)', 30, 'boyut', 'avuç')]],
    ['Badem', 9, [P('10 adet', 15, 'adet', 'adet'), P('1 küçük avuç', 20, 'boyut', 'avuç'), P('1 avuç (yaklaşık 20 adet)', 30, 'boyut', 'avuç')]],
    ['Antep fıstığı', 18, [P('15 adet içi', 15, 'adet', 'adet'), P('1 avuç', 30, 'boyut', 'avuç')]],
    ['Kaju', 27, [P('10 adet', 15, 'adet', 'adet'), P('1 avuç', 30, 'boyut', 'avuç')]],
    ['Leblebi', 50, [P('1 yemek kaşığı', 10, 'olcu', 'kaşık'), P('1/2 çay bardağı', 25, 'olcu', 'bardak'), P('1 avuç', 30, 'boyut', 'avuç')]],
    ['Ay çekirdeği (iç)', 12, [P('1 yemek kaşığı', 10, 'olcu', 'kaşık'), P('1 avuç', 30, 'boyut', 'avuç')]],
    ['Kabak çekirdeği (iç)', 12, [P('1 yemek kaşığı', 10, 'olcu', 'kaşık'), P('1 avuç', 30, 'boyut', 'avuç')]],
    ['Fıstık (yer fıstığı)', 16, [P('10 adet', 15, 'adet', 'adet'), P('1 avuç', 30, 'boyut', 'avuç')]],
    ['Kestane (kavrulmuş, soyulmuş)', 45, [P('3 adet', 30, 'adet', 'adet'), P('6 adet', 60, 'adet', 'adet')]],
    ['Limonlu / baharatlı badem (çiğ)', 9, [P('1 avuç', 25, 'boyut', 'avuç')]],
    ['Susam', 23, [P('1 tatlı kaşığı', 5, 'olcu', 'kaşık'), P('1 yemek kaşığı', 9, 'olcu', 'kaşık')]],
    ['Keten tohumu', 29, [P('1 tatlı kaşığı', 4, 'olcu', 'kaşık'), P('1 yemek kaşığı', 9, 'olcu', 'kaşık')]],
    ['Chia tohumu', 42, [P('1 tatlı kaşığı', 4, 'olcu', 'kaşık'), P('1 yemek kaşığı', 9, 'olcu', 'kaşık')]],
    ['Sarı leblebi (kavrulmuş)', 60, [P('1 yemek kaşığı', 10, 'olcu', 'kaşık'), P('1 avuç', 30, 'boyut', 'avuç')]],
    ['Kuş üzümü (kuru)', 70, [P('1 tatlı kaşığı', 5, 'olcu', 'kaşık'), P('1 yemek kaşığı', 10, 'olcu', 'kaşık')]],
    ['Badem unu', 20, [P('1 yemek kaşığı', 8, 'olcu', 'kaşık')]],
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
    ['Antep fıstıklı baklava (burma)', 52, [P('1 adet (küçük)', 30, 'adet', 'adet'), P('1 standart burma', 55, 'adet', 'adet')], 'fatty'],
    ['Sütlü nuriye / fıstıklı sarma', 50, [P('1 adet', 45, 'adet', 'adet'), P('2 adet', 90, 'adet', 'adet')], 'fatty'],
    ['Kalburabastı', 50, [P('1 adet', 45, 'adet', 'adet'), P('2 adet', 90, 'adet', 'adet')], 'fatty'],
    ['Saray helvası / yaz helvası', 60, [P('1 küçük dilim', 25, 'boyut', 'dilim'), P('1 dilim', 40, 'boyut', 'dilim')], 'fatty'],
    ['Bülbül yuvası', 48, [P('1 adet', 50, 'adet', 'adet')], 'fatty'],
    ['Krem şokola (soslu kek)', 40, [P('1 dilim', 100, 'boyut', 'dilim'), P('1 büyük dilim', 150, 'boyut', 'dilim')], 'fatty'],
    ['Brownie', 45, [P('1 kare', 50, 'boyut', 'kare'), P('1 büyük kare', 90, 'boyut', 'kare')], 'fatty'],
    ['Donut (sade / çikolatalı)', 48, [P('1 adet', 60, 'adet', 'adet'), P('1 büyük adet', 90, 'boyut', 'adet')], 'fatty'],
    ['Muffin', 45, [P('1 küçük adet', 50, 'boyut', 'adet'), P('1 standart adet', 80, 'boyut', 'adet')], 'fatty'],
    ['Dondurmalı sandviç', 35, [P('1 adet', 70, 'adet', 'adet')], 'fatty'],
    ['Meyveli sorbet', 22, [P('1 top', 60, 'adet', 'adet')]],
    ['Bademli / fındıklı çikolata', 50, [P('1 kare', 6, 'adet', 'kare'), P('1 küçük paket (4 kare)', 25, 'boyut', 'paket')], 'fatty'],
    ['Beyaz çikolata', 58, [P('1 kare', 5, 'adet', 'kare'), P('4 kare', 20, 'adet', 'kare')], 'fatty'],
    ['Dondurulmuş dondurma (kutu, sade)', 24, [P('1 top', 50, 'adet', 'adet'), P('1 küçük kase (3 top)', 150, 'olcu', 'kase')], 'fatty'],
    ['Gazoz / meyveli şeker (lokum)', 85, [P('1 küçük parça', 6, 'adet', 'adet'), P('3 parça', 18, 'adet', 'adet')], 'fast'],
    ['Cevizli sucuk', 55, [P('1 dilim', 20, 'boyut', 'dilim'), P('3 dilim', 60, 'adet', 'dilim')], 'fatty'],
    ['Çikolatalı gofret (büyük)', 60, [P('1 büyük bar', 50, 'boyut', 'adet')], 'fatty'],
    ['Karamelli / şekerli çubuk (lollipop)', 95, [P('1 adet', 8, 'adet', 'adet')], 'fast'],
    ['Ballı / reçelli kraker', 68, [P('1 adet', 8, 'adet', 'adet'), P('3 adet', 24, 'adet', 'adet')]],
    ['Tuzlu çubuk / çubuk kraker', 70, [P('1 küçük paket', 20, 'boyut', 'paket'), P('1 büyük paket', 40, 'boyut', 'paket')]],
    ['Patlamış mısır (yağlı / karışık)', 55, [P('1 küçük kase', 30, 'boyut', 'kase'), P('1 büyük kase', 60, 'boyut', 'kase')], 'fatty'],
    ['Kuru pasta / kurabiye (çeşitli)', 55, [P('1 adet', 12, 'adet', 'adet'), P('3 adet', 36, 'adet', 'adet')], 'fatty'],
  ],
  'Sebzeler': [
    ['Havuç', 7, [P('1 küçük boy', 50, 'boyut', 'adet'), P('1 orta boy', 80, 'boyut', 'adet'), P('1 büyük boy', 120, 'boyut', 'adet'), P('1 kase rendelenmiş', 100, 'olcu', 'kase')]],
    ['Bezelye', 10, [P('3 yemek kaşığı', 60, 'olcu', 'kaşık'), P('1 porsiyon', 100, 'porsiyon', 'porsiyon')]],
    ['Kırmızı pancar', 8, [P('1 küçük boy', 60, 'boyut', 'adet'), P('1 porsiyon', 100, 'porsiyon', 'porsiyon')]],
    ['Brokoli / karnabahar', 3, [P('1 kase haşlanmış', 100, 'olcu', 'kase'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Kabak', 3, [P('1 orta boy', 150, 'boyut', 'adet'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Patlıcan', 3, [P('1 orta boy', 150, 'boyut', 'adet'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Biber (yeşil / kırmızı dolmalık)', 5, [P('1 adet', 60, 'adet', 'adet'), P('1 porsiyon', 100, 'porsiyon', 'porsiyon')]],
    ['Sivri biber', 5, [P('3 adet', 50, 'adet', 'adet'), P('1 porsiyon', 100, 'porsiyon', 'porsiyon')]],
    ['Mantar', 3, [P('1 küçük kase', 100, 'olcu', 'kase'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Pırasa', 8, [P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Ispanak', 4, [P('1 porsiyon', 150, 'porsiyon', 'porsiyon'), P('1 küçük kase', 100, 'olcu', 'kase')]],
    ['Kereviz', 6, [P('1/2 adet', 100, 'porsiyon', 'yarım'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Marul / göbek salata', 2, [P('1 büyük yaprak', 20, 'adet', 'adet'), P('1 kase doğranmış', 100, 'olcu', 'kase')]],
    ['Roka / maydanoz / nane', 3, [P('1 avuç', 30, 'boyut', 'avuç'), P('1 demet (küçük)', 60, 'porsiyon', 'adet')]],
    ['Bamya (taze)', 7, [P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Enginar (taze kalp)', 6, [P('1 adet', 150, 'adet', 'adet')]],
    ['Semizotu', 3, [P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Soğan', 9, [P('1 orta boy', 120, 'boyut', 'adet'), P('1/2 orta boy', 60, 'porsiyon', 'yarım')]],
    ['Sarımsak', 28, [P('1 diş', 4, 'adet', 'adet'), P('3 diş', 12, 'adet', 'adet')]],
    ['Lahana (beyaz / kara)', 6, [P('1 kase doğranmış', 100, 'olcu', 'kase'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Turp (kırmızı / beyaz)', 4, [P('1 adet küçük', 50, 'adet', 'adet'), P('1 porsiyon', 100, 'porsiyon', 'porsiyon')]],
    ['Mısır (taze taneli)', 19, [P('3 yemek kaşığı', 50, 'olcu', 'kaşık'), P('1 küçük kase', 100, 'olcu', 'kase')]],
    ['Tatlı patates (fırın)', 27, [P('1 küçük boy', 150, 'boyut', 'adet'), P('1 orta boy', 200, 'boyut', 'adet')]],
    ['Fasulye (taze)', 7, [P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Börülce', 9, [P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Domates kurusu (güneşte)', 55, [P('2 adet', 10, 'adet', 'adet'), P('1 porsiyon', 25, 'porsiyon', 'adet')]],
    ['Salatalık turşusu', 3, [P('2 adet', 40, 'adet', 'adet'), P('1 porsiyon', 100, 'porsiyon', 'porsiyon')]],
    ['Cevizli / yapraklı yeşillik salata (yemeklik)', 3, [P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
    ['Sarımsaklı yoğurtlu sebze (havuçlu)', 6, [P('1 porsiyon', 150, 'porsiyon', 'porsiyon')]],
  ],
  'Hipo İçin': [
    ['Glukoz tableti (etiketi kontrol et)', 90, [P('1 tablet', 4, 'adet', 'tablet'), P('3 tablet', 12, 'adet', 'tablet'), P('4 tablet', 16, 'adet', 'tablet')], 'fast'],
    ['Küp şeker', 100, [P('1 adet', 3, 'adet', 'adet'), P('3 adet', 9, 'adet', 'adet'), P('4 adet (12 g)', 12, 'adet', 'adet'), P('5 adet (15 g kuralı)', 15, 'adet', 'adet')], 'fast'],
    ['Toz şeker', 100, [P('1 çay kaşığı', 3, 'olcu', 'kaşık'), P('1 tatlı kaşığı', 5, 'olcu', 'kaşık'), P('1 yemek kaşığı', 12, 'olcu', 'kaşık')], 'fast'],
    ['Meyve suyu (hipo için)', 11, [P('1 çay bardağı (100 ml)', 100, 'olcu', 'bardak'), P('150 ml (ideal hipo dozu)', 150, 'olcu', 'kutu'), P('1 küçük kutu (200 ml)', 200, 'adet', 'kutu')], 'fast'],
    ['Bal (hipo için)', 82, [P('1 tatlı kaşığı', 10, 'olcu', 'kaşık'), P('1 yemek kaşığı', 20, 'olcu', 'kaşık')], 'fast'],
    ['Glukoz jeli / hipo jeli', 30, [P('1 poşet (15 g KHO)', 50, 'adet', 'poşet'), P('1 poşet (20 g KHO)', 65, 'adet', 'poşet')], 'fast'],
    ['Dekstroz tablet', 95, [P('1 tablet', 3, 'adet', 'tablet'), P('4 tablet', 12, 'adet', 'tablet')], 'fast'],
    ['Hipo şekeri: meyve suyu (200 ml)', 11, [P('1 küçük kutu (200 ml)', 200, 'adet', 'kutu')], 'fast'],
    ['Nişastalı / pekmezli hipo tozu', 85, [P('1 çay kaşığı', 4, 'olcu', 'kaşık'), P('1 tatlı kaşığı', 8, 'olcu', 'kaşık')], 'fast'],
    ['Hipolu unlu sütlü içecek (ev yapımı)', 12, [P('1 bardak (200 ml)', 200, 'olcu', 'bardak')], 'fast'],
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
  'Ciğer (dana, pişmiş)': x(10, 150), // 1 porsiyon = 1 yağlı tohum + 10 g KHO
  'Ciğer (kuzu, pişmiş)': x(10, 150),
  'Arnavut ciğeri (kızarmış)': x(12, 150),
  'Edirne tava ciğeri': x(15, 150),
  'Ciğer şis / ciğer kavurma': x(10, 150),
  'Tavuk ciğeri (sote)': x(10, 150),
  'Karaciğer yapraklı dürüm / ciğer dürüm': x(60, 250), // 1 dürüm + 1 ekmek
  'Kokoreç (porsiyon, ekmeksiz)': x(10, 150),
  'Kokoreç (yarım ekmek)': x(75, 300), // yarım ekmek + 1 yağlı tohum
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

/** Yeni eklenen ekmek / tahıl kayıtları: TÜBER değişim listesinde 1 ekmek değişimi = 15 g KHO */
const NEW_STARCH_EXCHANGE: Record<string, number> = {
  'Çok tahıllı / tahıllı ekmek': x(15, 25), 'Mısır ekmeği': x(15, 25), 'Roll / sandviç ekmeği': x(15, 30),
  'Burger ekmeği (susamlı)': x(15, 25), 'Tam buğday lavaş / dürüm': x(15, 30), 'Pide (sade, Ramazan dışı)': x(15, 25),
  'Krep / pankek (sade)': x(15, 50), 'Peynirli / ıspanaklı börek (tepsi)': x(15, 50), 'Kıymalı börek': x(15, 55),
  'Çörek': x(15, 30), 'Katmer': x(15, 35), 'Gözleme (ıspanaklı / patatesli)': x(15, 55), 'Etimek (peksimet)': x(15, 20),
  'Diyet bisküvi (yulaflı / tahıllı)': x(15, 25), 'Nişasta (buğday / mısır)': x(15, 17), 'Galeta unu (ekmek kırıntısı)': x(15, 20),
  'Yulaf kepeği': x(15, 20),
  'Bulgur (kuru)': x(15, 22), 'Pirinç (kuru)': x(15, 20), 'Makarna (kuru / pişmemiş)': x(15, 20), 'Kinoa (haşlanmış)': x(15, 75),
  'Nohut (haşlanmış)': x(15, 55), 'Kuru fasulye (haşlanmış)': x(15, 65), 'Mercimek (haşlanmış)': x(15, 75),
  'Barbunya (kuru / pişmemiş)': x(15, 25), 'Karabuğday (haşlanmış)': x(15, 75), 'İnce bulgur (haşlanmış)': x(15, 80),
  'Pirinç keki (patlak pirinç)': x(15, 18),
  // Meyve grubu: 1 değişim = 15 g KHO
  'Kayısı (kuru, gün kurusu)': x(15, 25), 'Trabzon hurması (cennet hurması)': x(15, 90), 'Mango': x(15, 100),
  'Kivi (altın)': x(15, 100), 'Frenk üzümü / kuş üzümü': x(15, 125), 'Böğürtlen': x(15, 150), 'Ahududu': x(15, 150),
  'Yaban mersini': x(15, 125), 'Mor elma': x(15, 100), 'Kayısı (konserve, hafif şuruplu)': x(15, 120), 'Şeftali (konserve)': x(15, 120),
  'Erik (kuru)': x(15, 25),
  // Sebze grubu: 1 değişim = 6 g KHO
  'Biber (yeşil / kırmızı dolmalık)': x(6, 120), 'Sivri biber': x(6, 120), 'Mantar': x(6, 150), 'Pırasa': x(6, 100),
  'Ispanak': x(6, 150), 'Kereviz': x(6, 100), 'Bamya (taze)': x(6, 100), 'Enginar (taze kalp)': x(6, 100), 'Semizotu': x(6, 200),
  'Fasulye (taze)': x(6, 100), 'Lahana (beyaz / kara)': x(6, 150), 'Börülce': x(6, 100), 'Tatlı patates (fırın)': x(15, 60),
  // Hazır yemekler (porsiyonun ilk ölçüsüne göre)
  'Etli nohut': x(22.5, 200), 'Etli kuru fasulye': x(22.5, 200), 'Tas kebabı': x(0, 200), 'Saç kavurma': x(0, 150),
  'Sulu köfte': x(15, 250), 'Kuru köfte (ekonomik köfte)': x(22.5, 120), 'İzmir köfte': x(15, 250), 'Falafel dürüm / porsiyon': x(45, 250),
  'Karnabahar kızartması': x(15, 125), 'Kabak mücver': x(15, 120), 'Patlıcan musakka (beşamel)': x(22.5, 250),
  'Fasulye pilaki': x(30, 200), 'Hamsi tava (unlanmış)': x(15, 150), 'Sezar salata': x(6, 250), 'Muhammara': x(7.5, 70),
  'Mercimekli meze (kısıra benzer, domates-biberli)': x(15, 100), 'Mütebbel (patlıcanlı)': x(10, 100),
  'Antep fıstıklı baklava (burma)': x(27.5, 55), 'Sütlü nuriye / fıstıklı sarma': x(22.5, 45),
  'Kalburabastı': x(22.5, 45), 'Bülbül yuvası': x(22.5, 50), 'Brownie': x(22.5, 50), 'Muffin': x(20, 50),
  'Tuzlu çubuk / çubuk kraker': x(15, 20),
  // İçecekler
  'Elma suyu': x(15, 100), 'Portakal / mandalina nektarı': x(15, 100), 'Meyve suyu (100%, şekersiz)': x(15, 100),
  'Greyfurt suyu (taze)': x(15, 150), 'Enerji içeceği (şekerli)': x(30, 250), 'Oral rehidrasyon / izotonik içecek': x(15, 250),
  'Şekerli çay / kahve (bir küp şeker)': x(3, 100),
};

const EXCHANGE_ALL: Record<string, number> = { ...EXCHANGE, ...NEW_STARCH_EXCHANGE };

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

/**
 * Türk ev yemekleri için tarif hesabı.
 * Karbonhidrat, malzeme gramından hesaplanır: Σ(malzeme g × 100 g KHO) ÷ pişmiş toplam ağırlık.
 * Bu bir ölçüm değil, standart tarif varsayımıdır; tencerenin suyu ve yağı sonucu değiştirir.
 * Hazır/alışveriş yemeklerinde porsiyon daha ağır olur, o yüzden büyük porsiyon da tanımlı.
 */
const ING: Record<string, number> = {
  pirinç: 78, bulgur: 68, un: 76, makarna: 73, irmik: 73, 'mısır unu': 76, yufka: 58,
  kıyma: 0, kuzu: 0, tavuk: 0, balık: 0, yumurta: 1, kaşar: 1, yoğurt: 4.5, süt: 4.8, yağ: 0,
  soğan: 9, salça: 15, domates: 4, biber: 5, patlıcan: 3, kabak: 3, patates: 17, havuç: 7,
  lahana: 6, 'asma yaprağı': 11, limon: 6, nohut: 58, mercimek: 55, barbunya: 60, bakla: 7, bamya: 7,
  şeker: 100, pekmez: 75, ceviz: 7, dut: 10, ayva: 13, 'hindistan cevizi': 24,
};

type Recipe = {
  name: string;
  category: string;
  /** Pişmiş toplam ağırlık (g). Karbonhidrat bu ağırlığa bölünür. */
  yield: number;
  items: [string, number][];
  portions: Portion[];
  flag?: 'fatty' | 'fast';
};

const RECIPES: Recipe[] = [
  // Çorbalar
  {
    name: 'Düğün çorbası', category: 'Çorbalar', yield: 1200,
    items: [['un', 40], ['yoğurt', 200], ['yumurta', 50], ['kıyma', 100], ['soğan', 40], ['salça', 15], ['yağ', 20]],
    portions: [P('1 kepçe', 75, 'olcu', 'kepçe'), P('1 standart kase (200 ml)', 200, 'olcu', 'kase'), P('1 büyük kase (250 ml)', 250, 'porsiyon', 'kase')],
  },
  {
    name: 'Yeşil mercimek çorbası', category: 'Çorbalar', yield: 1200,
    items: [['mercimek', 120], ['soğan', 60], ['havuç', 50], ['patates', 80], ['salça', 20], ['un', 20], ['yağ', 20]],
    portions: [P('1 kepçe', 75, 'olcu', 'kepçe'), P('1 standart kase (200 ml)', 200, 'olcu', 'kase'), P('1 büyük kase (250 ml)', 250, 'porsiyon', 'kase')],
  },
  {
    name: 'Erişteli yeşil mercimek çorbası', category: 'Çorbalar', yield: 1300,
    items: [['mercimek', 120], ['makarna', 80], ['soğan', 60], ['salça', 20], ['yağ', 20]],
    portions: [P('1 kepçe', 75, 'olcu', 'kepçe'), P('1 standart kase (200 ml)', 200, 'olcu', 'kase'), P('1 büyük kase (250 ml)', 250, 'porsiyon', 'kase')],
  },
  {
    name: 'Balık çorbası', category: 'Çorbalar', yield: 1200,
    items: [['balık', 400], ['patates', 150], ['havuç', 60], ['soğan', 60], ['un', 20], ['yağ', 20]],
    portions: [P('1 kepçe', 75, 'olcu', 'kepçe'), P('1 standart kase (200 ml)', 200, 'olcu', 'kase')],
  },
  // Ana yemekler
  {
    name: 'Kuru dolma (etli)', category: 'Ana Yemekler', yield: 900,
    items: [['biber', 350], ['patlıcan', 200], ['pirinç', 70], ['kıyma', 150], ['soğan', 60], ['salça', 25], ['yağ', 30]],
    portions: [P('1 adet', 80, 'adet', 'adet'), P('2 adet', 160, 'adet', 'adet'), P('1 porsiyon (3-4 adet)', 300, 'porsiyon', 'adet')],
    flag: 'fatty',
  },
  {
    name: 'Kabak dolması (etli)', category: 'Ana Yemekler', yield: 800,
    items: [['kabak', 450], ['pirinç', 60], ['kıyma', 120], ['soğan', 50], ['salça', 20], ['yağ', 20]],
    portions: [P('1 adet', 100, 'adet', 'adet'), P('2 adet', 200, 'adet', 'adet')],
    flag: 'fatty',
  },
  {
    name: 'Lahana sarması (etli)', category: 'Ana Yemekler', yield: 900,
    items: [['lahana', 400], ['pirinç', 80], ['kıyma', 150], ['soğan', 50], ['salça', 25], ['yağ', 25]],
    portions: [P('1 adet', 35, 'adet', 'adet'), P('4 adet', 140, 'adet', 'adet'), P('1 porsiyon (6-7 adet)', 220, 'porsiyon', 'adet')],
    flag: 'fatty',
  },
  {
    name: 'Etli yaprak sarma', category: 'Ana Yemekler', yield: 700,
    items: [['asma yaprağı', 200], ['pirinç', 80], ['kıyma', 150], ['soğan', 50], ['salça', 20], ['yağ', 30]],
    portions: [P('1 adet', 18, 'adet', 'adet'), P('4 adet', 72, 'adet', 'adet'), P('1 porsiyon (8 adet)', 145, 'porsiyon', 'adet')],
    flag: 'fatty',
  },
  {
    name: 'Ekşili köfte', category: 'Ana Yemekler', yield: 1100,
    items: [['kıyma', 200], ['bulgur', 80], ['un', 30], ['yumurta', 50], ['soğan', 50], ['salça', 25], ['patates', 100], ['limon', 20], ['yağ', 20]],
    portions: [P('1 kepçe', 150, 'olcu', 'kepçe'), P('1 porsiyon', 350, 'porsiyon', 'porsiyon')],
  },
  {
    name: 'Ali nazik', category: 'Ana Yemekler', yield: 700,
    items: [['patlıcan', 400], ['yoğurt', 200], ['kuzu', 200], ['yağ', 20]],
    portions: [P('1 porsiyon', 300, 'porsiyon', 'porsiyon')],
    flag: 'fatty',
  },
  {
    name: 'Çökertme kebabı', category: 'Ana Yemekler', yield: 800,
    items: [['patates', 300], ['kuzu', 200], ['yoğurt', 150], ['domates', 100], ['yağ', 40]],
    portions: [P('1 porsiyon', 350, 'porsiyon', 'porsiyon')],
    flag: 'fatty',
  },
  {
    name: 'Güveç (etli sebze)', category: 'Ana Yemekler', yield: 900,
    items: [['kuzu', 250], ['patlıcan', 200], ['biber', 100], ['domates', 150], ['soğan', 60], ['yağ', 30]],
    portions: [P('1 porsiyon', 300, 'porsiyon', 'porsiyon')],
  },
  {
    name: 'Kuzu haşlama', category: 'Ana Yemekler', yield: 800,
    items: [['kuzu', 350], ['patates', 200], ['havuç', 80], ['soğan', 60]],
    portions: [P('1 porsiyon', 300, 'porsiyon', 'porsiyon')],
    flag: 'fatty',
  },
  {
    name: 'Fırında makarna', category: 'Ana Yemekler', yield: 1400,
    items: [['makarna', 250], ['kıyma', 250], ['süt', 300], ['un', 40], ['yağ', 40], ['kaşar', 80], ['salça', 30]],
    portions: [P('1 küçük dilim', 150, 'boyut', 'dilim'), P('1 standart dilim', 250, 'porsiyon', 'dilim'), P('1 büyük dilim', 350, 'boyut', 'dilim')],
    flag: 'fatty',
  },
  {
    name: 'Kıymalı makarna', category: 'Ana Yemekler', yield: 900,
    items: [['makarna', 250], ['kıyma', 150], ['soğan', 60], ['salça', 30], ['yağ', 25]],
    portions: [P('1 küçük porsiyon', 200, 'boyut', 'porsiyon'), P('1 porsiyon', 300, 'porsiyon', 'porsiyon')],
    flag: 'fatty',
  },
  {
    name: 'Şakşuka', category: 'Ana Yemekler', yield: 700,
    items: [['patlıcan', 300], ['patates', 150], ['biber', 100], ['domates', 150], ['soğan', 40], ['yağ', 50]],
    portions: [P('1 yemek kaşığı', 30, 'olcu', 'kaşık'), P('1 porsiyon', 200, 'porsiyon', 'porsiyon')],
    flag: 'fatty',
  },
  {
    name: 'Zeytinyağlı bakla', category: 'Ana Yemekler', yield: 800,
    items: [['bakla', 400], ['soğan', 80], ['un', 15], ['limon', 15], ['yağ', 30]],
    portions: [P('1 porsiyon', 250, 'porsiyon', 'porsiyon')],
  },
  {
    name: 'Etli bamya', category: 'Ana Yemekler', yield: 800,
    items: [['bamya', 350], ['kıyma', 150], ['soğan', 60], ['salça', 25], ['yağ', 20]],
    portions: [P('1 porsiyon', 250, 'porsiyon', 'porsiyon')],
  },
  // Kahvaltı
  {
    name: 'Mıhlama (kuymak)', category: 'Kahvaltılık', yield: 500,
    items: [['mısır unu', 120], ['kaşar', 150], ['yağ', 50]],
    portions: [P('1 yemek kaşığı', 30, 'olcu', 'kaşık'), P('1 küçük porsiyon', 120, 'boyut', 'porsiyon'), P('1 porsiyon', 200, 'porsiyon', 'porsiyon')],
    flag: 'fatty',
  },
  {
    name: 'Çılbır', category: 'Kahvaltılık', yield: 300,
    items: [['yoğurt', 200], ['yumurta', 100], ['yağ', 15]],
    portions: [P('1 porsiyon (2 yumurta)', 250, 'porsiyon', 'porsiyon')],
  },
  {
    name: 'Pişi', category: 'Kahvaltılık', yield: 600,
    items: [['un', 350], ['yoğurt', 100], ['yumurta', 50], ['şeker', 10], ['yağ', 60]],
    portions: [P('1 küçük adet', 40, 'boyut', 'adet'), P('1 standart adet', 60, 'boyut', 'adet'), P('2 adet', 120, 'adet', 'adet')],
    flag: 'fatty',
  },
  // Fast food
  {
    name: 'Çiğ börek', category: 'Fast Food & Sokak', yield: 600,
    items: [['un', 250], ['kıyma', 200], ['soğan', 50], ['yağ', 50]],
    portions: [P('1 küçük adet', 80, 'boyut', 'adet'), P('1 standart adet', 110, 'boyut', 'adet'), P('2 adet', 220, 'adet', 'adet')],
    flag: 'fatty',
  },
  // Tatlılar
  {
    name: 'Kabak tatlısı', category: 'Tatlılar & Atıştırmalık', yield: 800,
    items: [['kabak', 600], ['şeker', 200], ['ceviz', 30]],
    portions: [P('1 dilim', 80, 'boyut', 'dilim'), P('1 porsiyon', 150, 'porsiyon', 'porsiyon')],
    flag: 'fatty',
  },
  {
    name: 'Ayva tatlısı', category: 'Tatlılar & Atıştırmalık', yield: 700,
    items: [['ayva', 500], ['şeker', 180], ['ceviz', 20]],
    portions: [P('1/2 adet', 120, 'porsiyon', 'yarım'), P('1 tam adet', 240, 'boyut', 'adet')],
    flag: 'fatty',
  },
  {
    name: 'Un helvası', category: 'Tatlılar & Atıştırmalık', yield: 500,
    items: [['un', 200], ['yağ', 120], ['şeker', 150], ['süt', 100]],
    portions: [P('1 yemek kaşığı', 25, 'olcu', 'kaşık'), P('1 küçük porsiyon', 60, 'boyut', 'porsiyon')],
    flag: 'fatty',
  },
  {
    name: 'Sütlü irmik tatlısı', category: 'Tatlılar & Atıştırmalık', yield: 900,
    items: [['irmik', 120], ['süt', 600], ['şeker', 150]],
    portions: [P('1 küçük kase', 150, 'boyut', 'kase'), P('1 kase', 220, 'olcu', 'kase')],
    flag: 'fatty',
  },
  {
    name: 'Kemalpaşa tatlısı', category: 'Tatlılar & Atıştırmalık', yield: 800,
    items: [['un', 150], ['yumurta', 100], ['süt', 100], ['şeker', 200]],
    portions: [P('1 adet', 60, 'adet', 'adet'), P('2 adet', 120, 'adet', 'adet')],
    flag: 'fatty',
  },
  {
    name: 'Cezerye', category: 'Tatlılar & Atıştırmalık', yield: 400,
    items: [['havuç', 300], ['şeker', 120], ['ceviz', 40], ['hindistan cevizi', 20]],
    portions: [P('1 dilim (parmak)', 25, 'boyut', 'dilim'), P('2 dilim', 50, 'adet', 'dilim')],
    flag: 'fatty',
  },
];

/**
 * Markalı paketli ürünler.
 * Değerler ürün etiketinden; derleme kaynağı Open Food Facts (ODbL lisanslı, gönüllü katkı).
 * Barkod, kaydı doğrulamak içindir: markette barkodu okutup Open Food Facts'te ürünü bulabilirsin.
 * Etiket değişirse buradaki değer eskir; şüphedeysen paketin üstündeki "Karbonhidrat" satırını esas al.
 */
type BrandRow = [name: string, carbsPer100: number, barcode: string, portions: Portion[], flags?: 'fatty' | 'fast'];

const BRANDS: Record<string, BrandRow[]> = {
  'Tatlılar & Atıştırmalık': [
    ['Ülker Bitter Çikolata (tablet)', 41, '8690766157777', [P('1 tablet', 70, 'porsiyon', 'adet')], 'fatty'],
    ['Kahve Dünyası Tambol Sütlü Çikolata', 51, '8699270023585', [P('1 paket', 77, 'porsiyon', 'adet')], 'fatty'],
    ['Ülker Çikolatalı Gofret', 58, '8690504020509', [P('1 adet', 39, 'adet', 'adet')], 'fatty'],
    ['Ülker Çikolatalı Gofret Maxi', 53, '8690504136514', [P('1 adet', 47, 'adet', 'adet')], 'fatty'],
    ['Ülker Dido Sütlü Çikolatalı Gofret', 57, '8690504028536', [P('1 adet', 35, 'adet', 'adet')], 'fatty'],
    ['Ülker 9 Kat Tat Portakallı Gofret', 63, '8690504086093', [P('1 adet', 39, 'adet', 'adet')], 'fatty'],
    ['Eti Gold Çikolatalı Gofret', 63, '8690526019222', [P('1 adet', 29, 'adet', 'adet')], 'fatty'],
    ['Eti Tutku Bisküvi', 61, '8690526083254', [P('1 küçük paket', 30, 'boyut', 'paket'), P('1 paket', 100, 'porsiyon', 'paket')], 'fatty'],
    ['Ülker Probis Proteinli Bisküvi', 56, '8690504961482', [P('1 paket', 75, 'porsiyon', 'paket')], 'fatty'],
    ['Ülker Altınbaşak Çörekotlu Kinoalı Bisküvi', 64, '8690504011828', [P('1 paket', 40, 'porsiyon', 'paket')], 'fatty'],
    ["Lay's Yoğurt ve Mevsim Yeşillikli Cips", 52, '8690624104639', [P('1 küçük paket', 40, 'boyut', 'paket'), P('1 paket', 107, 'porsiyon', 'paket')], 'fatty'],
    ["Lay's Baharatlı Cips", 52, '8690624105766', [P('1 küçük paket', 40, 'boyut', 'paket'), P('1 paket', 125, 'porsiyon', 'paket')], 'fatty'],
    ['Ruffles Sade Patates Cipsi', 51, '8690624105742', [P('1 küçük paket', 40, 'boyut', 'paket'), P('1 paket', 125, 'porsiyon', 'paket')], 'fatty'],
    ['Samba Tırtıklı Sade Patates Cipsi', 52, '8699118033516', [P('1 paket', 150, 'porsiyon', 'paket')], 'fatty'],
    ['Pukka Glütensiz Sade Patates Cipsi', 48, '8683880758012', [P('1 paket', 70, 'porsiyon', 'paket')], 'fatty'],
    ['Pukka Yoğurt ve Mevsim Yeşillikli Cips', 52, '8683880758043', [P('1 paket', 70, 'porsiyon', 'paket')], 'fatty'],
    ['Ülker Çizi Peynirli Kraker', 61, '8690766009205', [P('1 küçük paket', 35, 'boyut', 'paket'), P('1 paket', 70, 'porsiyon', 'paket')]],
    ['Eti Crax Sade Çubuk Kraker', 73, '8690533034010', [P('1 paket', 40, 'porsiyon', 'paket')]],
    ['Eti Crax Acı Baharatlı Çubuk Kraker', 68, '8690526044873', [P('1 paket', 50, 'porsiyon', 'paket')]],
    ['Eti Form Zeytinli Kinoalı Çubuk Kraker', 64, '8690533094519', [P('1 paket', 50, 'porsiyon', 'paket')]],
    ['Ülker Susamlı Çörek Otlu Kraker', 59, '8690504188209', [P('1 paket', 44, 'porsiyon', 'paket')]],
    ['Eti Popkek Vişneli', 56, '8690526073873', [P('1 adet', 60, 'adet', 'adet')], 'fatty'],
    ['Eti Popkek Çikolatalı', 57, '8690526083711', [P('1 adet', 60, 'adet', 'adet')], 'fatty'],
    ['Eti Popkek Muzlu', 57, '8690526083728', [P('1 adet', 60, 'adet', 'adet')], 'fatty'],
    ['Eti Browni Gold', 52, '8690526053738', [P('1 adet', 45, 'adet', 'adet')], 'fatty'],
    ['Eti Browni Antep Fıstıklı', 46, '8690526954127', [P('1 adet', 35, 'adet', 'adet')], 'fatty'],
    ['Ülker Pöti Kek', 52, '8690504079767', [P('1 adet', 35, 'adet', 'adet')], 'fatty'],
    ['Ülker K Ekstra Konfeti Kek', 57, '8690504077411', [P('1 adet', 38, 'adet', 'adet')], 'fatty'],
    ['Algida Maraş Usulü Sade Dondurma', 23, '8683130040492', [P('1 top', 50, 'adet', 'adet'), P('1 kase (3 top)', 150, 'olcu', 'kase')], 'fatty'],
    ['Magnum Cookie Dondurma', 32, '8690637936036', [P('1 adet', 95, 'adet', 'adet')], 'fatty'],
    ['Algida Twister Forest', 20, '8690637943447', [P('1 adet', 70, 'adet', 'adet')], 'fatty'],
    ['Eti Alaska Frigo Bitter Çikolata Kaplı', 32, '8690526099613', [P('1 adet', 60, 'adet', 'adet')], 'fatty'],
    ['Bugido Dudi Kornet Dondurma', 26, '8695077001078', [P('1 adet', 70, 'adet', 'adet')], 'fatty'],
    ['Algida Klasik Vanilyalı Dondurma', 26, '8690637846908', [P('1 adet', 65, 'adet', 'adet')], 'fatty'],
  ],
  'Süt & İçecekler': [
    ['Cappy Karışık Meyve Suyu', 10, '5449000046048', [P('1 kutu (330 ml)', 330, 'adet', 'kutu')], 'fast'],
    ['Uludağ Meyvelim Greyfurt Suyu', 11, '1500144801604', [P('1 bardak (200 ml)', 200, 'olcu', 'bardak'), P('1 şişe (1 L)', 1000, 'adet', 'şişe')], 'fast'],
    ['Harras Organik %100 Kırmızı Meyve Suyu', 11, '8695077141552', [P('1 bardak (200 ml)', 200, 'olcu', 'bardak'), P('1 şişe (700 ml)', 700, 'adet', 'şişe')], 'fast'],
    ['Sütaş Ayran', 2, '8690767714450', [P('1 kutu (175 ml)', 175, 'adet', 'kutu'), P('1 bardak (200 ml)', 200, 'olcu', 'bardak')]],
  ],
};

/** Tariften 100 g başına karbonhidrat */
function recipeCarbs(r: Recipe): number {
  const total = r.items.reduce((sum, [key, grams]) => {
    const base = ING[key] ?? ING[key.toLocaleLowerCase('tr-TR')] ?? 0;
    return sum + (base * grams) / 100;
  }, 0);
  return Math.round((total / r.yield) * 100 * 10) / 10;
}

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

export const FOODS: Food[] = [
  ...Object.entries(DATA).flatMap(([category, rows]) =>
    rows.map(([name, carbsPer100, portions, flag]) => ({
      id: slug(`${category}-${name}`),
      name,
      category,
      carbsPer100: ZERO_BASE.has(name) ? 0 : carbsPer100,
      exPer100: HOSPITAL[name] ?? EXCHANGE_ALL[name],
      meat: MEAT.has(name) || undefined,
      portions: mergePortions(HOSPITAL_PORTIONS[name] ?? PORTIONS[name] ?? portions, portions),
      fatty: flag === 'fatty' || undefined,
      fast: flag === 'fast' || undefined,
    })),
  ),
  ...RECIPES.map((r) => ({
    id: slug(`${r.category}-${r.name}`),
    name: r.name,
    category: r.category,
    carbsPer100: recipeCarbs(r),
    // Bu yemekler için hastane değişim listesi kuralı yok; iki yöntem de tarif değerini kullanır.
    portions: mergePortions(r.portions),
    fatty: r.flag === 'fatty' || undefined,
    fast: r.flag === 'fast' || undefined,
  })),
  ...Object.entries(BRANDS).flatMap(([category, rows]) =>
    rows.map(([name, carbsPer100, barcode, portions, flag]) => ({
      id: slug(`${category}-${name}`),
      name,
      category,
      carbsPer100,
      // Etiketteki 100 g değeri esas; değişim yöntemi için ayrı kural yok.
      portions: mergePortions(portions),
      barcode,
      fatty: flag === 'fatty' || undefined,
      fast: flag === 'fast' || undefined,
    })),
  ),
];

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
