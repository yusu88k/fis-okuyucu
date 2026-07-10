// POC: Upload -> (HEIC/resize) -> Gemini Vision -> JSON parse -> Doğrulama pipeline'ını izole test eder.
// Sentetik Türk yazarkasa fişi görselleri üretir (SVG -> PNG), Gemini'ye yollar, sonucu ground truth ile karşılaştırır.
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { prepareImage, isHeic } from '../src/services/imageProcessor.js';
import { extractReceipt, parseReceiptJson } from '../src/services/gemini.js';
import { validateAndNormalize } from '../src/services/validation.js';
import { config } from '../src/config.js';

const TMP = '/tmp/poc_receipts';
fs.mkdirSync(TMP, { recursive: true });

// --- Sentetik fiş SVG üretici ---
function receiptSvg(lines) {
  const lineHeight = 34;
  const height = lines.length * lineHeight + 80;
  const textLines = lines
    .map((line, i) => `<text x="30" y="${60 + i * lineHeight}" font-family="DejaVu Sans Mono, monospace" font-size="22" fill="#1a1a1a">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`)
    .join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="${height}"><rect width="100%" height="100%" fill="#fdfdf8"/>${textLines}</svg>`;
}

// Ground truth ile birlikte 3 test fişi
const TEST_RECEIPTS = [
  {
    name: 'migros_karisik_kdv',
    truth: { tarih: '2025-09-15', toplam: 248.15, odeme: 'kredi_karti', firmaIcerir: 'MIGROS' },
    lines: [
      '        MIGROS TIC. A.S.',
      '   ATATURK MAH. 123. SK. NO:5',
      '       KADIKOY / ISTANBUL',
      ' KOZYATAGI V.D.  6220039119',
      '--------------------------------',
      'TARIH : 15.09.2025   SAAT: 14:32',
      'FIS NO: 0042',
      '--------------------------------',
      'EKMEK                       %1',
      '                        *12,58',
      'SUT 1L UHT                  %1',
      '                        *45,67',
      'CAM. DETERJANI 750ML       %20',
      '                       *189,90',
      '--------------------------------',
      'KDV %1   MATRAH:*57,67  KDV:*0,58',
      'KDV %20  MATRAH:*158,25 KDV:*31,65',
      'TOPKDV                  *32,23',
      'TOPLAM                 *248,15',
      '--------------------------------',
      'KREDI KARTI            *248,15',
      '     TESEKKUR EDERIZ',
    ],
  },
  {
    name: 'sok_nakit',
    truth: { tarih: '2025-08-03', toplam: 159.0, odeme: 'nakit', firmaIcerir: 'SOK' },
    lines: [
      '     SOK MARKETLER TIC. A.S.',
      '  CUMHURIYET MAH. 45. CAD. NO:12',
      '        CANKAYA / ANKARA',
      ' MALTEPE V.D.   7810045623',
      '--------------------------------',
      'TARIH : 03.08.2025   SAAT: 09:15',
      'FIS NO: 0117',
      '--------------------------------',
      'PIRINC 1KG                 %10',
      '                        *99,00',
      'COP POSETI                 %20',
      '                        *60,00',
      '--------------------------------',
      'KDV %10  MATRAH:*90,00  KDV:*9,00',
      'KDV %20  MATRAH:*50,00  KDV:*10,00',
      'TOPKDV                  *19,00',
      'TOPLAM                 *159,00',
      '--------------------------------',
      'NAKIT                  *200,00',
      'PARA USTU               *41,00',
    ],
  },
  {
    name: 'a101_tek_kdv',
    truth: { tarih: '2025-07-21', toplam: 300.0, odeme: 'kredi_karti', firmaIcerir: 'A101' },
    lines: [
      '   A101 YENI MAGAZACILIK A.S.',
      '  ISTIKLAL CAD. NO:88 BEYOGLU',
      '           ISTANBUL',
      ' BEYOGLU V.D.  0290312782',
      '--------------------------------',
      'TARIH : 21.07.2025   SAAT: 18:47',
      'FIS NO: 0233',
      '--------------------------------',
      'KABLOSUZ KULAKLIK          %20',
      '                       *300,00',
      '--------------------------------',
      'KDV %20 MATRAH:*250,00 KDV:*50,00',
      'TOPKDV                  *50,00',
      'TOPLAM                 *300,00',
      '--------------------------------',
      'KREDI KARTI            *300,00',
    ],
  },
];

let passCount = 0;
let failCount = 0;
function check(label, ok, detail = '') {
  if (ok) {
    passCount++;
    console.log(`  ✅ ${label}`);
  } else {
    failCount++;
    console.log(`  ❌ ${label} ${detail}`);
  }
}

// --- TEST 1: JSON fence temizleme (savunmacı parse) ---
function testFenceCleaning() {
  console.log('\n[TEST 1] JSON fence temizleme');
  const fenced = '```json\n{"toplam": 10.5}\n```';
  const withText = 'İşte sonuç:\n{"toplam": 20}\nUmarım yardımcı olur.';
  const plain = '{"toplam": 30}';
  check('fence temizleme', parseReceiptJson(fenced).toplam === 10.5);
  check('metin kırpma', parseReceiptJson(withText).toplam === 20);
  check('düz JSON', parseReceiptJson(plain).toplam === 30);
}

// --- TEST 2: Doğrulama kuralları (Gemini'siz, saf birim test) ---
function testValidationRules() {
  console.log('\n[TEST 2] Doğrulama kuralları');
  const good = {
    tarih: '2025-09-15', firma_unvani: 'X', toplam: 248.15,
    kdv_detay: [
      { oran: 1, matrah: 57.67, kdv_tutari: 0.58 },
      { oran: 20, matrah: 158.25, kdv_tutari: 31.65 },
    ],
    odeme_turu: 'kredi_karti', guven_skoru: 95,
  };
  const r1 = validateAndNormalize(good);
  check('geçerli fiş -> needsReview=false', r1.needsReview === false, JSON.stringify(r1.reviewReasons));

  const badSum = { ...good, toplam: 300 };
  check('KDV toplamı uyuşmazlığı yakalanıyor', validateAndNormalize(badSum).needsReview === true);

  const futureDate = { ...good, tarih: '2035-01-01' };
  check('gelecek tarih yakalanıyor', validateAndNormalize(futureDate).needsReview === true);

  const oldDate = { ...good, tarih: '2010-01-01' };
  check('10 yıldan eski tarih yakalanıyor', validateAndNormalize(oldDate).needsReview === true);

  const zeroTotal = { ...good, toplam: 0, kdv_detay: [] };
  check('toplam<=0 yakalanıyor', validateAndNormalize(zeroTotal).needsReview === true);

  const lowConfidence = { ...good, guven_skoru: 60 };
  check('düşük güven skoru yakalanıyor', validateAndNormalize(lowConfidence).needsReview === true);

  const turkishFormats = { ...good, tarih: '15.09.2025', toplam: '248,15' };
  const r2 = validateAndNormalize(turkishFormats);
  check('GG.AA.YYYY tarih normalize ediliyor', r2.data.tarih === '2025-09-15');
  check('virgüllü tutar normalize ediliyor', r2.data.toplam === 248.15);
}

// --- TEST 3: Görsel işleme (resize + HEIC tespiti) ---
async function testImageProcessing() {
  console.log('\n[TEST 3] Görsel işleme (sharp resize)');
  // 3000px genişliğinde büyük bir test görseli üret
  const bigImage = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 240, g: 240, b: 230 } } })
    .composite([{ input: Buffer.from(receiptSvg(['TEST FISI', 'TOPLAM *10,00'])), top: 100, left: 100 }])
    .png().toBuffer();
  const processed = await prepareImage(bigImage, 'big.png');
  const meta = await sharp(processed).metadata();
  check(`uzun kenar <= 1568 (çıkan: ${meta.width}x${meta.height})`, Math.max(meta.width, meta.height) <= 1568);
  check('çıktı JPEG formatında', meta.format === 'jpeg');
  check('HEIC tespiti (uzantı)', isHeic(Buffer.alloc(0), 'photo.HEIC') === true);
  check('PNG HEIC sanılmıyor', isHeic(bigImage, 'photo.png') === false);
}

// --- TEST 4: Uçtan uca Gemini pipeline (3 sentetik fiş) ---
async function testGeminiPipeline() {
  console.log(`\n[TEST 4] Gemini Vision uçtan uca (model: ${config.model})`);
  for (const receipt of TEST_RECEIPTS) {
    console.log(`\n  --- Fiş: ${receipt.name} ---`);
    const svg = receiptSvg(receipt.lines);
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    fs.writeFileSync(path.join(TMP, `${receipt.name}.png`), png);

    const jpeg = await prepareImage(png, `${receipt.name}.png`);
    const t0 = Date.now();
    const raw = await extractReceipt(jpeg);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const { data, needsReview, reviewReasons } = validateAndNormalize(raw);

    console.log(`  Süre: ${elapsed}sn | Sonuç: ${JSON.stringify(data)}`);
    if (needsReview) console.log(`  Kontrol nedenleri: ${reviewReasons.join(' | ')}`);

    check(`tarih doğru (${data.tarih})`, data.tarih === receipt.truth.tarih);
    check(`toplam doğru (${data.toplam})`, Math.abs((data.toplam ?? 0) - receipt.truth.toplam) < 0.01);
    check(`ödeme türü doğru (${data.odeme_turu})`, data.odeme_turu === receipt.truth.odeme);
    check(`firma okundu (${data.firma_unvani})`, (data.firma_unvani || '').toUpperCase().includes(receipt.truth.firmaIcerir));
    check('kontrol gerekli DEĞİL (temiz fiş)', needsReview === false, `nedenler: ${reviewReasons.join(' | ')}`);
  }
}

// --- Çalıştır ---
(async () => {
  console.log('=== FIŞ -> EXCEL POC TESTLERİ ===');
  console.log(`API key: ${config.geminiApiKey ? 'tanımlı (' + config.geminiApiKey.slice(0, 8) + '...)' : 'YOK!'}`);
  try {
    testFenceCleaning();
    testValidationRules();
    await testImageProcessing();
    await testGeminiPipeline();
  } catch (err) {
    failCount++;
    console.error('\n💥 POC HATASI:', err.message);
    console.error(err.stack);
  }
  console.log(`\n=== SONUÇ: ${passCount} geçti, ${failCount} kaldı ===`);
  process.exit(failCount > 0 ? 1 : 0);
})();
