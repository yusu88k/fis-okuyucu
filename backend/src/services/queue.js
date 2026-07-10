// İşleme kuyruğu: p-limit ile aynı anda en fazla 3 fiş işlenir (rate limit koruması)
import pLimit from 'p-limit';
import { config } from '../config.js';
import { prepareImage } from './imageProcessor.js';
import { extractReceipt } from './gemini.js';
import { validateAndNormalize } from './validation.js';
import { applyLearnedCorrections } from './learningService.js';
import { saveImageToDisk, readImageFromDisk } from '../store/dbStore.js';
import { isKimiModel } from './kimi.js';
import { estimateCost } from './costEstimator.js';
import { recordCost, recordEvent } from '../store/analyticsStore.js';

// Bir AI çağrısının maliyetini (varsa token kullanımı) istatistiğe işler.
// estimateCost sonucu model adını da taşır; recordCost model bazlı dökümü buradan alır.
function trackCost(session, raw) {
  if (!raw?._usage) return;
  recordCost(session?.visitorId || null, estimateCost(raw._usedModel || config.model, raw._usage));
}

const limit = pLimit(config.concurrency);

// Gemini/GoogleGenAI SDK'dan HTTP durum kodunu çıkar
function getErrorCode(err) {
  return err?.status || err?.statusCode || err?.code || '';
}

// Teknik hataları anlaşılır Türkçe mesajlara çevir (foolproof UX)
// Gerçek hata kodunu (örn. 403) ve orijinal mesajı da korur
function toTurkishError(err) {
  const code = getErrorCode(err);
  const msg = String(err?.message || err);
  const prefix = code ? `[Hata ${code}] ` : '';

  if (/503|UNAVAILABLE|overloaded|high demand/i.test(msg)) return `${prefix}Yapay zekâ servisi şu an çok yoğun. Birkaç saniye bekleyip "Tekrar Dene"ye basın.`;
  if (/429|quota|rate|exhausted/i.test(msg)) return `${prefix}Yapay zekâ servisinin limiti aşıldı. Birkaç dakika bekleyip "Tekrar Dene"ye basın.`;
  if (/404|not.?found/i.test(msg)) return `${prefix}Seçili yapay zekâ modeli bulunamadı. Ayarlar bölümünden model adını kontrol edin.`;
  if (/401|403|api.?key|permission|unauthoriz/i.test(msg)) return `${prefix}API anahtarı geçersiz veya yetkisiz görünüyor.`;
  if (/fetch failed|network|ECONN|ETIMEDOUT|socket|EAI_AGAIN/i.test(msg)) return `${prefix}Bağlantı hatası oluştu. İnternet bağlantınızı kontrol edip "Tekrar Dene"ye basın.`;
  if (/JSON/i.test(msg)) return `${prefix}Yapay zekâ yanıtı çözümlenemedi. "Tekrar Dene"ye basın.`;
  if (/unsupported|corrupt|Input buffer|input file/i.test(msg)) return `${prefix}Görsel dosyası okunamadı (bozuk veya desteklenmeyen format).`;
  return `${prefix}Beklenmeyen bir hata oluştu: ${msg}`;
}

// Kritik alan kontrolü: tarih, firma, toplam veya KDV kırılımı boşsa
// ara modeli atlayıp DİREKT en güçlü modele gitmek için kullanılır.
function hasCriticalGaps(data) {
  if (!data) return true;
  return (
    !data.tarih ||
    !data.firma_unvani ||
    !(Number(data.toplam) > 0) ||
    (data.kdv_detay || []).length === 0
  );
}

// Fişi kuyruğa ekle
export function enqueue(session, receiptId) {
  const r = session.receipts.get(receiptId);
  if (!r) return;
  r.status = 'bekliyor';
  r.error = null;
  limit(() => processReceipt(session, receiptId)).catch((err) => {
    // processReceipt kendi içinde hata yakalar; burası son güvenlik ağı
    const receipt = session.receipts.get(receiptId);
    if (receipt) {
      receipt.status = 'hata';
      receipt.error = toTurkishError(err);
    }
  });
}

