# Rapor 4 — Onboarding · Ana Sayfa · Kayıt (entry) · Hipo akışı

**Yöntem:** 4 dosya kaynak okuması + agent-browser canlı test (390×844 viewport, `--session audit-a2`). Model görüntü girdisi yok; kanıt = snapshot metni + eval ölçümü + insan için ekran görüntüsü (`audit/shots/a2-*.png`, 9 adet). Kaynak kod değiştirilmedi; test verisi localStorage'a eklendi ve oturum sonu temizlendi.

## ÖZET

- **15 bulgu: 2 yüksek, 5 orta, 8 düşük.** 4 akış da uçtan uca çalışıyor; veri modeli ve hesaplar doğru (TIR %33, bazal saati dün 21:00, hipo 15 g min. doz ✓).
- **En kritik 3:**
  1. **Hipo tedavi kaydını düzenlemek 15 g'lık hipo karbonhidratı kalıcı siler** (canlı doğrulandı) — hipo istatistikleri ve "Bugün" toplamı bozulur.
  2. **Düzenleme ve silmede geri al yok, eklemede var** (bilinen çapraz bulgu canlı doğrulandı) — tıbbi kayıtta tutarsız güvenlik.
  3. **Hipo ekranında (web) çıkış yolu yok:** header geri bağlantısı DOM'da yok, treat fazında Kapat/İptal butonu da yok.
