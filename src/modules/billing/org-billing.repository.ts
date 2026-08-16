// ═══════════════════════════════════════════════════════════════════
// BILLING ORG — lecture de l'abonnement d'organisation.
//
// LECTURE SEULE, par construction : `org_subscriptions` n'a aucune policy
// d'écriture (mig. 101). Toute mutation passe par Stripe puis par le webhook.
// ═══════════════════════════════════════════════════════════════════
import { supabase } from '@/lib/supabase';
import { normalizeApiError } from '@/lib/normalizeApiError';
import type { OrgSubscription, OrgSubscriptionStatus } from './org-billing.types';
import type { OrgTierKey } from './premium-config';

interface OrgSubscriptionRow {
  org_id: string;
  tier_key: OrgTierKey;
  max_members: number | null;
  status: OrgSubscriptionStatus;
  current_period_end: string | null;
  discount_code: string | null;
}

/** `null` = aucune ligne, c'est-à-dire palier gratuit. Pas une erreur. */
export async function getOrgSubscription(orgId: string): Promise<OrgSubscription | null> {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase
    .from('org_subscriptions')
    .select('org_id, tier_key, max_members, status, current_period_end, discount_code')
    .eq('org_id', orgId)
    .maybeSingle();

  if (error) throw normalizeApiError(error);
  if (!data) return null;

  const row = data as OrgSubscriptionRow;
  return {
    orgId: row.org_id,
    tierKey: row.tier_key,
    maxMembers: row.max_members,
    status: row.status,
    currentPeriodEnd: row.current_period_end,
    discountCode: row.discount_code,
  };
}
