# Diyabet Asistanı — Denetim Raporu #3
## Günlük · Öğren · Ayarlar · Doktor Raporu (PDF) ve Oran Gidişatı

**Denetim ajanı:** bunny (alt ajan 3)
**Tarih:** 06.10.2026 (tarayıcı saat dilimi Europe/Istanbul)
**Ortam:** React Native Web / Expo Router, Metro `http://localhost:8081`, agent-browser oturumu `audit-c`, onboarding tamamlandı (NovoRapid · standart hız · tam ünite · hedef 110 · ICR 10 / ISF 50 / 80–140)
**Mobil viewport:** 390 × 844 (taşma ölçümleri bu genişlikte yapıldı)

---

## 0. Yöntem ve kanıt sınırları

**Görsel okuma desteklenmiyor.** Bu oturumun modeli (`space-bunny-free`) görüntü girdisi bildirmiyor; `read_image` çağrısı
`model "space-bunny-free" does not declare image input` hatasıyla döndü. Bu nedenle her bulgu **üç bağımsız kanıtla**
doğrulandı:

1. **a11y snapshot metni** (`agent-browser --session audit-c snapshot -i`)
2. **`agent-browser --session audit-c eval` ile ölçüm** — `getBoundingClientRect()` ile taşma/dokunma hedefi ölçümü,
   `document.querySelectorAll('[role=switch]')` ile `aria-*` nitelik denetimi, `localStorage` durum denetimi
3. **Ekran görüntüsü dosyası** — `audit/shots/` altına kaydedildi (dosya adları raporda kanıt olarak verilmiştir;
   bu dosyaları insan gözüyle kontrol etmek önerilir)

Ek olarak 390 px genişlikte dört ekranın tamamında yatay taşma taraması yapıldı: **0 taşma** (`getBoundingClientRect`
sol/sağ sınır kontrolü). Yani bulguların hiçbiri "taşma/kırpılma" kaynaklı değildir; hepsi işlev/metin/erişilebilirlik
temellidir.

---

# 1. GÜNLÜK SEKMESİ — `src/app/(tabs)/log.tsx`

### Kaynaktan çıkarılan tıklanabilir öğeler

| # | Öğe | Satır | Amaç (koddan) |
|---|---|---|---|
| G-1 | `Önceki` chevron `Pressable` | log.tsx:78 | Gün modunda 1 gün / hafta modunda 1 ay geri |
| G-2 | `Sonraki` chevron `Pressable` | log.tsx:84-89 | Gün modunda 1 gün / hafta modunda 1 ay ileri (bugünde devre dışı) |
| G-3 | `Segmented` Gün / Hafta | log.tsx:92-99 | Görünüm modu |
| G-4 | `Chip` "1. hafta …" | log.tsx:105 | Ay içindeki haftayı seç |
| G-5 | `Btn` "Kayıt ekle" | log.tsx:139 | `/entry` |
| G-6 | `Btn` "Bazal kaydet" | log.tsx:140 | `/entry?basal=1` |
| G-7 | `Btn` "Doktor raporu (PDF)" | log.tsx:142 | `/report` |
| G-8 | `Segmented` 7 / 14 / 30 gün | log.tsx:167-175 | "Genel bakış" dönem istatistiği |
| G-9 | `DayTable` satır `Pressable` | log.tsx:205 | Gün moduna dön, o günü aç |
| G-10 | `EntryRow` `Pressable` | log.tsx:276 | `/entry?id=…` (düzenle/sil) |
| G-11 | `Pressable` "+ Tokluk şekeri ekle" | log.tsx:307 | `/entry?after=…` |

---

### [ŞİDDET: orta] EKSİK — "Genel bakış" kartında seçili dönemin tarih aralığı yazmıyor
- **Ekran:** Günlük · **Öğe:** `Segmented` 7/14/30 gün (G-8)
- **Sorun:** Üstteki gün navigasyonu "Dün", "5 Eki" gibi **günü** gösterirken, aynı ekrandaki "Genel bakış" kartındaki
  7/14/30 seçimi **bugünden geriye sayar** (log.tsx:55 `today - (periodDays-1)*DAY`). Ekranda hangi tarihleri kapsadığı
  hiç yazmıyor. Kullanıcı geçmiş bir günü incelerken altta bugüne ait bir özet görüyor ve bunları karıştırıyor.
  Doktor raporu ekranı aynı bilgiyi açıkça veriyor (`dayLabel(range.from) – dayLabel(range.to)`, report.tsx:182-184),
  yani tutarsızlık uygulama içinde.
- **KANIT:** `c-log-01-bos-durum.png`, `c-log-05-hafta-gorunum.png`; kaynak: `src/app/(tabs)/log.tsx:166-181`
  (karşılaştırma: `src/app/report.tsx:182`)
