# Rapor 5 — Doz hesapla / Yemek seçim / Yemek listesi / Oran testleri (mobil UX + fonksiyon)

Oturum: agent-browser `audit-b2`, iPhone 12 viewport (390×844), Metro 8081. Yöntem: kaynak okuma + canlı akış (snapshot -i + eval ölçüm + ekran görüntüsü). Onboarding hızlı geçildi (NovoRapid, tam ünite, ICR 10 / ISF 50 / hedef 110 / aralık 80–140).
Not: `test.tsx`'teki "aktif test varken `?kind=basal` yanlış testi açıyor" bulgusu (test.tsx:21) başka ajan tarafından raporlandı → burada YOK.

## ÖZET
- **13 bulgu: 2 yüksek, 5 orta, 6 düşük.**
- **En kritik 3:**
  1. **[yüksek] pick-foods'ta yemek kartı ekran dışında açılıyor** — aşağıdaki bir yemeğe dokununca hiçbir şey olmamış gibi görünüyor (buton y=−1314, scroll değişmiyor).
  2. **[yüksek] /test, oran blokları boşken crash** — StartTest `activeBlock(...)!` (test.tsx:38) şeker girilince beyaz ekran atıyor (calc aynı durumda güvenli kartla karşılarken).
  3. **[orta] "Testi tamamla" sonrası hiçbir geri bildirim yok** — ekran anında sıfır "Başlayalım" formuna dönüyor; testin bittiği/kaydedildiği anlaşılmıyor.
- Hesap matematiği, sepet↔hesap transferi, et kuralı, hipo güvenlik kartı, ICR pencere mantığı ve sonuç hesabı **doğru çalışıyor** (aşağıda ekran bazlı TAMAM listeleri).

---

## BULGULAR

### Yüksek
- **[yüksek] KIRIK — pick-foods: AddFood kartı görünmez açılıyor.** Yemek satırı `onPress` kartı listenin en üstüne (arama çubuğunun üstüne) ekliyor (food-browser.tsx:162-181), uzun listede alt sıralara dokununca kart viewport dışında kalıyor, otomatik scroll yok. Kanıt: "Mantı (yoğurtlu)" satırına dokunma sonrası eval → ekle butonu `y:-1314, scrollY:0, visible:false`; ekran değişmemiş görünüyor (b2-pickfoods-uzak-satir-sonrasi.png). Öneri: AddFood'u modal/bottom-sheet olarak aç veya dokunma sonrası `scrollTo` ile kartı görünür getir.
- **[yüksek] KIRIK — /test boş-ayarda crash.** Bloklar boşken (boş-ayar) StartTest `activeBlock(settings.blocks, ...)!` (test.tsx:38) undefined döner; şeker girilince `calcBolus({block: undefined})` patlar, error boundary yok → tüm ekran beyaz. Kanıt: konsol `An error occurred in the <StartTest> component... Cannot read properties of undefined` (b2-test-startform-bos-block-crash.png); ActiveTest aynı durumda zarifçe "Saat dilimi bulunamadı" diyor, StartTest çöküyor. Öneri: `!` yerine guard + calc.tsx:84-96'daki kartla aynı güvenli ekran.

