-- ═══════════════════════════════════════════════════════════════════
-- 087 — Suppression du doublon `has_reports` (correctif de la 084)
--
-- La première version de la 084 créait un helper `has_reports(p_org, p_user)`
-- pour AUD-02. C'était le doublon exact de `public.has_subordinates(p_org,
-- p_user)`, en place depuis la migration 066 et déjà consommé par
-- `is_org_manager` — même corps, même signature, même sémantique. Deux
-- fonctions identiques, c'est de la surface RPC en trop et un piège de
-- maintenance (corriger l'une sans l'autre).
--
-- Cette migration recâble la policy et la RPC sur `has_subordinates`, puis
-- supprime `has_reports`. Le fichier 084 a été mis à jour en conséquence :
-- appliquer 084 seule sur un environnement neuf donne déjà l'état final,
-- 087 n'est nécessaire que là où la première version a été appliquée
-- (production, le 2026-08-07).
--
-- Aucun changement de comportement.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

DROP POLICY IF EXISTS "org_invite_links_insert" ON public.org_invite_links;
CREATE POLICY "org_invite_links_insert"
  ON public.org_invite_links FOR INSERT
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND expires_at <= NOW() + INTERVAL '7 days'
    AND claimed_at IS NULL
    AND claimed_by IS NULL
    AND (
      public.is_org_admin(org_id)
      OR (
        manager_id IS NOT NULL
        AND public.has_subordinates(org_id, (SELECT auth.uid()))
        AND (manager_id = (SELECT auth.uid()) OR public.is_above(org_id, manager_id))
      )
    )
  );

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

  SELECT * INTO v_link FROM public.org_invite_links WHERE id = p_token FOR UPDATE;

  IF NOT FOUND OR v_link.claimed_at IS NOT NULL OR v_link.expires_at < NOW() THEN
    RAISE EXCEPTION 'invalid_link';
  END IF;

  IF v_link.created_by = auth.uid() THEN
    RAISE EXCEPTION 'invalid_link';
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
          OR (
            public.has_subordinates(v_link.org_id, v_link.created_by)
            AND (
              v_link.manager_id = v_link.created_by
              OR v_link.manager_id IN (SELECT public.get_subtree(v_link.org_id, v_link.created_by))
            )
          )
        )
    );
  END IF;
  IF NOT v_creator_ok THEN
    RAISE EXCEPTION 'invalid_link';
  END IF;

  IF NOT public.org_seats_allowed(v_link.org_id) THEN
    RAISE EXCEPTION 'seat_limit_reached';
  END IF;

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
REVOKE EXECUTE ON FUNCTION public.claim_org_invite(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_org_invite(UUID) TO authenticated;

DROP FUNCTION IF EXISTS public.has_reports(UUID, UUID);

COMMIT;
