// Ziyaretçi ve kullanım istatistiği deposu (admin paneli için).
// Kayıt/üyelik YOKTUR: kullanıcı direkt girer; her ziyaretçi cihaz bilgisiyle
// sessizce izlenir. Performans için veriler bellekte tutulur, diske periyodik
// (dirty ise 5 sn'de bir) ve süreç kapanışında atomik olarak yazılır.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_DIR = path.join(__dirname, '..', '..', 'store');
const ANALYTICS_PATH = path.join(STORE_DIR, 'analytics.json');

// Sayaç alanları (her ziyaretçi + global). 'errors': işlenirken hata alan fiş sayısı.
const COUNTER_KEYS = ['requests', 'sessions', 'uploads', 'receipts', 'exports', 'chats', 'imports', 'manualRows', 'clients', 'deletes', 'edits', 'errors'];

// Günlük trend kovasında tutulan alanlar (admin panelindeki grafikler için)
const DAILY_KEYS = ['requests', 'uploads', 'receipts', 'chats', 'exports', 'errors'];

// Aktivite logunda gösterilecek olay türleri + Türkçe etiketleri (admin paneli "Son Aktiviteler")
const LOG_LABELS = {
  sessions: 'Yeni oturum başlattı',
  uploads: 'fiş yükledi',
  exports: 'Excel indirdi',
  chats: 'Asistanla sohbet etti',
  deletes: 'fiş sildi',
  errors: 'Fiş işlenirken hata oluştu',
  clients: 'Müşteri ekledi',
  imports: 'Excel içe aktardı',
  manualRows: 'Manuel satır ekledi',
};
const MAX_LOGS = 300;

// costByModel: model -> { usd, tokensIn, tokensOut, calls }
// daily: 'YYYY-MM-DD' -> { ...DAILY_KEYS, costUsd }
let state = { visitors: {}, globalCost: { usd: 0, tokensIn: 0, tokensOut: 0 }, costByModel: {}, daily: {}, logs: [] }; // visitorId -> kayıt
let dirty = false;

function emptyCounts() {
  const c = {};
  for (const k of COUNTER_KEYS) c[k] = 0;
  return c;
}

// Yerel tarih anahtarı (YYYY-MM-DD)
function todayKey() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Bugünün günlük kovasını getir/oluştur; eski kovaları (son 120 gün) buda
function dailyBucket() {
  const key = todayKey();
  if (!state.daily[key]) {
    const b = { costUsd: 0 };
    for (const k of DAILY_KEYS) b[k] = 0;
    state.daily[key] = b;
    // Sınırsız büyümeyi önle: 120 günden eski kovaları at
    const keys = Object.keys(state.daily).sort();
    if (keys.length > 120) {
      for (const old of keys.slice(0, keys.length - 120)) delete state.daily[old];
    }
  }
  return state.daily[key];
}

// Başlangıçta diskten yükle
function load() {
  try {
    if (fs.existsSync(ANALYTICS_PATH)) {
      const raw = JSON.parse(fs.readFileSync(ANALYTICS_PATH, 'utf8'));
      if (raw && typeof raw === 'object' && raw.visitors) {
        state = raw;
        if (!state.globalCost) state.globalCost = { usd: 0, tokensIn: 0, tokensOut: 0 };
        // Eski dosyalarda yeni alanlar olmayabilir -> geriye dönük uyumluluk
        if (!state.costByModel) state.costByModel = {};
        if (!state.daily) state.daily = {};
        if (!Array.isArray(state.logs)) state.logs = [];
      }
    }
  } catch (err) {
    console.error('[analytics] Yükleme hatası:', err.message);
  }
}

// Atomik yaz (tmp + rename)
function flush() {
  if (!dirty) return;
  try {
    if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true });
    const tmp = ANALYTICS_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state), 'utf8');
    fs.renameSync(tmp, ANALYTICS_PATH);
    dirty = false;
  } catch (err) {
    console.error('[analytics] Yazma hatası:', err.message);
  }
}

