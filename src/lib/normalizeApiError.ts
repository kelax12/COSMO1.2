import * as Sentry from '@sentry/react';
import { resolveMessage } from '@/i18n/catalog';
import { localeStore } from '@/i18n/store';

// ═══════════════════════════════════════════════════════════════════
// NORMALISATION DES ERREURS D'API — et pourquoi c'est une vraie `Error`
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI (revue du 2026-09-02). Cette fonction rendait un OBJET LITTÉRAL
// (`{ code, message, originalMessage }`), et 184 sites du dépôt font
// `throw normalizeApiError(...)`. On lançait donc, partout, une valeur qui
// n'est pas une `Error`. Trois conséquences, indépendantes les unes des
// autres :
//
//   1. `error instanceof Error` était FAUX dans tout le produit. Le prédicat
//      `retry` de React Query commence par là : il retombait sur une chaîne
//      vide, donc la garde « ne pas retenter un refus RLS définitif » ne
//      s'appliquait jamais (cf. `src/lib/query-retry.ts`).
//   2. Une valeur non-`Error` n'a pas de PILE. Sentry la classe alors en
//      « Non-Error promise rejection captured », et cette chaîne est
//      explicitement listée dans `ignoreErrors` (`src/main.tsx`) : les rares
//      erreurs d'API qui s'échappaient étaient jetées à l'entrée, sans même
//      un endroit d'où elles venaient.
//   3. Le détail serveur ne partait que dans un `console.error`, et le build
//      de production supprime `console.error` (`vite.config.ts → esbuild.pure`).
//      Le commentaire annonçait « log once for ops/sentry » ; en production il
//      n'allait nulle part.
//
// ❌ Ne JAMAIS revenir à un objet littéral ici. Ce qu'on lance doit être une
//    `Error` : c'est ce que testent les prédicats en aval, et c'est ce qui
//    donne une pile à Sentry.
// ❌ Ne JAMAIS rendre `error.message` du serveur à l'écran (faille V7/N1).
//    `message` est le texte du catalogue ; le texte serveur reste dans
//    `originalMessage`, pour le diagnostic seulement.

export class ApiError extends Error {
  /** Code stable : code PostgREST/Postgres, ou identifiant métier promu. */
  readonly code: string;
  /** Détail SERVEUR. Diagnostic uniquement, jamais rendu à l'écran (V7/N1). */
  readonly originalMessage?: string;

  constructor(code: string, message: string, originalMessage?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.originalMessage = originalMessage;
  }
}

/** Conservé pour les appelants qui nommaient la forme de retour. */
export type NormalizedError = ApiError;

/**
 * Message utilisateur associé à un code d'erreur, `null` si le code n'est pas
 * whitelisté (`src/locales/<locale>/errors.json`, section `api`).
 *
 * La locale est lue à CHAQUE appel, jamais mémorisée au niveau du module : une
 * table figée à l'import garderait la langue du premier rendu même après un
 * changement de langue.
 */
const messageForCode = (code: string): string | null =>
  resolveMessage('errors', `api.${code}`, localeStore.locale);

/** Message de repli — toujours défini dans le catalogue de référence. */
const genericMessage = (): string => messageForCode('GENERIC_ERROR') ?? 'GENERIC_ERROR';

/**
 * Forme d'un identifiant d'erreur métier : `seat_limit_reached`, `expired_link`…
 * Volontairement stricte — elle ne peut pas matcher une phrase Postgres, qui
 * contient des espaces, des majuscules ou des guillemets.
 */
const BUSINESS_CODE_RE = /^[a-z][a-z0-9_]{2,49}$/;

/**
 * Relais des erreurs métier levées par les fonctions SQL.
 *
 * Nos fonctions signalent leurs refus par `RAISE EXCEPTION 'identifiant'`.
 * PostgREST renvoie alors TOUJOURS le même code générique (`P0001`) et place
 * l'identifiant dans `message` — donc une whitelist indexée par `code` ne peut
 * pas les distinguer, et « lien expiré », « quota de sièges atteint » ou
 * « droits insuffisants » tombaient tous sur le message générique.
 *
 * On ne fait JAMAIS confiance au texte serveur pour l'affichage : il sert
 * uniquement de clé de recherche. Si l'identifiant n'est pas dans le
 * catalogue, on garde le message générique — la garantie de la faille V7/N1
 * (ne jamais rendre `error.message`) reste entière.
 */
