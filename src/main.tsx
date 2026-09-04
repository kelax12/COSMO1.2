import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App.tsx';
import { RootErrorBoundary } from './components/RootErrorBoundary';
import { installEarlyHandlers, startMonitoring } from './lib/monitoring';
import { applyTheme, resolveInitialTheme } from './lib/theme';
import { captureFirstTouch } from './lib/attribution';
import { mountAudienceScript } from './lib/audience';
// Import direct du module de locale (et non du barrel `@/i18n`) : le barrel
// ré-exporte `format.ts`, qui tire les locales `date-fns` — inutile ici et
// alourdirait le chunk d'entrée.
import { DEFAULT_LOCALE, applyLocale, resolveInitialLocale, type Locale } from './i18n/locale';
import { resolveRouterBootstrap } from './i18n/bootstrap';
import { loadCatalogs } from './i18n/catalog';
import './index.css';

// ═══════════════════════════════════════════════════════════════════
// Sentry — CHARGÉ APRÈS LE PREMIER RENDU (arbitrage C-13 · C-14)
// ═══════════════════════════════════════════════════════════════════
//
// 49,3 ko gzip payés par TOUT visiteur, sur le chemin critique, pour un
// paquet dont on n'a besoin qu'au premier incident. La décision du
// 2026-09-03 le sort de là.
//
// 🔴 L'ANGLE MORT QUE LA DÉCISION NOMME, ET SA RÉPONSE. « Les erreurs des
// premières millisecondes ne seraient plus capturées, et c'est exactement la
// fenêtre du bug de `Layout` du 2026-09-03. » Deux mesures, posées AVANT
// tout le reste :
//
//   1. `installEarlyHandlers()` — un `window.onerror` et un
//      `unhandledrejection` minimaux, quelques lignes, aucun paquet ;
//   2. `src/lib/monitoring.ts` tamponne TOUT appel arrivé avant que le SDK
//      soit là, et le rejoue ensuite. Rien n'est perdu, seul l'envoi est
//      retardé.
//
// ⚠️ Ces deux lignes doivent rester les PREMIÈRES instructions exécutables du
//    fichier. Tout ce qui les précède s'exécute sans filet.
installEarlyHandlers();

// M-9 — sendDefaultPii: false strips Sentry's auto-collected user identifiers
// (IP, cookies). It does NOT scrub PII that lands in error.message itself —
// Supabase errors routinely include emails and UUIDs in their message. This
// beforeSend hook regex-strips both from message + exception values before
// the event leaves the browser. Defense-in-depth for RGPD.
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const scrub = (s: string): string => s.replace(EMAIL_RE, '[email]').replace(UUID_RE, '[uuid]');

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

/**
 * Configuration du SDK. Reste ICI, et pas dans `monitoring.ts` : le scrubbing
 * RGPD et l'échantillonnage se relisent au même endroit que le reste de
 * l'amorçage, pas dans un module utilitaire.
 */
