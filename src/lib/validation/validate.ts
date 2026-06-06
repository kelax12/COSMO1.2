// ═══════════════════════════════════════════════════════════════════
// Couche de validation de schéma client (zod)
// ═══════════════════════════════════════════════════════════════════
//
// But : attraper les entrées clairement invalides AVANT l'appel réseau et
// afficher un message FR lisible (meilleure UX d'erreur qu'un rejet RLS
// PostgREST cryptique). Ce n'est PAS la frontière de sécurité — celle-ci
// reste les RLS Supabase + le whitelisting `mapToDb`. C'est une garde UX +
// defense-in-depth.
//
// Les schémas sont volontairement *fidèles au comportement actuel* : ils
// rejettent l'invalide évident (nom vide, nombre négatif, priorité hors
// bornes) sans durcir des flux aujourd'hui acceptés.

import { z } from 'zod';

/**
 * Erreur de validation porteuse des messages par champ (pour un affichage
 * inline éventuel) + un message principal (pour un toast).
 */
export class ValidationError extends Error {
  readonly fieldErrors: Record<string, string>;
  constructor(message: string, fieldErrors: Record<string, string>) {
    super(message);
    this.name = 'ValidationError';
    this.fieldErrors = fieldErrors;
  }
}

const collectFieldErrors = (error: z.ZodError): Record<string, string> => {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_';
    // Premier message par champ (le plus pertinent).
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
};

/**
 * Valide `data` contre `schema`. Lève `ValidationError` (avec message FR) si
 * invalide, sinon renvoie la donnée parsée typée.
 */
export function validateOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fieldErrors = collectFieldErrors(result.error);
    const message = result.error.issues[0]?.message ?? 'Données invalides';
    throw new ValidationError(message, fieldErrors);
  }
  return result.data;
}

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; message: string; fieldErrors: Record<string, string> };

/**
 * Variante non-levante — pratique pour valider un formulaire et afficher les
 * erreurs par champ sans try/catch.
 */
export function safeValidate<T>(schema: z.ZodType<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    message: result.error.issues[0]?.message ?? 'Données invalides',
    fieldErrors: collectFieldErrors(result.error),
  };
}
