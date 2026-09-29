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
   * reliés (mig. 160) ; `manual` : elle se saisit. Absent = `manual`.
   */
  progressMode?: KRProgressMode;
  /** Contributeurs, en plus du responsable `assigneeId` (mig. 160). */
  contributorIds?: string[];
  /** État du DERNIER point d'étape (mig. 160), recopié sur le KR par `post_kr_checkin`. */
  health?: 'on_track' | 'at_risk' | 'off_track' | null;
  healthUpdatedAt?: string | null;
}

export type KRProgressMode = 'manual' | 'tasks';

/** Visibilité d'un OKR d'équipe (mig. 205). */
export type TeamOKRAudience = 'org' | 'teams' | 'custom';

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
  /**
   * Choix de visibilité fait à l'écran (mig. 205). 'custom' ajoute des
   * personnes nommées (`memberIds`) aux équipes. Un OKR 'teams' ou 'custom'
   * qui perd tous ses liens se referme, il ne s'ouvre jamais à l'entreprise.
   */
  audience?: TeamOKRAudience;
  /** Personnes nommées d'un OKR 'custom' (mig. 205). */
  memberIds?: string[];
  keyResults: TeamKeyResult[];
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
  audience?: TeamOKRAudience;
  memberIds?: string[];
  keyResults: CreateTeamKRInput[];
  parentOkrId?: string | null;
}

export interface UpdateTeamOKRInput {
  title?: string;
  description?: string;
  categoryId?: string | null;
  startDate?: string;
  endDate?: string;
  teamIds?: string[];
  audience?: TeamOKRAudience;
  memberIds?: string[];
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

/**
 * Objectif à la corbeille (mig. 193) : intitulé et métadonnées de suppression
 * seulement. Le contenu revient avec la restauration, jamais avant.
 */
export interface TrashedTeamOKR {
  id: string;
  title: string;
  deletedAt: string;
  deletedBy: string | null;
  createdBy: string | null;
}
