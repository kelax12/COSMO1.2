// ═══════════════════════════════════════════════════════════════════
// TEAM-OKRS MODULE - Types (OKR d'équipe)
// ═══════════════════════════════════════════════════════════════════

export interface TeamKeyResult {
  id: string;
  okrId: string;
  orgId: string;
  title: string;
  currentValue: number;
  /** Toujours > 0 (garde B17 avant tout calcul de progression). */
  targetValue: number;
  unit?: string;
  assigneeId?: string | null;
  completed: boolean;
  completedAt?: string | null;
  /** Coefficient d'importance 1–10 (défaut 1). Pondère la progression de l'OKR. */
  weight?: number;
  /** Durée estimée par unité (min) — parité avec l'OKR perso. Défaut 30. */
  estimatedTime?: number;
  /**
   * `tasks` : la progression se CALCULE par les tâches terminées des projets
   * reliés (mig. 153) ; `manual` : elle se saisit. Absent = `manual`.
   */
  progressMode?: KRProgressMode;
  /** Contributeurs, en plus du responsable `assigneeId` (mig. 153). */
  contributorIds?: string[];
}

export type KRProgressMode = 'manual' | 'tasks';

export interface TeamOKR {
  id: string;
  orgId: string;
  title: string;
  description?: string;
  /** Catégorie d'entreprise (mig. 148) — FK vers `team_categories`. null/absent = aucune. */
  categoryId?: string | null;
  startDate?: string;
  endDate?: string;
  createdBy: string;
  createdAt: string;
  /**
   * Équipes de rattachement (cloisonnement de visibilité). [] = objectif
   * d'entreprise, visible par tous les membres. Sinon visible uniquement par
   * les membres de ces équipes (+ leur hiérarchie) et les admins.
   */
  teamIds: string[];
  keyResults: TeamKeyResult[];
  /** Cycle d'OKR (T1, S2…) — mig. 153. */
  cycleId?: string | null;
  /** Objectif auquel celui-ci CONTRIBUE (un objectif d'entreprise, le plus souvent). */
  parentOkrId?: string | null;
}

export interface CreateTeamKRInput {
  title: string;
  targetValue: number;
  /** Avancement initial (défaut 0). */
  currentValue?: number;
  unit?: string;
  assigneeId?: string | null;
  weight?: number;
  estimatedTime?: number;
  progressMode?: KRProgressMode;
  contributorIds?: string[];
}

/** Entrée de synchronisation d'un KR en édition (id présent = KR existant). */
export interface SyncTeamKRInput extends CreateTeamKRInput {
  id?: string;
}

export interface CreateTeamOKRInput {
  title: string;
  description?: string;
  categoryId?: string | null;
  startDate?: string;
  endDate?: string;
  /** [] ou absent = objectif d'entreprise (toutes équipes). */
  teamIds?: string[];
  keyResults: CreateTeamKRInput[];
  cycleId?: string | null;
  parentOkrId?: string | null;
}

export interface UpdateTeamOKRInput {
  title?: string;
  description?: string;
  categoryId?: string | null;
  startDate?: string;
  endDate?: string;
  teamIds?: string[];
  cycleId?: string | null;
  parentOkrId?: string | null;
}

export interface UpdateTeamKRInput {
  title?: string;
  currentValue?: number;
  targetValue?: number;
  unit?: string;
  assigneeId?: string | null;
  completed?: boolean;
  weight?: number;
  estimatedTime?: number;
  progressMode?: KRProgressMode;
  contributorIds?: string[];
}
