// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS — étiquettes et historique par tâche, accès Supabase
// (mig. 093 et 094)
//
// Retirés le 2026-09-05 (C-49) faute d'écran, rebranchés le 2026-09-25 par
// la fiche de tâche d'équipe. Séparé de `supabase.repository.ts` pour le
// garder sous le plafond de 600 lignes : la classe délègue en une ligne.
//
// La RLS reste la frontière : `team_labels_insert` exige `is_org_manager`,
// la jonction exige `can_access_team_task`. Les tables sont en base depuis la
// mig. 093, jamais supprimées (le code mort, oui ; les données, non).
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { getCurrentUserId } from '@/lib/auth-user';
import { makeApiError, normalizeApiError } from '@/lib/normalizeApiError';
import { warnIfTruncated } from '@/lib/pagination.warning';
import type { CreateTeamLabelInput, TeamLabel, TeamTaskActivity, TeamTaskLabel } from './types';
import { mapActivity, mapLabel, type ActivityRow, type LabelRow } from './supabase.mappers';

const client = () => {
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
};

export async function getLabels(orgId: string): Promise<TeamLabel[]> {
  const { data, error } = await client()
    .from('team_labels')
    .select('*')
    .eq('org_id', orgId)
    .order('name', { ascending: true });
  if (error) throw normalizeApiError(error);
  return (data as LabelRow[]).map(mapLabel);
}

export async function createLabel(orgId: string, input: CreateTeamLabelInput): Promise<TeamLabel> {
  const uid = await getCurrentUserId();
  if (!uid) throw makeApiError('not_authenticated');
  const { data, error } = await client()
    .from('team_labels')
    // La policy INSERT exige created_by = auth.uid().
    .insert({ org_id: orgId, name: input.name.trim(), color: input.color ?? '#6366f1', created_by: uid })
    .select('*')
    .single();
  if (error) throw normalizeApiError(error);
  return mapLabel(data as LabelRow);
}

/**
 * Étiquettes posées sur UNE tâche. Filtre sur `task_id`, tête de la PK
 * `(task_id, label_id)` : le prédicat RLS `can_access_team_task` n'est évalué
 * que sur les lignes de cette tâche, jamais sur la jonction de toute la
 * plateforme (cf. `src/modules/CLAUDE.md`, lectures indexables).
 */
export async function getTaskLabels(taskId: string): Promise<TeamTaskLabel[]> {
  const { data, error } = await client()
    .from('team_task_labels')
    .select('task_id, label_id')
    .eq('task_id', taskId);
  if (error) throw normalizeApiError(error);
  return (data as { task_id: string; label_id: string }[]).map((r) => ({ taskId: r.task_id, labelId: r.label_id }));
}

export async function addTaskLabel(taskId: string, labelId: string): Promise<void> {
  const { error } = await client().from('team_task_labels').insert({ task_id: taskId, label_id: labelId });
  if (error) throw normalizeApiError(error);
}

export async function removeTaskLabel(taskId: string, labelId: string): Promise<void> {
  const { error } = await client()
    .from('team_task_labels')
    .delete()
    .eq('task_id', taskId)
    .eq('label_id', labelId);
  if (error) throw normalizeApiError(error);
}

/** Journal d'UNE tâche, du plus récent au plus ancien : l'ordre de l'index (task_id, created_at DESC). */
export async function getTaskActivity(taskId: string): Promise<TeamTaskActivity[]> {
  const { data, error } = await client()
    .from('team_task_activity')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw normalizeApiError(error);
  return warnIfTruncated((data ?? []) as ActivityRow[], 100, 'team_task_activity').map(mapActivity);
}
