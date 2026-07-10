// Yapay zekâ asistanı paneli: mevcut oturumdaki fişler hakkında soru-cevap
import { useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { MessageCircle, Send, Bot, User, Sparkles, Loader2, Wrench, FileText, X } from 'lucide-react';
import { api, apiErrorMessage } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ChatMarkdown } from './ChatMarkdown';

const QUICK_PROMPTS = [
  'Oturumdaki fişleri özetle',
  'Kontrol gerekenleri göster',
  'Mükerrer fiş var mı?',
  'Güven skoru düşük fişleri onayla',
];

const DOC_TYPE_LABELS = {
  yazarkasa_fisi: 'Yazarkasa Fişi', e_fatura: 'e-Fatura', fatura: 'Fatura',
  dekont: 'Dekont', gider_pusulasi: 'Gider Pusulası', diger: 'Diğer',
};

export const ChatPanel = ({ sessionId, open, onOpenChange, selectedReceiptId, selectedReceipt, askNonce = 0, onClearFocus, onDataChanged }) => {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Merhaba, ben fiş asistanınızım. Fişleri özetleyebilir, sorularınızı yanıtlayabilir ve isterseniz tabloyu sizin için düzenleyebilirim. Örneğin "Migros fişinin tarihini 15.09.2025 yap" veya "güven skoru 50\'nin altındaki fişleri sil" diyebilirsiniz.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const lastAskNonce = useRef(0);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages, loading]);

  // "Bu fişe danış" ile açıldığında o fişe özgü ilk soruyu otomatik gönder
  useEffect(() => {
    if (askNonce > 0 && askNonce !== lastAskNonce.current && selectedReceiptId) {
      lastAskNonce.current = askNonce;
      const ad = selectedReceipt?.fileName || 'bu fiş';
      sendMessage(`"${ad}" fişini inceler misin? Görsel ile tabloyu karşılaştır, kısaca özetle ve bir hata/eksik görüyorsan söyle.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askNonce]);

  const sendMessage = async (text) => {
    const trimmed = String(text || input).trim();
    if (!trimmed || !sessionId) return;

    const userMsg = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.filter((m) => m.role === 'user' || m.role === 'assistant').slice(-10);
      const { data } = await api.post(`/sessions/${sessionId}/chat`, {
        message: trimmed,
        history,
        selectedReceiptId,
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply, actions: data.actions || [] }]);
      // Ajan tabloda değişiklik yaptıysa listeyi tazele (silme/düzenleme/ekleme anında yansısın)
      if (data.changed && typeof onDataChanged === 'function') {
        onDataChanged();
        const n = (data.actions || []).length;
        if (n > 0) toast.success(`Asistan ${n} işlem yaptı, tablo güncellendi.`);
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Asistan yanıt veremedi.'));
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Üzgünüm, şu an yanıt veremiyorum. Lütfen tekrar deneyin.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Yüzen asistan butonu */}
      <Button
        onClick={() => onOpenChange(true)}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-[var(--shadow-tight)] active:scale-[0.98] p-0"
        aria-label="Yapay zekâ asistanını aç"
        data-testid="open-chat-button"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md flex flex-col p-0" data-testid="chat-panel">
          <SheetHeader className="px-5 py-4 border-b">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <SheetTitle className="text-base">Fiş Asistanı</SheetTitle>
                <SheetDescription className="text-xs">
                  Yüklediğiniz fişler hakkında soru sorun.
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Seçili fişe özgü sohbet bandı: hangi fişe baktığımızı net göster */}
          {selectedReceipt && (
            <div className="px-5 py-2.5 bg-violet-50 border-b border-violet-200 flex items-center gap-2" data-testid="chat-focus-banner">
              <FileText className="h-4 w-4 text-violet-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-violet-900 font-medium truncate" title={selectedReceipt.fileName}>
                  Bu fişe bakıyorum: {selectedReceipt.fileName}
                </p>
                {selectedReceipt.data?.belge_turu && (
                  <p className="text-[11px] text-violet-600">
                    {DOC_TYPE_LABELS[selectedReceipt.data.belge_turu] || selectedReceipt.data.belge_turu}
                    {selectedReceipt.data?.firma_unvani ? ` · ${selectedReceipt.data.firma_unvani}` : ''}
                  </p>
                )}
              </div>
              {onClearFocus && (
                <button
                  type="button"
                  onClick={onClearFocus}
                  className="text-violet-500 hover:text-violet-800 shrink-0"
                  aria-label="Fiş odağını kaldır"
                  title="Genel sohbete dön"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          <ScrollArea className="flex-1 px-5 py-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.map((msg, i) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={i}
                    className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
                    data-testid={isUser ? 'chat-user-message' : 'chat-assistant-message'}
                  >
                    <Avatar className={cn('h-8 w-8 shrink-0', isUser ? 'bg-slate-200' : 'bg-sky-100')}>
                      <AvatarFallback className={isUser ? 'text-slate-700' : 'text-sky-700'}>
                        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className={cn('flex flex-col gap-1.5 max-w-[80%] min-w-0', isUser ? 'items-end' : 'items-start')}>
                      <div
                        className={cn(
                          'rounded-2xl px-4 py-2.5 text-sm leading-relaxed max-w-full min-w-0 overflow-hidden',
                          isUser
                            ? 'bg-primary text-primary-foreground rounded-br-none whitespace-pre-wrap break-words'
                            : 'bg-muted text-foreground rounded-bl-none'
                        )}
                      >
                        {isUser ? msg.content : <ChatMarkdown text={msg.content} />}
                      </div>
                      {/* Ajanın tabloda yaptığı işlemler (silme/düzenleme/ekleme) */}
                      {!isUser && msg.actions?.length > 0 && (
                        <div className="flex flex-col gap-1 w-full" data-testid="chat-actions">
                          {msg.actions.map((act, ai) => (
                            <div
                              key={ai}
                              className="flex items-center gap-1.5 text-[11px] rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 px-2.5 py-1.5"
                            >
                              <Wrench className="h-3 w-3 shrink-0" />
                              <span>{act}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8 shrink-0 bg-sky-100">
                    <AvatarFallback className="text-sky-700">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="rounded-2xl rounded-bl-none bg-muted px-4 py-2.5 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Düşünüyor…
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="border-t p-4 space-y-3">
            {messages.length <= 1 && (
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendMessage(prompt)}
                    className="text-xs rounded-full border bg-card px-3 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    data-testid="chat-quick-prompt"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            <Separator />

            <div className="flex gap-2">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Örn: Migros fişinin toplamını 248,15 yap"
                className="min-h-[44px] max-h-[120px] resize-none py-2.5"
                disabled={loading}
                data-testid="chat-input"
              />
              <Button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="h-auto px-3 shrink-0"
                aria-label="Gönder"
                data-testid="chat-send-button"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              Asistan tabloyu düzenleyebilir. Seçili fişin görseli de paylaşılır.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
