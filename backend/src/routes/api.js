// Tüm API rotaları (/api öneki index.js'te takılır)
import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'crypto';
import { config } from '../config.js';
import { createSession, getSession, deleteSession, serializeReceipt, summarize } from '../store/sessionStore.js';
import { enqueue, detectDuplicates } from '../services/queue.js';
import { applyReceiptEdit, approveReceipt, removeReceipt, addManualReceipt, restoreReceipt } from '../services/receiptOps.js';
import { buildWorkbook } from '../services/excelExport.js';
import { chatWithAssistant } from '../services/chatService.js';
import { testApiKey } from '../services/gemini.js';
import { isKimiModel } from '../services/kimi.js';
import { parseExcelWorkbook, parseExcelWithAI, listSheets, parseWorkbookAllSheets } from '../services/excelImport.js';
import { recordRequest, recordVisit, recordEvent, getOverview, deleteVisitor } from '../store/analyticsStore.js';
import { adminLogin, requireAdmin } from '../services/adminAuth.js';
import {
  getClients,
  addClient,
  deleteClient,
  getClientReceipts,
  saveReceipt,
  saveMultipleReceipts,
  readImageFromDisk,
  hasStoredImage
} from '../store/dbStore.js';

const router = Router();

// İsteği yapan ziyaretçiyi belirle (kayıt/üyelik yok; frontend'in ürettiği
// kalıcı x-visitor-id başlığı + IP + User-Agent ile izlenir)
function getVisitor(req) {
  const visitorId = String(req.headers['x-visitor-id'] || '').slice(0, 64) || null;
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || req.socket?.remoteAddress || null;
  const ua = req.headers['user-agent'] || null;
  return { visitorId, ip, ua };
}

// Ziyaretçi izleme middleware'i: health ve admin dışındaki her isteği kaydeder
router.use((req, res, next) => {
  if (req.path === '/health' || req.path.startsWith('/admin')) return next();
  const { visitorId, ip, ua } = getVisitor(req);
  if (visitorId) recordRequest(visitorId, { ip, ua });
  req._visitorId = visitorId;
  next();
});

// multer memoryStorage: yüklenen dosya önce bellekte işlenir,
// küçültülmüş kopyası pipeline sonunda store/images/ altına kaydedilir
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: config.maxFiles, fileSize: config.maxFileSizeBytes },
});

const ALLOWED_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;

// Kullanıcının seçebileceği bilinen vision modelleri (öneri listesi)
// kimi-* modeller Moonshot API'ye, gemini-* modeller Google'a gider
// ŞU AN KİMİ-ONLY: kullanıcıya sadece Kimi modelleri önerilir (Gemini/NVIDIA gizlendi).
const MODEL_SUGGESTIONS = [
  'kimi-k2.5',
  'kimi-k2.6',
  'kimi-k2.7-code',
];

// --- Sağlık ---
router.get('/health', (req, res) => {
  res.json({ status: 'ok', engine: 'node-express', model: config.model });
});

// --- Teşhis / Debug ---
router.get('/diagnostics', async (req, res) => {
  const model = config.model;
  const usesKimi = isKimiModel(model);
  const apiKey = usesKimi ? config.kimiApiKey : config.geminiApiKey;

  const result = {
    provider: usesKimi ? 'kimi' : 'gemini',
    apiKeyPresent: Boolean(apiKey),
    apiKeyLength: apiKey ? apiKey.length : 0,
    apiKeyValid: false,
    modelName: model,
    error: null,
  };

  if (!apiKey) {
    result.error = usesKimi
      ? 'KIMI_API_KEY .env dosyasında bulunamadı.'
      : 'GEMINI_API_KEY .env dosyasında bulunamadı.';
    return res.json(result);
  }

  try {
    await testApiKey(apiKey, model);
    result.apiKeyValid = true;
  } catch (err) {
    result.apiKeyValid = false;
    result.error = err.message || String(err);
  }

  res.json(result);
});