### Orta
- **[orta] ÇELİŞKİ — calc boş-ayar metni yanlış.** Bloklar tamamen boşken kart "Ayarlardaki oranlarında **hata var**" diyor ama hata listesi boş çıkıyor; kullanıcı neyi düzelteceğini bilmiyor (calc.tsx:84-95). Kanıt: b2-calc-bos-ayar.png (listede hiç Notice yok). Öneri: "Oranların henüz girilmemiş" ile "oranlarda hata var" durumlarını ayrı metinle göster.
- **[orta] EKSİK — test bitişinde geri bildirim yok.** "Testi tamamla" / bazal "Testi bitir" → store'a `finished` yazılıyor ama ekranda anında temiz StartTest formu açılıyor; onay, toast veya geri dönüş yok (test.tsx:223, 203-208). Kanıt: b2-test-tamamla-sonrasi.png + eval `finished:[{kind:"icr"...}]` (b2-test-basal-sonuc.png). Öneri: "Test bitti, sonuç kaydedildi" toast'ı + önceki ekrana dönüş.
- **[orta] EKSİK — test ölçüm zamanı için hatırlatıcı yok.** ICR/ISF testi 2,5–5 saatlik ölçüm penceresine local notification kurmuyor (ActiveTest'te hiç notification çağrısı yok; calc'ta ise schedulePostMealReminder var, calc.tsx:175). Kullanıcı uygulamayı kapatırsa teste dönmeyi unutur. Öneri: test başlarken ideal pencereye (start+180 dk) bildirim kur, iptal/finish'te sil.
- **[orta] EKSİK — bazal test pencere kuralları zorunlu değil.** "2 saatte bir" ve "en az 6 saat" yalnız öneri: 1–2 dk arayla okuma kabul ediliyor, 2 okumayla bitir her an aktif; drift metni test süresiyle yazılıyor ("7 saatte +10 mg/dL değişti") ama +10 son-okuma aralığına ait olabilir (test.tsx:200, 204-208, 295; ratios.ts:260-266). Kanıt: simülasyon — 1 dk arayla 120→130 okuma, metin "7 saatte +10... uygun görünüyor" (b2-test-basal-sonuc.png). Öneri: okumalar arası min aralık doğrula + metni ilk-son ölçüm aralığına göre yaz.
- **[orta] ÇELİŞKİ — iptal edilen testin başlangıç kaydı günlükte kalıyor.** ICR başlat → iptal onayında kayıt (KH+doz, not "testi başlangıcı") silinmiyor; kullanıcı aynı öğünü yeniden girerse çift IOB. Kanıt: cancel sonrası `active:null` ama log girişi duruyor (eval), test.tsx:69-79 + tests.ts:37. Öneri: iptal onayında "başlangıç kaydı günlükte kaldı" bilgisi ver (veya silme seçeneği sun).

### Düşük
- **[düşük] ÇELİŞKİ — sepet "−" düğmesi ≤10 g'da öğeyi siliyor.** accessibilityLabel "10 gram azalt" ama kod grams≤10'da `removeFromCart` çağırıyor; tek dokunuşla satır kaybolur (food-browser.tsx:76-79). Öneri: 0'a inince "çıkar" rolüne geçir veya onay sor.
- **[düşük] EKSİK — porsiyon çipi 0 adetle 0 g'lık öğe ekliyor.** Adet alanı "0" iken çipe dokunmak 0 g / 0 KH sepet satırı oluşturuyor (food-browser.tsx:316); "Bu gramı tabağa ekle"deki `grams>0` koruması çipte yok. Öneri: `onAdd`'ten önce `grams>0` kontrolü.
- **[düşük] EKSİK — kategori çipleri ve yemek satırlarında erişilebilirlik rolü yok.** Pressable'lar `accessibilityRole="button"` olmadığından a11y ağacında "generic clickable" (snapshot kanıtı); ekran okuyucu amaç bildiremez (food-browser.tsx:205-214, 237). Öneri: role=button + anlamlı label.
- **[düşük] ÇELİŞKİ — değişim yönteminde etli yemekler "≈ 0 g KH" görünüyor.** Listede 0 g yazması kafa karıştırıcı; +10 g et kuralı sessizce sadece sepette beliriyor (food-browser.tsx:243-247; kanıt b2-pickfoods-sepet-etkurali.png: "Etli taze fasulye ≈ 0 g KH" ama 150 g ette toplam +10). Öneri: etli satırlarda "KH'siz · >100 g'da +10 g kuralı" kısa notu.
- **[düşük] EKSİK — StartTest'te pasif "Testi başlat" bazen sessiz.** Şeker boşken buton neden pasif açıklanmıyor (uygunluk uyarıları yalnız şeker dolunca çıkıyor; test.tsx:64-67, 136). Öneri: disabled iken "Önce şekerini gir" yardımcı satırı.
- **[düşük] ÇELİŞKİ — "Vurduğun doz" farklıysa bileşen split gerçekle uyumsuz.** save(), given=8 Ü olsa bile mealBolus/correctionBolus'u **öneriye** göre yazıyor (calc.tsx:165-167); log analizi bu split'e dayanırsa sapma oluşur (bugün analizler e.bolus kullandığından etkisi düşük). Öneri: verilen/given oranıyla ölçekle veya split'i yazma.
- **[düşük] GEREKSİZ — retro kayıtta üst bilgi "şimdi" değerlerini gösteriyor.** Hesap doz zamanındaki IOB/COB'la yapılırken su seviyesi başlığı her zaman o anki `iobNow/cobNow` gösteriyor; geçmişe dönük kayıtta başlık ile "Hesabın detayı" çelişiyor (calc.tsx:103-104 vs 219-239). Öneri: retro modda başlıkta "o saatte" değerlerini göster.

