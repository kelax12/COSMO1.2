-- Preuve de la mig. 250 (`friend_requests` à la forme de la production),
-- acteur par acteur.
--
-- Forme de `208-210.proof.sql` : un SEUL bloc `DO` qui se termine TOUJOURS
-- par `RAISE EXCEPTION`. La migration est EMBARQUÉE (texte identique au
-- fichier, vérifié par `e2e/rls/preuves-dette-sql.test.ts`) : la preuve se
-- joue AVANT application et s'annule avec elle.
--   → « PREUVE-ANNULEE 0 ECHEC | info avant … | ok 01 … »
--
-- Acteurs, fabriqués dans le bloc puis annulés avec lui :
--   A expéditeur · B destinataire inscrit · C tiers · anon.
--
-- Ce qui est vérifié, APRÈS la migration :
--   · catalogue : plus de `user_id`, `sender_id` NOT NULL, unicité des
--     demandes en attente présente ;
--   · A (authenticated) envoie une demande comme `sendFriendRequest` (sans
--     `user_id`) : acceptée, destinataire résolu par le trigger ;
--   · A et B la lisent ; C ne la lit ni ne la modifie ; C ne peut pas
--     envoyer au nom de A ; A ne peut ni la doubler ni envoyer sans
--     expéditeur ; anon ne lit rien et n'insère rien.
--
-- Procédure d'application en production (après accord d'Axel) :
--   1. relire le ledger : dernière entrée attendue 245 (ou 246), jamais `250_` ;
--   2. compter `SELECT count(*) FROM public.friend_requests WHERE sender_id IS NULL`
--      (doit valoir 0, sinon la migration s'arrête d'elle-même) ;
--   3. jouer CETTE preuve : « PREUVE-ANNULEE 0 ECHEC » ;
--   4. appliquer le fichier sous le nom `250_friend_requests_forme_prod` ;
--   5. relire `information_schema.columns` (pas de `user_id`, `sender_id`
--      `is_nullable = NO`) et `pg_indexes` (`uniq_pending_friend_request`).
--
-- Passe témoin, jouée SANS la migration (retirer l'`EXECUTE $mig$`) sur une
-- base reconstruite depuis le dépôt : `ECHEC catalogue` et `ECHEC 01` (23502,
-- `user_id`).

DO $proof$
DECLARE
  r     text[] := '{}';
  ko    int := 0;
  A     constant uuid := '00000000-0000-0000-0000-00000000a250';
  B     constant uuid := '00000000-0000-0000-0000-00000000b250';
  C     constant uuid := '00000000-0000-0000-0000-00000000c250';
  req   uuid;
  rcv   uuid;
  nb    int;
  nul   text;
  col   int;
  idx   int;
BEGIN
  -- ── Relevé AVANT ──────────────────────────────────────────────────
  SELECT count(*) INTO col FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'friend_requests' AND column_name = 'user_id';
  SELECT is_nullable INTO nul FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'friend_requests' AND column_name = 'sender_id';
  r := r || format('info avant : colonne user_id %s, sender_id nullable %s, lignes sans sender_id : %s, lignes : %s',
    col, nul,
    (SELECT count(*) FROM public.friend_requests WHERE sender_id IS NULL),
    (SELECT count(*) FROM public.friend_requests));

  EXECUTE $mig$
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
$mig$;

  -- ── Catalogue ─────────────────────────────────────────────────────
  SELECT count(*) INTO col FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'friend_requests' AND column_name = 'user_id';
  SELECT is_nullable INTO nul FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'friend_requests' AND column_name = 'sender_id';
  SELECT count(*) INTO idx FROM pg_indexes
   WHERE schemaname = 'public' AND tablename = 'friend_requests' AND indexname = 'uniq_pending_friend_request';
  IF col = 0 AND nul = 'NO' AND idx = 1 THEN
    r := r || 'ok catalogue : plus de user_id, sender_id NOT NULL, uniq_pending_friend_request present'::text;
  ELSE
    ko := ko + 1; r := r || format('ECHEC catalogue : user_id %s, sender_id nullable %s, index unique %s', col, nul, idx);
  END IF;

  -- ── Fixtures (rôle propriétaire) ──────────────────────────────────
  INSERT INTO auth.users (id, email) VALUES
    (A, 'a250@proof.invalid'), (B, 'b250@proof.invalid'), (C, 'c250@proof.invalid');
  INSERT INTO public.profiles (id, email, display_name)
    SELECT id, email, split_part(email, '@', 1) FROM auth.users WHERE email LIKE '%250@proof.invalid'
    ON CONFLICT (id) DO NOTHING;

  -- ── A, sous RLS ───────────────────────────────────────────────────
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', A::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);

  BEGIN
    INSERT INTO public.friend_requests (email, status, sent_at, sender_id)
      VALUES ('b250@proof.invalid', 'pending', now(), A) RETURNING id, receiver_id INTO req, rcv;
    IF rcv = B THEN r := r || 'ok 01 A envoie une demande sans user_id, destinataire resolu'::text;
    ELSE ko := ko + 1; r := r || format('ECHEC 01 demande creee, destinataire %s', rcv); END IF;
  EXCEPTION WHEN OTHERS THEN
    ko := ko + 1; r := r || format('ECHEC 01 envoi refuse (%s %s)', SQLSTATE, SQLERRM);
  END;

  SELECT count(*) INTO nb FROM public.friend_requests WHERE id = req;
  IF nb = 1 THEN r := r || 'ok 02 A relit sa demande'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC 02 A lit %s ligne(s)', nb); END IF;

  BEGIN
    INSERT INTO public.friend_requests (email, status, sent_at, sender_id)
      VALUES ('B250@proof.invalid', 'pending', now(), A);
    ko := ko + 1; r := r || 'ECHEC 03 une seconde demande en attente au meme destinataire passe'::text;
  EXCEPTION WHEN unique_violation THEN
    r := r || 'ok 03 seconde demande en attente refusee (23505)'::text;
  WHEN OTHERS THEN
    ko := ko + 1; r := r || format('ECHEC 03 refus inattendu (%s %s)', SQLSTATE, SQLERRM);
  END;

  BEGIN
    INSERT INTO public.friend_requests (email, status, sent_at, sender_id)
      VALUES ('c250@proof.invalid', 'pending', now(), NULL);
    ko := ko + 1; r := r || 'ECHEC 04 une demande sans expediteur passe'::text;
  EXCEPTION WHEN OTHERS THEN
    r := r || format('ok 04 demande sans expediteur refusee (%s)', SQLSTATE);
  END;

  -- ── B, destinataire ───────────────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', B::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', B, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO nb FROM public.friend_requests WHERE id = req;
  IF nb = 1 THEN r := r || 'ok 05 B lit la demande recue'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC 05 B lit %s ligne(s)', nb); END IF;

  -- ── C, tiers ──────────────────────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', C::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', C, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO nb FROM public.friend_requests WHERE id = req;
  IF nb = 0 THEN r := r || 'ok 06 C ne lit pas la demande'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC 06 C lit %s ligne(s)', nb); END IF;
  UPDATE public.friend_requests SET status = 'accepted' WHERE id = req;
  GET DIAGNOSTICS nb = ROW_COUNT;
  IF nb = 0 THEN r := r || 'ok 07 C ne modifie pas la demande'::text;
  ELSE ko := ko + 1; r := r || format('ECHEC 07 C modifie %s ligne(s)', nb); END IF;
  BEGIN
    INSERT INTO public.friend_requests (email, status, sent_at, sender_id)
      VALUES ('c250@proof.invalid', 'pending', now(), A);
    ko := ko + 1; r := r || 'ECHEC 08 C envoie au nom de A'::text;
  EXCEPTION WHEN insufficient_privilege THEN
    r := r || 'ok 08 C ne peut pas envoyer au nom de A (42501)'::text;
  WHEN OTHERS THEN
    ko := ko + 1; r := r || format('ECHEC 08 refus inattendu (%s %s)', SQLSTATE, SQLERRM);
  END;

  -- ── anon ──────────────────────────────────────────────────────────
  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  BEGIN
    SELECT count(*) INTO nb FROM public.friend_requests WHERE id = req;
    IF nb = 0 THEN r := r || 'ok 09 anon ne lit rien'::text;
    ELSE ko := ko + 1; r := r || format('ECHEC 09 anon lit %s ligne(s)', nb); END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    r := r || 'ok 09 anon ne lit rien (42501)'::text;
  END;
  BEGIN
    INSERT INTO public.friend_requests (email, status, sent_at, sender_id)
      VALUES ('c250@proof.invalid', 'pending', now(), A);
    ko := ko + 1; r := r || 'ECHEC 10 anon insere une demande'::text;
  EXCEPTION WHEN OTHERS THEN
    r := r || format('ok 10 anon ne peut pas inserer (%s)', SQLSTATE);
  END;

  RAISE EXCEPTION 'PREUVE-ANNULEE % ECHEC | %', ko, array_to_string(r, ' | ');
END $proof$;
