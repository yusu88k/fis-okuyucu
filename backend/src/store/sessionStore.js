// Session bazlı in-memory çalışma alanı (hızlı erişim için).
// Kalıcı kopyalar dbStore'dadır: tablo verisi db.json'da, görseller store/images/ altında.
// Session TTL: 6 saat erişilmezse otomatik silinir.
import { randomUUID } from 'crypto';
import { hasStoredImage } from './dbStore.js';

const sessions = new Map();
const SESSION_TTL_MS = 6 * 60 * 60 * 1000; // 6 saat

export function createSession() {
  const id = randomUUID();
  const session = {
    id,
    createdAt: Date.now(),
    lastAccess: Date.now(),
    nextOrder: 0,
    receipts: new Map(), // receiptId -> receipt
  };
  sessions.set(id, session);
  return session;
}

export function getSession(id) {
  const session = sessions.get(id);
  if (session) session.lastAccess = Date.now();
  return session || null;
}

export function deleteSession(id) {
  // Map silinince buffer'lar GC ile bellekten temizlenir
  return sessions.delete(id);
}

// API yanıtları için fişi buffer'lar olmadan serileştir
export function serializeReceipt(r) {
  return {
    id: r.id,
    fileName: r.fileName,
    status: r.status,
    data: r.data,
    reviewReasons: r.reviewReasons,
    error: r.error,
    edited: r.edited,
    approved: r.approved,
    isDuplicate: r.isDuplicate,
    duplicateOf: r.duplicateOf,
    hasImage: Boolean(r.previewJpeg) || hasStoredImage(r.id),
    aiNote: r.aiNote || null,
    order: r.order,
  };
}

// Durum özeti (üst bar ve işlem sonu mesajı için)
export function summarize(session) {
  const counts = {
    toplamDosya: session.receipts.size,
    bekliyor: 0,
    isleniyor: 0,
    tamam: 0,
    kontrolGerekli: 0,
    hata: 0,
    fisDegil: 0,
    mukerrer: 0,
  };
  for (const r of session.receipts.values()) {
    if (r.status === 'bekliyor') counts.bekliyor++;
    else if (r.status === 'isleniyor') counts.isleniyor++;
    else if (r.status === 'tamam') counts.tamam++;
    else if (r.status === 'kontrol_gerekli') counts.kontrolGerekli++;
    else if (r.status === 'hata') counts.hata++;
    else if (r.status === 'fis_degil') counts.fisDegil++;
    if (r.isDuplicate) counts.mukerrer++;
  }
  return counts;
}

// Bellek koruması: eski session'ları periyodik olarak temizle
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastAccess > SESSION_TTL_MS) sessions.delete(id);
  }
}, 10 * 60 * 1000);
cleanupTimer.unref();
