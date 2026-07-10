// Fiş üzerindeki temel operasyonlar (düzenle / onayla / sil / manuel satır ekle)
// Hem API rotaları (routes/api.js) hem de sohbet ajanının araçları (chatService.js)
// aynı mantığı kullansın diye tek yerde toplandı.
import { randomUUID } from 'crypto';
import { validateAndNormalize, toNumber } from './validation.js';
import { learnCorrection } from './learningService.js';
import { detectDuplicates } from './queue.js';
import { saveReceipt, deleteReceiptFromDb, saveImageToDisk } from '../store/dbStore.js';

// Düz KDV formunu ({m1,k1,m10,k10,m20,k20}) kdv_detay dizisine çevirir
export function kdvFlatToDetay(kdv) {
  const kdvDetay = [];
  for (const [oran, mKey, kKey] of [[1, 'm1', 'k1'], [10, 'm10', 'k10'], [20, 'm20', 'k20']]) {
    const matrah = toNumber(kdv?.[mKey]) ?? 0;
    const kdvTutari = toNumber(kdv?.[kKey]) ?? 0;
    if (matrah !== 0 || kdvTutari !== 0) kdvDetay.push({ oran, matrah, kdv_tutari: kdvTutari });
  }
  return kdvDetay;
}

// İşlenmiş bir fişin alanlarını günceller, yeniden doğrular ve kalıcı kaydeder.
// body: { tarih?, firma_unvani?, vergi_dairesi?, vergi_no?, fis_no?, toplam?, odeme_turu?, kdv? }
export function applyReceiptEdit(session, receiptId, body = {}) {
  const receipt = session?.receipts.get(receiptId);
  if (!receipt) throw new Error('Fiş bulunamadı.');
  if (!receipt.data) throw new Error('Bu fiş henüz işlenmedi, düzenlenemez.');

  const merged = { ...receipt.data };
  for (const field of ['tarih', 'firma_unvani', 'vergi_dairesi', 'vergi_no', 'fis_no', 'toplam', 'odeme_turu', 'gider_kategorisi']) {
    if (body[field] !== undefined) merged[field] = body[field];
  }
  if (body.kdv !== undefined) {
    merged.kdv_detay = kdvFlatToDetay(body.kdv);
  }
  merged.guven_skoru = 100; // kullanıcı (veya kullanıcının talimatıyla asistan) kontrol etti

  // Elle düzenlemede güven skoru kuralı atlanır; matematik/tarih kuralları yine çalışır
  const { data, needsReview, reviewReasons } = validateAndNormalize(merged, { skipConfidence: true });
  receipt.data = data;
  receipt.reviewReasons = reviewReasons;
  receipt.edited = true;
  receipt.status = needsReview ? 'kontrol_gerekli' : 'tamam';
  if (!needsReview) receipt.approved = false;

  // Düzeltmeyi hafızaya öğret (vergi no varsa)
  if (data.vergi_no) learnCorrection(data.vergi_no, data);

  detectDuplicates(session);
  if (session.clientId) saveReceipt(session.clientId, receipt);
  return receipt;
}

// Fişi "kontrol ettim, doğru" olarak onaylar
export function approveReceipt(session, receiptId) {
  const receipt = session?.receipts.get(receiptId);
  if (!receipt) throw new Error('Fiş bulunamadı.');
  if (!receipt.data) throw new Error('Bu fiş henüz işlenmedi.');
  receipt.approved = true;
  receipt.status = 'tamam';
  receipt.reviewReasons = [];
  if (receipt.data.vergi_no) learnCorrection(receipt.data.vergi_no, receipt.data);
  if (session.clientId) saveReceipt(session.clientId, receipt);
  return receipt;
}

// Fişi oturumdan ve (müşteri seçiliyse) kalıcı kayıttan siler.
// Geri alınabilsin diye silinen fiş bellek içi "çöp kutusuna" alınır (kullanıcı yanlışlıkla silmiş olabilir).
export function removeReceipt(session, receiptId) {
  if (!session) throw new Error('Oturum bulunamadı.');
  const receipt = session.receipts.get(receiptId);
  if (!receipt) throw new Error('Fiş bulunamadı.');
  if (!session.trash) session.trash = [];
  session.trash.push(receipt); // görsel (previewJpeg) bellekte kaldığı için geri yüklenebilir
  if (session.trash.length > 20) session.trash.shift(); // sınırlı tut
  session.receipts.delete(receiptId);
  detectDuplicates(session);
  if (session.clientId) deleteReceiptFromDb(session.clientId, receiptId);
  return true;
}

// Silinen bir fişi çöp kutusundan geri yükler (yanlışlıkla silme için)
export function restoreReceipt(session, receiptId) {
  if (!session) throw new Error('Oturum bulunamadı.');
  const trash = session.trash || [];
  const idx = trash.findIndex((r) => r.id === receiptId);
  if (idx === -1) throw new Error('Geri yüklenecek fiş bulunamadı (çöp kutusunda değil).');
  const [receipt] = trash.splice(idx, 1);
  session.receipts.set(receipt.id, receipt);
  detectDuplicates(session);
  if (session.clientId) {
    saveReceipt(session.clientId, receipt);
    if (receipt.previewJpeg) saveImageToDisk(receipt.id, receipt.previewJpeg);
  }
  return receipt;
}

// Manuel (elle doldurulan) satır ekler; alanlar opsiyoneldir
export function addManualReceipt(session, fields = {}) {
  if (!session) throw new Error('Oturum bulunamadı.');
  const id = 'rcpt_manual_' + randomUUID().replace(/-/g, '').slice(0, 10);
  const receipt = {
    id,
    fileName: 'Manuel_Giris.xlsx',
    status: 'kontrol_gerekli',
    originalBuffer: null,
    previewJpeg: null,
    data: {
      tarih: fields.tarih || new Date().toISOString().slice(0, 10),
      firma_unvani: fields.firma_unvani || 'Manuel Firma Girişi',
      vergi_dairesi: fields.vergi_dairesi ?? null,
      vergi_no: fields.vergi_no ?? null,
      fis_no: fields.fis_no ?? null,
      toplam: toNumber(fields.toplam) ?? 0,
      kdv_detay: fields.kdv ? kdvFlatToDetay(fields.kdv) : [],
      odeme_turu: fields.odeme_turu || 'bilinmiyor',
      guven_skoru: 100,
    },
    reviewReasons: ['Manuel eklenen satır, kontrol edin'],
    error: null,
    edited: true,
    approved: false,
    isDuplicate: false,
    duplicateOf: null,
    order: session.nextOrder++,
  };
  session.receipts.set(id, receipt);
  if (session.clientId) saveReceipt(session.clientId, receipt);
  detectDuplicates(session);
  return receipt;
}