---

## EKRAN BAZLI TAMAM LİSTELERİ

**calc (Doz hesapla):** mod seçici (4 mod) çalışıyor; 180 mg/dL + 45 g → 6 Ü (4,5 öğün + 1,4 düzeltme, kaleme yuvarlama doğru) (b2-calc-hesap-sonuc.png); sepet özeti + Temizle + satır detayları ✓; sepet değişince KH alanı otomatik güncelleniyor (et kuralı dahil 32 g) ✓; "Sadece ölçümü kaydet" + toast + "Geri al" ✓; hipo güvenlik: bg 60 girince doz kartı kapanıp "Hipo adımlarını aç" çıkıyor → /hypo doğru 10 g tedavi planı (b2-hypo-modal.png) ✓; aktif test bildirimi dokunmaya hazır ✓; test teklifi kartı: "Evet, takip et" → test başlatıp /test'e götürüyor, "Hayır" kapatıyor (b2-calc-kaydet-test-teklifi.png) ✓; boş-ayarda güvenli kilit + "Ayarlara git" → /settings ✓ (metin hatası ayrı bulgu); SaveBox satırı 390 px'te taşmıyor (alan 196 px + buton 120 px) ✓. Not: "Son ölçümü kullan" canlı doğrulanamadı (stale ref'li tıklama); kod incelemesinde mantık doğru.

**pick-foods (Yemek seç):** arama + kategori çipleri + boş durum metinleri ✓; gram girişinde canlı KH önizleme (100 g → 20 g) ✓; porsiyon çipi tek dokunuşla ekleyip kartı kapatıyor ✓; "Hesaplamaya dön (20 g)" → calc'e dönüş + aktarım ✓; modal sunum + Geri başlığı ✓ (görünürlük sorunu: yüksek bulgu).

**foods (gizli sekme):** MealChips + öğün seçimi ✓; sepet ±10 g / çıkar ✓; et kuralı doğru: 150 g et → +10 g, toplam 30→32 g tutarlı (b2-pickfoods-sepet-etkurali.png) ✓; şablon kaydetme alanı (isim gerekene dek pasif) ✓; "Doz hesapla (60 g)" → /calc, alan otomatik dolu, "Tabaktakiler: 60 g KH (1 yemek)" ✓.

**test (StartTest + ActiveTest + sonuç):** ICR formu: doz önerisi (4 Ü) + "Vurduğun doz" alanı ✓; erken ölçüm "sadece kayıt için" pencereyi bozmıyor ✓; pencere dolunca "Ölçüm zamanı!" ✓; sonuç doğru: gerçekleşen oran 1 Ü = 11,5 g vs ayar 10 g + 1/3 sayaç (b2-test-icr-sonuc.png) ✓; iptal onayı (web confirm, mobilde Alert) çalışıyor ✓; güvenlik: önceki dozdan aktif insülin varken ICR ve bazal başlatma doğru engelleniyor ("Vücudunda hâlâ 4 Ü aktif insülin var") ✓; bazal: okuma listesi, ±30 mg/dL karar kartı, 2 okumada bitir aktif, finished kaydı ✓ (b2-test-basal-aktif.png, b2-test-basal-sonuc.png); aktif test varken /test sıradan erişimde doğru ekrana gidiyor; bloklar boşken ActiveTest "Saat dilimi bulunamadı" ile güvenli kapanıyor ✓ (StartTest crash'i: yüksek bulgu).

## KANIT DOSYALARI (audit/shots/)
b2-calc-hesap-sonuc, b2-calc-kaydet-test-teklifi, b2-calc-bos-ayar, b2-pickfoods-uzak-satir-sonrasi, b2-pickfoods-sepet-etkurali, b2-test-icr-start, b2-test-icr-sonuc, b2-test-tamamla-sonrasi, b2-test-basal-aktif, b2-test-basal-sonuc, b2-hypo-modal, b2-test-bos-ayar, b2-test-startform-bos-block-crash (.png).
