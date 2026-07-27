// Erreurs typées du CLI COSMO. Aucune I/O : ce module ne doit jamais écrire
// sur stdout/stderr — c'est cli.mjs qui décide du rendu.

/** Session absente, expirée, ou refresh token révoqué. */
export class CosmoAuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CosmoAuthError';
  }
}

/** Entité demandée introuvable (ou invisible via la RLS, ce qui revient au même). */
export class CosmoNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CosmoNotFoundError';
  }
}

/** Entrée utilisateur invalide, détectée avant tout appel réseau. */
export class CosmoValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CosmoValidationError';
  }
}

/** Erreur remontée par PostgREST/Supabase, enveloppée pour garder le code. */
export class CosmoApiError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'CosmoApiError';
    this.code = code;
  }
}
