import { useAuth } from '../context/AuthContext';
import { useI18n } from '../lib/i18n';
import { Fuel, BarChart3, Shield, Truck } from 'lucide-react';

export function LandingPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted to-background">
      <header className="flex h-16 items-center justify-between border-b border-border bg-background/70 px-6 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Fuel className="h-5 w-5 text-primary" />
          </div>
          <span className="font-semibold text-foreground">{t('appName')}</span>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-6 pb-16 pt-20 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            Korxonaviy yoqilg'i va transport tizimi
          </div>
          <h1 className="mb-5 text-5xl font-bold tracking-tight text-foreground md:text-6xl">
            {t('appName')} — Yoqilg'i va transport monitoringi
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">{t('subtitle')}</p>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: BarChart3, title: t('dashboard'), desc: 'Limit va Fakt, og\u006bish, diagrammalar' },
              { icon: Truck, title: t('vehicle'), desc: 'TEM, KAMAZ, MAN, Toyota, MTZ...' },
              { icon: Fuel, title: t('byFuelType'), desc: 'Dizel, Benzin, SPG' },
            ].map((f, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-6">
                <f.icon className="mb-3 h-7 w-7 text-primary" />
                <h3 className="mb-1 font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
