# Fişten Excel'e - Kullanım Rehberi (Kanka Modu)

Selam hacı. Bu programı annen için yaptın, ben de sana anlatayım. Okuma zorunda değilsin ama takıldığında buraya bak.

## Nasıl Çalıştırılır?

1. `backend/.env` dosyasında çalışan bir **Kimi API anahtarı** olsun (`KIMI_API_KEY`).
   - Anahtar buradan alınır: https://platform.moonshot.ai (Console → API Keys)
   - Bakiye bitince aynı yerden yüklenir.
   - İstersen yedek olarak Gemini anahtarı da dursun (`GEMINI_API_KEY`, https://aistudio.google.com/app/apikey) — Kimi çökerse otomatik ona geçer.

2. `baslat.bat`'e çift tıkla.
   - Backend (8002) ve Frontend (5600) ayrı pencerelerde açılır.
   - Tarayıcıdan `http://localhost:5600` açılır.

3. Fiş fotoğraflarını sürükle-bırak veya tıklayıp seç.

4. Sistem fişleri okur, tabloya doldurur.

5. Kontrol gerekenler sarıyla yanar, düzelt.

6. **Excel'e Aktar** butonuna bas, dosyayı indir.

## Takıldın mı?

### "API anahtarı geçersiz" diyorsa

- Anahtarın çalışıp çalışmadığını test et:
  ```powershell
  cd backend
  npm run test:key
  ```
- Çalışmazsa yeni anahtar al.
- Çalışırsa ama uygulamada hata veriyorsa, `kapat.bat` ile kapatıp `baslat.bat` ile tekrar aç.
- Hâlâ eski hata görünüyorsa **Temizle** butonuna bas, fişi baştan yükle.

### Pencere açılıp kapanıyorsa

- `kapat.bat` çalıştır, hepsini öldür.
- Tekrar `baslat.bat` ile aç.
- Yine kapanıyorsa backend penceresindeki hatayı bana at.

### Çok fiş yükleyeceksen

- `backend/.env` içinde `MAX_FILES=500` falan yapabilirsin.
- Ama belleğine göre ayarla, 1000 fiş aynı anda patlatabilir.

## Yapay Zekâ Asistanı

- Sağ alttaki mavi buton. Tıkla, sor.
- "Ağustos fişlerini özetle", "mükerrerleri göster" gibi şeyler sorabilirsin.
- Fotoğrafları görmez, sadece sayıları bilir.

## Önemli Notlar

- Müşteri seçiliyken yüklenen fişlerin verileri **ve görselleri** artık diske kaydedilir; programı kapatıp açsan da durur.
- Müşteri seçmeden yüklersen veriler sadece o oturumda kalır, Excel'i indirmeyi unutma.
- Ana model `kimi-k2.5` (en ucuz Kimi vision modeli, ~0.002$/fiş). Kimi çalışmazsa otomatik `gemini-2.5-flash` → `gemini-2.5-flash-lite` yedeğine geçer.
- **Akıllı eskalasyon:** Fiş "kontrol gerekli" çıkarsa sistem otomatik olarak daha zeki modellerle (`kimi-k2.6`, sonra `kimi-k2.7-code`) düşünme modu açık şekilde tekrar dener. Düşünme adımları sağ panelde görünür. Yani zor fişlere fazla para, kolay fişlere az para gider.
- Düşünme modunu **Ayarlar** panelinden seçebilirsin: Otomatik (önerilen) / Hep Açık / Kapalı. Otomatikte program kendisi karar verir: fiş okunamazsa üst modele geçip düşünmeyi açar.
- Tablo sütun başlıklarını değiştirebilirsin: başlığa çift tıkla veya sağ tık → "Sütun Başlığını Değiştir". Yeni isimler indirilen Excel'e de yansır.
- Üst bardaki **Panel / Tablo** düğmeleriyle görünüm değişir: Tablo modu tam ekran Excel gibi; fiş yükleme, düzenleme, sohbet hepsi orada. "Fişi Gör" ile seçili fişin fotoğrafı sağdan açılır.

## Kısayollar

| Dosya | Ne işe yarar |
|-------|-------------|
| `baslat.bat` | Her şeyi açar |
| `kapat.bat` | Her şeyi kapatır |
| `kontrol.bat` | Çalışıp çalışmadığını kontrol eder |
| `test_key.bat` | API anahtarını test eder |

Bir daha takılırsan logu at, bakarız kanka.
