# Diyabet Asistanı — Tüm Sekmeler UX/Fonksiyon Denetimi (BİRLEŞİK NİHAİ RAPOR)

**Tarih:** 06.10.2026 · **Yöntem:** Expo web (Metro :8081) üzerinde agent-browser canlı gezinti (390×844) + kaynak kod incelemesi. Her bulgu üçlü kanıtlı: a11y snapshot + DOM/eval ölçümü + ekran görüntüsü (`audit/shots/`).
**Not:** Denetim modelleri görüntü girdisi bildirmediği için ekran görüntüleri insan incelemesi için kaydedildi; bulgular metin-tabanlı kanıtlarla doğrulandı. **8 yüksek şiddetli bulgunun tamamı Lead (orkestratör) tarafından ayrıca kaynak-kod düzeyinde teyit edildi.**

## Kapsam ve ajanlar

| Kapsam | Ekranlar | Ajan / model | Rapor |
|---|---|---|---|
| Günlük · Öğren · Ayarlar · Rapor | log, learn, settings, report, ratio-trend | space-bunny-free | [rapor-3](rapor-3-bunny-gunluk-ogren-ayarlar.md) |
| Ana sayfa · Onboarding · Kayıt · Hipo | onboarding, index, entry, hypo | GLM-5.3-Flash* | [rapor-4](rapor-4-anasayfa-akisi.md) |
| Doz · Yemek seçim/liste · Testler | calc, pick-foods, foods, food-browser, test | GLM-5.3-Flash* | [rapor-5](rapor-5-doz-yemek-test.md) |

\* Kullanıcının istediği **Fledge Alpha** ve **Muse Spark 1.3** rotaları sağlayıcıda ~1,5 saat kesintideydi (15 deneme başarısız); kullanıcı beklemekten vazgeçince kalan iki kapsam yedek modelle tamamlandı. **Space Bunny** kendi kapsamını istenen model olarak baştan sona yürüttü.

## Toplam tablo

| Rapor | yüksek | orta | düşük | toplam |
|---|---|---|---|---|
| rapor-3 (Günlük/Öğren/Ayarlar/Rapor) | 4 | 15 | 15 | 34 |
| rapor-4 (Ana sayfa akışı) | 2 | 5 | 8 | 15 |
| rapor-5 (Doz/yemek/test) | 2 | 5 | 6 | 13 |
| **GENEL** | **8** | **25** | **29** | **62** |

Kategori dağılımı (yaklaşık): ÇELİŞKİ 18 · EKSİK 24 · GEREKSİZ 3 · KIRIK 4 · WEB-NOTU/a11y 13.
Yatay taşma taraması (390 px, 4+ ekran): **0 taşma**. Hesap matematiği (TIR, bolus, ICR penceresi, et kuralı, 500/1800) **doğru** — bulgular ağırlıkla işlev kablolaması, geri bildirim ve a11y kaynaklı.

## 8 YÜKSEK BULGU (hepsi Lead tarafından doğrulandı)

| # | Ekran | Sorun | Kanıt |
|---|---|---|---|
| 1 | Ayarlar › Bazal | **"Azalt" (−) düğmesi değeri ARTIRIYOR**: 0 görünen Günlük doz alanında − basınca 1 oluyor ve **sessizce 1 Ü bazal kaydediliyor**. `ui.tsx:269-275` alt-sınır kilidi ters (`if (next < min) next = min` → `next = cur` olmalı). | Lead canlı repro: değer 0→1, `localStorage.settings.state.settings.basalDose=1` (`verify-azalt-artiriyor.png`) |
| 2 | Öğren › Oranlarım | **"Saat dilimi ekle"** kullanıcının oranlarını değil sabit varsayılanı (1Ü=10 g/50) ekliyor → aktif saatte **iki kat insülin** riski, uyarı yok. `store/settings.ts:103-104` (karşıt: `setTimeBlocks` doğru kopyalıyor). | Bunny canlı (20/40 kullanıcısına 10/50 geldi) + Lead kaynak teyidi |
| 3 | Rapor (web) | **"PDF raporu paylaş" raporu değil uygulama ekranını yazdırıyor** — expo-print web'de `options.html` yok sayılıyor (`ExponentPrint.web.js:8-10` → `window.print()`). Mobil yol doğru. | Lead node_modules teyidi + bunny `window.print` stub ölçümü |
| 4 | Öğren › Oranlarım | **"Rehberli bazal testi yap" aktif test varken yanlış testi açıyor** (`test.tsx:21 if (active) return <ActiveTest/>` kind parametresini yok sayıyor). | Bunny canlı + Lead kaynak teyidi |
| 5 | Kayıt (entry) | **Hipo tedavi kaydını düzenlemek `hypoCarbs`'ı kalıcı siliyor** — form alanı göstermiyor, update patch'i açıkça `undefined` yapıyor (`entry.tsx:219-225`). Hipo istatistikleri bozulur. | A2 canlı repro + Lead kaynak teyidi |
| 6 | Kayıt (entry) | **Düzenleme/silmede geri al yok** (eklemede var) — `entry.tsx:241`; silme onayı bağlı tokluk zincirini de sildiğini söylemiyor. | A2 canlı doğrulama |
| 7 | Yemek seç (pick-foods) | **AddFood kartı ekran dışında açılıyor** — alt sıralardaki yemeğe dokununca kart listenin üstünde (inline, modal değil: `food-browser.tsx:162-181`), ekle butonu `y:-1314, visible:false`; kullanıcı "hiçbir şey olmadı" sanıyor. | B2 eval ölçümü + Lead kaynak teyidi |
| 8 | Testler (/test) | **Oran blokları boşken StartTest crash** — `activeBlock(...)!` (`test.tsx:38`) guard'sız; şeker girilince beyaz ekran, error boundary yok. Calc aynı durumda güvenli kartla karşılıyor. | B2 konsol kanıtı + Lead kaynak teyidi |