// --- Ayarlar (Gemini model adı, çalışma zamanında değiştirilebilir) ---
router.get('/settings', (req, res) => {
  res.json({
    model: config.model,
    defaultModel: process.env.AI_MODEL || process.env.GEMINI_MODEL || 'kimi-k2.5',
    // ŞU AN KİMİ-ONLY: NVIDIA hızlı seçime eklenmiyor (altyapı duruyor, GUI'de gizli).
    suggestions: MODEL_SUGGESTIONS,
    thinkingMode: config.thinkingMode,
    escalationModels: config.escalationModels,
  });
});

router.put('/settings', (req, res) => {
  const model = String(req.body?.model || '').trim();
  if (!model) return res.status(400).json({ error: 'Model adı boş olamaz.' });
  // NVIDIA modelleri "org/model" (örn. z-ai/glm-5.2) veya "nvidia:" biçiminde olabildiği için / ve : de kabul edilir
  if (!/^[a-z0-9.:/\-]+$/i.test(model)) return res.status(400).json({ error: 'Geçersiz model adı.' });
  config.setModel(model);
  // Düşünme modu (opsiyonel): auto / on / off
  const thinkingMode = req.body?.thinkingMode;
  if (thinkingMode !== undefined) {
    if (!['auto', 'on', 'off'].includes(thinkingMode)) {
      return res.status(400).json({ error: 'Geçersiz düşünme modu (auto/on/off olabilir).' });
    }
    config.setThinkingMode(thinkingMode);
  }
  res.json({ model: config.model, thinkingMode: config.thinkingMode });
});

// --- Müşteri (Client) Yönetimi ---
router.get('/clients', (req, res) => {
  res.json({ clients: getClients() });
});