const promoteBusinessCode = (raw?: string): string | null => {
  if (!raw) return null;
  const candidate = raw.trim();
  if (!BUSINESS_CODE_RE.test(candidate)) return null;
  return messageForCode(candidate) !== null ? candidate : null;
};

interface ApiErrorLike {
  code?: string;
  message?: string;
  error?: {
    code?: string;
    message?: string;
  };
}

/**
 * Trace le détail SERVEUR là où on pourra le relire, c'est-à-dire pas dans la
 * console : le build de production la vide.
 *
 * Deux niveaux, parce que les deux situations n'ont pas la même valeur :
 *
 *  • Fil d'Ariane systématique. Un `PGRST116` (ressource absente) est un
 *    événement NORMAL ; en faire une alerte noierait le signal. Mais s'il
 *    précède un plantage, il explique souvent le plantage : il a donc sa place
 *    dans le contexte de l'erreur suivante, pas dans une alerte à lui seul.
 *  • Alerte quand le code n'est PAS whitelisté. Là, l'utilisateur vient de voir
 *    « une erreur inattendue est survenue » et personne ne sait laquelle :
 *    c'est exactement l'événement qui doit remonter.
 *
 * ⚠️ Le détail passe par `message`, jamais par `extra`. Le `beforeSend` de
 * `src/main.tsx` nettoie les emails et les UUID de `message`, des valeurs
 * d'exception et des fils d'Ariane — mais PAS de `extra`. Y mettre un message
 * Postgres reviendrait à contourner le seul filtre RGPD du chemin.
 */
const traceServerDetail = (code: string, originalMessage: string, known: boolean): void => {
  const detail = `${code}: ${originalMessage}`;
  Sentry.addBreadcrumb({ category: 'api', level: 'warning', message: detail });
  if (!known) {
    Sentry.captureMessage(`api error non catalogué — ${detail}`, {
      level: 'warning',
      tags: { api_code: code },
    });
  }
};

// Normalise une erreur lancée en une `ApiError` sûre pour l'affichage.
//
// Faille V7/N1 — never surface raw `error.message` to the UI. Postgres errors
// regularly contain internal schema names, UUIDs, and constraint metadata
// (e.g. `duplicate key value violates unique constraint "subscriptions_user_id_key"`).
//
// `message` est ce que l'UI peut rendre. `originalMessage` est pour le
// diagnostic seulement.
export const normalizeApiError = (error: ApiErrorLike | Error | string): ApiError => {
  // Déjà normalisée : la relancer telle quelle. Sans ce court-circuit, la
  // branche `instanceof Error` ci-dessous prendrait le message DU CATALOGUE
  // pour un détail serveur et le remplacerait par le message générique — une
  // erreur nommée redeviendrait anonyme au second passage.
  if (error instanceof ApiError) return error;

  let code = 'GENERIC_ERROR';
  let message = genericMessage();
  let originalMessage: string | undefined;
  let known = false;

  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    code = error.code;
    originalMessage = error.message;
    // Only use the whitelisted message; never the raw server message.
    const catalogued = messageForCode(code);
    const business = catalogued === null ? promoteBusinessCode(originalMessage) : null;
    if (business) {
      code = business;
      message = messageForCode(business) ?? message;
      known = true;
    } else {
      message = catalogued ?? message;
      known = catalogued !== null;
    }
  } else if (typeof error === 'object' && error !== null && 'error' in error && error.error?.code) {
    code = error.error.code;
    originalMessage = error.error.message;
    const catalogued = messageForCode(code);
    const business = catalogued === null ? promoteBusinessCode(originalMessage) : null;
    if (business) {
      code = business;
      message = messageForCode(business) ?? message;
      known = true;
    } else {
      message = catalogued ?? message;
      known = catalogued !== null;
    }
  } else if (error instanceof Error) {
    originalMessage = error.message;
    if (error.message.toLowerCase().includes('fetch')) {
      code = 'NETWORK_ERROR';
      message = messageForCode('NETWORK_ERROR') ?? message;
      known = true;
    }
    // Otherwise: keep the generic message, do not echo error.message to UI.
  } else if (typeof error === 'string') {
    originalMessage = error;
    // Keep generic message — string errors are usually internal.
  }

  if (originalMessage) traceServerDetail(code, originalMessage, known);

  return new ApiError(code, message, originalMessage);
};
