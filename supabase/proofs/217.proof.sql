-- Preuve de la mig. 217 (source d'acquisition rattachée après une inscription Google).
--
-- Même forme que 208-210, 214 et 215 : un seul bloc `DO`, toujours terminé par
-- `RAISE EXCEPTION`, qui applique lui-même la migration.
--   Passe normale : « PREUVE-ANNULEE 0 ECHEC | … »
--   Passe TÉMOIN  : précéder de `SELECT set_config('proof.skip_migration', 'on', false);`
--                   la fonction n'existe pas, les cas 01 et 05 DOIVENT échouer.
--
-- Acteurs : N compte neuf sans source · M compte neuf, valeurs douteuses ·
--           S compte neuf qui a déjà une source · A compte ancien (2 jours).

DO $proof$
DECLARE
  r  text[] := '{}';
  ko int := 0;
  N constant uuid := '00000000-0000-0000-0000-0000000a0217';
  M constant uuid := '00000000-0000-0000-0000-0000000b0217';
  S constant uuid := '00000000-0000-0000-0000-0000000c0217';
  A constant uuid := '00000000-0000-0000-0000-0000000d0217';
  skip boolean := coalesce(current_setting('proof.skip_migration', true), '') = 'on';
  ok_ boolean; src text; cmp text;
BEGIN
  IF NOT skip THEN
    EXECUTE $mig$
CREATE OR REPLACE FUNCTION public.claim_acquisition_source(
  p_source   text,
  p_campaign text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  c_re       CONSTANT text := '^[a-z0-9_-]{1,40}$';
  v_uid      uuid := auth.uid();
  v_campaign text := p_campaign;
  v_count    int;
BEGIN
  IF v_uid IS NULL OR p_source IS NULL OR p_source !~ c_re THEN
    RETURN false;
  END IF;
  IF v_campaign IS NOT NULL AND v_campaign !~ c_re THEN
    v_campaign := NULL;
  END IF;

  UPDATE public.profiles p
     SET acquisition_source   = p_source,
         acquisition_campaign = v_campaign
   WHERE p.id = v_uid
     AND p.acquisition_source IS NULL
     AND EXISTS (
       SELECT 1 FROM auth.users u
        WHERE u.id = v_uid
          AND u.created_at > now() - interval '1 hour'
     );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$function$;
    $mig$;
    EXECUTE 'REVOKE ALL ON FUNCTION public.claim_acquisition_source(text, text) FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON FUNCTION public.claim_acquisition_source(text, text) FROM anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.claim_acquisition_source(text, text) TO authenticated';
  END IF;

  -- Le trigger handle_new_user_profile crée la ligne `profiles` de chacun.
  INSERT INTO auth.users(id, email, created_at) VALUES
    (N, 'n217@proof.invalid', now()),
    (M, 'm217@proof.invalid', now()),
    (S, 's217@proof.invalid', now()),
    (A, 'a217@proof.invalid', now() - interval '2 days');
  INSERT INTO public.profiles(id, email) VALUES
    (N, 'n217@proof.invalid'), (M, 'm217@proof.invalid'),
    (S, 's217@proof.invalid'), (A, 'a217@proof.invalid')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET acquisition_source = 'seo' WHERE id = S;

  EXECUTE 'SET LOCAL ROLE authenticated';

  -- ── 01 · compte Google neuf : la source est inscrite ──────────────
  PERFORM set_config('request.jwt.claim.sub', N::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', N, 'role', 'authenticated')::text, true);
  BEGIN
    ok_ := public.claim_acquisition_source('tiktok', 'reels');
    SELECT acquisition_source, acquisition_campaign INTO src, cmp FROM public.profiles WHERE id = N;
    IF ok_ AND src = 'tiktok' AND cmp = 'reels' THEN r := r || 'ok 01 compte neuf : tiktok/reels inscrits'::text;
    ELSE ko := ko+1; r := r || ('ECHEC 01 : ' || ok_ || ' ' || coalesce(src,'NULL') || '/' || coalesce(cmp,'NULL')); END IF;
  EXCEPTION WHEN OTHERS THEN ko := ko+1; r := r || ('ECHEC 01 : ' || SQLERRM);
  END;

  -- ── 02 · first-touch : un second appel n'écrase rien ──────────────
  BEGIN
    ok_ := public.claim_acquisition_source('instagram', NULL);
    SELECT acquisition_source INTO src FROM public.profiles WHERE id = N;
    IF NOT ok_ AND src = 'tiktok' THEN r := r || 'ok 02 second appel : rien ecrase'::text;
    ELSE ko := ko+1; r := r || ('ECHEC 02 : ' || ok_ || ' ' || coalesce(src,'NULL')); END IF;
  EXCEPTION WHEN OTHERS THEN ko := ko+1; r := r || ('ECHEC 02 : ' || SQLERRM);
  END;

  -- ── 03 · valeur hors whitelist refusée, campagne douteuse jetée ───
  PERFORM set_config('request.jwt.claim.sub', M::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', M, 'role', 'authenticated')::text, true);
  BEGIN
    ok_ := public.claim_acquisition_source('TikTok<b>', NULL);
    SELECT acquisition_source INTO src FROM public.profiles WHERE id = M;
    IF NOT ok_ AND src IS NULL THEN r := r || 'ok 03a source hors whitelist refusee'::text;
    ELSE ko := ko+1; r := r || ('ECHEC 03a : ' || ok_ || ' ' || coalesce(src,'NULL')); END IF;
    ok_ := public.claim_acquisition_source('reddit', 'x y');
    SELECT acquisition_source, acquisition_campaign INTO src, cmp FROM public.profiles WHERE id = M;
    IF ok_ AND src = 'reddit' AND cmp IS NULL THEN r := r || 'ok 03b campagne douteuse jetee, source gardee'::text;
    ELSE ko := ko+1; r := r || ('ECHEC 03b : ' || ok_ || ' ' || coalesce(src,'NULL') || '/' || coalesce(cmp,'NULL')); END IF;
  EXCEPTION WHEN OTHERS THEN ko := ko+1; r := r || ('ECHEC 03 : ' || SQLERRM);
  END;

  -- ── 04 · une source déjà posée (inscription e-mail) ne bouge pas ──
  PERFORM set_config('request.jwt.claim.sub', S::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', S, 'role', 'authenticated')::text, true);
  BEGIN
    ok_ := public.claim_acquisition_source('tiktok', NULL);
    SELECT acquisition_source INTO src FROM public.profiles WHERE id = S;
    IF NOT ok_ AND src = 'seo' THEN r := r || 'ok 04 source existante conservee'::text;
    ELSE ko := ko+1; r := r || ('ECHEC 04 : ' || ok_ || ' ' || coalesce(src,'NULL')); END IF;
  EXCEPTION WHEN OTHERS THEN ko := ko+1; r := r || ('ECHEC 04 : ' || SQLERRM);
  END;

  -- ── 05 · un compte ancien ne s'attribue pas après coup ────────────
  PERFORM set_config('request.jwt.claim.sub', A::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', A, 'role', 'authenticated')::text, true);
  BEGIN
    ok_ := public.claim_acquisition_source('tiktok', NULL);
    SELECT acquisition_source INTO src FROM public.profiles WHERE id = A;
    IF ok_ IS NOT NULL AND NOT ok_ AND src IS NULL THEN r := r || 'ok 05 compte de 2 jours : refuse'::text;
    ELSE ko := ko+1; r := r || ('ECHEC 05 : ' || coalesce(ok_::text,'NULL') || ' ' || coalesce(src,'NULL')); END IF;
  EXCEPTION WHEN OTHERS THEN ko := ko+1; r := r || ('ECHEC 05 : ' || SQLERRM);
  END;

  -- ── 06 · sans identité : rien ─────────────────────────────────────
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  BEGIN
    ok_ := public.claim_acquisition_source('tiktok', NULL);
    IF NOT ok_ THEN r := r || 'ok 06 sans uid : false'::text;
    ELSE ko := ko+1; r := r || 'ECHEC 06 sans uid : true'::text; END IF;
  EXCEPTION WHEN OTHERS THEN ko := ko+1; r := r || ('ECHEC 06 : ' || SQLERRM);
  END;
  EXECUTE 'RESET ROLE';

  -- ── 07 · droits et mode ───────────────────────────────────────────
  BEGIN
    IF NOT has_function_privilege('anon', 'public.claim_acquisition_source(text, text)', 'EXECUTE')
       AND has_function_privilege('authenticated', 'public.claim_acquisition_source(text, text)', 'EXECUTE')
       AND (SELECT prosecdef FROM pg_proc WHERE oid = 'public.claim_acquisition_source(text, text)'::regprocedure)
       AND (SELECT proconfig FROM pg_proc WHERE oid = 'public.claim_acquisition_source(text, text)'::regprocedure) = ARRAY['search_path=""'] THEN
      r := r || 'ok 07 anon f / authenticated t, DEFINER, search_path vide'::text;
    ELSE ko := ko+1; r := r || 'ECHEC 07 droits ou mode'::text; END IF;
  EXCEPTION WHEN OTHERS THEN ko := ko+1; r := r || ('ECHEC 07 : ' || SQLERRM);
  END;

  RAISE EXCEPTION 'PREUVE-ANNULEE % ECHEC% | %', ko, CASE WHEN skip THEN ' (TEMOIN sans migration)' ELSE '' END, array_to_string(r, ' | ');
END $proof$;
