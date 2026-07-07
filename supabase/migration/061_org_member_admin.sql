-- ═══════════════════════════════════════════════════════════════════
-- Migration 061 — Administration des membres d'entreprise
--
-- RPC SECURITY DEFINER (écritures membres RPC-only, mig. 060) :
--   • set_member_role       — admin change le rôle d'un membre
--   • remove_member         — admin retire un membre
--   • leave_organization    — un membre quitte de lui-même
--
-- Garde « dernier admin » : une organisation doit toujours conserver au
-- moins un admin. On refuse de rétrograder / retirer / faire partir le
-- dernier admin (RAISE, atomique — plus sûr qu'une policy).
-- ═══════════════════════════════════════════════════════════════════

-- Compte les admins d'une org (helper interne, SECURITY DEFINER pour
-- bypasser la RLS de organization_members).
CREATE OR REPLACE FUNCTION public.org_admin_count(p_org UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COUNT(*)::int FROM public.organization_members
  WHERE org_id = p_org AND role = 'admin';
$$;

REVOKE ALL ON FUNCTION public.org_admin_count(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_admin_count(UUID) TO authenticated;

-- ─── set_member_role ────────────────────────────────────────────────

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

  IF p_role NOT IN ('admin', 'manager', 'member') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  SELECT role INTO v_current_role FROM public.organization_members
  WHERE org_id = p_org AND user_id = p_user
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  -- Garde dernier admin : on ne rétrograde pas le seul admin restant.
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

-- ─── remove_member ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.remove_member(p_org UUID, p_user UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_org_admin(p_org) THEN
    RAISE EXCEPTION 'Only an admin can remove members';
  END IF;

  SELECT role INTO v_role FROM public.organization_members
  WHERE org_id = p_org AND user_id = p_user
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  IF v_role = 'admin' AND public.org_admin_count(p_org) <= 1 THEN
    RAISE EXCEPTION 'Cannot remove the last admin';
  END IF;

  DELETE FROM public.organization_members
  WHERE org_id = p_org AND user_id = p_user;

  -- Le membre retiré redevient un compte particulier.
  UPDATE public.profiles SET account_type = 'personal' WHERE id = p_user;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_member(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_member(UUID, UUID) TO authenticated;

-- ─── leave_organization ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.leave_organization(p_org UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_role FROM public.organization_members
  WHERE org_id = p_org AND user_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not a member of this organization';
  END IF;

  -- Le dernier admin ne peut pas partir sans transférer son rôle
  -- (sinon l'org devient orpheline).
  IF v_role = 'admin' AND public.org_admin_count(p_org) <= 1 THEN
    RAISE EXCEPTION 'Transfer the admin role before leaving';
  END IF;

  DELETE FROM public.organization_members
  WHERE org_id = p_org AND user_id = auth.uid();

  UPDATE public.profiles SET account_type = 'personal' WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.leave_organization(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_organization(UUID) TO authenticated;
