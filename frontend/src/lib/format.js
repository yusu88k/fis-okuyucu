// Sayı, para ve tarih biçimlendirme yardımcıları (Türkçe)
export const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

// 1234.5 -> "1.234,50"
export function formatCurrency(value) {
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
}

// "2025-09-15" -> "15.09.2025"
export function formatDateTr(iso) {
  if (!iso) return '—';
  const parts = String(iso).split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

// "2025-09" -> "Eylül 2025"
export function monthLabel(ym) {
  const [year, month] = String(ym).split('-');
  const idx = parseInt(month, 10) - 1;
  return `${MONTHS_TR[idx] || ym} ${year}`;
}

// Kullanıcı girdisini sayıya çevir (virgül ondalık destekli): "1.234,56" -> 1234.56
export function parseNumberInput(str) {
  if (typeof str === 'number') return str;
  const cleaned = String(str || '').replace(/[^0-9.,-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

// KDV detayını düz forma aç: [{oran, matrah, kdv_tutari}] -> {m1,k1,m10,k10,m20,k20}
// Aynı orandan birden fazla kalem varsa toplar (eski/yeni KDV oranlarıyla uyumlu)
export function flattenKdv(data) {
  const flat = { m1: 0, k1: 0, m10: 0, k10: 0, m20: 0, k20: 0 };
  for (const item of data?.kdv_detay || []) {
    const oran = Number(item?.oran);
    const matrah = Number(item?.matrah) || 0;
    const kdv = Number(item?.kdv_tutari) || 0;
    if (oran === 1) { flat.m1 += matrah; flat.k1 += kdv; }
    else if (oran === 10 || oran === 8) { flat.m10 += matrah; flat.k10 += kdv; }
    else if (oran === 20 || oran === 18) { flat.m20 += matrah; flat.k20 += kdv; }
  }
  return flat;
}

export const PAYMENT_LABELS = { nakit: 'Nakit', kredi_karti: 'Kredi Kartı', bilinmiyor: 'Bilinmiyor' };
