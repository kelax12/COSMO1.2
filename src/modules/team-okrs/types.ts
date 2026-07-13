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
}

export interface TeamOKR {
  id: string;
  orgId: string;
  title: string;
  description?: string;
  category?: string;
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
}

/** Entrée de synchronisation d'un KR en édition (id présent = KR existant). */
export interface SyncTeamKRInput extends CreateTeamKRInput {
  id?: string;
}

export interface CreateTeamOKRInput {
  title: string;
  description?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  /** [] ou absent = objectif d'entreprise (toutes équipes). */
  teamIds?: string[];
  keyResults: CreateTeamKRInput[];
}

export interface UpdateTeamOKRInput {
  title?: string;
  description?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  teamIds?: string[];
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
}
