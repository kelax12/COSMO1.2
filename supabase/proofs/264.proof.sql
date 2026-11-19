-- Preuve de la mig. 264 (le bucket `avatars` ne se liste plus sans compte), acteur par acteur.
--
-- Forme de `208-210.proof.sql` : un SEUL bloc `DO` qui se termine TOUJOURS
-- par `RAISE EXCEPTION`. La migration est EMBARQUÉE (texte identique au
-- fichier, vérifié par `e2e/rls/preuves-dette-sql.test.ts`) : la preuve se
-- joue AVANT application et s'annule avec elle.
--   → « PREUVE-ANNULEE 0 ECHEC | info avant … | ok 01 … »
--
-- Acteurs : U et V, deux comptes authentifiés (seul le claim `sub` compte,
-- `storage.foldername` le compare au dossier) · anon. Deux objets fabriqués
-- dans le bucket `avatars`, un par compte, annulés avec le bloc.
--
-- Ce qui est vérifié, APRÈS la migration :
--   · catalogue : une seule policy SELECT sur `storage.objects` qui nomme le
--     bucket `avatars`, `avatars_owner_read`, pour `authenticated` seul ;
--   · anon ne liste plus rien du bucket ;
--   · U lit son objet (l'upsert en a besoin), et pas celui de V ;
--   · V lit le sien seul.
--
-- Procédure d'application en production (après accord d'Axel) :
--   1. relire le ledger : jamais d'entrée `264_` ;
--   2. jouer CETTE preuve sur la préprod : « PREUVE-ANNULEE 0 ECHEC » ;
--   3. appliquer le fichier sous le nom `264_avatars_sans_listage` ;
--   4. relire `pg_policies` (schéma storage, table objects, SELECT) : une
--      ligne, `avatars_owner_read`, `{authenticated}` ; puis changer sa photo.
--
-- Passe témoin, jouée SANS la migration (retirer l'`EXECUTE $mig$`) :
-- `ECHEC catalogue` et `ECHEC 01` (anon liste les deux objets).

DO $proof$
DECLARE
  r     text[] := '{}';
  ko    int := 0;
  U     constant uuid := '00000000-0000-0000-0000-00000000a264';
  V     constant uuid := '00000000-0000-0000-0000-00000000b264';
  n     int;
  pols  text;
BEGIN
  -- ── Relevé AVANT ──────────────────────────────────────────────────
  SELECT string_agg(policyname || ':' || roles::text, ', ' ORDER BY policyname) INTO pols
    FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND cmd = 'SELECT';
  r := r || format('info avant : %s', coalesce(pols, 'aucune'));

  EXECUTE $mig$
-- ═══════════════════════════════════════════════════════════════════
-- 264 · le bucket `avatars` ne se LISTE plus sans compte
--
-- ── POURQUOI ───────────────────────────────────────────────────────
--
-- La mig. 084 pose `avatars_public_read`, une policy SELECT sur
-- `storage.objects` sans rôle (donc `anon` compris), bornée au seul bucket.
-- Sur `storage.objects`, une policy SELECT ne sert pas à AFFICHER une image
-- d'un bucket public (l'URL publique est servie sans passer par la RLS) :
-- elle sert à LISTER. Sans compte, on énumère le bucket, et chaque dossier
-- porte l'UUID d'un compte (`<uid>/avatar.jpg`) : la liste des comptes qui
-- ont une photo. Écrite en 209 sur une branche jamais fusionnée ; le numéro
-- a été pris depuis, d'où le 264.
--
-- ── CE QUI CHANGE ──────────────────────────────────────────────────
--
-- `avatars_public_read` est retirée, remplacée par `avatars_owner_read` :
-- lecture réservée à `authenticated`, dans le seul dossier de l'appelant.
-- Elle reste NÉCESSAIRE : `upload(…, { upsert: true })`
-- (`src/lib/avatar-upload.ts`) relit l'objet existant avant de l'écraser.
--
-- Inchangés : l'affichage (URL publique), l'écriture et la suppression
-- limitées au dossier de l'appelant (mig. 084), `delete-account`, qui passe
-- par le rôle de service.
--
-- Retour arrière : supprimer `avatars_owner_read`, puis recréer la policy de
-- lecture de la mig. 084 § avatars à l'identique (pas recopiée ici :
-- `check:rls` lit les commentaires et y verrait une policy vivante).
--
-- ── ORDRE ──────────────────────────────────────────────────────────
--
-- Aucun code ne liste le bucket : sans risque avant comme après le front.
-- Après application, changer SA photo dans les réglages (chemin `upsert`)
-- avant de déclarer la migration vérifiée.
--
-- Rejouable. Preuve : `supabase/proofs/264.proof.sql`.
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;

