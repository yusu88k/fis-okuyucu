// Çok sekmeli Excel yüklenince kullanıcı hangi sekmeyi (ay/yıl) aktaracağını seçsin
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sheet as SheetIcon, Check, Layers } from 'lucide-react';

const ALL = '__ALL__';

export function SheetPickerDialog({ open, sheets = [], suggested = null, onPick, onClose }) {
  const [sel, setSel] = useState(suggested);

  useEffect(() => {
    if (open) setSel(suggested || (sheets[0] && sheets[0].name) || null);
  }, [open, suggested, sheets]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md" data-testid="sheet-picker-dialog">
        <DialogTitle className="flex items-center gap-2">
          <SheetIcon className="h-5 w-5 text-sky-600" />
          Hangi sekmeyi aktaralım?
        </DialogTitle>
        <DialogDescription>
          Bu Excel birden çok sekme içeriyor (ör. aylar/yıllar). Aktarmak istediğin sekmeyi seç.
        </DialogDescription>

        <div className="mt-2 max-h-[45vh] overflow-y-auto flex flex-col gap-1.5 pr-1">
          {/* Tümü: bütün sekmeleri tek seferde aktar */}
          <button
            type="button"
            onClick={() => setSel(ALL)}
            className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
              sel === ALL ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:bg-slate-50'
            }`}
            data-testid="sheet-picker-all"
          >
            <div className="min-w-0 flex items-center gap-2">
              <Layers className="h-4 w-4 text-sky-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Tümü (bütün sekmeler)</p>
                <p className="text-xs text-muted-foreground">
                  {sheets.length} sekme · {sheets.reduce((t, s) => t + (s.rows || 0), 0)} satır · biraz uzun sürebilir
                </p>
              </div>
            </div>
            {sel === ALL && <Check className="h-4 w-4 text-sky-600 shrink-0" />}
          </button>

          {sheets.map((s) => {
            const active = sel === s.name;
            return (
              <button
                key={s.name}
                type="button"
                onClick={() => setSel(s.name)}
                className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  active ? 'border-sky-500 bg-sky-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
                data-testid="sheet-picker-option"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate" title={s.name}>{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.rows} satır{s.name === suggested ? ' · önerilen' : ''}</p>
                </div>
                {active && <Check className="h-4 w-4 text-sky-600 shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} data-testid="sheet-picker-cancel">İptal</Button>
          <Button onClick={() => sel && onPick(sel)} disabled={!sel} data-testid="sheet-picker-confirm">
            Bu Sekmeyi Aktar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
