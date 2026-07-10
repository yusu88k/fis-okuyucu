// Sunucu (Render ücretsiz plan) uyku modundan uyanırken gösterilen bekleme ekranı.
// Backend cold-start ~50sn sürebilir; kullanıcı boş/bozuk ekran yerine bunu görür.
import { Loader2, FileSpreadsheet } from 'lucide-react';

export function BackendWaking({ elapsed = 0, onRetry }) {
  return (
    <div className="min-h-screen bg-background noise-bg flex items-center justify-center p-6" data-testid="backend-waking">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <FileSpreadsheet className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-heading text-xl font-semibold text-slate-800">Fişten Excel'e</h1>

        <div className="mt-6 flex items-center justify-center gap-2 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-medium">Sistem başlatılıyor, lütfen bekleyin…</span>
        </div>

        <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
          Sunucu uyku modundan uyanıyor. İlk açılış <strong>bir dakikaya kadar</strong> sürebilir.
          Bu ekran, hazır olunca otomatik kapanır.
        </p>

        {/* İnce ilerleme çubuğu (belirsiz) */}
        <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-full w-1/3 rounded-full bg-primary animate-pulse" />
        </div>

        {elapsed >= 8 && (
          <p className="mt-4 text-[11px] text-muted-foreground">
            {elapsed} saniyedir bekleniyor…
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="ml-1 underline text-primary hover:text-primary/80"
                data-testid="backend-waking-retry"
              >
                Yeniden dene
              </button>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
