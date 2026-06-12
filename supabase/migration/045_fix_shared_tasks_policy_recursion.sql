-- ═══════════════════════════════════════════════════════════════════
-- Migration 045 — Fix « infinite recursion detected in policy for relation
-- "shared_tasks" » (SQLSTATE 42P17)
--
-- Cause : la migration 043 a recréé TOUTES les policies depuis les fichiers.
-- Or `shared_tasks_insert` (027/036) contient un EXISTS sur `tasks`, et la
-- policy `Collaborators can read shared tasks` sur `tasks` (019) contient un
-- EXISTS sur `shared_tasks`. Postgres détecte le cycle tasks ↔ shared_tasks à
-- l'expansion RLS et rejette TOUT INSERT dans shared_tasks → le partage de
-- tâche était cassé en prod (toast générique, erreur 42P17 non mappée).
--
-- Fix (pattern canonique) : casser l'arête shared_tasks → tasks en déplaçant
-- le check de propriété dans une fonction SECURITY DEFINER (bypass RLS → pas
-- d'expansion des policies de `tasks` pendant l'évaluation de celles de
-- `shared_tasks`). L'autre direction (tasks → shared_tasks) reste telle
-- quelle : `shared_tasks_select` est simple (auth.uid() uniquement), donc
-- son expansion ne re-touche jamais `tasks`.
--
-- Sécurité inchangée : owns_task() vérifie exactement le même prédicat
-- (t.user_id = auth.uid()) ; auth.uid() reste celui de l'appelant dans une
-- fonction SECURITY DEFINER. search_path vidé (hardening advisor), EXECUTE
-- refusé à anon.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.owns_task(p_task_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = p_task_id
      AND t.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.owns_task(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.owns_task(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.owns_task(UUID) TO authenticated;

-- Recrée la policy INSERT : même modèle de confiance que 036 (amitié
-- confirmée OU demande pending envoyée par le partageur), mais le check
-- de propriété passe par owns_task() au lieu d'un EXISTS direct sur tasks.
DROP POLICY IF EXISTS "shared_tasks_insert" ON public.shared_tasks;

CREATE POLICY "shared_tasks_insert"
  ON public.shared_tasks FOR INSERT
  WITH CHECK (
    (select auth.uid()) = shared_by
    AND public.owns_task(task_id)
    AND (
      -- (a) Amitié confirmée (migration 027)
      EXISTS (
        SELECT 1 FROM public.friends f
        WHERE f.user_id = (select auth.uid())
          AND f.friend_user_id = shared_tasks.friend_id
      )
      -- (b) Demande d'ami envoyée par le partageur, encore en attente (036)
      OR EXISTS (
        SELECT 1 FROM public.friend_requests fr
        WHERE fr.sender_id = (select auth.uid())
          AND fr.receiver_id = shared_tasks.friend_id
          AND fr.status = 'pending'
      )
    )
  );