- **Yeniden üretim:** Günlük → "Önceki" (Dün'e geç) → ekranın altına kaydır → "Genel bakış" kartındaki 7/14/30
  düğmelerine bak. Hangi tarih aralığını seçtiğini gösteren hiçbir metin yok.
- **Öneri:** "Genel bakış" kartına `28 Eyl – 6 Eki gibi` tek satır aralık etiketi ekle (rapor ekranındaki `dayLabel`
  yardımcısı hazır).

### [ŞİDDET: düşük] EKSİK — "Bazal kaydet", Ayarlar'da doz tanımlanmamışsa boş form açıyor
- **Ekran:** Günlük → **Öğe:** `Btn` "Bazal kaydet" (G-6)
- **Sorun:** Düğme her zaman `/entry?basal=1` açıyor. `entry.tsx:90` ancak `settings.basalDose > 0` ise alanı
  dolduruyor; varsayılan `basalDose: 0` iken alan boş ve "Kaydet" pasif kalıyor. Kullanıcı hangi değeri yazacağını
  bilmiyor, ekranda da "Ayarlar > Bazal > Günlük doz" yönlendirmesi yok — Günlük ekranından Ayarlar'a giden bir bağlantı da yok.
- **KANIT:** `c-log-04-bazal-form.png` (snapshot: `textbox "Bazal"` boş + `button "Kaydet" [disabled]`);
  kaynak: `src/app/(tabs)/log.tsx:140`, `src/app/entry.tsx:90`, `src/store/settings.ts` (`DEFAULT_SETTINGS.basalDose = 0`)
- **Yeniden üretim:** Onboarding sonrası hiç bazal doz girilmeden Günlük → "Bazal kaydet" → alan boş, Kaydet pasif.
  (Doz tanımlandıktan sonra tekrar denedim: alan `Bazal (Tresiba): 22` olarak doğru doluyor — yani sorun yalnızca
  varsayılan durumda.)
- **Öneri:** `basalDose === 0` iken alana "ör. 20" placeholder'ı + "Bu değeri Ayarlar > Bazal bölümünden de
  değiştirebilirsin" ipucu göster; ya da boş geldiğinde kullanıcıyı Ayarlar'a yönlendiren bir metin.

### [ŞİDDET: düşük] ÇELİŞKİ — Bazal kaydına bir "öğün" etiketi yapıştırılıyor
- **Ekran:** Günlük → **Öğe:** G-6 → kayıt listesi (G-10)
- **Sorun:** `/entry?basal=1` ekranında öğün seçici normal şekilde görünüyor ve kaydedilen bazal kaydına saatten
  otomatik bir öğün atanıyor. Günlük listesinde bu, `04:11 · Gece 3 · — · 20 Ü bazal` gibi anlamsız bir satır olarak
  görünüyor (bazal dozun öğünü yoktur). Görüntüde de `Gece 3 · saate göre otomatik seçildi, istersen değiştir`
  yazıyor.
- **KANIT:** `c-log-03-uc-kayit.png` (liste satırı `04:11Gece 3—20 Ü bazal`); kaynak: `src/app/(tabs)/log.tsx:140`,
  çıktı `entry.tsx:281` (`entryMeal`) ve `entry.tsx:97` (`autoMeal`)
- **Yeniden üretim:** Günlük → "Bazal kaydet" → 20 yaz → Kaydet → listede bazal satırının solunda bir öğün adı gör.
- **Öneri:** Bazal kaydında öğün etiketi gizlensin (`EntryRow`, log.tsx:262, yalnızca `!e.basal` ise göstersin).

### [ŞİDDET: düşük] WEB-NOTU / a11y — Gün okları buton rolü taşımıyor, devre dışı durumu bildirilmiyor
- **Ekran:** Günlük → **Öğe:** G-1, G-2
- **Sorun:** İki `Pressable` de yalnızca `accessibilityLabel` taşıyor; `accessibilityRole="button"` yok, bu yüzden
  ağaçta `generic … clickable` olarak çıkıyor. Ayrıca bugünde `Sonraki` görsel olarak soluk (`c.border`) ama erişilebilirlik
  ağacında hâlâ tam etkin. `Segmented`/`Chip` için `accessibilityState={{selected}}` verilmiş ama bu RNW sürümünde
  `aria-selected` üretmiyor (bkz. Bölüm 5, WEB-NOTU W-1).
- **KANIT:** `c-log-07-mobil-tam.png`; kaynak: `src/app/(tabs)/log.tsx:78` ve `:84-89`;
  DOM ölçümü: `[aria-label]` etiketli düğümler yalnızca `Önceki`, `Sonraki` ve `role` niteliği `null`
- **Yeniden üretim:** Günlük → `snapshot -i` → iki ok "generic clickable" olarak listeleniyor; ekranı DOM'dan
  incele → `role` yok.
- **Öneri:** İki oka `accessibilityRole="button"` + `accessibilityState={{ disabled: … }}` ekle.

### [ŞİDDET: düşük] WEB-NOTU / a11y — "+ Tokluk şekeri ekle" 31 px ve rolü yok
- **Ekran:** Günlük → **Öğe:** G-11
- **Sorun:** Dokunma alanı ölçüldüğünde **31 px** yükseklikte (`paddingVertical: 6` + 19 px metin), 44 px önerisinin
  altında; `accessibilityRole` verilmediği için ağaçta `generic clickable` olarak çıkıyor (diğer tıklanabilirler `button`).
- **KANIT:** ölçüm: `{h: 31, w: 254}`; snapshot: `generic "+ Tokluk şekeri ekle" [clickable, onclick, tabindex]`;
  kaynak: `src/app/(tabs)/log.tsx:307`
- **Yeniden üretim:** Günlük → karbonhidratlı bir kaydın altındaki bağlantıya bak → ölç.
- **Öneri:** `accessibilityRole="button"` + `minHeight: 44` ekle (metin rengi/fonu aynı kalabilir).

### [ŞİDDET: düşük] EKSİK — Kayıt *düzenlemesi* geri alınamıyor
- **Ekran:** Günlük → **Öğe:** G-10 → `/entry?id=` → "Kaydet"
- **Sorun:** Yeni kayıt eklendiğinde altta "Geri al" bildirimi çıkıyor ve doğru çalışıyor (doğrulandı: sayaç 22 → 23 → 22).
  Ancak kayıt **düzenlendiğinde** bildirim hiç çıkmıyor (`entry.tsx:241` `if (!existing && savedId)`). Yani yanlış
  düşük şeker/doz kaydeden kullanıcı geri dönüp eski değeri elle yazmak zorunda.
- **KANIT:** `c-log-02-tek-kayit.png`, düzenleme sonrası snapshot'ta "Geri al" yok; kaynak: `src/app/entry.tsx:241-247`
- **Yeniden üretim:** Günlük → bir kayda dokun → Karbonhidratı 60→70 yap → Kaydet → altta bildirim yok.
- **Öneri:** `existing` dalında da eski değerleri saklayıp "Değişiklik geri alındı" `toast` göster.

### ✅ TAMAM — doğrulandı (Günlük)

- **"Kayıt ekle"** (`/entry`) — şeker ölçümü, öğün (KH + hızlı insülin) ve bazal kaydı başarıyla açıldı/kaydedildi.
  Kanıt: `c-log-01-bos-durum.png`, `c-log-02-tek-kayit.png`, `c-log-03-uc-kayit.png`
- **"+ Tokluk şekeri ekle"** — `/entry?after=<id>` açıldı, tokluk kaydı `04:11 · Öğle · 165 · Tokluk` olarak oluştu ve
  bağlantı doğru şekilde o satırdan kayboldu (satırda artık tokluk ölçümü var). Kanıt: `c-log-03-uc-kayit.png`
- **Kayıt satırına dokunma (düzenleme)** — `/entry?id=` açıldı; Şeker 180 / KH 60 / 6 Ü / not eksiksiz öntuklendi;
  KH 70'e çekip kaydettikten sonra liste `70 g KH · 6 Ü hızlı` olarak güncellendi. Kanıt: `c-log-02-tek-kayit.png`
- **"Doktor raporu (PDF)"** — `/report` ekranını açtı, geri bağlantısı `/log`e döndü. Kanıt: `c-report-01-bugun.png`
- **Gün navigasyonu (Önceki/Sonraki)** — Bugün → Dün → Bugün; boş günde boş durum metni (`Bu gün için kayıt yok.`)
  doğru çıktı. `Sonraki` bugünde etkisiz.
- **Segmented Gün/Hafta** — Hafta modunda `1. hafta` çipi, `Ayın 1–7. günleri · 1 Eki – 7 Eki` aralığı ve gün tablosu
  (`5 Eki Pzt  163  %0  145–180  —`) geldi; satıra dokununca gün moduna dönüp o günü açtı. Kanıt: `c-log-05-hafta-gorunum.png`
- **Period 7/14/30 gün** — üçü de istatistik kartını yeniden hesapladı (Toplam KH 70 g / 6 Ü / 20 Ü).
- **Boş durum** — kayıt yokken `StatGrid` "Henüz veri yok." gösteriyor; yeni kayıt sonrası Hipo rozeti çıktı.
- **Kayıt ekranı kaydın çocuklarına bağlı kalıyor** — kaydettikten sonra `/entry?basal=1` alan etiketi
  `Bazal (Tresiba)` olarak güncellendi.
- **Yatay taşma yok** (390 px): ölçüm `count: 0`.

---

# 2. ÖĞREN SEKMESİ — `src/app/(tabs)/learn.tsx`

### Kaynaktan çıkarılan tıklanabilir öğeler

| # | Öğe | Satır | Amaç |
|---|---|---|---|
| Ö-1 | `SuggestionView` → "Ayarlara uygula" | learn.tsx:68-69 → ratio-trend.tsx:40-56 | Önerilen ICR/ISF değişikliğini onayla |
| Ö-2 | `Choice` "Devam eden testin var" | learn.tsx:98 | `/test` (aktif test ekranı) |
| Ö-3 | `Choice` "Karbonhidrat oranı testi" | learn.tsx:101 | `/test?kind=icr` |
| Ö-4 | `Choice` "Düzeltme faktörü testi" | learn.tsx:102 | `/test?kind=isf` |
| Ö-5 | `Choice` "Bazal insülin testi" | learn.tsx:103 | `/test?kind=basal` |
| Ö-6 | `Collapsible` "Başlangıç değerini hesapla" | learn.tsx:108-111 | `EstimateForm` |
| Ö-7 | `EstimateForm` → "Oranlarıma uygula" | learn.tsx:121-131 | Tahmin oranlarını uygula |
| Ö-8 | `LabelCalculator` (KH saymayı öğren içinde) | learn.tsx:157 | Etiketten KH hesapla |
| Ö-9 | `RatioTrend` (Oranlarım) | learn.tsx:177 | Gidişat kartları |
| Ö-10 | `RatioEditor` (Oranlarım) | learn.tsx:181 | Oran/dilim düzenleme |
| Ö-11 | `Collapsible` ×3 (bölüm başlıkları) | learn.tsx:37,41,45 | Bölüm aç/kapa |

---

### [ŞİDDET: yüksek] ÇELİŞKİ — "Rehberli bazal testi yap" butonu, aktif test varken **yanlış testi** açıyor
- **Ekran:** Öğren → Oranlarım → "Bazal insülin gidişatı" kartı → **Öğe:** Ö-? (`ratio-trend.tsx:242`)
- **Sorun:** Düğme koşulsuz `/test?kind=basal` adresine gidiyor, ama `test.tsx:21` `if (active) return <ActiveTest />`
  dediği için aktif test varsa **o test** ekranı açılır — istenen bazal testi değil. Düğmenin etiketi ve ikonu
  (`moon`/`flask`) "bazal testi" diyor; kullanıcı ekranda *Karbonhidrat oranı testi* görüyor ve nedenini anlayamıyor.
- **KANIT:** Canlı doğrulama: bir ICR testi başlatılmışken `ratio-trend.tsx:242` düğmesine basıldı →
  `http://localhost:8081/test?kind=basal` açıldı ama ekran metni
  `"Karbonhidrat oranı testi\nBaşlangıç 04:29\nGeçen süre 0 sa 1 dk"` idi.
  Kaynak: `src/components/ratio-trend.tsx:242` + `src/app/test.tsx:21`
- **Yeniden üretim:** Öğren → Oranlarımı bul → Karbonhidrat oranı testi → 110 mg/dL + 45 g gir → "Testi başlat"
  → Öğren → Oranlarım → "Rehberli bazal testi yap".
- **Öneri:** `useTests.active` doluysa bu düğmeyi gizle veya etiketi "Devam eden teste dön" yap; `/test` ekranı da
  istenen `kind` ile aktif testin `kind`'i çeliştiğinde kullanıcıya bilgi versin.

### [ŞİDDET: orta] ÇELİŞKİ — Rehberde **olmayan ekran/sekme** adları
- **Ekran:** Öğren → KH saymayı öğren → **Öğe:** `Steps` (learn.tsx:146-153)
- **Sorun:** Adım 3 ve 4 sırasıyla *"Yemekler sekmesindeki listeden seç"* ve *"Toplam karbonhidratı
  Hesapla ekranına yaz"* diyor. Uygulamada ne "Yemekler" sekmesi ne de "Hesapla" ekranı var:
  alt çubuk `Ana sayfa / Doz / Günlük / Öğren / Ayarlar` (`(tabs)/_layout.tsx:28-35`), yemek listesi `href: null` ile
  çubuk dışında (`_layout.tsx:73`) ve yalnızca *Ana sayfa* (`index.tsx:398`) ile *Doz hesapla*'dan (`calc.tsx:374`)
  açılıyor. Ekranın başlığı "Doz hesapla", sekme etiketi "Doz".
- **KANIT:** `c-learn-06-mobil-tam.png` (metin `…sekmesindeki listeden seç… / …Hesapla ekranına yaz.`);
  kaynak: `src/app/(tabs)/learn.tsx:150-151`; çapraz doğrulama: `src/app/(tabs)/_layout.tsx:30,73`
- **Yeniden üretim:** Öğren → KH saymayı öğren → "Gramı nasıl bulurum?" kartını oku → 3. ve 4. adımları takip etmeye çalış.
- **Öneri:** "Yemekler sekmesi" → "Ana sayfa ya da Doz ekranındaki *Yemek listesinden seç* düğmesi";
  "Hesapla ekranı" → "Doz ekranı".

### [ŞİDDET: orta] EKSİK — Etiketten hesapla kartı çıktıyı hiçbir yere aktaramıyor
- **Ekran:** Öğren → KH saymayı öğren → "Etiketten hesapla" → **Öğe:** Ö-8
- **Sorun:** `learn.tsx:157` `<LabelCalculator />` bileşenini `onUse` vermeden çağırıyor. `label-calc.tsx:59`
  `onUse && valid` koşuluna bağlı olduğu için sonuç ortaya çıktığında **hiçbir eylem düğmesi** render edilmiyor:
  kopyala yok, "bu değeri kullan" yok. Kullanıcı 24 g sonucunu zihninden `Doz`/`Kayıt` ekranına elle taşımak zorunda.
  (Aynı bileşen `/test` ekranında `onUse` ile çalışıyor ve düğme çıkıyor — yani bu bir eksik kablolama.)
- **KANIT:** 100 g'da 60 g / 40 g girildi → ekran `"24 g\n60 × 40 ÷ 100 = 24 g karbonhidrat"`; snapshot'ta
  bu kartta **hiçbir buton yok**. Kaynak: `src/app/(tabs)/learn.tsx:157`, `src/components/label-calc.tsx:59`
  (karşılaştırma: `src/app/test.tsx:103-107` düğmeyi gösteriyor)
- **Yeniden üretim:** Öğren → KH saymayı öğren → Etiketten hesapla → 60 ve 40 gir.
- **Öneri:** `onUse` ile değeri panoya kopyala (`Clipboard`) ya da "Değeri Doz ekranına taşı" gibi tek adımlı bir aktarım.

### [ŞİDDET: orta] ÇELİŞKİ — Aynı kartta "son 6 hafta" ve "son 4 hafta" birbirini tutmuyor
- **Ekran:** Öğren → Oranlarım → "Oran gidişatı" → **Öğe:** metin (ratio-trend.tsx:96) + `Notice` (optimizer.ts:156/162/163)
- **Sorun:** Kartın giriş metni *"Öneriler son **6 haftanın** kayıtlarından hesaplanır"* diyor
  (`RECENT_DAYS = 42`, optimizer.ts:76). Hemen altındaki bildirim ise *"…yeterli uygun kayıt yok (son **4 haftada** 0,
  en az 3 gerekli)"* diyor. İki ifade aynı kartta, arka arkaya, farklı pencereleri tarif ediyor. Teknik olarak ikisi de
  doğru (öneriler 42 gün, trend karşılaştırması 28 gün) ama kullanıcıya hangisinin ne olduğu söylenmiyor.
