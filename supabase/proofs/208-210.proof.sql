-- Preuve des mig. 208 (E-2), 209 (E-1) et 210 (G-3), acteur par acteur.
--
-- ⚠️ Forme différente des autres preuves de ce dossier : un SEUL bloc `DO`
-- qui se termine TOUJOURS par `RAISE EXCEPTION`. L'annulation n'est donc pas
-- une instruction qu'on pourrait oublier ou qu'un outil pourrait avaler
-- (`ROLLBACK` après une erreur, client qui valide en autocommit) : c'est la
-- seule issue du bloc. Le verdict est le texte de l'exception.
--   supabase db query --linked -f supabase/proofs/208-210.proof.sql
--   → « PREUVE-ANNULEE 0 ECHEC | ok 01 … | ok 02 … »
--
-- Pour la jouer AVANT application, préfixer le bloc par les trois migrations
-- (`EXECUTE` de leur texte en tête du bloc) : c'est ce qui a été fait en
-- production le 2026-10-01, avec une passe témoin SANS les migrations, qui
-- devait échouer et a échoué (cf. faille.md, E-1, E-2, G-3).
--
-- Acteurs, tous fabriqués dans le bloc puis annulés avec lui :
--   A admin · B manager de C · C membre · S admin SUSPENDU · E admin dont
--   l'accès a EXPIRÉ · X admin d'une AUTRE organisation · NW inscrit sans
--   organisation (réclame un lien).

DO $proof$
DECLARE
  r   text[] := '{}';
  ko  int := 0;
  A constant uuid := '00000000-0000-0000-0000-0000000a0208';
  B constant uuid := '00000000-0000-0000-0000-0000000b0208';
  C constant uuid := '00000000-0000-0000-0000-0000000c0208';
  S constant uuid := '00000000-0000-0000-0000-0000000d0208';
  E constant uuid := '00000000-0000-0000-0000-0000000e0208';
  X constant uuid := '00000000-0000-0000-0000-0000000f0208';
  NW constant uuid := '00000000-0000-0000-0000-000000010208';
  O  constant uuid := '10000000-0000-0000-0000-000000000208';
  O2 constant uuid := '10000000-0000-0000-0000-000000002208';
  OK constant uuid := '50000000-0000-0000-0000-000000000208';
  KR constant uuid := '60000000-0000-0000-0000-000000000208';
  L1 uuid; L2 uuid;
  n int; v numeric; st text; err text;
