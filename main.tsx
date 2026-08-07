import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import AdminApp from './AdminApp.tsx';
import HomeApp from './HomeApp.tsx';
import AuthApp from './AuthApp.tsx';
import TermsApp from './TermsApp.tsx';
import './index.css';
import { LanguageProvider } from './lib/LanguageContext.tsx';

const path = window.location.pathname;
const isAdminRoute = path.startsWith('/admin');
const isHomeRoute = path === '/' || path === '';
const isAuthRoute = path.startsWith('/signin') || path.startsWith('/register');
const isTermsRoute = path.startsWith('/terms') || path.startsWith('/privacy');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdminRoute ? (
      <AdminApp />
    ) : (
      <LanguageProvider>
        {isHomeRoute ? <HomeApp /> : isAuthRoute ? <AuthApp /> : isTermsRoute ? <TermsApp /> : <App />}
      </LanguageProvider>
    )}
  </StrictMode>,
);

