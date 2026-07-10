// Admin paneli: ziyaretçi cihaz bilgileri + kullanım istatistikleri + maliyet analizi.
// Kayıt/üyelik yoktur; kullanıcılar direkt girer, cihaz bilgileri sessizce toplanır.
// Bu panel şifre ile korunur ve sayfada #admin adresiyle açılır.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, apiErrorMessage } from '@/lib/api';
import { toast } from 'sonner';
import {
  ShieldCheck, LogOut, RefreshCw, Trash2, X, Users, Activity,
  Upload, FileText, Download, MessageSquare, Lock, Loader2, Monitor, DollarSign,
  Cpu, AlertTriangle, TrendingUp, Search, FileDown, Clock, Plus,
} from 'lucide-react';

const TOKEN_KEY = 'admin_token';

// USD'yi 4 haneli göster (küçük tutarlar için); binlik ayraç
function formatUsd(v) {
  const n = Number(v) || 0;
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: n < 1 ? 4 : 2, maximumFractionDigits: 4 });
}

function formatTokens(v) {
  const n = Number(v) || 0;
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function formatDate(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

// "5 dakika önce" gibi göreli zaman
function relativeTime(ts) {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  const dk = Math.floor(diff / 60000);
  if (dk < 1) return 'az önce';
  if (dk < 60) return `${dk} dk önce`;
  const sa = Math.floor(dk / 60);
  if (sa < 24) return `${sa} saat önce`;
  return `${Math.floor(sa / 24)} gün önce`;
}

// Kısa tarih etiketi (grafik ekseni için): "10.07"
function shortDay(dateStr) {
  const [, m, d] = String(dateStr).split('-');
  return `${d}.${m}`;
}

// Aktivite log türü -> ikon + renk
const LOG_STYLE = {
  sessions: { icon: Activity, color: 'text-slate-500' },
  uploads: { icon: Upload, color: 'text-blue-600' },
  exports: { icon: Download, color: 'text-emerald-600' },
  chats: { icon: MessageSquare, color: 'text-violet-600' },
  deletes: { icon: Trash2, color: 'text-rose-600' },
  errors: { icon: AlertTriangle, color: 'text-amber-600' },
  clients: { icon: Users, color: 'text-indigo-600' },
  imports: { icon: FileText, color: 'text-sky-600' },
  manualRows: { icon: Plus, color: 'text-teal-600' },
};

const STAT_CARDS = [
  { key: 'visitors', label: 'Ziyaretçi', icon: Users },
  { key: 'activeNow', label: 'Şu An Aktif', icon: Activity },
  { key: 'uploads', label: 'Yükleme', icon: Upload },
  { key: 'receipts', label: 'Fiş', icon: FileText },
  { key: 'exports', label: 'Excel İndirme', icon: Download },
  { key: 'chats', label: 'Sohbet', icon: MessageSquare },
];

// Günlük bar grafiği (inline SVG, bağımlılıksız). data: [{date, value}]
function DailyBars({ data, color = '#3b82f6', label }) {
  if (!data || data.length === 0) {
    return <div className="text-xs text-muted-foreground py-8 text-center">Henüz veri yok.</div>;
  }
  const max = Math.max(...data.map((d) => d.value), 1);
  const W = 100; // viewBox genişliği (yüzde bazlı, responsive)
  const gap = 1.5;
  const bw = (W - gap * (data.length - 1)) / data.length;
  return (
    <svg viewBox={`0 0 ${W} 42`} className="w-full h-28" preserveAspectRatio="none" role="img" aria-label={label}>
      {data.map((d, i) => {
        const h = (d.value / max) * 36;
        const x = i * (bw + gap);
        return (
          <g key={d.date}>
            <rect x={x} y={40 - h} width={bw} height={Math.max(h, 0.4)} rx={0.6} fill={color}>
              <title>{`${d.date}: ${d.title ?? d.value}`}</title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
}

// Model bazlı yatay maliyet çubukları
function ModelCostBars({ rows }) {
  if (!rows || rows.length === 0) {
    return <div className="text-xs text-muted-foreground py-6 text-center">Henüz yapay zekâ çağrısı yapılmadı.</div>;
  }
  const max = Math.max(...rows.map((r) => r.usd), 0.000001);
  const palette = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={r.model}>
          <div className="flex items-center justify-between text-xs mb-0.5">
            <span className="font-medium truncate max-w-[60%]" title={r.model}>{r.model}</span>
            <span className="tabular-nums text-muted-foreground">
              {formatUsd(r.usd)} · {r.calls} çağrı · {formatTokens((r.tokensIn || 0) + (r.tokensOut || 0))} tk
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max((r.usd / max) * 100, 2)}%`, backgroundColor: palette[i % palette.length] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export const AdminPanel = ({ onClose }) => {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '');
  const [password, setPassword] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');

  const loadOverview = useCallback(async (tkn) => {
    const t = tkn || token;
    if (!t) return;
    setLoading(true);
    try {
      const res = await api.get('/admin/overview', { headers: { Authorization: `Bearer ${t}` } });
      setData(res.data);
    } catch (err) {
      if (err?.response?.status === 401) {
        // Token süresi dolmuş veya geçersiz -> tekrar giriş
        sessionStorage.removeItem(TOKEN_KEY);
        setToken('');
        setData(null);
      } else {
        toast.error(apiErrorMessage(err, 'Veriler yüklenemedi.'));
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) loadOverview(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Panel açıkken 15 sn'de bir otomatik tazele (canlı görünüm)
  useEffect(() => {
    if (!token) return undefined;
    const timer = setInterval(() => loadOverview(token), 15000);
    return () => clearInterval(timer);
  }, [token, loadOverview]);

  const handleLogin = async (e) => {
    e?.preventDefault();
    if (!password.trim()) return;
    setLoggingIn(true);
    try {
      const res = await api.post('/admin/login', { password });
      sessionStorage.setItem(TOKEN_KEY, res.data.token);
      setToken(res.data.token);
      setPassword('');
      await loadOverview(res.data.token);
      toast.success('Admin girişi başarılı.');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Giriş başarısız.'));
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken('');
    setData(null);
  };

  const handleDeleteVisitor = async (vid) => {
    try {
      await api.delete(`/admin/visitors/${vid}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Ziyaretçi kaydı silindi.');
      loadOverview(token);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Silinemedi.'));
    }
  };

  const totals = data?.totals || {};
  const allVisitors = useMemo(() => data?.visitors || [], [data]);
  const daily = data?.daily || [];
  const logs = data?.logs || [];
  const costByModel = useMemo(() => data?.costByModel || [], [data]);

  // Ziyaretçi arama (tarayıcı/os/ip/dil)
  const visitors = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allVisitors;
    return allVisitors.filter((v) =>
      [v.browser, v.os, v.device, v.ip, v.language, v.timezone, v.platform]
        .filter(Boolean).some((x) => String(x).toLowerCase().includes(q))
    );
  }, [allVisitors, search]);

  // Ziyaretçileri CSV olarak indir
  const exportCsv = useCallback(() => {
    const head = ['ID', 'Tarayici', 'OS', 'Cihaz', 'IP', 'Dil', 'SaatDilimi', 'Yukleme', 'Fis', 'Excel', 'Sohbet', 'Maliyet_USD', 'IlkGorulme', 'SonAktivite'];
    const esc = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const lines = [head.join(',')];
    for (const v of visitors) {
      const c = v.counts || {};
      lines.push([
        v.id, v.browser, v.os, v.device, v.ip, v.language, v.timezone,
        c.uploads || 0, c.receipts || 0, c.exports || 0, c.chats || 0,
        (v.cost?.usd || 0).toFixed(6),
        v.firstSeen ? new Date(v.firstSeen).toISOString() : '',
        v.lastSeen ? new Date(v.lastSeen).toISOString() : '',
      ].map(esc).join(','));
    }
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ziyaretciler_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [visitors]);

  const totalCalls = useMemo(() => costByModel.reduce((s, m) => s + (m.calls || 0), 0), [costByModel]);

  // --- Giriş ekranı ---
  if (!token) {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4" data-testid="admin-login-overlay">
        <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                <Lock className="h-4 w-4" />
              </div>
              <h2 className="font-heading text-lg font-semibold">Admin Girişi</h2>
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onClose} aria-label="Kapat">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Bu alan yöneticilere özeldir. Devam etmek için şifreyi girin.
          </p>
          <form onSubmit={handleLogin} className="space-y-3">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin şifresi"
              autoFocus
              data-testid="admin-password-input"
            />
            <Button type="submit" disabled={loggingIn || !password.trim()} className="w-full" data-testid="admin-login-button">
              {loggingIn ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-1.5" />}
              Giriş Yap
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // --- Panel ---
  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 overflow-y-auto" data-testid="admin-panel">
      {/* Üst bar */}
      <div className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="max-w-[1200px] mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-heading text-lg font-semibold leading-tight">Admin Paneli</h1>
              <p className="text-xs text-muted-foreground">Ziyaretçi, kullanım ve maliyet analizi</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={() => loadOverview(token)} disabled={loading} className="h-8">
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Yenile
            </Button>
            <Button size="sm" variant="outline" onClick={handleLogout} className="h-8">
              <LogOut className="h-3.5 w-3.5 mr-1" />
              Çıkış
            </Button>
            <Button size="sm" onClick={onClose} className="h-8" data-testid="admin-close-button">
              <X className="h-3.5 w-3.5 mr-1" />
              Kapat
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 py-6 space-y-6">
        {/* Maliyet bannerı (tahmini yapay zekâ harcaması) */}
        <div className="rounded-2xl border bg-gradient-to-br from-slate-900 to-slate-700 text-white p-5 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-slate-300 text-xs mb-1">
                <DollarSign className="h-3.5 w-3.5" />
                Tahmini Yapay Zekâ Harcaması (toplam)
              </div>
              <div className="text-4xl font-bold tabular-nums">{formatUsd(totals.costUsd)}</div>
              <div className="text-xs text-slate-300 mt-1">
                {formatTokens(totals.tokensIn)} giriş + {formatTokens(totals.tokensOut)} çıkış token · {totalCalls} çağrı
              </div>
            </div>
            {/* Türetilmiş metrikler */}
            <div className="flex gap-5">
              <div>
                <div className="text-[11px] text-slate-400 uppercase tracking-wide">Fiş başına ort.</div>
                <div className="text-xl font-semibold tabular-nums">{formatUsd(totals.avgCostPerReceipt)}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400 uppercase tracking-wide">Hata oranı</div>
                <div className="text-xl font-semibold tabular-nums">{(Number(totals.errorRate) || 0).toFixed(1)}%</div>
              </div>
            </div>
            <div className="text-xs text-slate-300 max-w-[240px] leading-relaxed">
              Bu bir <strong>tahmindir</strong> (token × model fiyatı). Kesin bakiye için sağlayıcı panelini kontrol edin:
              <br />Kimi → platform.moonshot.ai · Gemini → aistudio.google.com · NVIDIA → build.nvidia.com (bedava)
            </div>
          </div>
        </div>

        {/* Grafikler: günlük trend + model bazlı maliyet */}
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <h2 className="font-semibold text-sm">Günlük Fiş İşleme (son 30 gün)</h2>
            </div>
            <DailyBars data={daily.map((d) => ({ date: shortDay(d.date), value: d.receipts || 0, title: `${d.receipts || 0} fiş` }))} color="#3b82f6" label="Günlük fiş sayısı" />
            <div className="flex items-center gap-2 mt-3 mb-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <h3 className="font-semibold text-xs text-muted-foreground">Günlük Maliyet ($)</h3>
            </div>
            <DailyBars data={daily.map((d) => ({ date: shortDay(d.date), value: d.costUsd || 0, title: formatUsd(d.costUsd || 0) }))} color="#10b981" label="Günlük maliyet" />
          </div>

          <div className="rounded-xl bg-white border shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="h-4 w-4 text-indigo-600" />
              <h2 className="font-semibold text-sm">Model Bazlı Maliyet</h2>
            </div>
            <ModelCostBars rows={costByModel} />
          </div>
        </div>

        {/* İstatistik kartları */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {STAT_CARDS.map(({ key, label, icon: Icon }) => (
            <div key={key} className="rounded-xl bg-white border p-4 shadow-sm">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1.5">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
              <div className="text-2xl font-semibold tabular-nums">{totals[key] ?? 0}</div>
            </div>
          ))}
        </div>

        {/* Ziyaretçi tablosu */}
        <div className="rounded-xl bg-white border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2 flex-wrap">
            <Monitor className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Ziyaretçiler ({visitors.length})</h2>
            <div className="flex-1" />
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ara (tarayıcı, IP, dil...)"
                className="h-8 pl-8 w-56 text-sm"
                data-testid="admin-visitor-search"
              />
            </div>
            <Button size="sm" variant="outline" className="h-8" onClick={exportCsv} disabled={visitors.length === 0} data-testid="admin-csv-export">
              <FileDown className="h-3.5 w-3.5 mr-1" />
              CSV
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Cihaz / Tarayıcı</th>
                  <th className="px-3 py-2 font-medium">IP</th>
                  <th className="px-3 py-2 font-medium">Konum/Dil</th>
                  <th className="px-3 py-2 font-medium text-right">Yükleme</th>
                  <th className="px-3 py-2 font-medium text-right">Fiş</th>
                  <th className="px-3 py-2 font-medium text-right">Excel</th>
                  <th className="px-3 py-2 font-medium text-right">Sohbet</th>
                  <th className="px-3 py-2 font-medium text-right">Maliyet</th>
                  <th className="px-3 py-2 font-medium">İlk Görülme</th>
                  <th className="px-3 py-2 font-medium">Son Aktivite</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {visitors.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">
                      {allVisitors.length === 0 ? 'Henüz ziyaretçi kaydı yok.' : 'Aramayla eşleşen ziyaretçi yok.'}
                    </td>
                  </tr>
                )}
                {visitors.map((v) => {
                  const c = v.counts || {};
                  const aktif = Date.now() - v.lastSeen < 5 * 60 * 1000;
                  return (
                    <tr key={v.id} className="border-t hover:bg-slate-50/60">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          {aktif && <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" title="Aktif" />}
                          <span className="font-medium">{v.browser || '—'}</span>
                          <span className="text-muted-foreground text-xs">{v.os || ''} · {v.device || ''}</span>
                        </div>
                        {v.screen && <div className="text-[11px] text-muted-foreground mt-0.5">{v.screen} · {v.platform || ''}</div>}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-xs">{v.ip || '—'}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{v.timezone || '—'}<br />{v.language || ''}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.uploads || 0}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.receipts || 0}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.exports || 0}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.chats || 0}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium text-emerald-700">{formatUsd(v.cost?.usd || 0)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDate(v.firstSeen)}</td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap" title={formatDate(v.lastSeen)}>{relativeTime(v.lastSeen)}</td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-rose-500 hover:bg-rose-50"
                          onClick={() => handleDeleteVisitor(v.id)}
                          aria-label="Ziyaretçi kaydını sil"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Aktivite logu (son işlemler) */}
        <div className="rounded-xl bg-white border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Son Aktiviteler ({logs.length})</h2>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y">
            {logs.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">Henüz aktivite kaydı yok.</div>
            )}
            {logs.map((l, i) => {
              const st = LOG_STYLE[l.type] || { icon: Activity, color: 'text-slate-500' };
              const Icon = st.icon;
              return (
                <div key={i} className="px-4 py-2 flex items-center gap-3 text-sm hover:bg-slate-50/60">
                  <Icon className={`h-4 w-4 shrink-0 ${st.color}`} />
                  <span className="flex-1 min-w-0">
                    <span className="text-slate-700">{l.text}</span>
                    {(l.browser || l.device) && (
                      <span className="text-muted-foreground text-xs"> · {l.browser || ''}{l.device ? ` (${l.device})` : ''}</span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground whitespace-nowrap" title={formatDate(l.ts)}>{relativeTime(l.ts)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          Kayıt/üyelik sistemi yoktur. Kullanıcılar doğrudan girer; cihaz bilgileri istatistik amacıyla otomatik toplanır.
        </p>
      </div>
    </div>
  );
};
