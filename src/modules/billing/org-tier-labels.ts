// ═══════════════════════════════════════════════════════════════════
// NOMS DES PALIERS ENTREPRISE — source unique.
//
// Les libellés vivent dans le namespace `common`, PAS dans `org` ni dans
// `landing` : la landing entreprise et le produit doivent dire le même mot pour
// le même palier. Deux catalogues, c'est deux noms qui divergent au premier
// changement — le même piège que les montants, verrouillés par
// `org-tiers.parity.test.ts`.
// ═══════════════════════════════════════════════════════════════════
import type { KeyOf } from '@/i18n/catalog';
import type { OrgTierKey } from './premium-config';

export const ORG_TIER_LABEL_KEYS: Record<OrgTierKey, KeyOf<'common'>> = {
  free: 'orgTier.free',
  t10: 'orgTier.t10',
  t20: 'orgTier.t20',
  t50: 'orgTier.t50',
  tmax: 'orgTier.tmax',
};
