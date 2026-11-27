import { startTransition, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { scrubBreadcrumb, scrubEvent } from './lib/sentry-scrub';
import { makeTracesSampler, parameterizeRoute, parseTracesSampleRate, scrubTransaction, tracingEnabled } from './lib/sentry-tracing';
import { readConsent, subscribe as subscribeConsent } from './lib/cookie-consent';
import { BrowserRouter } from 'react-router';
import App from './App.tsx';
import { RootErrorBoundary } from './components/RootErrorBoundary';
import { installEarlyHandlers, startMonitoring } from './lib/monitoring';
import { applyTheme, resolveInitialTheme } from './lib/theme';
import { captureFirstTouch } from './lib/attribution';
import { captureAffiliate } from './lib/affiliation';
import { startTrafficMeasurement } from './lib/traffic';
import { isBotUserAgent } from './lib/traffic-ua';
// Import direct du module de locale (et non du barrel `@/i18n`) : le barrel
// ré-exporte `format.ts`, qui tire les locales `date-fns` — inutile ici et
// alourdirait le chunk d'entrée.
import { applyRouterBootstrap } from './i18n/apply-bootstrap';
import { loadCatalogs } from './i18n/catalog';
import { loadDateLocale } from './i18n/format';
import { afterFirstPaint } from './lib/after-first-paint';
import { installFocusHistory } from './lib/focus-history';
import './index.css';

// ═══ Sentry : CHARGÉ APRÈS LE PREMIER RENDU (C-13, C-14) ═══
// 🔴 Les erreurs des premières millisecondes restent capturées : `installEarlyHandlers()` (`window.onerror` + `unhandledrejection`, aucun paquet) et le tampon de `src/lib/monitoring.ts`, qui rejoue tout appel arrivé avant le SDK.
// ⚠️ Ces deux lignes doivent rester les PREMIÈRES instructions exécutables du fichier : ce qui les précède s'exécute sans filet.
installEarlyHandlers();

// M-9 : `dataCollection` (Sentry 11) coupe ce que le SDK collecte de lui-même (identité, cookies, corps, requêtes d'URL). Il ne nettoie PAS la PII dans error.message ni les ADRESSES de page (jetons d'invitation, codes OAuth) : `@/lib/sentry-scrub` les retire.

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

/** Taux d'échantillonnage des transactions (OBS-02), 0,1 par défaut. */
const tracesSampleRate = parseTracesSampleRate(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE);

/** Mesure de performance (navigation, requêtes, interactions longues). Noms de route paramétrés avant le span, nettoyés dans `beforeSendTransaction`. */
function tracingIntegration(Sentry: typeof import('./lib/sentry-client')) {
  return Sentry.browserTracingIntegration({
    beforeStartSpan: (options) => ({ ...options, name: parameterizeRoute(options.name) }),
    enableInp: true,
    enableLongTask: true,
    enableLongAnimationFrame: true,
  });
}

let tracingAdded = false;
/** Ajoute le traçage à chaud quand la personne accepte APRÈS l'amorçage de Sentry. */
function enableTracingOnConsent(Sentry: typeof import('./lib/sentry-client')): void {
  const add = () => {
    if (tracingAdded || !tracingEnabled(readConsent())) return;
    tracingAdded = true;
    try { Sentry.addIntegration(tracingIntegration(Sentry)); } catch { tracingAdded = false; }
  };
  subscribeConsent(add);
}

/** Configuration du SDK. Reste ICI (scrubbing RGPD et échantillonnage se relisent avec l'amorçage), pas dans `monitoring.ts`. */
function initSentry(Sentry: typeof import('./lib/sentry-client')): void {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    // Release = SHA du commit (injecté par vite.config `define` depuis
    // VERCEL_GIT_COMMIT_SHA). Lie chaque erreur/transaction au déploiement
    // exact → régressions attribuables à un commit, et rollback ciblé.
    release: __APP_RELEASE__,
    // ⚠️ Initialisée après le premier rendu : `browserTracingIntegration` ne voit qu'une partie du `pageload` (mesure dégradée, capture d'erreurs intacte via le tampon).
    // OBS-02 : le traçage est CONDITIONNÉ au consentement (docs/OBSERVABILITE.md § Mesure de performance) : sans « Accepter », ni transaction ni en-tête `sentry-trace` ; ajouté à chaud ensuite (`enableTracing`).
    integrations: tracingEnabled(readConsent()) ? [tracingIntegration(Sentry)] : [],
    tracesSampler: makeTracesSampler(tracesSampleRate, readConsent),
    // Propage la trace aux requêtes Supabase (corrèle un appel lent à sa transaction front).
    // 🔴 JAMAIS `/functions/v1/` : les Edge Functions refusent `baggage`/`sentry-trace` en pré-requête (M-32). Garde : `src/sentry-propagation.guard.test.ts`.
    tracePropagationTargets: [/^\//, /supabase\.co\/(?!functions\/v1\/)/],
    // Sentry 11 : `dataCollection` ABSENT = TOUT collecter. Chaque clé est à faux, sauf `User-Agent`. `Referer` retiré (peut porter un jeton d'invitation). Garde : `src/lib/sentry-tracing.test.ts`.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { request: { allow: ['User-Agent'] }, response: false },
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    },
    // Sentry 11 diffuse les spans au fil de l'eau par défaut, et ignore alors
    // `beforeSendTransaction` : le nettoyage `scrubTransaction` ne tournerait
    // plus. `'static'` garde le modèle à transactions, et donc ce nettoyage.
    traceLifecycle: 'static',
    // La v11 attache une pile à `captureMessage` par défaut : nouveaux groupes
    // d'incidents. Comportement de la v10 conservé.
    attachStacktrace: false,
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
    ],
    beforeSend: (event) => scrubEvent(event),
    beforeSendTransaction: (event) => scrubTransaction(scrubEvent(event), readConsent()),
    beforeBreadcrumb: (crumb) => scrubBreadcrumb(crumb),
  });
  tracingAdded = tracingEnabled(readConsent());
  enableTracingOnConsent(Sentry);
}

