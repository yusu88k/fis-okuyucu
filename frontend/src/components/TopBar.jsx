// Üst bar: logo + müşteri seçimi + hazır fiş sayısı + Excel'e Aktar + Ayarlar + Temizle
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FileSpreadsheet, Settings, Trash2, Download, UserPlus, Plus, Eye, LayoutPanelLeft, Table2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export const TopBar = ({ summary, hasData, hasAny, onExport, onOpenSettings, onClear, selectedClientId, onSelectClient, onOpenPreview, viewMode, onViewModeChange }) => {
  const readyCount = (summary?.tamam || 0) + (summary?.kontrolGerekli || 0);
  const [clients, setClients] = useState([]);
  const [newClientName, setNewClientName] = useState('');
  const [clientModalOpen, setClientModalOpen] = useState(false);

  // Müşterileri sunucudan yükle
  const loadClients = async () => {
    try {
      const { data } = await api.get('/clients');
      setClients(data.clients || []);
    } catch (err) {
      console.error('Müşteriler yüklenemedi:', err);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  // Yeni müşteri ekleme
  const handleAddClient = async () => {
    const name = newClientName.trim();
    if (!name) return;
    try {
      const { data } = await api.post('/clients', { name });
      setClients((prev) => [...prev, data.client]);
      onSelectClient(data.client.id);
      setNewClientName('');
      setClientModalOpen(false);
      toast.success(`"${name}" müşterisi eklendi ve seçildi.`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Müşteri eklenirken hata oluştu.');
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Logo + başlık: tıklayınca ana görünüme (Panel) döner */}
          <button
            type="button"
            onClick={() => {
              onViewModeChange('panel');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-3 min-w-0 rounded-lg -ml-1 px-1 py-0.5 hover:bg-muted/60 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            title="Ana sayfaya dön"
            data-testid="home-logo-button"
          >
            <div className="h-10 w-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-[var(--shadow-tight)]">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="min-w-0 hidden md:block text-left">
              <h1 className="font-heading text-lg font-bold leading-tight truncate">Fişten Excel'e</h1>
              <p className="text-xs text-muted-foreground">Muhasebeci Portalı</p>
            </div>
          </button>

          <div className="flex items-center gap-1.5 ml-2">
            <Select value={selectedClientId || 'none'} onValueChange={(val) => onSelectClient(val === 'none' ? null : val)}>
              <SelectTrigger className="h-9 text-xs w-[140px] sm:w-[170px]" data-testid="client-select-trigger">
                <SelectValue placeholder="Müşteri Seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Seçilmemiş (Ortak)</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Dialog open={clientModalOpen} onOpenChange={setClientModalOpen}>
              <DialogTrigger asChild>
                <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" title="Müşteri Ekle" data-testid="add-client-button">
                  <UserPlus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Yeni Müşteri (Mükellef) Ekle</DialogTitle>
                </DialogHeader>
                <div className="flex items-center gap-2 mt-4">
                  <Input
                    placeholder="Müşteri / Firma Adı"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddClient()}
                    data-testid="new-client-name-input"
                  />
                  <Button onClick={handleAddClient} data-testid="new-client-save-button">
                    <Plus className="h-4 w-4 mr-1" />
                    Ekle
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Görünüm seçici: Panel (yükleme odaklı) / Tablo (tam ekran Excel) */}
          <div className="flex items-center rounded-lg border bg-muted/40 p-0.5 ml-1 shrink-0">
            <Button
              size="sm"
              variant={viewMode === 'panel' ? 'default' : 'ghost'}
              className="h-8 px-2.5 text-xs"
              onClick={() => onViewModeChange('panel')}
              data-testid="view-mode-panel-button"
              title="Panel görünümü (yükleme + özetler)"
            >
              <LayoutPanelLeft className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">Panel</span>
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'excel' ? 'default' : 'ghost'}
              className="h-8 px-2.5 text-xs"
              onClick={() => onViewModeChange('excel')}
              data-testid="view-mode-excel-button"
              title="Tablo görünümü (tam ekran Excel)"
            >
              <Table2 className="h-3.5 w-3.5 mr-1" />
              <span className="hidden sm:inline">Tablo</span>
            </Button>
          </div>

          {readyCount > 0 && (
            <span
              data-testid="ready-count-chip"
              className="hidden lg:inline-flex items-center rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 text-xs font-medium whitespace-nowrap"
            >
              {readyCount} fiş hazır
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasAny && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="text-muted-foreground" data-testid="clear-batch-button">
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  <span className="hidden sm:inline">Temizle</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Tüm liste silinsin mi?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Yüklenen tüm fişler ve okunan veriler kalıcı olarak silinecek. Excel dosyasını henüz indirmediyseniz önce indirmenizi öneririz.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="clear-cancel-button">Vazgeç</AlertDialogCancel>
                  <AlertDialogAction
                    data-testid="clear-confirm-button"
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={onClear}
                  >
                    Evet, Temizle
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button variant="outline" size="icon" onClick={onOpenSettings} data-testid="open-settings-button" aria-label="Ayarlar">
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={onOpenPreview}
            disabled={!hasData}
            data-testid="preview-xlsx-button"
            className="h-10 md:h-11 px-3 border-emerald-600/30 text-emerald-700 hover:bg-emerald-50"
          >
            <Eye className="h-4 w-4 mr-1.5" />
            Tablo Önizle
          </Button>
          <Button
            onClick={onExport}
            disabled={!hasData}
            data-testid="export-xlsx-button"
            className="h-10 md:h-11 px-4 md:px-5 shadow-[var(--shadow-tight)] active:scale-[0.98] focus-visible:ring-4 focus-visible:ring-sky-500/30"
          >
            <Download className="h-4 w-4 mr-1.5" />
            Excel'e Aktar
          </Button>
        </div>
      </div>
    </header>
  );
};
