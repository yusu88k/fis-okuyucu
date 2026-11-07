// Basit giriş kapısı — link'i bilen herkesin (bot/yabancı) girip Kimi parası
// harcamasını önlemek için. Not: istemci-tarafı basit koruma (kurumsal güvenlik değil).
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, FileSpreadsheet } from 'lucide-react';

// Şifre derleme anında REACT_APP_APP_PASSWORD ile verilir (açık repoda gerçek şifre durmasın).
const APP_PASSWORD = process.env.REACT_APP_APP_PASSWORD || 'test123';
const UNLOCK_KEY = 'app_unlocked';

export function isUnlocked() {
  return localStorage.getItem(UNLOCK_KEY) === '1';
}

export function PasswordGate({ onUnlock }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (pw === APP_PASSWORD) {
      localStorage.setItem(UNLOCK_KEY, '1');
      onUnlock();
    } else {
      setErr(true);
    }
  };

  return (
    <div className="min-h-screen bg-background noise-bg flex items-center justify-center p-6" data-testid="password-gate">
      <form onSubmit={submit} className="w-full max-w-sm text-center">
        <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <FileSpreadsheet className="h-8 w-8 text-primary" />
        </div>
        <h1 className="font-heading text-xl font-semibold text-slate-800">Fişten Excel'e</h1>
        <p className="mt-2 text-sm text-muted-foreground">Devam etmek için şifreyi girin.</p>

        <div className="mt-5 flex items-center gap-2">
          <div className="relative flex-1">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="password"
              value={pw}
              onChange={(e) => { setPw(e.target.value); setErr(false); }}
              placeholder="Şifre"
              className="pl-9"
              autoFocus
              data-testid="password-input"
            />
          </div>
          <Button type="submit" data-testid="password-submit">Gir</Button>
        </div>
        {err && <p className="mt-3 text-sm text-rose-600" data-testid="password-error">Şifre yanlış, tekrar deneyin.</p>}
      </form>
    </div>
  );
}
