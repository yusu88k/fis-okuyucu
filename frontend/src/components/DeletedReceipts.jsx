// Silinen fişler (çöp kutusu): kullanıcı yanlışlıkla sildiğini ayrı bir yerde görüp geri yükleyebilir.
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, RotateCcw, ChevronDown, ChevronRight, FileText } from 'lucide-react';

const DOC_TYPE_LABELS = {
  yazarkasa_fisi: 'Fiş', e_fatura: 'e-Fatura', fatura: 'Fatura',
  dekont: 'Dekont', gider_pusulasi: 'Gider Pusulası', diger: 'Diğer',
};

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TL');

export const DeletedReceipts = ({ trash = [], onRestore }) => {
  const [open, setOpen] = useState(false);
  if (!trash || trash.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-[var(--shadow-soft)] overflow-hidden" data-testid="deleted-receipts">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <Trash2 className="h-4 w-4 text-rose-500" />
        <span className="font-semibold text-sm">Silinen Fişler ({trash.length})</span>
        <span className="text-xs text-muted-foreground ml-1">— yanlışlıkla sildiyseniz geri yükleyin</span>
      </button>

      {open && (
        <div className="divide-y border-t">
          {trash.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/60">
              <FileText className="h-4 w-4 text-slate-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{r.firma_unvani || r.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {r.belge_turu ? `${DOC_TYPE_LABELS[r.belge_turu] || r.belge_turu} · ` : ''}
                  {r.tarih || 'tarih yok'} · {fmt(r.toplam)}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-emerald-700 border-emerald-300 hover:bg-emerald-50 shrink-0"
                onClick={() => onRestore(r.id)}
                data-testid="restore-receipt-button"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Geri Yükle
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
