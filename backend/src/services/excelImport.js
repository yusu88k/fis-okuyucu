// Excel dosyasını (.xlsx) parse edip tabloya yüklemek için servis (SheetJS)
import xlsxPkg from 'xlsx';
import { randomUUID } from 'crypto';
import pLimit from 'p-limit';
import { validateAndNormalize, toNumber } from './validation.js';
import { config } from '../config.js';
import { kimiChatCompletion } from './kimi.js';

const { read, utils } = xlsxPkg;

// Tarih hücresini YYYY-MM-DD stringine dönüştür
function parseDateCell(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  const str = String(val).trim();
  // Örn: "09.07.2026" veya "09/07/2026"
  const dM = str.match(/^(\d{1,2})[\.\/-](\d{1,2})[\.\/-](\d{4})$/);
  if (dM) {
    const day = dM[1].padStart(2, '0');
    const month = dM[2].padStart(2, '0');
    const year = dM[3];
    return `${year}-${month}-${day}`;
  }
  // Örn: "2026-07-09"
  const isoM = str.match(/^(\d{4})[\.\/-](\d{1,2})[\.\/-](\d{1,2})/);
  if (isoM) {
    const year = isoM[1];
    const month = isoM[2].padStart(2, '0');
    const day = isoM[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return null;
}

// Çalışma kitabında işlenecek "birincil" sayfayı seç.
// Muhasebeci dosyalarında çok sekme olur (yıllar/aylar); kullanıcının BAKTIĞI
// (aktif) sekmeyi almak isteriz. xlsx aktif sekmeyi Workbook.Views[0].activeTab'da
// saklar; yoksa en çok dolu satıra sahip sayfaya düşeriz (körlemesine ilk sayfa değil).
function pickSheetName(wb) {
  if (!wb.SheetNames || wb.SheetNames.length === 0) return null;
  const activeTab = wb.Workbook?.Views?.[0]?.activeTab;
  if (typeof activeTab === 'number' && wb.SheetNames[activeTab]) {
    return wb.SheetNames[activeTab];
  }
  // Yedek: en çok dolu satırı olan sayfa
  let best = wb.SheetNames[0];
  let bestRows = -1;
  for (const name of wb.SheetNames) {
    const aoa = utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
    const count = aoa.filter((r) => r.some((c) => String(c ?? '').trim() !== '')).length;
    if (count > bestRows) { bestRows = count; best = name; }
  }
  return best;
}

// Çalışma kitabındaki sayfaları (ad + dolu satır) listele — kullanıcıya sekme seçtirmek için
export function listSheets(buffer) {
  const wb = read(buffer, { type: 'buffer' });
  const activeTab = wb.Workbook?.Views?.[0]?.activeTab;
  const sheets = (wb.SheetNames || []).map((name, i) => {
    const aoa = utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
    const rows = aoa.filter((r) => r.some((c) => String(c ?? '').trim() !== '')).length;
    return { name, rows, active: i === activeTab };
  });
  let suggested = sheets.find((s) => s.active)?.name;
  if (!suggested) suggested = sheets.slice().sort((a, b) => b.rows - a.rows)[0]?.name || null;
  return { sheets, suggested };
}

// "Tümü": tüm veri sekmelerini (>=2 satır) içe aktar ve birleştir. Her sekme kendi kalite
// kapısından geçer (deterministik → gerekirse AI). Sekmeler paralel işlenir (p-limit 3).
export async function parseWorkbookAllSheets(buffer) {
  const wb = read(buffer, { type: 'buffer' });
  const names = (wb.SheetNames || []).filter((name) => {
    const aoa = utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
    return aoa.filter((r) => r.some((c) => String(c ?? '').trim() !== '')).length >= 2;
  });
  const goodRows = (arr) => arr.filter((r) => r.data && r.data.toplam > 0).length;
  const limit = pLimit(3);
  const perSheet = await Promise.all(names.map((name) => limit(async () => {
    let imported = parseExcelWorkbook(buffer, name);
    const detGood = goodRows(imported);
    const ratio = imported.length ? detGood / imported.length : 0;
    if (imported.length === 0 || ratio < 0.5) {
      const ai = await parseExcelWithAI(buffer, name);
      if (ai.length > 0 && goodRows(ai) > detGood) imported = ai;
    }
    return imported;
  })));
  return perSheet.flat();
}

// forceSheet: kullanıcının seçtiği sekme adı (verilmezse aktif/en büyük sekme)
export function parseExcelWorkbook(buffer, forceSheet = null) {
  const wb = read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = (forceSheet && wb.SheetNames.includes(forceSheet)) ? forceSheet : pickSheetName(wb);
  if (!sheetName) throw new Error('Excel dosyasında sayfa bulunamadı.');

  const ws = wb.Sheets[sheetName];
  // Kolonlar başlık adına değil POZİSYONA göre okunur; böylece kullanıcı
  // sütun başlıklarını yeniden adlandırmış olsa bile dosya içe aktarılabilir.
  // Kolon düzeni uygulamanın export düzeniyle aynıdır:
  // 0 Tarih, 1 Firma, 2 Vergi No, 3 Fiş No, 4-9 KDV (%1/%10/%20 matrah+kdv), 10 Toplam, 11 Ödeme
  const allRows = utils.sheet_to_json(ws, { header: 1, defval: null });

  const receipts = [];
  let order = 0;

  // NOT: slice(1) YAPMIYORUZ. Yeni export'ta 1. satır başlık bandı, 2. satır sütun başlıkları
  // olabildiği için satırın "veri" olup olmadığını içeriğinden anlıyoruz: geçerli bir tarih
  // VEYA gerçek bir toplam tutarı yoksa (başlık/başlık bandı/boş/özet satırı) atlanır.
  for (const row of allRows) {
    const [tarihCell, firmaCell, vergiCell, fisCell, m1c, k1c, m10c, k10c, m20c, k20c, toplamCell, odemeCell] = row;

    // Toplam/özet satırını atla
    if (String(tarihCell || '').toUpperCase().includes('TOPLAM') || String(firmaCell || '').toUpperCase().includes('TOPLAM')) {
      continue;
    }

    const tarih = parseDateCell(tarihCell);
    const toplamNum = toNumber(toplamCell);
    const hasToplam = toplamNum !== null && toplamNum > 0;
    // Geçerli tarih de gerçek toplam da yoksa bu bir veri satırı değildir (başlık bandı / sütun başlığı / boş)
    if (!tarih && !hasToplam) continue;

    const firmaUnvani = firmaCell;
    const vergiNo = vergiCell ? String(vergiCell).trim() : null;
    const fisNo = fisCell ? String(fisCell).trim() : null;
    const toplam = toplamNum !== null ? toplamNum : 0;

    // KDV detaylarını topla
    const kdvDetay = [];
    const m1 = Number(m1c) || 0;
    const k1 = Number(k1c) || 0;
    if (m1 > 0 || k1 > 0) kdvDetay.push({ oran: 1, matrah: m1, kdv_tutari: k1 });

    const m10 = Number(m10c) || 0;
    const k10 = Number(k10c) || 0;
    if (m10 > 0 || k10 > 0) kdvDetay.push({ oran: 10, matrah: m10, kdv_tutari: k10 });

    const m20 = Number(m20c) || 0;
    const k20 = Number(k20c) || 0;
    if (m20 > 0 || k20 > 0) kdvDetay.push({ oran: 20, matrah: m20, kdv_tutari: k20 });

    // Ödeme türü mapleme
    let odemeTuru = 'bilinmiyor';
    const rawOdeme = String(odemeCell || '').toLowerCase();
    if (rawOdeme.includes('kredi') || rawOdeme.includes('kart')) odemeTuru = 'kredi_karti';
    else if (rawOdeme.includes('nakit')) odemeTuru = 'nakit';
    else if (rawOdeme.includes('havale') || rawOdeme.includes('eft')) odemeTuru = 'havale';

    const rawData = {
      tarih,
      firma_unvani: firmaUnvani,
      vergi_no: vergiNo,
      fis_no: fisNo,
      toplam,
      kdv_detay: kdvDetay,
      odeme_turu: odemeTuru,
      guven_skoru: 100, // Excel'den elle gelenler tam güvenli kabul edilir
    };

    // Normalizasyon ve validation
    const { data: normalizedData, needsReview, reviewReasons } = validateAndNormalize(rawData, { skipConfidence: true, skipKdvCheck: true });

    receipts.push({
      id: 'rcpt_' + randomUUID().replace(/-/g, '').slice(0, 12),
      fileName: `${firmaUnvani || 'Excel_Satiri'}_Import.xlsx`,
      status: needsReview ? 'kontrol_gerekli' : 'tamam',
      data: normalizedData,
      reviewReasons: reviewReasons,
      error: null,
      edited: true,
      approved: !needsReview,
      isDuplicate: false,
      duplicateOf: null,
      order: order++,
    });
  }

  return receipts;
}

// --- AI destekli içe aktarma (yedek) ---
// Deterministik parse dosyanın düzenini tanıyamazsa (0 satır), CSV'yi Kimi'ye gönderip
// sütunları anlamasını ve fişleri JSON olarak çıkarmasını isteriz. Tanınmayan/farklı
// düzendeki Excel'ler için sağlam bir yedektir.
const AI_IMPORT_PROMPT = `Sana bir muhasebe Excel'inin CSV satırlarını veriyorum (ayraç ";"). Sütunların BAŞLIĞI OLMAYABİLİR ve düzen serbesttir; anlamı değerlerden çıkar. Tipik sütunlar: tarih, ödeme/belge tipi (DEKONT/NAKİT/KREDİ KARTI), firma/kişi unvanı, banka adı, tutar, döviz, hesap, açıklama. Her GERÇEK ödeme/fiş satırı için alanları çıkar. Başlık/başlık bandı, toplam/özet ve boş satırları ATLA.
SADECE saf bir JSON DİZİSİ döndür (markdown/backtick YOK, açıklama YOK):
[{"tarih":"YYYY-MM-DD","firma_unvani":"...","vergi_no":"string veya null","fis_no":"string veya null","toplam":0.0,"belge_turu":"dekont|yazarkasa_fisi|fatura|e_fatura|diger","odeme_turu":"nakit|kredi_karti|havale|bilinmiyor","kdv_detay":[{"oran":1,"matrah":0.0,"kdv_tutari":0.0}]}]
Kurallar:
- firma_unvani = ödeme yapılan firma/kişinin adı (banka adı veya "DEKONT/NAKİT" DEĞİL). Açıklama sütunu varsa firma adı için kullanma, unvan sütununu kullan.
- toplam = satırdaki asıl TL tutarı (ör. "790,68" -> 790.68; "1.234,56" -> 1234.56; "₺" ve boşlukları at). Döviz (EUR/USD) sütunu varsa onu değil TL tutarını al.
- belge_turu: satırda "DEKONT/HAVALE/EFT" geçiyorsa "dekont", "NAKİT/KREDİ KARTI/POS" geçiyorsa "yazarkasa_fisi", belli değilse "diger".
- odeme_turu: "NAKİT"->nakit, "KREDİ KARTI/KART/POS"->kredi_karti, "DEKONT/HAVALE/EFT"->havale, yoksa bilinmiyor.
- kdv_detay: dosyada KDV kırılımı yoksa boş dizi [] bırak (dekont/ödeme listelerinde KDV genelde yoktur).
- tarih GG.AA.YYYY -> YYYY-MM-DD; iki haneli yıl 20YY. oran sadece 1,10,20. okunamayan alan null. Örnek/başlık olarak verdiğim ilk satırlardan fiş ÜRETME, sadece gerçek veri satırlarını çıkar. Hiç satır yoksa [] döndür.`;

// Hücreyi görüntü metnine çevir (Date -> GG.AA.YYYY, diğerleri String)
function fmtCell(c) {
  if (c instanceof Date && !isNaN(c)) {
    const d = String(c.getDate()).padStart(2, '0');
    const m = String(c.getMonth() + 1).padStart(2, '0');
    return `${d}.${m}.${c.getFullYear()}`;
  }
  return c == null ? '' : String(c);
}

// Bir satır dizisini güvenli CSV satırına çevir
function toCsvLine(row) {
  return row.map((c) => {
    const s = fmtCell(c);
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(';');
}

// Ham AI/harita çıktısını (item dizisi) fiş nesnelerine çevir
function itemsToReceipts(rawItems) {
  const receipts = [];
  let order = 0;
  for (const item of rawItems) {
    const { data, needsReview, reviewReasons } = validateAndNormalize({ ...item, guven_skoru: 90 }, { skipConfidence: true, skipKdvCheck: true });
    if (!data.tarih && !(data.toplam > 0)) continue; // anlamsız satır
    receipts.push({
      id: 'rcpt_' + randomUUID().replace(/-/g, '').slice(0, 12),
      fileName: `${data.firma_unvani || 'AI_Import'}_AI.xlsx`,
      status: needsReview ? 'kontrol_gerekli' : 'tamam',
      data,
      reviewReasons,
      error: null,
      edited: true,
      approved: !needsReview,
      isDuplicate: false,
      duplicateOf: null,
      order: order++,
    });
  }
  return receipts;
}

// Ödeme/belge tipi sütunundaki metinden belge_turu + odeme_turu çıkar
function inferTypesFromTip(tip) {
  const t = String(tip || '').toLowerCase().replace(/[İi̇]/g, 'i');
  if (/dekont|havale|eft|transfer/.test(t)) return { belge_turu: 'dekont', odeme_turu: 'havale' };
  if (/nakit/.test(t)) return { belge_turu: 'yazarkasa_fisi', odeme_turu: 'nakit' };
  if (/kredi|kart|pos/.test(t)) return { belge_turu: 'yazarkasa_fisi', odeme_turu: 'kredi_karti' };
  return { belge_turu: 'diger', odeme_turu: 'bilinmiyor' };
}

// --- Yöntem 1: AI sadece SÜTUN HARİTASINI verir, satırları YEREL parse ederiz (çok hızlı) ---
const MAP_PROMPT = `Bir muhasebe Excel sekmesinin ilk satırlarını veriyorum (her hücre "idx=değer", idx 0-tabanlı sütun no). Tablodaki sütunların ANLAMINI bul.
SADECE şu JSON'u döndür (markdown/backtick YOK, açıklama YOK):
{"skip_rows":<veri başlamadan önceki başlık/band satır sayısı, 0 olabilir>,"cols":{"tarih":<idx|null>,"firma":<idx|null>,"matrah":<idx|null>,"kdv":<idx|null>,"tevkifat":<idx|null>,"toplam":<idx|null>,"tip":<idx|null>,"vergi_no":<idx|null>,"belge_no":<idx|null>}}
Kurallar:
- tarih: tarih sütunu. firma: ÖDEME YAPILAN firma/kişi UNVANI sütunu (banka adı DEĞİL, "DEKONT/NAKİT" tipi DEĞİL, açıklama sütunu DEĞİL).
- KDV sütunları (varsa): matrah = KDV HARİÇ tutar ("KDV siz tutar", "matrah", "net"). kdv = SADECE KDV tutarı sütunu ("KDV", "KDV tutarı"). toplam = KDV DAHİL genel toplam ("KDV tutar", "genel toplam", "ödenecek", "tutar").
- tevkifat: KDV tevkifatı / tevkif edilen KDV / stopaj tutarı sütunu ("TEVKİFAT", "TEVKİF", "STOPAJ"). Yoksa null.
- Ayırt et: üç para sütunu yan yanaysa genelde SOLDA matrah (büyük), ORTADA kdv (küçük), SAĞDA toplam (matrah+kdv'ye eşit, en büyük). Sadece TEK para sütunu varsa onu toplam yap, matrah/kdv null.
- toplam TL sütunudur (EUR/USD döviz sütunu DEĞİL). tip: "DEKONT/NAKİT/KREDİ KARTI/HAVALE" gibi ödeme/belge tipi sütunu (yoksa null). vergi_no/belge_no yoksa null.
- Emin olamadığın alanı null yap. Sadece JSON döndür.`;

async function aiColumnMap(sample) {
  let text;
  try {
    const res = await kimiChatCompletion(
      [{ role: 'user', content: `${MAP_PROMPT}\n\nSatırlar:\n${sample}` }],
      { model: 'kimi-k2.5', maxTokens: 512 }
    );
    text = res.text;
  } catch (err) {
    console.warn('[excel-ai] Sütun haritası alınamadı:', err?.message || err);
    return null;
  }
  try {
    let t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const s = t.indexOf('{');
    const e = t.lastIndexOf('}');
    if (s === -1 || e === -1) return null;
    return JSON.parse(t.slice(s, e + 1));
  } catch {
    return null;
  }
}

// Sütun haritasını kullanarak tüm satırları yerel olarak fiş item'larına çevir
function buildItemsFromMap(aoa, map) {
  const c = map?.cols || {};
  if (c.tarih == null && c.toplam == null) return []; // en azından biri lazım
  const skip = Number.isInteger(map?.skip_rows) && map.skip_rows > 0 ? map.skip_rows : 0;
  const cell = (row, idx) => (idx == null || idx < 0) ? '' : row[idx];
  const items = [];
  for (let i = skip; i < aoa.length; i++) {
    const row = aoa[i];
    const firma = String(cell(row, c.firma) ?? '').trim();
    const up = firma.toLocaleUpperCase('tr');
    // Özet/başlık satırları (TOPLAM, ay adları) ve satır-no/boş firma satırlarını ATLA.
    // Karışık muhasebe sekmelerinde altta pivot/özet blokları (ŞUBAT/MART toplamları),
    // "satır no" sütunu (firma yerine 1,2,3) ve kümülatif tutarlar olur — bunlar fiş değildir.
    if (!firma) continue;                              // firması boş = özet/boş satır
    if (/^\d+([.,]\d+)?$/.test(firma)) continue;       // firma sadece sayı = satır no/özet
    if (up === 'TOPLAM' || up === 'GENEL TOPLAM' || up.startsWith('TOPLAM')) continue;
    const AY_ADLARI = ['OCAK', 'ŞUBAT', 'SUBAT', 'MART', 'NİSAN', 'NISAN', 'MAYIS', 'HAZİRAN', 'HAZIRAN', 'TEMMUZ', 'AĞUSTOS', 'AGUSTOS', 'EYLÜL', 'EYLUL', 'EKİM', 'EKIM', 'KASIM', 'ARALIK'];
    if (AY_ADLARI.includes(up)) continue;              // ay adı = aylık özet satırı
    const toplam = toNumber(cell(row, c.toplam));
    if (!(toplam > 0)) continue;                       // gerçek bir tutar yoksa fiş değildir
    // Date objesi fmtCell ile GG.AA.YYYY'ye, oradan parseDateCell ile YYYY-MM-DD'ye (locale-güvenli)
    const tarih = parseDateCell(fmtCell(cell(row, c.tarih)));
    const { belge_turu, odeme_turu } = inferTypesFromTip(cell(row, c.tip));
    const vno = c.vergi_no != null ? String(cell(row, c.vergi_no) ?? '').trim() : '';
    const bno = c.belge_no != null ? String(cell(row, c.belge_no) ?? '').trim() : '';

    // KDV kırılımı: matrah + kdv veya matrah + toplam varsa oranı hesapla ve kdv_detay kur
    const kdv_detay = [];
    let matrah = c.matrah != null ? toNumber(cell(row, c.matrah)) : null;
    let kdv = c.kdv != null ? toNumber(cell(row, c.kdv)) : null;

    // Durum 1: Matrah ve Toplam var ama KDV sütunu yoksa, KDV = Toplam - Matrah
    if (matrah > 0 && toplam > matrah && !(kdv > 0)) {
      kdv = Math.round((toplam - matrah) * 100) / 100;
    }
    // Durum 2: Ayrı matrah sütunu yoksa ama KDV ve toplam varsa: matrah = toplam - KDV (geri hesap)
    else if (kdv > 0 && !(matrah > 0) && toplam > kdv) {
      matrah = Math.round((toplam - kdv) * 100) / 100;
    }

    if (matrah > 0 && kdv > 0) {
      const ham = Math.round((kdv / matrah) * 100);
      // En yakın geçerli orana yasla (%1/%8/%10/%18/%20; validation 8→10, 18→20 kovasına atar)
      const oran = [1, 8, 10, 18, 20].reduce((a, b) => (Math.abs(b - ham) < Math.abs(a - ham) ? b : a), 20);
      kdv_detay.push({ oran, matrah, kdv_tutari: kdv });
    }

    // Tevkifat (KDV tevkifatı/stopaj) sütunu varsa yakala
    const tevkifatVal = c.tevkifat != null ? toNumber(cell(row, c.tevkifat)) : null;

    items.push({
      tarih,
      firma_unvani: firma || null,
      vergi_no: vno || null,
      fis_no: bno || null,
      toplam: toplam ?? 0,
      belge_turu,
      odeme_turu,
      kdv_detay,
      tevkifat: tevkifatVal && tevkifatVal > 0 ? tevkifatVal : null,
    });
  }
  return items;
}

// Kimi'ye tek bir satır grubunu (CSV) gönderip fiş JSON dizisi çıkart
async function aiParseChunk(csv) {
  let text;
  try {
    const res = await kimiChatCompletion(
      [{ role: 'user', content: `${AI_IMPORT_PROMPT}\n\nSatırlar (CSV, ayraç ;):\n${csv}` }],
      { model: 'kimi-k2.5', maxTokens: 8192 }
    );
    text = res.text;
  } catch (err) {
    console.warn('[excel-ai] Kimi ile içe aktarma başarısız:', err?.message || err);
    return [];
  }
  try {
    let t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const s = t.indexOf('[');
    const e = t.lastIndexOf(']');
    if (s === -1 || e === -1) return [];
    const arr = JSON.parse(t.slice(s, e + 1));
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function parseExcelWithAI(buffer, forceSheet = null) {
  if (!config.kimiApiKey) return [];
  const wb = read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = (forceSheet && wb.SheetNames.includes(forceSheet)) ? forceSheet : pickSheetName(wb);
  if (!sheetName) return [];

  // Tarih hücreleri Date objesi olsun (cellDates); sayılar ham sayı, metin metin.
  // fmtCell Date'i GG.AA.YYYY'ye çevirir → parseDateCell güvenle okur (locale karışıklığı olmaz).
  const aoa = utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, cellDates: true, defval: '' })
    .filter((r) => r.some((cell) => String(fmtCell(cell)).trim() !== ''));
  if (aoa.length === 0) return [];

  // --- YÖNTEM 1 (HIZLI): AI'ye SADECE sütun haritasını sordur (1 çağrı), sonra
  //     tüm satırları YEREL parse et. 1000+ satırlı dosyalar saniyeler içinde biter. ---
  const sample = aoa.slice(0, 15)
    .map((r) => r.map((cell, ci) => `${ci}=${fmtCell(cell).replace(/\s+/g, ' ').slice(0, 40)}`).join(' | '))
    .join('\n');
  const map = await aiColumnMap(sample);
  const mapReceipts = itemsToReceipts(map ? buildItemsFromMap(aoa, map) : []);
  const mapGood = mapReceipts.filter((r) => r.data.toplam > 0).length;

  // Harita satırların çoğunda geçerli Toplam ürettiyse (>=%40) onu kullan — hızlı yol
  if (mapGood > 0 && mapGood >= aoa.length * 0.4) {
    return mapReceipts;
  }

  // --- YÖNTEM 2 (YEDEK): harita tutmadı -> satırları parça parça AI'ye okut (paralel, aynı anda 5) ---
  const CHUNK = 30;
  const CONCURRENCY = 5;
  const headerCtx = aoa.slice(0, 2).map(toCsvLine).join('\n');
  const chunkList = [];
  for (let i = 0; i < aoa.length; i += CHUNK) {
    chunkList.push({ first: i === 0, rows: aoa.slice(i, i + CHUNK) });
  }
  const limit = pLimit(CONCURRENCY);
  const parts = await Promise.all(
    chunkList.map(({ first, rows }) => limit(() => {
      const body = rows.map(toCsvLine).join('\n');
      return aiParseChunk(first ? body : `${headerCtx}\n${body}`);
    }))
  );
  const chunkReceipts = itemsToReceipts(parts.flat());
  const chunkGood = chunkReceipts.filter((r) => r.data.toplam > 0).length;

  // İki yöntemden "toplamı dolu satır" sayısı fazla olanı seç
  return chunkGood >= mapGood ? chunkReceipts : mapReceipts;
}
