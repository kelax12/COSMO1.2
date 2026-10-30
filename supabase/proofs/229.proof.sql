-- Preuve de la mig. 229, à jouer APRÈS le corps de la migration (sans BEGIN/COMMIT)
-- dans la même requête : le bloc finit TOUJOURS par RAISE EXCEPTION, donc tout
-- est annulé. Le verdict est le texte de l'exception.
-- Acteurs relus en prod le 2026-10-30, organisation b92bcbfe… :
--   admin    1d08e120…  · encadrant sans rôle ni fiche a335473a… · membre simple ce7eb009…
DO $proof$
DECLARE
  v_org   uuid := 'b92bcbfe-4b03-4698-b95d-e8e5e47248f1';
  v_admin uuid := '1d08e120-f46e-41cc-9bca-fd1539768cb7';
  v_boss  uuid := 'a335473a-a23d-428e-8107-c386577f3101';
  v_plain uuid := 'ce7eb009-2ceb-479e-837c-9549d85948e0';
  v_log   text := '';
  v_ok    boolean;
BEGIN
  -- 1 · L'encadrant n'a plus que les droits de base.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_boss, 'role', 'authenticated')::text, true);
  IF public.my_org_perm(v_org, 'project.create') OR public.my_org_perm(v_org, 'okr.create')
     OR public.my_org_perm(v_org, 'member.invite') OR public.my_org_perm(v_org, 'team.create')
     OR public.my_org_perm(v_org, 'task.deleteAny') OR public.my_project_edit_perm(v_org) THEN
    RAISE EXCEPTION 'ECHEC 1 : l''encadrant garde un droit manager';
  END IF;
  IF NOT (public.my_org_perm(v_org, 'task.create') AND public.my_org_perm(v_org, 'task.editAny')) THEN
    RAISE EXCEPTION 'ECHEC 1b : l''encadrant perd les droits de base';
  END IF;
  v_log := v_log || ' 1:encadrant=base';

  -- 2 · L'admin garde tout.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  IF NOT (public.my_org_perm(v_org, 'project.create') AND public.my_org_perm(v_org, 'member.invite')
          AND public.my_project_edit_perm(v_org)) THEN
    RAISE EXCEPTION 'ECHEC 2 : l''admin a perdu un droit';
  END IF;
  v_log := v_log || ' 2:admin=tout';

  -- 3 · Droit d'inviter d'un tiers (jugé à la réclamation).
  IF NOT public.org_member_can_invite(v_org, v_admin) THEN RAISE EXCEPTION 'ECHEC 3a'; END IF;
  IF public.org_member_can_invite(v_org, v_boss) THEN RAISE EXCEPTION 'ECHEC 3b : encadrant invite sans droit'; END IF;
  IF public.org_member_can_invite(v_org, v_plain) THEN RAISE EXCEPTION 'ECHEC 3c'; END IF;
  v_log := v_log || ' 3:can_invite';

  -- 4 · Policy d'invitation, sous le rôle authenticated.
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_boss, 'role', 'authenticated')::text, true);
  BEGIN
    INSERT INTO public.org_invite_links (org_id, created_by) VALUES (v_org, v_boss);
    v_ok := true;
  EXCEPTION WHEN insufficient_privilege THEN v_ok := false;
  END;
  IF v_ok THEN RAISE EXCEPTION 'ECHEC 4a : l''encadrant crée un lien sans member.invite'; END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  INSERT INTO public.org_invite_links (org_id, created_by) VALUES (v_org, v_admin);
  v_log := v_log || ' 4:lien(encadrant refuse, admin ok)';

  -- 5 · Fiche individuelle : l'encadrant ne l'écrit plus pour son subordonné.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_boss, 'role', 'authenticated')::text, true);
  BEGIN
    INSERT INTO public.org_member_permissions (org_id, user_id, can_create_task)
    SELECT v_org, m.user_id, true FROM public.organization_members m
     WHERE m.org_id = v_org AND m.manager_id = v_boss LIMIT 1;
    v_ok := true;
  EXCEPTION WHEN insufficient_privilege THEN v_ok := false;
  END;
  IF v_ok THEN RAISE EXCEPTION 'ECHEC 5 : l''encadrant écrit la fiche d''un subordonné'; END IF;
  v_log := v_log || ' 5:fiche=admin';
  EXECUTE 'RESET ROLE';

  -- 6 · Portées hiérarchiques refusées par contrainte.
  SELECT pg_get_constraintdef(c.oid) !~ 'peers|manager|subordinates' INTO v_ok
    FROM pg_constraint c WHERE c.conname = 'org_roles_assign_targets_check';
  IF NOT v_ok THEN RAISE EXCEPTION 'ECHEC 6a'; END IF;
  SELECT pg_get_constraintdef(c.oid) !~ 'peers|manager|subordinates' INTO v_ok
    FROM pg_constraint c WHERE c.conname = 'org_member_permissions_assign_targets_check';
  IF NOT v_ok THEN RAISE EXCEPTION 'ECHEC 6b'; END IF;
  v_log := v_log || ' 6:portees';

  RAISE EXCEPTION 'PREUVE 229 OK :%', v_log;
END
$proof$;
