# plan.md — Fiş Fotoğrafından Excel’e (Node.js + Express + React + Gemini + SheetJS)

## 1) Objectives
- Türkçe, foolproof web arayüzü ile **toplu fiş yükleme → AI ile alan çıkarma → doğrulama → düzenleme → Excel export** akışını otomatikleştirmek.
- En kritik çekirdek akışı (Gemini Vision + JSON şema + doğrulama) önce izole biçimde kanıtlamak (POC), sonra uygulamayı bunun etrafında inşa etmek.
- KVKK: Fotoğraflar **diskte kalıcı tutulmayacak**; yalnızca session süresince **memory’de** (resize edilmiş) preview.

## 2) Implementation Steps

### Phase 1 — Core POC (Isolation) (Gemini Vision → JSON → Validation)
**Amaç:** Tek fiş görseliyle uçtan uca pipeline’ın stabil çalıştığını kanıtla; kırılgan noktaları (model çıktısı, JSON parse, doğrulama) çöz.

**User stories (POC)**
1. Bir geliştirici olarak tek bir fiş görselini script ile çalıştırıp JSON çıktısını terminalde görmek istiyorum.
2. Bir geliştirici olarak model JSON’u bozarsa (code fence/ek metin) otomatik temizlenip parse edilsin istiyorum.
3. Bir geliştirici olarak tarih/total/KDV tutarlılığı otomatik kontrol edilip “kontrol gerekli” kararı üretilsin istiyorum.
4. Bir geliştirici olarak HEIC dahil farklı formatların dönüştürülüp işlenebildiğini görmek istiyorum.
5. Bir geliştirici olarak farklı Gemini model adını config’ten değiştirip aynı scripti tekrar koşmak istiyorum.

**Adımlar**
- Repo/ortam keşfi: mevcut template’in (React + backend) dizin yapısı ve supervisor konfigini incele.
- **Supervisor’ı Node backend’e geçir** (port **8001**, host 0.0.0.0, `/api` prefix korunacak).
- `backend/scripts/poc_gemini_receipt.js`:
  - input: tek görsel dosyası (jpg/png/webp/heic)
  - heic→jpeg (heic-convert) + resize (sharp, uzun kenar max 1568)
  - Gemini Vision çağrısı (Google AI Studio key ile) + sadece JSON isteyen prompt
  - JSON parse: code-fence temizleme, trailing text kırpma
  - doğrulama: toplam vs (matrah+kdv) tolerans ±0.05, tarih range, toplam>0, `guven_skoru<80` flag
  - çıktı: normalize JSON + `needs_review` boolean
- Web araştırması (kısa): Gemini Vision Node SDK usage + image inline/base64 best-practice ve JSON mode/response schema yaklaşımları.
- POC exit kriterlerini sağlayana kadar prompt + parse + validation iterasyonu.

**POC çıktısı**
- 1-3 örnek Türk fişiyle tutarlı JSON (şemaya uygun) + doğrulama sonucu.

---

### Phase 2 — V1 App Development (Build around proven core)
**Amaç:** POC’da kanıtlanan pipeline’ı web uygulamasına taşı; tek ekran akışını çalışır hale getir.

**User stories (V1)**
1. Kullanıcı olarak fişleri sürükle-bırak ile yükleyip sistemin işlemeye başladığını net görmek istiyorum.
2. Kullanıcı olarak her fişin durumunu (bekliyor/işleniyor/tamam/hata/kontrol gerekli) canlı takip etmek istiyorum.
3. Kullanıcı olarak “kontrol gerekli” satırlarını sarı vurgulu görüp hücreleri tabloda anında düzeltebilmek istiyorum.
4. Kullanıcı olarak satıra tıklayınca sağ panelde fiş görselini görüp yazıları doğrulayabilmek istiyorum.
5. Kullanıcı olarak tek tıkla Excel’e aktar deyip .xlsx dosyasını indirip muhasebe işime devam etmek istiyorum.

