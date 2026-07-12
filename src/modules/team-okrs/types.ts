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
  keyResults: TeamKeyResult[];
}

export interface CreateTeamKRInput {
  title: string;
  targetValue: number;
  unit?: string;
  assigneeId?: string | null;
  weight?: number;
}

export interface CreateTeamOKRInput {
  title: string;
  description?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  keyResults: CreateTeamKRInput[];
}

export interface UpdateTeamOKRInput {
  title?: string;
  description?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
}

export interface UpdateTeamKRInput {
  title?: string;
  currentValue?: number;
  targetValue?: number;
  unit?: string;
  assigneeId?: string | null;
  completed?: boolean;
  weight?: number;
}