function initSentry(Sentry: typeof import('./lib/sentry-client')): void {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    // Release = SHA du commit (injecté par vite.config `define` depuis
    // VERCEL_GIT_COMMIT_SHA). Lie chaque erreur/transaction au déploiement
    // exact → régressions attribuables à un commit, et rollback ciblé.
    release: __APP_RELEASE__,
    // ⚠️ COÛT ASSUMÉ DE LA DÉCISION : initialisée après le premier rendu,
    // `browserTracingIntegration` ne voit qu'une partie du `pageload`. La
    // transaction de chargement est dégradée. Ça porte sur la MESURE de
    // performance, pas sur la capture d'erreurs — celle-ci est intégralement
    // préservée par le tampon de `monitoring.ts`.
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
// AUD-17 — `import.meta.env.DEV` : sans ce garde, n'importe qui pouvait faire
// injecter un <script> tiers (jsdelivr) dans l'app de PRODUCTION avec un simple
// `?debug=1`. La CSP le bloquait déjà (`script-src 'self' …` n'autorise pas
// jsdelivr), mais on ne veut pas dépendre d'un header pour ne pas exécuter du
// code distant : le jour où quelqu'un élargit la CSP, la porte se rouvre. Le
// bloc est désormais éliminé du bundle prod par le tree-shaking de Vite.
if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('debug')) {
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
// toujours en mode clair : les classes de thème n'étaient posées que par
// useDarkMode, monté uniquement dans l'app authentifiée. La résolution et
// l'application partagent le même module que le hook (src/lib/theme.ts) pour
// qu'un flash de thème incorrect reste impossible.
try {
  applyTheme(document.documentElement, resolveInitialTheme());
} catch { /* localStorage/matchMedia inaccessibles (navigation privée stricte) */ }

// Attribution first-touch — AVANT l'amorçage i18n, qui fait un `replaceState`
// susceptible de réécrire l'URL : la query string doit encore être celle que
// le visiteur a réellement ouverte.
try {
  captureFirstTouch();
} catch { /* l'analytics ne doit jamais empêcher l'app de démarrer */ }

// Mesure d'audience — injectee ICI et plus par une balise d'index.html, pour
// qu'elle ne soit JAMAIS presente quand une session existe. C'est le seul
// script tiers de l'origine, et le jeton de session vit dans le localStorage :
// charge sur toute la SPA, un compromis du fournisseur donnait la prise de
// controle des comptes connectes. Detail et limite assumee : src/lib/audience.ts.
//
// Apres `captureFirstTouch` : l'attribution doit lire la query string d'origine
// avant tout, et ne depend pas d'un tiers.
try {
  mountAudienceScript(document, {
    pathname: window.location.pathname,
    storage: window.localStorage,
  });
} catch { /* la mesure ne doit jamais empêcher l'app de démarrer */ }

// ──────────────────────────────────────────────────────────────────
// Amorçage i18n — locale, canonicalisation d'URL et `basename` du routeur.
//
// Fait AVANT le premier paint pour deux raisons distinctes :
//   - `<html lang>` est lu au chargement par les lecteurs d'écran et les
//     moteurs ; le corriger après coup arrive trop tard.
//   - `replaceState` doit précéder le montage du routeur, sinon React Router
//     lit l'ancienne URL et rend une première page pour rien.
//
// `basename` est ce qui permet aux 162 `Link`/`navigate` absolus déjà présents
// dans l'app de se préfixer automatiquement — cf. l'en-tête de
// src/i18n/bootstrap.ts.
// ──────────────────────────────────────────────────────────────────
let routerBasename = '/';
let activeLocale: Locale = DEFAULT_LOCALE;
try {
  const bootstrap = resolveRouterBootstrap({
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  });
  routerBasename = bootstrap.basename;
  activeLocale = bootstrap.locale;
  applyLocale(document.documentElement, bootstrap.locale);
  if (bootstrap.replaceUrl && bootstrap.replaceUrl !== window.location.pathname + window.location.search + window.location.hash) {
    window.history.replaceState(null, '', bootstrap.replaceUrl);
  }
} catch {
  /* localStorage/navigator inaccessibles (navigation privée stricte) — on reste
     sur la locale par défaut à la racine, ce qui est toujours servable. */
  try {
    applyLocale(document.documentElement, resolveInitialLocale());
  } catch { /* rien de plus à tenter */ }
}

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

// Les comportements v7 (startTransition, relativeSplatPath) sont les defauts
// depuis la 7.0 — le prop `future` n'a plus lieu d'etre. Ils ont ete adoptes
// par etapes sur la 6.30 avant ce bump (cf. plan de migration 2026-07-29).
function mount(): void {
  createRoot(document.getElementById('root')!).render(
    // RootErrorBoundary ENGLOBE le routeur et donc tous les providers. Sans
    // lui, une erreur dans AuthProvider / ActiveOrgProvider / BillingProvider
    // ou dans le chunk du Layout demontait l app entiere et ne laissait que
    // le fond du body : ecran noir en theme sombre, page blanche en clair,
    // et plus aucun bouton pour se deconnecter.
    <RootErrorBoundary>
      <BrowserRouter basename={routerBasename}>
        <App />
      </BrowserRouter>
    </RootErrorBoundary>
  );
}

// Catalogues de la langue active chargés AVANT le premier rendu — sinon le
// repli `fr` s'appliquerait le temps du chargement et l'utilisateur verrait un
// flash de français avant que sa langue n'apparaisse.
//
// En français (cas majoritaire) `loadCatalogs` résout de façon synchrone-
// équivalente : aucun fichier à chercher, donc un simple tour de microtask —
// pas de retard mesurable au premier paint. C'est ce qui permet d'attendre
// inconditionnellement plutôt que de brancher sur la locale.
//
// `catch` et non `finally` sur l'échec : on monte l'app quoi qu'il arrive. Une
// langue dont les catalogues n'ont pas pu être chargés rend en français, ce qui
// reste infiniment préférable à une page blanche.
loadCatalogs(activeLocale).catch(() => undefined).then(() => {
  mount();

  // ── Sentry, APRÈS le premier rendu ────────────────────────────────
  //
  // `requestIdleCallback` et pas un `setTimeout(0)` : on veut la première
  // fenêtre d'inactivité, pas la prochaine tâche — qui tomberait en plein
  // milieu du travail de montage qu'on cherche justement à ne pas ralentir.
  // Repli `setTimeout` pour Safari, qui ne l'implémente toujours pas.
  //
  // ⚠️ Le tampon de `monitoring.ts` couvre tout l'intervalle : ce délai
  //    retarde l'ENVOI, il ne perd rien.
  if (sentryDsn) {
    const load = () => { void startMonitoring(initSentry); };
    const idle = (window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void;
    }).requestIdleCallback;
    if (idle) idle(load, { timeout: 3000 });
    else setTimeout(load, 0);
  }
});
