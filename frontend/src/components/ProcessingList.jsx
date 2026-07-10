// Canlı işlem listesi: bekleyen/işlenen fişler + genel ilerleme + hatalı fişler için Tekrar Dene
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RotateCcw, X, FileImage } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

export const ProcessingList = ({ receipts, onRetry, onDelete, onCancel }) => {
  const active = receipts.filter((r) => r.status === 'bekliyor' || r.status === 'isleniyor');
  const errors = receipts.filter((r) => r.status === 'hata');
  if (active.length === 0 && errors.length === 0) return null;

  const total = receipts.length;
  const doneCount = total - active.length;
  const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const visibleRows = [...active, ...errors];

  return (
    <Card className="shadow-[var(--shadow-soft)]" data-testid="processing-list-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <CardTitle className="font-heading text-base md:text-lg">
            {active.length > 0 ? 'Fişler işleniyor… Bu ekranı kapatmayın.' : 'Hata alan fişler'}
          </CardTitle>
          {active.length > 0 && (
            <span className="text-sm text-muted-foreground tabular-nums" data-testid="processing-counter">
              {doneCount}/{total} tamamlandı
            </span>
          )}
        </div>
        {active.length > 0 && (
          <Progress value={percent} className="h-2 mt-2" data-testid="overall-processing-progress" />
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="max-h-72">
          <ul className="divide-y">
            {visibleRows.map((r) => (
              <li
                key={r.id}
                data-testid="receipt-file-row"
                className="flex items-center gap-3 py-2.5 min-h-[52px]"
              >
                <FileImage className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{r.fileName}</p>
                  {r.error && (
                    <p className="text-xs text-rose-400 mt-0.5" data-testid="receipt-error-text">
                      {r.error}
                    </p>
                  )}
                </div>
                <StatusBadge status={r.status} />
                {(r.status === 'bekliyor' || r.status === 'isleniyor') && onCancel && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 h-8 text-rose-600 border-rose-200 hover:bg-rose-50"
                    onClick={() => onCancel(r.id)}
                    data-testid="receipt-cancel-button"
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    İptal
                  </Button>
                )}
                {r.status === 'hata' && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onRetry(r.id)}
                      data-testid="receipt-retry-button"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      Tekrar Dene
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground"
                      onClick={() => onDelete(r.id)}
                      data-testid="receipt-remove-button"
                      aria-label="Listeden kaldır"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