router.post('/clients', (req, res) => {
  try {
    const client = addClient(req.body?.name);
    if (req._visitorId) recordEvent(req._visitorId, 'clients');
    res.json({ client });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/clients/:clientId', (req, res) => {
  try {
    deleteClient(req.params.clientId);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Session ---
router.post('/sessions', (req, res) => {
  const session = createSession();
  // Maliyet ve olay istatistiklerini bu ziyaretçiye bağlamak için sakla
  session.visitorId = req._visitorId || null;
  if (req._visitorId) recordEvent(req._visitorId, 'sessions');
  const clientId = req.body?.clientId || null;
  
  if (clientId) {
    session.clientId = clientId;
    // Kalıcı veri tabanından bu müşterinin daha önceki fişlerini oturuma doldur
    const dbReceipts = getClientReceipts(clientId);
    let maxOrder = 0;
    for (const r of dbReceipts) {
      session.receipts.set(r.id, {
        ...r,
        originalBuffer: null,
        previewJpeg: null,
      });
      if (r.order > maxOrder) maxOrder = r.order;
    }
    session.nextOrder = maxOrder + 1;
    detectDuplicates(session);
  }
  
  res.json({ sessionId: session.id });
});

router.get('/sessions/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Oturum bulunamadı. Sayfayı yenileyip tekrar deneyin.' });
  const receipts = [...session.receipts.values()].sort((a, b) => a.order - b.order).map(serializeReceipt);
  // Silinen fişler (çöp kutusu) — kullanıcı ayrı görüp geri yükleyebilsin (en son silinen üstte)
  const trash = (session.trash || []).map((r) => ({
    id: r.id,
    fileName: r.fileName,
    firma_unvani: r.data?.firma_unvani || null,
    tarih: r.data?.tarih || null,
    toplam: r.data?.toplam ?? null,
    belge_turu: r.data?.belge_turu || null,
  })).reverse();
  res.json({ sessionId: session.id, clientId: session.clientId || null, receipts, trash, summary: summarize(session) });
});

router.delete('/sessions/:id', (req, res) => {
  // Sadece bellekteki oturum temizlenir; kalıcı veriler (db.json + store/images/) korunur.
  deleteSession(req.params.id);
  res.json({ ok: true });
});

// --- Fiş yükleme (toplu, max 100) ---
router.post('/sessions/:id/receipts', upload.array('receipts', config.maxFiles), (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Oturum bulunamadı. Sayfayı yenileyip tekrar deneyin.' });

  const files = req.files || [];
  if (files.length === 0) return res.status(400).json({ error: 'Dosya alınamadı. Lütfen tekrar deneyin.' });
  if (session.receipts.size + files.length > config.maxFiles) {
    return res.status(400).json({ error: `Tek partide en fazla ${config.maxFiles} fiş işlenebilir. (Şu an ${session.receipts.size} fiş var)` });
  }

  if (req._visitorId) recordEvent(req._visitorId, 'uploads');
  const added = [];
  let rejected = 0;
  for (const file of files) {
    // Türkçe karakterli dosya adları için latin1 -> utf8 düzeltmesi
    const fileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    if (!ALLOWED_EXT.test(fileName)) { rejected++; continue; }
    const id = randomUUID();
    const receipt = {
      id,
      fileName,
      status: 'bekliyor',
      originalBuffer: file.buffer,
      previewJpeg: null,
      data: null,
      reviewReasons: [],
      error: null,
      edited: false,
      approved: false,
      isDuplicate: false,
      duplicateOf: null,
      order: session.nextOrder++,
    };
    session.receipts.set(id, receipt);
    added.push(serializeReceipt(receipt));

    // Müşteriye kalıcı kaydet
    if (session.clientId) {
      saveReceipt(session.clientId, receipt);
    }

    enqueue(session, id);
  }
  if (req._visitorId && added.length) recordEvent(req._visitorId, 'receipts', added.length);

  res.json({ added, rejected, summary: summarize(session) });
});

// --- Fiş görseli (yan panel önizlemesi; önce bellek, yoksa diskteki kalıcı kopya) ---
router.get('/sessions/:id/receipts/:rid/image', (req, res) => {
  const session = getSession(req.params.id);
  const receipt = session?.receipts.get(req.params.rid);
  if (!receipt) return res.status(404).json({ error: 'Görsel bulunamadı.' });
  if (!receipt.previewJpeg) {
    // Sunucu yeniden başlamışsa görseli diskten belleğe geri yükle
    receipt.previewJpeg = readImageFromDisk(receipt.id);
  }
  if (!receipt.previewJpeg) return res.status(404).json({ error: 'Görsel bulunamadı.' });
  res.set('Content-Type', 'image/jpeg');
  res.set('Cache-Control', 'private, max-age=600');
  res.send(receipt.previewJpeg);
});

// --- Tekrar dene (hatalı fiş veya yeniden okuma) ---
router.post('/sessions/:id/receipts/:rid/retry', (req, res) => {
  const session = getSession(req.params.id);
  const receipt = session?.receipts.get(req.params.rid);
  if (!receipt) return res.status(404).json({ error: 'Fiş bulunamadı.' });
  if (receipt.status === 'isleniyor' || receipt.status === 'bekliyor') {
    return res.status(409).json({ error: 'Bu fiş zaten işleniyor.' });
  }
  if (!receipt.previewJpeg && !receipt.originalBuffer && !hasStoredImage(receipt.id)) {
    return res.status(400).json({ error: 'Fiş görseli bulunamadı. Lütfen dosyayı yeniden yükleyin.' });
  }
  enqueue(session, receipt.id);
  res.json({ receipt: serializeReceipt(receipt), summary: summarize(session) });
});

// --- Inline düzenleme (ortak mantık: services/receiptOps.js) ---
router.patch('/sessions/:id/receipts/:rid', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Oturum bulunamadı.' });
  try {
    const receipt = applyReceiptEdit(session, req.params.rid, req.body || {});
    if (req._visitorId) recordEvent(req._visitorId, 'edits');
    res.json({ receipt: serializeReceipt(receipt), summary: summarize(session) });
  } catch (err) {
    const notFound = /bulunamadı/i.test(err.message);
    res.status(notFound ? 404 : 400).json({ error: err.message });
  }
});

// --- Fişi onayla (kontrol ettim, doğru) ---
router.post('/sessions/:id/receipts/:rid/approve', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Oturum bulunamadı.' });
  try {
    const receipt = approveReceipt(session, req.params.rid);
    res.json({ receipt: serializeReceipt(receipt), summary: summarize(session) });
  } catch (err) {
    const notFound = /bulunamadı/i.test(err.message);
    res.status(notFound ? 404 : 400).json({ error: err.message });
  }
});

