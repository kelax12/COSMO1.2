-- ═══════════════════════════════════════════════════════════════════
-- 077_manager_agenda.sql — Agenda des subordonnés visible/gérable par
-- leur hiérarchie (mode entreprise)
-- ═══════════════════════════════════════════════════════════════════
--
-- Un ADMIN d'une org voit et gère l'agenda de tous ses membres ; un
-- MANAGER (dérivé : ≥ 1 subordonné) celui de son sous-arbre. Helper
-- SECURITY DEFINER unique `manages_user`, réutilisé par 4 policies
-- PERMISSIVES additionnelles sur `events` (les policies « own » de
-- l'utilisateur restent inchangées).
--
-- ⚠️ Côté client : depuis cette migration, les lectures d'agenda
-- PERSONNEL doivent filtrer explicitement `user_id = auth.uid()`
-- (sinon l'agenda du manager afficherait aussi ceux de ses équipes).
-- Fait dans src/modules/events/supabase.repository.ts.

CREATE OR REPLACE FUNCTION public.manages_user(p_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_user IS NOT NULL
     AND p_user <> auth.uid()
     AND EXISTS (
       SELECT 1
       FROM public.organization_members me
       JOIN public.organization_members target
         ON target.org_id = me.org_id AND target.user_id = p_user
       WHERE me.user_id = auth.uid()
         AND (
           me.role = 'admin'
           OR target.user_id IN (SELECT public.get_subtree(me.org_id, auth.uid()))
         )
     );
$$;

REVOKE ALL ON FUNCTION public.manages_user(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.manages_user(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.manages_user(UUID) TO authenticated;

DROP POLICY IF EXISTS "events_manager_select" ON public.events;
CREATE POLICY "events_manager_select"
  ON public.events FOR SELECT
  USING (public.manages_user(user_id));

DROP POLICY IF EXISTS "events_manager_insert" ON public.events;
CREATE POLICY "events_manager_insert"
  ON public.events FOR INSERT
  WITH CHECK (public.manages_user(user_id));

DROP POLICY IF EXISTS "events_manager_update" ON public.events;
CREATE POLICY "events_manager_update"
  ON public.events FOR UPDATE
  USING (public.manages_user(user_id))
  WITH CHECK (public.manages_user(user_id));

DROP POLICY IF EXISTS "events_manager_delete" ON public.events;
CREATE POLICY "events_manager_delete"
  ON public.events FOR DELETE
  USING (public.manages_user(user_id));
