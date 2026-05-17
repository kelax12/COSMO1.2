import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

// Kick the DNS + TLS handshake to Supabase before React even mounts. Without
// this, the very first useTasks/useHabits query on iOS Safari pays a full
// cold-connection penalty (DNS + TLS + HTTP/2 setup) on top of the request
// itself — measured at ~8–20 s on real devices. Once the link is in the DOM,
// the browser opens the socket in parallel with the JS bundle parsing.
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
}

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
