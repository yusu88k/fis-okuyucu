// Admin kimlik doğrulama: şifre .env'deki ADMIN_PASSWORD ile sabit-zamanlı
// karşılaştırılır; başarılıysa bellekte tutulan, süreli (TTL) bir token verilir.
// Kayıt/üyelik yoktur — bu yalnızca admin paneline erişim kapısıdır.
import crypto from 'crypto';

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 saat
const tokens = new Map(); // token -> expiresAt

// Login brute-force koruması: IP başına 15 dk'da en fazla 5 başarısız deneme
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILS = 5;
const loginAttempts = new Map(); // ip -> { fails, resetAt }

function getAdminPassword() {
  // Varsayılan zayıf şifreye izin verilir ama uyarı basılır (şirket içi kolaylık)
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) {
    if (!getAdminPassword._warned) {
      console.warn('[admin] ADMIN_PASSWORD tanımlı değil! Varsayılan "admin123" kullanılıyor — .env dosyasına güçlü bir şifre ekleyin.');
      getAdminPassword._warned = true;
    }
    return 'admin123';
  }
  return pw;
}

// Sabit-zamanlı string karşılaştırma (timing attack koruması)
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    // Uzunluk farkında bile sabit-zaman için sahte bir karşılaştırma yap
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// IP'nin login deneme hakkı var mı?
function checkRateLimit(ip) {
  const now = Date.now();
  const rec = loginAttempts.get(ip);
  if (rec && now < rec.resetAt && rec.fails >= LOGIN_MAX_FAILS) {
    const kalan = Math.ceil((rec.resetAt - now) / 60000);
    return { allowed: false, kalan };
  }
  return { allowed: true };
}

function recordFail(ip) {
  const now = Date.now();
  const rec = loginAttempts.get(ip);
  if (!rec || now >= rec.resetAt) {
    loginAttempts.set(ip, { fails: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    rec.fails += 1;
  }
}

// Şifreyle giriş yap; başarılıysa token döndürür, değilse hata fırlatır
export function adminLogin(password, ip = 'unknown') {
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    const err = new Error(`Çok fazla hatalı deneme. ${rl.kalan} dakika sonra tekrar deneyin.`);
    err.status = 429;
    throw err;
  }
  if (!password || !safeEqual(password, getAdminPassword())) {
    recordFail(ip);
    const err = new Error('Şifre hatalı.');
    err.status = 401;
    throw err;
  }
  // Başarılı: bu IP'nin sayaçlarını sıfırla
  loginAttempts.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  tokens.set(token, Date.now() + TOKEN_TTL_MS);
  return { token, expiresIn: TOKEN_TTL_MS };
}

// Token geçerli mi?
export function verifyAdminToken(token) {
  if (!token) return false;
  const exp = tokens.get(token);
  if (!exp) return false;
  if (Date.now() > exp) {
    tokens.delete(token);
    return false;
  }
  return true;
}

export function adminLogout(token) {
  tokens.delete(token);
}

// Express middleware: Authorization: Bearer <token> başlığını doğrular
export function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!verifyAdminToken(token)) {
    return res.status(401).json({ error: 'Yetkisiz. Lütfen admin girişi yapın.' });
  }
  next();
}

// Süresi geçmiş token'ları periyodik temizle
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [t, exp] of tokens) if (now > exp) tokens.delete(t);
  for (const [ip, rec] of loginAttempts) if (now >= rec.resetAt) loginAttempts.delete(ip);
}, 10 * 60 * 1000);
cleanup.unref();