// Tek fişin tam pipeline'ı: hazırla -> Gemini -> doğrula
async function processReceipt(session, receiptId) {
  const r = session.receipts.get(receiptId);
  if (!r) return; // session bu arada temizlenmiş olabilir
  r.status = 'isleniyor';
  try {
    if (!r.previewJpeg && !r.originalBuffer) {
      // Sunucu yeniden başlamış olabilir; görsel diske kaydedildiyse oradan geri yükle
      r.previewJpeg = readImageFromDisk(r.id);
    }
    if (!r.previewJpeg) {
      // HEIC dönüşümü + resize (uzun kenar max 1568px)
      r.previewJpeg = await prepareImage(r.originalBuffer, r.fileName);
      // Orijinal büyük görseli bellekten at; küçültülmüş kopya hem bellekte
      // hem de kalıcı olarak diskte (store/images/) tutulur
      r.originalBuffer = null;
      if (session.clientId) saveImageToDisk(r.id, r.previewJpeg);
    }
    const intendedModel = config.model;
    let raw = await extractReceipt(r.previewJpeg);
    trackCost(session, raw); // ilk okumanın maliyeti
    // Sağlayıcı değiştiyse (örn. Gemini çöktü, Kimi devraldı) kullanıcıya not düş ama işleme devam et
    if (raw._usedModel && isKimiModel(raw._usedModel) !== isKimiModel(intendedModel)) {
      r.aiNote = `"${intendedModel}" yanıt vermedi; fiş otomatik olarak "${raw._usedModel}" ile okundu.`;
      console.warn(`[ai] Sağlayıcı değişti (${r.fileName}): ${intendedModel} -> ${raw._usedModel}`);
    } else {
      r.aiNote = null;
    }
    // Öğrenilmiş düzeltmeleri (vergi no ile) kontrol edip eşleşenleri otomatik uygula
    raw = applyLearnedCorrections(raw);
    let result = validateAndNormalize(raw);

    // Ağır iş eskalasyonu: ilk (ucuz/hızlı) okuma "kontrol gerekli" çıkarsa
    // daha güçlü modellerle, düşünme modu AÇIK olarak tekrar dene.
    // Temiz sonuç veren ilk model kazanır; hiçbiri veremezse en yüksek güven skorlu sonuç kalır.
    // NOT: Görsel zaten "fiş değil" ise eskalasyona gerek yok (para/token boşa gitmesin).
    if (result.needsReview && !result.notReceipt) {
      // Önemli bilgiler (tarih/firma/toplam/KDV) boş kaldıysa kademeli gitme,
      // direkt listenin sonundaki EN GÜÇLÜ modele atla.
      let ladder = config.escalationModels;
      if (hasCriticalGaps(result.data) && ladder.length > 1) {
        ladder = ladder.slice(-1);
        console.log(`[ai] Kritik alanlar boş (${r.fileName}), direkt en üst modele gidiliyor: ${ladder[0]}`);
      }
      for (const strongModel of ladder) {
        if (strongModel === config.model) continue;
        try {
          const escThinking = config.thinkingMode !== 'off';
          console.log(`[ai] Eskalasyon: ${r.fileName} -> ${strongModel} (düşünme ${escThinking ? 'açık' : 'kapalı'})`);
          let raw2 = await extractReceipt(r.previewJpeg, strongModel, { thinking: escThinking, noFallback: true });
          trackCost(session, raw2); // eskalasyon denemesinin maliyeti
          raw2 = applyLearnedCorrections(raw2);
          const result2 = validateAndNormalize(raw2);
          if (!result2.needsReview || result2.data.guven_skoru > result.data.guven_skoru) {
            result = result2;
          }
          if (!result.needsReview) break;
        } catch (err) {
          // Eskalasyon çökerse eldeki sonuçla devam et, sıradaki modeli dene
          console.warn(`[ai] Eskalasyon hatası (${strongModel}): ${err?.message || err}`);
        }
      }
    }

    // Kullanıcı işlem sırasında iptal ettiyse (fiş oturumdan çıkarıldı) sonucu yazma — boşa gitsin
    if (!session.receipts.has(receiptId)) return;

    const { data, needsReview, reviewReasons, notReceipt } = result;
    r.data = data;
    r.reviewReasons = reviewReasons;
    r.edited = false;
    r.approved = false;
    // Fiş/mali belge değilse ayrı durum: 'fis_degil' (kullanıcı görüp atabilir, tabloyu kirletmez)
    r.status = notReceipt ? 'fis_degil' : (needsReview ? 'kontrol_gerekli' : 'tamam');
  } catch (err) {
    r.status = 'hata';
    r.error = toTurkishError(err);
    // Hata istatistiği (admin panelinde hata oranı için)
    recordEvent(session?.visitorId || null, 'errors');
    console.error(`[fis-hata] ${r.fileName}:`, err?.message || err);
  }
  detectDuplicates(session);
}

// Mükerrer fiş tespiti: firma + tarih + toplam + fiş no aynıysa uyar
 export function detectDuplicates(session) {
  const seen = new Map();
  const ordered = [...session.receipts.values()].sort((a, b) => a.order - b.order);
  for (const r of ordered) {
    r.isDuplicate = false;
    r.duplicateOf = null;
    if (!r.data || !r.data.toplam) continue;
    const key = [
      (r.data.firma_unvani || '').toLowerCase().replace(/\s+/g, ' ').trim(),
      r.data.tarih || '',
      Number(r.data.toplam).toFixed(2),
      (r.data.fis_no || '').trim(),
    ].join('|');
    if (seen.has(key)) {
      r.isDuplicate = true;
      r.duplicateOf = seen.get(key).fileName;
    } else {
      seen.set(key, r);
    }
  }
}