**Backend (Node + Express)**
- Endpoints:
  - `POST /api/session` → yeni session id
  - `POST /api/session/:id/upload` (multer, max 100) → job queue başlat
  - `GET /api/session/:id/status` → satır bazlı durum + özet (polling)
  - `POST /api/session/:id/retry/:receiptId` → hatalı fişi yeniden dene
  - `GET /api/session/:id/image/:receiptId` → memory’deki preview image (buffer)
  - `GET /api/session/:id/export.xlsx` → SheetJS ile export
  - `GET/PUT /api/settings` → runtime Gemini model adı (default .env)
- İşleme:
  - p-limit ile concurrency=3
  - her dosya: convert/resize → gemini → parse → validate → store (in-memory)
  - duplicate tespiti: `(firma_unvani + tarih + toplam + fis_no)` hash
  - KVKK: upload temp dosyası hemen sil; sadece resize preview buffer memory’de; session temizlenince hepsi sil

**Frontend (React, Türkçe, foolproof)**
- Sayfalar/bölümler:
  - Ana yükleme alanı (drag&drop + tıkla seç)
  - İşlem listesi + progress + durum pill’leri
  - Sonuç tablosu (inline edit) + satır seçimi
  - Sağ panel preview image
  - Üstte: Ay filtresi / arama; Ay bazlı gruplama görünümü
  - Ayarlar: Gemini model adı değiştir (runtime)
  - Özet: “X fiş işlendi, Y kontrol gerekli”, duplicate uyarıları
  - KDV özet kartları: %1/%10/%20 toplam matrah+kdv
- Durum yönetimi: sessionId + polling (örn. 1–2 sn) + optimistic edits

**V1 test (testing agent)**
- E2E: 3–10 fiş upload → tablo oluşuyor → edit → export indir → Excel kolon/formül/date doğrula.

---

### Phase 3 — Feature Completion & Hardening (per requirements)
**Amaç:** Aylık özet, export kalitesi, hata senaryoları, UX cilası.

**User stories (Hardening)**
1. Kullanıcı olarak ay seçip sadece o aya ait fişleri görüp Excel’de o ayın özetini almak istiyorum.
2. Kullanıcı olarak mükerrer fişleri otomatik uyarı ile görüp tek tıkla işaretleyebilmek istiyorum.
3. Kullanıcı olarak hatalı fişlerde “Tekrar Dene” ile hızlıca yeniden işletebilmek istiyorum.
4. Kullanıcı olarak Excel’de hem satır toplamlarını hem de en altta SUM formüllerini hazır görmek istiyorum.
5. Kullanıcı olarak işlem bitince net bir özet (kaç tamam, kaç kontrol gerekli, kaç hata) görmek istiyorum.

**İşler**
- Excel export:
  - Kolonlar tam: Tarih, Firma, Vergi No, Fiş No, %1 Matrah/KDV, %10 Matrah/KDV, %20 Matrah/KDV, Toplam, Ödeme
  - Tarih hücreleri true date, en altta SUM formülleri
  - Ek sayfa: Aylık özet (ay → toplamlar, KDV kırılımı)
- UX edge-cases:
  - büyük dosya/hatalı format mesajları
  - network/Gemini hata mesajları + retry
  - session temizle butonu + TTL cleanup
- 2. tur E2E test + regresyon.

---

### Phase 4 — Polish (post-feedback)
**User stories (Polish)**
1. Kullanıcı olarak tabloyu Excel benzeri kısayollarla (enter/arrow) daha hızlı düzenlemek istiyorum.
2. Kullanıcı olarak “kontrol gerekli” filtreleyip sadece problemli fişlere odaklanmak istiyorum.
3. Kullanıcı olarak model adını değiştirdiğimde bunun güvenli şekilde kaydedildiğini bilmek istiyorum.
4. Kullanıcı olarak export öncesi son bir “özet/uyarı” ekranı görmek istiyorum.
5. Kullanıcı olarak uygulamayı düşük teknik bilgiyle hata yapmadan kullanmak istiyorum.

