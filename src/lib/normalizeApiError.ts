export type NormalizedError = {
  code: string;
  message: string;
  originalMessage?: string; // server-side detail — for logging, never for UI
};

const ERROR_MESSAGES: Record<string, string> = {
  '23505': 'Cette ressource existe déjà.',
  '23503': 'Action impossible en raison de dépendances existantes.',
  '42P01': 'Erreur de configuration de la base de données.',
  // RLS : insert/update rejeté par une policy (droits insuffisants).
  '42501': "Vous n'avez pas les droits nécessaires pour cette action.",
  'PGRST116': 'La ressource demandée est introuvable.',
  'insufficient_quota': 'Quota AI épuisé. Veuillez vérifier votre abonnement.',
  'rate_limit_exceeded': 'Trop de requêtes. Veuillez patienter un instant.',
  'context_length_exceeded': 'Le contenu est trop long pour être traité.',
  'invalid_api_key': 'Erreur de connexion aux services AI.',
  'NETWORK_ERROR': 'Connexion réseau perdue ou instable.',
  'GENERIC_ERROR': 'Une erreur inattendue est survenue.',
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
  let message = ERROR_MESSAGES.GENERIC_ERROR;
  let originalMessage: string | undefined;

  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    code = error.code;
    originalMessage = error.message;
    // Only use the whitelisted message; never the raw server message.
    if (ERROR_MESSAGES[code]) message = ERROR_MESSAGES[code];
  } else if (typeof error === 'object' && error !== null && 'error' in error && error.error?.code) {
    code = error.error.code;
    originalMessage = error.error.message;
    if (ERROR_MESSAGES[code]) message = ERROR_MESSAGES[code];
  } else if (error instanceof Error) {
    originalMessage = error.message;
    if (error.message.toLowerCase().includes('fetch')) {
      code = 'NETWORK_ERROR';
      message = ERROR_MESSAGES.NETWORK_ERROR;
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
