import { resolveMessage } from '@/i18n/catalog';
import { localeStore } from '@/i18n/store';

export type NormalizedError = {
  code: string;
  message: string;
  originalMessage?: string; // server-side detail — for logging, never for UI
};

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

// Normalize a thrown error into a user-safe shape.
//
// Faille V7/N1 — never surface raw `error.message` to the UI. Postgres errors
// regularly contain internal schema names, UUIDs, and constraint metadata
// (e.g. `duplicate key value violates unique constraint "subscriptions_user_id_key"`).
// The previous implementation fell back to the raw string whenever the error
// code wasn't in the whitelist, defeating its own purpose.
//
// `message` is what the UI may render. `originalMessage` is for logs only.
export const normalizeApiError = (error: ApiErrorLike | Error | string): NormalizedError => {
  let code = 'GENERIC_ERROR';
  let message = genericMessage();
  let originalMessage: string | undefined;

  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    code = error.code;
    originalMessage = error.message;
    // Only use the whitelisted message; never the raw server message.
    const known = messageForCode(code);
    const business = known === null ? promoteBusinessCode(originalMessage) : null;
    if (business) {
      code = business;
      message = messageForCode(business) ?? message;
    } else {
      message = known ?? message;
    }
  } else if (typeof error === 'object' && error !== null && 'error' in error && error.error?.code) {
    code = error.error.code;
    originalMessage = error.error.message;
    const known = messageForCode(code);
    const business = known === null ? promoteBusinessCode(originalMessage) : null;
    if (business) {
      code = business;
      message = messageForCode(business) ?? message;
    } else {
      message = known ?? message;
    }
  } else if (error instanceof Error) {
    originalMessage = error.message;
    if (error.message.toLowerCase().includes('fetch')) {
      code = 'NETWORK_ERROR';
      message = messageForCode('NETWORK_ERROR') ?? message;
    }
    // Otherwise: keep the generic message, do not echo error.message to UI.
  } else if (typeof error === 'string') {
    originalMessage = error;
    // Keep generic message — string errors are usually internal.
  }

  if (originalMessage) {
    // Server-side detail: log once for ops/sentry, then drop on the floor for UI.
    console.error('[normalizeApiError]', code, originalMessage);
  }

  return { code, message, originalMessage };
};
