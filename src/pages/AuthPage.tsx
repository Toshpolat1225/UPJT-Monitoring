import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../lib/i18n';
import { supabase } from '../lib/supabase';
import { Fuel } from 'lucide-react';
import { toast } from 'sonner';

export function AuthPage() {
  const { user, loading } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      // App.tsx handles navigation — this is just a safety net
    }
  }, [loading, user]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success(t('welcome'));
  };

  return (
    <main className="grid min-h-screen place-items-center bg-gradient-to-br from-background via-muted to-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Fuel className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{t('appName')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <form onSubmit={signIn} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{t('email')}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{t('password')}</label>
              <input
                type="password"
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? t('loading') : t('signIn')}
            </button>
          </form>

          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={() => setLang('uz')}
              className={`rounded border border-border px-3 py-1 text-xs transition-colors ${
                lang === 'uz' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
            >
              UZ
            </button>
            <button
              onClick={() => setLang('ru')}
              className={`rounded border border-border px-3 py-1 text-xs transition-colors ${
                lang === 'ru' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
            >
              RU
            </button>
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Akkaunt faqat administrator tomonidan yaratiladi.
          </p>
        </div>
      </div>
    </main>
  );
}