// Console de debug mobile, chargée sur `?debug=1`. AUD-17 : `import.meta.env.DEV` obligatoire, sinon un `?debug=1` injecterait un <script> tiers dans la PROD (ne pas dépendre de la CSP). Éliminé du bundle prod par tree-shaking.
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

// Thème appliqué AVANT le premier paint, pages publiques incluses (module partagé avec le hook, src/lib/theme.ts : pas de flash).
try {
  applyTheme(document.documentElement, resolveInitialTheme());
} catch { /* localStorage/matchMedia inaccessibles (navigation privée stricte) */ }

// Attribution first-touch — AVANT l'amorçage i18n, qui fait un `replaceState`
// susceptible de réécrire l'URL : la query string doit encore être celle que
// le visiteur a réellement ouverte.
try {
  captureFirstTouch();
  captureAffiliate();
} catch { /* l'analytics ne doit jamais empêcher l'app de démarrer */ }

// ── Amorçage i18n : locale, canonicalisation d'URL et `basename` du routeur ──
// Avant le premier paint : `<html lang>` est lu au chargement, et `replaceState` doit précéder le montage du routeur. `basename` préfixe les `Link`/`navigate` absolus (src/i18n/bootstrap.ts).
// ⚠️ `src/boot.ts` l'a DÉJÀ appliqué : cet appel ne réécrit rien, il lit `basename` et la locale (`i18n/apply-bootstrap.ts`).
const { basename: routerBasename, locale: activeLocale } = applyRouterBootstrap();

