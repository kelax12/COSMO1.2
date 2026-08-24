// ═══════════════════════════════════════════════════════════════════
// TEAM-CATEGORIES MODULE - Types (catégories d'entreprise, mig. 111)
//
// Distinct des projets (team-projects) : un PROJET est une unité de travail
// (équipe, tâches, cycle de vie) ; une CATÉGORIE est une étiquette transverse
// qui peut regrouper plusieurs projets, et se poser directement sur une
// tâche indépendamment de son projet.
// ═══════════════════════════════════════════════════════════════════

export interface TeamCategory {
  id: string;
  orgId: string;
  name: string;
  /** Couleur CSS (hex). */
  color: string;
  createdBy: string | null;
  createdAt: string;
}

export interface CreateTeamCategoryInput {
  name: string;
  color?: string;
}

export interface UpdateTeamCategoryInput {
  name?: string;
  color?: string;
}
