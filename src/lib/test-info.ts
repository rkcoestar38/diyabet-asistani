import type { TestKind } from '@/store/tests';

export const TEST_INFO: Record<TestKind, { title: string; what: string; when: string; steps: string[] }> = {
  icr: {
    title: 'Karbonhidrat oranı testi',
    what: '1 ünitenin gerçekten kaç gram karbonhidratı karşıladığını bulur.',
    when: 'Son yemek ve son insülinden en az 4 saat sonra, şekerin hedef aralıktayken.',
    steps: [
      'Karbonhidratını tam bildiğin, az yağlı bir öğün seç (ör. tartılmış ekmek + peynir). Pizza, kızartma gibi yağlı yemekler uygun değil.',
      'Şekerini ölç, karbonhidratı gir; uygulamanın önerdiği dozu vur ve kaydet.',
      '3 saat boyunca bir şey yeme, düzeltme yapma, spor yapma.',
      '3 saat sonra (2,5–5 saat arası olur) şekerini ölç ve gir.',
    ],
  },
  isf: {
    title: 'Düzeltme faktörü testi',
    what: '1 ünitenin şekerini gerçekte kaç mg/dL düşürdüğünü bulur.',
    when: 'Şekerin hedef aralığın üstündeyken, son yemek ve son insülinden en az 4 saat sonra.',
    steps: [
      'Şekerini ölç; uygulamanın önerdiği düzeltme dozunu vur ve kaydet.',
      'Yaklaşık 3 saat yemek yeme, spor yapma.',
      '3 saat sonra (2,5–5 saat arası olur) şekerini ölç ve gir.',
    ],
  },
  basal: {
    title: 'Bazal (uzun etkili) insülin testi',
    what: 'Yemek yemediğinde şekerinin sabit kalıp kalmadığını, yani bazal dozunun uygun olup olmadığını gösterir.',
    when: 'Gece (akşam yemeğini erken ye) veya bir öğünü atlayarak; son yemek ve insülinden en az 4 saat sonra, şekerin 100–200 arasındayken.',
    steps: [
      'Başlangıç şekerini gir.',
      'Test boyunca yemek yeme ve hızlı insülin vurma (su, şekersiz çay olur).',
      'Her 2 saatte bir şekerini ölç ve gir (gece testinde örn. 22:00, 00:00, 03:00, 07:00).',
      'Şekerin 70’in altına inerse testi bırak ve hipoyu tedavi et.',
      'En az 6–8 saat sonra testi bitir.',
    ],
  },
};
