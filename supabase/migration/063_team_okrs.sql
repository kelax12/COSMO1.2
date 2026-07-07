-- ═══════════════════════════════════════════════════════════════════
-- Migration 063 — OKR d'équipe (mode entreprise)
--
-- Tables dédiées (PAS d'extension d'`okrs` : modèle hybride JSONB + table
-- key_results synchronisée + journal kr_completions câblé au dashboard perso
-- — on n'y touche pas). org_id dénormalisé sur team_key_results pour une RLS
-- plate (is_org_member sans jointure). Progression dérivée côté client des
-- current/target + completed_at — pas de team_kr_completions en v1.
--
-- Droits : lecture = tous les membres ; création/suppression d'OKR = managers ;
-- mise à jour des KR = tout membre (l'assigné met à jour sa progression).
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.team_okrs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description TEXT,
  category    TEXT,
  start_date  DATE,
  end_date    DATE,
  -- ON DELETE SET NULL : suppression de compte RGPD non bloquante (cf. mig. 062).
  created_by  UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.team_key_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  okr_id        UUID NOT NULL REFERENCES public.team_okrs(id) ON DELETE CASCADE,
  org_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title         TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  current_value NUMERIC NOT NULL DEFAULT 0,
  target_value  NUMERIC NOT NULL DEFAULT 1 CHECK (target_value > 0),
  unit          TEXT,
  assignee_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed     BOOLEAN NOT NULL DEFAULT false,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_okrs_org ON public.team_okrs(org_id);
CREATE INDEX IF NOT EXISTS idx_team_krs_okr ON public.team_key_results(okr_id);
CREATE INDEX IF NOT EXISTS idx_team_krs_org ON public.team_key_results(org_id);
CREATE INDEX IF NOT EXISTS idx_team_krs_assignee ON public.team_key_results(assignee_id);

-- ─── RLS : team_okrs ────────────────────────────────────────────────

ALTER TABLE public.team_okrs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_okrs_select" ON public.team_okrs;
CREATE POLICY "team_okrs_select"
  ON public.team_okrs FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "team_okrs_insert" ON public.team_okrs;
CREATE POLICY "team_okrs_insert"
  ON public.team_okrs FOR INSERT
  WITH CHECK (public.is_org_manager(org_id) AND created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "team_okrs_update" ON public.team_okrs;
CREATE POLICY "team_okrs_update"
  ON public.team_okrs FOR UPDATE
  USING (public.is_org_manager(org_id))
  WITH CHECK (public.is_org_manager(org_id));

DROP POLICY IF EXISTS "team_okrs_delete" ON public.team_okrs;
CREATE POLICY "team_okrs_delete"
  ON public.team_okrs FOR DELETE
  USING (public.is_org_manager(org_id));

-- ─── RLS : team_key_results ─────────────────────────────────────────

ALTER TABLE public.team_key_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_krs_select" ON public.team_key_results;
CREATE POLICY "team_krs_select"
  ON public.team_key_results FOR SELECT
  USING (public.is_org_member(org_id));

-- Création de KR : managers (structure de l'OKR).
DROP POLICY IF EXISTS "team_krs_insert" ON public.team_key_results;
CREATE POLICY "team_krs_insert"
  ON public.team_key_results FOR INSERT
  WITH CHECK (public.is_org_manager(org_id));

-- Mise à jour : tout membre (l'assigné met à jour sa progression).
DROP POLICY IF EXISTS "team_krs_update" ON public.team_key_results;
CREATE POLICY "team_krs_update"
  ON public.team_key_results FOR UPDATE
  USING (public.is_org_member(org_id))
  WITH CHECK (public.is_org_member(org_id));

DROP POLICY IF EXISTS "team_krs_delete" ON public.team_key_results;
CREATE POLICY "team_krs_delete"
  ON public.team_key_results FOR DELETE
  USING (public.is_org_manager(org_id));

-- ─── Trigger : assigné = membre de l'org + cohérence org_id/okr ─────

CREATE OR REPLACE FUNCTION public.validate_team_kr()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.assignee_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM public.organization_members
       WHERE org_id = NEW.org_id AND user_id = NEW.assignee_id
     ) THEN
    RAISE EXCEPTION 'Assignee must be a member of the organization';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.team_okrs
    WHERE id = NEW.okr_id AND org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION 'Key result must belong to an OKR of the same organization';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_team_kr ON public.team_key_results;
CREATE TRIGGER trg_validate_team_kr
  BEFORE INSERT OR UPDATE ON public.team_key_results
  FOR EACH ROW EXECUTE FUNCTION public.validate_team_kr();