### Phase 5 — Diagnostics, Fallbacks, Thinking Steps & Custom Cleanups (Done)
- [x] **Teşhis (Diagnostics) Modülü:** Backend tarafında `/api/diagnostics` uç noktası oluşturuldu. API anahtarı varlığı, uzunluğu ve Gemini API doğrulaması yapılır.
- [x] **Hata/Teşhis Arayüzü:** Frontend açılışında API bağlantısı kontrol edilir, hata varsa tepeye kırmızı Alert banner, hata detayları ve anlık "Yeniden Kontrol Et" butonu basılır.
- [x] **Yedek Model (Model Fallback):** Fiş işleme esnasında model çökerse veya bulunamazsa sistem otomatik olarak `gemini-2.5-flash` ve ardından `gemini-2.5-flash-lite` modellerini yedek olarak dener.
- [x] **Yapay Zeka Düşünme Adımları:** Gemini modelinin fiş okurken geçirdiği düşünme/mantık adımları (thinking) ayıklanarak sağ detay panelinde açılır-kapanır akordeon içinde gösterilir.
- [x] **Görsel Destekli Chat Asistanı:** Asistanın görsel görememe sınırlaması kaldırıldı. Ekranda seçili olan fişin görseli asistanla otomatik paylaşılır, böylece asistan fiş üzerindeki detaylı soruları doğrudan yanıtlayabilir.
- [x] **KVKK Temizliği:** Arayüzdeki, footer'daki ve ayarlardaki tüm KVKK bilgilendirme metinleri kaldırıldı.
- [x] **Emergent Reklam Temizliği:** Sitenin HTML başlığı, meta etiketleri ve sağ alt köşedeki "Made with Emergent" badgeleri temizlendi.

### Phase 6 — Müşteri Yönetimi, Düzeltme Hafızası ve Excel Önizleme (Done)
- [x] **Çoklu Müşteri (Mükellef) Yönetimi:** `/api/clients` uç noktaları ve frontend dropdown + ekleme diyalogu ile muhasebecilerin mükellefleri ayrı ayrı yönetebilmesi sağlandı.
- [x] **Veri Kalıcılığı:** Fiş görselleri KVKK uyarınca diske kaydedilmezken, fişlerin tablo verileri (tarih, tutar, unvan) sunucudaki `db.json` veritabanında kalıcı olarak saklanır.
- [x] **Düzeltme Hafızası (Memory):** Kullanıcının yaptığı firma unvanı ve vergi dairesi düzeltmeleri Vergi No bazında `learning_memory.json` dosyasına yazılır. Yeni fiş okunduğunda bu hafızadan otomatik düzeltilir.
- [x] **Görsel/Hafıza Destekli Asistan:** Chat asistanının context yapısına aktif mükellefin adı ve öğrenilmiş olan vergi no mappings hafızası eklendi. Asistan artık hafızayı ve müşterileri biliyor.
- [x] **Canlı Excel Önizleme (Live Sheet Viewer):** Sitede "Tablo Önizle" butonu ile indirilecek Excel dosyasının Sayfa 1 (Fişler) ve Sayfa 2 (Aylık Özet) sekmelerini canlı simüle eden tablo görünümü eklendi.
- [x] **Excel İçe Aktarma (Import):** `.xlsx` uzantılı Excel tablosu yükleme butonu ve parsing servisi (`excelImport.js`) ile eski çalışmaların sisteme yüklenebilmesi sağlandı.
- [x] **Manuel Satır Ekleme:** Tabloya manuel boş satır ekleme özelliği eklendi.
- [x] **Auto-Save Pulse Animasyonu:** Hücre düzenlenip kaydedildiği an yeşil pulse efekti ile anlık görsel teyit sağlandı.

### Phase 7 — KVKK Kısıtının Kaldırılması ve Sağlamlaştırma (Done)
- [x] **KVKK kısıtı kaldırıldı (şirket içi kullanım):** Fiş görsellerinin küçültülmüş kopyaları artık `backend/store/images/<receiptId>.jpg` olarak diske kaydedilir (müşteri seçiliyken). Sunucu yeniden başlasa bile önizleme, retry ve asistan görseli diskten geri yüklenir.
- [x] **Görsel yaşam döngüsü:** Fiş/müşteri silindiğinde ilgili görsel dosyaları da diskten temizlenir.
- [x] **Atomik db.json yazımı:** `writeDb` artık tmp dosyasına yazıp rename eder; yarıda kesilen yazma db.json'u bozamaz.
- [x] **Güvenli bat dosyaları:** `baslat.bat` / `kapat.bat` artık tüm node.exe süreçlerini değil, sadece 8002 ve 5600 portlarını dinleyen süreçleri kapatır.
- [x] **Test varsayılanı düzeltildi:** `backend_test.py` varsayılan olarak `http://localhost:8002/api`'ye bakar (platformda `BACKEND_URL` ile override edilir).

