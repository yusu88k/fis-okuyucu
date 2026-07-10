// AI'ın "fiş/fatura değil" deyip atladığı görseller (status: fis_degil).
// Tabloya girmezler (Excel'e de) ama AI yanılmış olabilir diye kullanıcı burada görüp
// inceleyebilir, yine de işleyebilir veya silebilir.
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileQuestion, Eye, RotateCcw, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

export const SkippedReceipts = ({ items = [], onSelect, onRetry, onDelete }) => {
  const [open, setOpen] = useState(true);
  if (!items || items.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50/50 shadow-[var(--shadow-soft)] overflow-hidden" data-testid="skipped-receipts">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-amber-100/50 transition-colors"
      >
        {open ? <ChevronDown className="h-4 w-4 text-amber-700" /> : <ChevronRight className="h-4 w-4 text-amber-700" />}
        <FileQuestion className="h-4 w-4 text-amber-600" />
        <span className="font-semibold text-sm text-amber-900">Fiş Sayılmayanlar ({items.length})</span>
        <span className="text-xs text-amber-700/80 ml-1">— yapay zekâ bunları fiş/fatura saymadı, tabloya almadı</span>
      </button>

      {open && (
        <div className="divide-y divide-amber-200 border-t border-amber-200">
          {items.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-amber-100/30">
              <FileQuestion className="h-4 w-4 text-amber-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" title={r.fileName}>{r.fileName}</p>
                <p className="text-xs text-amber-700/80">
                  {r.error || 'Yapay zekâ bu görseli fiş/fatura/dekont olarak tanımadı. Yanlışsa "Yine de İşle" deyin.'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button size="sm" variant="outline" className="h-8" onClick={() => onSelect(r.id)} data-testid="skipped-view">
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  Gör
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-sky-700 border-sky-300 hover:bg-sky-50" onClick={() => onRetry(r.id)} data-testid="skipped-retry">
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Yine de İşle
                </Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-50" onClick={() => onDelete(r.id)} aria-label="Sil" data-testid="skipped-delete">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
