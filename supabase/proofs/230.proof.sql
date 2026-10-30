-- Preuve de la mig. 230, à jouer APRÈS le corps de la migration (sans BEGIN/COMMIT),
-- dans la même transaction. Le bloc finit TOUJOURS par RAISE EXCEPTION : tout
-- est annulé, le verdict est le texte de l'exception.
-- Acteurs relus en prod le 2026-10-30 : organisation b92bcbfe… ; 710a29e7…
-- (admin d'une AUTRE organisation, absent de b92bcbfe) joue l'arrivant.
DO $proof$
DECLARE
  v_org     uuid := 'b92bcbfe-4b03-4698-b95d-e8e5e47248f1';
  v_other   uuid := '61565c6d-2ccb-4a58-aace-c2f7c94a28bb';
  v_newbie  uuid := '710a29e7-50c8-4e0c-8cbf-9f905064f3a8';
  v_role    uuid;
  v_foreign uuid;
  v_ok      boolean;
  v_log     text := '';
BEGIN
  INSERT INTO public.org_roles (org_id, name, color, granted_keys, assign_targets)
  VALUES (v_org, 'Preuve 230', '#6366f1', ARRAY['task.create', 'okr.create'], ARRAY['self'])
  RETURNING id INTO v_role;
  INSERT INTO public.org_roles (org_id, name, color, granted_keys, assign_targets)
  VALUES (v_other, 'Ailleurs', '#6366f1', ARRAY['task.create'], ARRAY['self'])
  RETURNING id INTO v_foreign;

  -- 1 · Un rôle d'une autre organisation est refusé.
  BEGIN
    INSERT INTO public.org_settings (org_id, default_role_id) VALUES (v_org, v_foreign)
    ON CONFLICT (org_id) DO UPDATE SET default_role_id = EXCLUDED.default_role_id;
    v_ok := true;
  EXCEPTION WHEN check_violation THEN v_ok := false;
  END;
  IF v_ok THEN RAISE EXCEPTION 'ECHEC 1 : rôle étranger accepté'; END IF;
  v_log := v_log || ' 1:etranger-refuse';

  -- 2 · Le rôle de l'organisation est accepté.
  INSERT INTO public.org_settings (org_id, default_role_id) VALUES (v_org, v_role)
  ON CONFLICT (org_id) DO UPDATE SET default_role_id = EXCLUDED.default_role_id;
  v_log := v_log || ' 2:reglage';

  -- 3 · Une arrivée reçoit le rôle, sans limite de durée.
  INSERT INTO public.organization_members (org_id, user_id, role) VALUES (v_org, v_newbie, 'member');
  IF NOT EXISTS (SELECT 1 FROM public.org_member_roles
                  WHERE org_id = v_org AND user_id = v_newbie AND role_id = v_role AND ends_at IS NULL) THEN
    RAISE EXCEPTION 'ECHEC 3 : rôle non attribué à l''arrivée';
  END IF;
  v_log := v_log || ' 3:arrivee=role';

  -- 4 · Supprimer le rôle remet le réglage à NULL.
  DELETE FROM public.org_roles WHERE id = v_role;
  IF (SELECT default_role_id FROM public.org_settings WHERE org_id = v_org) IS NOT NULL THEN
    RAISE EXCEPTION 'ECHEC 4 : réglage orphelin';
  END IF;
  v_log := v_log || ' 4:set-null';

  RAISE EXCEPTION 'PREUVE 230 OK :%', v_log;
END
$proof$;
