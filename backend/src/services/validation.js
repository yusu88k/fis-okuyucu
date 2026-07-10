// Doğrulama katmanı: LLM çıktısına güvenme, kod tarafında kontrol et
// Kurallar:
//  - matrah + kdv_tutari toplamları ≈ toplam (±0.05 TL tolerans)
//  - tarih gelecekte mi / 10 yıldan eski mi / geçersiz mi
//  - toplam <= 0 mı
//  - guven_skoru < 80 mi
// Herhangi biri tutmuyorsa fiş "kontrol gerekli" (needsReview) olarak işaretlenir.

const TOLERANCE = 0.05; // ±0.05 TL
// Eski fişlerde %8 ve %18 KDV olabilir; bunları ait oldukları sütuna yönlendiriyoruz
const VALID_RATES = [1, 8, 10, 18, 20];
const RATE_BUCKETS = { 1: 1, 8: 10, 10: 10, 18: 20, 20: 20 };

// "248,15" / "*248,15" / 248.15 gibi değerleri number'a çevirir
export function toNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value === null || value === undefined || value === '') return null;
  const cleaned = String(value).replace(/[^0-9.,-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

// Kuruş hassasiyetine yuvarla
export function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Tarihi YYYY-MM-DD formatına normalize et (GG.AA.YYYY, GG/AA/YYYY desteklenir)
function normalizeDate(value) {
  if (!value) return null;
  const str = String(value).trim();
  // Zaten ISO formatındaysa
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // GG.AA.YYYY veya GG/AA/YYYY
  m = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

// Ödeme türünü normalize et
function normalizePayment(value) {
  const str = String(value || '').toLowerCase().replace(/[İi̇]/g, 'i');
  if (str.includes('nakit')) return 'nakit';
  // Dekontlar için: EFT / havale / transfer
  if (str.includes('havale') || str.includes('eft') || str.includes('transfer')) return 'havale';
  if (str.includes('kredi') || str.includes('kart')) return 'kredi_karti';
  return 'bilinmiyor';
}

// Ham LLM çıktısını (veya kullanıcı düzenlemesini) normalize eder ve doğrular.
// options.skipConfidence: kullanıcı elle düzenlediğinde güven skoru kuralı atlanır.
// Dönen değer: { data, needsReview, reviewReasons }
export function validateAndNormalize(raw, options = {}) {
  const { skipConfidence = false, skipKdvCheck = false } = options;
  const reasons = [];

  const tarih = normalizeDate(raw?.tarih);
  const toplam = toNumber(raw?.toplam);
  const guvenSkoru = toNumber(raw?.guven_skoru) ?? 0;

  // KDV detayını normalize et (%8/%18 gibi eski oranları da kabul et)
  const kdvDetay = Array.isArray(raw?.kdv_detay)
    ? raw.kdv_detay
        .map((item) => {
          const rawOran = Number(item?.oran);
          const oran = VALID_RATES.includes(rawOran) ? rawOran : null;
          return {
            oran,
            matrah: round2(toNumber(item?.matrah) ?? 0),
            kdv_tutari: round2(toNumber(item?.kdv_tutari) ?? 0),
          };
        })
        .filter((item) => item.oran !== null && (item.matrah !== 0 || item.kdv_tutari !== 0))
    : [];

  // Belge türü (yazarkasa_fisi/e_fatura/fatura/dekont/gider_pusulasi/diger)
  const VALID_DOC_TYPES = ['yazarkasa_fisi', 'e_fatura', 'fatura', 'dekont', 'gider_pusulasi', 'diger'];
  const belgeTuru = VALID_DOC_TYPES.includes(raw?.belge_turu) ? raw.belge_turu : null;
  const isDekont = belgeTuru === 'dekont';

  // Gider kategorisi (harcamanın türü/sektörü — muhasebe gider hesabı için)
  const VALID_CATEGORIES = ['gida_market', 'akaryakit', 'yemek_restoran', 'kirtasiye_ofis', 'saglik_eczane', 'konaklama', 'ulasim', 'iletisim', 'teknoloji_demirbas', 'giyim', 'insaat_yapi', 'temizlik_sarf', 'hizmet', 'arac', 'diger'];
  const giderKategorisi = VALID_CATEGORIES.includes(raw?.gider_kategorisi) ? raw.gider_kategorisi : null;

  // Tevkifat (KDV tevkifatı/stopaj) tutarı — varsa sakla, yoksa null
  const tevkifatNum = toNumber(raw?.tevkifat);
  const tevkifat = tevkifatNum && tevkifatNum > 0 ? round2(tevkifatNum) : null;

  const data = {
    belge_turu: belgeTuru,
    gider_kategorisi: giderKategorisi,
    tevkifat,
    tarih,
    firma_unvani: raw?.firma_unvani ? String(raw.firma_unvani).trim() : null,
    vergi_dairesi: raw?.vergi_dairesi ? String(raw.vergi_dairesi).trim() : null,
    vergi_no: raw?.vergi_no ? String(raw.vergi_no).trim() : null,
    fis_no: raw?.fis_no ? String(raw.fis_no).trim() : null,
    toplam: toplam !== null ? round2(toplam) : null,
    kdv_detay: kdvDetay,
    odeme_turu: normalizePayment(raw?.odeme_turu),
    guven_skoru: Math.max(0, Math.min(100, Math.round(guvenSkoru))),
    _thinking: raw?._thinking || null,
  };

  // --- Kural 1: Fiş/mali belge değilse işaretle (elle düzenlemede atlanır) ---
  // notReceipt: queue.js bunu 'fis_degil' durumuna çevirir (tabloyu kirletmeden ayrı gösterilir).
  const notReceipt = !skipConfidence && (data.firma_unvani === 'FIS_DEGIL' || (data.guven_skoru === 0 && (data.toplam === null || data.toplam === 0)));
  if (notReceipt) {
    reasons.push('Bu görsel bir fiş/fatura/dekont değil');
  }

  // --- Kural 2: Toplam kontrolü ---
  if (data.toplam === null || data.toplam <= 0) {
    reasons.push('Toplam tutar okunamadı veya geçersiz (0 ya da negatif)');
  }

  // --- Kural 3: KDV matematiği (matrah + kdv toplamları ≈ toplam, ±0.05 TL) ---
  if (data.toplam !== null && data.toplam > 0 && kdvDetay.length > 0) {
    const calculated = round2(
      kdvDetay.reduce((sum, item) => sum + item.matrah + item.kdv_tutari, 0)
    );
    if (Math.abs(calculated - data.toplam) > TOLERANCE) {
      reasons.push(
        `KDV kırılımı toplamla uyuşmuyor (hesaplanan: ${calculated.toFixed(2)} TL, fişteki: ${data.toplam.toFixed(2)} TL)`
      );
    }
  } else if (kdvDetay.length === 0 && !isDekont && belgeTuru !== 'diger' && !skipKdvCheck) {
    // Dekont/gider-ödeme listesi ve içe aktarmalarda KDV kırılımı olmaması normaldir;
    // sadece gerçek fiş/fatura türlerinde (KDV beklenen) uyar.
    reasons.push('KDV kırılımı okunamadı');
  }

  // --- Kural 4: Tarih kontrolü ---
  if (!tarih) {
    reasons.push('Tarih okunamadı');
  } else {
    const date = new Date(tarih + 'T00:00:00');
    const now = new Date();
    const tenYearsAgo = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
    if (Number.isNaN(date.getTime())) {
      reasons.push('Tarih geçersiz formatta');
    } else if (date > now) {
      reasons.push('Tarih gelecekte görünüyor');
    } else if (date < tenYearsAgo) {
      reasons.push('Tarih 10 yıldan eski');
    }
  }

  // --- Kural 5: Güven skoru (elle düzenlemede atlanır) ---
  if (!skipConfidence && data.guven_skoru < 80) {
    reasons.push(`Yapay zekâ güven skoru düşük (${data.guven_skoru}/100)`);
  }

  return {
    data,
    needsReview: reasons.length > 0,
    reviewReasons: reasons,
    // queue.js: true ise durum 'fis_degil' olur (kontrol_gerekli yerine)
    notReceipt,
  };
}
