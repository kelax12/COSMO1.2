// ═══════════════════════════════════════════════════════════════════
// TEAM-CATEGORIES MODULE - Types (catégories d'entreprise, mig. 111)
//
// Distinct des projets (team-projects) : un PROJET est une unité de travail
// (équipe, tâches, cycle de vie) ; une CATÉGORIE est une étiquette transverse
// qui peut regrouper plusieurs projets, et se poser directement sur une
// tâche indépendamment de son projet.
// ═══════════════════════════════════════════════════════════════════

/**
 * `parentId` porte l'arbre (mig. 148, fusion de org_okr_categories dans cette
 * table). `null` = racine. `position` ordonne une FRATRIE, jamais l'arbre
 * entier — miroir entreprise de `@/modules/categories` (mig. 143).
 */
export interface TeamCategory {
  id: string;
  orgId: string;
  name: string;
  /** Couleur CSS (hex). */
  color: string;
  parentId: string | null;
  position: number;
  createdBy: string | null;
  createdAt: string;
}

/**
 * ⚠️ Ne JAMAIS y ajouter `id` : l'identifiant d'une restauration éventuelle
 * passerait par le second argument de `create()`, jamais par le payload
 * (R-08, même règle que `@/modules/categories`).
 */
export interface CreateTeamCategoryInput {
  name: string;
  color?: string;
  parentId?: string | null;
  position?: number;
}

/** `parentId` y est admis : c'est le déplacement. */
export interface UpdateTeamCategoryInput {
  name?: string;
  color?: string;
  parentId?: string | null;
  position?: number;
}
