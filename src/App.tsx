import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { AuthPage } from './pages/AuthPage';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { EntriesPage } from './pages/EntriesPage';
import { LimitsPage } from './pages/LimitsPage';
import { MasterDataPage } from './pages/MasterDataPage';
import { UsersPage } from './pages/UsersPage';
import { AuditPage } from './pages/AuditPage';
import { DocsPage } from './pages/DocsPage';
import type { AppRole } from './lib/supabase';

export type ViewKey =
  | 'dashboard'
  | 'entries'
  | 'limits'
  | 'master-data'
  | 'users'
  | 'audit'
  | 'docs';

function AppContent() {
  const { session, profile, roles, loading } = useAuth();
  const [view, setView] = useState<ViewKey>('dashboard');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
      </div>
    );
  }

  if (!session || !profile) {
    return <AuthPage />;
  }

  const hasAny = (rs: AppRole[]) => rs.some((r) => roles.includes(r));

  const renderView = () => {
    switch (view) {
      case 'dashboard':
        return <DashboardPage />;
      case 'entries':
        return hasAny(['admin', 'gsm', 'operator', 'master']) ? <EntriesPage /> : <DashboardPage />;
      case 'limits':
        return hasAny(['admin', 'gsm', 'operator', 'management']) ? <LimitsPage /> : <DashboardPage />;
      case 'master-data':
        return hasAny(['admin', 'operator']) ? <MasterDataPage /> : <DashboardPage />;
      case 'users':
        return hasAny(['admin']) ? <UsersPage /> : <DashboardPage />;
      case 'audit':
        return hasAny(['admin', 'gsm', 'operator']) ? <AuditPage /> : <DashboardPage />;
      case 'docs':
        return <DocsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <AppLayout currentView={view} onNavigate={setView}>
      {renderView()}
    </AppLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
