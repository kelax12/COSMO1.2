// ═══════════════════════════════════════════════════════════════════
// IMPACT D'UNE SUPPRESSION DE CATÉGORIE D'ENTREPRISE — logique pure
// ═══════════════════════════════════════════════════════════════════
//
// Depuis la mig. 148, `team_categories` est un vrai FK `ON DELETE SET NULL`
// pour les TROIS entités qui peuvent en porter une : tâches, projets et OKR
// d'équipe (`team_okrs.category_id`, qui remplace le nom recopié
// d'`org_okr_categories`). Rien ne pointe donc jamais dans le vide — la
// réaffectation manuelle de R-02/C-02 n'est plus une nécessité d'intégrité,
// seulement une annonce d'impact avant de couper l'étiquette.
//
// ⚠️ Compter le seul nœud visé donnerait un chiffre faux : supprimer une
// catégorie qui a des sous-catégories détache aussi tout ce qui est rangé
// dans la branche (`branchImpact`), même principe que le versant personnel.

import type { TeamOKR } from '@/modules/team-okrs';
import type { TeamTask, TeamProject } from '@/modules/team-projects';
import type { TeamCategory } from './types';
import { descendantIdSet } from './tree';

export interface TeamCategoryImpact {
  tasks: number;
  projects: number;
  okrs: number;
  /** Sous-catégories emportées, le nœud lui-même exclu. */
  subcategories: number;
  total: number;
}

export const EMPTY_TEAM_CATEGORY_IMPACT: TeamCategoryImpact = {
  tasks: 0,
  projects: 0,
  okrs: 0,
  subcategories: 0,
  total: 0,
};

/**
 * Ce que la suppression de la BRANCHE de `categoryId` détacherait (le nœud et
 * tous ses descendants). `total` ne compte QUE tâches + projets + OKR — les
 * sous-catégories emportées sont rapportées à part, ce ne sont pas des
 * dépendants « détachés » mais des lignes supprimées.
 */
export function teamCategoryImpact(
  categoryId: string | null | undefined,
  tasks: readonly TeamTask[],
  projects: readonly TeamProject[],
  okrs: readonly TeamOKR[],
  categories: readonly TeamCategory[],
): TeamCategoryImpact {
  if (!categoryId) return EMPTY_TEAM_CATEGORY_IMPACT;

  const descendants = descendantIdSet(categoryId, categories);
  const ids = new Set<string>([categoryId, ...descendants]);

  const taskCount = tasks.filter((t) => t.categoryId && ids.has(t.categoryId)).length;
  const projectCount = projects.filter((p) => p.categoryId && ids.has(p.categoryId)).length;
  const okrCount = okrs.filter((o) => o.categoryId && ids.has(o.categoryId)).length;

  return {
    tasks: taskCount,
    projects: projectCount,
    okrs: okrCount,
    subcategories: descendants.size,
    total: taskCount + projectCount + okrCount,
  };
}
