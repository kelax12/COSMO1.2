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
// ── POURQUOI PLUS AUCUNE PHRASE ICI ─────────────────────────────────
//
// Une table de transition a existe entre le 2026-09-04 et le 2026-09-12 :
// elle traduisait les anciennes phrases anglaises en identifiants, pour que
// le correctif marche avant l application de la 137. La 137 est APPLIQUEE en
// production depuis le 2026-09-12 (ledger : `137_dependency_error_identifiers`,
// derniere entree), verifiee acteur par acteur sur 13 scenarios en transaction
// annulee : les quatre refus rendent leur identifiant, plus aucune phrase.
//
// ❌ Ne JAMAIS reintroduire une table phrase -> identifiant ici : ce serait
//    identifier une erreur par son message, ce que CLAUDE.md interdit
//    nommement, et le message serveur d aujourd hui est deja un identifiant.
//    Garde : `dependency-errors.guard.test.ts`.

import { ApiError, makeApiError } from '@/lib/normalizeApiError';

/** Les quatre refus, tels que la mig. 137 les nomme. */
export const DEPENDENCY_ERRORS = {
  taskMissing: 'dependency_task_missing',
  crossAccount: 'dependency_cross_account',
  crossProject: 'dependency_cross_project',
  cycle: 'dependency_cycle',
} as const;

/**
 * Rend l identifiant de refus si l erreur en est un, sinon `null`.
 *
 * Une seule forme est acceptee : l identifiant que la mig. 137 fait dire aux
 * quatre triggers, et que les depots de DEMO levent a l identique — lu sur
 * `ApiError.code`, `originalMessage` ou `message`, selon l endroit d ou
 * l erreur arrive.
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
