-- ═══════════════════════════════════════════════════════════════════
-- Migration 066 — Pyramide hiérarchique N+1 (v2, lot 1b)
--
-- Chaque membre a UN supérieur direct (manager_id, scope org) — NULL =
-- « non placé » (racine implicite ou en attente de placement). Le rôle
-- « manager » n'est PLUS stocké : il est DÉRIVÉ de l'arbre (a ≥ 1
-- subordonné). Le rôle stocké se réduit à 'admin' | 'member'.
--
-- Droits : l'admin modifie tout le monde ; un manager (dérivé) ne modifie
-- que son sous-arbre. Écritures hiérarchie RPC-only (set_member_manager).
--
-- Anti-récursion RLS (42P17) : tous les parcours d'arbre passent par des
-- fonctions SECURITY DEFINER (get_subtree en CTE récursif, cap 50 niveaux)
-- — aucune policy ne référence organization_members directement.
-- Anti-cycle : trigger BEFORE INSERT/UPDATE refuse un manager_id situé
-- dans le propre sous-arbre du membre (sinon le CTE bouclerait — le cap
-- de profondeur reste une ceinture de sécurité défensive).
-- ═══════════════════════════════════════════════════════════════════

-- ─── Colonne manager_id ─────────────────────────────────────────────

ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Un membre n'est jamais son propre manager (idempotent : drop d'abord).
ALTER TABLE public.organization_members
  DROP CONSTRAINT IF EXISTS org_member_not_own_manager;
ALTER TABLE public.organization_members
  ADD CONSTRAINT org_member_not_own_manager
  CHECK (manager_id IS NULL OR manager_id <> user_id);

CREATE INDEX IF NOT EXISTS idx_org_members_manager
  ON public.organization_members(org_id, manager_id);

-- ─── Migration du rôle : 'manager' devient dérivé ───────────────────

UPDATE public.organization_members SET role = 'member' WHERE role = 'manager';

ALTER TABLE public.organization_members
  DROP CONSTRAINT IF EXISTS organization_members_role_check;
ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_role_check
  CHECK (role IN ('admin', 'member'));

-- ─── Helpers hiérarchie (SECURITY DEFINER) ──────────────────────────

