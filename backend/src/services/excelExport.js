// Excel (xlsx) üretimi - ExcelJS ile profesyonel biçimlendirme.
// Sayfa 1 "Fişler": başlık bandı + renkli/donuk başlık satırı + autofilter + zebra + TOPLAM (SUM formülü)
// Sayfa 2 "Aylık Özet": ay bazında KDV kırılımı (beyanname için) + TOPLAM
// Sayfa 3 "Firma Özeti": firma bazında matrah/KDV/genel toplam (çok harcanan tedarikçiler)
// Tarih hücreleri gerçek date tipindedir, tutarlar sayı + para formatlıdır (string değil).
import ExcelJS from 'exceljs';
import { round2 } from './validation.js';

const MONTH_NAMES_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const MONEY_FMT = '#,##0.00';
const DATE_FMT = 'dd.mm.yyyy';

const PAYMENT_LABELS = { nakit: 'Nakit', kredi_karti: 'Kredi Kartı', havale: 'Havale/EFT', bilinmiyor: 'Bilinmiyor' };
// Belge türü etiketleri (kullanıcı Excel'de dekont/fiş ayırabilsin diye ayrı sütun)
const DOC_TYPE_LABELS = {
  yazarkasa_fisi: 'Fiş', e_fatura: 'e-Fatura', fatura: 'Fatura',
  dekont: 'Dekont', gider_pusulasi: 'Gider Pusulası', diger: 'Diğer',
};
// Gider kategorisi etiketleri (harcamanın türü/sektörü — muhasebe gider hesabı için)
const CATEGORY_LABELS = {
  gida_market: 'Gıda/Market', akaryakit: 'Akaryakıt', yemek_restoran: 'Yemek/Restoran',
  kirtasiye_ofis: 'Kırtasiye/Ofis', saglik_eczane: 'Sağlık/Eczane', konaklama: 'Konaklama',
  ulasim: 'Ulaşım', iletisim: 'İletişim', teknoloji_demirbas: 'Teknoloji/Demirbaş',
  giyim: 'Giyim', insaat_yapi: 'İnşaat/Yapı', temizlik_sarf: 'Temizlik/Sarf',
  hizmet: 'Hizmet', arac: 'Araç', diger: 'Diğer',
};

// Renk paleti (uygulama slate temasıyla uyumlu, ARGB)
const C = {
  title: 'FF0F172A',   // başlık bandı arka planı (slate-900)
  header: 'FF1E293B',  // sütun başlığı arka planı (slate-800)
  white: 'FFFFFFFF',
  zebra: 'FFF1F5F9',   // tek satır gölgesi (slate-100)
  border: 'FFCBD5E1',  // ince çerçeve (slate-300)
  total: 'FFDBEAFE',   // TOPLAM satırı arka planı (blue-100)
  accent: 'FF166534',  // KDV/tutar vurgusu (green-800)
};

// KDV detayını oran bazında düz alanlara aç (%1/%10/%20 matrah + kdv)
function kdvParts(data) {
  const parts = { m1: 0, k1: 0, m10: 0, k10: 0, m20: 0, k20: 0 };
  for (const item of data?.kdv_detay || []) {
    const oran = Number(item?.oran);
    if (oran === 1) { parts.m1 += item.matrah; parts.k1 += item.kdv_tutari; }
    else if (oran === 10 || oran === 8) { parts.m10 += item.matrah; parts.k10 += item.kdv_tutari; }
    else if (oran === 20 || oran === 18) { parts.m20 += item.matrah; parts.k20 += item.kdv_tutari; }
  }
  for (const key of Object.keys(parts)) parts[key] = round2(parts[key]);
  return parts;
}

function monthLabelTr(ym) {
  const [year, month] = ym.split('-');
  const idx = parseInt(month, 10) - 1;
  return `${MONTH_NAMES_TR[idx] || ym} ${year}`;
}

const thinBorder = {
  top: { style: 'thin', color: { argb: C.border } },
  left: { style: 'thin', color: { argb: C.border } },
  bottom: { style: 'thin', color: { argb: C.border } },
  right: { style: 'thin', color: { argb: C.border } },
};

// Bir başlık satırını renklendir (koyu zemin + beyaz kalın yazı + ortalı + çerçeve)
function styleHeaderRow(row) {
  row.height = 22;
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.header } };
    cell.font = { bold: true, color: { argb: C.white }, size: 11 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder;
  });
}