- **KANIT:** `c-learn-07-oranlarim.png` (aynı ekranda iki metin); kaynak: `src/components/ratio-trend.tsx:96`,
  `src/logic/optimizer.ts:76` ve `:156`
- **Yeniden üretim:** Öğren → Oranlarım → "Oran gidişatı" kartını oku.
- **Öneri:** Bildirim metnine nitelik ekle ("gidişat karşılaştırması son 4 hafta", "oran önerileri son 6 hafta").

### [ŞİDDET: orta] WEB-NOTU / a11y — Bölüm başlıkları (Collapsible) 23 px dokunma hedefi
- **Ekran:** Öğren **ve** Ayarlar → **Öğe:** Ö-11 ve settings.tsx:75/114/129/156/199 başlıkları
- **Sorun:** `guide.tsx:190` `collHead: { flexDirection: 'row', alignItems: 'center', gap: Space.sm }` — dikey
  padding/minHeight yok. 390 px ölçümde **tüm** akordiyon başlıkları **23 px** yükseklikte çıktı (44 px erişilebilir
  dokunma hedefi önerisinin yarısı). Bu, Öğren'in üç ana bölümünün ve Ayarlar'ın beş bölümünün tek gezinme
  mekanizması.
- **KANIT:** Ölçüm (390 px, `[role=button]` taraması):
  `[{t:"Oranlarımı bul",w:324,h:23},{t:"KH saymayı öğren",w:324,h:23},{t:"Oranlarım",w:324,h:23}]`;
  Ayarlar'da: `Sayım yöntemi / Öğün saatleri / Bazal (uzun etkili) insülin / Uyarı eşikleri / Egzersiz öncesi… → h:23`.
  `c-settings-06-mobil-tum.png`, `c-learn-06-mobil-tam.png`. Kaynak: `src/components/guide.tsx:106` ve `:190`
- **Yeniden üretim:** Öğren ekranı → ölçüm (`getBoundingClientRect().height`) veya `c-learn-06-mobil-tam.png`.
- **Öneri:** `collHead`'e `minHeight: 48, paddingVertical: 10` ekle.

### [ŞİDDET: düşük] EKSİK — Aktif test varken üç test kartı da kayboluyor, iptal yolu belli değil
- **Ekran:** Öğren → Oranlarımı bul → **Öğe:** Ö-2
- **Sorun:** `learn.tsx:97-105` — aktif test varsa üç `Choice` kartının **yerine** tek kart geliyor. Bu makul, ancak
  kartın metni yalnızca *"Durumu görmek ve ölçüm girmek için dokun."*; testi **iptal** etmek isteyen kullanıcı
  önce teste girmeli, sonra "Testi iptal et" aramalı. İptal yolu hiç önerilmiyor.
- **KANIT:** Snapshot: `button " Devam eden testin var Durumu görmek ve ölçüm girmek için dokun. "` ve
  üç test kartının **hiçbirinin** listede olmaması. Kaynak: `src/app/(tabs)/learn.tsx:97-105`
- **Yeniden üretim:** Bir test başlat → Öğren → Oranlarımı bul.
- **Öneri:** Karta ikinci satır ekle: *"Bitirmek istemiyorsan teste girip 'Testi iptal et' düğmesini kullan."*

### [ŞİDDET: düşük] ÇELİŞKİ — "Öneriler" kartı testleri "yukarıda" diye gösteriyor
- **Ekran:** Öğren → **Öğe:** Ö-1 boş durum metni
- **Sorun:** `ratio-trend.tsx:35` boş durumda *"Henüz yeterli veri yok. Yukarıdaki testlerden birini yap."* diyor;
  ancak test kartları bu kartın **altındaki** "Oranlarımı bul" bölümünde.
- **KANIT:** `c-learn-01-kapali.png`, `c-learn-07-oranlarim.png`; kaynak: `src/components/ratio-trend.tsx:35`,
  kart konumu `learn.tsx:61` vs testler `learn.tsx:101-103`
- **Öneri:** "Aşağıdaki *Oranlarımı bul* bölümündeki testlerden birini yap."

### ✅ TAMAM — doğrulandı (Öğren)

- **Üç test kartı** — `Karbonhidrat oranı testi` → `/test?kind=icr`, `Düzeltme faktörü testi` → `/test?kind=isf`,
  `Bazal insülin testi` → `/test?kind=basal`: üçü de doğru ekranı açtı. Kanıt: `c-learn-03-bazal-test-basla.png`
- **"Devam eden testin var" kartı** — ICR testi başlatıldığında göründü, `/test`e gitti ve test durumunu
  (`Başlangıç 04:29`, `Geçen süre`, `Bekleme zamanı`) gösterdi.
- **"Testi iptal et"** — onay kutusu `Bu test sonuçlandırılmadan kapatılacak.` çıktı, test kapandı, sonrasında
  `/test?kind=basal` **doğru** bazal test ekranını açtı.
- **"Başlangıç değerini hesapla" + "Oranlarıma uygula"** — 20 Ü bazal + 18 Ü hızlı girildi → `38 Ü → 1 Ü = 14 g,
  1 Ü ≈ 50 mg/dL`; onay `Karbonhidrat oranı 1 Ü = 14 g, düzeltme 1 Ü = 50 mg/dL olarak ayarlanacak.` → uygulandı.
  `ratioHistory`'ye `Tüm gün · KH oranı: 10 → 14 · Başlangıç tahmini (500/1800 kuralı)` düştü. Kanıt: `c-learn-02-tahmin.png`
- **"Ayarlara uygula" (SuggestionView)** — 8 uygun örnek biriktirildi (3/3 eşiği aşıldı), öneri 14→12 gösterildi;
  onay `Karbonhidrat oranı 14 → 12 g/Ü olarak değişecek.` → uygulandı, bildirim `Yeni oran kaydedildi` çıktı ve kart
  `Kayıtların bu oranın iyi çalıştığını gösteriyor.` durumuna geçti. Kanıt: `c-learn-04-oneri-uygula.png`
- **Etiketten hesapla (iki mod)** — `100 g'da yazıyor` ve `porsiyonda yazıyor` modları doğru çalıştı
  (`60 × 40 ÷ 100 = 24 g`). Yalnızca sonuçta eylem yok (bkz. bulgu).
- **"Bazal dozumu güncelle"** — 4 gece penceresi yükselen eğilim gösterdi (`ortanca saatte 6,3 mg/dL yükseliyor`);
  onay `Ayarlardaki bazal doz 20 → 22 Ü` → uygulandı, ayarlar güncellendi.
- **"Saate göre ayrı oranları aç"** — onay `4 saat dilimine (sabah, öğle, akşam, gece) kopyalanır` → 4 blok oluştu
  ve dilim başına ayrı öneri kartları (`Sabah · 06:00–11:00`, `Akşam · 17:00–22:00`) geldi. Kanıt: `c-learn-05-dilimler.png`
