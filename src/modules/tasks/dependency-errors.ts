// ═══════════════════════════════════════════════════════════════════
// REFUS DE DEPENDANCE — un identifiant, jamais une phrase
// ═══════════════════════════════════════════════════════════════════
//
// 🔴 POURQUOI (C-48).
//
// Les triggers de dependance (mig. 132 pour le personnel, 108/109 pour
// l equipe) refusaient par des PHRASES anglaises, et le repository local
// levait les MEMES phrases par souci de parite. Les deux modes se cassaient
// chacun a sa facon :
//
//   • EN PRODUCTION, `normalizeApiError` ne promeut un message serveur en code
//     metier que s il matche `BUSINESS_CODE_RE` (`^[a-z][a-z0-9_]{2,49}$`).
//     Une phrase avec des espaces et des majuscules ne matche pas : le refus
//     retombait sur le message generique. Ce qu on voulait surtout ne pas
//     perdre — « c est un cycle, tu peux agir dessus » — etait exactement ce
//     qui etait perdu.
//   • EN MODE DEMO, aucun `normalizeApiError` sur ce chemin : la phrase
//     anglaise arrivait telle quelle dans le gabarit francais. Un utilisateur
//     francophone lisait « Dependance impossible : This dependency would
//     create a cycle ».
//
// Les deux chemins convergent donc sur les MEMES identifiants, catalogues en
// `errors.api.*` en `fr` et en `en`. La migration 137 fait dire ces
// identifiants aux quatre triggers.
//
// ── LA TABLE DE TRANSITION, ET QUAND LA SUPPRIMER ───────────────────
//
// 🔴 Une migration se DEPLOIE : entre le push de ce code et l application de
// la 137 en production, le serveur repond encore par les anciennes phrases.
// `LEGACY_DEPENDENCY_MESSAGES` les traduit en identifiants pour que le
// correctif marche des le deploiement du front, sans attendre la base.
//
// ❌ Ce n est PAS un retour a « identifier une erreur par son message » : ces
//    phrases sont des constantes anglaises figees d une migration nommee, pas
//    du texte traduit. C est le meme motif que `CHECKOUT_ERROR_KEYS` dans
//    `org-billing.hooks.ts` — le texte serveur sert de CLE, jamais d affichage.
// ✅ A SUPPRIMER une fois la mig. 137 appliquee en production, avec la ligne
//    correspondante du ledger comme preuve.

import { ApiError, makeApiError } from '@/lib/normalizeApiError';

/** Les quatre refus, tels que la mig. 137 les nomme. */
export const DEPENDENCY_ERRORS = {
  taskMissing: 'dependency_task_missing',
  crossAccount: 'dependency_cross_account',
  crossProject: 'dependency_cross_project',
  cycle: 'dependency_cycle',
} as const;

/**
 * Phrases des migrations 108, 109 et 132, avant la 137.
 *
 * ⚠️ « Both tasks must exist » couvre DEUX branches du trigger d equipe — tache
 * inexistante ET tache hors perimetre — et c est une propriete de SECURITE
 * (mig. 109) : les separer rouvrirait un oracle d existence sur `team_tasks`.
 * La convergence est donc conservee ici aussi.
 */
const LEGACY_DEPENDENCY_MESSAGES: Record<string, string> = {
  'Both tasks must exist': DEPENDENCY_ERRORS.taskMissing,
  'A dependency must stay within a single account': DEPENDENCY_ERRORS.crossAccount,
  'A dependency must stay within a single project': DEPENDENCY_ERRORS.crossProject,
  'This dependency would create a cycle': DEPENDENCY_ERRORS.cycle,
};

/**
 * Rend l identifiant de refus si l erreur en est un, sinon `null`.
 *
 * Accepte les deux formes : l identifiant rendu par la mig. 137 (via
 * `ApiError.code` ou `originalMessage`), et la phrase d avant.
 */
export function dependencyErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const known = new Set<string>(Object.values(DEPENDENCY_ERRORS));
  const candidates = [
    (error as { code?: unknown }).code,
    (error as { originalMessage?: unknown }).originalMessage,
    (error as { message?: unknown }).message,
  ];
  for (const raw of candidates) {
    if (typeof raw !== 'string') continue;
    if (known.has(raw)) return raw;
    const legacy = LEGACY_DEPENDENCY_MESSAGES[raw.trim()];
    if (legacy) return legacy;
  }
  return null;
}

/**
 * Construit le refus que les depots de DEMO levent.
 *
 * Une `ApiError` et pas une `Error` nue : son `message` vient du catalogue,
 * donc il est deja traduit quand il atterrit dans le gabarit
 * `errors.mutation.taskDependency` (« Dependance impossible : {{message}} »).
 * C est exactement ce qui manquait — la phrase anglaise en dur y arrivait
 * telle quelle.
 */
export function makeDependencyError(code: string): ApiError {
  // Delegue a la primitive partagee : un seul endroit resout un code en
  // message de catalogue, sinon deux copies finissent par diverger (C-62).
  return makeApiError(code);
}
