-- ═══════════════════════════════════════════════════════════════════
-- 160 · Les OKR rejoignent l'exécution (audit 2026-09-23, M9)
-- ═══════════════════════════════════════════════════════════════════
--
-- Un KR ne se reliait à rien : sa progression se saisissait à la main, sans
-- cycle, sans historique, sans état. Cette migration ajoute :
--
--   · `okr_cycles` : les périodes d'OKR de l'organisation (T1, S2…) ;
--   · `team_okrs.cycle_id` et `team_okrs.parent_okr_id` : un objectif
--     d'équipe CONTRIBUE à un objectif d'entreprise ;
--   · `team_kr_projects` : un KR se relie à un ou plusieurs projets, et
--     `progress_mode = 'tasks'` fait calculer sa progression par les tâches
--     terminées de ces projets (calcul client, sur des lignes déjà lisibles) ;
--   · `team_key_results.contributor_ids` : plusieurs contributeurs, le
--     responsable restant `assignee_id` ;
--   · `team_kr_checkins` : les points d'étape datés (valeur, état, note).
--
-- Visibilité : tout suit `can_access_team_okr` (mig. 073). Un point d'étape
-- ou un lien de projet n'est lisible que par qui voit l'OKR.
--
-- Numérotée 160 : les numéros 151 à 159 sont réservés à la session qui porte
-- M2, M4 à M8 et M12 (répartition du 2026-09-24). Aucune dépendance à ces
-- migrations : un lien KR ↔ projet ne lit que `team_projects.id`.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.okr_cycles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name       TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  start_date DATE NOT NULL,
  end_date   DATE NOT NULL,
  created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT okr_cycles_dates_order CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_okr_cycles_org ON public.okr_cycles (org_id, start_date DESC);

ALTER TABLE public.team_okrs
  ADD COLUMN IF NOT EXISTS cycle_id UUID REFERENCES public.okr_cycles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_okr_id UUID REFERENCES public.team_okrs(id) ON DELETE SET NULL;
ALTER TABLE public.team_okrs DROP CONSTRAINT IF EXISTS team_okrs_parent_not_self;
ALTER TABLE public.team_okrs ADD CONSTRAINT team_okrs_parent_not_self
  CHECK (parent_okr_id IS NULL OR parent_okr_id <> id);
CREATE INDEX IF NOT EXISTS idx_team_okrs_parent ON public.team_okrs (parent_okr_id) WHERE parent_okr_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_team_okrs_cycle ON public.team_okrs (cycle_id) WHERE cycle_id IS NOT NULL;

ALTER TABLE public.team_key_results
  ADD COLUMN IF NOT EXISTS progress_mode TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS contributor_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE public.team_key_results DROP CONSTRAINT IF EXISTS team_key_results_progress_mode_check;
ALTER TABLE public.team_key_results ADD CONSTRAINT team_key_results_progress_mode_check
  CHECK (progress_mode IN ('manual', 'tasks'));

