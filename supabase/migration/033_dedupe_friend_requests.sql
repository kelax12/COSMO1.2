-- ═══════════════════════════════════════════════════════════════════
-- Migration 033 — Dédoublonnage des demandes d'amis en attente
--
-- Bug : la table `friend_requests` accumulait plusieurs lignes `pending`
-- pour le même couple (sender_id, email) — double-clic sur « envoyer » ou
-- retry réseau. Résultat : la demande apparaissait en double dans la boîte
-- de réception ET dans le sélecteur de collaborateurs.
--
-- Fix :
--   1. Purge des doublons existants (on garde la ligne la plus ancienne).
--   2. Index unique partiel pour empêcher toute future demande pending en
--      double au niveau base (defense-in-depth, en plus du garde applicatif
--      ajouté dans sendFriendRequest).
-- ═══════════════════════════════════════════════════════════════════

-- 1. Supprime les doublons pending, conserve la ligne au plus petit ctid
DELETE FROM public.friend_requests fr
USING public.friend_requests keep
WHERE fr.status = 'pending'
  AND keep.status = 'pending'
  AND fr.sender_id IS NOT NULL
  AND fr.sender_id = keep.sender_id
  AND lower(fr.email) = lower(keep.email)
  AND fr.ctid > keep.ctid;

-- 2. Empêche les futurs doublons pending (sender + email)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_friend_request
  ON public.friend_requests (sender_id, lower(email))
  WHERE status = 'pending';
