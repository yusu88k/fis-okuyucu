# Fişten Excel'e

Anneniz / muhasebeci kullanıcılar için yapılmış, yapay zekâ destekli fiş fotoğrafı okuma ve Excel'e aktarma aracı.

## Ne işe yarar?

- Toplu fiş fotoğrafı yükleyin (JPG, PNG, HEIC, WEBP).
- Yapay zekâ fişlerdeki firmayı, tarihi, KDV kırılımını ve toplamı otomatik okur.
- Tabloda düzeltme yapın, mükerrer fişleri görün, kontrol gerekenleri işaretleyin.
- Tek tıkla Excel (.xlsx) indirin; içinde "Fişler" ve "Aylık Özet" sayfaları hazır.
- Yapay zekâ asistanına "Ağustos ayı fişlerini özetle" veya "mükerrerleri göster" gibi sorular sorun.

## Gereksinimler

- Node.js 18+
- Python 3.10+ (sadece platform supervisor / `server.py` için)
- Bir Kimi (Moonshot AI) API anahtarı — ana model (https://platform.moonshot.ai)
- (Opsiyonel) Bir Google Gemini API anahtarı — yedek modeller için

## Kurulum

### 1. Ortam değişkenlerini ayarlayın

```bash
# Backend
cp backend/.env.example backend/.env
# backend/.env içine KIMI_API_KEY değerini yapıştırın (ana model: kimi-k2.5)
# İsterseniz GEMINI_API_KEY de ekleyin; Kimi çökerse gemini-2.5-flash yedeğe geçer
# İsterseniz MAX_FILES=500 gibi yüksek hacimli işlem sayısını artırabilirsiniz

# Frontend
cp frontend/.env.example frontend/.env
```

### 2. Bağımlılıkları yükleyin

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3. Çalıştırın

Lokal geliştirme (iki ayrı terminal):

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm start
```

Frontend varsayılan olarak `http://localhost:5600` (frontend/.env içindeki `PORT` ile), backend `http://localhost:8002` adresinde çalışır.

Windows'ta pratik yol: `baslat.bat` çift tıkla (ikisini birden açar), `kapat.bat` ile kapat.

### Platform üzerinde çalıştırma

Platform supervisor `server.py` dosyasını kullanır. Bu durumda backend `8001` portu üzerinden erişilir.

## Proje yapısı

```
backend/
  src/
    index.js          # Express giriş noktası
    routes/api.js     # API rotaları
    services/         # Gemini, görsel işleme, doğrulama, kuyruk, Excel export, chat
    store/            # Bellek içi session yönetimi
  scripts/poc_receipt.js  # Uçtan uca pipeline testi
  server.py         # Platform yapıştırıcısı (Node'u 8001 arkasına alır)

frontend/
  src/
    App.js           # Ana uygulama
    components/      # UI bileşenleri
    lib/             # API istemcisi ve format yardımcıları
```

## Veri saklama

- Müşteri (mükellef) listesi ve fiş tablo verileri `backend/store/db.json` dosyasında kalıcı tutulur.
- Fiş görsellerinin küçültülmüş kopyaları `backend/store/images/` altında saklanır; sunucu yeniden başlasa bile önizlemeler kaybolmaz.
- Müşteri veya fiş silindiğinde ilgili görseller de diskten temizlenir.
- Kullanıcının yaptığı düzeltmeler `backend/store/learning_memory.json` içinde öğrenilir ve sonraki fişlere otomatik uygulanır.

## Test

```bash
# Backend API testleri (lokal, backend 8002'de çalışıyor olmalı)
python backend_test.py

# POC script (Gemini API anahtarı gerekli)
cd backend && npm run poc
```
