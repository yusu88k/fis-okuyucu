// Sağ panel: seçili fişin fotoğrafı + kontrol nedenleri + hızlı aksiyonlar
// Annem fotoğrafla tabloyu karşılaştırıp düzeltebilsin diye
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { X, ZoomIn, CheckCheck, RotateCcw, AlertTriangle, Copy, ImageOff, MousePointerClick, Sparkles, MessageSquare, FileText } from 'lucide-react';
import { API_BASE } from '@/lib/api';
import { formatCurrency, formatDateTr } from '@/lib/format';
import { StatusBadge } from './StatusBadge';

// Belge türü etiketleri (dekont/fiş ayrımı kullanıcıya gösterilsin)
const DOC_TYPE_LABELS = {
  yazarkasa_fisi: 'Yazarkasa Fişi', e_fatura: 'e-Fatura', fatura: 'Fatura',
  dekont: 'Dekont', gider_pusulasi: 'Gider Pusulası', diger: 'Diğer',
};
// Gider kategorisi (harcamanın türü/sektörü)
const CATEGORY_LABELS = {
  gida_market: 'Gıda/Market', akaryakit: 'Akaryakıt', yemek_restoran: 'Yemek/Restoran',
  kirtasiye_ofis: 'Kırtasiye/Ofis', saglik_eczane: 'Sağlık/Eczane', konaklama: 'Konaklama',
  ulasim: 'Ulaşım', iletisim: 'İletişim', teknoloji_demirbas: 'Teknoloji/Demirbaş',
  giyim: 'Giyim', insaat_yapi: 'İnşaat/Yapı', temizlik_sarf: 'Temizlik/Sarf',
  hizmet: 'Hizmet', arac: 'Araç', diger: 'Diğer',
};

