import * as d from '../../data/foods-tr';

describe('tarif tabanli Turk yemekleri', () => {
  it('tarif degerleri makul aralikta ve ornekler dogru', () => {
    const beklenen: Record<string, number> = {
      'Düğün çorbası': 3.8,
      'Yeşil mercimek çorbası': 8.9,
      'Kuru dolma (etli)': 9.7,
      'Etli yaprak sarma': 13.1,
      'Ali nazik': 3,
      'Güveç (etli sebze)': 2.5,
      'Fırında makarna': 16.6,
      'Mıhlama (kuymak)': 18.5,
      'Pişi': 46.8,
      'Ayva tatlısı': 35.2,
      'Un helvası': 61.4,
    };
    for (const [name, carb] of Object.entries(beklenen)) {
      const food = d.FOODS.find((f) => f.name === name);
      expect(food).toBeDefined();
      expect(food!.carbsPer100).toBeCloseTo(carb, 1);
    }
  });

  it('tarif yemekleri kategorileri gecerli ve tekrarsiz', () => {
    const names = d.FOODS.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
    for (const food of d.FOODS) expect(d.CATEGORIES).toContain(food.category);
  });

  it('hicbir yemek 100 g icin 100 g karbonhidrat asmiyor', () => {
    // "Sebze yemeğindeki pirinç / bulgur (kaşık sayısı)" bilerek 450: gram değil kaşık sayısı girilir.
    for (const food of d.FOODS) {
      if (food.name.startsWith('Sebze yemeğindeki')) continue;
      expect(food.carbsPer100).toBeLessThanOrEqual(100);
    }
  });

  it('markali urunlerin barkodu benzersiz ve gecerli', () => {
    const branded = d.FOODS.filter((f) => f.barcode);
    expect(branded.length).toBeGreaterThanOrEqual(35);
    const codes = branded.map((f) => f.barcode!);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[0-9]{8,14}$/);
  });

  it('markali urun degerleri etiket araliginda', () => {
    const aralik: Record<string, [number, number]> = {
      'Tatlılar & Atıştırmalık': [15, 80],
      'Süt & İçecekler': [0, 20],
    };
    for (const food of d.FOODS.filter((f) => f.barcode)) {
      const [min, max] = aralik[food.category] ?? [0, 100];
      expect(food.carbsPer100).toBeGreaterThanOrEqual(min);
      expect(food.carbsPer100).toBeLessThanOrEqual(max);
    }
  });
});
