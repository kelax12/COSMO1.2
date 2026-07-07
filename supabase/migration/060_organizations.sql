-- ═══════════════════════════════════════════════════════════════════
-- Migration 060 — Mode entreprise : organisations, membres, demandes
--
-- Modèle :
--   • organizations.join_code = code permanent court ('COSMO-' + 6 chars,
--     alphabet 31 chars sans ambiguïté), généré serveur UNIQUEMENT
--     (create_organization). Jamais SELECTable par un non-membre : le
--     lookup passe par la RPC request_join_organization qui renvoie une
--     erreur générique — le code n'est pas énumérable.
--   • organization_join_requests.accepted_at = NULL tant que non traité
--     (même pattern inbox que shared_tasks/shared_lists).
--   • Toutes les écritures membres/demandes sont RPC-only : pas
--     d'auto-promotion admin, pas d'accepted_at forgé côté client.
--   • profiles.account_type = flag UX ('personal'|'business') — la
--     frontière de sécurité reste organization_members + RLS.
--
-- Anti-récursion RLS (précédent 42P17, mig. 043/045) : les policies de
-- organization_members ne contiennent JAMAIS d'EXISTS direct sur
-- organization_members — tout passe par is_org_member/is_org_admin/
-- is_org_manager (SECURITY DEFINER, bypass RLS à l'évaluation).
-- ═══════════════════════════════════════════════════════════════════

-- ─── Tables ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.organizations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  join_code  TEXT NOT NULL UNIQUE,
  owner_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.organization_members (
  org_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'manager', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.organization_join_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at  TIMESTAMPTZ,
  rejected_at  TIMESTAMPTZ,
  UNIQUE (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_join_requests_org_id ON public.organization_join_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_org_join_requests_user_id ON public.organization_join_requests(user_id);

-- ─── profiles.account_type ──────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'personal'
  CHECK (account_type IN ('personal', 'business'));

-- handle_new_user_profile : copie account_type depuis la metadata signup,
-- avec garde stricte (metadata contrôlée par le client — jamais de
-- confiance brute, tout ce qui n'est pas 'business' retombe en 'personal').
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url, account_type)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    CASE WHEN NEW.raw_user_meta_data->>'account_type' = 'business'
         THEN 'business' ELSE 'personal' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ─── Helpers RLS (SECURITY DEFINER — cassent la récursion) ──────────

CREATE OR REPLACE FUNCTION public.is_org_member(p_org UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = p_org AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(p_org UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = p_org AND user_id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_manager(p_org UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = p_org AND user_id = auth.uid() AND role IN ('admin', 'manager')
  );
$$;

REVOKE ALL ON FUNCTION public.is_org_member(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_org_admin(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_org_manager(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_manager(UUID) TO authenticated;

-- ─── RLS : organizations ────────────────────────────────────────────
-- SELECT réservé aux membres (le join_code ne fuit jamais vers un
-- non-membre). Écritures : rename admin uniquement ; INSERT/DELETE
-- passent par RPC / cascade — pas de policy client.

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organizations_select" ON public.organizations;
CREATE POLICY "organizations_select"
  ON public.organizations FOR SELECT
  USING (public.is_org_member(id));

DROP POLICY IF EXISTS "organizations_update" ON public.organizations;
CREATE POLICY "organizations_update"
  ON public.organizations FOR UPDATE
  USING (public.is_org_admin(id))
  WITH CHECK (public.is_org_admin(id));

-- Immutabilité : un rename admin ne peut pas toucher join_code/owner_id.
CREATE OR REPLACE FUNCTION public.prevent_org_immutables()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.join_code IS DISTINCT FROM OLD.join_code
     OR NEW.owner_id IS DISTINCT FROM OLD.owner_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'join_code, owner_id and created_at are immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_org_immutables ON public.organizations;
CREATE TRIGGER trg_prevent_org_immutables
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_org_immutables();

-- ─── RLS : organization_members ─────────────────────────────────────
-- Lecture : annuaire visible par les membres. AUCUNE écriture client
-- directe (INSERT via RPC d'acceptation, rôle/départ via RPC mig. 061 —
-- la garde « dernier admin » doit être atomique).

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organization_members_select" ON public.organization_members;
CREATE POLICY "organization_members_select"
  ON public.organization_members FOR SELECT
  USING (public.is_org_member(org_id));

-- ─── RLS : organization_join_requests ───────────────────────────────
-- Lecture : le demandeur voit sa demande, les admins voient celles de
-- leur org. INSERT/UPDATE via RPC uniquement (pas d'accepted_at forgé).
-- DELETE : le demandeur peut annuler sa demande en attente.

ALTER TABLE public.organization_join_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_join_requests_select" ON public.organization_join_requests;
CREATE POLICY "org_join_requests_select"
  ON public.organization_join_requests FOR SELECT
  USING (user_id = (SELECT auth.uid()) OR public.is_org_admin(org_id));

DROP POLICY IF EXISTS "org_join_requests_delete" ON public.organization_join_requests;
CREATE POLICY "org_join_requests_delete"
  ON public.organization_join_requests FOR DELETE
  USING (user_id = (SELECT auth.uid()) AND accepted_at IS NULL);

-- ─── RPC : create_organization ──────────────────────────────────────
-- Crée l'org + membership admin + passe le profil en 'business'.
-- Code généré depuis gen_random_uuid() (CSPRNG), alphabet 31 chars sans
-- ambiguïté (pas de 0/O/1/I/L) → ~887M combinaisons, retry sur collision.

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

  -- V1 : une organisation max par utilisateur.
  IF EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Already a member of an organization';
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

-- ─── RPC : request_join_organization ────────────────────────────────
-- Lookup par code, erreur GÉNÉRIQUE si inconnu (pas de leak d'existence).
-- Une seule demande en attente à la fois (les autres pending sont
-- supprimées). Re-demander après un refus réinitialise la demande.

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

  IF EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Already a member of an organization';
  END IF;

  SELECT * INTO v_org FROM public.organizations
  WHERE join_code = upper(btrim(p_code));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid code';
  END IF;

  -- Une seule demande pending à la fois (getMySentJoinRequest = 0..1).
  DELETE FROM public.organization_join_requests
  WHERE user_id = auth.uid() AND accepted_at IS NULL AND org_id <> v_org.id;

  INSERT INTO public.organization_join_requests (org_id, user_id)
  VALUES (v_org.id, auth.uid())
  ON CONFLICT (org_id, user_id) DO UPDATE
    SET requested_at = NOW(), accepted_at = NULL, rejected_at = NULL;

  RETURN QUERY SELECT v_org.name;
END;
$$;

REVOKE ALL ON FUNCTION public.request_join_organization(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_join_organization(TEXT) TO authenticated;

-- ─── RPC : respond_join_request ─────────────────────────────────────
-- Admin uniquement. Atomique : accepted_at + INSERT membre + profil
-- business (pattern accept_friend_request_v2).

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
    -- Le demandeur a pu rejoindre une autre org entre-temps (V1 : une seule).
    -- (RAISE seul : un UPDATE préalable serait rollback par l'exception.)
    IF EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = v_req.user_id) THEN
      RAISE EXCEPTION 'Requester already belongs to an organization';
    END IF;

    UPDATE public.organization_join_requests
    SET accepted_at = NOW() WHERE id = p_request_id;

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
