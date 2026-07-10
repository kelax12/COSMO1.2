-- ═══════════════════════════════════════════════════════════════════
-- Migration 067 — Invitations placées + régénération de code (v2, lot 1c)
--
-- Lien d'invitation « à une place de la pyramide » (modèle share_links /
-- claim_share_link, mig. 046) : le token (UUID PK, CSPRNG) EST le secret.
-- Single-use, expire à 7 jours, révocable (DELETE). L'entrée est DIRECTE
-- (pas de validation admin : le lien est l'approbation) — le nouveau membre
-- arrive rattaché à manager_id (NULL = non placé).
--
-- Le code permanent COSMO-XXXXXX garde son flux avec validation admin ;
-- il devient RÉGÉNÉRABLE par un admin via RPC (l'ancien est invalidé).
-- prevent_org_immutables continue de bloquer tout UPDATE client direct :
-- la RPC s'autorise via un GUC transactionnel.
--
-- Freemium dormant : billing_flags(key, enabled). La ligne
-- 'enterprise_seat_limit' absente ou disabled = aucun blocage. Quand le
-- paiement sera actif : 1 UPDATE et les gardes serveur (claim + respond)
-- refusent l'entrée au-delà du quota gratuit sans abonnement.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Table des liens d'invitation ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_invite_links (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),   -- token secret
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Place dans la pyramide : le nouveau membre sera rattaché à manager_id
  -- (NULL = non placé). ON DELETE CASCADE via auth.users : si le manager
  -- part, le lien meurt avec lui (re-création simple).
  manager_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  claimed_at TIMESTAMPTZ,
  claimed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_org_invite_links_org ON public.org_invite_links(org_id);
CREATE INDEX IF NOT EXISTS idx_org_invite_links_creator ON public.org_invite_links(created_by);

ALTER TABLE public.org_invite_links ENABLE ROW LEVEL SECURITY;

-- SELECT : créateur + admins de l'org (audit). Le claim ne passe PAS par un
-- SELECT client (RPC) — un tiers ne peut pas énumérer les liens.
DROP POLICY IF EXISTS "org_invite_links_select" ON public.org_invite_links;
CREATE POLICY "org_invite_links_select"
  ON public.org_invite_links FOR SELECT
  USING (created_by = (SELECT auth.uid()) OR public.is_org_admin(org_id));

-- INSERT : admin de l'org, OU manager posant le lien sous LUI ou sous
-- quelqu'un de son sous-arbre. created_by = soi (anti-usurpation).
DROP POLICY IF EXISTS "org_invite_links_insert" ON public.org_invite_links;
CREATE POLICY "org_invite_links_insert"
  ON public.org_invite_links FOR INSERT
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND (
      public.is_org_admin(org_id)
      OR (
        manager_id IS NOT NULL
        AND (manager_id = (SELECT auth.uid()) OR public.is_above(org_id, manager_id))
      )
    )
  );

-- DELETE (révocation) : créateur ou admin. Pas d'UPDATE (single-use via RPC).
DROP POLICY IF EXISTS "org_invite_links_delete" ON public.org_invite_links;
CREATE POLICY "org_invite_links_delete"
  ON public.org_invite_links FOR DELETE
  USING (created_by = (SELECT auth.uid()) OR public.is_org_admin(org_id));

-- ─── Flags de facturation (dormants) ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.billing_flags (
  key     TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.billing_flags ENABLE ROW LEVEL SECURITY;
-- Lecture pour tous les authentifiés (le client affiche les bannières),
-- AUCUNE écriture client (service_role/SQL direct uniquement).
DROP POLICY IF EXISTS "billing_flags_select" ON public.billing_flags;
CREATE POLICY "billing_flags_select"
  ON public.billing_flags FOR SELECT TO authenticated
  USING (true);

-- Quota gratuit (aligné sur le pricing : gratuit < 5 collaborateurs).
CREATE OR REPLACE FUNCTION public.org_seats_allowed(p_org UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_enforced BOOLEAN;
  v_count INT;
BEGIN
  SELECT enabled INTO v_enforced FROM public.billing_flags
  WHERE key = 'enterprise_seat_limit';
  IF v_enforced IS DISTINCT FROM true THEN
    RETURN true; -- gate dormant : aucune limite tant que non activé
  END IF;
  SELECT COUNT(*)::int INTO v_count FROM public.organization_members
  WHERE org_id = p_org;
  -- < 5 membres = gratuit. Au-delà : nécessitera un abonnement actif
  -- (vérification Stripe branchée à l'activation du flag — table
  -- org_subscriptions à venir avec la finalisation Stripe).
  RETURN v_count < 5;
END;
$$;

REVOKE ALL ON FUNCTION public.org_seats_allowed(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_seats_allowed(UUID) TO authenticated;

-- ─── RPC : claim_org_invite ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.claim_org_invite(p_token UUID)
RETURNS TABLE (org_id UUID, org_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_link public.org_invite_links;
  v_org public.organizations;
  v_creator_ok BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_link FROM public.org_invite_links
  WHERE id = p_token
  FOR UPDATE;

  -- Erreurs génériques : ne pas distinguer inconnu/expiré/consommé (pas de
  -- leak d'existence ni d'état).
  IF NOT FOUND OR v_link.claimed_at IS NOT NULL OR v_link.expires_at < NOW() THEN
    RAISE EXCEPTION 'invalid_link';
  END IF;

  IF v_link.created_by = auth.uid() THEN
    RAISE EXCEPTION 'invalid_link'; -- pas d'auto-claim de son propre lien
  END IF;

  SELECT * INTO v_org FROM public.organizations WHERE id = v_link.org_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_link';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE public.organization_members.org_id = v_link.org_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Already a member of this organization';
  END IF;

  -- Re-validation des droits du CRÉATEUR au moment du claim (il a pu être
  -- rétrogradé/retiré depuis la création du lien).
  IF v_link.manager_id IS NULL THEN
    v_creator_ok := EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.org_id = v_link.org_id AND m.user_id = v_link.created_by AND m.role = 'admin'
    );
  ELSE
    v_creator_ok := EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.org_id = v_link.org_id AND m.user_id = v_link.created_by
        AND (
          m.role = 'admin'
          OR v_link.manager_id = v_link.created_by
          OR v_link.manager_id IN (SELECT public.get_subtree(v_link.org_id, v_link.created_by))
        )
    );
  END IF;
  IF NOT v_creator_ok THEN
    RAISE EXCEPTION 'invalid_link';
  END IF;

  -- Freemium (dormant tant que le flag n'est pas activé).
  IF NOT public.org_seats_allowed(v_link.org_id) THEN
    RAISE EXCEPTION 'seat_limit_reached';
  END IF;

  -- La place a pu disparaître : si le manager cible n'est plus membre,
  -- on entre « non placé » plutôt que d'échouer.
  INSERT INTO public.organization_members (org_id, user_id, role, manager_id)
  VALUES (
    v_link.org_id,
    auth.uid(),
    'member',
    CASE WHEN v_link.manager_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.org_id = v_link.org_id AND m.user_id = v_link.manager_id
    ) THEN v_link.manager_id ELSE NULL END
  );

  UPDATE public.org_invite_links
  SET claimed_at = NOW(), claimed_by = auth.uid()
  WHERE id = p_token;

  UPDATE public.profiles SET account_type = 'business' WHERE id = auth.uid();

  RETURN QUERY SELECT v_org.id, v_org.name;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_org_invite(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_org_invite(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_org_invite(UUID) FROM anon;

-- ─── Garde freemium sur respond_join_request ────────────────────────
-- (CREATE OR REPLACE de la 065 : ajout du seul check org_seats_allowed.)

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
    IF NOT public.org_seats_allowed(v_req.org_id) THEN
      RAISE EXCEPTION 'seat_limit_reached';
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
REVOKE EXECUTE ON FUNCTION public.respond_join_request(UUID, BOOLEAN) FROM anon;

-- ─── RPC : regenerate_join_code ─────────────────────────────────────
-- Le trigger prevent_org_immutables bloque join_code SAUF quand le GUC
-- transactionnel cosmo.allow_code_regen vaut 'on' (posé uniquement ici).

CREATE OR REPLACE FUNCTION public.prevent_org_immutables()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'created_at is immutable';
  END IF;
  IF NEW.join_code IS DISTINCT FROM OLD.join_code
     AND current_setting('cosmo.allow_code_regen', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'join_code is immutable';
  END IF;
  -- owner_id : immuable côté client ; transfert autorisé hors contexte
  -- authentifié (service_role — delete-account) comme en 060.
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'owner_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.regenerate_join_code(p_org UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_alphabet CONSTANT TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code TEXT;
  v_hex TEXT;
  v_byte INT;
  i INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_org_admin(p_org) THEN
    RAISE EXCEPTION 'Only an admin can regenerate the join code';
  END IF;

  PERFORM set_config('cosmo.allow_code_regen', 'on', true); -- local à la tx

  FOR attempt IN 1..5 LOOP
    v_code := 'COSMO-';
    v_hex := replace(gen_random_uuid()::text, '-', '');
    FOR i IN 1..6 LOOP
      v_byte := ('x' || substr(v_hex, i * 2 - 1, 2))::bit(8)::int;
      v_code := v_code || substr(v_alphabet, (v_byte % 31) + 1, 1);
    END LOOP;

    BEGIN
      UPDATE public.organizations SET join_code = v_code WHERE id = p_org;
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      IF attempt = 5 THEN
        RAISE EXCEPTION 'Could not generate a unique join code';
      END IF;
    END;
  END LOOP;
  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.regenerate_join_code(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.regenerate_join_code(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.regenerate_join_code(UUID) FROM anon;