## Öne çıkan orta bulgular (tam liste raporlarda)

- Varsayılan `basalDose=0` ↔ alan `min=1` çakışması: Ayarlar'da açılışta kırmızı "kaydedilmedi" uyarısı, Günlük'te boş bazal formu.
- İnsülin çipi ↔ "Etki hızı" segmenti çelişebiliyor (Fiasp seçiliyken Standart → `peak:75`).
- Hipo ekranında (web) çıkış yolu yok (header linki DOM'da yok, treat/wait'te Kapat butonu yok).
- Rehberde var olmayan ekran adları: "Yemekler sekmesi", "Hesapla ekranı", "Ayarlar/Oranlar sekmesi".
- Etiketten hesap sonucunu aktaran buton yok (`onUse` kablosuz); "Genel bakış"ta seçili tarih aralığı yazmıyor; "son 6 hafta/4 hafta" çelişkisi.
- Test bitişinde onay/toast yok; test ölçüm penceresine hatırlatıcı kurulmuyor; bazal testte 2 sa/6 sa kuralları zorunlu değil; iptal edilen testin başlangıç kaydı günlükte kalıyor.
- "Tüm günlük kayıtlarını sil" sonrası bildirim/geri al yok; yedek `tests` deposunu taşımıyor; rapordaki "Raporda görünecek ad" hiçbir yerde kalıcı kaydedilmiyor (`patientName` yazan kod yok).
- Web'de CSV paylaşımı `navigator.share` hatasında indirmeye düşmüyor; yedekten geri yüklemede dosya seçici iptalinde expo-document-picker `removeChild` NotFoundError (Metro loglarında 5×; `c-settings-04-error-overlay.png`).
- Dokunma hedefleri: akordiyon başlıkları 23 px, rapor toplu-seçim bağlantıları 19 px, "+ Tokluk şekeri ekle" 31 px.

## WEB-NOTU (mobil hatası değil)

Bu react-native-web sürümü `accessibilityState`'i DOM'a çevirmiyor: Toggle/Segmented/Collapsible'da `aria-checked/selected/expanded` üretilmiyor (görsel açık anahtarlar ekran okuyucuya kapalı görünüyor). Bildirimler ve haptik web'de bilinçli kapalı; "Uygulama sürümü" kartı web'de render edilmiyor (`settings.tsx:138`).

## Önerilen düzeltme sırası

1. #1 `nudge` alt-sınır kilidi (tek satır) ve #5 entry update patch'inin alan silmesi — **sessiz veri bozma**.
2. #2 `addBlock` oran kopyalaması (klinik risk) ve #8 `/test` boş-blok guard'ı (crash).
3. #7 AddFood'u modal/bottom-sheet'e alma; #4 aktif testte kind çelişkisi; #6 düzenleme/silmede geri al.
4. Web PDF akışı (#3): `buildReportHtml` + gizli iframe `print()`.
5. Geri bildirim eksikleri (toast/onay) ve metin düzeltmeleri; a11y `aria-*` geçişleri.

## Kanıt dosyaları

- `audit/shots/` — 60+ ekran görüntüsü: `c-*` (bunny, 25), `a2-*` (9), `b2-*` (13), `verify-azalt-artirior.png` (Lead repro).
- B2'nin son 4 görüntüsü oturum kapanırken çekildiği için bozuk olabilir (1 byte); ilgili bulguların asıl kanıtı snapshot/eval metinleridir.
- Metro logları: `expo-document-picker` web `removeChild` hatası 5×; `expo-print` web `html` yok sayması.

## Süreç notu

- Expo sunucusu ve agent-browser oturumları denetim boyunca paylaşımlı kullanıldı; kaynak koda hiçbir ajan dokunmadı (yalnızca `audit/` altına yazıldı).
- Denetim sırasında uygulama içi test verileri ajan oturumlarının kendi localStorage'larında tutuldu; a2 oturumu verilerini temizleyerek kapandı.
