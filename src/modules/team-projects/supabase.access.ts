// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS — accès Supabase : MEMBRES d'un projet et CHIFFRES serveur
// (mig. 190, 191 · recommandations de l'étape 6)
//
// Séparé de `supabase.repository.ts` (plafond de 600 lignes) : la classe y
// délègue en une ligne par méthode, comme pour le portefeuille.
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import type {
  TeamMemberWorkload,
  TeamProjectMember,
  TeamProjectRole,
  TeamProjectTaskStats,
} from './types';

const client = () => {
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
};

interface ProjectMemberRow {
  project_id: string;
  user_id: string;
  org_id: string;
  role: string;
  added_by: string | null;
  added_at: string;
}

const ROLES: readonly TeamProjectRole[] = ['lead', 'contributor', 'viewer'];

export const mapProjectMember = (r: ProjectMemberRow): TeamProjectMember => ({
  projectId: r.project_id,
  userId: r.user_id,
  orgId: r.org_id,
  // Un rôle inconnu (base plus récente que le client) se lit comme le plus
  // restrictif : jamais comme un droit que le client croirait accordé.
  role: (ROLES as readonly string[]).includes(r.role) ? (r.role as TeamProjectRole) : 'viewer',
  addedBy: r.added_by,
  addedAt: r.added_at,
});

// ─── Membres d'un projet ─────────────────────────────────────────────

export async function getProjectMembers(orgId: string): Promise<TeamProjectMember[]> {
  // RPC indexable (même forme que les jalons) : la policy de la table délègue
  // à `team_projects`, donc à `can_access_team_project` PAR LIGNE.
  const { data, error } = await client()
    .rpc('get_my_team_project_members', { p_org: orgId })
    .select('*')
    .limit(5000);
  if (error) throw normalizeApiError(error);
  return ((data ?? []) as ProjectMemberRow[]).map(mapProjectMember);
}

/**
 * Ajoute une personne au projet ou change son rôle. `org_id`, `added_by` et
 * `added_at` sont posés par le trigger, jamais par le client (mig. 190).
 */
export async function setProjectMember(projectId: string, userId: string, role: TeamProjectRole): Promise<void> {
  const { error } = await client()
    .from('team_project_members')
    .upsert({ project_id: projectId, user_id: userId, role }, { onConflict: 'project_id,user_id' });
  if (error) throw normalizeApiError(error);
}

export async function removeProjectMember(projectId: string, userId: string): Promise<void> {
  const { error } = await client()
    .from('team_project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId);
  if (error) throw normalizeApiError(error);
}

// ─── Chiffres comptés par le serveur (mig. 191) ──────────────────────

interface StatsRow {
  project_id: string;
  total: number;
  completed: number;
  overdue: number;
  in_review: number;
  next_deadline: string | null;
}

/**
 * Avancement de CHAQUE projet visible, compté sur toutes ses tâches. Remplace
 * le calcul sur l'ensemble de travail plafonné à 1 000 lignes, qui rendait un
 * pourcentage faux sans rien en dire. `today` : date LOCALE 'YYYY-MM-DD'.
 */
export async function getProjectTaskStats(orgId: string, today: string): Promise<TeamProjectTaskStats[]> {
  const { data, error } = await client()
    .rpc('get_team_project_task_stats', { p_org: orgId, p_today: today });
  if (error) throw normalizeApiError(error);
  return ((data ?? []) as StatsRow[]).map((r) => ({
    projectId: r.project_id,
    total: Number(r.total) || 0,
    completed: Number(r.completed) || 0,
    overdue: Number(r.overdue) || 0,
    inReview: Number(r.in_review) || 0,
    nextDeadline: r.next_deadline,
  }));
}

interface WorkloadRow {
  user_id: string;
  open_tasks: number;
  overdue: number;
  due_7_days: number;
  estimated_minutes: number;
}

export async function getMemberWorkload(orgId: string, today: string): Promise<TeamMemberWorkload[]> {
  const { data, error } = await client()
    .rpc('get_team_member_workload', { p_org: orgId, p_today: today });
  if (error) throw normalizeApiError(error);
  return ((data ?? []) as WorkloadRow[]).map((r) => ({
    userId: r.user_id,
    openTasks: Number(r.open_tasks) || 0,
    overdue: Number(r.overdue) || 0,
    dueIn7Days: Number(r.due_7_days) || 0,
    estimatedMinutes: Number(r.estimated_minutes) || 0,
  }));
}
