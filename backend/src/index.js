// Fiş -> Excel backend giriş noktası (Node.js + Express)
// Lokal çalıştırma: npm install && npm run dev
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import apiRouter from './routes/api.js';

const app = express();

// Gerçek istemci IP'sini almak için (x-forwarded-for) — reverse proxy arkasında doğru IP
app.set('trust proxy', true);
app.disable('x-powered-by'); // Express sürümünü sızdırma

// CORS: ALLOWED_ORIGINS tanımlıysa sadece o kökenlere izin ver, yoksa hepsine (şirket içi kolaylık)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
}));

// Temel güvenlik başlıkları (helmet olmadan, hafif)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

app.use(express.json({ limit: '5mb' }));

// Tüm rotalar /api öneki altında (Kubernetes ingress kuralı)
app.use('/api', apiRouter);

// Genel hata yakalayıcı (Türkçe, anlaşılır mesajlar)
app.use((err, req, res, next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'Dosya çok büyük (en fazla 20 MB olabilir).' });
  }
  if (err?.code === 'LIMIT_FILE_COUNT' || err?.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: `Tek seferde en fazla ${config.maxFiles} fiş yükleyebilirsiniz.` });
  }
  console.error('[hata]', err?.message || err, err?.stack || '');
  res.status(500).json({ error: err?.message || 'Sunucuda beklenmeyen bir hata oluştu.' });
});

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`[fis-excel] Express sunucusu ${config.port} portunda çalışıyor (model: ${config.model})`);
});

server.on('error', (err) => {
  console.error('[sunucu-hatası]', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${config.port} zaten kullanımda veya kapanma sürecinde. 2 saniye sonra tekrar denenecek...`);
    setTimeout(() => {
      try { server.close(); } catch (e) {}
      app.listen(config.port, '0.0.0.0');
    }, 2000);
  }
});

