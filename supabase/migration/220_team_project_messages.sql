-- ═══════════════════════════════════════════════════════════════════
-- 220_team_project_messages.sql · chat d'un projet d'entreprise (2026-10-13)
-- ═══════════════════════════════════════════════════════════════════
--
-- Remplace le bloc « Ajouter au projet » de la page projet par une
-- conversation. Une ligne = un message sur un projet.
--
-- Lecture et écriture : quiconque VOIT le projet (`can_access_team_project`,
-- même prédicat que les commentaires de tâches, mig. 082). Le rôle affiché
-- derrière le nom (responsable / membre) se lit côté client dans
-- `team_project_members` : il n'est pas copié dans le message.
--
-- Pas d'UPDATE (un message ne se réécrit pas) ; DELETE par l'auteur seul.
-- `author_id` passe à NULL à la suppression de compte (RGPD art. 17) :
-- le message reste, signé « ancien membre ».

CREATE TABLE IF NOT EXISTS public.team_project_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.team_projects(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body       TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_project_messages_project
  ON public.team_project_messages (project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_team_project_messages_author
  ON public.team_project_messages (author_id);

ALTER TABLE public.team_project_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_project_messages_select" ON public.team_project_messages;
CREATE POLICY "team_project_messages_select" ON public.team_project_messages FOR SELECT
  USING (public.can_access_team_project(project_id));

DROP POLICY IF EXISTS "team_project_messages_insert" ON public.team_project_messages;
CREATE POLICY "team_project_messages_insert" ON public.team_project_messages FOR INSERT
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND public.can_access_team_project(project_id)
    AND EXISTS (
      SELECT 1 FROM public.team_projects p
      WHERE p.id = team_project_messages.project_id AND p.org_id = team_project_messages.org_id
    )
  );

DROP POLICY IF EXISTS "team_project_messages_delete" ON public.team_project_messages;
CREATE POLICY "team_project_messages_delete" ON public.team_project_messages FOR DELETE
  USING (author_id = (SELECT auth.uid()));

REVOKE ALL ON public.team_project_messages FROM anon;
