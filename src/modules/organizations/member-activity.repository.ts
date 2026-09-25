// ═══════════════════════════════════════════════════════════════════
// Dernière activité des membres : lecture production (mig. 170)
//
// Une seule RPC, `get_org_member_last_activity(p_org)`, SECURITY DEFINER
// bornée à l'organisation. Le périmètre (admin : tous, manager : son
// sous-arbre strict) est décidé par le SERVEUR : un membre absent de la
// réponse est hors périmètre, un membre présent avec `null` n'a aucune trace.
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import { toMemberActivitySource, type MemberLastActivity } from './member-activity.types';

interface MemberLastActivityRow {
  user_id: string;
  last_activity_at: string | null;
  source: string | null;
}

export async function fetchOrgMemberLastActivity(orgId: string): Promise<MemberLastActivity[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('get_org_member_last_activity', { p_org: orgId });
  if (error) throw normalizeApiError(error);
  return ((data ?? []) as MemberLastActivityRow[]).map((r) => ({
    userId: r.user_id,
    lastActivityAt: r.last_activity_at,
    source: toMemberActivitySource(r.source),
  }));
}