DROP POLICY IF EXISTS "avatars_owner_read" ON storage.objects;
CREATE POLICY "avatars_owner_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
$mig$;

  -- ── Catalogue ─────────────────────────────────────────────────────
  SELECT count(*), string_agg(policyname || ':' || roles::text, ', ') INTO n, pols
    FROM pg_policies
   WHERE schemaname = 'storage' AND tablename = 'objects' AND cmd = 'SELECT'
     AND coalesce(qual, '') LIKE '%avatars%';
  IF n = 1 AND pols = 'avatars_owner_read:{authenticated}' THEN
    r := r || 'ok catalogue : une policy SELECT avatars, avatars_owner_read pour authenticated'::text;
  ELSE
    ko := ko + 1; r := r || format('ECHEC catalogue : %s policy(s), %s', n, pols);
  END IF;

  -- ── Fixtures (rôle propriétaire) ──────────────────────────────────
  INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO storage.objects (bucket_id, name) VALUES
    ('avatars', U::text || '/avatar.jpg'),
    ('avatars', V::text || '/avatar.jpg');

  -- ── anon ──────────────────────────────────────────────────────────
  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  BEGIN
    SELECT count(*) INTO n FROM storage.objects
     WHERE bucket_id = 'avatars' AND name IN (U::text || '/avatar.jpg', V::text || '/avatar.jpg');
    IF n = 0 THEN r := r || 'ok 01 anon ne liste pas le bucket'::text;
    ELSE ko := ko + 1; r := r || format('ECHEC 01 anon liste %s objet(s)', n); END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    r := r || 'ok 01 anon ne liste pas le bucket (42501)'::text;
  END;

  -- ── U ─────────────────────────────────────────────────────────────
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', U::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', U, 'role', 'authenticated')::text, true);
  BEGIN
    SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'avatars' AND name = U::text || '/avatar.jpg';
    IF n = 1 THEN r := r || 'ok 02 U lit son objet (upsert)'::text;
    ELSE ko := ko + 1; r := r || format('ECHEC 02 U lit %s objet(s) a lui', n); END IF;
    SELECT count(*) INTO n FROM storage.objects WHERE bucket_id = 'avatars' AND name = V::text || '/avatar.jpg';
    IF n = 0 THEN r := r || 'ok 03 U ne lit pas celui de V'::text;
    ELSE ko := ko + 1; r := r || format('ECHEC 03 U lit %s objet(s) de V', n); END IF;
  EXCEPTION WHEN OTHERS THEN
    ko := ko + 1; r := r || format('ECHEC 02-03 lecture refusee (%s %s)', SQLSTATE, SQLERRM);
  END;

  -- ── V ─────────────────────────────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', V::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', V, 'role', 'authenticated')::text, true);
  BEGIN
    SELECT count(*) INTO n FROM storage.objects
     WHERE bucket_id = 'avatars' AND name IN (U::text || '/avatar.jpg', V::text || '/avatar.jpg');
    IF n = 1 THEN r := r || 'ok 04 V ne lit que le sien'::text;
    ELSE ko := ko + 1; r := r || format('ECHEC 04 V lit %s objet(s)', n); END IF;
  EXCEPTION WHEN OTHERS THEN
    ko := ko + 1; r := r || format('ECHEC 04 lecture refusee (%s %s)', SQLSTATE, SQLERRM);
  END;

  RAISE EXCEPTION '%', format('PREUVE-ANNULEE %s ECHEC | %s', ko, array_to_string(r, ' | '));
END
$proof$;