// --- Fişi listeden sil ---
router.delete('/sessions/:id/receipts/:rid', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Oturum bulunamadı.' });
  try {
    removeReceipt(session, req.params.rid);
    if (req._visitorId) recordEvent(req._visitorId, 'deletes');
  } catch {
    // Fiş zaten yoksa silme idempotent davranır (tabloda takılı satır kalmasın)
  }
  res.json({ ok: true, summary: summarize(session) });
});

// --- Silinen fişi geri yükle (yanlışlıkla silme için) ---
router.post('/sessions/:id/receipts/:rid/restore', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Oturum bulunamadı.' });
  try {
    const receipt = restoreReceipt(session, req.params.rid);
    res.json({ ok: true, receipt: serializeReceipt(receipt), summary: summarize(session) });
  } catch (err) {
    res.status(404).json({ error: err.message || 'Fiş geri yüklenemedi.' });
  }
});

// --- Excel Dosyası Yükleme (Import) ---
// Yüklenen Excel'in sekmelerini listele (çok sekmeli dosyada kullanıcı hangisini aktaracağını seçsin)
router.post('/sessions/:id/import/sheets', upload.single('excel'), (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Oturum bulunamadı. Sayfayı yenileyip tekrar deneyin.' });
  if (!req.file) return res.status(400).json({ error: 'Excel dosyası yüklenemedi.' });
  try {
    const { sheets, suggested } = listSheets(req.file.buffer);
    res.json({ sheets, suggested });
  } catch (err) {
    res.status(500).json({ error: `Excel okunamadı: ${err.message}` });
  }
});

router.post('/sessions/:id/import', upload.single('excel'), async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Oturum bulunamadı. Sayfayı yenileyip tekrar deneyin.' });
  if (!req.file) return res.status(400).json({ error: 'Excel dosyası yüklenemedi.' });

  // Kullanıcı belirli bir sekme seçtiyse onu kullan (yoksa aktif/en büyük sekme)
  const forceSheet = req.body?.sheet ? String(req.body.sheet) : null;

  try {
    let imported;
    let aiUsed = false;
    const goodRows = (arr) => arr.filter((r) => r.data && r.data.toplam > 0).length;

    if (forceSheet === '__ALL__') {
      // Kullanıcı "Tümü"nü seçti → tüm veri sekmelerini birleştir (her sekme kendi kalite kapısından geçer)
      imported = await parseWorkbookAllSheets(req.file.buffer);
      aiUsed = true;
    } else {
      imported = parseExcelWorkbook(req.file.buffer, forceSheet);
      // Deterministik parse SADECE uygulamanın kendi export düzenini doğru okur.
      // Yabancı bir Excel'de sütunlar kayar → çoğu satırda Toplam boş kalır (çöp içe aktarma).
      // Kaliteyi ölç: hiç satır yoksa VEYA satırların yarısından azında geçerli Toplam varsa
      // yapay zekâ importer'ına düş (sütunları değerlerden anlayıp okur).
      const detGood = goodRows(imported);
      const detRatio = imported.length ? detGood / imported.length : 0;
      if (imported.length === 0 || detRatio < 0.5) {
        const ai = await parseExcelWithAI(req.file.buffer, forceSheet);
        // AI daha çok "toplamı dolu" satır çıkardıysa onu kullan
        if (ai.length > 0 && goodRows(ai) > detGood) {
          imported = ai;
          aiUsed = true;
        }
      }
    }
    if (imported.length === 0) {
      return res.status(400).json({ error: 'Excel dosyasında işlenebilecek satır bulunamadı.' });
    }

    // Sıralamayı (order) session sırasına uydur
    for (const r of imported) {
      r.order = session.nextOrder++;
      session.receipts.set(r.id, r);
    }

    // Müşteriye kalıcı kaydet
    if (session.clientId) {
      saveMultipleReceipts(session.clientId, imported);
    }

    detectDuplicates(session);
    if (req._visitorId) recordEvent(req._visitorId, 'imports');

    res.json({
      added: imported.map(serializeReceipt),
      aiUsed,
      summary: summarize(session)
    });
  } catch (err) {
    res.status(500).json({ error: `Excel içe aktarılamadı: ${err.message}` });
  }
});

