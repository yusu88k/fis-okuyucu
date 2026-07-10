# Yayınlama Rehberi (Netlify + Render)

Bu uygulama iki parçadan oluşur ve **iki ayrı yere** deploy edilir:

- **Frontend (React)** → **Netlify** (statik site)
- **Backend (Express)** → **Render** (sürekli çalışan sunucu)

> Neden ikiye ayrı? Netlify sadece statik dosya + kısa serverless fonksiyon barındırır.
> Backend'imiz sürekli çalışan bir sunucu (bellek içi kuyruk, disk, oturumlar) olduğu için
> Netlify'da çalışamaz. Render (veya Railway/Fly.io) bu iş için uygundur.

---

## 1) Backend → Render

1. Kodu bir GitHub reposuna gönderin.
2. [render.com](https://render.com) → **New +** → **Blueprint** → repoyu seçin.
   Repo kökündeki `render.yaml` otomatik okunur (backend `rootDir: backend`).
   - Alternatif: **New + → Web Service**, Root Directory = `backend`, Build = `npm install`, Start = `npm start`.
3. **Environment** sekmesinden gizli değişkenleri girin:
   | Anahtar | Değer |
   |---|---|
   | `KIMI_API_KEY` | Moonshot anahtarınız (`sk-...`) |
   | `GEMINI_API_KEY` | Google AI Studio anahtarı (yedek) |
   | `NVIDIA_API_KEY` | build.nvidia.com anahtarı (`nvapi-...`, bedava) |
   | `AI_MODEL` | `kimi-k2.5` |
   | `ADMIN_PASSWORD` | **güçlü bir şifre** |
   | `ALLOWED_ORIGINS` | Netlify adresiniz, örn. `https://siteniz.netlify.app` |
4. Deploy edin. Adresiniz şuna benzer olur: `https://fisten-excele-backend.onrender.com`
5. Test: tarayıcıda `https://.../api/health` → `{"status":"ok"...}` görmelisiniz.

**Ücretsiz plan notları:**
- İlk istek soğuk başlatma yüzünden ~50 sn sürebilir (uyku modundan uyanır).
- Kalıcı disk yok: **kaydedilen müşteriler + fiş görselleri yeniden dağıtımda sıfırlanır.**
  Kalıcılık için planı yükseltip `render.yaml`'daki `disk:` bloğunun yorumunu kaldırın.
- Docker isteyen platformlar için `backend/Dockerfile` hazır.

---

## 2) Frontend → Netlify

1. [netlify.com](https://netlify.com) → **Add new site** → **Import from Git** → repoyu seçin.
2. Ayarlar `netlify.toml`'dan otomatik gelir (base=`frontend`, publish=`build`).
3. **Site settings → Environment variables** → ekleyin:
   | Anahtar | Değer |
   |---|---|
   | `REACT_APP_BACKEND_URL` | Render backend adresiniz, örn. `https://fisten-excele-backend.onrender.com` |

   > ⚠️ Sonuna `/api` **eklemeyin** — kod otomatik ekler.
   > ⚠️ Bu değer build sırasında gömülür; değiştirirseniz **yeniden deploy** gerekir.
4. Deploy edin. Siteniz `https://siteniz.netlify.app` adresinde açılır.
5. Backend'de `ALLOWED_ORIGINS`'i bu Netlify adresine güncelleyip backend'i yeniden deploy edin.

---

## 3) Deploy sonrası kontrol listesi

- [ ] `https://.../api/health` çalışıyor (backend ayakta).
- [ ] Netlify sitesi açılıyor, fiş yükleyince backend'e istek gidiyor (Network sekmesi).
- [ ] CORS hatası yok (varsa `ALLOWED_ORIGINS` = Netlify adresi mi kontrol edin).
- [ ] Admin paneli: `https://siteniz.netlify.app/#admin` → `ADMIN_PASSWORD` ile giriş.
- [ ] `ADMIN_PASSWORD` güçlü mü? API anahtarları repoda **değil**, panelde gizli mi?

## Güvenlik hatırlatması
- `backend/.env` gizlidir, repoya **koymayın** (zaten `.gitignore`'da).
- Tüm anahtarları Render/Netlify panelinden gizli değişken olarak girin.
- `ADMIN_PASSWORD`'ü mutlaka değiştirin.
