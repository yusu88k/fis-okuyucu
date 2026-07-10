// Durum rozeti: ikon + metin (sadece renge dayanmaz, erişilebilirlik)
import { Clock, Loader2, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export const STATUS_META = {
  bekliyor: { label: 'Bekliyor', className: 'bg-slate-100 text-slate-700 border-slate-200', Icon: Clock },
  isleniyor: { label: 'İşleniyor', className: 'bg-sky-50 text-sky-800 border-sky-200', Icon: Loader2, spin: true },
  tamam: { label: 'Tamam', className: 'bg-emerald-50 text-emerald-800 border-emerald-200', Icon: CheckCircle2 },
  kontrol_gerekli: { label: 'Kontrol Gerekli', className: 'bg-amber-50 text-amber-900 border-amber-300', Icon: AlertTriangle },
  hata: { label: 'Hata', className: 'bg-rose-50 text-rose-800 border-rose-200', Icon: XCircle },
};

export const StatusBadge = ({ status, className }) => {
  const meta = STATUS_META[status] || STATUS_META.bekliyor;
  const { Icon } = meta;
  return (
    <span
      data-testid="receipt-status-badge"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap',
        meta.className,
        className
      )}
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0', meta.spin && 'animate-spin')} />
      {meta.label}
    </span>
  );
};