// --- Boş Satır Ekle (Manuel Giriş) ---
router.post('/sessions/:id/receipts/manual', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Oturum bulunamadı.' });
  const receipt = addManualReceipt(session, req.body || {});
  if (req._visitorId) recordEvent(req._visitorId, 'manualRows');
  res.json({ receipt: serializeReceipt(receipt), summary: summarize(session) });
});

// --- Yapay zekâ asistanı (mevcut oturumdaki fişler hakkında soru-cevap) ---
router.post('/sessions/:id/chat', async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Oturum bulunamadı. Sayfayı yenileyip tekrar deneyin.' });

  const message = String(req.body?.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Mesaj boş olamaz.' });

  const history = Array.isArray(req.body?.history) ? req.body.history : [];
  const selectedReceiptId = req.body?.selectedReceiptId || null;

  try {
    if (req._visitorId) recordEvent(req._visitorId, 'chats');
    const { reply, actions } = await chatWithAssistant(session, message, history, selectedReceiptId, req._visitorId);
    // Ajan tabloda değişiklik yaptıysa (actions dolu) frontend listeyi yeniler
    res.json({ reply, actions: actions || [], changed: (actions || []).length > 0, summary: summarize(session) });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Asistan yanıt veremedi.' });
  }
});

// --- Excel export (ay filtresi opsiyonel: ?month=YYYY-MM) ---
router.get('/sessions/:id/export', async (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Oturum bulunamadı.' });
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month || '')) ? req.query.month : null;
  // Kullanıcının UI'da yeniden adlandırdığı sütun başlıkları (opsiyonel, JSON: {kolonIndex: başlık})
  let customHeaders = null;
  try {
    const parsed = JSON.parse(String(req.query.headers || ''));
    if (parsed && typeof parsed === 'object') customHeaders = parsed;
  } catch {
    // başlık paramı yok veya bozuk -> varsayılan başlıklar kullanılır
  }
  const excludeCategory = req.query.exclude_category === '1';
  const receipts = [...session.receipts.values()].sort((a, b) => a.order - b.order);
  let buffer;
  try {
    buffer = await buildWorkbook(receipts, month, customHeaders, excludeCategory);
  } catch (err) {
    console.error('[export] Excel oluşturulamadı:', err?.message || err);
    return res.status(500).json({ error: 'Excel dosyası oluşturulamadı.' });
  }
  if (req._visitorId) recordEvent(req._visitorId, 'exports');
  const fileName = `fisler_${month || 'tumu'}.xlsx`;
  res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.set('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(buffer);
});

// --- Ziyaretçi cihaz bilgisi (frontend sayfa açılışında bir kez gönderir) ---
router.post('/visit', (req, res) => {
  const { visitorId } = getVisitor(req);
  if (!visitorId) return res.status(400).json({ error: 'Ziyaretçi kimliği yok.' });
  const b = req.body || {};
  recordVisit(visitorId, {
    screen: b.screen,
    timezone: b.timezone,
    language: b.language,
    platform: b.platform,
  });
  res.json({ ok: true });
});

// --- Admin: giriş (şifre) ---
router.post('/admin/login', (req, res) => {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'unknown';
  try {
    const { token, expiresIn } = adminLogin(req.body?.password, ip);
    res.json({ token, expiresIn });
  } catch (err) {
    res.status(err.status || 401).json({ error: err.message });
  }
});

// --- Admin: genel bakış (ziyaretçiler + kullanım istatistikleri) ---
router.get('/admin/overview', requireAdmin, (req, res) => {
  res.json(getOverview());
});

// --- Admin: ziyaretçi kaydını sil ---
router.delete('/admin/visitors/:vid', requireAdmin, (req, res) => {
  const ok = deleteVisitor(req.params.vid);
  res.json({ ok });
});

export default router;