load();
const flushTimer = setInterval(flush, 5000);
flushTimer.unref();
// Süreç kapanırken son durumu kaydet
process.on('SIGINT', () => { flush(); process.exit(0); });
process.on('SIGTERM', () => { flush(); process.exit(0); });
process.on('beforeExit', flush);

// Basit User-Agent ayrıştırma (bağımlılık eklemeden; admin panelinde okunur olsun diye)
function parseUserAgent(ua = '') {
  const s = String(ua);
  let browser = 'Bilinmiyor';
  if (/edg/i.test(s)) browser = 'Edge';
  else if (/opr|opera/i.test(s)) browser = 'Opera';
  else if (/chrome|crios/i.test(s)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(s)) browser = 'Firefox';
  else if (/safari/i.test(s)) browser = 'Safari';

  let os = 'Bilinmiyor';
  if (/windows nt 10/i.test(s)) os = 'Windows 10/11';
  else if (/windows/i.test(s)) os = 'Windows';
  else if (/android/i.test(s)) os = 'Android';
  else if (/iphone|ipad|ios/i.test(s)) os = 'iOS';
  else if (/mac os x/i.test(s)) os = 'macOS';
  else if (/linux/i.test(s)) os = 'Linux';

  const device = /mobile|iphone|android/i.test(s) ? 'Mobil' : /ipad|tablet/i.test(s) ? 'Tablet' : 'Masaüstü';
  return { browser, os, device };
}

// Ziyaretçi kaydını getir/oluştur
function ensureVisitor(visitorId) {
  if (!state.visitors[visitorId]) {
    state.visitors[visitorId] = {
      id: visitorId,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      ip: null,
      ua: null,
      browser: null,
      os: null,
      device: null,
      screen: null,
      timezone: null,
      language: null,
      platform: null,
      counts: emptyCounts(),
    };
  }
  return state.visitors[visitorId];
}

// Her istekte çağrılır: son görülme, IP, UA ve istek sayacını günceller
export function recordRequest(visitorId, { ip, ua } = {}) {
  if (!visitorId) return;
  const v = ensureVisitor(visitorId);
  v.lastSeen = Date.now();
  if (ip) v.ip = ip;
  if (ua) {
    v.ua = ua;
    const parsed = parseUserAgent(ua);
    v.browser = parsed.browser;
    v.os = parsed.os;
    v.device = parsed.device;
  }
  v.counts.requests += 1;
  dailyBucket().requests += 1;
  dirty = true;
}

// Frontend'in gönderdiği zengin cihaz bilgisini (ekran, saat dilimi, dil) kaydeder
export function recordVisit(visitorId, info = {}) {
  if (!visitorId) return;
  const v = ensureVisitor(visitorId);
  if (info.screen) v.screen = String(info.screen).slice(0, 40);
  if (info.timezone) v.timezone = String(info.timezone).slice(0, 60);
  if (info.language) v.language = String(info.language).slice(0, 20);
  if (info.platform) v.platform = String(info.platform).slice(0, 40);
  v.lastSeen = Date.now();
  dirty = true;
}

// Sayaç bazlı (adet gösterilen) log türleri
const COUNT_BASED_LOGS = new Set(['uploads', 'deletes', 'manualRows']);

// Aktivite loguna kayıt ekle (sınırlı halka tampon; en yenisi sonda)
function pushLog(visitorId, type, n) {
  if (!LOG_LABELS[type]) return;
  const v = visitorId ? state.visitors[visitorId] : null;
  const text = COUNT_BASED_LOGS.has(type) ? `${n} ${LOG_LABELS[type]}` : LOG_LABELS[type];
  state.logs.push({
    ts: Date.now(),
    type,
    text,
    visitorId: visitorId || null,
    browser: v?.browser || null,
    os: v?.os || null,
    device: v?.device || null,
    ip: v?.ip || null,
  });
  // Halka tampon: en eskileri at
  if (state.logs.length > MAX_LOGS) state.logs.splice(0, state.logs.length - MAX_LOGS);
}

