-- Preuve de la mig. 212 (E-3 audience d'OKR, E-4 notifications d'un suspendu).
--
-- Un seul bloc `DO` dont la seule issue est `RAISE EXCEPTION` (rien ne reste) :
--   supabase db query --linked -f supabase/proofs/212.proof.sql
--   → « PREUVE-ANNULEE 0 ECHEC | ok 01 … »
-- Jouée en production le 2026-10-01 en deux passes : SANS la migration (témoin,
-- les cas E-3 et E-4 doivent échouer) puis AVEC, en tête du bloc.
--
-- Acteurs de l'organisation O :
--   A admin · M2 manager SANS LIEN avec l'OKR · MC manager CRÉATEUR de l'OKR ·
--   MV manager DANS l'audience · C membre dans l'audience · S membre SUSPENDU ·
--   SM manager SUSPENDU, créateur d'un second OKR · D1..D4 leurs subordonnés.

DO $proof$
DECLARE
  res text[] := '{}';
  ko  int := 0;
  A   constant uuid := '00000000-0000-0000-0000-0000000a0212';
  M2  constant uuid := '00000000-0000-0000-0000-0000000b0212';
  MC  constant uuid := '00000000-0000-0000-0000-0000000c0212';
  MV  constant uuid := '00000000-0000-0000-0000-0000000d0212';
  C   constant uuid := '00000000-0000-0000-0000-0000000e0212';
  S   constant uuid := '00000000-0000-0000-0000-0000000f0212';
  SM  constant uuid := '00000000-0000-0000-0000-000000100212';
  D1  constant uuid := '00000000-0000-0000-0000-000000110212';
  D2  constant uuid := '00000000-0000-0000-0000-000000120212';
  D3  constant uuid := '00000000-0000-0000-0000-000000130212';
  D4  constant uuid := '00000000-0000-0000-0000-000000140212';
  O   constant uuid := '10000000-0000-0000-0000-000000000212';
  TM  constant uuid := '20000000-0000-0000-0000-000000000212';
  P1  constant uuid := '30000000-0000-0000-0000-000000000212';
  P2  constant uuid := '30000000-0000-0000-0000-000000001212';
  T1  constant uuid := '40000000-0000-0000-0000-000000000212';
  T2  constant uuid := '40000000-0000-0000-0000-000000001212';
  OK1 constant uuid := '50000000-0000-0000-0000-000000000212';
  OK2 constant uuid := '50000000-0000-0000-0000-000000001212';
  n int; vu boolean;
