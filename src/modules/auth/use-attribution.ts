// ═══════════════════════════════════════════════════════════════════
// Attribution, source d'acquisition et affiliation d'un compte neuf
// ═══════════════════════════════════════════════════════════════════
//
// Deux portes d'inscription, deux chemins :
//   · e-mail : `register()` passe la source first-touch et le slug d'affilié
//     en metadata de `signUp` (`signupAttributionMetadata`), que les triggers
//     re-valident (mig. 097, 236) ;
//   · Google : `signInWithOAuth` ne porte rien, on rattache à l'ouverture de
//     session (`acquisition-claim.ts`, `affiliate-claim.ts`, mig. 217).
//
// Extrait d'`AuthContext.tsx` (ARC-03). Le code est DÉPLACÉ :
// ni le moment ni la condition d'activation n'ont changé. Le consentement
// est hors de ce fichier (décision V11.3, voir `@/lib/affiliation`).

import { useEffect } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { readFirstTouch } from '@/lib/attribution';
import { readAffiliateSlug } from '@/lib/affiliation';
import { claimAcquisitionSource } from './acquisition-claim';
import { claimAffiliate } from './affiliate-claim';
import type { AuthEvents } from './auth-events';

/** Rattachements de session, dans cet ordre : acquisition, puis affiliation. */
export function claimSessionAttribution(sessionUser: SupabaseUser): void {
  // Inscription Google : `signInWithOAuth` ne porte pas la source
  // first-touch, on la rattache ici (mig. 217, acquisition-claim.ts).
  claimAcquisitionSource(sessionUser);
  claimAffiliate(sessionUser);
}

/**
 * Champs d'attribution de la metadata de `signUp`. Source first-touch
 * (src/lib/attribution.ts) déjà normalisée et validée : le trigger la
 * re-valide de son côté (mig. 097), la metadata étant contrôlée par le client.
 */
export function signupAttributionMetadata(): Record<string, string> {
  const firstTouch = readFirstTouch();
  const affiliateSlug = readAffiliateSlug();
  return {
    ...(affiliateSlug ? { affiliate_slug: affiliateSlug } : {}),
    ...(firstTouch
      ? {
          acquisition_source: firstTouch.source,
          ...(firstTouch.campaign ? { acquisition_campaign: firstTouch.campaign } : {}),
        }
      : {}),
  };
}

export function useAttribution(events: AuthEvents): void {
  useEffect(() => events.subscribe({ sessionOpened: claimSessionAttribution }), [events]);
}