// Belirli bir olay sayacını artırır (uploads, exports, chats, ...)
// Günlük trend kovası her zaman güncellenir; ziyaretçi dökümü kimlik varsa işlenir.
export function recordEvent(visitorId, type, n = 1) {
  if (!COUNTER_KEYS.includes(type)) return;
  if (DAILY_KEYS.includes(type)) dailyBucket()[type] += n;
  if (visitorId) {
    const v = ensureVisitor(visitorId);
    v.counts[type] += n;
    v.lastSeen = Date.now();
  }
  pushLog(visitorId, type, n);
  dirty = true;
}

// Yapay zekâ maliyetini kaydet (tahmini USD + token). Toplam her zaman globalCost'a
// eklenir; ziyaretçi kimliği varsa o ziyaretçinin dökümüne de işlenir.
export function recordCost(visitorId, { usd = 0, tokensIn = 0, tokensOut = 0, model = 'bilinmiyor' } = {}) {
  if (!usd && !tokensIn && !tokensOut) return;
  state.globalCost.usd += usd;
  state.globalCost.tokensIn += tokensIn;
  state.globalCost.tokensOut += tokensOut;
  // Model bazlı döküm (hangi model ne kadar harcadı)
  const mk = String(model || 'bilinmiyor');
  if (!state.costByModel[mk]) state.costByModel[mk] = { usd: 0, tokensIn: 0, tokensOut: 0, calls: 0 };
  const cm = state.costByModel[mk];
  cm.usd += usd; cm.tokensIn += tokensIn; cm.tokensOut += tokensOut; cm.calls += 1;
  // Günlük maliyet trendi
  dailyBucket().costUsd += usd;
  if (visitorId) {
    const v = ensureVisitor(visitorId);
    if (!v.cost) v.cost = { usd: 0, tokensIn: 0, tokensOut: 0 };
    v.cost.usd += usd;
    v.cost.tokensIn += tokensIn;
    v.cost.tokensOut += tokensOut;
  }
  dirty = true;
}

// Admin paneli için genel özet + ziyaretçi listesi
export function getOverview() {
  const visitors = Object.values(state.visitors);
  const totals = emptyCounts();
  totals.visitors = visitors.length;
  for (const v of visitors) {
    for (const k of COUNTER_KEYS) totals[k] += v.counts[k] || 0;
  }
  // Aktif ziyaretçi: son 5 dakikada istek yapan
  const now = Date.now();
  totals.activeNow = visitors.filter((v) => now - v.lastSeen < 5 * 60 * 1000).length;
  // Tahmini maliyet (USD) ve token toplamı
  totals.costUsd = state.globalCost.usd;
  totals.tokensIn = state.globalCost.tokensIn;
  totals.tokensOut = state.globalCost.tokensOut;
  // Fiş başına ortalama maliyet (işlenen fiş sayısına göre)
  totals.avgCostPerReceipt = totals.receipts > 0 ? state.globalCost.usd / totals.receipts : 0;
  // Hata oranı (%) — işlenen fişlere göre
  totals.errorRate = totals.receipts > 0 ? (totals.errors / totals.receipts) * 100 : 0;

  // Model bazlı maliyet dökümü (çoktan aza)
  const costByModel = Object.entries(state.costByModel || {})
    .map(([model, c]) => ({ model, ...c }))
    .sort((a, b) => b.usd - a.usd || b.calls - a.calls);

  // Günlük trend (son 30 gün, tarihe göre artan)
  const daily = Object.entries(state.daily || {})
    .map(([date, b]) => ({ date, ...b }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);

  // Aktivite logu: en yeni önce, son 120 kayıt
  const logs = [...(state.logs || [])].slice(-120).reverse();

  // En son görülene göre sırala
  const sorted = [...visitors].sort((a, b) => b.lastSeen - a.lastSeen);
  return { totals, visitors: sorted, costByModel, daily, logs };
}

// Bir ziyaretçi kaydını sil (admin)
export function deleteVisitor(visitorId) {
  if (state.visitors[visitorId]) {
    delete state.visitors[visitorId];
    dirty = true;
    flush();
    return true;
  }
  return false;
}
