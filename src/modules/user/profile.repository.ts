// ═══════════════════════════════════════════════════════════════════
// USER MODULE — repository du profil public (`profiles`)
//
// POURQUOI CE FICHIER EXISTE
// `SettingsPage.tsx` appelait `supabase.from('profiles').update(...)` en
// direct, à deux endroits. C'était la dernière violation de l'invariant
// « jamais de `supabase.from()` hors d'un repository »
// (docs/ARCHITECTURE.md §2), et elle n'était pas cosmétique : cet invariant
// est ce qui garde le pattern repository comme frontière de données unique.
//
// PÉRIMÈTRE VOLONTAIREMENT MINUSCULE
// Une seule colonne est modifiable ici : `avatar_url`. `profiles.id`,
// `.email` et `.account_type` sont verrouillés CÔTÉ SERVEUR par le trigger de
// la mig. 083 (faille H-1) — ce fichier ne fait donc que refléter une
// contrainte qui existe déjà en base, il ne la crée pas. La frontière de
// sécurité reste RLS + trigger, jamais ce module.
//
// PAS DE VARIANTE LOCALE
// `profiles` est la vitrine d'un compte auprès des AUTRES utilisateurs. En
// mode démo il n'y a pas d'autres utilisateurs : l'avatar démo vit dans la
// session (`updateDemoProfile`, AuthContext). D'où l'absence de paire
// local/supabase ici — il n'y aurait rien à implémenter du côté local.
// ═══════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase';

/**
 * Écrit l'URL publique de l'avatar dans `profiles`, pour que les autres
 * utilisateurs la voient (`auth.user_metadata` est privé et invisible d'eux).
 *
 * `null` retire la photo.
 *
 * Ne lève pas : l'appelant a déjà écrit dans `auth.user_metadata`, qui est la
 * source lue par la session courante. Un échec ici ne dégrade que la vue des
 * TIERS, et le prochain changement d'avatar la resynchronise. Faire échouer
 * tout le geste sur cette écriture-miroir afficherait une erreur alors que la
 * photo de l'utilisateur a bien changé sous ses yeux.
 */
export async function mirrorAvatarToProfile(
  userId: string,
  avatarUrl: string | null,
): Promise<void> {
  if (!supabase) return;
  await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', userId);
}
