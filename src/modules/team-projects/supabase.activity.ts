// ═══════════════════════════════════════════════════════════════════
// TEAM-PROJECTS — historique par tâche, accès Supabase (mig. 094)
//
// Séparé de `supabase.repository.ts` pour le garder sous le plafond de 600
// lignes : la classe délègue en une ligne. Les étiquettes (mig. 093) ont été
// retirées du mode entreprise le 2026-09-28 ; `team_labels` et
// `team_task_labels` restent en base (le code mort, oui ; les données, non).
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { warnIfTruncated } from '@/lib/pagination.warning';
import type { TeamTaskActivity } from './types';
import { mapActivity, type ActivityRow } from './supabase.mappers';

const client = () => {
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
};

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