export const ReceiptPanel = ({ sessionId, receipt, onApprove, onRetry, onDelete, onAsk, onClose }) => {
  const [zoomOpen, setZoomOpen] = useState(false);
  const [showThinking, setShowThinking] = useState(false);

  if (!receipt) {
    return (
      <Card className="lg:sticky lg:top-24 shadow-[var(--shadow-soft)]" data-testid="receipt-preview-panel">
        <CardContent className="p-10 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-secondary flex items-center justify-center mb-4">
            <MousePointerClick className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium">Fiş fotoğrafını görmek için</p>
          <p className="text-sm text-muted-foreground mt-1">tablodan bir satıra tıklayın. Fotoğraf ile tabloyu karşılaştırıp hataları düzeltebilirsiniz.</p>
        </CardContent>
      </Card>
    );
  }

  const imageUrl = receipt.hasImage
    ? `${API_BASE}/sessions/${sessionId}/receipts/${receipt.id}/image`
    : null;
  const busy = receipt.status === 'isleniyor' || receipt.status === 'bekliyor';

  return (
    <Card className="lg:sticky lg:top-24 shadow-[var(--shadow-soft)]" data-testid="receipt-preview-panel">
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="min-w-0">
          <CardTitle className="font-heading text-base truncate" title={receipt.fileName}>
            {receipt.fileName}
          </CardTitle>
          <div className="mt-1.5">
            <StatusBadge status={receipt.status} />
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0"
          onClick={onClose}
          data-testid="close-receipt-preview"
          aria-label="Paneli kapat"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {receipt.aiNote && (
          <p className="text-xs rounded-lg border border-sky-200 bg-sky-50 text-sky-800 px-3 py-2" data-testid="receipt-ai-note">
            {receipt.aiNote}
          </p>
        )}
        {imageUrl ? (
          <button
            type="button"
            onClick={() => setZoomOpen(true)}
            className="relative w-full group rounded-lg overflow-hidden border focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200"
            aria-label="Fotoğrafı büyüt"
          >
            <img
              src={imageUrl}
              alt={`Fiş: ${receipt.fileName}`}
              data-testid="receipt-preview-image"
              className="w-full max-h-[420px] object-contain bg-slate-100"
            />
            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-slate-900/70 text-white text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
              <ZoomIn className="h-3 w-3" />
              Büyüt
            </span>
          </button>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
            <ImageOff className="h-6 w-6 mx-auto mb-2" />
            Görsel henüz hazır değil
          </div>
        )}

        {receipt.status === 'kontrol_gerekli' && receipt.reviewReasons?.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3" data-testid="review-reasons-box">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Bu fişte tutarsızlık var. Lütfen kontrol edip düzeltin.
            </p>
            <ul className="mt-2 space-y-1 text-xs text-amber-800/90 list-disc list-inside">
              {receipt.reviewReasons.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          </div>
        )}

        {receipt.isDuplicate && (
          <div className="rounded-lg border border-orange-300 bg-orange-50 p-3 text-xs text-orange-800 flex items-start gap-2" data-testid="panel-duplicate-note">
            <Copy className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Bu fiş, <strong>{receipt.duplicateOf}</strong> dosyasıyla aynı görünüyor (mükerrer olabilir).
            </span>
          </div>
        )}

        {receipt.error && (
          <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">{receipt.error}</div>
        )}

        {receipt.data && (
          <>
            <Separator />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {receipt.data.belge_turu && (
                <>
                  <dt className="text-muted-foreground">Belge Türü</dt>
                  <dd className="text-right">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${receipt.data.belge_turu === 'dekont' ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'}`}>
                      <FileText className="h-3 w-3" />
                      {DOC_TYPE_LABELS[receipt.data.belge_turu] || receipt.data.belge_turu}
                    </span>
                  </dd>
                </>
              )}
              <dt className="text-muted-foreground">Tarih</dt>
              <dd className="font-medium text-right tabular-nums">{formatDateTr(receipt.data.tarih)}</dd>
              <dt className="text-muted-foreground">Firma</dt>
              <dd className="font-medium text-right truncate" title={receipt.data.firma_unvani || ''}>
                {receipt.data.firma_unvani || '—'}
              </dd>
              {receipt.data.gider_kategorisi && (
                <>
                  <dt className="text-muted-foreground">Harcama Türü</dt>
                  <dd className="text-right">
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700">
                      {CATEGORY_LABELS[receipt.data.gider_kategorisi] || receipt.data.gider_kategorisi}
                    </span>
                  </dd>
                </>
              )}
              <dt className="text-muted-foreground">Vergi Dairesi</dt>
              <dd className="font-medium text-right truncate">{receipt.data.vergi_dairesi || '—'}</dd>
              <dt className="text-muted-foreground">Toplam</dt>
              <dd className="font-semibold text-right tabular-nums">{formatCurrency(receipt.data.toplam)} TL</dd>
              {receipt.data.tevkifat > 0 && (
                <>
                  <dt className="text-muted-foreground">Tevkifat</dt>
                  <dd className="font-medium text-right tabular-nums text-orange-700">{formatCurrency(receipt.data.tevkifat)} TL</dd>
                </>
              )}
              <dt className="text-muted-foreground">Güven Skoru</dt>
              <dd className="font-medium text-right tabular-nums">{receipt.data.guven_skoru}/100</dd>
            </dl>
            
            {receipt.data._thinking && (
              <div className="mt-3 rounded-lg border bg-slate-50 p-2.5">
                <button
                  type="button"
                  onClick={() => setShowThinking(!showThinking)}
                  className="flex items-center justify-between w-full text-xs font-semibold text-slate-700 hover:text-slate-900 focus:outline-none"
                >
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    Yapay Zekâ Düşünme Adımları
                  </span>
                  <span className="text-[10px] text-muted-foreground underline">
                    {showThinking ? 'Gizle' : 'Göster'}
                  </span>
                </button>
                {showThinking && (
                  <pre className="mt-2 text-[11px] font-mono-nums text-slate-600 bg-white border rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-40">
                    {receipt.data._thinking}
                  </pre>
                )}
              </div>
            )}
          </>
        )}

        <Separator />
        <div className="flex flex-col gap-2">
          {receipt.status === 'kontrol_gerekli' && (
            <Button
              onClick={() => onApprove(receipt.id)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
              data-testid="approve-receipt-button"
            >
              <CheckCheck className="h-4 w-4 mr-1.5" />
              Kontrol Ettim, Onayla
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onRetry(receipt.id)}
            disabled={busy}
            className="w-full"
            data-testid="reread-receipt-button"
          >
            <RotateCcw className="h-4 w-4 mr-1.5" />
            Yapay Zekâ ile Yeniden Oku
          </Button>
          {onAsk && (
            <Button
              variant="outline"
              onClick={() => onAsk(receipt.id)}
              className="w-full border-violet-300 text-violet-700 hover:bg-violet-50"
              data-testid="ask-ai-receipt-button"
            >
              <MessageSquare className="h-4 w-4 mr-1.5" />
              Bu Fişe Yapay Zekâya Danış
            </Button>
          )}
        </div>
      </CardContent>

      {/* Tam ekran fotoğraf büyütme */}
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-4xl p-2">
          <DialogTitle className="sr-only">Fiş fotoğrafı büyütülmüş görünüm</DialogTitle>
          {imageUrl && (
            <img src={imageUrl} alt="Fiş büyütülmüş" className="w-full max-h-[85vh] object-contain rounded" />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};
