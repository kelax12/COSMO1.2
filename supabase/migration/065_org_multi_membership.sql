-- ═══════════════════════════════════════════════════════════════════
-- Migration 065 — Multi-organisations + profil d'entreprise (v2, lot 1a)
--
-- La v1 imposait « une organisation max par utilisateur » (garde dans les
-- 3 RPC de la mig. 060). La v2 la lève : un utilisateur peut appartenir à
-- plusieurs entreprises (freelances, consultants, multi-casquettes) — le
-- client gère une « org active » (switcher). Aucune nouvelle table : on
-- CREATE OR REPLACE les RPC avec des gardes par-org au lieu de globales.
--
-- Ajoute aussi le profil d'entreprise : description (≤500) + secteur (≤80).
-- Le renommage passait déjà par la policy UPDATE admin (060) ; ces deux
-- colonnes suivent la même policy. prevent_org_immutables ne bloque que
-- join_code/owner_id/created_at — description/industry restent libres.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Profil d'entreprise ────────────────────────────────────────────

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS description TEXT CHECK (description IS NULL OR char_length(description) <= 500),
  ADD COLUMN IF NOT EXISTS industry TEXT CHECK (industry IS NULL OR char_length(industry) <= 80);

-- ─── create_organization : garde par-org (multi-org autorisé) ───────
-- Identique à la 060 SAUF : suppression du bloc « Already a member of an
-- organization ». Un utilisateur peut créer une org même s'il en a déjà.

CREATE OR REPLACE FUNCTION public.create_organization(p_name TEXT)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_alphabet CONSTANT TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_name TEXT;
  v_code TEXT;
  v_hex TEXT;
  v_byte INT;
  v_org public.organizations;
  i INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Nom affiché cross-user → sanitize (M-2).
  v_name := public.sanitize_display_name(p_name);
  IF v_name IS NULL OR char_length(v_name) < 2 THEN
    RAISE EXCEPTION 'Invalid organization name';
  END IF;

  FOR attempt IN 1..5 LOOP
    v_code := 'COSMO-';
    v_hex := replace(gen_random_uuid()::text, '-', '');
    FOR i IN 1..6 LOOP
      v_byte := ('x' || substr(v_hex, i * 2 - 1, 2))::bit(8)::int;
      v_code := v_code || substr(v_alphabet, (v_byte % 31) + 1, 1);
    END LOOP;

    BEGIN
      INSERT INTO public.organizations (name, join_code, owner_id)
      VALUES (v_name, v_code, auth.uid())
      RETURNING * INTO v_org;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF attempt = 5 THEN
        RAISE EXCEPTION 'Could not generate a unique join code';
      END IF;
    END;
  END LOOP;

  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (v_org.id, auth.uid(), 'admin');

  UPDATE public.profiles SET account_type = 'business' WHERE id = auth.uid();

  RETURN v_org;
END;
$$;

REVOKE ALL ON FUNCTION public.create_organization(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organization(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_organization(TEXT) FROM anon;

-- ─── request_join_organization : garde par-org ──────────────────────
-- Changements vs 060 :
--   • refuse seulement si déjà membre de CETTE org (plus de garde globale) ;
--   • ne supprime PLUS les demandes pending vers d'autres orgs (un
--     utilisateur peut avoir une demande en cours par org — l'UNIQUE
--     (org_id, user_id) garantit une seule par org).

CREATE OR REPLACE FUNCTION public.request_join_organization(p_code TEXT)
RETURNS TABLE (org_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org public.organizations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_org FROM public.organizations
  WHERE join_code = upper(btrim(p_code));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid code';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = v_org.id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Already a member of this organization';
  END IF;

  INSERT INTO public.organization_join_requests (org_id, user_id)
  VALUES (v_org.id, auth.uid())
  ON CONFLICT (org_id, user_id) DO UPDATE
    SET requested_at = NOW(), accepted_at = NULL, rejected_at = NULL;

  RETURN QUERY SELECT v_org.name;
END;
$$;

REVOKE ALL ON FUNCTION public.request_join_organization(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_join_organization(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.request_join_organization(TEXT) FROM anon;

-- ─── respond_join_request : garde par-org ───────────────────────────
-- Changement vs 060 : « Requester already belongs to an organization »
-- devient un check d'appartenance à CETTE org (accept = no-op propre si
-- le demandeur est déjà entré par un autre canal, ex. lien d'invitation).

CREATE OR REPLACE FUNCTION public.respond_join_request(p_request_id UUID, p_accept BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_req public.organization_join_requests;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_req FROM public.organization_join_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Join request not found';
  END IF;

  IF NOT public.is_org_admin(v_req.org_id) THEN
    RAISE EXCEPTION 'Only an admin can respond to join requests';
  END IF;

  IF v_req.accepted_at IS NOT NULL OR v_req.rejected_at IS NOT NULL THEN
    RAISE EXCEPTION 'Request already processed';
  END IF;

  IF p_accept THEN
    UPDATE public.organization_join_requests
    SET accepted_at = NOW() WHERE id = p_request_id;

    -- Déjà membre de cette org (entré via lien entre-temps) → no-op.
    INSERT INTO public.organization_members (org_id, user_id, role)
    VALUES (v_req.org_id, v_req.user_id, 'member')
    ON CONFLICT (org_id, user_id) DO NOTHING;

    UPDATE public.profiles SET account_type = 'business' WHERE id = v_req.user_id;
  ELSE
    UPDATE public.organization_join_requests
    SET rejected_at = NOW() WHERE id = p_request_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_join_request(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_join_request(UUID, BOOLEAN) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.respond_join_request(UUID, BOOLEAN) FROM anon;
