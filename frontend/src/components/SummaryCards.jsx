// KDV özet kartları + ay filtresi + mükerrer fiş uyarısı
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarDays, CopyX, Wallet, Percent } from 'lucide-react';
import { formatCurrency, monthLabel, flattenKdv } from '@/lib/format';
import { cn } from '@/lib/utils';

const RATE_STYLES = {
  1: { chip: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  10: { chip: 'bg-sky-50 text-sky-800 border-sky-200' },
  20: { chip: 'bg-amber-50 text-amber-900 border-amber-200' },
};

export const SummaryCards = ({ receipts, months, monthFilter, onMonthChange }) => {
  // Filtrelenmiş fişlerden KDV toplamlarını hesapla
  const totals = { 1: { matrah: 0, kdv: 0 }, 10: { matrah: 0, kdv: 0 }, 20: { matrah: 0, kdv: 0 } };
  let grandTotal = 0;
  for (const r of receipts) {
    const flat = flattenKdv(r.data);
    totals[1].matrah += flat.m1;
    totals[1].kdv += flat.k1;
    totals[10].matrah += flat.m10;
    totals[10].kdv += flat.k10;
    totals[20].matrah += flat.m20;
    totals[20].kdv += flat.k20;
    grandTotal += r.data?.toplam || 0;
  }
  const reviewCount = receipts.filter((r) => r.status === 'kontrol_gerekli').length;
  const duplicates = receipts.filter((r) => r.isDuplicate);

  return (
    <section className="space-y-4" aria-label="Sonuç özeti">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl md:text-2xl font-semibold">Sonuçlar</h2>
          <p className="text-sm text-muted-foreground mt-1" data-testid="batch-summary-text">
            {receipts.length} fiş gösteriliyor
            {reviewCount > 0 && <span className="text-amber-700 font-medium"> • {reviewCount} fiş kontrol gerektiriyor</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <Select value={monthFilter} onValueChange={onMonthChange}>
            <SelectTrigger className="w-[190px] h-11" data-testid="month-filter-control">
              <SelectValue placeholder="Ay seçin" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="month-option-all">
                Tüm Aylar
              </SelectItem>
              {months.map((m) => (
                <SelectItem key={m} value={m} data-testid={`month-option-${m}`}>
                  {monthLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {duplicates.length > 0 && (
        <Alert className="border-orange-300 bg-orange-50 text-orange-900" data-testid="duplicate-receipt-warning">
          <CopyX className="h-4 w-4 !text-orange-600" />
          <AlertTitle>Mükerrer fiş uyarısı</AlertTitle>
          <AlertDescription className="text-orange-800/90">
            {duplicates.length} fiş, listedeki başka bir fişle aynı görünüyor (aynı firma, tarih, tutar ve fiş no).
            Tabloda “Mükerrer” etiketiyle işaretlendi — gerekirse satırı silebilirsiniz.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 10, 20].map((rate) => (
          <Card key={rate} className="shadow-[var(--shadow-soft)]" data-testid={`kdv-summary-card-${rate}`}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold',
                    RATE_STYLES[rate].chip
                  )}
                >
                  <Percent className="h-3 w-3" />
                  KDV %{rate}
                </span>
              </div>
              <dl className="mt-4 space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <dt className="text-xs text-muted-foreground">Matrah</dt>
                  <dd className="text-sm font-semibold tabular-nums">{formatCurrency(totals[rate].matrah)} TL</dd>
                </div>
                <div className="flex items-baseline justify-between">
                  <dt className="text-xs text-muted-foreground">KDV</dt>
                  <dd className="text-sm font-semibold tabular-nums">{formatCurrency(totals[rate].kdv)} TL</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        ))}
        <Card className="shadow-[var(--shadow-soft)] bg-primary text-primary-foreground" data-testid="grand-total-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-1.5 text-xs font-semibold opacity-90">
              <Wallet className="h-3.5 w-3.5" />
              GENEL TOPLAM
            </div>
            <p className="mt-3 text-2xl font-bold tabular-nums font-heading">{formatCurrency(grandTotal)} TL</p>
            <p className="text-xs opacity-80 mt-1">{receipts.length} fiş</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
};
