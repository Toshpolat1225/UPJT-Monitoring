import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { I18nProvider } from './lib/i18n';
import { ThemeProvider } from './lib/theme';
import { Toaster } from 'sonner';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <ThemeProvider>
        <App />
        <Toaster richColors position="top-right" />
      </ThemeProvider>
    </I18nProvider>
  </StrictMode>
);
