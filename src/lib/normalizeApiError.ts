export type NormalizedError = {
  code: string;
  message: string;
};

const ERROR_MESSAGES: Record<string, string> = {
  '23505': 'Cette ressource existe déjà.',
  '23503': 'Action impossible en raison de dépendances existantes.',
  '42P01': 'Erreur de configuration de la base de données.',
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

export const normalizeApiError = (error: ApiErrorLike | Error | string): NormalizedError => {
  let code = 'GENERIC_ERROR';
  let message = ERROR_MESSAGES.GENERIC_ERROR;

  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    code = error.code;
    message = ERROR_MESSAGES[code] || error.message || message;
  } else if (typeof error === 'object' && error !== null && 'error' in error && error.error?.code) {
    code = error.error.code;
    message = ERROR_MESSAGES[code] || error.error.message || message;
  } else if (error instanceof Error) {
    message = error.message;
    if (error.message.toLowerCase().includes('fetch')) {
      code = 'NETWORK_ERROR';
      message = ERROR_MESSAGES.NETWORK_ERROR;
    }
  } else if (typeof error === 'string') {
    message = error;
  }

  return { code, message };
};
