// Ayarlar paneli: yapay zekâ modeli + düşünme modu
import { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Cpu, Save, Loader2, Brain } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

// Düşünme modu seçenekleri (backend: auto/on/off)
const THINKING_OPTIONS = [
  {
    value: 'auto',
    label: 'Otomatik (Önerilen)',
    hint: 'Fişler hızlı okunur; okunamayan fiş kendiliğinden daha zeki modele geçer ve düşünme açılır.',
  },
  {
    value: 'on',
    label: 'Hep Açık',
    hint: 'Her fişte düşünme açık. En titiz okuma, ama ~7 kat yavaş ve daha pahalı.',
  },
  {
    value: 'off',
    label: 'Kapalı',
    hint: 'Düşünme hiç kullanılmaz. En hızlı ve en ucuz; zor fişlerde isabet düşebilir.',
  },
];

export const SettingsSheet = ({ open, onOpenChange }) => {
  const [model, setModel] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [defaultModel, setDefaultModel] = useState('');
  const [thinkingMode, setThinkingMode] = useState('auto');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Panel açıldığında güncel ayarları çek
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api
      .get('/settings')
      .then(({ data }) => {
        setModel(data.model);
        setSuggestions(data.suggestions || []);
        setDefaultModel(data.defaultModel);
        setThinkingMode(data.thinkingMode || 'auto');
      })
      .catch(() => toast.error('Ayarlar yüklenemedi.'))
      .finally(() => setLoading(false));
  }, [open]);

  const save = async () => {
    if (!model.trim()) {
      toast.error('Model adı boş olamaz.');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.put('/settings', { model: model.trim(), thinkingMode });
      toast.success(`Ayarlar güncellendi: ${data.model} / düşünme: ${data.thinkingMode}`);
      onOpenChange(false);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Ayarlar kaydedilemedi.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-heading flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            Ayarlar
          </SheetTitle>
          <SheetDescription>Fişleri okuyan yapay zekâ modelini buradan değiştirebilirsiniz.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="model-input">Yapay Zekâ Modeli</Label>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Yükleniyor...
              </div>
            ) : (
              <Input
                id="model-input"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="örn. gemini-2.5-flash"
                data-testid="gemini-model-input"
                className="font-mono-nums"
              />
            )}
            <p className="text-xs text-muted-foreground">
              Varsayılan: <span className="font-mono-nums">{defaultModel}</span>. Şu an fişler Kimi (Moonshot)
              modelleriyle okunuyor. Okunamayan fişler otomatik olarak daha zeki Kimi modellerine (k2.6 → k2.7) geçer.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Brain className="h-4 w-4 text-primary" />
              Düşünme Modu
            </Label>
            <div className="space-y-2">
              {THINKING_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setThinkingMode(opt.value)}
                  data-testid={`thinking-mode-${opt.value}`}
                  className={cn(
                    'w-full text-left rounded-lg border p-3 transition-colors duration-150',
                    thinkingMode === opt.value
                      ? 'border-primary bg-accent/60 ring-1 ring-primary/30'
                      : 'bg-card hover:border-primary/40'
                  )}
                >
                  <div className="text-sm font-medium">{opt.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{opt.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Hızlı seçim</Label>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => {
                const isNvidia = s.includes('/') || s.startsWith('nvidia:');
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setModel(s)}
                    data-testid={`model-suggestion-${s}`}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150 inline-flex items-center gap-1',
                      model === s
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-secondary text-secondary-foreground hover:border-primary/50'
                    )}
                  >
                    {s}
                    {isNvidia && (
                      <span className={cn('rounded px-1 text-[10px] font-semibold', model === s ? 'bg-white/25' : 'bg-emerald-100 text-emerald-700')}>
                        bedava
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <Button onClick={save} disabled={saving || loading} className="w-full" data-testid="save-settings-button">
            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
            Kaydet
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
