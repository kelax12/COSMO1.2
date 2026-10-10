// ═══════════════════════════════════════════════════════════════════
// acquisition-claim — rattache la source first-touch à un compte NEUF,
// quelle que soit la porte d'inscription.
//
// `register()` transmet la source en metadata de `signUp`, que le trigger
// recopie (mig. 097). `signInWithOAuth` n'a pas d'équivalent : mesuré le
// 2026-10-10, 6 inscriptions sur 7 passaient par Google et AUCUN compte ne
// portait de source. Ce module comble ce trou à l'ouverture de session, via
// la RPC `claim_acquisition_source` (mig. 217).
//
// Le serveur décide de tout (compte < 1 h, source absente, whitelist) : le
// filtre d'âge côté client n'existe que pour ne pas émettre une requête à
// chaque connexion d'un compte ancien. Pour une inscription par e-mail, le
// trigger a déjà posé la source et l'appel est un no-op.
//
// Comme tout l'analytics du produit : ne jamais casser une auth. Fire-and-
// forget, aucune erreur ne remonte.
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';
import { readFirstTouch } from '@/lib/attribution';

/** Aligné sur la fenêtre de la RPC (mig. 217). */
export const CLAIM_WINDOW_MS = 60 * 60 * 1000;

const claimed = new Set<string>();

export interface ClaimableUser {
  id: string;
  created_at?: string;
}

/** Vrai si le compte a été créé il y a moins d'une heure. */
export function isFreshAccount(createdAt: string | undefined, now = Date.now()): boolean {
  if (!createdAt) return false;
  const ts = Date.parse(createdAt);
  return Number.isFinite(ts) && now - ts < CLAIM_WINDOW_MS;
}

/**
 * Envoie la source first-touch pour un compte neuf. Une fois par utilisateur
 * et par chargement de page. No-op sans attribution ou pour un compte ancien.
 */
export function claimAcquisitionSource(user: ClaimableUser): void {
  if (claimed.has(user.id) || !isFreshAccount(user.created_at)) return;
  const firstTouch = readFirstTouch();
  if (!firstTouch) return;
  claimed.add(user.id);
  void supabase
    .rpc('claim_acquisition_source', {
      p_source: firstTouch.source,
      p_campaign: firstTouch.campaign ?? null,
    })
    .then(
      () => undefined,
      () => undefined,
    );
}

/** Réservé aux tests. */
export function _resetClaimedForTests(): void {
  claimed.clear();
}
