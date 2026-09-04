// ═══════════════════════════════════════════════════════════════════
// MONITORING — la seule porte vers Sentry, et elle tamponne
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI CE MODULE EXISTE (arbitrage C-13 · C-14 du 2026-09-03).
//
// « Différer Sentry après le premier rendu : 49,3 ko sortent du chemin
// critique, soit quatre fois la marge actuelle. »
//
// Différer l'`init()` ne suffisait PAS. Onze fichiers du SHELL faisaient
// `import * as Sentry from '@sentry/react'` — les deux frontières d'erreur,
// `normalizeApiError`, `AuthContext`, les trois canaux Realtime… Un seul
// import statique suffit à garder le paquet dans le chunk d'entrée, quel que
// soit le moment où on l'initialise. Ce module est donc la SEULE porte : il
// est importé statiquement partout, et c'est LUI qui charge Sentry en
// `import()` dynamique.
//
// ❌ Ne jamais réintroduire un `import ... from '@sentry/react'` ailleurs
//    qu'ici. `src/monitoring.guard.test.ts` le refuse, avec son témoin.
//
// ── L'ANGLE MORT, ET COMMENT IL EST COMBLÉ ──────────────────────────
//
// 🔴 L'arbitrage nomme lui-même le risque : « les erreurs des premières
// millisecondes ne seraient plus capturées, et c'est exactement la fenêtre du
// bug de `Layout` du 2026-09-03 » — celui qui rendait l'écran d'erreur sur
// une valeur de `localStorage`, avant que quoi que ce soit soit monté.
//
// D'où le TAMPON. Tout appel arrivé avant que Sentry soit chargé est mis de
// côté, et rejoué tel quel une fois le SDK prêt. Rien n'est perdu, seul
// l'envoi est retardé — ce qui est exactement le compromis décidé.
//
// ── CE QUE CE MODULE NE FAIT JAMAIS ─────────────────────────────────
//
// ❌ Il ne lève pas. Un module d'observabilité qui casse l'application qu'il
//    observe est pire que pas d'observabilité du tout. Tout est sous `try`.
// ❌ Il ne grandit pas sans borne. Un tampon non borné sur une boucle
//    d'erreurs (un `useEffect` qui relance, un rendu en échec) mangerait la
//    mémoire de l'onglet. Au-delà de `BUFFER_MAX`, on compte au lieu de
//    garder, et le compte part avec le premier événement rejoué : savoir
//    qu'on a perdu N événements vaut mieux que de les perdre en silence.
//
// ── LE COÛT ASSUMÉ ──────────────────────────────────────────────────
//
// ⚠️ `browserTracingIntegration` instrumente le `pageload`. Initialisée après
//    le premier rendu, elle en voit une partie seulement : la transaction de
//    chargement est dégradée. C'est le prix de l'arbitrage, et il porte sur
//    la MESURE de performance, pas sur la capture d'erreurs — qui, elle, est
//    intégralement préservée par le tampon.

// ⚠️ La surface passe par `sentry-client.ts`, qui réexporte NOMMÉMENT les six
// fonctions utilisées. Un `typeof import('@sentry/react')` ici rendrait le
// namespace entier, que Rollup ne peut pas élaguer : mesuré, le chunk passait
// de 49,3 à 155,9 ko. Détail complet dans `sentry-client.ts`.
type SentryModule = typeof import('./sentry-client');

/** Contexte accepté par `Sentry.captureException`, sans dépendre de son type. */
export interface CaptureContext {
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  tags?: Record<string, string | undefined>;
  contexts?: Record<string, Record<string, unknown> | undefined>;
  extra?: Record<string, unknown>;
}

/**
 * Taille du tampon. 50 est large pour la fenêtre visée (quelques centaines de
 * millisecondes) et petit devant la mémoire d'un onglet.
 */
const BUFFER_MAX = 50;

let sentry: SentryModule | null = null;
let loading: Promise<void> | null = null;
const buffer: { error: unknown; context?: CaptureContext }[] = [];
const messages: { message: string; context?: CaptureContext | 'warning' | 'info' }[] = [];
const crumbs: { category?: string; level?: string; message?: string }[] = [];
let lastUser: { id: string } | null = null;
let hasUser = false;
let dropped = 0;

/** Handlers précoces, retirés dès que Sentry pose les siens. */
let earlyErrorHandler: ((event: ErrorEvent) => void) | null = null;
let earlyRejectionHandler: ((event: PromiseRejectionEvent) => void) | null = null;

/**
 * Signale une exception.
 *
 * Remplace `Sentry.captureException`. Avant le chargement du SDK, l'appel est
 * mis en tampon ; après, il passe directement.
 */
export function captureException(error: unknown, context?: CaptureContext): void {
  try {
    if (sentry) {
      sentry.captureException(error, context as Parameters<SentryModule['captureException']>[1]);
      return;
    }
    if (buffer.length < BUFFER_MAX) buffer.push({ error, context });
    else dropped += 1;
  } catch {
    /* l'observabilité ne casse jamais ce qu'elle observe */
  }
}

/**
 * Signale un message (pas une exception).
 *
 * Remplace `Sentry.captureMessage`. Même tampon, même garantie.
 */
export function captureMessage(message: string, context?: CaptureContext | 'warning' | 'info'): void {
  try {
    if (sentry) {
      sentry.captureMessage(message, context as Parameters<SentryModule['captureMessage']>[1]);
      return;
    }
    if (messages.length < BUFFER_MAX) messages.push({ message, context });
    else dropped += 1;
  } catch { /* l'observabilité ne casse jamais ce qu'elle observe */ }
}

