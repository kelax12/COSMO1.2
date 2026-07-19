-- ═══════════════════════════════════════════════════════════════════
-- 082_team_task_comments.sql — commentaires + mentions sur les tâches
-- d'équipe (mode entreprise, Phase 2 v2, reco #9)
-- ═══════════════════════════════════════════════════════════════════
--
-- Une ligne = un commentaire sur une team_task. Visibilité alignée sur le
-- cloisonnement des projets : quiconque peut accéder à la tâche (helper
-- can_access_team_project via le projet) peut lire/écrire. Suppression :
-- auteur uniquement. `mentions` (UUID[], sans FK) alimente les futures
-- notifications ; purgé à la suppression de compte (purge RPC étendue).

CREATE TABLE IF NOT EXISTS public.team_task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.team_tasks(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  mentions UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_task_comments_task
  ON public.team_task_comments (task_id, created_at);

ALTER TABLE public.team_task_comments ENABLE ROW LEVEL SECURITY;

-- Helper : accès à une tâche d'équipe = accès à son projet (SECURITY
-- DEFINER pour éviter toute récursion RLS, pattern owns_task/068).
CREATE OR REPLACE FUNCTION public.can_access_team_task(p_task UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_tasks t
    WHERE t.id = p_task AND public.can_access_team_project(t.project_id)
  );
$$;

REVOKE ALL ON FUNCTION public.can_access_team_task(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_team_task(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_team_task(UUID) TO authenticated;

DROP POLICY IF EXISTS "team_task_comments_select" ON public.team_task_comments;
CREATE POLICY "team_task_comments_select"
  ON public.team_task_comments FOR SELECT
  USING (public.can_access_team_task(task_id));

DROP POLICY IF EXISTS "team_task_comments_insert" ON public.team_task_comments;
CREATE POLICY "team_task_comments_insert"
  ON public.team_task_comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND public.can_access_team_task(task_id)
  );

-- Pas d'UPDATE (journal immuable, pattern kr_completions) ; DELETE auteur.
DROP POLICY IF EXISTS "team_task_comments_delete" ON public.team_task_comments;
CREATE POLICY "team_task_comments_delete"
  ON public.team_task_comments FOR DELETE
  USING (author_id = auth.uid());

-- RGPD : étend la purge delete-account (mig. 080 / F-2) aux mentions.
-- author_id cascade déjà en SET NULL via la FK.
CREATE OR REPLACE FUNCTION public.purge_user_from_team_assignments(p_user UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_user IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.team_tasks
    SET assignee_ids = array_remove(assignee_ids, p_user)
    WHERE assignee_ids @> ARRAY[p_user];
  UPDATE public.team_task_comments
    SET mentions = array_remove(mentions, p_user)
    WHERE mentions @> ARRAY[p_user];
END;
$$;

REVOKE ALL ON FUNCTION public.purge_user_from_team_assignments(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_user_from_team_assignments(UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_user_from_team_assignments(UUID) TO service_role;