// Bug WebKit iOS : le PREMIER fetch cross-origin du chargement peut échouer (« Load failed ») après ~10 s. Un `preconnect` ne suffit pas : une vraie requête HEAD Supabase part avant le montage de React, socket chaud pour `useTasks/useHabits`.
// Réfs : https://github.com/supabase/supabase-js/issues/684 · https://bugs.webkit.org/show_bug.cgi?id=171501
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

  // Échauffement par requêtes non authentifiées sur /auth/v1 ET /rest/v1 : iOS Safari rejette les 3-4 flux HTTP/2 parallèles suivants s'ils partent trop près du premier paint.
  // 🔴 Jamais pour un robot ni un navigateur sans tête : chaque chargement y coûte deux 401 comptés par
  // `check-prod-errors` (famille `sonde_uptime`), et un robot SEO qui rend les pages l'a fait rougir le 2026-11-27.
  if (!isBotUserAgent(navigator.userAgent)) {
    fetch(`${supabaseUrl}/auth/v1/health`, { method: 'GET', mode: 'cors', credentials: 'omit' })
      .catch(() => { /* expected to sometimes fail — we don't care */ });
    fetch(`${supabaseUrl}/rest/v1/`, { method: 'GET', mode: 'cors', credentials: 'omit' })
      .catch(() => { /* expected to sometimes fail — we don't care */ });
  }
}

// Mesure d'audience maison (mig. 222), APRÈS l'amorçage i18n (une URL réécrite ne se compte pas deux fois). Le module vérifie avant CHAQUE envoi consentement, page publique et absence de session (src/lib/traffic.ts).
try {
  startTrafficMeasurement({ win: window, doc: document });
} catch { /* la mesure ne doit jamais empêcher l'app de démarrer */ }

// Avant toute modale : le declencheur d'une surface doit deja etre dans l'historique des focus a son
// ouverture (src/lib/focus-history.ts). Garde : modal-a11y.guard.test.ts.
try { installFocusHistory(); } catch { /* un historique absent degrade la restitution du focus, jamais le demarrage */ }

// Les comportements v7 (startTransition, relativeSplatPath) sont les defauts
// depuis la 7.0 — le prop `future` n'a plus lieu d'etre. Ils ont ete adoptes
// par etapes sur la 6.30 avant ce bump (cf. plan de migration).
function mount(): void {
  const root = createRoot(document.getElementById('root')!);
  // 🔴 Page prérendue : premier rendu en TRANSITION (TBT mobile), par tranches ; la page prérendue est déjà peinte. La coquille `app.html` rend d'un bloc.
  const rendre = (el: ReactNode) =>
    isPrerendered ? startTransition(() => root.render(el)) : root.render(el);
  rendre(
    // RootErrorBoundary ENGLOBE le routeur et tous les providers : sans lui, une erreur de provider ou du chunk Layout démonte l'app (écran vide, plus de déconnexion).
    <RootErrorBoundary>
      <BrowserRouter basename={routerBasename}>
        <App />
      </BrowserRouter>
    </RootErrorBoundary>
  );
}

// Catalogues de la langue active chargés AVANT le premier rendu (sinon flash de français). En français `loadCatalogs` se résout en une microtask : on attend sans brancher sur la locale. `catch` et non `finally` : on monte l'app quoi qu'il arrive (repli `fr`).
// ── C-116 : laisser PEINDRE le prérendu avant que React ne le remplace ── seulement sur une page prérendue ; la coquille `app.html` monte tout de suite (`lib/after-first-paint.ts`).
const isPrerendered = document.documentElement.hasAttribute('data-prerendered');

Promise.all([loadCatalogs(activeLocale), loadDateLocale(activeLocale)]).catch(() => undefined).then(() => new Promise<void>((resolve) => {
  if (isPrerendered) afterFirstPaint(resolve);
  else resolve();
})).then(() => {
  mount();

  // ── Sentry, APRÈS le premier rendu ──
  // `requestIdleCallback` (première inactivité, pas la prochaine tâche), repli `setTimeout` pour Safari.
  // ⚠️ Le tampon de `monitoring.ts` couvre l'intervalle : ce délai retarde l'ENVOI, il ne perd rien.
  if (sentryDsn) {
    const load = () => { void startMonitoring(initSentry); };
    const idle = (window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void;
    }).requestIdleCallback;
    if (idle) idle(load, { timeout: 3000 });
    else setTimeout(load, 0);
  }
});