> Not: Phase 1–6'daki KVKK maddeleri tarihsel kayıttır; Phase 7 itibarıyla "görsel diske yazılmaz" kuralı geçerli değildir.

### Phase 8 — Kimi (Moonshot AI) Ana Model Entegrasyonu (Done)
- [x] **Sağlayıcı yönlendirme:** Model adına göre otomatik yönlendirme (`kimi-*`/`moonshot-*` → Moonshot OpenAI-uyumlu API, diğerleri → Gemini). Yeni servis: `backend/src/services/kimi.js`.
- [x] **Ana model kimi-k2.5:** En ucuz Kimi vision modeli ($0.60/M girdi, $3.00/M çıktı) `.env` `AI_MODEL` ile varsayılan yapıldı. Fallback zinciri: kimi-k2.5 → gemini-2.5-flash → gemini-2.5-flash-lite.
- [x] **Maliyet optimizasyonu:** Kimi thinking modu varsayılan kapalı (7.6s vs 55.6s, ~3 kat ucuz çıktı); `KIMI_THINKING=1` ile açılabilir. kimi-k2.5 sadece temperature=1 kabul ettiğinden temperature gönderilmez.
- [x] **Chat + teşhis + anahtar testi:** Asistan, `/api/diagnostics` ve `npm run test:key` aktif modelin sağlayıcısına göre çalışır; teşhis yanıtına `provider` alanı eklendi.
- [x] **Canlı doğrulama:** Sahte Türk fişi görseliyle uçtan uca extraction test edildi; alanlar doğru okundu, şüpheli KDV kırılımında güven skoru düşürülüp "kontrol gerekli" işaretlendi.

### Phase 9 — Ağır İş Eskalasyonu ve Tam Ekran Tablo Görünümü (Done)
- [x] **Model eskalasyonu:** İlk (ucuz, düşünmesiz kimi-k2.5) okuma "kontrol gerekli" çıkarsa fiş otomatik olarak sırayla `kimi-k2.6` ve `kimi-k2.7-code` modelleriyle, **düşünme modu açık** tekrar okunur. Temiz sonuç veren ilk model kazanır; hiçbiri veremezse en yüksek güven skorlu sonuç kalır. Liste `.env` `ESCALATION_MODELS` ile değiştirilebilir. Her iki model ID canlı doğrulandı.
- [x] **Düşünme adımları:** Eskalasyon denemelerinin düşünme (reasoning) içeriği yakalanıp sağ paneldeki akordeonda gösterilir.
- [x] **Görünüm modu (Panel / Tablo):** Üst bara görünüm seçici eklendi. "Tablo" modu tam genişlik Excel (Jspreadsheet) görünümü açar: fiş yükleme, Excel içe aktarma, boş satır ekleme, ay filtresi, genel toplam ve işlem durumu tek araç çubuğunda; fiş fotoğrafı "Fişi Gör" ile sağdan kayan panelde (Sheet) açılır. Seçim localStorage'da hatırlanır.
- [x] **Teşhis banner'ı sağlayıcıya duyarlı:** Hata başlığı aktif sağlayıcıyı (Kimi/Gemini) gösterir.
- [x] **Düzenlenebilir sütun başlıkları:** Tablo başlıkları çift tıkla veya sağ tık → "Sütun Başlığını Değiştir" ile yeniden adlandırılabilir; localStorage'da saklanır ve Excel çıktısına da uygulanır. Excel içe aktarma başlık adı yerine kolon pozisyonuna göre çalışacak şekilde değiştirildi (yeniden adlandırılmış dosyalar da geri yüklenebilir).
- [x] **Düşünme modu ayarı (UI):** Ayarlar panelinde Otomatik / Hep Açık / Kapalı seçimi. Otomatik: ilk okuma hızlı, okunamayan fiş kendiliğinden üst modele geçer ve düşünme açılır. `PUT /api/settings` `thinkingMode` alanını kabul eder.
- [x] **Kritik alan kısayolu:** İlk okumada tarih, firma, toplam veya KDV kırılımı boş kalırsa kademeli eskalasyon atlanır, fiş DİREKT en güçlü modele (listenin sonuncusu, varsayılan kimi-k2.7-code) gönderilir.
- [x] **Sağlayıcılar arası otomatik yedekleme:** Fallback zincirine karşı sağlayıcı eklendi — Gemini hata verirse otomatik `kimi-k2.5`'e, Kimi çökerse Gemini'ye geçilir; işlem kesintisiz devam eder. Sağlayıcı değiştiğinde fişe `aiNote` düşülür, kullanıcıya toast ile bildirilir ve yan panelde gösterilir. Chat asistanı da Gemini çökerse bir kez Kimi ile dener.

