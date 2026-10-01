# Diyabet Asistanı

Tip 1 diyabet için karbonhidrat sayımı ve insülin dozu yardımcısı (Android / iOS, Expo).

## Özellikler

- **Hesapla** — şeker + karbonhidrat → önerilen doz (yemek + düzeltme − aktif insülin − egzersiz azaltması, kalem adımına yuvarlanmış). Hesabın her adımı ekranda gösterilir.
  - **Kaç g yerim?** — belli bir dozla kaç gram karbonhidrat alınabileceği
  - **Düzeltme** — hedefe / aralığa inmek için gereken doz
  - **Düşüyor** — aktif insülin ve aktif karbonhidrata göre hedefte kalmak için gereken karbonhidrat
- **Oranlar** — varsayılan tek oran; istenirse saat dilimine göre ayrı KH oranı, düzeltme faktörü, hedef ve hedef aralık; dilim saate göre otomatik seçilir.
- **Güvenlik** — 70 altında doz yerine hipo yönlendirmesi, 54 altında glukagon/112 uyarısı, 250 üstünde keton uyarısı, azami doz sınırı, üst üste doz (yığılma) uyarısı.
- **Hipo modu** — 15-15 kuralı, aktif insüline göre ek karbonhidrat, 15 dk sayaç + bildirim, tekrar ölçüm.
- **Yemekler** — ~190 kalemlik Türk mutfağı karbonhidrat listesi, porsiyon/gram ile tabak, favoriler, kendi yemeklerin, kayıtlı öğünler.
- **Öğünler** — Sabah, sabah ara, öğle, öğle ara, akşam yemeği, akşam ara ve gece 3. Kayıt saatine göre otomatik seçilir (saatleri Ayarlar > Öğün saatleri), istersen değiştirir ve geçmişe dönük kayıt girersin. Raporlarda öğün bazlı özet var.
- **Şeker ölçüm saati** — Şekeri ne zaman ölçtüğünü girebilirsin; aradaki insülin ve karbonhidrat hesaba katılıp şimdiki şeker tahmin edilir.
- **Doktor raporu** — Günlük sekmesinden seçtiğin gün aralığı için PDF: oranların, insülinlerin, şeker grafiği, özet ve her günün ölçüm/yemek/insülin saatleriyle tam kaydı; Excel için CSV de var.
- **Günlük** — 24 saatlik şeker grafiği, aralıkta kalma yüzdesi, 7/14/30 gün özeti, Excel uyumlu CSV dışa aktarma.
- **Öğren** — oranlarını bilmeyenler için: günlük dozdan başlangıç tahmini (500/1800 kuralı), rehberli testler (karbonhidrat oranı, düzeltme faktörü, bazal), kayıtlardan öneri (en az 3 uygun test, tek seferde en fazla %20, onaysız uygulanmaz), karbonhidrat sayma rehberi ve etiket hesaplayıcı.
- **Ayarlar** — insülin tipi ve etki süresi, kalem adımı, bazal hatırlatıcı, eşikler, egzersiz yüzdeleri, JSON yedek / geri yükleme.

Tüm veriler yalnızca cihazda saklanır.

## Telefonda çalıştırma

1. Telefonuna **Expo Go** uygulamasını kur (Play Store / App Store).
2. Bilgisayarda bu klasörde:
   ```bash
   npm install
   npx expo start
   ```
3. Çıkan QR kodu Android'de Expo Go ile, iPhone'da kamera ile okut. Telefon ve bilgisayar aynı Wi-Fi ağında olmalı.

Kalıcı kurulum (APK/IPA) için: `npx eas-cli@latest build -p android --profile preview`

## Geliştirme

```bash
npm test            # hesaplama mantığı testleri
npm run typecheck
npx expo lint
npx expo start --web
```

Hesaplama mantığı `src/logic/` altındadır (saf fonksiyonlar, testleri `src/logic/__tests__`).
