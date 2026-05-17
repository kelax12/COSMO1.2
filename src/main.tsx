import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

// Mobile debug console — only loaded when the URL contains ?debug=1.
// Lets us read timing logs on iOS Safari without needing a Mac for remote
// inspection. Stay loaded for the rest of the session.
if (new URLSearchParams(window.location.search).has('debug')) {
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/eruda';
  script.onload = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eruda = (window as unknown as { eruda?: { init: () => void } }).eruda;
    eruda?.init();
    console.warn('[DEBUG] Eruda console ready. Hard refresh now to capture init timings.');
  };
  document.head.appendChild(script);
}

// Mark the very start so we can measure absolute time-to-X later. Using
// `performance.timeOrigin` is the most precise reference available in browsers.
performance.mark('cosmo:boot');

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

  // Real HTTP warmup — fire a cheap unauthenticated request to wake the socket.
  // /auth/v1/health returns ~30 bytes and doesn't need any header. We fully ignore
  // the result; the only goal is to make iOS Safari commit to the connection
  // before any meaningful fetch runs.
  fetch(`${supabaseUrl}/auth/v1/health`, { method: 'GET', mode: 'cors', credentials: 'omit' })
    .catch(() => { /* expected to sometimes fail — we don't care */ });
}

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
