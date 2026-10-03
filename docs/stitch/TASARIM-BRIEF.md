# Diyabet Asistanı — Stitch tasarım özeti

Bu dosya Google Stitch'e yapıştırmak için hazırlandı. Aynı klasördeki PNG'ler uygulamanın **mevcut** ekranlarıdır (referans olarak Stitch'e yüklenebilir; numara sırası aşağıdaki ekran listesiyle aynı).

## 1. Stitch'e yapıştırılacak ana istem (English, Turkish UI copy)

> Design a complete, calm and trustworthy **mobile app theme and screen set** for **"Diyabet Asistanı"**, a personal carb-counting and insulin-dose helper for people with **Type 1 diabetes** (multiple daily injections with pens, mg/dL). UI language is **Turkish**. Users range from first-time beginners to experienced patients, and their doctor will also read the app's reports.
>
> **Goals:** a first-time user must never feel lost: every screen says what it is for, the next action is obvious, big touch targets (min 48 px), strong contrast, no clutter. Safety information (low glucose, ketones, max dose) must be unmistakable but never panicky.
>
> **Style:** soft "sea glass" – misty green-grey background, deep ocean-ink text, one teal action colour, generous rounded corners (14–20 px), soft shadows in light mode, hairline borders instead of shadows in dark mode. Font: Figtree (or similar humanist sans), body 16 px, big tabular numbers for glucose values. Subtle motion only (springy press, count-up of dose number). Provide **light and dark** themes.
>
> **Colour roles (keep semantics strict):** Teal `#0B7A86` = brand / primary action only. **Glucose status is a separate scale used everywhere the same way:** in-range = green `#1F7A4D`, above target = amber `#8A5300`, low/hypo = coral red `#C23A2E`; info = blue `#1D5F8F`. Light bg `#EDF3F2`, card `#FFFFFF`, text `#10292D`, muted `#52686C`. Dark bg `#081417`, card `#0F2327`, primary `#4CC3CF`, text `#E8F3F3`.
>
> **Bottom tab bar (5):** Ana sayfa, Doz, Günlük, Öğren, Ayarlar (icon + label always visible).
>
> Design all screens listed below in both themes, plus a consistent component kit: cards, section headers with icon, chips (selected / unselected), segmented control, big number input with +/- steppers, primary / secondary / ghost / danger buttons, notices (info / warning / danger), toast with "Geri al", collapsible section, glucose chart with target band, stat tiles, stacked in-range bar.

## 2. Ekran listesi (referans görüntüler)

| # | Ekran | Ne yapar / içinde ne var |
|---|---|---|
| 00 | İlk açılış (Onboarding) | 5 adımlı karşılama: insülinleri seç, oranları gir veya "birlikte bulalım", özet ve "Başla". |
| 01 / 01b / 16 | **Ana sayfa** (açık / alt kısım / koyu) | Selamlama, son şeker (büyük, renkli) + aktif insülin + bugünkü toplam, 6 büyük kısayol kutusu (Yemek yiyeceğim, Şekerim düşük, Şeker ölçtüm, Yemek listesi, Günlüğüm, Doktor raporu), başlangıç rehberi, bazal hatırlatma kartı, tokluk hatırlatma ve "oranların için öneri var" kartları. |
| 02 / 17 | **Doz hesapla** (açık / koyu) | Aktif insülin "su seviyesi", saat dilimi oranları, şeker + karbonhidrat girişi, tabaktaki yemekler (gram +/−), öğün seçimi, egzersiz, büyük doz sonucu ve "hesabın detayı", doz kaydet. 4 mod: yemek, sadece düzeltme, bu dozla kaç g, şekerim düşüyor. |
| 03 / 15 / 18 | **Günlük** (gün / hafta / koyu) | Gün–Hafta seçici, şeker grafiği (hedef bantlı, noktalar duruma göre renkli, altında insülin ve KH işaretleri), hedef aralık çubuğu, istatistik kutuları (ortalama, KH, insülin, GMI, CV), kayıt listesi ("+ Tokluk şekeri ekle"), hafta görünümünde günlere göre tablo. |
| 04 | Öğren › Oranlarımı bul | Adım adım oran testleri (KH oranı, düzeltme, bazal), öneri kartları, "Ayarlara uygula". |
| 05 | Öğren › KH saymayı öğren | Karbonhidrat anlatımı, adımlar, etiketten hesaplama, ipuçları. |
| 06 | Öğren › Oranlarım ve gidişat | Oran gidişatı cümleleri, öğüne göre tablo (kahvaltı/öğle/akşam), dönemlere göre değişim, bazal gidişatı, veri kalitesi önerileri, oran düzenleyici, değişiklik geçmişi. |
| 07 | **Ayarlar** | Görünüm (açık/koyu/otomatik), insülinler, sayım yöntemi (değişim listesi / gerçek bileşim), öğün saatleri, bazal ve hatırlatıcı, uyarı eşikleri, yedekleme. |
| 08 | **Yemek listesi** | Tabak özeti, öğün çipleri, arama, kategoriler, porsiyon/gram seçimi, "Bu tabağı sık yenen şablon olarak kaydet", kayıtlı tabak şablonları. |
| 14 | Yemek seç (modal) | Aynı liste, kayıt/doz ekranından açılır; "Hesaplamaya dön". |
| 09 | **Düşük şeker** (hipo) | Şekere göre hesaplanan hızlı karbonhidrat (büyük kırmızı sayı), beklenen şeker, grama göre seçenekler (tablet, meyve suyu, kola, şeker, bal), "Aldım, sayacı başlat", 15 dk geri sayım halkası, tekrar ölçüm, düzeldi ekranı. |
| 10 | Düşük şeker — şeker düşük DEĞİL | Yüksek/normal şekerde "karbonhidrat alma" uyarısı, doz hesapla / kapat. |
| 11 | Kayıt ekle | Zaman, öğün, şeker + ölçüm saati + tokluk şekeri, karbonhidrat, yemek listesi, insülinler, hipo KH, keton, egzersiz, not. |
| 12 | Doktor raporu | Gün aralığı seçimi, dönem özeti, rapora eklenecek bölümler, PDF/CSV paylaş. |
| 13 | Oran testi | Rehberli test: adım adım ilerleme, geri sayım, sonuç değerlendirmesi. |

## 3. Tasarım kuralları (değişmesin)
- Şeker rengi her yerde aynı: **yeşil = hedefte, kehribar = hedef dışı, kırmızı = hipo.** Turkuaz yalnızca marka ve ana düğme.
- Türkçe, kısa, sade cümleler; terimlerin yanında "?" ile açıklama.
- Doz ve hipo ekranlarında dikkat dağıtıcı süs yok; sayı en büyük öğe.
- Açık ve koyu tema aynı bilgi hiyerarşisi.
- Dokunma hedefi ≥ 48 px, alt çubukta ikon + etiket.