BEGIN
  -- ── Fixtures (rôle propriétaire) ──────────────────────────────────
  INSERT INTO auth.users(id,email) VALUES
    (A,'a208@proof.invalid'),(B,'b208@proof.invalid'),(C,'c208@proof.invalid'),
    (S,'s208@proof.invalid'),(E,'e208@proof.invalid'),(X,'x208@proof.invalid'),(NW,'n208@proof.invalid');
  INSERT INTO public.profiles(id,email,display_name)
    SELECT id,email,split_part(email,'@',1) FROM auth.users WHERE email LIKE '%208@proof.invalid'
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organizations(id,name,join_code,owner_id) VALUES (O,'Proof208','PRF208',A),(O2,'Proof208b','PRF2082',X);
  INSERT INTO public.organization_members(org_id,user_id,role,manager_id) VALUES
    (O,A,'admin',NULL),(O,B,'member',A),(O,C,'member',B),(O,S,'admin',NULL),(O,E,'admin',NULL),(O2,X,'admin',NULL)
    ON CONFLICT DO NOTHING;
  UPDATE public.organization_members SET suspended_at = now() WHERE org_id = O AND user_id = S;
  UPDATE public.organization_members SET access_expires_at = now() - interval '1 day' WHERE org_id = O AND user_id = E;
  INSERT INTO public.team_okrs(id,org_id,title) VALUES (OK,O,'Objectif');
  INSERT INTO public.team_key_results(id,okr_id,org_id,title) VALUES (KR,OK,O,'KR');
  INSERT INTO public.org_settings(org_id) VALUES (O) ON CONFLICT (org_id) DO NOTHING;
  UPDATE public.org_settings SET invite_domain_only = false WHERE org_id = O;

  -- ── E-2 · get_org_member_last_activity (mig. 208) ─────────────────
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', A::text, true);
  SELECT count(*) INTO n FROM public.get_org_member_last_activity(O);
  IF n = 6 - 1 THEN r := r || 'ok 01 admin actif : toute l org (5)'::text; ELSE ko := ko+1; r := r || ('ECHEC 01 admin actif voit ' || n || ', attendu 5'); END IF;
  PERFORM set_config('request.jwt.claim.sub', B::text, true);
  SELECT count(*) INTO n FROM public.get_org_member_last_activity(O);
  IF n = 1 THEN r := r || 'ok 02 manager : son sous-arbre (1)'::text; ELSE ko := ko+1; r := r || ('ECHEC 02 manager voit ' || n || ', attendu 1'); END IF;
  PERFORM set_config('request.jwt.claim.sub', C::text, true);
  SELECT count(*) INTO n FROM public.get_org_member_last_activity(O);
  IF n = 0 THEN r := r || 'ok 03 membre simple : 0'::text; ELSE ko := ko+1; r := r || ('ECHEC 03 membre voit ' || n); END IF;
  PERFORM set_config('request.jwt.claim.sub', S::text, true);
  SELECT count(*) INTO n FROM public.get_org_member_last_activity(O);
  IF n = 0 THEN r := r || 'ok 04 admin suspendu : 0'::text; ELSE ko := ko+1; r := r || ('ECHEC 04 admin suspendu voit ' || n); END IF;
  PERFORM set_config('request.jwt.claim.sub', E::text, true);
  SELECT count(*) INTO n FROM public.get_org_member_last_activity(O);
  IF n = 0 THEN r := r || 'ok 05 admin expire : 0'::text; ELSE ko := ko+1; r := r || ('ECHEC 05 admin expire voit ' || n); END IF;
  PERFORM set_config('request.jwt.claim.sub', X::text, true);
  SELECT count(*) INTO n FROM public.get_org_member_last_activity(O);
  IF n = 0 THEN r := r || 'ok 06 admin d une autre org : 0'::text; ELSE ko := ko+1; r := r || ('ECHEC 06 autre org voit ' || n); END IF;

  -- ── E-1 · insert_kr_checkin_row (mig. 209) ────────────────────────
  PERFORM set_config('request.jwt.claim.sub', A::text, true);
  BEGIN
    PERFORM public.insert_kr_checkin_row(KR, O, 80, 'on_track', 'forge');
    ko := ko+1; r := r || 'ECHEC 07 appel direct accepte : point d etape sans valeur'::text;
  EXCEPTION WHEN insufficient_privilege THEN r := r || 'ok 07 appel direct refuse (42501)'::text;
  END;
  PERFORM public.post_kr_checkin(KR, 42, 'at_risk', 'vrai');
  SELECT count(*) INTO n FROM public.team_kr_checkins WHERE kr_id = KR;
  SELECT current_value, health INTO v, st FROM public.team_key_results WHERE id = KR;
  IF n = 1 AND v = 42 AND st = 'at_risk' THEN r := r || 'ok 08 post_kr_checkin : 1 point, KR a 42 at_risk'::text;
  ELSE ko := ko+1; r := r || ('ECHEC 08 points=' || n || ' valeur=' || coalesce(v::text,'null') || ' etat=' || coalesce(st,'null')); END IF;
  PERFORM set_config('request.jwt.claim.sub', C::text, true);
  BEGIN
    PERFORM public.post_kr_checkin(KR, 99, 'off_track', 'membre');
    SELECT count(*) INTO n FROM public.team_kr_checkins WHERE kr_id = KR;
    r := r || ('info 09 membre simple post_kr_checkin : points=' || n);
  EXCEPTION WHEN OTHERS THEN r := r || ('ok 09 membre simple refuse : ' || SQLERRM);
  END;

  -- ── G-3 · liens ouverts sous invite_domain_only (mig. 210) ────────
  PERFORM set_config('request.jwt.claim.sub', A::text, true);
  INSERT INTO public.org_invite_links(org_id,created_by) VALUES (O,A) RETURNING id INTO L1;
  r := r || 'ok 10 option inactive : lien ouvert cree'::text;
  EXECUTE 'RESET ROLE';
  UPDATE public.org_settings SET invite_domain_only = true WHERE org_id = O;
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    INSERT INTO public.org_invite_links(org_id,created_by) VALUES (O,A) RETURNING id INTO L2;
    ko := ko+1; r := r || 'ECHEC 11 option active : lien ouvert cree'::text;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'open_link_not_allowed' AND SQLSTATE = 'P0001' THEN r := r || 'ok 11 option active : creation refusee (open_link_not_allowed, P0001)'::text;
    ELSE ko := ko+1; r := r || ('ECHEC 11 erreur inattendue : ' || SQLSTATE || ' ' || SQLERRM); END IF;
  END;
  PERFORM set_config('request.jwt.claim.sub', NW::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', NW, 'email', 'n208@proof.invalid', 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM * FROM public.claim_org_invite(L1);
    ko := ko+1; r := r || 'ECHEC 12 option active : lien ouvert ANCIEN reclame'::text;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'open_link_not_allowed' THEN r := r || 'ok 12 option active : reclamation refusee'::text;
    ELSE ko := ko+1; r := r || ('ECHEC 12 erreur inattendue : ' || SQLERRM); END IF;
  END;
  EXECUTE 'RESET ROLE';
  UPDATE public.org_settings SET invite_domain_only = false WHERE org_id = O;
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM * FROM public.claim_org_invite(L1);
    SELECT count(*) INTO n FROM public.organization_members WHERE org_id = O AND user_id = NW;
    IF n = 1 THEN r := r || 'ok 13 option retiree : le meme lien se reclame'::text; ELSE ko := ko+1; r := r || 'ECHEC 13 reclamation apres retrait'::text; END IF;
  EXCEPTION WHEN OTHERS THEN ko := ko+1; r := r || ('ECHEC 13 reclamation apres retrait : ' || SQLERRM);
  END;
  EXECUTE 'RESET ROLE';

  RAISE EXCEPTION 'PREUVE-ANNULEE % ECHEC | %', ko, array_to_string(r, ' | ');
END $proof$;
