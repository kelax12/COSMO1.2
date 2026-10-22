-- ═══════════════════════════════════════════════════════════════════
-- 163 · Page d'équipe (audit Membres du 2026-09-24)
-- ═══════════════════════════════════════════════════════════════════
--
-- « L'équipe n'est qu'une étiquette » : un nom, une couleur, des pastilles.
-- `/entreprise/teams/:id` lui donne une page (description, responsables,
-- projets, OKR, statistiques). Côté base, trois choses :
--
--   1. `org_teams.description` : ce que fait l'équipe, 500 caractères au plus.
--
--   2. La policy UPDATE passe de « admin ou créateur » à `can_manage_team`
--      (admin, créateur OU responsable, mig. 107). Un responsable gérait déjà
--      les membres et les projets de son équipe, pas sa fiche : l'écran lui
--      aurait proposé un geste que la base refusait. Et `is_org_member` en
--      tête : un membre suspendu (mig. 161) ne modifie plus rien, même s'il
--      a créé l'équipe (`can_manage_team` ne regarde pas la suspension sur
--      les branches créateur et responsable).
--
--   3. 🔴 `org_id` et `created_by` deviennent immuables. La policy acceptait
--      `created_by = auth.uid()` en WITH CHECK sans rien dire de `org_id` :
--      le créateur d'une équipe pouvait la DÉPLACER dans une autre
--      organisation, ses appartenances restant dans la première. Même garde
--      que `team_task_before_update` (mig. 080) : `created_by` peut seulement
--      passer à NULL (cascade de la suppression de compte, RGPD).
--
-- ❌ La suppression reste « admin ou créateur » (`org_teams_delete`),
-- inchangée : un responsable gère son équipe, il ne la supprime pas.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.org_teams
  ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.org_teams DROP CONSTRAINT IF EXISTS org_teams_description_length;
ALTER TABLE public.org_teams ADD CONSTRAINT org_teams_description_length
  CHECK (description IS NULL OR char_length(description) <= 500);

DROP POLICY IF EXISTS "org_teams_update" ON public.org_teams;
CREATE POLICY "org_teams_update" ON public.org_teams FOR UPDATE
  USING (public.is_org_member(org_id) AND public.can_manage_team(id))
  WITH CHECK (public.is_org_member(org_id) AND public.can_manage_team(id));

-- Garde, donc SECURITY INVOKER (règle de la mig. 108) : ses messages ne
-- disent rien que l'appelant ne sache déjà.
CREATE OR REPLACE FUNCTION public.org_team_before_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION 'org_id is immutable' USING ERRCODE = '42501';
  END IF;
  IF NEW.created_by IS NOT NULL AND NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'created_by is immutable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.org_team_before_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_org_team_before_update ON public.org_teams;
CREATE TRIGGER trg_org_team_before_update
  BEFORE UPDATE ON public.org_teams
  FOR EACH ROW EXECUTE FUNCTION public.org_team_before_update();

COMMIT;


-- ═══════════════════════════════════════════════════════════════════
-- VÉRIFICATION APRÈS APPLICATION
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'org_teams'
--      AND column_name = 'description';                                  -- 1
--
--   SELECT pg_get_expr(polqual, polrelid) FROM pg_policy
--    WHERE polname = 'org_teams_update';           -- … can_manage_team(id)
--
--   SELECT tgname FROM pg_trigger WHERE tgname = 'trg_org_team_before_update'; -- 1
-- ═══════════════════════════════════════════════════════════════════