/**
 * Fil d'Ariane.
 *
 * ⚠️ Un breadcrumb n'a de valeur que s'il PRÉCÈDE l'erreur qu'il explique : le
 * rejeu les repose donc AVANT les exceptions mises en tampon, pas après.
 */
export function addBreadcrumb(crumb: { category?: string; level?: string; message?: string }): void {
  try {
    if (sentry) {
      sentry.addBreadcrumb(crumb as Parameters<SentryModule['addBreadcrumb']>[0]);
      return;
    }
    if (crumbs.length < BUFFER_MAX) crumbs.push(crumb);
  } catch { /* idem */ }
}

/**
 * Associe (ou dissocie) l'utilisateur courant.
 *
 * ⚠️ Seule la DERNIÈRE valeur compte : c'est un état, pas un événement. La
 * rejouer en séquence associerait un ancien compte à des erreurs récentes.
 */
export function setUser(user: { id: string } | null): void {
  try {
    lastUser = user;
    hasUser = true;
    if (sentry) sentry.setUser(user);
  } catch { /* idem */ }
}

/** Le tampon, pour les tests. Jamais utilisé par le produit. */
export function __bufferedForTest(): readonly { error: unknown; context?: CaptureContext }[] {
  return buffer;
}

/**
 * Pose les filets précoces : tout ce qui casse AVANT que Sentry soit chargé
 * atterrit dans le même tampon.
 *
 * À appeler le plus tôt possible dans `main.tsx`, avant le montage.
 */
export function installEarlyHandlers(): void {
  if (typeof window === 'undefined' || earlyErrorHandler) return;
  earlyErrorHandler = (event: ErrorEvent) => {
    captureException(event.error ?? new Error(event.message), {
      tags: { captured_by: 'early-handler' },
    });
  };
  earlyRejectionHandler = (event: PromiseRejectionEvent) => {
    captureException(event.reason, { tags: { captured_by: 'early-handler' } });
  };
  window.addEventListener('error', earlyErrorHandler);
  window.addEventListener('unhandledrejection', earlyRejectionHandler);
}

function removeEarlyHandlers(): void {
  if (typeof window === 'undefined') return;
  // 🔴 RETIRÉS dès que Sentry pose les siens, sinon chaque erreur globale part
  //    DEUX fois : une par notre filet, une par celui du SDK.
  if (earlyErrorHandler) window.removeEventListener('error', earlyErrorHandler);
  if (earlyRejectionHandler) window.removeEventListener('unhandledrejection', earlyRejectionHandler);
  earlyErrorHandler = null;
  earlyRejectionHandler = null;
}

/**
 * Charge Sentry, l'initialise, puis REJOUE le tampon.
 *
 * Idempotente : plusieurs appels ne chargent qu'une fois.
 *
 * @param init reçoit le module chargé et fait l'`init()`. Le passer en argument
 *   garde toute la configuration (DSN, scrubbing RGPD, échantillonnage) dans
 *   `main.tsx`, où elle se relit, plutôt que de la disperser ici.
 */
export function startMonitoring(init: (mod: SentryModule) => void): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    try {
      const mod = await import('./sentry-client');
      init(mod);
      sentry = mod;
      removeEarlyHandlers();

      // ⚠️ L'ORDRE DU REJEU N'EST PAS ARBITRAIRE.
      //   1. l'utilisateur : c'est un ÉTAT, il doit être posé avant tout
      //      événement, sinon les premiers partent anonymes ;
      //   2. les fils d'Ariane : ils n'ont de valeur que s'ils PRÉCÈDENT
      //      l'erreur qu'ils expliquent ;
      //   3. les exceptions et messages, dans leur ordre d'arrivée.
      if (hasUser) {
        try { mod.setUser(lastUser); } catch { /* rien de plus à tenter */ }
      }
      for (const crumb of crumbs.splice(0, crumbs.length)) {
        try { mod.addBreadcrumb(crumb as Parameters<SentryModule['addBreadcrumb']>[0]); } catch { /* idem */ }
      }
      for (const entry of messages.splice(0, messages.length)) {
        try {
          mod.captureMessage(
            entry.message,
            entry.context as Parameters<SentryModule['captureMessage']>[1],
          );
        } catch { /* un événement illisible n'empêche pas les suivants */ }
      }
      for (const entry of buffer.splice(0, buffer.length)) {
        try {
          mod.captureException(
            entry.error,
            entry.context as Parameters<SentryModule['captureException']>[1],
          );
        } catch { /* un événement illisible n'empêche pas les suivants */ }
      }

      // ⚠️ Dire ce qu'on a perdu vaut mieux que de le perdre en silence.
      if (dropped > 0) {
        try {
          mod.captureMessage(`monitoring: ${dropped} evenement(s) perdus avant chargement`, 'warning');
        } catch { /* rien de plus à tenter */ }
        dropped = 0;
      }
    } catch {
      // Sentry injoignable (bloqueur de pub, réseau) : l'application continue.
      // Le tampon reste en place et se videra si un rechargement réussit.
      loading = null;
    }
  })();
  return loading;
}

/** Remet le module à zéro. Tests uniquement. */
export function __resetForTest(): void {
  sentry = null;
  loading = null;
  buffer.length = 0;
  messages.length = 0;
  crumbs.length = 0;
  lastUser = null;
  hasUser = false;
  dropped = 0;
  removeEarlyHandlers();
}