- **"Gidişatı doktor raporunda gör (PDF)"** — `/report` ekranını açtı.
- **RatioEditor** — blok `Sil` (onay `"Gece" silinsin mi?`), `Saat dilimi ekle`, `Günün saatine göre farklı oranlar`
  düğmesi (`Tek orana geç` onayı) ve numara alanlarının `Azalt/Artır` düğmeleri çalışıyor.
- **Öğün bazlı tablo** — `Kahvaltı 20 / 14 / 4 → Öneri 16`, `Akşam yemeği 20 / 23,9 / 4 → Öneri 24`; "daha fazla /
  daha az insülin" yönleri doğru. **Yatay taşma yok.**

---

# 3. AYARLAR SEKMESİ — `src/app/(tabs)/settings.tsx`

### Kaynaktan çıkarılan tıklanabilir öğeler

| # | Öğe | Satır | Amaç |
|---|---|---|---|
| A-1 | `Segmented` Otomatik / Açık / Koyu | settings.tsx:55-63 | Tema |
| A-2 | `Chip` ×5 (NovoRapid…Lyumjev) | settings-forms.tsx:201 | Hızlı insülin adı + etki hızı |
| A-3 | `Segmented` Etki hızı | settings-forms.tsx:214-221 | peak 75/55 |
| A-4 | `Segmented` Kalem adımı | settings-forms.tsx:225-232 | penStep |
| A-5 | `NumField` Etki süresi / Azami tek doz | settings.tsx:236-239 (settings-forms) | DIA / max bolus |
| A-6 | `Toggle` Ters düzeltme | settings-forms.tsx:243-247 | reverseCorrection |
| A-7 | `Segmented` Sayım yöntemi | settings.tsx:157-169 | exchange / composition |
| A-8 | `TimeField` ×7 öğün saati | settings.tsx:203-212 | mealStarts |
| A-9 | `Btn` "Varsayılana dön" | settings.tsx:217-226 | mealStarts reset |
| A-10 | Bazal: `Field` ad / `NumField` doz / `TimeField` saat / `Toggle` hatırlat | settings.tsx:77-100 | Bazal insülin ayarları |
| A-11 | `NumField` Hipo eşiği / Ciddi hipo / Keton eşiği | settings.tsx:116-126 | Uyarı eşikleri |
| A-12 | `NumField` Hafif / Orta / Yoğun | settings.tsx:132-134 | Egzersiz azaltma |
| A-13 | `Btn` "Yedek al (JSON)" | settings.tsx:296 | Dışa aktar |
| A-14 | `Btn` "Yedekten geri yükle" | settings.tsx:297 | İçe aktar |
| A-15 | `Btn` "Tüm günlük kayıtlarını sil" | settings.tsx:298-305 | Yıkıcı silme |
| A-16 | `AppVersion` düğmeleri (**web'de render edilmiyor**) | settings.tsx:251, 254 | Güncelleme denetimi / APK indir |

---

### [ŞİDDET: yüksek] KIRIK — "Günlük doz" alanında **"Azalt" düğmesi değeri ARTIRIYOR**
- **Ekran:** Ayarlar → Bazal (uzun etkili) insülin → **Öğe:** A-10 (`NumField` "Günlük doz", soldaki `Azalt`)
- **Sorun:** `ui.tsx:269-275` `nudge()` hesabı: `next = cur + delta`; sonra `if (next < min) next = min`. Yani alt
  sınırdan **aşağı** inen artış, sınırın **üstüne** (yani `min`'e) çekiliyor. `basalDose` varsayılanı `0`, alanın
  `min`'i `1` (settings.tsx:87) olduğu için: ekranda **0** görürken "Azalt" (−) düğmesine basmak değeri **1** yapıyor
  ve 1 Ü'lük bir günlük bazal dozu sessizce kaydediyor. Düğmenin etiketiyle yaptığı iş tam ters.
- **KANIT:** Canlı doğrulama — `basalDose = 0` iken `Azalt` (e498) → snapshot `textbox "Günlük doz": 1`,
  `localStorage.settings.basalDose = "1"`. `c-settings-05-bazal.png`. Kaynak: `src/app/(tabs)/settings.tsx:87`
  + `src/components/ui.tsx:269-275`
- **Yeniden üretim:** Temiz kurulum (onboarding sonrası `basalDose=0`) → Ayarlar → "Bazal (uzun etkili) insülin" →
  "Günlük doz" alanının **sol**daki `−` düğmesine bas.
- **Öneri:** `nudge`'da alt sınırda `next`'i `cur`a kilitle: `if (next < min) next = cur;` (aynı hata
  `max` tarafında da `next > max → max` olarak mevcut, bu doğru davranış; `min` tarafı ters yazılmış).

### [ŞİDDET: orta] ÇELİŞKİ — Varsayılan bazal doz `0`, geçerli aralığın dışında → açılışta kırmızı uyarı
- **Ekran:** Ayarlar → Bazal (uzun etkili) insülin → **Öğe:** A-10
- **Sorun:** Alan `min=1` ile tanımlı ama store'daki varsayılan `0`. `NumField` (settings-forms.tsx:50)
  `text.trim() !== '' && !(min <= n <= max)` koşuluyla geçersizliği hesaplıyor ve **kaydedilmemiş bir değer için**
  kırmızı `1–200 arası olmalı; kaydedilmedi` uyarısı basıyor. Kullanıcı bölümü ilk kez açtığında, hiçbir şey
  yapmadan bir hata mesajıyla karşılaşıyor; üstelik alan `0` gibi geçerli bir değermiş gibi dolu görünüyor
  (0 aslında kaydedilmiş bir ayar değil, "tanımsız" anlamına geliyor ama öyle gösteriliyor).
- **KANIT:** Snapshot metni: `textbox "Günlük doz": 0` + `T small: "1–200 arası olmalı; kaydedilmedi"`;
  `c-settings-05-bazal.png`. Kaynak: `src/app/(tabs)/settings.tsx:87`, `src/components/settings-forms.tsx:50`
- **Yeniden üretim:** Onboarding sonrası ilk kez Ayarlar → Bazal bölümünü aç.
- **Öneri:** `basalDose === 0` ise alanı boş göster (`text = ''`), geçersiz uyarıyı gösterme ve placeholder
  `ör. 20` koy; 0 bir "geçersiz aralık" değil, "henüz tanımsız" durumudur.

### [ŞİDDET: yüksek] EKSİK — "Saat dilimi ekle" kullanıcının oranlarını değil, **genel varsayılanları** kopyalıyor
- **Ekran:** Öğren → Oranlarım → "Oranlarım" → **Öğe:** `Btn` "Saat dilimi ekle" (settings-forms.tsx:158)
- **Sorun:** `store/settings.ts:103-104` `addBlock: () => block('Yeni dilim', '12:00')` — `block()` fabrikası sabit
  `icr: 10, isf: 50, target: 110, low: 80, high: 140` üretir; o anki blokların oranlarını **kopyalamaz**. Test
  ortamımda kullanıcının oranları `1 Ü = 20 g` ve `1 Ü = 40 mg/dL` idi; "Saat dilimi ekle"ye basınca yeni dilim
  **`icr: 10, isf: 50`** ile geldi. Bu dilim etkin olduğu sürece uygulama o saat aralığında **iki kat fazla insülin**
  önerecek; ekranda ne bir uyarı ne de bir bildirim var. Kullanıcı yeni dilimin oranlarını ayrıca elle
  düzeltmek zorunda ve bunu yapmayı unutma riski var (tip-1 için klinik risk).
- **KANIT:** Canlı doğrulama: mevcut bloklar `{icr:20, isf:40, target:100, low:70, high:130} × 3` →
  "Saat dilimi ekle" → `{n:"Yeni dilim", s:"12:00", icr:10, isf:50}`. `c-learn-05-dilimler.png`.
  Kaynak: `src/store/settings.ts:103-104` + `src/components/settings-forms.tsx:158`
- **Yeniden üretim:** Öğren → Oranlarım → KH oranını 20 yap → "Saat dilimi ekle" → yeni dilimin oranlarını oku.
- **Öneri:** `addBlock` mevcut **etkin** bloğun (`activeBlock`) oranlarını kopyalasın; ek olarak "Yeni dilim
  oranları diğer dilimlerden kopyalandı" toast'u gösterilsin.

### [ŞİDDET: orta] ÇELİŞKİ — İnsülin çipi ile "Etki hızı" segmenti birbirini çürütebiliyor
- **Ekran:** Ayarlar → Hızlı etkili insülinim → **Öğe:** A-2 ve A-3
- **Sorun:** Çip seçimi `update({rapidName, peak})` yapıyor (settings-forms.tsx:201); "Etki hızı" segmenti ise
  **yalnızca** `peak`'i değiştiriyor, `rapidName`'e dokunmuyor (settings-forms.tsx:219). Test: `Fiasp` çipine basıldı
  → `rapidName:"Fiasp", peak:55` → sonra `Standart` segmentine basıldı → `rapidName:"Fiasp", peak:75`. Ekranda aynı
  anda **"Fiasp" vurgulu** ve **"Standart (NovoRapid, Humalog, Apidra)"** seçili görünüyor; segmentin kendi
  etiketinde Fiasp açıkça standart grubu **dışında** sayılıyor. Aktif insülin (IOB/COB) matematiği `peak`'e
  bağlı olduğu için yanlış ��alışma profili kullanılır.
- **KANIT:** `localStorage` ölçümü: `{"rapid":"Fiasp","peak":75}`; `c-settings-03-koyu-tema.png` ve
  `c-settings-06-mobil-tum.png` (aynı ekranda Fiasp çipi vurgulu + Standart seçili). Kaynak:
  `src/components/settings-forms.tsx:201` ve `:214-221`
- **Yeniden üretim:** Ayarlar → "Fiasp" çipine bas → "Etki hızı" → "Standart" segmentine bas → Fiasp çipinin
  hâlâ seçili kaldığını ve ad alanının "Fiasp" yazdığını gör.
- **Öneri:** Segment değişiminde `rapidName` de segmentin tanımına göre güncellensin (Standart → ilk uygun hızlı
  insülin, Ultra → Fiasp), ya da iki kontrolü tek bir seçim listesinde birleştirin.

### [ŞİDDET: orta] EKSİK — "Tüm günlük kayıtlarını sil" sonrası **ne bildirim ne geri alma** yok
- **Ekran:** Ayarlar → Yedekleme → **Öğe:** A-15
- **Sorun:** Onay kutusu doğru çalışıyor (`Günlükteki TÜM kayıtlar kalıcı olarak silinecek. Önce yedek almanı
  öneririm.`) ve silme gerçekten çalışıyor (`log` deposu 0 kayda düştü, ayarlar korundu). Ancak işlem bitince
  ne bir toast ne bir "Geri al" çıkıyor — kullanıcı Ayarlar ekranında oturup kayıtlarının gittiğini fark edemiyor.
  Aynı uygulamada, Günlük ekranında **yeni kayıt ekleme** sonrası 5 saniyelik "Geri al" bildirimi var
  (toast.tsx:10, entry.tsx:243). Yani geri alma altyapısı mevcut, sadece en yıkıcı işlemde kullanılmıyor.
- **KANIT:** Canlı doğrulama: `confirm` metni alındı → `entries: 0` → ekran metninin sonunda hiçbir bildirim yok
  (`document.body.innerText` son 400 karakterde toast yok); kaynak: `src/app/(tabs)/settings.tsx:298-305`,
  karşılaştırma: `src/app/entry.tsx:241-247` + `src/components/toast.tsx:10`
- **Yeniden üretim:** Ayarlar → Yedekleme → "Tüm günlük kayıtlarını sil" → onayla → ekranı incele.
- **Öneri:** `toast('Günlük silindi', { label: 'Geri al', onPress: … })` kullan; `useLog` deposunda silinen
  kayıtları tutan bir "son silinen" tamponu ekle.

### [ŞİDDET: orta] EKSİK — Yedek, **test geçmişini** içermiyor; geri yüklemede de geri gelmiyor
- **Ekran:** Ayarlar → Yedekleme → **Öğe:** A-13 / A-14
- **Sorun:** `backup.ts:12-26` `buildBackup()` yalnızca `settings`, `ratioHistory`, `log`, `foods` yazıyor.
  `useTests` deposu (`localStorage` anahtarı `tests`: aktif test + biten testler) **dışarıda kalıyor**;
  `settings.tsx:278-284` `replaceAll` çağrılarında da geri yüklenmiyor. Oysa doktor raporu bu veriyi kullanıyor
  (`report.tsx:124` `finishedTests.filter(t => t.kind === 'basal')` ve `ratio-trend.tsx:240` *"N rehberli bazal
  testin raporda yer alır"*). Yani yeni cihaza taşınan kullanıcının raporunda bu bölüm sessizce boş kalır.
- **KANIT:** Kaynak: `src/lib/backup.ts:12-26`, `src/app/(tabs)/settings.tsx:274-286`, `src/store/tests.ts:26-41`
  (localStorage anahtarları canlı olarak `["log","theme","settings","backup","foods","tests"]` — `tests` yedeğe girmiyor)
- **Yeniden üretim:** Bir bazal testi bitir → Ayarlar → "Yedek al" → üretilen JSON'da `tests` anahtarını ara → yok.
- **Öneri:** `buildBackup()`'a `tests: useTests.getState()` ekle, `importBackup`'te `useTests.getState().replaceAll(...)`
  çağır.

### [ŞİDDET: orta] ÇELİŞKİ — Geri yükleme bildirimi **olmayan bir sekmeyi** işaret ediyor
- **Ekran:** Ayarlar → Yedekleme → "Yedekten geri yükle" sonrası bildirim → **Öğe:** A-14
- **Sorun:** Başarı bildirimi *"Verilerin yüklendi. Oranlarını **Ayarlar/Oranlar sekmesinden** kontrol et."*
  diyor. Uygulamada `Ayarlar` sekmesinin altında bir `Oranlar` sekmesi yok; alt çubuk `Ana sayfa / Doz / Günlük /
  Öğren / Ayarlar`. Oran düzenleyici **Öğren → Oranlarım** bölümünde ve Ayarlar ekranından oraya **hiçbir
  bağlantı yok**.
- **KANIT:** Canlı doğrulama: geri yükleme sonrası `window.alert` yakalandı →
  `"Geri yüklendi\n\nVerilerin yüklendi. Oranlarını Ayarlar/Oranlar sekmesinden kontrol et."`;
  kaynak: `src/app/(tabs)/settings.tsx:285`; çapraz doğrulama: `src/app/(tabs)/_layout.tsx:28-35`,
  oran düzenleyicinin konumu: `src/app/(tabs)/learn.tsx:181`
- **Yeniden üretim:** Ayarlar → Yedekten geri yükle → geçerli dosya seç → onayla → bildirimi oku.
- **Öneri:** Metni **"Öğren → Oranlarım"** yap; ayrıca Ayarlar ekranının altına oran düzenleyicisine giden bir
  bağlantı ekle (aşağıdaki öneri ile birlikte).

### [ŞİDDET: düşük] WEB-NOTU — Bildirimler web'de bilinçli olarak kapalı (iyi çözülmüş)
- **Ekran:** Ayarlar → Bazal → **Öğe:** A-10 `Toggle` "Her gün bu saatte hatırlat"
- **Sorun / davranış:** `notifications.ts:13` `notificationsSupported = Platform.OS !== 'web' && !isExpoGoAndroid`.
  Düğmeye basınca uyarı `Hatırlatıcı kurulamadı / Bildirimler tarayıcıda çalışmaz; telefonda çalışır.` çıkıyor,
  ayar **geri alınıyor** (`update({basalReminder:false})`) ve düğmenin altında zaten pasif bir açıklama var.
  Canlı doğrulama: `{"alerts":["Hatırlatıcı kurulamadı\n\nBildirimler tarayıcıda çalışmaz; telefonda çalışır."],
  "s":false}`. Tutarlı ve dürüst bir çözümleme — mobil hatası değil, not edildi.
- **Öneri:** —

### [ŞİDDET: düşük] WEB-NOTU — "Uygulama sürümü" kartı web'de hiç render edilmiyor
- **Ekran:** Ayarlar → **Öğe:** A-16
- **Sorun:** `settings.tsx:138` `{isWeb ? null : <AppVersion />}` — web sürümünde sürüm numarası, "Güncellemeleri
  denetle" ve "sürümünü indir" düğmeleri hiç görünmüyor. Mobilde APK indirme akışı var; web'de kullanıcı sürüm
  bilgisine de ulaşamıyor.
- **KANIT:** `c-settings-06-mobil-tum.png` (kart listede yok); kaynak: `src/app/(tabs)/settings.tsx:138`
- **Öneri:** Web'de de kartı göster, yalnızca APK indirme düğmesini gizle.

### [ŞİDDET: düşük] EKSİK — "Ciddi hipo" alanı kardeşleriyle tutarsız
- **Ekran:** Ayarlar → Uyarı eşikleri → **Öğe:** A-11
- **Sorun:** "Hipo eşiği" ve "Keton kontrolü için yüksek şeker" alanlarında `step` verildiği için `−/+` düğmeleri
  çıkıyor; "Ciddi hipo" alanında `step` yok (`settings.tsx:118-124`) → `−/+` düğmeleri **yok**, yalnızca elle
  yazılıyor. Ayrıca erişilebilirlik etiketleri tutarsız: `textbox "Hipo eşiği"`, `textbox "Keton kontrolü için
  yüksek şeker"` etiketleri birimi içerirken, `textbox "Ciddi hipo"` birimi içermiyor (birim ayrı bir `T` olarak
  ekranda görünüyor, ekran okuyucuya gitmiyor).
- **KANIT:** Snapshot: `textbox "Hipo eşiği" [e505]`, `button "Azalt"/"Artır"` çevresinde; `textbox "Ciddi hipo" [e507]`
  — çevresinde Azalt/Artır yok; `c-settings-06-mobil-tum.png`. Kaynak: `src/app/(tabs)/settings.tsx:116-126`
- **Öneri:** `Ciddi hipo` alanına da `step={1}` ekle; birimi `label` içine al (`Ciddi hipo (mg/dL)`).

### [ŞİDDET: düşük] EKSİK — "Varsayılana dön" geri bildirimi vermiyor
- **Ekran:** Ayarlar → Öğün saatleri → **Öğe:** A-9
- **Sorun:** Düğme öğün saatlerini `DEFAULT_MEAL_STARTS`'a döndürüyor ve alanlar görünür şekilde değişiyor
  (bu yeterli bir geri bildirim) ancak toast/uyarı yok; ayrıca kullanıcının özel saatlerini **yanlışlıkla**
  sıfırladığını fark etmesi için onay da istenmiyor (kaybedilecek veri: özel öğün saatleri).
- **KANIT:** Canlı doğrulama: saatler `{"aksam":"19:50","ogle":"14:00"}` iken "Varsayılana dön" →
  `{"sabah":"06:00","sabahAra":"09:30","ogle":"12:00","ogleAra":"15:00","aksam":"18:30","aksamAra":"21:00","gece":"00:00"}`,
  bildirim yok. Kaynak: `src/app/(tabs)/settings.tsx:217-226`
- **Öneri:** `variant="ghost"` yerine `variant="secondary"` kullan ve küçük bir onay iste.

### [ŞİDDET: düşük] WEB-NOTU / a11y — `Toggle` ve `Segmented` düğmeleri web'de durum bildirmiyor
- **Ekran:** Ayarlar (ve Öğren, Rapor) → **Öğe:** A-1, A-3, A-4, A-6, A-7, A-10 ve rapor bölüm anahtarları
- **Sorun:** Bu RNW sürümü `accessibilityState`'i DOM'a çevirmiyor: `ui.tsx:481` `accessibilityState={{ checked: value }}`,
  `ui.tsx:415-416` `{{ selected: active }}`, `guide.tsx:93/106` `{{ expanded: open }}` hiçbir `aria-*` niteliği
  üretmiyor. Canlı ölçüm: rapor ekranındaki 7 bölüm anahtarının `aria-checked` değeri `null`; görsel olarak hepsi
  **açık** (knob `translateX(20px)`), a11y ağacı ise `checked=false` diyor. `disabled` olan `Btn`'lerde ise
  `aria-disabled="true"` **doğru** üretiliyor (ayrı kontrol).
- **KANIT:** `eval` çıktısı: `[{"t":"Özet istatistikler ve…","ac":null}, …×7]`; knob stili
  `transform: translateX(20px)`; `localStorage` `theme.pref = "dark"` iken kart zemini `rgb(8,20,23)`.
  `c-report-03-mobil-tam.png`, `c-settings-03-koyu-tema.png`. Kaynak: `src/components/ui.tsx:472-488`,
  `src/components/ui.tsx:409-417`, `src/components/guide.tsx:93,106`
- **Yeniden üretim:** Rapor → "Rapora eklenecek bölümler" → `eval` ile `[role=switch]` öğelerini incele.
- **Öneri:** Web'de de çalışması için `aria-checked` / `aria-selected` / `aria-expanded` doğrudan geçirilsin
  (RNW bu öznitelikleri destekliyor); mobilde `accessibilityState` aynen çalışmaya devam etsin.

### ✅ TAMAM — doğrulandı (Ayarlar)

- **Tema Otomatik / Açık / Koyu** — üçü de `localStorage.theme.pref`'i yazdı ve arka plan rengini değiştirdi
  (`dark` → `rgb(8,20,23)`, `light` → `rgb(237,243,242)`). Kanıt: `c-settings-02-koyu.png`, `c-settings-03-koyu-tema.png`
- **İnsülin çipleri** — `Fiasp` → `rapidName:"Fiasp", peak:55`, "Etki hızı" otomatik **Ultra hızlı**'ya döndü;
  `NovoRapid` → `peak:75`. (Çelişkiyi yalnızca elle segment değiştirince üretiyor; bkz. bulgu.)
- **Kalem adımı** — Yarım ünite → `penStep:0.5`, Tam ünite → `penStep:1`.
- **Etki süresi / Azami tek doz** — `−/+` düğmeleri çalışıyor (`4 → 4.5 → 4`, `15 → 16`), alan dışı değer
  (`150`) girilince `0–90 arası olmalı; kaydedilmedi` uyarısı çıkıyor ve **kaydedilmiyor**.
- **Ters düzeltme** — açık/kapalı çevrildi (`reverseCorrection: true → false → true`).
- **Sayım yöntemi** — "Gerçek bileşim" seçildi → açıklama metni değişti, cart temizlendi ve toast çıktı
  (`Sayım yöntemi değişti; tabaktaki yemekler temizlendi`); "Değişim listesi"ne dönüş de çalıştı.
- **Öğün saatleri** — 7 `TimeField` yazıldı/kaydedildi (`aksam → 19:50`, `ogle → 14:00`); çakışan sıra
  (`Akşam yemeği 08:00`) uyarı üretti: `"Öğle ara öğün" (15:00), "Akşam yemeği" (08:00) öğününden önce başlamalı`;
  "Varsayılana dön" tümünü varsayılana döndürdü.
- **Bazal insülin** — ad (`Tresiba`), günlük doz (`20`), vurma saati (`21:30`) kaydedildi; `Bazal (Ü)` alanı
  Günlük ekranındaki "Bazal kaydet"de `Bazal (Tresiba): 22` olarak **doğru etiketlendi**.
- **Uyarı eşikleri** — üç alan da yazıldı/kaydedildi, `−/+` çalıştı.
- **Egzersiz azaltma** — Yoğun `%` 75 → 90'a tırmanıp **90'da durdu** (maks sınırı), 4 tık daha sonrası değişmedi;
  150 yazılınca uyarı çıktı ve kaydedilmedi; 25'e geri alındı.
- **"Yedek al (JSON)"** — `diyabet-yedek-2026-10-06.json` adıyla `application/json` dosyası üretildi;
  `backup.lastAt` güncellendi.
- **"Yedekten geri yükle"** — geçerli yedek yüklendi (log 21→1 kayıt, ayarlar `icr:20/isf:40`, `rapidName:"Lyumjev"`,
  oran geçmişi 1 kayıt); **geçersiz dosya** reddedildi: `Geçersiz dosya / Bu dosya bir Diyabet Asistanı yedeği değil.`
  ve veri bozulmadı.
- **Yatay taşma yok** (390 px): ölçüm `count: 0`.

---

# 4. DOKTOR RAPORU (PDF) — `src/app/report.tsx`

### Kaynaktan çıkarılan tıklanabilir öğeler

| # | Öğe | Satır | Amaç |
|---|---|---|---|
| R-1 | `Pressy` dönem çipleri ×5 (Bugün / 7 / 14 / 30 / Tarih seç) | report.tsx:149-168 | Rapor aralığı |
| R-2 | `DateField` Başlangıç / Bitiş | report.tsx:172-173 | Özel aralık |
| R-3 | `Field` "Raporda görünecek ad" | report.tsx:191 | PDF başlığı |
| R-4 | `Pressy` "Tümünü seç" / "Sadece özet" / "Temizle" | report.tsx:198-218 | Bölüm toplu seçimi |
| R-5 | `Toggle` ×7 bölüm anahtarı | report.tsx:220-227 | Rapor içeriği |
| R-6 | `Btn` "PDF raporu paylaş" | report.tsx:231-236 | PDF üret + paylaş |
| R-7 | `Btn` "Excel için CSV paylaş" | report.tsx:239 | CSV dışa aktar |

---

### [ŞİDDET: yüksek] WEB-NOTU — "PDF raporu paylaş" web'de **raporu değil, o anki uygulama ekranını** yazdırıyor
- **Ekran:** Doktor raporu → **Öğe:** R-6
- **Sorun:** `files.ts:80-85` web'de `Print.printAsync({ html })` çağırıyor ve içindeki `buildReportHtml(...)`
  çıktısını (report.tsx:118-126) **hiç kullanmıyor**. Kurulu `expo-print` sürümünün web implementasyonu
  (`node_modules/expo-print/build/ExponentPrint.web.js:8-10`) `async print() { window.print(); }` — yani
  `options.html` **tamamen yok sayılıyor** ve tarayıcının o an açık olan sayfası (yani uygulamanın rapor ekranı)
  yazdırılıyor. Expo'nun kendi dokümanı bunu açıkça doğruluyor: *"on web this prints the HTML from the page"* ve
  `PrintOptions.html` için *"Supported platforms: Android, iOS"*.
  Canlı doğrulama: düğmeye basıldığında `window.print()` **argümansız** çağrılıyor (`{"printed":1,"args":[]}`)
  ve DOM'da hiçbir değişiklik olmuyor. Yani web kullanıcısı "doktor raporumu" sandığı şeyi değil, uygulamanın
  kendi arayüzünün ekran görüntüsünü alıyor.
- **KANIT:** Canlı ölçüm (`window.print` stub) + kaynak: `src/lib/files.ts:80-85`,
  `node_modules/expo-print/build/ExponentPrint.web.js:8-10`, `node_modules/expo-print/build/Print.js:24-27`;
  Expo dokümanı: https://docs.expo.dev/versions/latest/sdk/print.md ("on web this prints the HTML from the page").
  `c-report-02-tam.png`, `c-report-03-mobil-tam.png`
- **Yeniden üretim:** Rapor ekranında "PDF raporu paylaş" → tarayıcı yazdırma penceresi açılır → yazdırılan içerik
  uygulamanın rapor ekranıdır, `buildReportHtml` çıktısı değildir.
- **Öneri:** Web'de ayrı bir yol kur: `buildReportHtml` çıktısını gizli bir `<iframe srcdoc={html}>` içine yazıp
  `iframe.contentWindow.print()` çağır (veya `window.open('', '_blank').document.write(html)`).
  Bu bir **web'e özgü** eksikliktir; iOS/Android'de `printToFileAsync` + `Sharing.shareAsync` doğru çalışır.

### [ŞİDDET: orta] WEB-NOTU — "Excel için CSV paylaş" başarısızlıkta **indirmeye düşmüyor**
- **Ekran:** Doktor raporu → **Öğe:** R-7
- **Sorun:** `files.ts:11-26` web'de önce `navigator.canShare` varsa `navigator.share` kullanıyor, ancak
  `<a download>` yedeği yalnızca `canShare` **yoksa/false** ise devreye giriyor. `navigator.share` çağrısı
  reddedildiğinde (kullanıcı paylaşım ekranını kapattığında veya önceki bir paylaşım hâlâ sürerken) `try/catch`
  `notify('Dışa aktarılamadı', …)` gösteriyor — dosya **hiç indirilmiyor**. Canlı doğrulama:
  `{"alerts":["Dışa aktarılamadı\n\nInvalidStateError: Failed to execute 'share' on 'Navigator': An earlier share
  has not yet completed."]}` ve indirme sayacı `dl: 0`.
- **KANIT:** Canlı ölçüm: `HTMLAnchorElement.prototype.click` stub'ı ile indirme sayacı `0`;
  kaynak: `src/lib/files.ts:10-32`, `src/app/report.tsx:136-143`
- **Yeniden üretim:** Rapor → "Excel için CSV paylaş" (web) → paylaşım başarısız/hatalıysa hata uyarısı,
  indirme yok.
- **Öneri:** `navigator.share` `try/catch` içine alınmalı; `AbortError` dışındaki hatalarda (ve `canShare` true
  olsa bile) `<a download>` yedeğine düşülmeli. Aynı desen `backupNow()` içinde de geçerli (settings.tsx:296).

### [ŞİDDET: orta] WEB-NOTU / a11y — "Tümünü seç / Sadece özet / Temizle" bağlantıları 19 px ve rolü yok
- **Ekran:** Doktor raporu → **Öğe:** R-4
- **Sorun:** Üç `Pressy` de sadece bir `T variant="small"` metnine sarılı; dikey boşluk yok. 390 px ölçümde
  tıklanabilir alan **19 px** yükseklikte (44 px önerisinin yarısından az) ve `accessibilityRole` verilmediği için
  a11y ağacında `generic … clickable` olarak çıkıyor.
- **KANIT:** Ölçüm: `[{t:"Tümünü seç",h:19,w:74},{t:"Sadece özet",h:19,w:78},{t:"Temizle",h:19,w:46}]`, `role:"none"`;
  `c-report-03-mobil-tam.png`. Kaynak: `src/app/report.tsx:197-219`
- **Yeniden üretim:** Rapor → "Rapora eklenecek bölümler" → ölçüm veya `c-report-03-mobil-tam.png`.
- **Öneri:** `accessibilityRole="button"` + `minHeight: 44` + `hitSlop`.

### [ŞİDDET: orta] WEB-NOTU / a11y — Dönem çipleri buton rolü ve seçili durumu taşımıyor
- **Ekran:** Doktor raporu → **Öğe:** R-1
- **Sorun:** Çipler görsel olarak doğru (aktif olan `c.primarySoft` zemin + `c.primary` kenarlık), ama
  `Pressy`'ye `accessibilityRole` verilmediği için ağaçta `generic` çıkıyor ve seçili olan hangisi olduğu
  erişilebilirlik ağacından **hiç anlaşılmıyor** (aynı `accessibilityState` eşlemesizliği, bkz. A-düşük notu).
  Dokunma hedefi 37 px (44'ün altında ama kabul edilebilir sınırda).
- **KANIT:** Ölçüm: `[{t:"Bugün",h:37,w:70},…{t:"Tarih seç",h:37,w:84}]`, `role:"none"`, `aria-selected:null`;
  kaynak: `src/app/report.tsx:149-168`
- **Öneri:** `accessibilityRole="button"` + `aria-selected` (bkz. Ayarlar bölümündeki RNW notu).

### [ŞİDDET: orta] EKSİK — "Raporda görünecek ad" kalıcı değil; `settings.patientName` hiç doldurulmuyor
- **Ekran:** Doktor raporu → **Öğe:** R-3 (ve dolaylı olarak Ana sayfa)
- **Sorun:** `report.tsx:49` `useState(settings.patientName ?? '')` — alan yalnızca **yerel state**'te tutuluyor,
  `onChangeText` sadece `setName` yapıyor; `update({patientName})` **hiçbir yerde çağrılmıyor**. Sonuç:
  (a) kullanıcı adı yazıp ekrandan çıkınca kaybolur, her rapor için yeniden yazılmalıdır;
  (b) `index.tsx:202-203` Ana sayfa selamında `settings.patientName ? "…, {ad}"` dalı **hiç çalışmaz**,
  çünkü o alan uygulama içinde hiçbir yerden yazılmıyor.
- **KANIT:** Kaynak taraması: `patientName` yalnızca `index.tsx:203` (okuma), `report.tsx:49,120` (okuma),
  `types.ts:51` (tanım), `logic/report.ts:443` (PDF'e yazma) — **tek bir yazma yolu yok**.
  `c-report-01-bugun.png`, `c-report-02-tam.png`
- **Yeniden üretim:** Rapor → "Raporda görünecek ad" → yaz → başka sekmeye geç → geri dön → alan boş.
- **Öneri:** `onChangeText` ile `update({ patientName: v })` çağır (veya en azından "Bu adı kaydet" onay kutusu).
  Bu, Ana sayfa'daki kişisel selamı da çalışır hale getirir.

### [ŞİDDET: düşük] ÇELİŞKİ — Yardım metni mobilde geçerli, web'de yanlış
- **Ekran:** Doktor raporu → **Öğe:** metin (report.tsx:240-242)
- **Sorun:** *"Paylaşım menüsünden WhatsApp, e-posta ya da yazdır seçebilirsin."* Web'de paylaşım menüsü yoktur
  (bkz. R-1/R-2: ne paylaşma ne de PDF üretimi gerçekleşiyor). Kullanıcı bu metni okuyup bir şey arıyor.
- **KANIT:** `c-report-03-mobil-tam.png`; kaynak: `src/app/report.tsx:240-242`
- **Öneri:** `isWeb ? 'Tarayıcının yazdırma penceresinden "PDF olarak kaydet" seç.' : '...'` ayrımı yap.

### [ŞİDDET: düşük] EKSİK — `busy` durumu ölçülemiyor (1 ms'lik sahte bekleme)
- **Ekran:** Doktor raporu → **Öğe:** R-6
- **Sorun:** `setBusy(true)` → `buildReportHtml` + `sharePdf` → `setBusy(false)`. Web'de `sharePdf` anında çözülür
  (`window.print()` senkron), bu yüzden "Hazırlanıyor…" hiç görünmüyor; buton tek bir karede "PDF raporu paylaş"
  durumundan çıkıyor. Gerçek veriyle (4–6 haftalık, günlük kayıtları dahil) HTML üretimi birkaç yüz ms sürdüğü
  için pratikte kabul edilebilir, ama ilerleme göstergesi **hiç** görünmüyor.
- **Yeniden üretim:** Rapor → "PDF raporu paylaş" → buton metni değişmeden geri dönüyor.
- **Öneri:** Düşük öncelik; buton yerine küçük bir "Rapor hazırlanıyor…" `Notice` göster.

### ✅ TAMAM — doğrulandı (Doktor raporu)

- **Dönem çipleri** — `Bugün` → *"5 Ekim 2026"*; `Son 14 gün` → *"22 Eylül 2026 – 5 Ekim 2026"*; dönem özeti
  canlı güncellendi (Kayıtlı gün / Şeker ölçümü / Ortalama / Hedef aralıkta / günlük KH / günlük toplam insülin).
  (Uygulamanın "gün 06:00'da başlar" kuralı nedeniyle bugün 5 Ekim sayılıyor — `stats.ts:83` + `settings.ts:138`;
  bu **kasıtlı** ve tutarlı bir davranış, hata değil.)
- **Tarih seç + doğrulama** — Bitiş başlangıçtan önce → `Bitiş tarihi başlangıçtan önce olamaz.`, iki düğme de
  `[disabled]`; alan boş bırakılınca `Başlangıç ve bitiş tarihini yaz (sadece rakamlar yeterli…)` uyarısı çıktı.
- **"Temizle"** — tüm bölümler kapandı, `PDF raporu paylaş` pasifleşti ve uyarı çıktı:
  `Rapora eklenecek en az bir bölüm seçmelisin.` (CSV açık kaldı — doğru, bölüm seçimi CSV'yi etkilemez.)
- **"Sadece özet"** — yalnızca `Özet istatistikler…` anahtarı açık kaldı (knob ölçümü ile doğrulandı).
- **"Tümünü seç"** — 7/7 anahtar açık; PDF düğmesi yeniden etkin.
- **Boş durum** — tüm kayıtlar silindikten sonra `Seçtiğin aralıkta kayıt yok. Başka bir aralık seç.` ve **her iki**
  dışa aktarma düğmesi de pasif.
- **CSV üretimi** — `toCsv` yolu çalıştı (web'de paylaşım hatası verdi, bkz. R-2; içerik üretimi hatasız).
- **Geri bağlantısı** — "Geri, back" → `/log`.
- **Yatay taşma yok** (390 px): ölçüm `count: 0`.

---

# 5. ORAN GİDİŞATI BİLEŞENİ — `src/components/ratio-trend.tsx`

Bu bileşen Öğren → Oranlarım içine gömülü; tıklanabilir öğeleri ayrıca denetlendi.

| # | Öğe | Satır |
|---|---|---|
| RT-1 | `Btn` "Ayarlara uygula" (ICR ve ISF için) | ratio-trend.tsx:40-56 |
| RT-2 | `Btn` "Saate göre ayrı oranları aç" | ratio-trend.tsx:155-163 |
| RT-3 | `Btn` "Bazal dozumu güncelle" | ratio-trend.tsx:214-226 |
| RT-4 | `Btn` "Rehberli bazal testi yap" | ratio-trend.tsx:242 |
| RT-5 | `Btn` "Gidişatı doktor raporunda gör (PDF)" | ratio-trend.tsx:259 |

### [ŞİDDET: yüksek] ÇELİŞKİ — RT-4 aktif test varken yanlış testi açıyor
→ Bkz. **Bölüm 2, [ŞİDDET: yüksek] ÇELİŞKİ — "Rehberli bazal testi yap"**. Aynı bulgudur, orada kanıtıyla verildi.

### [ŞİDDET: orta] EKSİK — "Sil" onayı, silinen dilimin **tune edilmiş oranlarının** kaybolacağını söylemiyor
- **Ekran:** Öğren → Oranlarım → **Öğe:** `BlockCard` "Sil" düğmesi (settings-forms.tsx:109-116)
- **Sorun:** Onay metni yalnızca `"Gece" silinsin mi?`. O dilime özgü olarak ayarlanmış KH oranı / düzeltme /
  hedef değerleri silinince **bir daha geri gelmiyor** (ratio geçmişinde de kayıt yok — `removeBlock`
  `settings.ts:105-110` yalnızca `blocks`'ı filtreliyor). Geri alma da yok.
- **KANIT:** Canlı doğrulama: `Gece` silindi → `blocks.length` 4→3, `"Akşam · 17:00–06:00"` aralığı genişledi;
  `c-learn-05-dilimler.png`. Kaynak: `src/components/settings-forms.tsx:114`, `src/store/settings.ts:105-110`
- **Öneri:** Onay metnine "Bu dilime ayarladığın oranlar da silinecek" cümlesini ekle; silme öncesi
  `ratioHistory`'ye bir kayıt düş ve bir "Geri al" toast'u sun.

### [ŞİDDET: düşük] EKSİK — `basalDose = 0` iken "Bazal dozumu güncelle" önerisi hiç gösterilmiyor
- **Ekran:** Öğren → Oranlarım → "Bazal insülin gidişatı" → **Öğe:** RT-3
- **Sorun:** `optimizer.ts:228` `if (verdict !== 'ok' && basalDose > 0)` — doz 0 iken öneri üretilmiyor.
  Varsayılan `basalDose = 0` olduğundan, bazal kullanmayan/yeni kurulum yapan kullanıcı "gece şekerin yükseliyor"
  uyarısını görür ama **eyleme dönüştürecek** bir düğme çıkmaz; tek yolu Ayarlar'a gidip önce bir doz tanımlamak.
- **KANIT:** Kaynak: `src/logic/optimizer.ts:228` ve `src/store/settings.ts` (`DEFAULT_SETTINGS.basalDose = 0`);
  gözlem: `basalDose = 0` iken kartta yalnızca `Yeterli gece verisi yok…` / trend metni vardı, düğme yok.
  (Doz tanımlandıktan sonra aynı kartta RT-3 düğmesi göründü ve çalıştı.)
- **Öneri:** `basalDose === 0` iken RT-3 yerine "Önce Ayarlar > Bazal bölümünden günlük dozunu gir" yönlendirmesi göster.

### ✅ TAMAM — doğrulandı (Oran gidişatı)

- **RT-1 "Ayarlara uygula"** — ICR için 14→12 önerisi onaylandı ve uygulandı (`updateBlock` + geçmiş kaydı
  `Test/kayıt analizi (3 kayıt)`); kart "Kayıtların bu oranın iyi çalıştığını gösteriyor." durumuna geçti.
  *ISF dalı için yeterli örnek üretemedim; aynı `SuggestionView` bileşeni ve aynı `confirm` yolu kullanıldığı için
  **doğrulanamadı** olarak işaretliyorum.*
- **RT-2 "Saate göre ayrı oranları aç"** — onay metni doğru çıktı, 4 blok oluştu ve "Öğünlere göre karbonhidrat
  oranı" kartındaki fark uyarısı kayboldu. Kanıt: `c-learn-05-dilimler.png`
- **RT-3 "Bazal dozumu güncelle"** — `Ayarlardaki bazal doz 20 → 22 Ü olarak değişecek. Bazal değişikliğini
  doktorunla da konuş.` onayı → `basalDose: 22`, kart yeni değeri gösterdi.
- **RT-5** — `/report` ekranını açtı.
- **Gidişat tabloları** — "Dönemlere göre değişim (14 gün)" (`22 Eyl – 6 Eki · 19 g (8)`), "Bazal insülin gidişatı"
  gece listesi (`5 Eki: 100 → 150 mg/dL (8 sa, +50)` ×4), "Daha çok kayıt analize girsin" red gerekçeleri
  (`Yemek öncesi şeker hedef aralığının dışındaydı (1)`) — hepsi veriyle doldu ve okunabilir.
- **"Değişiklik geçmişi"** — `Tüm gün · KH oranı: 10 → 14 · 6.10.2026 04:22 · Başlangıç tahmini (500/1800 kuralı)`
  satırı doğru render edildi.
- **Yatay taşma yok** (390 px): ölçüm `count: 0`.

---

# 6. ÖZET

## Bulgu sayıları

| Ekran | yüksek | orta | düşük | toplam |
|---|---|---|---|---|
| Günlük (`log.tsx`) | 0 | 1 | 5 | 6 |
| Öğren (`learn.tsx`) | 1 | 4 | 2 | 7 |
| Ayarlar (`settings.tsx`) | 2 | 5 | 5 | 12 |
| Doktor raporu (`report.tsx`) | 1 | 4 | 2 | 7 |
| `ratio-trend.tsx` (RT-1 = Ö-1 ile aynı bulgu, tekrar sayılmadı) | 0 | 1 | 1 | 2 |
| **Toplam (tekil)** | **4** | **15** | **15** | **34** |

## En acil 5 madde

1. **A-1 (yüksek)** — Bazal "Günlük doz" alanında **"Azalt" düğmesi artırıyor** (0 → 1). `ui.tsx:269-275` alt sınır
   mantığı ters; tek satırlık düzeltme, ama tip-1 dozunda sessiz hata riski taşıyor.
2. **A-3 (yüksek)** — **"Saat dilimi ekle"** kullanıcının oranlarını değil `1Ü=10 g / 1Ü=50 mg/dL` varsayılanını
   kopyalıyor; aktif dilimde iki kat insülin hesaplanabilir.
3. **R-1 (yüksek)** — Web'de **"PDF raporu paylaş"** oluşturulan raporu değil uygulama ekranını yazdırıyor
   (`expo-print` web'de `html`'i yok sayıyor).
4. **Ö-1/RT-4 (yüksek)** — **"Rehberli bazal testi yap"** aktif test varken yanlış testi açıyor.
5. **A-2 (orta)** — Varsayılan `basalDose = 0`, alan `min = 1` ile çakıştığı için Ayarlar'da
   açılışta **kırmızı "kaydedilmedi" uyarısı** ve Günlük'te boş bazal formu gösteriyor.

## Doğrulanamayanlar (açıkça işaretlendi)

- **`SuggestionView`'ın ISF dalındaki "Ayarlara uygula"** — çalıştırmak için en az 3 geçerli düzeltme örneği
  (yemeksiz, hedef üstü başlangıç, 2,5–5 saat sonra ölçüm) gerekiyordu; üretmedim. Aynı bileşen ve aynı `confirm`
  yolu ICR dalında doğrulandı.
- **PDF'in gerçek içeriği** — web'de `expo-print` `html`'i yok saydığı için (R-1) PDF hiçbir ortamda üretilemedi;
  `buildReportHtml` çıktısının bölümleri tarayıcıda gözle doğrulanamadı. Mobilde `printToFileAsync` yolu
  koda bakılarak doğru görünüyor ama **çalıştırılarak doğrulanmadı**.
- **Bildirimler (bazal hatırlatıcı, tokluk hatırlatıcısı)** — web'de bilinçli olarak devre dışı; telefon davranışı
  test edilemedi.
- **Haptik geri bildirimi** — `ui.tsx:46-50` web'de bilinçli olarak atlanıyor; mobilde doğrulanamadı.

## Dosya listesi (kanıt görüntüleri)

`audit/shots/` altında 25 ekran görüntüsü: `c-00-onboarding-bitti`, `c-log-01-bos-durum`, `c-log-02-tek-kayit`,
`c-log-03-uc-kayit`, `c-log-04-bazal-form`, `c-log-05-hafta-gorunum`, `c-log-06-mobil-gunluk`, `c-log-07-mobil-tam`,
`c-report-01-bugun`, `c-report-02-tam`, `c-report-03-mobil-tam`, `c-report-04-bolumler`,
`c-learn-01-kapali`, `c-learn-02-tahmin`, `c-learn-03-bazal-test-basla`, `c-learn-04-oneri-uygula`,
`c-learn-05-dilimler`, `c-learn-06-mobil-tam`, `c-learn-07-oranlarim`,
`c-settings-01-tam`, `c-settings-02-koyu`, `c-settings-03-koyu-tema`, `c-settings-04-error-overlay`,
`c-settings-05-bazal`, `c-settings-06-mobil-tum`.

> Not: `c-settings-04-error-overlay.png` denetim aracının kendi `error-overlay` kapsayıcısını gösterir; uygulama
> hatası değildir, test sırasında yapılan DOM hook'larından kalmış boş bir Expo LogBox kapsayıcısıdır
> (0×0 px, `pointer-events: auto`).

## Test sırasında değiştirilen test verisi (kaynak kodu DEĞİŞTİRİLMEDİ)

Denetim sırasında yalnızca tarayıcının `localStorage` test verisi manipüle edildi (onboarding adımları,
sentetik günlük kayıtları, `settings.basalDose`/`penStep`/tema değişimleri, yedek geri yükleme). **Uygulama
kaynak kodunda hiçbir dosya değiştirilmedi.** Metro sunucusu ve Expo süreci dokunulmadı; yalnızca `audit/`
klasörüne dosya yazıldı.