// Ana uygulama: yükleme -> canlı işleme -> düzenlenebilir tablo -> Excel export
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '@/App.css';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { TopBar } from '@/components/TopBar';
import { UploadZone } from '@/components/UploadZone';
import { ProcessingList } from '@/components/ProcessingList';
import { SummaryCards } from '@/components/SummaryCards';
import { ResultsTable } from '@/components/ResultsTable';
import { ReceiptPanel } from '@/components/ReceiptPanel';
import { SettingsSheet } from '@/components/SettingsSheet';
import { ChatPanel } from '@/components/ChatPanel';
import { DeletedReceipts } from '@/components/DeletedReceipts';
import { SkippedReceipts } from '@/components/SkippedReceipts';
import { AdminPanel } from '@/components/AdminPanel';
import { ExcelPreviewDialog } from '@/components/ExcelPreviewDialog';
import { SheetPickerDialog } from '@/components/SheetPickerDialog';
import { BackendWaking } from '@/components/BackendWaking';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, FileUp, Plus, Loader2, Image as ImageIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

const ALLOWED_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;
const MAX_FILES = 200;
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

export default function App() {
  const [sessionId, setSessionId] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [trash, setTrash] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [monthFilter, setMonthFilter] = useState('all');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [askNonce, setAskNonce] = useState(0);
  const [uploading, setUploading] = useState(false);
  // Backend hazır mı? (Render ücretsiz plan uyandığında cold-start ~50sn — bekleme ekranı gösterilir)
  const [backendReady, setBackendReady] = useState(false);
  const [showWaking, setShowWaking] = useState(false);
  const [wakeElapsed, setWakeElapsed] = useState(0);
  const [sheetPick, setSheetPick] = useState(null); // { file, sheets, suggested } — çok sekmeli Excel seçici
  const [excelPreviewOpen, setExcelPreviewOpen] = useState(false);
  const [diagnostics, setDiagnostics] = useState(null);
  const [dismissDiagnostics, setDismissDiagnostics] = useState(false);
  const [checkingDiagnostics, setCheckingDiagnostics] = useState(false);
  // Görünüm modu: 'panel' (yükleme odaklı) veya 'excel' (tam ekran tablo)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('view_mode') || 'panel');
  const [previewOpen, setPreviewOpen] = useState(false);
  // Admin paneli: sayfada #admin adresiyle açılır (kayıt yok, şifreyle korunur)
  const [adminOpen, setAdminOpen] = useState(() => window.location.hash === '#admin');
  const wasActiveRef = useRef(false);
  const panelRef = useRef(null);
  const excelFileInputRef = useRef(null);
  const excelImportInputRef = useRef(null);
  const providerSwitchNotified = useRef(false);

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem('view_mode', mode);
  };

  const checkDiagnostics = useCallback(async () => {
    setCheckingDiagnostics(true);
    try {
      const { data } = await api.get('/diagnostics');
      setDiagnostics(data);
      if (!data.apiKeyValid) {
        toast.error('API anahtarı doğrulanamadı! Fiş okuma çalışmayabilir.');
      }
    } catch (err) {
      console.error('Diagnostics check failed', err);
      setDiagnostics({
        apiKeyPresent: false,
        apiKeyValid: false,
        error: 'Backend sunucusuna bağlanılamıyor veya API doğrulaması başarısız.',
      });
    } finally {
      setCheckingDiagnostics(false);
    }
  }, []);

  useEffect(() => {
    checkDiagnostics();
  }, [checkDiagnostics]);

  // Sayfa açılışında ziyaretçinin cihaz bilgisini bir kez gönder (admin istatistikleri)
  useEffect(() => {
    const info = {
      screen: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      language: navigator.language || null,
      platform: navigator.userAgentData?.platform || navigator.platform || null,
    };
    api.post('/visit', info).catch(() => {});
  }, []);

  // #admin hash'i ile admin panelini aç/kapat (tarayıcı geri/ileri ve manuel değişim)
  useEffect(() => {
    const onHash = () => setAdminOpen(window.location.hash === '#admin');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const closeAdmin = () => {
    setAdminOpen(false);
    if (window.location.hash === '#admin') {
      // Hash'i temizle (geçmişe yeni kayıt eklemeden)
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  };

  const isActive = receipts.some((r) => r.status === 'bekliyor' || r.status === 'isleniyor');

  // Durumu sunucudan çek (polling)
  const refresh = useCallback(
    async (sid) => {
      const id = sid || sessionId;
      if (!id) return;
      try {
        const { data } = await api.get(`/sessions/${id}`);
        setReceipts(data.receipts);
        setSummary(data.summary);
        setTrash(data.trash || []);
      } catch (err) {
        if (err?.response?.status === 404) {
          // Oturum sunucuda temizlenmiş (TTL) -> baştan başla
          setSessionId(null);
          setReceipts([]);
          setSummary(null);
          setSelectedId(null);
        }
      }
    },
    [sessionId]
  );

  // İşlem sürerken 1.5 saniyede bir canlı durum güncelle
  useEffect(() => {
    if (!sessionId || !isActive) return undefined;
    const timer = setInterval(() => refresh(), 1500);
    return () => clearInterval(timer);
  }, [sessionId, isActive, refresh]);

  // Backend sağlık kontrolü: sunucu (Render) uyanana kadar yokla; hazır olunca uygulamayı aç.
  // 1.5sn içinde cevap verirse (localhost) bekleme ekranı hiç görünmez.
  useEffect(() => {
    let cancelled = false;
    const started = Date.now();
    const wakeTimer = setTimeout(() => { if (!cancelled) setShowWaking(true); }, 1500);
    const elapsedTimer = setInterval(() => {
      if (!cancelled) setWakeElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    const ping = async () => {
      try {
        await api.get('/health', { timeout: 8000 });
        if (cancelled) return;
        setBackendReady(true);
        setShowWaking(false);
        clearInterval(elapsedTimer);
      } catch {
        if (!cancelled) setTimeout(ping, 3000);
      }
    };
    ping();
    return () => { cancelled = true; clearTimeout(wakeTimer); clearInterval(elapsedTimer); };
  }, []);

  // Sağlayıcı değişikliğini kullanıcıya bir kez bildir (örn. Gemini çöktü, Kimi devraldı)
  useEffect(() => {
    if (providerSwitchNotified.current) return;
    const switched = receipts.find((r) => r.aiNote);
    if (switched) {
      providerSwitchNotified.current = true;
      toast.info(switched.aiNote + ' İşlem kesintisiz devam ediyor.', { duration: 10000 });
    }
  }, [receipts]);

  // İşlem bittiğinde özet bildirimi göster: "X fiş işlendi, Y kontrol gerekli"
  useEffect(() => {
    if (wasActiveRef.current && !isActive && receipts.length > 0) {
      const done = receipts.filter((r) => r.status === 'tamam').length;
      const review = receipts.filter((r) => r.status === 'kontrol_gerekli').length;
      const errors = receipts.filter((r) => r.status === 'hata').length;
      let msg = `${done + review} fiş işlendi`;
      if (review) msg += `, ${review} fiş kontrol gerektiriyor`;
      if (errors) msg += `, ${errors} fişte hata oluştu`;
      const show = review || errors ? toast.warning : toast.success;
      show(msg, { duration: 8000 });
    }
    wasActiveRef.current = isActive;
  }, [isActive, receipts]);

  const [selectedClientId, setSelectedClientId] = useState(() => {
    return localStorage.getItem('selected_client_id') || null;
  });

  const ensureSession = async (clientIdOverride) => {
    if (sessionId) return sessionId;
    const cId = clientIdOverride !== undefined ? clientIdOverride : selectedClientId;
    const { data } = await api.post('/sessions', { clientId: cId });
    setSessionId(data.sessionId);
    return data.sessionId;
  };

  // Müşteri seçildiğinde mevcut oturumu kapatıp yenisini aç
  const handleSelectClient = async (clientId) => {
    setSelectedClientId(clientId);
    if (clientId) {
      localStorage.setItem('selected_client_id', clientId);
    } else {
      localStorage.removeItem('selected_client_id');
    }
    // Eski session'ı sunucudan sil (bellek temizliği; kalıcı veriler korunur)
    if (sessionId) {
      try {
        await api.delete(`/sessions/${sessionId}`);
      } catch (err) {
        console.warn('Eski session silinemedi:', err);
      }
    }
    // Yeni temiz veya yüklü session ilklendir
    setReceipts([]);
    setSummary(null);
    setSelectedId(null);
    setMonthFilter('all');
    
    // Yeni oturumu oluşturup verileri çek
    try {
      const { data } = await api.post('/sessions', { clientId });
      setSessionId(data.sessionId);
      const res = await api.get(`/sessions/${data.sessionId}`);
      setReceipts(res.data.receipts);
      setSummary(res.data.summary);
      toast.success(clientId ? 'Müşteri verileri yüklendi.' : 'Ortak alana geçildi.');
    } catch (err) {
      toast.error('Oturum başlatılırken hata oluştu.');
    }
  };

  // Sayfa ilk yüklendiğinde hafızadaki müşterinin oturumunu aç
  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await api.post('/sessions', { clientId: selectedClientId });
        setSessionId(data.sessionId);
        const res = await api.get(`/sessions/${data.sessionId}`);
        setReceipts(res.data.receipts);
        setSummary(res.data.summary);
      } catch (e) {
        console.error('Session init failed', e);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dosya yükleme (drag&drop veya tıkla-seç)
  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const valid = [];
    let badExt = 0;
    let badSize = 0;
    for (const f of files) {
      if (!ALLOWED_EXT.test(f.name)) { badExt++; continue; }
      if (f.size > MAX_SIZE) { badSize++; continue; }
      valid.push(f);
    }
    if (badExt) toast.error(`${badExt} dosya desteklenmeyen formatta. Lütfen JPG, PNG, HEIC veya WEBP kullanın.`);
    if (badSize) toast.error(`${badSize} dosya çok büyük (en fazla 20 MB olabilir).`);
    if (!valid.length) return;
    if (receipts.length + valid.length > MAX_FILES) {
      toast.error(`Tek partide en fazla ${MAX_FILES} fiş işlenebilir. Şu an listede ${receipts.length} fiş var.`);
      return;
    }
    setUploading(true);
    try {
      const sid = await ensureSession();
      const form = new FormData();
      valid.forEach((f) => form.append('receipts', f));
      const { data } = await api.post(`/sessions/${sid}/receipts`, form);
      toast.success(`${data.added.length} fiş yüklendi, işleniyor...`);
      if (data.rejected > 0) toast.warning(`${data.rejected} dosya desteklenmediği için atlandı.`);
      await refresh(sid);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Yükleme başarısız oldu. Lütfen tekrar deneyin.'));
    } finally {
      setUploading(false);
    }
  };

  // Hatalı fişi yeniden işleme al
  const handleRetry = async (rid) => {
    try {
      await api.post(`/sessions/${sessionId}/receipts/${rid}/retry`);
      setReceipts((prev) => prev.map((r) => (r.id === rid ? { ...r, status: 'bekliyor', error: null } : r)));
      toast.info('Fiş yeniden işleme alındı.');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Tekrar deneme başarısız oldu.'));
    }
  };

  // Inline hücre düzenleme
  const handleEdit = async (rid, payload) => {
    try {
      const { data } = await api.patch(`/sessions/${sessionId}/receipts/${rid}`, payload);
      setReceipts((prev) => prev.map((r) => (r.id === rid ? data.receipt : r)));
      setSummary(data.summary);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Değişiklik kaydedilemedi.'));
    }
  };

  // "Kontrol ettim, doğru" onayı
  const handleApprove = async (rid) => {
    try {
      const { data } = await api.post(`/sessions/${sessionId}/receipts/${rid}/approve`);
      setReceipts((prev) => prev.map((r) => (r.id === rid ? data.receipt : r)));
      setSummary(data.summary);
      toast.success('Fiş onaylandı.');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Onaylama başarısız oldu.'));
    }
  };

  // Excel'i içe aktar (seçili sekmeyle). runImport asıl /import çağrısını yapar.
  const runImport = async (file, sheet) => {
    setUploading(true);
    try {
      const sid = await ensureSession();
      const form = new FormData();
      form.append('excel', file);
      if (sheet) form.append('sheet', sheet);
      const { data } = await api.post(`/sessions/${sid}/import`, form);
      const nereden = sheet === '__ALL__' ? ' (tüm sekmeler)' : (sheet ? ` ("${sheet}" sekmesi)` : '');
      if (data.aiUsed) {
        toast.success(`${data.added.length} satır yapay zekâ ile okunup içe aktarıldı${nereden}.`);
      } else {
        toast.success(`${data.added.length} satır Excel'den içe aktarıldı${nereden}.`);
      }
      await refresh(sid);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Excel yüklenirken hata oluştu.'));
    } finally {
      setUploading(false);
    }
  };

  // Excel Dosyası Yükleme: önce sekmeleri yokla; çok sekme varsa kullanıcıya seçtir
  const handleExcelImport = async (file) => {
    if (!file) return;
    setUploading(true);
    let probe;
    try {
      const sid = await ensureSession();
      const form = new FormData();
      form.append('excel', file);
      const { data } = await api.post(`/sessions/${sid}/import/sheets`, form);
      probe = data;
    } catch {
      // Sekme listelenemezse eski davranış: doğrudan içe aktar
      setUploading(false);
      return runImport(file, null);
    }
    setUploading(false);
    const dataSheets = (probe.sheets || []).filter((s) => s.rows >= 2);
    if (dataSheets.length <= 1) {
      // Tek (veya sıfır) veri sekmesi: seçtirmeye gerek yok
      return runImport(file, dataSheets[0]?.name || null);
    }
    // Çok sekmeli dosya: kullanıcı hangi ay/yıl sekmesini istediğini seçsin
    setSheetPick({ file, sheets: dataSheets, suggested: probe.suggested });
  };

  // Manuel Boş Satır Ekleme
  const handleAddManualRow = async () => {
    try {
      const sid = await ensureSession();
      const { data } = await api.post(`/sessions/${sid}/receipts/manual`);
      toast.success('Boş satır eklendi, düzenleyebilirsiniz.');
      await refresh(sid);
      // Yeni eklenen satırı hemen seçelim
      setSelectedId(data.receipt.id);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Manuel satır eklenemedi.'));
    }
  };

  // Fişi listeden çıkar (geri alınabilir — yanlışlıkla silme için)
  const handleDelete = async (rid) => {
    const sid = sessionId;
    try {
      await api.delete(`/sessions/${sid}/receipts/${rid}`);
      if (selectedId === rid) setSelectedId(null);
      await refresh();
      toast.success('Fiş silindi.', {
        description: 'Yanlışlıkla mı sildiniz? Geri yükleyebilirsiniz.',
        action: {
          label: 'Geri Al',
          onClick: async () => {
            try {
              await api.post(`/sessions/${sid}/receipts/${rid}/restore`);
              await refresh(sid);
              toast.success('Fiş geri yüklendi.');
            } catch (e) {
              toast.error(apiErrorMessage(e, 'Fiş geri yüklenemedi (çöp kutusunda yok).'));
            }
          },
        },
      });
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Silme başarısız oldu.'));
    }
  };

  // İşlenmekte olan (veya sırada bekleyen) bir fişi iptal et — yanlış/istenmeyen olabilir
  const handleCancel = async (rid) => {
    try {
      if (selectedId === rid) setSelectedId(null);
      await api.delete(`/sessions/${sessionId}/receipts/${rid}`);
      await refresh();
      toast.info('Fişin işlenmesi iptal edildi.');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'İptal edilemedi.'));
    }
  };

  // Silinen fişi çöp kutusundan geri yükle
  const handleRestore = async (rid) => {
    try {
      await api.post(`/sessions/${sessionId}/receipts/${rid}/restore`);
      await refresh();
      toast.success('Fiş geri yüklendi.');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Fiş geri yüklenemedi.'));
    }
  };

  // Seçili fişi yapay zekâya danış: sohbeti o fiş seçili halde aç
  const handleAskAboutReceipt = (rid) => {
    setSelectedId(rid);
    setChatOpen(true);
    setAskNonce((n) => n + 1); // ChatPanel bu fişe özgü ilk soruyu otomatik göndersin
  };

  // Tüm partiyi temizle (sunucu belleğinden de silinir)
  const handleClear = async () => {
    try {
      if (sessionId) await api.delete(`/sessions/${sessionId}`);
    } catch {
      // zaten silinmiş olabilir, yoksay
    }
    setSessionId(null);
    setReceipts([]);
    setSummary(null);
    setSelectedId(null);
    setMonthFilter('all');
    toast.success('Liste temizlendi. Yeni parti yükleyebilirsiniz.');
  };

  // Excel indir (ay filtresi + kullanıcının özelleştirdiği sütun başlıkları uygulanır)
  const handleExport = async () => {
    try {
      const params = monthFilter !== 'all' ? { month: monthFilter } : {};
      if (localStorage.getItem('show_category_col') === '0') {
        params.exclude_category = '1';
      }
      try {
        const titles = JSON.parse(localStorage.getItem('excel_column_titles') || '{}');
        const exportTitles = {};
        for (const [k, v] of Object.entries(titles)) {
          const i = parseInt(k, 10);
          if (i >= 0 && i <= 11 && v) exportTitles[i] = v;
        }
        if (Object.keys(exportTitles).length > 0) params.headers = JSON.stringify(exportTitles);
      } catch {
        // özel başlık yoksa varsayılanlar kullanılır
      }
      const res = await api.get(`/sessions/${sessionId}/export`, { params, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `fisler_${monthFilter === 'all' ? 'tumu' : monthFilter}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Excel indirildi.');
    } catch {
      toast.error('Excel oluşturulamadı. Lütfen tekrar deneyin.');
    }
  };

  // Satır seçimi -> yan panelde fiş fotoğrafı (tablo görünümünde panel Sheet olarak açılır)
  const handleSelect = (rid) => {
    setSelectedId(rid);
    if (viewMode === 'panel' && window.innerWidth < 1024) {
      setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    }
  };

  // Ay filtresi seçenekleri (fişlerdeki tarihlere göre)
  const months = useMemo(() => {
    const set = new Set();
    receipts.forEach((r) => {
      const m = (r.data?.tarih || '').slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(m)) set.add(m);
    });
    return [...set].sort().reverse();
  }, [receipts]);

  const dataReceipts = useMemo(
    () => receipts.filter((r) => r.data && (r.status === 'tamam' || r.status === 'kontrol_gerekli')),
    [receipts]
  );
  const filteredReceipts = useMemo(
    () => {
      const list = monthFilter === 'all' ? dataReceipts : dataReceipts.filter((r) => (r.data?.tarih || '').startsWith(monthFilter));
      // Tarihe göre yeniden eskiye sırala; tarihsizler sona
      return [...list].sort((a, b) => {
        const ta = a.data?.tarih || '';
        const tb = b.data?.tarih || '';
        if (ta && tb) return tb.localeCompare(ta);
        if (ta) return -1;
        if (tb) return 1;
        return (a.order || 0) - (b.order || 0);
      });
    },
    [dataReceipts, monthFilter]
  );
  // Tabloda işlemdeki/hatalı fişler de satır olarak görünsün (Durum: İşlemde / Sırada / Hata)
  const tableReceipts = useMemo(() => {
    const pending = receipts
      .filter((r) => r.status === 'bekliyor' || r.status === 'isleniyor' || r.status === 'hata')
      .sort((a, b) => (a.order || 0) - (b.order || 0));
    return [...filteredReceipts, ...pending];
  }, [filteredReceipts, receipts]);

  // AI'ın "fiş değil" deyip atladıkları (tabloya girmez, ayrı bölümde gösterilir)
  const fisDegilReceipts = useMemo(() => receipts.filter((r) => r.status === 'fis_degil'), [receipts]);

  const selectedReceipt = receipts.find((r) => r.id === selectedId) || null;
  // Tablo görünümü araç çubuğu için özet sayılar
  const activeCount = receipts.filter((r) => r.status === 'bekliyor' || r.status === 'isleniyor').length;
  const errorCount = receipts.filter((r) => r.status === 'hata').length;
  const grandTotal = filteredReceipts.reduce((sum, r) => sum + (Number(r.data?.toplam) || 0), 0);

  // Backend henüz hazır değilse: ilk 1.5sn boş (flash olmasın), sonra bekleme ekranı
  if (!backendReady) {
    return showWaking
      ? <BackendWaking elapsed={wakeElapsed} onRetry={() => window.location.reload()} />
      : <div className="min-h-screen bg-background noise-bg" />;
  }

  return (
    <div className="min-h-screen bg-background noise-bg">
      <TopBar
        summary={summary}
        hasData={dataReceipts.length > 0}
        hasAny={receipts.length > 0}
        onExport={handleExport}
        onOpenSettings={() => setSettingsOpen(true)}
        onClear={handleClear}
        selectedClientId={selectedClientId}
        onSelectClient={handleSelectClient}
        onOpenPreview={() => setExcelPreviewOpen(true)}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
      />

      <main className={viewMode === 'excel'
        ? 'relative w-full px-3 sm:px-4 py-4 space-y-3'
        : 'relative max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8'}>
        {/* Teşhis/Hata Bildirim Alanı */}
        {diagnostics && !diagnostics.apiKeyValid && !dismissDiagnostics && (
          <Alert variant="destructive" className="bg-destructive/10 border-destructive/30 text-destructive-foreground mb-4">
            <AlertCircle className="h-4 w-4" />
            <div className="flex items-start justify-between w-full flex-wrap gap-2">
              <AlertTitle className="font-semibold text-rose-600">
                {diagnostics?.provider === 'kimi' ? 'Kimi' : 'Gemini'} API Bağlantı Hatası!
              </AlertTitle>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-xs text-foreground bg-background hover:bg-muted"
                  onClick={checkDiagnostics}
                  disabled={checkingDiagnostics}
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${checkingDiagnostics ? 'animate-spin' : ''}`} />
                  Yeniden Kontrol Et
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2.5 text-xs text-rose-700 hover:bg-rose-100"
                  onClick={() => setDismissDiagnostics(true)}
                  data-testid="dismiss-diagnostics-button"
                >
                  Kapat / Manuel Kullan
                </Button>
              </div>
            </div>
            <AlertDescription className="text-sm text-foreground mt-2">
              <p className="font-medium text-rose-500 mb-1">Hata Detayı: {diagnostics.error || 'Bilinmeyen API Hatası'}</p>
              <p className="text-muted-foreground text-xs">
                Çözüm: Google AI Studio'dan (<a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline text-sky-500 hover:text-sky-600">buradan</a>) geçerli bir API anahtarı alın, <strong>backend/.env</strong> dosyasına yapıştırın ve backend sunucusunu yeniden başlatın.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {viewMode === 'excel' ? (
          <>
            {/* --- TAM EKRAN EXCEL GÖRÜNÜMÜ --- */}
            {/* Gizli dosya girişleri */}
            <input
              ref={excelFileInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.heic,.heif"
              className="hidden"
              onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
              data-testid="excel-view-file-input"
            />
            <input
              ref={excelImportInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => { handleExcelImport(e.target.files?.[0]); e.target.value = ''; }}
              data-testid="excel-view-import-input"
            />

            {/* Araç çubuğu: yükleme + satır + fiş görseli + ay filtresi + genel toplam */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => excelFileInputRef.current?.click()}
                disabled={uploading}
                className="h-9"
                data-testid="excel-view-upload-button"
              >
                <Upload className="h-4 w-4 mr-1.5" />
                Fiş Yükle
              </Button>
              <Button
                variant="outline"
                onClick={() => excelImportInputRef.current?.click()}
                disabled={uploading}
                className="h-9"
                data-testid="excel-view-import-button"
              >
                <FileUp className="h-4 w-4 mr-1.5" />
                Excel Yükle
              </Button>
              <Button
                variant="outline"
                onClick={handleAddManualRow}
                className="h-9"
                data-testid="excel-view-add-row-button"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Boş Satır
              </Button>
              <Button
                variant="outline"
                onClick={() => setPreviewOpen(true)}
                disabled={!selectedReceipt}
                className="h-9"
                title={selectedReceipt ? 'Seçili fişin fotoğrafını aç' : 'Önce tablodan bir satır seçin'}
                data-testid="excel-view-show-receipt-button"
              >
                <ImageIcon className="h-4 w-4 mr-1.5" />
                Fişi Gör
              </Button>

              {activeCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 text-sky-800 border border-sky-200 px-3 py-1 text-xs font-medium">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {activeCount} fiş işleniyor…
                </span>
              )}
              {errorCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-rose-50 text-rose-800 border border-rose-200 px-3 py-1 text-xs font-medium">
                  {errorCount} fişte hata
                </span>
              )}

              <div className="ml-auto flex items-center gap-2">
                <Select value={monthFilter} onValueChange={setMonthFilter}>
                  <SelectTrigger className="h-9 w-[150px] text-xs" data-testid="excel-view-month-filter">
                    <SelectValue placeholder="Tüm Aylar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm Aylar</SelectItem>
                    {months.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span
                  className="inline-flex items-center rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm font-semibold tabular-nums"
                  data-testid="excel-view-grand-total"
                >
                  {formatCurrency(grandTotal)}
                </span>
              </div>
            </div>

            {/* Hatalı/işlenen fişler varsa kompakt işlem listesi (kendi kendine gizlenir) */}
            <ProcessingList receipts={receipts} onRetry={handleRetry} onDelete={handleDelete} onCancel={handleCancel} />

            {/* Tam genişlik Excel tablosu */}
            <ResultsTable
              receipts={tableReceipts}
              selectedId={selectedId}
              onSelect={handleSelect}
              onEdit={handleEdit}
              onApprove={handleApprove}
              onDelete={handleDelete}
              fullHeight
            />

            {/* Fiş görseli kayan panel (Sheet) */}
            <Sheet open={previewOpen && Boolean(selectedReceipt)} onOpenChange={setPreviewOpen}>
              <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-4">
                <SheetHeader className="sr-only">
                  <SheetTitle>Fiş Önizleme</SheetTitle>
                </SheetHeader>
                <ReceiptPanel
                  sessionId={sessionId}
                  receipt={selectedReceipt}
                  onApprove={handleApprove}
                  onRetry={handleRetry}
                  onDelete={handleDelete}
                  onAsk={handleAskAboutReceipt}
                  onClose={() => setPreviewOpen(false)}
                />
              </SheetContent>
            </Sheet>
          </>
        ) : (
          <>
            {/* --- PANEL GÖRÜNÜMÜ (yükleme odaklı klasik akış) --- */}
            <UploadZone
              onFiles={handleFiles}
              onExcelImport={handleExcelImport}
              onAddManualRow={handleAddManualRow}
              uploading={uploading}
              count={receipts.length}
              maxFiles={MAX_FILES}
            />

            <ProcessingList receipts={receipts} onRetry={handleRetry} onDelete={handleDelete} onCancel={handleCancel} />

            {dataReceipts.length > 0 && (
              <>
                <SummaryCards
                  receipts={filteredReceipts}
                  months={months}
                  monthFilter={monthFilter}
                  onMonthChange={setMonthFilter}
                />
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-8 min-w-0">
                    <ResultsTable
                      receipts={tableReceipts}
                      selectedId={selectedId}
                      onSelect={handleSelect}
                      onEdit={handleEdit}
                      onApprove={handleApprove}
                      onDelete={handleDelete}
                    />
                  </div>
                  <div className="lg:col-span-4" ref={panelRef}>
                    <ReceiptPanel
                      sessionId={sessionId}
                      receipt={selectedReceipt}
                      onApprove={handleApprove}
                      onRetry={handleRetry}
                      onDelete={handleDelete}
                      onAsk={handleAskAboutReceipt}
                      onClose={() => setSelectedId(null)}
                    />
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* AI'ın fiş saymadıkları — her iki görünümde de en altta */}
        {sessionId && <SkippedReceipts items={fisDegilReceipts} onSelect={handleSelect} onRetry={handleRetry} onDelete={handleDelete} />}

        {/* Silinen fişler (çöp kutusu) — her iki görünümde de en altta */}
        {sessionId && <DeletedReceipts trash={trash} onRestore={handleRestore} />}
      </main>

      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
      {sessionId && <ChatPanel sessionId={sessionId} open={chatOpen} onOpenChange={setChatOpen} selectedReceiptId={selectedId} selectedReceipt={selectedReceipt} askNonce={askNonce} onClearFocus={() => setSelectedId(null)} onDataChanged={() => refresh()} />}
      <ExcelPreviewDialog
        open={excelPreviewOpen}
        onOpenChange={setExcelPreviewOpen}
        receipts={filteredReceipts}
        onExport={handleExport}
      />
      {adminOpen && <AdminPanel onClose={closeAdmin} />}
      <SheetPickerDialog
        open={!!sheetPick}
        sheets={sheetPick?.sheets || []}
        suggested={sheetPick?.suggested || null}
        onPick={(name) => { const f = sheetPick?.file; setSheetPick(null); if (f) runImport(f, name); }}
        onClose={() => setSheetPick(null)}
      />
      <Toaster position="top-center" richColors closeButton />
    </div>
  );
}
