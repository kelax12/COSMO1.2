// ═══════════════════════════════════════════════════════════════════
// ORGANIZATIONS — repository des notifications (`org_notifications`, mig. 095)
//
// Extrait de `notifications.ts` le 2026-08-24 : les trois requêtes Supabase
// vivaient dans les hooks (invariant docs/ARCHITECTURE.md §2, désormais tenu
// par `src/architecture.guard.test.ts`).
//
// Le branchement démo reste dans les hooks, à dessein : il ne lit pas une
// table mais `localStorage`, et le sortir ici imposerait une paire
// local/supabase complète pour trois fonctions — sans rien protéger de plus.
// Ce que l'invariant vise, c'est l'accès direct à une TABLE depuis du code
// d'interface. C'est ce qui est traité ici.
//
// Aucune écriture n'est possible sur cette table côté client au-delà de
// `read_at` : la RLS ne laisse lire que ses propres lignes
// (`user_id = auth.uid()`), et les INSERT viennent des triggers
// `SECURITY DEFINER` des mig. 095 / 110.
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';

/**
 * Marque toutes les notifications non lues de l'organisation comme lues.
 *
 * `.is('read_at', null)` n'est pas une optimisation : sans ce filtre, chaque
 * ouverture du panneau réécrirait tout l'historique et écraserait la date de
 * PREMIÈRE lecture, qui est la seule information que porte cette colonne.
 */
export async function markOrgNotificationsRead(orgId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('org_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .is('read_at', null);
  if (error) throw normalizeApiError(error);
}

/**
 * Idem, restreint à UNE tâche : ouvrir la tâche fait disparaître son badge de
 * commentaires non lus sans vider le reste de la cloche (mig. 110).
 */
export async function markTaskNotificationsRead(orgId: string, taskId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('org_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('task_id', taskId)
    .is('read_at', null);
  if (error) throw normalizeApiError(error);
}