CREATE TABLE IF NOT EXISTS public.team_kr_projects (
  kr_id      UUID NOT NULL REFERENCES public.team_key_results(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.team_projects(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  added_by   UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (kr_id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_team_kr_projects_project ON public.team_kr_projects (project_id);
CREATE INDEX IF NOT EXISTS idx_team_kr_projects_org ON public.team_kr_projects (org_id);

CREATE TABLE IF NOT EXISTS public.team_kr_checkins (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kr_id      UUID NOT NULL REFERENCES public.team_key_results(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  value      NUMERIC NOT NULL,
  status     TEXT NOT NULL CHECK (status IN ('on_track', 'at_risk', 'off_track')),
  note       TEXT CHECK (note IS NULL OR char_length(note) <= 1000),
  author_id  UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_team_kr_checkins_kr ON public.team_kr_checkins (kr_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_kr_checkins_org ON public.team_kr_checkins (org_id);

-- ─── Garde-fous ─────────────────────────────────────────────────────

-- Parent : même organisation, et aucun cycle (profondeur bornée à 20,
-- miroir du bornage de la pyramide).
CREATE OR REPLACE FUNCTION public.validate_team_okr_parent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF NEW.parent_okr_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_okrs WHERE id = NEW.parent_okr_id AND org_id = NEW.org_id) THEN
    RAISE EXCEPTION 'okr_parent_not_in_org';
  END IF;
  IF EXISTS (
    WITH RECURSIVE up(id, depth) AS (
      SELECT NEW.parent_okr_id, 0
      UNION ALL
      SELECT o.parent_okr_id, u.depth + 1
        FROM public.team_okrs o JOIN up u ON o.id = u.id
       WHERE o.parent_okr_id IS NOT NULL AND u.depth < 20
    )
    SELECT 1 FROM up WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'okr_parent_cycle';
  END IF;
  IF NEW.cycle_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.okr_cycles WHERE id = NEW.cycle_id AND org_id = NEW.org_id) THEN
    RAISE EXCEPTION 'okr_cycle_not_in_org';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_team_okr_parent() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_team_okr_parent ON public.team_okrs;
CREATE TRIGGER trg_validate_team_okr_parent
  BEFORE INSERT OR UPDATE OF parent_okr_id, cycle_id ON public.team_okrs
  FOR EACH ROW EXECUTE FUNCTION public.validate_team_okr_parent();

-- Contributeurs : membres de l'organisation, sans doublon.
CREATE OR REPLACE FUNCTION public.validate_team_kr_contributors()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  NEW.contributor_ids := ARRAY(SELECT DISTINCT u FROM unnest(COALESCE(NEW.contributor_ids, ARRAY[]::uuid[])) u);
  IF EXISTS (
    SELECT 1 FROM unnest(NEW.contributor_ids) u
     WHERE NOT EXISTS (SELECT 1 FROM public.organization_members m
                        WHERE m.org_id = NEW.org_id AND m.user_id = u)
  ) THEN
    RAISE EXCEPTION 'contributor_not_in_org';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_team_kr_contributors() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_team_kr_contributors ON public.team_key_results;
CREATE TRIGGER trg_validate_team_kr_contributors
  BEFORE INSERT OR UPDATE OF contributor_ids ON public.team_key_results
  FOR EACH ROW EXECUTE FUNCTION public.validate_team_kr_contributors();

-- Lien KR ↔ projet : même organisation, org_id redérivé du KR.
CREATE OR REPLACE FUNCTION public.validate_team_kr_project()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM public.team_key_results WHERE id = NEW.kr_id;
  IF v_org IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.team_projects WHERE id = NEW.project_id AND org_id = v_org) THEN
    RAISE EXCEPTION 'kr_project_not_in_org';
  END IF;
  NEW.org_id := v_org;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_team_kr_project() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_team_kr_project ON public.team_kr_projects;
CREATE TRIGGER trg_validate_team_kr_project
  BEFORE INSERT ON public.team_kr_projects
  FOR EACH ROW EXECUTE FUNCTION public.validate_team_kr_project();

-- ─── Policies ───────────────────────────────────────────────────────

ALTER TABLE public.okr_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_kr_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_kr_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "okr_cycles_select" ON public.okr_cycles;
CREATE POLICY "okr_cycles_select" ON public.okr_cycles FOR SELECT
  USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS "okr_cycles_insert" ON public.okr_cycles;
CREATE POLICY "okr_cycles_insert" ON public.okr_cycles FOR INSERT
  WITH CHECK (public.my_org_perm(org_id, 'okr.create') AND created_by = (SELECT auth.uid()));
DROP POLICY IF EXISTS "okr_cycles_update" ON public.okr_cycles;
CREATE POLICY "okr_cycles_update" ON public.okr_cycles FOR UPDATE
  USING (public.my_org_perm(org_id, 'okr.create'))
  WITH CHECK (public.my_org_perm(org_id, 'okr.create'));
DROP POLICY IF EXISTS "okr_cycles_delete" ON public.okr_cycles;
CREATE POLICY "okr_cycles_delete" ON public.okr_cycles FOR DELETE
  USING (public.my_org_perm(org_id, 'okr.delete'));

-- Un lien de projet se lit si l'on voit le KR (policy de `team_key_results`)
-- ET le projet : sans le second, un OKR d'entreprise révélerait le nom
-- d'un projet d'équipe fermée.
DROP POLICY IF EXISTS "team_kr_projects_select" ON public.team_kr_projects;
CREATE POLICY "team_kr_projects_select" ON public.team_kr_projects FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.team_key_results k WHERE k.id = kr_id)
    AND public.can_access_team_project(project_id)
  );
DROP POLICY IF EXISTS "team_kr_projects_insert" ON public.team_kr_projects;
CREATE POLICY "team_kr_projects_insert" ON public.team_kr_projects FOR INSERT
  WITH CHECK (
    public.my_org_perm(org_id, 'okr.create')
    AND EXISTS (SELECT 1 FROM public.team_key_results k WHERE k.id = kr_id)
    AND public.can_access_team_project(project_id)
  );
DROP POLICY IF EXISTS "team_kr_projects_delete" ON public.team_kr_projects;
CREATE POLICY "team_kr_projects_delete" ON public.team_kr_projects FOR DELETE
  USING (
    public.my_org_perm(org_id, 'okr.create')
    AND EXISTS (SELECT 1 FROM public.team_key_results k WHERE k.id = kr_id)
  );

DROP POLICY IF EXISTS "team_kr_checkins_select" ON public.team_kr_checkins;
CREATE POLICY "team_kr_checkins_select" ON public.team_kr_checkins FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.team_key_results k WHERE k.id = kr_id));

-- ─── Point d'étape ──────────────────────────────────────────────────
--
-- SECURITY INVOKER : la mise à jour du KR passe par `team_krs_update`
-- (mig. 073), l'insertion du point d'étape par la vérification ci-dessous.
-- Les deux réussissent ensemble ou pas du tout.
CREATE OR REPLACE FUNCTION public.post_kr_checkin(
  p_kr uuid,
  p_value numeric,
  p_status text,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_org uuid;
BEGIN
  UPDATE public.team_key_results SET current_value = p_value WHERE id = p_kr
  RETURNING org_id INTO v_org;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.insert_kr_checkin_row(p_kr, v_org, p_value, p_status, p_note);
END;
$$;
REVOKE ALL ON FUNCTION public.post_kr_checkin(uuid, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_kr_checkin(uuid, numeric, text, text) TO authenticated;

-- Écriture de la ligne : pas de policy INSERT sur la table (un point d'étape
-- forgé à une date choisie n'a pas de sens), donc une fonction DEFINER qui
-- revérifie que l'appelant peut MODIFIER le KR.
CREATE OR REPLACE FUNCTION public.insert_kr_checkin_row(
  p_kr uuid, p_org uuid, p_value numeric, p_status text, p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_okr uuid;
BEGIN
  SELECT okr_id INTO v_okr FROM public.team_key_results WHERE id = p_kr AND org_id = p_org;
  IF v_okr IS NULL OR NOT public.can_access_team_okr(v_okr) THEN
    RAISE EXCEPTION 'not_allowed' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.team_kr_checkins (kr_id, org_id, value, status, note, author_id)
  VALUES (p_kr, p_org, p_value, p_status, NULLIF(btrim(p_note), ''), auth.uid());
END;
$$;
REVOKE ALL ON FUNCTION public.insert_kr_checkin_row(uuid, uuid, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.insert_kr_checkin_row(uuid, uuid, numeric, text, text) TO authenticated;

-- Lecture indexable des liens KR ↔ projet : un lien n'est rendu que si le
-- projet est visible (jointure sur `my_team_project_ids`, évaluée une fois)
-- et l'OKR aussi.
CREATE OR REPLACE FUNCTION public.get_my_team_kr_projects(p_org uuid)
RETURNS TABLE (kr_id uuid, project_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT kp.kr_id, kp.project_id
    FROM public.team_kr_projects kp
    JOIN public.team_key_results k ON k.id = kp.kr_id
   WHERE kp.org_id = p_org
     AND kp.project_id IN (SELECT public.my_team_project_ids(p_org))
     AND public.can_access_team_okr(k.okr_id);
$$;
REVOKE ALL ON FUNCTION public.get_my_team_kr_projects(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_team_kr_projects(uuid) TO authenticated;

COMMIT;


-- ═══════════════════════════════════════════════════════════════════
-- VÉRIFICATION APRÈS APPLICATION
--
--   SELECT table_name FROM information_schema.tables
--    WHERE table_schema = 'public'
--      AND table_name IN ('okr_cycles', 'team_kr_projects', 'team_kr_checkins'); -- 3
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'team_okrs'
--      AND column_name IN ('cycle_id', 'parent_okr_id');                    -- 2
-- ═══════════════════════════════════════════════════════════════════