- Onboarding 5 adım (StepDots "Adım N / 5"), "Başla" → `/` replace ✓; ana sayfa kartları (bazal/tokluk/öneri), tile ızgarası (390px'te 173×148 px), rehber 4 adım ✓.

---

## BULGULAR

**[YÜKSEK] KIRIK** — entry, düzenleme formu (entry.tsx:87, 219-225) — Hipo tedavisi kaydında `hypoCarbs` (ve `ketones`) formda hiç gösterilmediği ve update patch'inde açıkça `undefined` yapılıp `log.update` spread ile birleştirdiği (log.ts:26-28) için, kullanıcı hiçbir şey değiştirmeden Kaydet'e bassa bile hipo gramı kayıttan siliniyor. Kanıt: `seedhypo` kaydı (hypoCarbs:15) `/entry?id=seedhypo` → Kaydet → `{hypoCarbs:undefined, carbs:undefined}`; karbonhidrat alanı boş görünüyordu (screenshot: a2-hypo-55-tedavi.png bağlamsız). Öneri: `hypoCarbs`'u Karbonhidrat alanına yansıt ve update'i yalnızca değişen alanlarla sınırla (veya `log.update`'te undefined'ı "sil" olarak uygulamayı ayrı anahtara al).

**[YÜKSEK] ÇELİŞKİ** — entry, Kaydet (entry.tsx:241 `if (!existing && savedId)`) — Yeni kayıt 5 sn'lik "Geri al" toast'ı alırken (canlı: "Şeker 65 mg/dL kaydedildi" + Geri al ✓) düzenleme-kaydetmede hiç bildirim yok (canlı: toastGorundu=false, geriAl=false, bg 160→170 sessiz güncellendi); silmede de onay sonrası geri al yok. Öneri: update öncesi eski kaydı yakalayıp toast"a "Geri al" (eski değeri geri yazan) ekle; silme için de aynı.

**[ORTA] WEB-NOTU** — hypo, çıkış yolları (hypo.tsx:144-192, 252-274; _layout.tsx:70) — Treat ve wait fazlarında ekranda Kapat/İptal butonu yok; web'de ayrıca header geri bağlantısı DOM'da hiç oluşmuyor (eval: `links:[]`, `backBtn:false`, tek `h1`). Kanıt: a2-hypo-55-tedavi.png + snapshot (yalnız input+Aldım butonu). Öneri: treat/wait fazlarına "Kapat"/"İptal" Btn ekle (mobilde de kaçış yolu netleşir), web header'ını ayrıca doğrula.

**[ORTA] EKSİK** — entry, Kaydı sil (entry.tsx:493-499) — Onay "Bu kayıt silinsin mi?" derken bağlı tokluk ölçümlerini (`afterId` zinciri) de sessizce siliyor ve sonrasında geri al yok (canlı: confirm → `postKaldi:false`, entry yok). Öneri: onay metnine "bağlı tokluk ölçümü de silinecek" ekle, silinenleri toast ile geri alınabilir yap.

**[ORTA] WEB-NOTU** — entry, router.back (entry.tsx:239) — Kayıt doğrudan URL ile açılıp (`/entry?id=…`) kaydedilince `router.back()` gezinme yapmaz, form ekranda kalır (canlı: URL `/entry?id=…` + kayıt güncel; historyLen=3). Öneri: back başarısızsa `router.replace('/')` fallback'i.

**[ORTA] ÇELİŞKİ** — entry, Tokluk Toggle + Notice (entry.tsx:83, 376-379) — `?after=` ile açılınca toggle görsel olarak AÇIK (track teal, eval: `rgb(76,195,207)`) ve Notice doğru; ama düzenleme ekranında toggle açıkken `afterSrc` olmadığı için "hangi yemeğin tokluğu" Notice'ı hiç görünmüyor (eval: notice=false). Öneri: Notice koşulunu `post`'a bağla, yemeği `mealBefore` ile göster.

**[ORTA] EKSİK** — onboarding, tahmin yolu (onboarding.tsx:132-149) — "Hayır, birlikte bulalım" seçilince iki doz alanı da dolmadan ilerleme yok ve atla/seçeneği yok; dozlarını bilmeyen kullanıcı yalnız Geri ile dönebilir. Kanıt: EstimateForm (settings-forms.tsx:264 `b>0 && r>0`). Öneri: "Bilmiyorum, varsayılanlarla başla" çıkışı ekle.

**[DÜŞÜK] GEREKSİZ** — home, "Hızlı erişim" rozeti (index.tsx:367-371) — Başlığın yanındaki pill hiçbir işlevi olmayan süs metin; taramada buton sanılıyor. Kanıt: snapshot'ta statik, onClick yok. Öneri: kaldır.

**[DÜŞÜK] ÇELİŞKİ** — home, trend ikonu (index.tsx:144) — Stabil (Δ −20..20) için `arrow-forward` kullanılıyor; "ileri git" eylem oku gibi okunuyor, "sabit" çağrıştırmıyor. Kanıt: kaynak; a2-home-dolu-390.png. Öneri: `remove` (yatay çizgi) veya "Stabil" metni.

**[DÜŞÜK] ÇELİŞKİ** — hypo, hızlı karbonhidrat seçenekleri (hypo.tsx:170-180) — Seçenek kartları (15 g glukoz tab unsur) salt View; dokununca "Aldığın miktar"a yazılmasını kullanıcı bekler. Kanıt: snapshot'ta role=button yok. Öneri: dokununca `setTakenText` ile doldur.

**[DÜŞÜK] EKSİK** — hipo/entry, geri al süresi (toast.tsx:21, DURATION=5000) — Tıbbi kayıt için 5 sn'lik geri al penceresi kısa; canlı testte bazal "Vurdum" sonrası undo tıklaması pencere kapandığı için kaçtı. Kanıt: toast otomatik kayboldu (eval geri al bulunamadı). Öneri: undo taşıyan toast için 10-12 sn.

**[DÜŞÜK] ÇELİŞKİ** — öğün etiketi, "Gece 3" (meals.ts:11) — 00:00–06:00 aralığı "Gece 3" diye anılıyor; ana sayfada "Şu an: Gece 3 zamanı", entry'de çip "Gece 3" — kullanıcı "3. gece" sanır. Kanıt: home eval + entry snapshot (e81). Öneri: "Gece" veya "Gece (00–06)".

**[DÜŞÜK] WEB-NOTU** — ui, Toggle a11y (ui.tsx:481) — `accessibilityState={{checked}}` web DOM'unda `aria-checked` üretmiyor; ekran okuyucu durumu duyuramıyor (eval: aria-checked=null, görsel teal). Kanıt: entry/hypo snapshot `[checked=false]` iken track teal. Öneri: web'de `aria-checked` manuel geçir (Pressy rest props üzerinden).

**[DÜŞÜK] EKSİK** — onboarding, bazal dozu (onboarding.tsx:69-82) — Bazal *isim* soruluyor ama *doz* sorulmuyor; `basalDose` 0 kalınca home "Bazal vurdun mu?" kartı ve rehber 4. adım uzun süre boş duruyor (canlı: doz set edilene kadar kart hiç görünmedi). Öneri: 1. adıma opsiyonel "Günlük bazal dozun" alanı ekle veya bitişte Ayarlar'a yönlendir.

**[DÜŞÜK] WEB-NOTU** — onboarding, oran alanları a11y (settings-forms.tsx:54-58 → ui.tsx:299) — Help'li NumField'lerde input'un accessible name'i placeholder'dan "0" olarak okunuyor (snapshot: `textbox "0"`); KH oranı/düzeltme/hedef alanları ekran okuyucuda adını duyuramıyor. Öneri: Field'e `accessibilityLabel={label ?? helpEtiketi}` taşı.

---

## EKRAN BAZINDA DOĞRULANANLAR (TAMAM)

**onboarding.tsx — kurulum (5 adım, canlı uçtan uca "Başla"ya kadar):**
- Adım 0 hoş geldin; İleri (e3) çalışıyor; Geri step>0'da ✓ (satır 30).
- Adım 1: 5 insülin çipi + ada yazma + etki hızı + kalem adımı; NovoRapid+0,5 seçimi store'a anında yazılıyor (rapid/penStep/peak doğrulandı).
- Adım 2: iki Choice kartı doğru metin, tıklayınca direkt adım 3 ✓ (satır 100-114).
- Adım 3 doctor: RatioEditor 10/50/110/80/140 dolu geliyor ✓; "İleri" `valid` guard'lı ✓.
- Adım 4: özet blok değerleri + "Başla" → `onboarded:true` + `/` replace ✓; header'dan kaçış kapalı (`headerBackVisible:false, gestureEnabled:false`, _layout.tsx:69) ✓.
- StepDots aria "Adım N / 5" 1-tabanlı doğru ✓.

**(tabs)/index.tsx — ana sayfa:**
- Selamlama + öğün bilgisi canlı saat ✓; "Son şekerin" boşta "—/Henüz ölçüm kaydetmedin", 65'te "1 dk önce · Düşük" (danger), 145'te "Hedefin üstünde" ✓.
- TIR şeridi yalnız ≥3 ölçümde, %33 matematik doğru (65 alt / 110 içeri / 145 üstü) ✓.
- Bazal kartı: yalnız pencere + kayıt yokken; "Vurdum" dün 21:00'e kaydediyor ✓, toast+Geri al ✓, kayıt varken kart gizleniyor ✓; "Başka saatte" → `/entry?basal=1` bazal alan dolu ✓.
- Tokluk kartı: 60-240 dk penceresi, "95 dk geçti" ✓, `/entry?after=` bağlantısı post'u otomatik işaretliyor ✓, kayıt `afterId` bağını kuruyor ✓.
- 6 tile 390px'te 2 kolon 173×148 px, ariaLabel'lı ✓; rehber 4 adım, tamamlanan üstü çizili ✓ (eval: line-through).
- Kayıt sonrası toast: "Şeker 65 mg/dL kaydedildi" / "Kayıt kaydedildi" + Geri al (yeni) ✓.

**entry.tsx — kayıt ekle/düzenle:**
- `?mode=bg` sade akış: zaman çipleri, öğün çipleri, açlık/tokluk seçimi, büyük değer alanı, ölçüm saati offset çipleri ✓; doğrulama: "Şeker 20–600 arasında olmalı." + Kaydet disabled ✓; boş-guard ✓.
- `?basal=1` → tam form + Bazal (Tresiba) alanı ve doz dolu ✓; 20:30–02:00 otomatik bazal alanı (satır 103-104) tasarım gereği.
- Yeni kayıt toast + Geri al ✓; tokluk kaydı `post/afterId` yazıyor ✓; düzenleme değerleri dolu geliyor (Şeker 160 ✓), Kaydet güncelliyor ✓.
- Silme: window.confirm "Kaydı sil / Bu kayıt silinsin mi?" ✓, kayıt + bağlı tokluk zinciri siliniyor ✓.
- Yemek satırları ±10 g / sil / Temizle + "Yemek listesinden seç" (satır 428-457) kaynak okumasıyla tamam (canlı test kapsamı dışı).

**hypo.tsx — hipo akışı (uçtan uca):**
- Boş açılış: tek büyük giriş + yönlendirici yardım metni ✓; `?bg=` parametresi dolu geliyor ✓ (calc bağlantısı aynı yol).
- 55 → tedavi kartı: 15 g (min), beklenen şeker, seçenek listesi, "Aldım, sayacı başlat" ✓; geri al → entry silinir + treat fazına döner ✓ (2. tur testinde canlı).
- 2. tur: "Şekerin hâlâ düşük. 2. tur" uyarısı ✓; bekleme: 15:00 geri sayım, "Dinlen, egzersiz yapma, araç kullanma.", erken ölçüm girilebiliyor ✓; 100 → "3. Şekerin düzeldi" + takip atıştırması mantığı ✓ + Kapat ✓.
- 40 → glukagon/112 ciddi uyarı + min 20 g ✓; 200 → "Karbonhidrat ALMA" + Doz hesapla + Kapat ✓; 75 → "biraz altında ama düşük değil" ✓; geçersiz → 20-600 uyarısı (statik) ✓.
- "Bu miktar nasıl hesaplandı?" katlanabilir + rise/tablet ayarları + otomatiğe dön (satır 196-247) kaynak okumasıyla tamam.

**Test görüntüleri:** `audit/shots/` → a2-onboarding-0-hosgeldin, a2-onboarding-1-insulin, a2-onboarding-4-hazirsin, a2-home-bos-390, a2-home-65dusuk, a2-home-dolu-390, a2-home-tokluk-kayit, a2-hypo-55-tedavi, a2-hypo-duzeldi (.png).
