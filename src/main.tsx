import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import App from './App.tsx';
import './index.css';

// Sentry — error monitoring prod (faille §14 / I3). Init synchrone, AVANT le
// warmup iOS Safari pour capturer aussi les erreurs très précoces. Désactivé
// silencieusement si VITE_SENTRY_DSN est absent (utile en dev local).
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  // M-9 — sendDefaultPii: false strips Sentry's auto-collected user identifiers
  // (IP, cookies). It does NOT scrub PII that lands in error.message itself —
  // Supabase errors routinely include emails and UUIDs in their message. This
  // beforeSend hook regex-strips both from message + exception values before
  // the event leaves the browser. Defense-in-depth for RGPD.
  const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
  const scrub = (s: string): string => s.replace(EMAIL_RE, '[email]').replace(UUID_RE, '[uuid]');

  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    // Release = SHA du commit (injecté par vite.config `define` depuis
    // VERCEL_GIT_COMMIT_SHA). Lie chaque erreur/transaction au déploiement
    // exact → régressions attribuables à un commit, et rollback ciblé.
    release: __APP_RELEASE__,
    // Tracing perf activé à 10 % (audit architecture TOP-7 — angle mort
    // observabilité). browserTracingIntegration auto-instrumente pageload +
    // navigations SPA. Échantillonnage bas pour rester dans le quota Sentry
    // tout en donnant une visibilité TTFB/LCP/navigations en prod.
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    // Propage le contexte de trace aux requêtes Supabase (corrèle un appel
    // PostgREST/RPC lent à la transaction front qui l'a déclenché).
    tracePropagationTargets: [/^\//, /supabase\.co/],
    sendDefaultPii: false,
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
    ],
    beforeSend(event) {
      if (event.message) event.message = scrub(event.message);
      if (event.exception?.values) {
        for (const ex of event.exception.values) {
          if (ex.value) ex.value = scrub(ex.value);
        }
      }
      if (event.breadcrumbs) {
        for (const crumb of event.breadcrumbs) {
          if (crumb.message) crumb.message = scrub(crumb.message);
        }
      }
      return event;
    },
  });
}

// Mobile debug console — only loaded when the URL contains ?debug=1.
// Lets us read timing logs on iOS Safari without needing a Mac for remote
// inspection. Stay loaded for the rest of the session.
if (new URLSearchParams(window.location.search).has('debug')) {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/eruda';
  script.onload = () => {
    const eruda = (window as unknown as { eruda?: { init: () => void } }).eruda;
    eruda?.init();
    console.warn('[DEBUG] Eruda console ready. Hard refresh now to capture init timings.');
  };
  document.head.appendChild(script);
}

// Mark the very start so we can measure absolute time-to-X later. Using
// `performance.timeOrigin` is the most precise reference available in browsers.
performance.mark('cosmo:boot');

// Thème appliqué AVANT le premier paint, pour toutes les pages — publiques
// incluses. Sans ça, /login /signup /forgot-password /reset-password rendaient
// toujours en mode clair : la classe .dark n'était posée que par useDarkMode,
// monté uniquement dans l'app authentifiée (même logique de résolution :
// localStorage 'theme' puis prefers-color-scheme).
try {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (savedTheme === 'dark' || savedTheme === 'black' || (savedTheme !== 'light' && prefersDark)) {
    document.documentElement.classList.add('dark');
  }
  if (savedTheme === 'black') {
    document.documentElement.classList.add('black');
  }
} catch { /* localStorage inaccessible (navigation privée stricte) — thème clair */ }

// iOS Safari has a well-known WebKit bug where the *very first* cross-origin
// fetch made during page load can fail silently with "Load failed" / DOMException
// after ~10 s. The browser refuses to commit to the new HTTP/2 socket while the
// page is still parsing. `<link rel="preconnect">` does the DNS + TLS handshake
// but is not always enough — a real HTTP request needs to land to "amorce" the
// connection. We fire a tiny HEAD request to a public Supabase endpoint here,
// before React mounts. By the time `useTasks/useHabits` queries fire, the socket
// is hot and the bug does not trigger.
//
// Refs:
//   https://github.com/supabase/supabase-js/issues/684
//   https://bugs.webkit.org/show_bug.cgi?id=171501
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
if (supabaseUrl) {
  const preconnect = document.createElement('link');
  preconnect.rel = 'preconnect';
  preconnect.href = supabaseUrl;
  preconnect.crossOrigin = 'anonymous';
  document.head.appendChild(preconnect);

  const dnsPrefetch = document.createElement('link');
  dnsPrefetch.rel = 'dns-prefetch';
  dnsPrefetch.href = supabaseUrl;
  document.head.appendChild(dnsPrefetch);

  // Real HTTP warmup — fire cheap unauthenticated requests to wake the socket
  // AND warm up the per-origin HTTP/2 streams. One fetch alone is not enough on
  // iOS Safari: it accepts the first stream but rejects the next 3-4 parallel
  // streams with "Load failed" if they fire too close to first paint. We hit
  // both /auth/v1 and /rest/v1 to amorce both subdomains paths used by the app.
  fetch(`${supabaseUrl}/auth/v1/health`, { method: 'GET', mode: 'cors', credentials: 'omit' })
    .catch(() => { /* expected to sometimes fail — we don't care */ });
  fetch(`${supabaseUrl}/rest/v1/`, { method: 'GET', mode: 'cors', credentials: 'omit' })
    .catch(() => { /* expected to sometimes fail — we don't care */ });
}

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
