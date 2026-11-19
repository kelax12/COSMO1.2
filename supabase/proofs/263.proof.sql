-- Preuve de la mig. 263 (`org_settings.locale` admet `hr`), acteur par acteur.
--
-- Forme de `208-210.proof.sql` : un SEUL bloc `DO` qui se termine TOUJOURS
-- par `RAISE EXCEPTION`. La migration est EMBARQUÉE (texte identique au
-- fichier, vérifié par `e2e/rls/preuves-dette-sql.test.ts`) : la preuve se
-- joue AVANT application et s'annule avec elle.
--   → « PREUVE-ANNULEE 0 ECHEC | info avant … | ok 01 … »
--
-- Acteurs, fabriqués dans le bloc puis annulés avec lui :
--   A admin de l'organisation · M membre · anon.
--
-- Ce qui est vérifié, APRÈS la migration :
--   · catalogue : une seule contrainte `org_settings_locale`, qui nomme `hr` ;
--   · A pose `hr`, puis repasse en `en` et `fr` : acceptés ;
--   · A pose `de` : refusé (23514), la contrainte borne toujours ;
--   · M ne peut pas poser `hr` (RLS : aucune ligne modifiée) ;
--   · anon ne lit pas les réglages.
--
-- Procédure d'application en production (après accord d'Axel) :
--   1. relire le ledger : jamais d'entrée `263_` ;
--   2. jouer CETTE preuve : « PREUVE-ANNULEE 0 ECHEC » ;
--   3. appliquer le fichier sous le nom `263_org_settings_locale_hr` ;
--   4. relire `pg_get_constraintdef` de `org_settings_locale` : `fr`, `en`, `hr`.
--
-- Passe témoin, jouée SANS la migration (retirer l'`EXECUTE $mig$`) :
-- `ECHEC catalogue` et `ECHEC 01` (23514).

DO $proof$
DECLARE
  r     text[] := '{}';
  ko    int := 0;
  A     constant uuid := '00000000-0000-0000-0000-00000000a251';
  M     constant uuid := '00000000-0000-0000-0000-00000000d251';
  O     constant uuid := '10000000-0000-0000-0000-000000000251';
  def   text;
  n     int;
  loc   text;
BEGIN
  -- ── Relevé AVANT ──────────────────────────────────────────────────
  SELECT pg_get_constraintdef(c.oid) INTO def FROM pg_constraint c
   WHERE c.conrelid = 'public.org_settings'::regclass AND c.conname = 'org_settings_locale';
  r := r || format('info avant : %s, lignes : %s', def, (SELECT count(*) FROM public.org_settings));

  EXECUTE $mig$
-- ═══════════════════════════════════════════════════════════════════
-- 263 · `org_settings.locale` admet le croate (`hr`)
--
-- ── POURQUOI ───────────────────────────────────────────────────────
--
-- COSMO s'ouvre au croate (lot 3 de l'ajout de `hr`). La langue d'une
-- organisation est stockée dans `org_settings.locale` (mig. 195), et lue par
-- l'Edge Function `org-digest` pour rédiger le résumé par courriel. La
-- contrainte `org_settings_locale` (mig. 195, `CHECK (locale IN ('fr','en'))`)
-- refuserait en 23514 le réglage d'une organisation croate.
--
-- ── CE QUI CHANGE ──────────────────────────────────────────────────
--
-- La seule contrainte : `('fr', 'en')` devient `('fr', 'en', 'hr')`. Le
-- défaut reste `'fr'`, aucune ligne n'est réécrite, aucune policy, aucun
-- droit ni trigger n'est touché. Les valeurs déjà présentes (`fr`, `en`)
-- restent admises : la revalidation de la contrainte ne peut pas échouer.
--
-- ── ORDRE ──────────────────────────────────────────────────────────
--
-- Sans risque avant le front : tant que l'écran ne propose pas `hr`, rien ne
-- l'écrit. `org-digest` lit toute valeur inconnue comme du français.
--
-- Rejouable. Preuve : `supabase/proofs/263.proof.sql`.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.org_settings DROP CONSTRAINT IF EXISTS org_settings_locale;
ALTER TABLE public.org_settings
  ADD CONSTRAINT org_settings_locale CHECK (locale IN ('fr', 'en', 'hr'));

COMMENT ON CONSTRAINT org_settings_locale ON public.org_settings IS
  'Langue de l''organisation (mig. 263) : fr, en ou hr. Lue par l''Edge Function org-digest, repli sur fr.';
