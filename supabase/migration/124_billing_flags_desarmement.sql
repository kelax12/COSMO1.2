-- ═══════════════════════════════════════════════════════════════════
-- Migration 124 — Désarmement du plafond de sièges entreprise
--
-- ── POURQUOI ───────────────────────────────────────────────────────
--
-- Au 2026-08-26, l'état de la production était le suivant :
--
--   ENTERPRISE_BILLING_ENFORCED (client) ... true
--   billing_flags.enterprise_seat_limit .... true
--   STRIPE_SECRET_KEY ...................... une clé de TEST
--   Configuration du portail de résiliation  ABSENTE
--
-- Autrement dit : le quota de sièges était réellement appliqué, les CTA de
-- paiement étaient montés, et le checkout n'acceptait que des cartes de test.
-- Mesuré en base le même jour : 4 organisations, 0 abonnement souscrit, et
-- UNE organisation déjà au plafond.
--
-- Le parcours de cette organisation : l'invitation suivante est refusée par
-- `org_seats_allowed`, l'écran propose de payer, le clic mène à un Stripe en
-- mode test, la vraie carte est refusée. Elle ne peut ni grandir, ni payer,
-- ni résilier. C'est une impasse produit, pas un risque juridique — aucun
-- euro n'étant encaissé, il n'y a ni travail dissimulé ni TVA due.
--
-- ── CE QUE FAIT CETTE MIGRATION ────────────────────────────────────
--
-- Elle repose le drapeau SERVEUR à `false`. Le drapeau CLIENT
-- (`ENTERPRISE_BILLING_ENFORCED`, src/modules/billing/premium-config.ts) est
-- reposé à `false` dans le même commit.
--
-- 🔴 LES DEUX DRAPEAUX SE DÉPLACENT ENSEMBLE, TOUJOURS.
--    serveur `true` + client `false` = un propriétaire se voit refuser une
--      invitation sans qu'aucun écran ne lui propose de payer. Impasse muette.
--    client `true` + serveur `false` = on encaisse sans rien débloquer.
--    Appliquer cette migration SANS déployer le front correspondant recrée
--    exactement le second cas.
--
-- ── CE QU'ELLE NE FAIT PAS ─────────────────────────────────────────
--
-- Elle ne supprime rien, ne touche à aucun abonnement, et ne modifie pas
-- `org_seats_allowed`, qui court-circuite déjà sur ce drapeau (mig. 101). La
-- plomberie Stripe reste entière. Réarmer = repasser les deux drapeaux à
-- `true`, après l'immatriculation et le passage de Stripe en compte live.
--
-- Idempotente / re-jouable.
-- ═══════════════════════════════════════════════════════════════════

UPDATE public.billing_flags
   SET enabled = false
 WHERE key = 'enterprise_seat_limit';

-- Garde-fou de replay : si la ligne n'existe pas (base vierge reconstruite
-- depuis le dépôt), on la crée désarmée plutôt que de laisser la table muette.
-- `org_seats_allowed` traite une valeur absente comme « non appliqué », donc
-- l'état final est le même ; on rend simplement l'intention lisible en base.
INSERT INTO public.billing_flags (key, enabled)
SELECT 'enterprise_seat_limit', false
 WHERE NOT EXISTS (
   SELECT 1 FROM public.billing_flags WHERE key = 'enterprise_seat_limit'
 );
