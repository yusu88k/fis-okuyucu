// Düzenlenebilir canlı Excel tablosu: Jspreadsheet CE (birebir Excel grid motoru) ile entegre edilmiştir.
// Excel stili hücre seçimi, sürükleyerek doldurma, Ctrl+C/Ctrl+V kopyala-yapıştır ve kolon sıralama mevcuttur.
import { useEffect, useRef, useMemo, useState } from 'react';
import jspreadsheet from 'jspreadsheet-ce';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCheck, Trash2, Search, Loader2, X as XIcon } from 'lucide-react';
import { flattenKdv, parseNumberInput } from '@/lib/format';
import { toast } from 'sonner';

import 'jspreadsheet-ce/dist/jspreadsheet.css';
import 'jsuites/dist/jsuites.css';

// Varsayılan sütun başlıkları; kullanıcı değiştirirse localStorage'da saklanır
// NOT: Güven (12) ve Durum (13) tablo-özel sütunlardır, Excel'e aktarılmaz (export 0-11 kullanır).
const DEFAULT_TITLES = [
  'Tarih (A)', 'Firma (B)', 'Vergi No (C)', 'Belge No (D)',
  '%1 Matrah (E)', '%1 KDV (F)', '%10 Matrah (G)', '%10 KDV (H)',
  '%20 Matrah (I)', '%20 KDV (J)', 'Toplam (K)', 'Ödeme (L)', 'Güven (M)', 'Durum (N)', 'Harcama Türü (O)',
];
const TITLES_KEY = 'excel_column_titles';
// ID sütunu (gizli) ve tablo-özel sütunların indexleri
const CAT_COL = 14;   // Harcama türü/kategori (gizlenebilir)
const ID_COL = 15;
const GUVEN_COL = 12;
const STATUS_COL = 13;

// Harcama kategorisi seçenekleri (grid dropdown'u); slug -> Türkçe etiket
const CATEGORY_SOURCE = [
  { id: '', name: '—' },
  { id: 'gida_market', name: 'Gıda/Market' },
  { id: 'akaryakit', name: 'Akaryakıt' },
  { id: 'yemek_restoran', name: 'Yemek/Restoran' },
  { id: 'kirtasiye_ofis', name: 'Kırtasiye/Ofis' },
  { id: 'saglik_eczane', name: 'Sağlık/Eczane' },
  { id: 'konaklama', name: 'Konaklama' },
  { id: 'ulasim', name: 'Ulaşım' },
  { id: 'iletisim', name: 'İletişim' },
  { id: 'teknoloji_demirbas', name: 'Teknoloji/Demirbaş' },
  { id: 'giyim', name: 'Giyim' },
  { id: 'insaat_yapi', name: 'İnşaat/Yapı' },
  { id: 'temizlik_sarf', name: 'Temizlik/Sarf' },
  { id: 'hizmet', name: 'Hizmet' },
  { id: 'arac', name: 'Araç' },
  { id: 'diger', name: 'Diğer' },
];
const CATEGORY_COL_KEY = 'show_category_col';
function loadShowCategory() {
  return localStorage.getItem(CATEGORY_COL_KEY) !== '0'; // varsayılan: göster
}

function loadTitles() {
  try {
    return JSON.parse(localStorage.getItem(TITLES_KEY)) || {};
  } catch {
    return {};
  }
}

function saveTitle(col, title) {
  const titles = loadTitles();
  titles[col] = title;
  localStorage.setItem(TITLES_KEY, JSON.stringify(titles));
}

function titleFor(col) {
  return loadTitles()[col] || DEFAULT_TITLES[col];
}