## Phase 10 — Sohbet Ajanı, Güven Kolonu ve Daha Detaylı Fiş Okuma

- [x] **Sohbet artık bir AJAN:** Kimi function-calling ile asistan tabloyu doğrudan düzenleyebilir. Araçlar (`services/chatService.js` → `AGENT_TOOLS`): `fis_listele`, `fis_detay`, `fis_guncelle`, `fis_sil`, `fis_onayla`, `satir_ekle`. Ajan döngüsü (`runKimiAgentLoop`) en fazla 8 tur çalışır, her turda birden çok araç çağırabilir. Yapılan işlemler yanıtta `actions` olarak döner; frontend bunları yeşil rozetlerle gösterir, tabloyu `onDataChanged` ile tazeler ve toast atar. Silme geri alınamaz olduğu için ajana açık talimat olmadan silmemesi tembihlendi. (Salt metin Gemini yolu araçsızdır; ana model Kimi olduğundan ajan tam çalışır, Gemini'ye düşülürse yine Kimi ajanı devreye girer.)
- [x] **Ortak fiş işlemleri modülü:** `services/receiptOps.js` — düzenle/onayla/sil/manuel-ekle mantığı tek yerde toplandı; hem REST rotaları (`routes/api.js`) hem sohbet ajanı aynı doğrulama/öğrenme/kalıcı-kayıt yolunu kullanır.
- [x] **Güven skoru sütunu + görsel uyarı:** Tabloya salt-okunur "Güven (M)" sütunu eklendi (index 12; Durum 13'e, gizli ID 14'e kaydı — export hâlâ 0-11 kullandığından etkilenmez). `updateTable` ile skor <60 kırmızı, 60-79 amber, 80+ yeşil boyanır; Durum hücresi de kontrol/hata/işlemde durumlarına göre renklenir (App.css sınıfları).
- [x] **Daha detaylı fiş okuma promptu:** `RECEIPT_PROMPT` genişletildi — e-Arşiv/e-Fatura/e-SMM tanıma, para üstü ≠ toplam uyarısı, iskonto, vergi no (10/11 hane) vs Z/EKÜ no ayrımı, binlik ayracı, KDV kırılımını toplamdan geri hesaplama ve güven skorunu dürüst düşürme talimatları eklendi.

## Phase 11 — Admin Paneli, Ziyaretçi İstatistikleri, Güvenlik ve Optimizasyon

- [x] **Admin paneli (`#admin`):** Şifre korumalı yönetici paneli. Kayıt/üyelik YOK — kullanıcılar doğrudan girer. `AdminPanel.jsx` istatistik kartları (ziyaretçi, aktif, yükleme, fiş, Excel, sohbet) + ziyaretçi tablosu (cihaz/tarayıcı/OS, IP, saat dilimi/dil, kullanım sayaçları, ilk/son görülme) gösterir; 15 sn'de bir canlı tazelenir, ziyaretçi kaydı silinebilir.
- [x] **Ziyaretçi izleme:** `store/analyticsStore.js` — bellek-içi, 5 sn'de bir diske atomik yazan (`analytics.json`) sayaç deposu. Ziyaretçi kimliği frontend'in ürettiği kalıcı `x-visitor-id` (localStorage); sunucu IP + User-Agent (tarayıcı/OS/cihaz) ayrıştırır; frontend ekran/saat dilimi/dil/platform bilgisini `POST /api/visit` ile bir kez gönderir. Rotalar `recordEvent` ile yükleme/fiş/export/sohbet vb. sayar.
- [x] **Güvenlik açıkları kapatıldı:** Admin şifresi sabit-zamanlı karşılaştırma + IP başına 5/15dk brute-force limiti + süreli bellek token (8s). `index.js`: `trust proxy`, `x-powered-by` kapalı, opsiyonel `ALLOWED_ORIGINS` CORS beyaz listesi, güvenlik başlıkları (nosniff, X-Frame-Options DENY, no-referrer, permissions-policy). `.env`'e `ADMIN_PASSWORD` ve `ALLOWED_ORIGINS` eklendi.
- [x] **Performans optimizasyonu:** Tablo (`ResultsTable`) polling'de veri imzası değişmediyse grid'i yeniden kurmuyor — işlem sürerken her 1.5 sn'de tam yeniden çizim yerine seçim/kaydırma korunuyor. Analytics yazımları bellekte biriktirilip toplu (debounce) diske yazılıyor.
- [x] **Maliyet takibi (kaç dolar harcadık):** `services/costEstimator.js` — token kullanımından (Kimi/Gemini `_usage`) model bazlı fiyat tablosuyla tahmini USD hesaplar (`.env` `AI_PRICES` ile güncellenebilir). `queue.js` (ilk okuma + eskalasyon) ve `chatService.js` her AI çağrısından sonra `recordCost` çağırır; `analyticsStore` toplam `globalCost` + ziyaretçi başına `cost` tutar. Admin panelinde büyük "$ harcanan" bannerı + ziyaretçi başına maliyet sütunu. TAHMİNDİR; kesin bakiye sağlayıcı panelinde. Ölçüm: kimi-k2.5 ile fiş başına ~$0.00105 → 4$ bütçe ≈ ~3800 fiş.
- [x] **Kaliteyi bozmadan maliyet düşüren hamleler:** Fiş çıkarımında çıkış tokenı 2048 ile sınırlandı (kaçak/uzayan çıktı maliyeti önlenir, JSON küçük olduğu için kalite etkilenmez); ilk okuma en ucuz kimi-k2.5 + düşünme kapalı; güçlü modele yalnızca "kontrol gerekli" çıkınca eskalasyon; öğrenilmiş düzeltmeler AI çağrısı olmadan uygulanır.

## Phase 12 — NVIDIA Sağlayıcısı, Profesyonel Excel, Detaylı Admin ve Yayınlama Hazırlığı

- [x] **Üçüncü AI sağlayıcı — NVIDIA NIM (bedava):** `services/nvidia.js` (OpenAI uyumlu, `integrate.api.nvidia.com`, `NVIDIA_API_KEY`). Model yönlendirme: `nvidia:` ön eki veya `org/model` (içinde `/`) → NVIDIA. `gemini.js` dispatch + fallback zincirine eklendi (Kimi → NVIDIA → Gemini); `chatService.js` ajan döngüsü sağlayıcı-bağımsız hale getirildi (`runAgentLoop(...completionFn)`); `test_key.js` + `.env.example` + `NVIDIA_VISION_MODEL` ayarı. costEstimator'da bedava kota = $0 fiyatlandı.
- [x] **Profesyonel Excel (`xlsx`/SheetJS → ExcelJS):** `excelExport.js buildWorkbook` artık **async**, ExcelJS ile üretir: renkli+donuk başlık, autofilter, zebra satırlar, çerçeveler, para/tarih formatı, SUM'lı TOPLAM satırı. 3 sayfa: **Fişler**, **Aylık Özet** (beyanname KDV), **Firma Özeti** (firma bazlı toplamlar). `/export` rotası await'lendi.
- [x] **Detaylı admin paneli:** analytics'e model bazlı maliyet dökümü (`costByModel`), günlük zaman serisi (`daily`, 120 gün), fiş başına ort. maliyet + hata oranı eklendi (`errors` sayacı, `queue.js`). `AdminPanel.jsx`: inline-SVG günlük grafikler (fiş & maliyet), model bazlı maliyet çubukları, ziyaretçi arama + CSV export, banner'da ort./hata metrikleri.
- [x] **Toplu işlem & arama (tablo):** `ResultsTable.jsx` araç çubuğuna canlı arama/filtre + "kontrol gerekenleri toplu onayla" eklendi (toplu silme kaza riski için grid'de yok; sohbet ajanı komutla yapıyor).
- [x] **Netlify + Render yayınlama hazırlığı:** kök `netlify.toml` (frontend statik, SPA redirect, güvenlik başlıkları), `frontend/public/_redirects`, kök `render.yaml` (backend blueprint, health, gizli env'ler, opsiyonel kalıcı disk), `backend/Dockerfile` + `.dockerignore`, adım adım `DEPLOY.md`. Backend zaten `0.0.0.0`+`PORT`+CORS beyaz listesiyle uyumlu.
- [x] **Doğrulama:** NVIDIA/chat/cost import testi geçti; Excel üretimi geri okunarak doğrulandı (3 sayfa, formül, autofilter); analytics genişletmeleri in-process test edildi; frontend `CI=true` build **sıfır uyarı**; canlı backend smoke testi **13/13**.

## Phase 13 — Belge Türleri, Fiş-Değil Algısı, NVIDIA Model Seçimi ve Aktivite Logu

- [x] **Belge türü tanıma (dekont/fatura):** `RECEIPT_PROMPT` + Gemini şeması + `validation.js`'e `belge_turu` (yazarkasa_fisi/e_fatura/fatura/dekont/gider_pusulasi/diger) eklendi. Dekontta KDV olmaması normal sayılır (KDV eksik uyarısı verilmez, güven düşürülmez); dekont için tutar=işlem tutarı, firma=karşı taraf/açıklama talimatları eklendi.
- [x] **Fiş-değil algısı:** Mali belge olmayan görseller `firma_unvani="FIS_DEGIL"` → `validation.notReceipt` → `queue.js` durumu **`fis_degil`** yapar (eskalasyon atlanır, token boşa gitmez). Tabloda "Fiş Değil 🚫" gri etiket (`durum-fisdegil`), Excel'e dahil edilmez, `summarize`'da sayılır.
- [x] **Hızlı model seçiminde NVIDIA:** `GET /settings` anahtar varsa NVIDIA vision modelini önerilere ekler (SettingsSheet'te "bedava" rozeti); `PUT /settings` regex'i `/` ve `:` kabul eder (org/model, örn. z-ai/glm-5.2 kaydedilebilir).
- [x] **Admin aktivite logu:** `analyticsStore`'a sınırlı halka tampon (`logs`, max 300) — oturum/yükleme/export/sohbet/silme/hata/müşteri/import/manuel olayları cihaz bilgisiyle. `AdminPanel.jsx`'te zaman damgalı "Son Aktiviteler" akışı.
- [x] **Doğrulama:** validation testi (fiş-değil/dekont/normal) geçti; analytics log testi geçti; frontend `CI=true` build **sıfır uyarı**; canlı smoke testi (NVIDIA seçim + slash model kaydı + admin logs) **5/5**.

## 3) Next Actions (Immediate)
1. Supervisor + repo yapısını incele; backend’i Node/Express olarak ayağa kaldır (8001).
2. `.env` oluştur: `GEMINI_API_KEY` ve `GEMINI_MODEL` (örn. `gemini-2.0-flash`). `.env.example` + `.gitignore`.
3. POC scriptini yaz: convert/resize → gemini vision → JSON parse → validation.
4. 1-3 test fişi görseli edin (vision expert/örnek dataset) ve POC’u çalıştır.
5. POC stabilize olunca Phase 2’ye geç.

## 4) Success Criteria
- **POC:** En az 3 farklı fişte şemaya uygun JSON + deterministik parse + doğrulama flag’leri doğru.
- **V1:** 100 dosyaya kadar upload, concurrency=3 ile işler; UI’da durumlar görünür; inline edit çalışır; preview panel doğru resmi gösterir.
- **Export:** .xlsx doğru kolonlar + date hücresi + SUM formülleri + aylık özet sayfası.
- **KVKK:** İşleme sonrası disk üzerinde fiş görseli kalmaz; session temizlenince memory de boşalır.
- **UX:** Annemin kullanabileceği kadar net Türkçe metinler, hata mesajları, retry ve özet ekranı mevcut.