-- Tous les user_id du sous-arbre STRICT de p_root (descendants, pas p_root).
CREATE OR REPLACE FUNCTION public.get_subtree(p_org UUID, p_root UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH RECURSIVE sub AS (
    SELECT m.user_id, 1 AS depth
    FROM public.organization_members m
    WHERE m.org_id = p_org AND m.manager_id = p_root
    UNION ALL
    SELECT m.user_id, s.depth + 1
    FROM public.organization_members m
    JOIN sub s ON m.manager_id = s.user_id
    WHERE m.org_id = p_org AND s.depth < 50
  )
  SELECT user_id FROM sub;
$$;

-- auth.uid() est-il un ancêtre STRICT de p_user dans p_org ?
CREATE OR REPLACE FUNCTION public.is_above(p_org UUID, p_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_user IN (SELECT public.get_subtree(p_org, auth.uid()));
$$;

CREATE OR REPLACE FUNCTION public.has_subordinates(p_org UUID, p_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = p_org AND manager_id = p_user
  );
$$;

REVOKE ALL ON FUNCTION public.get_subtree(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_above(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_subordinates(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_subtree(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_above(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_subordinates(UUID, UUID) TO authenticated;

-- ─── is_org_manager REDÉFINI (dérivé de l'arbre) ────────────────────
-- Les policies existantes (062/063 : création de projets/OKR) qui appellent
-- is_org_manager suivent automatiquement la nouvelle définition.

CREATE OR REPLACE FUNCTION public.is_org_manager(p_org UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_org_admin(p_org)
      OR public.has_subordinates(p_org, auth.uid());
$$;

-- ─── Trigger anti-cycle + cohérence org ─────────────────────────────

CREATE OR REPLACE FUNCTION public.validate_org_manager()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.manager_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Le manager doit être membre de la même organisation.
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = NEW.org_id AND user_id = NEW.manager_id
  ) THEN
    RAISE EXCEPTION 'Manager must be a member of the organization';
  END IF;

  -- Anti-cycle : le nouveau manager ne peut pas être un descendant du membre.
  IF NEW.manager_id IN (SELECT public.get_subtree(NEW.org_id, NEW.user_id)) THEN
    RAISE EXCEPTION 'Hierarchy cycle detected';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_org_manager ON public.organization_members;
CREATE TRIGGER trg_validate_org_manager
  BEFORE INSERT OR UPDATE OF manager_id ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.validate_org_manager();

-- ─── RPC : set_member_manager ───────────────────────────────────────
-- Place/déplace un membre dans la pyramide. Admin : tout. Manager (dérivé) :
-- uniquement une cible de SON sous-arbre, vers lui-même ou un membre de son
-- sous-arbre. Détacher (NULL) est réservé aux admins.

CREATE OR REPLACE FUNCTION public.set_member_manager(p_org UUID, p_user UUID, p_manager UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = p_org AND user_id = p_user
  ) THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF public.is_org_admin(p_org) THEN
    NULL; -- admin : tout est permis (le trigger garde cohérence + cycles)
  ELSE
    -- Manager : la CIBLE doit être dans mon sous-arbre (ou non placée n'est
    -- pas suffisant — seuls les admins placent les non-placés)…
    IF NOT public.is_above(p_org, p_user) THEN
      RAISE EXCEPTION 'You can only move members below you';
    END IF;
    -- …et la DESTINATION doit être moi ou quelqu'un de mon sous-arbre.
    IF p_manager IS NULL THEN
      RAISE EXCEPTION 'Only an admin can detach a member';
    END IF;
    IF p_manager <> auth.uid() AND NOT public.is_above(p_org, p_manager) THEN
      RAISE EXCEPTION 'Destination must be within your subtree';
    END IF;
  END IF;

  UPDATE public.organization_members
  SET manager_id = p_manager
  WHERE org_id = p_org AND user_id = p_user;
END;
$$;

REVOKE ALL ON FUNCTION public.set_member_manager(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_member_manager(UUID, UUID, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.set_member_manager(UUID, UUID, UUID) FROM anon;

-- ─── remove_member / leave_organization : re-parentage ──────────────
-- Avant de retirer un membre, ses subordonnés remontent vers SON manager
-- (grand-parent ; NULL = non placés si le partant était racine). Sans ça,
-- des orphelins silencieux casseraient la pyramide.

CREATE OR REPLACE FUNCTION public.remove_member(p_org UUID, p_user UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT;
  v_parent UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_org_admin(p_org) THEN
    RAISE EXCEPTION 'Only an admin can remove members';
  END IF;

  SELECT role, manager_id INTO v_role, v_parent FROM public.organization_members
  WHERE org_id = p_org AND user_id = p_user
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF v_role = 'admin' AND public.org_admin_count(p_org) <= 1 THEN
    RAISE EXCEPTION 'Cannot remove the last admin';
  END IF;

  -- Re-parentage des subordonnés directs vers le grand-parent.
  UPDATE public.organization_members
  SET manager_id = v_parent
  WHERE org_id = p_org AND manager_id = p_user;

  DELETE FROM public.organization_members
  WHERE org_id = p_org AND user_id = p_user;

  -- Le membre retiré redevient particulier SEULEMENT s'il n'a plus aucune org.
  IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = p_user) THEN
    UPDATE public.profiles SET account_type = 'personal' WHERE id = p_user;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_member(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_member(UUID, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.remove_member(UUID, UUID) FROM anon;

CREATE OR REPLACE FUNCTION public.leave_organization(p_org UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT;
  v_parent UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role, manager_id INTO v_role, v_parent FROM public.organization_members
  WHERE org_id = p_org AND user_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  IF v_role = 'admin' AND public.org_admin_count(p_org) <= 1 THEN
    RAISE EXCEPTION 'Transfer the admin role before leaving';
  END IF;

  UPDATE public.organization_members
  SET manager_id = v_parent
  WHERE org_id = p_org AND manager_id = auth.uid();

  DELETE FROM public.organization_members
  WHERE org_id = p_org AND user_id = auth.uid();

  IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = auth.uid()) THEN
    UPDATE public.profiles SET account_type = 'personal' WHERE id = auth.uid();
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.leave_organization(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_organization(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.leave_organization(UUID) FROM anon;

-- ─── set_member_role : restreint à admin|member ─────────────────────
-- (le rôle 'manager' n'existe plus — CREATE OR REPLACE pour resserrer le
-- check de la 061 et garder la garde dernier admin).

CREATE OR REPLACE FUNCTION public.set_member_role(p_org UUID, p_user UUID, p_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_org_admin(p_org) THEN
    RAISE EXCEPTION 'Only an admin can change roles';
  END IF;

  IF p_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  SELECT role INTO v_current_role FROM public.organization_members
  WHERE org_id = p_org AND user_id = p_user
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF v_current_role = 'admin' AND p_role <> 'admin'
     AND public.org_admin_count(p_org) <= 1 THEN
    RAISE EXCEPTION 'Cannot demote the last admin';
  END IF;

  UPDATE public.organization_members
  SET role = p_role
  WHERE org_id = p_org AND user_id = p_user;
END;
$$;

REVOKE ALL ON FUNCTION public.set_member_role(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_member_role(UUID, UUID, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.set_member_role(UUID, UUID, TEXT) FROM anon;