BEGIN
  -- ── Fixtures (rôle propriétaire) ──────────────────────────────────
  INSERT INTO auth.users(id,email)
    SELECT u, 'u' || right(u::text, 8) || '@p212.invalid'
      FROM unnest(ARRAY[A,M2,MC,MV,C,S,SM,D1,D2,D3,D4]) u;
  INSERT INTO public.profiles(id,email,display_name)
    SELECT id,email,split_part(email,'@',1) FROM auth.users WHERE email LIKE '%@p212.invalid'
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organizations(id,name,join_code,owner_id) VALUES (O,'P212','P212J',A);
  INSERT INTO public.organization_members(org_id,user_id,role,manager_id) VALUES
    (O,A,'admin',NULL),(O,M2,'member',A),(O,MC,'member',A),(O,MV,'member',A),(O,SM,'member',A),
    (O,C,'member',A),(O,S,'member',A),
    (O,D1,'member',M2),(O,D2,'member',MC),(O,D3,'member',MV),(O,D4,'member',SM)
    ON CONFLICT DO NOTHING;
  UPDATE public.organization_members SET suspended_at = now() WHERE org_id = O AND user_id IN (S, SM);
  INSERT INTO public.org_teams(id,org_id,name,created_by) VALUES (TM,O,'Equipe',A);
  INSERT INTO public.team_okrs(id,org_id,title,audience,created_by) VALUES
    (OK1,O,'Confidentiel','custom',MC),(OK2,O,'Second','custom',SM);
  INSERT INTO public.team_okr_members(okr_id,org_id,user_id) VALUES (OK1,O,C),(OK1,O,MV);

  -- ── E-3 ───────────────────────────────────────────────────────────
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- 01 · manager sans lien : ne s'ajoute pas
  PERFORM set_config('request.jwt.claim.sub', M2::text, true);
  BEGIN
    INSERT INTO public.team_okr_members(okr_id,org_id,user_id) VALUES (OK1,O,M2);
    ko := ko+1; res := res || ('ECHEC 01 M2 s inscrit, voit l OKR = ' || public.can_access_team_okr(OK1));
  EXCEPTION WHEN insufficient_privilege THEN res := res || 'ok 01 manager sans lien : inscription refusee'::text;
  END;
  -- 02 · ni ne retire les autres
  DELETE FROM public.team_okr_members WHERE okr_id = OK1;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN res := res || 'ok 02 manager sans lien : retire 0 lien'::text;
  ELSE ko := ko+1; res := res || ('ECHEC 02 M2 retire ' || n || ' lien(s)'); END IF;
  -- 03 · ni ne rattache son équipe
  BEGIN
    INSERT INTO public.team_okr_teams(okr_id,org_id,team_id) VALUES (OK1,O,TM);
    ko := ko+1; res := res || 'ECHEC 03 M2 rattache une equipe'::text;
  EXCEPTION WHEN insufficient_privilege THEN res := res || 'ok 03 manager sans lien : rattachement d equipe refuse'::text;
  END;
  -- 04 · ni par la fonction
  BEGIN
    PERFORM public.set_team_okr_links(OK1, NULL, ARRAY[M2]);
    ko := ko+1; res := res || 'ECHEC 04 M2 passe par set_team_okr_links'::text;
  EXCEPTION WHEN insufficient_privilege THEN res := res || 'ok 04 set_team_okr_links refuse a M2 (42501)'::text;
    WHEN OTHERS THEN ko := ko+1; res := res || ('ECHEC 04 erreur inattendue ' || SQLSTATE || ' ' || SQLERRM);
  END;

  -- 05 · le créateur gère l'audience de son OKR même s'il ne le VOIT pas :
  --      ni C ni MV ne sont sous lui, et sans cette branche il ne pourrait pas
  --      peupler un OKR confidentiel qu'il vient de créer.
  PERFORM set_config('request.jwt.claim.sub', MC::text, true);
  BEGIN
    INSERT INTO public.team_okr_members(okr_id,org_id,user_id) VALUES (OK1,O,D2);
    res := res || 'ok 05 createur : ajoute une personne'::text;
  EXCEPTION WHEN OTHERS THEN ko := ko+1; res := res || ('ECHEC 05 createur refuse : ' || SQLERRM);
  END;

  -- 06 · manager DANS l'audience : remplace la liste, s'en retire lui-même,
  --      en un seul appel (l'ancien chemin en deux requêtes l'aurait bloqué)
  PERFORM set_config('request.jwt.claim.sub', MV::text, true);
  BEGIN
    PERFORM public.set_team_okr_links(OK1, ARRAY[TM], ARRAY[C]);
    EXECUTE 'RESET ROLE';
    SELECT count(*) INTO n FROM public.team_okr_members WHERE okr_id = OK1;
    IF n = 1 AND EXISTS (SELECT 1 FROM public.team_okr_teams WHERE okr_id = OK1 AND team_id = TM)
    THEN res := res || 'ok 06 manager de l audience : liste remplacee d un bloc (1 personne, 1 equipe)'::text;
    ELSE ko := ko+1; res := res || ('ECHEC 06 personnes=' || n); END IF;
    EXECUTE 'SET LOCAL ROLE authenticated';
  EXCEPTION WHEN OTHERS THEN ko := ko+1; res := res || ('ECHEC 06 ' || SQLSTATE || ' ' || SQLERRM);
  END;

  -- 07 · manager suspendu, créateur : refusé
  PERFORM set_config('request.jwt.claim.sub', SM::text, true);
  BEGIN
    INSERT INTO public.team_okr_members(okr_id,org_id,user_id) VALUES (OK2,O,D4);
    ko := ko+1; res := res || 'ECHEC 07 manager suspendu gere une audience'::text;
  EXCEPTION WHEN insufficient_privilege THEN res := res || 'ok 07 manager suspendu : refuse'::text;
  END;

  -- 08 · l'admin gère tout
  PERFORM set_config('request.jwt.claim.sub', A::text, true);
  BEGIN
    PERFORM public.set_team_okr_links(OK2, NULL, ARRAY[C]);
    res := res || 'ok 08 admin : gere l audience d un OKR qu il n a pas cree'::text;
  EXCEPTION WHEN OTHERS THEN ko := ko+1; res := res || ('ECHEC 08 admin ' || SQLERRM);
  END;
  EXECUTE 'RESET ROLE';

  -- ── E-4 ───────────────────────────────────────────────────────────
  INSERT INTO public.team_projects(id,org_id,name,created_by) VALUES (P1,O,'P1',A),(P2,O,'P2',A);
  INSERT INTO public.team_tasks(id,org_id,project_id,name,created_by,assignee_ids) VALUES
    (T1,O,P1,'T1',A,ARRAY[C,S]),(T2,O,P2,'T2',A,ARRAY[C,S]);
  PERFORM set_config('request.jwt.claim.sub', A::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  INSERT INTO public.team_task_comments(task_id,author_id,body) VALUES (T1,A,'commentaire');
  UPDATE public.team_tasks SET status = 'in_progress' WHERE id = T1;
  UPDATE public.team_projects SET archived_at = now() WHERE id = P2;
  EXECUTE 'RESET ROLE';
  SELECT count(*) INTO n FROM public.org_notifications WHERE org_id = O AND user_id = S AND kind IN ('comment','status_changed','project_archived');
  IF n = 0 THEN res := res || 'ok 09 suspendu : 0 notification (commentaire, statut, archivage)'::text;
  ELSE ko := ko+1; res := res || ('ECHEC 09 suspendu recoit ' || n || ' notification(s)'); END IF;
  SELECT count(*) INTO n FROM public.org_notifications WHERE org_id = O AND user_id = C AND kind IN ('comment','status_changed','project_archived');
  IF n = 3 THEN res := res || 'ok 10 membre actif : 3 notifications (temoin positif)'::text;
  ELSE ko := ko+1; res := res || ('ECHEC 10 membre actif recoit ' || n || ', attendu 3'); END IF;

  RAISE EXCEPTION 'PREUVE-ANNULEE % ECHEC | %', ko, array_to_string(res, ' | ');
END $proof$;
