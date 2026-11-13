-- ═══════════════════════════════════════════════════════════════════
-- 250 · `friend_requests` : le dépôt rejoint la forme de la production
--
-- ── POURQUOI ───────────────────────────────────────────────────────
--
-- Relu au catalogue de production le 2026-11-13 : `friend_requests` n'a PAS
-- de colonne `user_id`, et `sender_id` y est nullable. Le dépôt, lui, rejoué
-- sur une base vierge, gardait `user_id uuid NOT NULL` (mig. 007, jamais
-- retirée par la 012) : `sendFriendRequest` n'écrit que `sender_id`, donc
-- tout envoi de demande échouait en 23502 sur une base reconstruite depuis
-- le dépôt (divergence `FRIENDS-USER-ID` des contrats, `schema-drift.spec.ts`).
--
-- ── CE QUI DÉPENDAIT DE `user_id` ──────────────────────────────────
--
-- Relevé dans les migrations et `supabase/schema.sql` : la contrainte unique
-- `friend_requests_user_id_email_key`, la clé étrangère
-- `friend_requests_user_id_fkey`, l'index `idx_friend_requests_user_id`.
-- AUCUNE policy, aucun trigger, aucune fonction ne lit ni n'écrit
-- `friend_requests.user_id` (les `user_id` de la 012 visent `friends`).
-- L'unicité passe par `uniq_pending_friend_request` (mig. 033), sur
-- `(sender_id, lower(email))` : reposée ici à l'identique si elle manque.
--
-- ── `sender_id` : NOT NULL ─────────────────────────────────────────
--
-- Le seul chemin d'écriture est `sendFriendRequest`, qui pose toujours
-- `sender_id = auth.uid()`, et la policy d'INSERT l'exige (`auth.uid() =
-- sender_id`) ; la clé étrangère est en CASCADE, jamais SET NULL. Le code
-- respecte donc toujours NOT NULL : on garde la forme stricte du dépôt, et
-- on la pose en production. S'il existe une ligne à `sender_id` NULL, la
-- migration s'arrête AVANT toute modification (rien n'est retiré).
--
-- Rejouable : en production (colonne déjà absente) seul le NOT NULL change.
-- Preuve : `supabase/proofs/250.proof.sql`.
-- ═══════════════════════════════════════════════════════════════════

DO $garde$
DECLARE
  n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.friend_requests WHERE sender_id IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'mig. 250 : % demande(s) d''ami sans sender_id, NOT NULL impossible ; rien n''est modifie', n
      USING ERRCODE = '23502';
  END IF;
END
$garde$;

ALTER TABLE public.friend_requests DROP CONSTRAINT IF EXISTS friend_requests_user_id_email_key;
ALTER TABLE public.friend_requests DROP CONSTRAINT IF EXISTS friend_requests_user_id_fkey;
DROP INDEX IF EXISTS public.idx_friend_requests_user_id;
ALTER TABLE public.friend_requests DROP COLUMN IF EXISTS user_id;

ALTER TABLE public.friend_requests ALTER COLUMN sender_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_friend_request
  ON public.friend_requests USING btree (sender_id, lower(email)) WHERE (status = 'pending'::text);

COMMENT ON COLUMN public.friend_requests.sender_id IS
  'Expéditeur de la demande (mig. 250) : toujours auth.uid() à l''insertion (policy « Senders can create requests »), NOT NULL. La table n''a plus de user_id.';
