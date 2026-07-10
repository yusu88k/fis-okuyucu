import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDateTr, flattenKdv } from '@/lib/format';
import { Eye, FileSpreadsheet, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const ExcelPreviewDialog = ({ open, onOpenChange, receipts, onExport }) => {
  // Matrah & Toplam hesaplamaları
  const rows = useMemo(() => {
    const list = receipts.filter((r) => r.data && r.data.toplam !== null);
    return [...list].sort((a, b) => (a.data.tarih || '').localeCompare(b.data.tarih || ''));
  }, [receipts]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        const flat = flattenKdv(r.data);
        acc.m1 += flat.m1; acc.k1 += flat.k1;
        acc.m10 += flat.m10; acc.k10 += flat.k10;
        acc.m20 += flat.m20; acc.k20 += flat.k20;
        acc.toplam += r.data.toplam || 0;
        return acc;
      },
      { m1: 0, k1: 0, m10: 0, k10: 0, m20: 0, k20: 0, toplam: 0 }
    );
  }, [rows]);

  // Aylık Özet verilerini hesaplama
  const monthlySummary = useMemo(() => {
    const monthlyMap = new Map();
    
    rows.forEach((r) => {
      const dateStr = r.data.tarih || '';
      const key = dateStr.slice(0, 7) || 'bilinmiyor';
      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, { count: 0, m1: 0, k1: 0, m10: 0, k10: 0, m20: 0, k20: 0, toplam: 0 });
      }
      const agg = monthlyMap.get(key);
      const flat = flattenKdv(r.data);
      agg.count += 1;
      agg.m1 += flat.m1; agg.k1 += flat.k1;
      agg.m10 += flat.m10; agg.k10 += flat.k10;
      agg.m20 += flat.m20; agg.k20 += flat.k20;
      agg.toplam += r.data.toplam || 0;
    });

    const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    
    return [...monthlyMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, agg]) => {
        let label = 'Bilinmiyor';
        if (key !== 'bilinmiyor') {
          const [year, month] = key.split('-');
          const idx = parseInt(month, 10) - 1;
          label = `${MONTHS_TR[idx] || key} ${year}`;
        }
        return {
          key,
          label,
          count: agg.count,
          m1: agg.m1, k1: agg.k1,
          m10: agg.m10, k10: agg.k10,
          m20: agg.m20, k20: agg.k20,
          kdvToplam: agg.k1 + agg.k10 + agg.k20,
          toplam: agg.toplam
        };
      });
  }, [rows]);

  const monthlyTotals = useMemo(() => {
    return monthlySummary.reduce(
      (acc, m) => {
        acc.count += m.count;
        acc.m1 += m.m1; acc.k1 += m.k1;
        acc.m10 += m.m10; acc.k10 += m.k10;
        acc.m20 += m.m20; acc.k20 += m.k20;
        acc.kdvToplam += m.kdvToplam;
        acc.toplam += m.toplam;
        return acc;
      },
      { count: 0, m1: 0, k1: 0, m10: 0, k10: 0, m20: 0, k20: 0, kdvToplam: 0, toplam: 0 }
    );
  }, [monthlySummary]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] lg:max-w-6xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            <DialogTitle className="font-heading text-lg font-bold">Canlı Excel Dosyası Önizlemesi</DialogTitle>
          </div>
          <Button onClick={onExport} size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white mr-6">
            <Download className="h-4 w-4 mr-1.5" />
            Excel Olarak İndir
          </Button>
        </DialogHeader>

        <Tabs defaultValue="sheet-receipts" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-4">
            <TabsTrigger value="sheet-receipts" className="text-xs sm:text-sm">Fişler (Sayfa 1)</TabsTrigger>
            <TabsTrigger value="sheet-summary" className="text-xs sm:text-sm">Aylık Özet (Sayfa 2)</TabsTrigger>
          </TabsList>

          <TabsContent value="sheet-receipts" className="flex-1 overflow-auto border rounded-lg bg-white relative">
            <Table className="min-w-[1200px] border-collapse text-xs">
              <TableHeader className="bg-slate-50 sticky top-0 shadow-sm z-10">
                <TableRow>
                  <TableHead className="border border-slate-200 w-[100px]">Tarih</TableHead>
                  <TableHead className="border border-slate-200 w-[200px]">Firma</TableHead>
                  <TableHead className="border border-slate-200 w-[120px]">Vergi No</TableHead>
                  <TableHead className="border border-slate-200 w-[100px]">Fiş No</TableHead>
                  <TableHead className="border border-slate-200 text-right w-[100px]">%1 Matrah</TableHead>
                  <TableHead className="border border-slate-200 text-right w-[90px]">%1 KDV</TableHead>
                  <TableHead className="border border-slate-200 text-right w-[100px]">%10 Matrah</TableHead>
                  <TableHead className="border border-slate-200 text-right w-[90px]">%10 KDV</TableHead>
                  <TableHead className="border border-slate-200 text-right w-[100px]">%20 Matrah</TableHead>
                  <TableHead className="border border-slate-200 text-right w-[90px]">%20 KDV</TableHead>
                  <TableHead className="border border-slate-200 text-right w-[110px]">Toplam</TableHead>
                  <TableHead className="border border-slate-200 w-[110px]">Ödeme Türü</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => {
                  const flat = flattenKdv(r.data);
                  return (
                    <TableRow key={r.id} className={i % 2 === 1 ? 'bg-slate-50/40' : ''}>
                      <TableCell className="border border-slate-200 py-2 font-mono-nums">{formatDateTr(r.data.tarih)}</TableCell>
                      <TableCell className="border border-slate-200 py-2 font-semibold text-slate-700 truncate max-w-[200px]" title={r.data.firma_unvani}>
                        {r.data.firma_unvani || '—'}
                      </TableCell>
                      <TableCell className="border border-slate-200 py-2 font-mono-nums">{r.data.vergi_no || '—'}</TableCell>
                      <TableCell className="border border-slate-200 py-2 font-mono-nums">{r.data.fis_no || '—'}</TableCell>
                      <TableCell className="border border-slate-200 py-2 text-right font-mono-nums">{flat.m1 ? formatCurrency(flat.m1) : '—'}</TableCell>
                      <TableCell className="border border-slate-200 py-2 text-right font-mono-nums">{flat.k1 ? formatCurrency(flat.k1) : '—'}</TableCell>
                      <TableCell className="border border-slate-200 py-2 text-right font-mono-nums">{flat.m10 ? formatCurrency(flat.m10) : '—'}</TableCell>
                      <TableCell className="border border-slate-200 py-2 text-right font-mono-nums">{flat.k10 ? formatCurrency(flat.k10) : '—'}</TableCell>
                      <TableCell className="border border-slate-200 py-2 text-right font-mono-nums">{flat.m20 ? formatCurrency(flat.m20) : '—'}</TableCell>
                      <TableCell className="border border-slate-200 py-2 text-right font-mono-nums">{flat.k20 ? formatCurrency(flat.k20) : '—'}</TableCell>
                      <TableCell className="border border-slate-200 py-2 text-right font-mono-nums font-semibold">{formatCurrency(r.data.toplam)}</TableCell>
                      <TableCell className="border border-slate-200 py-2">
                        {r.data.odeme_turu === 'nakit' ? 'Nakit' : r.data.odeme_turu === 'kredi_karti' ? 'Kredi Kartı' : 'Bilinmiyor'}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {rows.length > 0 && (
                  <TableRow className="bg-emerald-50/60 font-bold border-t-2 border-slate-300">
                    <TableCell className="border border-slate-200 py-2 text-emerald-900" colSpan={4}>TOPLAM</TableCell>
                    <TableCell className="border border-slate-200 py-2 text-right font-mono-nums">{formatCurrency(totals.m1)}</TableCell>
                    <TableCell className="border border-slate-200 py-2 text-right font-mono-nums">{formatCurrency(totals.k1)}</TableCell>
                    <TableCell className="border border-slate-200 py-2 text-right font-mono-nums">{formatCurrency(totals.m10)}</TableCell>
                    <TableCell className="border border-slate-200 py-2 text-right font-mono-nums">{formatCurrency(totals.k10)}</TableCell>
                    <TableCell className="border border-slate-200 py-2 text-right font-mono-nums">{formatCurrency(totals.m20)}</TableCell>
                    <TableCell className="border border-slate-200 py-2 text-right font-mono-nums">{formatCurrency(totals.k20)}</TableCell>
                    <TableCell className="border border-slate-200 py-2 text-right font-mono-nums text-emerald-900">{formatCurrency(totals.toplam)}</TableCell>
                    <TableCell className="border border-slate-200 py-2" />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="sheet-summary" className="flex-1 overflow-auto border rounded-lg bg-white relative">
            <Table className="min-w-[1000px] border-collapse text-xs">
              <TableHeader className="bg-slate-50 sticky top-0 shadow-sm z-10">
                <TableRow>
                  <TableHead className="border border-slate-200 w-[140px]">Ay</TableHead>
                  <TableHead className="border border-slate-200 w-[100px]">Fiş Adedi</TableHead>
                  <TableHead className="border border-slate-200 text-right w-[110px]">%1 Matrah</TableHead>
                  <TableHead className="border border-slate-200 text-right w-[100px]">%1 KDV</TableHead>
                  <TableHead className="border border-slate-200 text-right w-[110px]">%10 Matrah</TableHead>
                  <TableHead className="border border-slate-200 text-right w-[100px]">%10 KDV</TableHead>
                  <TableHead className="border border-slate-200 text-right w-[110px]">%20 Matrah</TableHead>
                  <TableHead className="border border-slate-200 text-right w-[100px]">%20 KDV</TableHead>
                  <TableHead className="border border-slate-200 text-right w-[110px]">Toplam KDV</TableHead>
                  <TableHead className="border border-slate-200 text-right w-[130px]">Genel Toplam</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlySummary.map((m, i) => (
                  <TableRow key={m.key} className={i % 2 === 1 ? 'bg-slate-50/40' : ''}>
                    <TableCell className="border border-slate-200 py-2.5 font-semibold text-slate-700">{m.label}</TableCell>
                    <TableCell className="border border-slate-200 py-2.5 font-mono-nums">{m.count}</TableCell>
                    <TableCell className="border border-slate-200 py-2.5 text-right font-mono-nums">{m.m1 ? formatCurrency(m.m1) : '—'}</TableCell>
                    <TableCell className="border border-slate-200 py-2.5 text-right font-mono-nums">{m.k1 ? formatCurrency(m.k1) : '—'}</TableCell>
                    <TableCell className="border border-slate-200 py-2.5 text-right font-mono-nums">{m.m10 ? formatCurrency(m.m10) : '—'}</TableCell>
                    <TableCell className="border border-slate-200 py-2.5 text-right font-mono-nums">{m.k10 ? formatCurrency(m.k10) : '—'}</TableCell>
                    <TableCell className="border border-slate-200 py-2.5 text-right font-mono-nums">{m.m20 ? formatCurrency(m.m20) : '—'}</TableCell>
                    <TableCell className="border border-slate-200 py-2.5 text-right font-mono-nums">{m.k20 ? formatCurrency(m.k20) : '—'}</TableCell>
                    <TableCell className="border border-slate-200 py-2.5 text-right font-mono-nums font-semibold text-slate-600">{formatCurrency(m.kdvToplam)}</TableCell>
                    <TableCell className="border border-slate-200 py-2.5 text-right font-mono-nums font-bold text-slate-800">{formatCurrency(m.toplam)}</TableCell>
                  </TableRow>
                ))}
                {monthlySummary.length > 0 && (
                  <TableRow className="bg-emerald-50/60 font-bold border-t-2 border-slate-300">
                    <TableCell className="border border-slate-200 py-2.5 text-emerald-900">TOPLAM</TableCell>
                    <TableCell className="border border-slate-200 py-2.5 font-mono-nums">{monthlyTotals.count}</TableCell>
                    <TableCell className="border border-slate-200 py-2.5 text-right font-mono-nums">{formatCurrency(monthlyTotals.m1)}</TableCell>
                    <TableCell className="border border-slate-200 py-2.5 text-right font-mono-nums">{formatCurrency(monthlyTotals.k1)}</TableCell>
                    <TableCell className="border border-slate-200 py-2.5 text-right font-mono-nums">{formatCurrency(monthlyTotals.m10)}</TableCell>
                    <TableCell className="border border-slate-200 py-2.5 text-right font-mono-nums">{formatCurrency(monthlyTotals.k10)}</TableCell>
                    <TableCell className="border border-slate-200 py-2.5 text-right font-mono-nums">{formatCurrency(monthlyTotals.m20)}</TableCell>
                    <TableCell className="border border-slate-200 py-2.5 text-right font-mono-nums">{formatCurrency(monthlyTotals.k20)}</TableCell>
                    <TableCell className="border border-slate-200 py-2.5 text-right font-mono-nums text-slate-700">{formatCurrency(monthlyTotals.kdvToplam)}</TableCell>
                    <TableCell className="border border-slate-200 py-2.5 text-right font-mono-nums text-emerald-900">{formatCurrency(monthlyTotals.toplam)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