// Başlık bandı (birleşik hücre): koyu zemin, büyük beyaz yazı
function addTitleBand(ws, text, lastColLetter) {
  ws.mergeCells(`A1:${lastColLetter}1`);
  const cell = ws.getCell('A1');
  cell.value = text;
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.title } };
  cell.font = { bold: true, color: { argb: C.white }, size: 14 };
  cell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  ws.getRow(1).height = 30;
}

// Sütun harfi (1 -> A, 12 -> L)
function colLetter(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

// receipts: data'sı dolu fişler; monthFilter: 'YYYY-MM' veya null
// customHeaders: { kolonIndex: 'Özel Başlık' } — kullanıcının UI'da yeniden adlandırdığı başlıklar
export async function buildWorkbook(receipts, monthFilter = null, customHeaders = null, excludeCategory = false) {
  // Fiş olmayan (fis_degil) görseller Excel'e girmez
  let rows = receipts.filter((r) => r.data && r.data.toplam !== null && r.status !== 'fis_degil');
  if (monthFilter) rows = rows.filter((r) => (r.data.tarih || '').startsWith(monthFilter));
  rows.sort((a, b) => (a.data.tarih || '').localeCompare(b.data.tarih || ''));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Fişten Excel'e";
  workbook.created = new Date();

  // ===== Sayfa 1: Fişler =====
  // Başlık satırı (title) 1. satırda, sütun başlıkları 2. satırda; ikisi de donuk.
  const ws = workbook.addWorksheet('Fişler', {
    views: [{ state: 'frozen', ySplit: 2 }],
    properties: { defaultRowHeight: 18 },
  });

  // NOT: "Belge No" hem fiş no hem dekont referans no hem fatura no'yu kapsar (dekonta "Fiş No" demeyiz).
  // NOT: "Kategori" (gider türü) sona eklendi (N sütunu) — mevcut sütun indeksleri bozulmasın.
  const defaultHeader = ['Tarih', 'Firma', 'Vergi No', 'Belge No', '%1 Matrah', '%1 KDV', '%10 Matrah', '%10 KDV', '%20 Matrah', '%20 KDV', 'Toplam', 'Ödeme Türü', 'Belge Türü', 'Kategori', 'Tevkifat'];
  
  if (excludeCategory) {
    const catIdx = defaultHeader.indexOf('Kategori');
    if (catIdx !== -1) {
      defaultHeader.splice(catIdx, 1);
    }
  }

  const header = defaultHeader.map((h, i) =>
    customHeaders && customHeaders[i] ? String(customHeaders[i]).slice(0, 60) : h
  );
  const lastCol = header.length;                   // 15 veya 14
  const lastColL = colLetter(lastCol);             // 'O' veya 'N'
  
  // E..K matrah/kdv/toplam (5,6,7,8,9,10,11) + Tevkifat (kategori varsa 15, yoksa 14)
  const moneyCols = [5, 6, 7, 8, 9, 10, 11, excludeCategory ? 14 : 15];

  const defaultWidths = [
    { width: 12 }, { width: 36 }, { width: 15 }, { width: 14 },
    { width: 13 }, { width: 11 }, { width: 13 }, { width: 11 },
    { width: 13 }, { width: 11 }, { width: 14 }, { width: 13 },
    { width: 13 }, { width: 16 }, { width: 12 },
  ];
  if (excludeCategory) {
    defaultWidths.splice(13, 1); // 13. indeksteki Kategori genişliğini çıkar
  }
  ws.columns = defaultWidths;

  const bandText = monthFilter
    ? `FİŞTEN EXCEL'E · Fiş Listesi · ${monthLabelTr(monthFilter)}`
    : "FİŞTEN EXCEL'E · Fiş Listesi";
  addTitleBand(ws, bandText, lastColL);

  const headerRow = ws.addRow(header);
  styleHeaderRow(headerRow);

  const firstDataRow = 3;
  for (const r of rows) {
    const p = kdvParts(r.data);
    const dateObj = r.data.tarih ? new Date(r.data.tarih + 'T00:00:00') : null;
    
    const rowData = [
      dateObj,
      r.data.firma_unvani || '',
      r.data.vergi_no || '',
      r.data.fis_no || '',
      p.m1, p.k1, p.m10, p.k10, p.m20, p.k20,
      round2(r.data.toplam || 0),
      PAYMENT_LABELS[r.data.odeme_turu] || 'Bilinmiyor',
      DOC_TYPE_LABELS[r.data.belge_turu] || '—',
      CATEGORY_LABELS[r.data.gider_kategorisi] || '—',
      r.data.tevkifat ? round2(r.data.tevkifat) : '',
    ];

    if (excludeCategory) {
      rowData.splice(13, 1); // 13. indeksteki Kategori değerini çıkar
    }

    ws.addRow(rowData);
  }
  const n = rows.length;
  const lastDataRow = firstDataRow + n - 1;

  // Veri hücrelerini biçimle: çerçeve, zebra, para/tarih formatı, hizalama
  const centerCols = excludeCategory ? [3, 4, 12, 13] : [3, 4, 12, 13, 14];
  for (let i = 0; i < n; i++) {
    const row = ws.getRow(firstDataRow + i);
    row.eachCell((cell, col) => {
      cell.border = thinBorder;
      if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.zebra } };
      if (col === 1) { cell.numFmt = DATE_FMT; cell.alignment = { horizontal: 'center' }; }
      else if (moneyCols.includes(col)) { cell.numFmt = MONEY_FMT; cell.alignment = { horizontal: 'right' }; }
      else if (centerCols.includes(col)) cell.alignment = { horizontal: 'center' };
    });
    // Toplam sütununu (K, 11) vurgula
    const totalCell = row.getCell(11);
    totalCell.font = { bold: true, color: { argb: C.accent } };
  }

  // TOPLAM satırı (SUM formülleriyle — sabit değer değil)
  if (n > 0) {
    const sumRowNum = lastDataRow + 1;
    const sumRow = ws.getRow(sumRowNum);
    sumRow.getCell(1).value = 'TOPLAM';
    for (const col of moneyCols) {
      const L = colLetter(col);
      sumRow.getCell(col).value = { formula: `SUM(${L}${firstDataRow}:${L}${lastDataRow})` };
    }
    sumRow.eachCell((cell, col) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.total } };
      cell.font = { bold: true };
      cell.border = thinBorder;
      if (moneyCols.includes(col)) { cell.numFmt = MONEY_FMT; cell.alignment = { horizontal: 'right' }; }
    });
    // TOPLAM etiketini de tüm başlangıç sütunlarında görünür kılmak için birleştir (A..D)
    ws.mergeCells(`A${sumRowNum}:D${sumRowNum}`);
    ws.getCell(`A${sumRowNum}`).alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getRow(sumRowNum).height = 20;
  }

  // Başlık satırında otomatik filtre (kullanıcı Excel'de süzebilsin)
  if (n > 0) {
    ws.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: lastCol } };
  }

  // ===== Sayfa 2: Aylık Özet =====
  const monthly = new Map();
  for (const r of rows) {
    const key = (r.data.tarih || '').slice(0, 7) || 'bilinmiyor';
    if (!monthly.has(key)) monthly.set(key, { count: 0, m1: 0, k1: 0, m10: 0, k10: 0, m20: 0, k20: 0, toplam: 0 });
    const agg = monthly.get(key);
    const p = kdvParts(r.data);
    agg.count += 1;
    agg.m1 += p.m1; agg.k1 += p.k1;
    agg.m10 += p.m10; agg.k10 += p.k10;
    agg.m20 += p.m20; agg.k20 += p.k20;
    agg.toplam += r.data.toplam || 0;
  }

  const ws2 = workbook.addWorksheet('Aylık Özet', { views: [{ state: 'frozen', ySplit: 2 }] });
  const summaryHeader = ['Ay', 'Fiş Adedi', '%1 Matrah', '%1 KDV', '%10 Matrah', '%10 KDV', '%20 Matrah', '%20 KDV', 'Toplam KDV', 'Genel Toplam'];
  ws2.columns = [{ width: 18 }, { width: 11 }, { width: 13 }, { width: 11 }, { width: 13 }, { width: 11 }, { width: 13 }, { width: 11 }, { width: 13 }, { width: 15 }];
  addTitleBand(ws2, "FİŞTEN EXCEL'E · Aylık KDV Özeti (Beyanname)", colLetter(summaryHeader.length));
  styleHeaderRow(ws2.addRow(summaryHeader));

  const sortedMonths = [...monthly.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [key, agg] of sortedMonths) {
    ws2.addRow([
      key === 'bilinmiyor' ? 'Bilinmiyor' : monthLabelTr(key),
      agg.count,
      round2(agg.m1), round2(agg.k1),
      round2(agg.m10), round2(agg.k10),
      round2(agg.m20), round2(agg.k20),
      round2(agg.k1 + agg.k10 + agg.k20),
      round2(agg.toplam),
    ]);
  }
  const monthCount = sortedMonths.length;
  for (let i = 0; i < monthCount; i++) {
    const row = ws2.getRow(3 + i);
    row.eachCell((cell, col) => {
      cell.border = thinBorder;
      if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.zebra } };
      if (col >= 3) { cell.numFmt = MONEY_FMT; cell.alignment = { horizontal: 'right' }; }
      else if (col === 2) cell.alignment = { horizontal: 'center' };
    });
  }
  if (monthCount > 0) {
    const sumRowNum = 3 + monthCount;
    const sumRow = ws2.getRow(sumRowNum);
    sumRow.getCell(1).value = 'TOPLAM';
    sumRow.getCell(2).value = { formula: `SUM(B3:B${2 + monthCount})` };
    for (let col = 3; col <= 10; col++) {
      const L = colLetter(col);
      sumRow.getCell(col).value = { formula: `SUM(${L}3:${L}${2 + monthCount})` };
    }
    sumRow.eachCell((cell, col) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.total } };
      cell.font = { bold: true };
      cell.border = thinBorder;
      if (col >= 3) { cell.numFmt = MONEY_FMT; cell.alignment = { horizontal: 'right' }; }
    });
  }

  // ===== Sayfa 3: Firma Özeti =====
  const byFirm = new Map();
  for (const r of rows) {
    const firma = r.data.firma_unvani || 'Bilinmiyor';
    const vno = r.data.vergi_no || '';
    const key = vno || firma;
    if (!byFirm.has(key)) byFirm.set(key, { firma, vno, count: 0, matrah: 0, kdv: 0, toplam: 0 });
    const agg = byFirm.get(key);
    const p = kdvParts(r.data);
    agg.count += 1;
    agg.matrah += p.m1 + p.m10 + p.m20;
    agg.kdv += p.k1 + p.k10 + p.k20;
    agg.toplam += r.data.toplam || 0;
  }
  const ws3 = workbook.addWorksheet('Firma Özeti', { views: [{ state: 'frozen', ySplit: 2 }] });
  const firmHeader = ['Firma', 'Vergi No', 'Fiş Adedi', 'Toplam Matrah', 'Toplam KDV', 'Genel Toplam'];
  ws3.columns = [{ width: 40 }, { width: 15 }, { width: 11 }, { width: 15 }, { width: 14 }, { width: 15 }];
  addTitleBand(ws3, "FİŞTEN EXCEL'E · Firma Bazlı Özet", colLetter(firmHeader.length));
  styleHeaderRow(ws3.addRow(firmHeader));

  const sortedFirms = [...byFirm.values()].sort((a, b) => b.toplam - a.toplam);
  for (const f of sortedFirms) {
    ws3.addRow([f.firma, f.vno, f.count, round2(f.matrah), round2(f.kdv), round2(f.toplam)]);
  }
  const firmCount = sortedFirms.length;
  for (let i = 0; i < firmCount; i++) {
    const row = ws3.getRow(3 + i);
    row.eachCell((cell, col) => {
      cell.border = thinBorder;
      if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.zebra } };
      if (col >= 4) { cell.numFmt = MONEY_FMT; cell.alignment = { horizontal: 'right' }; }
      else if (col === 2 || col === 3) cell.alignment = { horizontal: 'center' };
    });
  }
  if (firmCount > 0) {
    const sumRowNum = 3 + firmCount;
    const sumRow = ws3.getRow(sumRowNum);
    sumRow.getCell(1).value = 'TOPLAM';
    sumRow.getCell(3).value = { formula: `SUM(C3:C${2 + firmCount})` };
    for (const col of [4, 5, 6]) {
      const L = colLetter(col);
      sumRow.getCell(col).value = { formula: `SUM(${L}3:${L}${2 + firmCount})` };
    }
    sumRow.eachCell((cell, col) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: C.total } };
      cell.font = { bold: true };
      cell.border = thinBorder;
      if (col >= 4) { cell.numFmt = MONEY_FMT; cell.alignment = { horizontal: 'right' }; }
    });
    ws3.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: firmHeader.length } };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
