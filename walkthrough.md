# Muhasebe Portalı Geliştirmeleri - Walkthrough

Bu belgede, tek oturumluk fiş okuyucuyu çoklu mükellef yönetimi yapabilen kalıcı bir muhasebe portalına dönüştüren güncellemelerin özeti yer almaktadır.

## Yapılan Değişiklikler

### 1. Kalıcı Çoklu Müşteri (Mükellef) Altyapısı
* **[dbStore.js](file:///c:/Users/User/Downloads/Muhasebeprogrma--main/Muhasebeprogrma--main/backend/src/store/dbStore.js) [NEW]:** Muhasebecinin müşterilerini ve bu müşterilere ait fiş tablolarını diske kalıcı olarak kaydeden (`backend/store/db.json`) dosya tabanlı hafif veri tabanı eklendi.
* **[TopBar.jsx](file:///c:/Users/User/Downloads/Muhasebeprogrma--main/Muhasebeprogrma--main/frontend/src/components/TopBar.jsx) [MODIFY]:** Logo ve unvanın hemen yanına müşteri seçmek için bir Select dropdown'ı ve yeni müşteri ekleme modalı (Dialog) yerleştirildi.
* **Müşteri Bazlı Oturum Yönetimi:** Müşteri seçildiğinde, o müşterinin geçmiş verileri otomatik olarak API'den çekilerek tabloya yüklenir. Yeni fişler eklendikçe veya düzenlendikçe sadece o müşterinin defterine kaydedilir.

### 2. Akıllı Düzeltme Hafızası ve Öğrenme (Learning Memory)
* **[learningService.js](file:///c:/Users/User/Downloads/Muhasebeprogrma--main/Muhasebeprogrma--main/backend/src/services/learningService.js) [NEW]:** Kullanıcının tabloda yaptığı firma unvanı ve vergi dairesi düzeltmelerini vergi numarası (Vergi No) bazında `backend/store/learning_memory.json` dosyasına kaydeder.
* **Otomatik Düzeltme Uygulama:** Yeni bir fiş yüklendiğinde, Gemini verileri çıkardıktan sonra eğer vergi numarası daha önce düzeltilmişse, firma unvanı ve vergi dairesi hafızadan otomatik olarak getirilerek düzeltilir.

### 3. Excel Dosyası Yükleme (Excel Import)
* **[excelImport.js](file:///c:/Users/User/Downloads/Muhasebeprogrma--main/Muhasebeprogrma--main/backend/src/services/excelImport.js) [NEW]:** Önceden dışa aktarılmış Excel dosyalarını (.xlsx) SheetJS ile okuyup veritabanı şemasına uygun fiş satırlarına dönüştüren import servisi.
* **[UploadZone.jsx](file:///c:/Users/User/Downloads/Muhasebeprogrma--main/Muhasebeprogrma--main/frontend/src/components/UploadZone.jsx) [MODIFY]:** Drag&drop alanının altına **"Excel Dosyası (.xlsx) Yükle"** butonu eklendi.

### 4. Yerleşik Excel Motoru (Jspreadsheet CE Entegrasyonu)
* **Canlı Excel Arayüzü:** Basit bir HTML tablosu yerine, tarayıcıda doğrudan çalışan **Jspreadsheet CE** entegre edildi.
* **Kolon Koordinatları & Seçim:** Üst sütun başlıkları Excel'deki gibi `A, B, C, D...`, satırlar ise `1, 2, 3...` olarak sıralanmıştır. Klasik Excel yeşili çerçeve (`emerald-600`) ile odaklanan hücre vurgulanır.
* **Excel Kısayolları ve İşlemler:**
  - **Ok Tuşlarıyla Gezinme:** Gazetecilik veya manuel tıklama yerine Yukarı, Aşağı, Sol, Sağ ok tuşlarıyla hücreler arası geçiş yapılabilir.
  - **Kopyala-Yapıştır (Copy/Paste):** Standart `Ctrl+C` ve `Ctrl+V` kısayolları ile Excel'den veya başka hücrelerden veri kopyalanıp yapıştırılabilir.
  - **Çift Tıklama / Düzenleme:** Hücreye çift tıklayarak veya `Enter` tuşuna basarak anında düzenlenebilir. Değişiklikler otomatik kaydedilir.
* **Sağ Tık Muhasebeci Menüsü:** Tablo üzerinde sağ tıklayarak "Seçili Fişi Sil" ve "Seçili Fişi Onayla" gibi muhasebeciye özel hızlı menü aksiyonları entegre edildi.
* **Manuel Boş Satır Girişi:** Boş satır ekleme desteği ile fiş fotoğrafı olmasa da doğrudan Excel tablosu gibi veri girişi yapılabilir.

### 5. Canlı Excel Önizleme (Live Spreadsheet Viewer)
* **Tablo Önizleme Modalı:** Üst bar üzerinde yer alan "Tablo Önizle" butonu ile çıktı alınacak Excel dosyasının Sayfa 1 (Fişler) ve Sayfa 2 (Aylık Özet) sayfaları tarayıcıda canlı simüle edilir.

### 6. Görsel/Hafıza Destekli Asistan ve Hata Kapatma
* **Asistan Hafıza Entegrasyonu:** Chat asistanının context yapısına aktif mükellefin adı ve öğrenilmiş olan vergi no mappings hafızası eklendi. Asistan artık hafızayı ve müşterileri biliyor.
* **Teşhis Alert Kapatma Desteği:** Gemini API bağlantı hatası alındığında (kota dolması vb.) hata panelinin kapatılması için bir buton eklenmiştir. Bu sayede kullanıcılar sistemi yerel bir akıllı Excel tablosu olarak kullanmaya devam edebilirler.

### 7. KDV Derivasyonu ve Dinamik Harcama Türü İyileştirmeleri
* **[excelImport.js](file:///c:/Users/User/Downloads/Muhasebeprogrma--main/Muhasebeprogrma--main/backend/src/services/excelImport.js) [MODIFY]:** KDV sütunu içermeyen ancak Matrah (KDV Hariç Tutar) ve Toplam (KDV Dahil Tutar) sütunları olan "METROER ALIŞ 2020-2026.xlsx" gibi Excel importlarında KDV = Toplam - Matrah hesabı yapılarak KDV oranının (%1/%10/%20) otomatik türetilmesi ve matrah kırılımlarının oluşturulması sağlandı.
* **Harcama Türü Gizleme ve Dinamik Dışa Aktarma:** Harcama Türü (Kategori) sütunu Excel ızgarasında gizlendiğinde, artık üretilen `.xlsx` dosyasında da (export) dinamik olarak sütun yapısı ayarlanıp tamamen dışarıda bırakılıyor ve hizalamalar buna göre güncelleniyor.

---

## Doğrulama ve Test Sonuçları
* **KDV Derivasyonu Doğrulaması:** "METROER ALIŞ 2020-2026.xlsx" dosyasında eskiden 0 satırda KDV kırılımı oluşurken, yeni güncellemeyle tüm veri satırlarında (örn. Temmuz 2020'de 11 satırda, Ağustos 2020'de 25 satırda) KDV oranının (%18 veya %20) ve KDV tutarının doğru hesaplandığı doğrulandı.
* **Harcama Türü Export Doğrulaması:** Harcama Türü (Kategori) kolonu arayüzde gizlendiğinde, backend tarafında `/export` rotasına iletilen `exclude_category=1` parametresiyle Excel'in kategori kolonu olmaksızın başarıyla üretildiği onaylandı.
* **Yükleme Doğrulaması:** Excel içe aktarımının satırları doğru kolonlarla doldurduğu ve KDV kırılımlarını otomatik matrah/kdv olarak parse ettiği test edildi.
* **Persist (Kalıcılık) Doğrulaması:** Sunucu kapatılıp açılsa dahi müşterilerin fiş verilerinin `db.json` üzerinden başarıyla korunduğu doğrulandı.
* **Öğrenme Doğrulaması:** Elle girilen unvan düzeltmelerinin `learning_memory.json` dosyasına yazıldığı ve sonraki aynı vergi nolu fiş okumalarında otomatik giydirildiği test edildi.
* **Derleme Durumu:** `craco build` komutu ile projenin tamamen sıfır uyarı ve sıfır hata ile derlendiği onaylandı.