export const ResultsTable = ({ receipts, selectedId, onSelect, onEdit, onApprove, onDelete, fullHeight = false }) => {
  const sheetRef = useRef(null);
  const jexcelInstance = useRef(null);
  const isEditingLocally = useRef(false);
  const ignoreChange = useRef(false);
  // Son çizilen verinin imzası; polling'de veri değişmediyse grid'i yeniden kurmayız
  const lastSignature = useRef(null);
  // Canlı arama/filtre metni ve toplu onay meşguliyeti
  const [query, setQuery] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  // Harcama Türü sütunu görünürlüğü (tek tuşla gizle/göster)
  const [showCategory, setShowCategory] = useState(loadShowCategory());
  const showCategoryRef = useRef(showCategory);

  // Aramaya göre görünen fişler (tablo bunlardan çizilir; düzenleme/silme tam listeyle çalışır)
  const visibleReceipts = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return receipts;
    return receipts.filter((r) => {
      const d = r.data || {};
      return [d.firma_unvani, d.vergi_no, d.fis_no, d.tarih, d.toplam, r.fileName]
        .filter((x) => x != null && x !== '')
        .some((x) => String(x).toLocaleLowerCase('tr').includes(q));
    });
  }, [receipts, query]);

  // Görünenler arasında "kontrol gerekli" olanlar (toplu onay için)
  const reviewVisible = useMemo(
    () => visibleReceipts.filter((r) => r.status === 'kontrol_gerekli'),
    [visibleReceipts]
  );

  // Kontrol gerekenleri sırayla onayla (görünen/filtreli olanlar)
  const bulkApprove = async () => {
    if (reviewVisible.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    let ok = 0;
    for (const r of reviewVisible) {
      try {
        await Promise.resolve(onApprove(r.id));
        ok += 1;
      } catch {
        // tek fiş hatası toplu işlemi durdurmasın
      }
    }
    setBulkBusy(false);
    toast.success(`${ok} fiş onaylandı${ok < reviewVisible.length ? `, ${reviewVisible.length - ok} tanesi atlandı` : ''}.`);
  };

  // Harcama Türü sütununu tek tuşla gizle/göster (tercih localStorage'da kalıcı)
  const toggleCategory = () => {
    const next = !showCategory;
    setShowCategory(next);
    showCategoryRef.current = next;
    localStorage.setItem(CATEGORY_COL_KEY, next ? '1' : '0');
    const inst = jexcelInstance.current;
    if (inst) {
      try { next ? inst.showColumn(CAT_COL) : inst.hideColumn(CAT_COL); } catch { /* yoksay */ }
    }
  };

  // Durum kolonu etiketleri (işlemdeki fişler de tabloda görünür)
  const STATUS_LABELS = {
    tamam: 'Tamam ✅',
    kontrol_gerekli: 'Kontrol Gerekli ⚠️',
    isleniyor: 'İşlemde ⏳',
    bekliyor: 'Sırada 🕐',
    hata: 'Hata ❌',
    fis_degil: 'Fiş Değil 🚫',
  };

  // Tablo verilerini Jspreadsheet formatına dönüştür (aramaya göre filtrelenmiş)
  const sheetData = useMemo(() => {
    return visibleReceipts.map((r) => {
      const flat = flattenKdv(r.data);
      return [
        r.data?.tarih || '',
        // Henüz işlenmemiş fişte firma yerine dosya adı gösterilir (hangi fiş olduğu belli olsun)
        r.data?.firma_unvani || (!r.data ? r.fileName : ''),
        r.data?.vergi_no || '',
        r.data?.fis_no || '',
        flat.m1 || '',
        flat.k1 || '',
        flat.m10 || '',
        flat.k10 || '',
        flat.m20 || '',
        flat.k20 || '',
        r.data?.toplam || '',
        r.data?.odeme_turu || 'bilinmiyor',
        // Güven skoru (0-100); veri yoksa boş
        r.data?.guven_skoru != null ? r.data.guven_skoru : '',
        STATUS_LABELS[r.status] || r.status,
        r.data?.gider_kategorisi || '',
        r.id
      ];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleReceipts]);

  // Hücre değişikliklerini yakalayıp backend'e kaydet
  const handleSheetChange = (instance, cell, colStr, rowStr, value) => {
    if (ignoreChange.current) return;
    
    const col = parseInt(colStr, 10);
    const row = parseInt(rowStr, 10);
    
    if (!jexcelInstance.current) return;
    
    // Satır verisinden gizli ID'yi al
    const rowData = jexcelInstance.current.getRowData(row);
    const rid = rowData[ID_COL];
    if (!rid) return;

    const receipt = receipts.find((r) => r.id === rid);
    if (!receipt) return;

    const payload = {};
    if (col === 0) payload.tarih = value;
    else if (col === 1) payload.firma_unvani = value;
    else if (col === 2) payload.vergi_no = value;
    else if (col === 3) payload.fis_no = value;
    else if (col >= 4 && col <= 9) {
      // KDV alanlarından biri değişti
      const keys = ['m1', 'k1', 'm10', 'k10', 'm20', 'k20'];
      const key = keys[col - 4];
      const flat = flattenKdv(receipt.data);
      flat[key] = parseNumberInput(value);
      payload.kdv = flat;
    }
    else if (col === 10) payload.toplam = parseNumberInput(value);
    else if (col === 11) payload.odeme_turu = value;
    else if (col === CAT_COL) payload.gider_kategorisi = value || null;
    else return; // Güven/Durum/ID salt-okunur, kaydetme

    // Backend'e optimistic kaydet
    isEditingLocally.current = true;
    
    // Hücreye görsel geri bildirim olarak hafif yeşil pulse ver
    cell.classList.add('bg-emerald-50', 'border-emerald-500', 'font-semibold');
    setTimeout(() => {
      cell.classList.remove('bg-emerald-50', 'border-emerald-500', 'font-semibold');
    }, 1000);

    onEdit(rid, payload).finally(() => {
      isEditingLocally.current = false;
    });
  };

  // Seçilen hücreye göre yan paneldeki fiş önizlemesini yükle
  const handleSheetSelection = (instance, x1, y1) => {
    if (!jexcelInstance.current) return;
    const rowData = jexcelInstance.current.getRowData(y1);
    const rid = rowData[ID_COL];
    if (rid && rid !== selectedId) {
      onSelect(rid);
    }
  };

  // Jspreadsheet kurulumu ve veri senkronizasyonu
  useEffect(() => {
    const currentSheetRef = sheetRef.current;
    if (!currentSheetRef) return;

    if (!jexcelInstance.current) {
      // Tabloyu ilk kez oluştur
      const el = jspreadsheet(currentSheetRef, {
        data: sheetData,
        columns: [
          { type: 'text', title: titleFor(0), width: 100 },
          { type: 'text', title: titleFor(1), width: 220 },
          { type: 'text', title: titleFor(2), width: 110 },
          { type: 'text', title: titleFor(3), width: 90 },
          { type: 'numeric', title: titleFor(4), width: 100, mask: '#,##0.00' },
          { type: 'numeric', title: titleFor(5), width: 80, mask: '#,##0.00' },
          { type: 'numeric', title: titleFor(6), width: 100, mask: '#,##0.00' },
          { type: 'numeric', title: titleFor(7), width: 80, mask: '#,##0.00' },
          { type: 'numeric', title: titleFor(8), width: 100, mask: '#,##0.00' },
          { type: 'numeric', title: titleFor(9), width: 80, mask: '#,##0.00' },
          { type: 'numeric', title: titleFor(10), width: 110, mask: '#,##0.00' },
          { type: 'dropdown', title: titleFor(11), width: 110, source: [
            { id: 'nakit', name: 'Nakit' },
            { id: 'kredi_karti', name: 'Kredi Kartı' },
            { id: 'havale', name: 'Havale/EFT' },
            { id: 'bilinmiyor', name: 'Bilinmiyor' }
          ]},
          { type: 'numeric', title: titleFor(12), width: 80, readOnly: true, align: 'center' },
          { type: 'text', title: titleFor(13), width: 130, readOnly: true },
          { type: 'dropdown', title: titleFor(14), width: 150, source: CATEGORY_SOURCE, autocomplete: true },
          { type: 'hidden', title: 'ID (P)' }
        ],
        onchange: handleSheetChange,
        onselection: handleSheetSelection,
        // Hücre boyandıkça çalışır: güven skorunu ve durum/satır rengini ayarlar
        updateTable: (instance, cell, col, row, val) => {
          const c = parseInt(col, 10);
          // Güven skoru: düşükse kırmızı, ortaysa amber, yüksekse yeşil (görsel uyarı)
          if (c === GUVEN_COL) {
            cell.classList.remove('guven-dusuk', 'guven-orta', 'guven-yuksek');
            const n = Number(val);
            if (val === '' || val === null || Number.isNaN(n)) return;
            if (n < 60) cell.classList.add('guven-dusuk');
            else if (n < 80) cell.classList.add('guven-orta');
            else cell.classList.add('guven-yuksek');
          }
          // Durum sütunu: "kontrol gerekli" satırını amber vurgula (tasarım kuralı)
          if (c === STATUS_COL) {
            cell.classList.remove('durum-kontrol', 'durum-hata', 'durum-islemde', 'durum-fisdegil');
            const s = String(val || '');
            if (s.includes('Kontrol')) cell.classList.add('durum-kontrol');
            else if (s.includes('Hata')) cell.classList.add('durum-hata');
            else if (s.includes('Fiş Değil')) cell.classList.add('durum-fisdegil');
            else if (s.includes('İşlemde') || s.includes('Sırada')) cell.classList.add('durum-islemde');
          }
        },
        // Sayfalama: 3000+ fişte tüm satırları tek seferde çizmek tarayıcıyı kasar.
        // 100'er satır göstererek büyük listelerde akıcı kalır (muhasebeci için de kullanışlı).
        pagination: 100,
        paginationOptions: [50, 100, 250, 500],
        search: false,
        allowInsertColumn: false,
        allowDeleteColumn: false,
        // Başlıklara çift tıklayarak yeniden adlandırma (Excel'deki gibi)
        allowRenameColumn: true,
        onchangeheader: (instance, col, oldValue, newValue) => {
          const c = parseInt(col, 10);
          if (!Number.isNaN(c) && c >= 0 && c <= CAT_COL && newValue) {
            saveTitle(c, String(newValue));
          }
        },
        contextMenu: (obj, x, y, e) => {
          // Sağ tık menüsünü muhasebe ihtiyaçlarına uyarla
          return [
            {
              title: 'Seçili Fişi Sil',
              onclick: () => {
                const rowData = obj.getRowData(y);
                const rid = rowData[ID_COL];
                if (rid) onDelete(rid);
              }
            },
            {
              title: 'Seçili Fişi Onayla',
              onclick: () => {
                const rowData = obj.getRowData(y);
                const rid = rowData[ID_COL];
                if (rid) onApprove(rid);
              }
            },
            {
              title: 'Sütun Başlığını Değiştir',
              onclick: () => {
                const c = parseInt(x, 10);
                if (Number.isNaN(c) || c > CAT_COL) return;
                const mevcut = titleFor(c);
                const yeni = window.prompt('Yeni sütun başlığı:', mevcut);
                if (yeni && yeni.trim()) {
                  obj.setHeader(c, yeni.trim());
                  saveTitle(c, yeni.trim());
                }
              }
            }
          ];
        }
      });
      jexcelInstance.current = el.jexcel || el;
      // Kullanıcı Harcama Türü sütununu gizlemişse uygula (grid her veri güncellemesinde yeniden kurulur)
      if (!showCategoryRef.current) {
        try { jexcelInstance.current.hideColumn(CAT_COL); } catch { /* jspreadsheet sürüm farkı */ }
      }
    } else {
      // Eğer değişiklik dışarıdan geldiyse (kuyruk tamamlandıysa) veriyi güncelle.
      // Polling her 1.5 sn tetiklenir; veri gerçekten değişmediyse grid'i baştan
      // kurmayıp seçim/kaydırmayı koruruz (performans + akıcılık).
      const signature = JSON.stringify(sheetData);
      if (!isEditingLocally.current && signature !== lastSignature.current) {
        ignoreChange.current = true;
        jexcelInstance.current.setData(sheetData);
        ignoreChange.current = false;
        lastSignature.current = signature;
      }
    }

    return () => {
      // Temizlik gerekiyorsa yok etme
      if (jexcelInstance.current && currentSheetRef) {
        try {
          jspreadsheet.destroy(currentSheetRef);
        } catch (e) {
          console.error('Jspreadsheet destroy failed:', e);
        }
        jexcelInstance.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetData]);

  if (receipts.length === 0) {
    return (
      <Card className="p-10 text-center text-muted-foreground shadow-[var(--shadow-soft)]">
        Sonuç bulunamadı. Ay filtresini değiştirin, Excel yükleyin veya boş satır ekleyin.
      </Card>
    );
  }

  // Seçili satırı doğrulamak için buton grupları
  const selectedReceipt = receipts.find((r) => r.id === selectedId);
  const showApproveAction = selectedReceipt?.status === 'kontrol_gerekli';

  return (
    <Card className="shadow-[var(--shadow-soft)] p-2 sm:p-4 border border-slate-200 bg-white">
      {selectedReceipt && (
        <div className="flex items-center justify-between gap-2 mb-3 bg-slate-50 p-2.5 rounded-lg border">
          <div className="text-xs text-muted-foreground">
            Seçili Fiş: <strong className="text-slate-700 font-semibold">{selectedReceipt.fileName}</strong>
          </div>
          <div className="flex items-center gap-1.5">
            {showApproveAction && (
              <Button
                size="sm"
                onClick={() => onApprove(selectedId)}
                className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Kontrol Ettim, Onayla
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDelete(selectedId)}
              className="h-8 text-rose-600 hover:bg-rose-50 text-xs"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Sil
            </Button>
          </div>
        </div>
      )}

      {/* Araç çubuğu: canlı arama + toplu onay */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tabloda ara (firma, vergi no, fiş no...)"
            className="h-8 pl-8 pr-7 w-64 text-sm"
            data-testid="table-search-input"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-slate-700"
              aria-label="Aramayı temizle"
            >
              <XIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          {query ? `${visibleReceipts.length} / ${receipts.length}` : `${receipts.length}`} fiş
          {reviewVisible.length > 0 && <span className="text-amber-600 font-medium"> · {reviewVisible.length} kontrol gerekli</span>}
        </div>

        <div className="flex-1" />

        <Button
          size="sm"
          variant="outline"
          onClick={toggleCategory}
          className="h-8 text-xs"
          data-testid="toggle-category-column"
          title="Harcama Türü sütununu göster/gizle"
        >
          {showCategory ? 'Harcama Türünü Gizle' : 'Harcama Türünü Göster'}
        </Button>

        {reviewVisible.length > 0 && (
          <Button
            size="sm"
            onClick={bulkApprove}
            disabled={bulkBusy}
            className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
            data-testid="bulk-approve-button"
          >
            {bulkBusy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5 mr-1" />}
            {query ? 'Görünenleri Onayla' : 'Kontrol Gerekenleri Onayla'} ({reviewVisible.length})
          </Button>
        )}
      </div>

      {query && visibleReceipts.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-6 border rounded-lg bg-slate-50 mb-3">
          "{query}" aramasıyla eşleşen fiş yok.
        </div>
      )}

      {/* Mobilde tablo geniştir: yana kaydırma ipucu (sadece küçük ekran) */}
      <p className="sm:hidden text-[11px] text-muted-foreground text-center mb-1">← Tabloyu parmakla yana kaydırabilirsiniz →</p>
      {/* Jspreadsheet Canlı Excel Tablo Alanı */}
      <div
        className={`overflow-auto excel-theme-wrapper ${fullHeight ? '' : 'overflow-x-auto'}`}
        style={fullHeight ? { maxHeight: 'calc(100vh - 230px)' } : undefined}
      >
        <div ref={sheetRef} className="live-jexcel-grid" />
      </div>
    </Card>
  );
};
