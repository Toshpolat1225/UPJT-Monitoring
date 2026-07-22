import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  ClipboardList,
  Gauge,
  Database,
  Users,
  ScrollText,
  LogOut,
  BookOpen,
  Sun,
  Moon,
  Fuel,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../lib/i18n';
import { useTheme } from '../../lib/theme';
import type { ViewKey } from '../../App';
import type { AppRole } from '../../lib/supabase';

interface NavItem {
  key: ViewKey;
  labelKey: Parameters<ReturnType<typeof useI18n>['t']>[0];
  icon: ReactNode;
  roles: AppRole[];
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', labelKey: 'dashboard', icon: <LayoutDashboard className="h-5 w-5" />, roles: ['admin', 'gsm', 'operator', 'master', 'management'] },
  { key: 'entries', labelKey: 'entries', icon: <ClipboardList className="h-5 w-5" />, roles: ['admin', 'gsm', 'operator', 'master'] },
  { key: 'limits', labelKey: 'limits', icon: <Gauge className="h-5 w-5" />, roles: ['admin', 'gsm', 'operator', 'management'] },
  { key: 'master-data', labelKey: 'masterData', icon: <Database className="h-5 w-5" />, roles: ['admin', 'operator'] },
  { key: 'users', labelKey: 'users', icon: <Users className="h-5 w-5" />, roles: ['admin'] },
  { key: 'audit', labelKey: 'audit', icon: <ScrollText className="h-5 w-5" />, roles: ['admin', 'gsm', 'operator'] },
  { key: 'docs', labelKey: 'docs', icon: <BookOpen className="h-5 w-5" />, roles: ['admin', 'gsm', 'operator', 'master', 'management'] },
];

interface AppLayoutProps {
  currentView: ViewKey;
  onNavigate: (view: ViewKey) => void;
  children: ReactNode;
}

export function AppLayout({ currentView, onNavigate, children }: AppLayoutProps) {
  const { profile, roles, signOut, hasAny } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { theme, toggle } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = NAV_ITEMS.filter((item) => item.roles.some((r) => roles.includes(r)));

  const handleNav = (view: ViewKey) => {
    onNavigate(view);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Mobile header */}
      <div className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Fuel className="h-5 w-5 text-primary" />
          </div>
          <span className="font-bold text-foreground">{t('appName')}</span>
        </div>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`no-print fixed inset-y-0 left-0 z-40 w-64 transform border-r border-sidebar-border bg-sidebar transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Fuel className="h-5 w-5 text-primary" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-sidebar-foreground">{t('appName')}</div>
            <div className="text-[11px] text-muted-foreground">UPJT</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => handleNav(item.key)}
              className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                currentView === item.key
                  ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
              }`}
            >
              {item.icon}
              {t(item.labelKey)}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 space-y-2 border-t border-sidebar-border p-3">
          <div className="px-2 text-xs">
            <div className="truncate font-medium text-sidebar-foreground">{profile?.full_name || profile?.email}</div>
            <div className="capitalize text-muted-foreground">{roles.join(', ') || '—'}</div>
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent/50"
          >
            <LogOut className="h-4 w-4" />
            {t('signOut')}
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && <div className="no-print fixed inset-0 z-30 bg-foreground/30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main content */}
      <div className="lg:pl-64">
        <header className="no-print hidden h-16 items-center justify-between border-b border-border bg-background px-6 lg:flex">
          <div className="text-sm text-muted-foreground">{t('appName')}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="inline-flex rounded-md border border-border p-0.5">
              <button
                onClick={() => setLang('uz')}
                className={`rounded px-2.5 py-1 text-xs transition-colors ${
                  lang === 'uz' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                }`}
              >
                UZ
              </button>
              <button
                onClick={() => setLang('ru')}
                className={`rounded px-2.5 py-1 text-xs transition-colors ${
                  lang === 'ru' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                }`}
              >
                RU
              </button>
            </div>
          </div>
        </header>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
