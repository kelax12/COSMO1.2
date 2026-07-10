-- ═══════════════════════════════════════════════════════════════════
-- Migration 068 — Équipes transverses + cloisonnement des projets (v2, 1d)
--
-- Équipes indépendantes de la pyramide (transverses possibles). Tout
-- manager (dérivé : has_subordinates) crée des équipes ; il n'y ajoute que
-- SES subordonnés (+ lui-même) ; l'admin gère tout. Un projet peut être
-- rattaché à une équipe → CLOISONNÉ : visible par les membres de l'équipe,
-- la chaîne hiérarchique au-dessus d'eux, et les admins. Les projets sans
-- équipe (team_id NULL) restent visibles par toute l'org.
--
-- Le cloisonnement remplace les policies 062 de team_projects/team_tasks
-- par le helper unique can_access_team_project (SECURITY DEFINER — pas de
-- récursion : il ne lit jamais la table qu'il protège).
-- ═══════════════════════════════════════════════════════════════════

-- ─── Tables ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_teams (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name       TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  color      TEXT NOT NULL DEFAULT 'blue',
  created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.org_team_members (
  team_id  UUID NOT NULL REFERENCES public.org_teams(id) ON DELETE CASCADE,
  -- org_id dénormalisé pour des policies plates (pattern team_key_results).
  org_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);

ALTER TABLE public.team_projects
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.org_teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_org_teams_org ON public.org_teams(org_id);
CREATE INDEX IF NOT EXISTS idx_org_team_members_org ON public.org_team_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_team_members_user ON public.org_team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_projects_team ON public.team_projects(team_id);

-- ─── Helpers (SECURITY DEFINER) ─────────────────────────────────────

-- Gestion d'une équipe : admin de l'org OU créateur de l'équipe.
CREATE OR REPLACE FUNCTION public.can_manage_team(p_team UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_teams t
    WHERE t.id = p_team
      AND (public.is_org_admin(t.org_id) OR t.created_by = auth.uid())
  );
$$;

-- Accès à un projet : org (team_id NULL) → tout membre ; équipe → admin,
-- membre de l'équipe, ou manager dont UN SUBORDONNÉ est dans l'équipe
-- (chaîne hiérarchique au-dessus).
CREATE OR REPLACE FUNCTION public.can_access_team_project(p_project UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_projects p
    WHERE p.id = p_project
      AND (
        (p.team_id IS NULL AND public.is_org_member(p.org_id))
        OR public.is_org_admin(p.org_id)
        OR EXISTS (
          SELECT 1 FROM public.org_team_members tm
          WHERE tm.team_id = p.team_id
            AND (
              tm.user_id = auth.uid()
              OR tm.user_id IN (SELECT public.get_subtree(p.org_id, auth.uid()))
            )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_team(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_team_project(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_team(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_team_project(UUID) TO authenticated;

-- ─── RLS : org_teams ────────────────────────────────────────────────

ALTER TABLE public.org_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_teams_select" ON public.org_teams;
CREATE POLICY "org_teams_select"
  ON public.org_teams FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "org_teams_insert" ON public.org_teams;
CREATE POLICY "org_teams_insert"
  ON public.org_teams FOR INSERT
  WITH CHECK (public.is_org_manager(org_id) AND created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "org_teams_update" ON public.org_teams;
CREATE POLICY "org_teams_update"
  ON public.org_teams FOR UPDATE
  USING (public.is_org_admin(org_id) OR created_by = (SELECT auth.uid()))
  WITH CHECK (public.is_org_admin(org_id) OR created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "org_teams_delete" ON public.org_teams;
CREATE POLICY "org_teams_delete"
  ON public.org_teams FOR DELETE
  USING (public.is_org_admin(org_id) OR created_by = (SELECT auth.uid()));

-- ─── RLS : org_team_members ─────────────────────────────────────────

ALTER TABLE public.org_team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_team_members_select" ON public.org_team_members;
CREATE POLICY "org_team_members_select"
  ON public.org_team_members FOR SELECT
  USING (public.is_org_member(org_id));

-- INSERT : gestionnaire de l'équipe, et un non-admin n'ajoute QUE ses
-- subordonnés ou lui-même.
DROP POLICY IF EXISTS "org_team_members_insert" ON public.org_team_members;
CREATE POLICY "org_team_members_insert"
  ON public.org_team_members FOR INSERT
  WITH CHECK (
    public.can_manage_team(team_id)
    AND (
      public.is_org_admin(org_id)
      OR user_id = (SELECT auth.uid())
      OR user_id IN (SELECT public.get_subtree(org_id, auth.uid()))
    )
  );

DROP POLICY IF EXISTS "org_team_members_delete" ON public.org_team_members;
CREATE POLICY "org_team_members_delete"
  ON public.org_team_members FOR DELETE
  USING (public.can_manage_team(team_id) OR user_id = (SELECT auth.uid()));

-- Cohérence : le membre ajouté appartient à l'org, et org_id colle à l'équipe.
CREATE OR REPLACE FUNCTION public.validate_team_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.org_teams t
    WHERE t.id = NEW.team_id AND t.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'Team does not belong to this organization';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members m
    WHERE m.org_id = NEW.org_id AND m.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'User must be a member of the organization';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_team_membership ON public.org_team_members;
CREATE TRIGGER trg_validate_team_membership
  BEFORE INSERT OR UPDATE ON public.org_team_members
  FOR EACH ROW EXECUTE FUNCTION public.validate_team_membership();

-- Cohérence projet ↔ équipe (même org).
CREATE OR REPLACE FUNCTION public.validate_project_team()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.team_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.org_teams t
    WHERE t.id = NEW.team_id AND t.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'Team must belong to the same organization';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_project_team ON public.team_projects;
CREATE TRIGGER trg_validate_project_team
  BEFORE INSERT OR UPDATE ON public.team_projects
  FOR EACH ROW EXECUTE FUNCTION public.validate_project_team();

-- ─── Cloisonnement : remplacement des policies 062 ──────────────────

DROP POLICY IF EXISTS "team_projects_select" ON public.team_projects;
CREATE POLICY "team_projects_select"
  ON public.team_projects FOR SELECT
  USING (public.can_access_team_project(id));

DROP POLICY IF EXISTS "team_projects_update" ON public.team_projects;
CREATE POLICY "team_projects_update"
  ON public.team_projects FOR UPDATE
  USING (public.is_org_manager(org_id) AND public.can_access_team_project(id))
  WITH CHECK (public.is_org_manager(org_id) AND public.can_access_team_project(id));

DROP POLICY IF EXISTS "team_projects_delete" ON public.team_projects;
CREATE POLICY "team_projects_delete"
  ON public.team_projects FOR DELETE
  USING (public.is_org_manager(org_id) AND public.can_access_team_project(id));

-- (INSERT 062 conservé : is_org_manager + created_by = soi ; le trigger
-- valide la cohérence équipe/org.)

DROP POLICY IF EXISTS "team_tasks_select" ON public.team_tasks;
CREATE POLICY "team_tasks_select"
  ON public.team_tasks FOR SELECT
  USING (public.can_access_team_project(project_id));

DROP POLICY IF EXISTS "team_tasks_insert" ON public.team_tasks;
CREATE POLICY "team_tasks_insert"
  ON public.team_tasks FOR INSERT
  WITH CHECK (
    public.can_access_team_project(project_id)
    AND created_by = (SELECT auth.uid())
    AND public.is_org_member(org_id)
  );

DROP POLICY IF EXISTS "team_tasks_update" ON public.team_tasks;
CREATE POLICY "team_tasks_update"
  ON public.team_tasks FOR UPDATE
  USING (public.can_access_team_project(project_id))
  WITH CHECK (public.can_access_team_project(project_id));

DROP POLICY IF EXISTS "team_tasks_delete" ON public.team_tasks;
CREATE POLICY "team_tasks_delete"
  ON public.team_tasks FOR DELETE
  USING (public.can_access_team_project(project_id));

-- OKR d'équipe : ils restent au niveau org en v2 (pas de team_id) — leurs
-- policies 063 (is_org_member/is_org_manager) sont inchangées.
