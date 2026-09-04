// ═══════════════════════════════════════════════════════════════════
// FRIENDS MODULE — repository des liens de partage (`share_links`, mig. 046)
//
// Extrait de `share-link.hooks.ts` le 2026-08-24 : un hook n'a pas à parler à
// Supabase en direct (invariant docs/ARCHITECTURE.md §2, désormais tenu par
// `src/architecture.guard.test.ts`). Le hook garde React Query ; le repository
// garde la requête.
//
// Pas de variante démo : le partage par lien suppose un second compte, ce que
// la démo n'a pas. Les hooks appelants sont montés hors démo.
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth-user';
import { makeApiError, normalizeApiError } from '@/lib/normalizeApiError';

/**
 * Get-or-create du lien d'invitation d'une tâche.
 *
 * Réutilise le lien NON EXPIRÉ le plus récent plutôt que d'en créer un à chaque
 * ouverture du panneau de partage — sinon la table grossirait d'une ligne par
 * clic, et l'utilisateur qui recopie « le » lien n'aurait jamais deux fois le
 * même. La RLS (owner + `owns_task`) reste la frontière.
 */
export async function getOrCreateShareLink(taskId: string): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured');

  const { data: existing, error: selectError } = await supabase
    .from('share_links')
    .select('id, expires_at')
    .eq('task_id', taskId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (selectError) throw normalizeApiError(selectError);
  if (existing) return existing.id as string;

  const user = await getCurrentUser();
  if (!user) throw makeApiError('not_authenticated');

  const { data: created, error: insertError } = await supabase
    .from('share_links')
    .insert([{ task_id: taskId, owner_id: user.id }])
    .select('id')
    .single();
  if (insertError) throw normalizeApiError(insertError);
  return created.id as string;
}
