// ═══════════════════════════════════════════════════════════════════
// affiliate-claim — rattache un compte NEUF à l'affilié du lien `?aff=`,
// quelle que soit la porte d'inscription.
//
// `register()` transmet `affiliate_slug` en metadata de `signUp` (trigger,
// mig. 236). Google n'a pas d'équivalent : ce module appelle la RPC
// `claim_affiliate` à l'ouverture de session. Le serveur décide de tout
// (compte < 1 h, pas déjà rattaché, slug connu) ; le filtre d'âge client évite
// juste une requête à chaque connexion d'un compte ancien.
//
// Pas de condition de consentement : exception voulue, voir `@/lib/affiliation`.
// Ne jamais casser une auth : fire-and-forget, aucune erreur ne remonte.
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { readAffiliateSlug } from '@/lib/affiliation';
import { isFreshAccount, type ClaimableUser } from './acquisition-claim';

const claimed = new Set<string>();

export function claimAffiliate(user: ClaimableUser): void {
  try {
    if (claimed.has(user.id) || !isFreshAccount(user.created_at)) return;
    const slug = readAffiliateSlug();
    if (!slug) return;
    claimed.add(user.id);
    void supabase
      .rpc('claim_affiliate', { p_slug: slug })
      .then(
        () => undefined,
        () => undefined,
      );
  } catch {
    /* l'affiliation ne doit jamais casser une auth */
  }
}

/** Réservé aux tests. */
export function _resetAffiliateClaimedForTests(): void {
  claimed.clear();
}
