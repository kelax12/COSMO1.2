// Résolution d'un use-case depuis une URL, quelle que soit sa langue.
//
// Ce module est en `.ts` et séparé de `use-cases.mjs` : le registre de contenu
// doit rester importable par `prerender.mjs` (Node brut, sans bundler), il ne
// peut donc pas importer `src/i18n/routes.ts`. La correspondance slug → langue
// vit ici, du côté de l'application.

import { USE_CASES, type UseCase } from '@/content/use-cases.mjs';
import { routeIdFromSlug } from '@/i18n/routes';

/**
 * Use-case servi par un slug d'URL, toutes langues confondues.
 *
 * Les entrées de `use-cases.mjs` ne portent que le slug FR (`pour-equipes`),
 * alors que l'URL peut être anglaise (`for-teams`) ou espagnole
 * (`para-equipos`) — le `basename` du routeur ayant déjà retiré le préfixe de
 * locale, le pathname ne dit pas non plus dans quelle langue on est. Comparer
 * directement les deux ne matchait donc jamais hors français, et la page
 * redirigeait silencieusement vers l'accueil.
 *
 * On passe des deux côtés par `routeIdFromSlug`, dont l'index inverse couvre
 * les trois langues : `for-teams` et `pour-equipes` se réduisent tous deux à
 * `teams`, et la comparaison redevient exacte.
 */
export function resolveUseCase(slug: string): UseCase | undefined {
  const routeId = routeIdFromSlug(slug);
  if (!routeId) return undefined;
  return USE_CASES.find((useCase) => routeIdFromSlug(useCase.slug) === routeId);
}
