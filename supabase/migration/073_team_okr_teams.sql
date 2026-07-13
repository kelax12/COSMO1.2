-- ═══════════════════════════════════════════════════════════════════
-- Migration 073 — Rattachement des OKR d'équipe à des équipes + durée KR
--
-- Un OKR d'équipe peut désormais être rattaché à UNE ou PLUSIEURS équipes
-- (transverses, mig. 068), ou à AUCUNE (= objectif d'entreprise, visible par
-- tous les membres). Le rattachement CLOISONNE la visibilité, comme les
-- projets : un OKR rattaché à des équipes n'est visible/éditable que par les
-- membres de ces équipes, leur chaîne hiérarchique au-dessus, et les admins.
--
-- Table de liaison N-N `team_okr_teams` (org_id dénormalisé, pattern
-- team_key_results / org_team_members). Helper unique can_access_team_okr
-- (SECURITY DEFINER — pas de récursion : il ne lit jamais sous RLS la table
-- qu'il protège). Remplace les policies de lecture/écriture 063 gatées par
-- is_org_member/is_org_manager seuls.
--
-- Ajoute aussi `estimated_time` sur team_key_results (parité avec l'OKR perso :
-- durée estimée par unité, minutes).
-- ═══════════════════════════════════════════════════════════════════

-- ─── Colonnes ───────────────────────────────────────────────────────

ALTER TABLE public.team_key_results
  ADD COLUMN IF NOT EXISTS estimated_time NUMERIC NOT NULL DEFAULT 30
    CHECK (estimated_time >= 0);

-- ─── Table de liaison ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.team_okr_teams (
  okr_id   UUID NOT NULL REFERENCES public.team_okrs(id) ON DELETE CASCADE,
  -- org_id dénormalisé pour des policies plates (pattern org_team_members).
  org_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_id  UUID NOT NULL REFERENCES public.org_teams(id) ON DELETE CASCADE,
  added_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (okr_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_team_okr_teams_okr ON public.team_okr_teams(okr_id);
CREATE INDEX IF NOT EXISTS idx_team_okr_teams_team ON public.team_okr_teams(team_id);
CREATE INDEX IF NOT EXISTS idx_team_okr_teams_org ON public.team_okr_teams(org_id);

-- ─── Helper (SECURITY DEFINER) ──────────────────────────────────────

-- Accès à un OKR d'équipe : admin de l'org ; OU aucun rattachement (objectif
-- d'entreprise) → tout membre ; OU rattaché → membre d'une équipe liée, ou
-- manager dont UN SUBORDONNÉ est dans une équipe liée (chaîne hiérarchique).
CREATE OR REPLACE FUNCTION public.can_access_team_okr(p_okr UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_okrs o
    WHERE o.id = p_okr
      AND (
        public.is_org_admin(o.org_id)
        OR (
          NOT EXISTS (SELECT 1 FROM public.team_okr_teams l WHERE l.okr_id = o.id)
          AND public.is_org_member(o.org_id)
        )
        OR EXISTS (
          SELECT 1 FROM public.team_okr_teams l
          JOIN public.org_team_members tm ON tm.team_id = l.team_id
          WHERE l.okr_id = o.id
            AND (
              tm.user_id = auth.uid()
              OR tm.user_id IN (SELECT public.get_subtree(o.org_id, auth.uid()))
            )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_team_okr(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_team_okr(UUID) TO authenticated;

-- ─── RLS : team_okr_teams ───────────────────────────────────────────

ALTER TABLE public.team_okr_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_okr_teams_select" ON public.team_okr_teams;
CREATE POLICY "team_okr_teams_select"
  ON public.team_okr_teams FOR SELECT
  USING (public.is_org_member(org_id));

-- Écriture (rattachement) : managers de l'org (comme la création d'OKR).
DROP POLICY IF EXISTS "team_okr_teams_insert" ON public.team_okr_teams;
CREATE POLICY "team_okr_teams_insert"
  ON public.team_okr_teams FOR INSERT
  WITH CHECK (public.is_org_manager(org_id));

DROP POLICY IF EXISTS "team_okr_teams_delete" ON public.team_okr_teams;
CREATE POLICY "team_okr_teams_delete"
  ON public.team_okr_teams FOR DELETE
  USING (public.is_org_manager(org_id));

-- Cohérence : l'OKR et l'équipe appartiennent à la même org que le lien.
CREATE OR REPLACE FUNCTION public.validate_team_okr_team()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.team_okrs o
    WHERE o.id = NEW.okr_id AND o.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'OKR must belong to this organization';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.org_teams t
    WHERE t.id = NEW.team_id AND t.org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'Team must belong to this organization';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_team_okr_team ON public.team_okr_teams;
CREATE TRIGGER trg_validate_team_okr_team
  BEFORE INSERT OR UPDATE ON public.team_okr_teams
  FOR EACH ROW EXECUTE FUNCTION public.validate_team_okr_team();

-- ─── Cloisonnement : remplacement des policies 063 ──────────────────

-- team_okrs : lecture/màj/suppression suivent l'accès cloisonné.
DROP POLICY IF EXISTS "team_okrs_select" ON public.team_okrs;
CREATE POLICY "team_okrs_select"
  ON public.team_okrs FOR SELECT
  USING (public.can_access_team_okr(id));

-- INSERT 063 conservé (is_org_manager + created_by = soi). Les liens sont
-- posés ensuite ; tant qu'aucun lien n'existe l'OKR est visible org-wide.

DROP POLICY IF EXISTS "team_okrs_update" ON public.team_okrs;
CREATE POLICY "team_okrs_update"
  ON public.team_okrs FOR UPDATE
  USING (public.is_org_manager(org_id) AND public.can_access_team_okr(id))
  WITH CHECK (public.is_org_manager(org_id) AND public.can_access_team_okr(id));

DROP POLICY IF EXISTS "team_okrs_delete" ON public.team_okrs;
CREATE POLICY "team_okrs_delete"
  ON public.team_okrs FOR DELETE
  USING (public.is_org_manager(org_id) AND public.can_access_team_okr(id));

-- team_key_results : lecture + màj progression suivent l'accès à l'OKR ;
-- création/suppression réservées aux managers ayant accès.
DROP POLICY IF EXISTS "team_krs_select" ON public.team_key_results;
CREATE POLICY "team_krs_select"
  ON public.team_key_results FOR SELECT
  USING (public.can_access_team_okr(okr_id));

DROP POLICY IF EXISTS "team_krs_insert" ON public.team_key_results;
CREATE POLICY "team_krs_insert"
  ON public.team_key_results FOR INSERT
  WITH CHECK (public.is_org_manager(org_id) AND public.can_access_team_okr(okr_id));

DROP POLICY IF EXISTS "team_krs_update" ON public.team_key_results;
CREATE POLICY "team_krs_update"
  ON public.team_key_results FOR UPDATE
  USING (public.can_access_team_okr(okr_id))
  WITH CHECK (public.can_access_team_okr(okr_id));

DROP POLICY IF EXISTS "team_krs_delete" ON public.team_key_results;
CREATE POLICY "team_krs_delete"
  ON public.team_key_results FOR DELETE
  USING (public.is_org_manager(org_id) AND public.can_access_team_okr(okr_id));