$mig$;

  -- ── Catalogue ─────────────────────────────────────────────────────
  SELECT count(*) INTO n FROM pg_constraint c
   WHERE c.conrelid = 'public.org_settings'::regclass AND c.conname = 'org_settings_locale';
  SELECT pg_get_constraintdef(c.oid) INTO def FROM pg_constraint c
   WHERE c.conrelid = 'public.org_settings'::regclass AND c.conname = 'org_settings_locale';
  IF n = 1 AND def LIKE '%''hr''%' AND def LIKE '%''fr''%' AND def LIKE '%''en''%' THEN
    r := r || 'ok catalogue : une contrainte org_settings_locale, fr en hr'::text;
  ELSE
    ko := ko + 1; r := r || format('ECHEC catalogue : %s contrainte(s), %s', n, def);
  END IF;

  -- ── Fixtures (rôle propriétaire) ──────────────────────────────────
  INSERT INTO auth.users (id, email) VALUES (A, 'a251@proof.invalid'), (M, 'm251@proof.invalid');
  INSERT INTO public.profiles (id, email, display_name)
    SELECT id, email, split_part(email, '@', 1) FROM auth.users WHERE email LIKE '%263@proof.invalid'
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organizations (id, name, join_code, owner_id) VALUES (O, 'Preuve 263', 'PRF263', A);
  INSERT INTO public.organization_members (org_id, user_id, role, manager_id) VALUES
    (O, A, 'admin', NULL), (O, M, 'member', A)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.org_settings (org_id) VALUES (O) ON CONFLICT (org_id) DO NOTHING;

  -- ── A, admin, sous RLS ────────────────────────────────────────────
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', A::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);

  BEGIN
    UPDATE public.org_settings SET locale = 'hr' WHERE org_id = O;
    GET DIAGNOSTICS n = ROW_COUNT;
    SELECT locale INTO loc FROM public.org_settings WHERE org_id = O;
    IF n = 1 AND loc = 'hr' THEN r := r || 'ok 01 A pose la langue hr'::text;
    ELSE ko := ko + 1; r := r || format('ECHEC 01 %s ligne(s), langue %s', n, loc); END IF;
  EXCEPTION WHEN OTHERS THEN
    ko := ko + 1; r := r || format('ECHEC 01 hr refuse (%s %s)', SQLSTATE, SQLERRM);
  END;

  BEGIN
    UPDATE public.org_settings SET locale = 'en' WHERE org_id = O;
    UPDATE public.org_settings SET locale = 'fr' WHERE org_id = O;
    SELECT locale INTO loc FROM public.org_settings WHERE org_id = O;
    IF loc = 'fr' THEN r := r || 'ok 02 A repasse en en puis fr'::text;
    ELSE ko := ko + 1; r := r || format('ECHEC 02 langue %s', loc); END IF;
  EXCEPTION WHEN OTHERS THEN
    ko := ko + 1; r := r || format('ECHEC 02 en ou fr refuse (%s %s)', SQLSTATE, SQLERRM);
  END;

  BEGIN
    UPDATE public.org_settings SET locale = 'de' WHERE org_id = O;
    ko := ko + 1; r := r || 'ECHEC 03 la langue de passe'::text;
  EXCEPTION WHEN check_violation THEN
    r := r || 'ok 03 langue de refusee (23514)'::text;
  WHEN OTHERS THEN
    ko := ko + 1; r := r || format('ECHEC 03 refus inattendu (%s %s)', SQLSTATE, SQLERRM);
  END;

  -- ── M, membre ─────────────────────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', M::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', M, 'role', 'authenticated')::text, true);
  BEGIN
    UPDATE public.org_settings SET locale = 'hr' WHERE org_id = O;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n = 0 THEN r := r || 'ok 04 M ne change pas la langue'::text;
    ELSE ko := ko + 1; r := r || format('ECHEC 04 M modifie %s ligne(s)', n); END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    r := r || 'ok 04 M ne change pas la langue (42501)'::text;
  WHEN OTHERS THEN
    ko := ko + 1; r := r || format('ECHEC 04 refus inattendu (%s %s)', SQLSTATE, SQLERRM);
  END;

  -- ── anon ──────────────────────────────────────────────────────────
  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  BEGIN
    SELECT count(*) INTO n FROM public.org_settings WHERE org_id = O;
    IF n = 0 THEN r := r || 'ok 05 anon ne lit pas les reglages'::text;
    ELSE ko := ko + 1; r := r || format('ECHEC 05 anon lit %s ligne(s)', n); END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    r := r || 'ok 05 anon ne lit pas les reglages (42501)'::text;
  END;

  RAISE EXCEPTION '%', format('PREUVE-ANNULEE %s ECHEC | %s', ko, array_to_string(r, ' | '));
END
$proof$;
