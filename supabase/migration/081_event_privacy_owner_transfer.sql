-- ═══════════════════════════════════════════════════════════════════
-- 081_event_privacy_owner_transfer.sql — F-1 (suite) : événements privés
-- exclus de la vue hiérarchique + transfert de propriété d'organisation
-- ═══════════════════════════════════════════════════════════════════
--
-- Partie 1 — F-1 (faille.md, audit Fable 2026-07-18) : la mig. 080 a retiré
-- UPDATE/DELETE manager sur `events` ; il restait SELECT+INSERT sans aucune
-- distinction perso/pro. Ajout de `events.is_private` : un événement privé
-- n'est visible QUE par son propriétaire (les policies « own » restent
-- inchangées) ; un manager ne peut ni le lire ni en créer un.
--
-- Partie 2 — transfert de propriété (reco #18) : un owner ne pouvait que
-- supprimer son org. RPC `transfer_org_ownership` réservé à l'owner actuel,
-- via le même pattern GUC transactionnel que regenerate_join_code (le
-- trigger prevent_org_immutables continue de bloquer toute écriture client
-- directe de owner_id).

-- ─── Partie 1 : events.is_private ───────────────────────────────────

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

-- Les policies « own » (user_id = auth.uid()) ne changent pas : le
-- propriétaire voit et gère ses événements privés normalement.

DROP POLICY IF EXISTS "events_manager_select" ON public.events;
CREATE POLICY "events_manager_select"
  ON public.events FOR SELECT
  USING (public.manages_user(user_id) AND NOT is_private);

DROP POLICY IF EXISTS "events_manager_insert" ON public.events;
CREATE POLICY "events_manager_insert"
  ON public.events FOR INSERT
  WITH CHECK (public.manages_user(user_id) AND NOT is_private);

-- ─── Partie 2 : transfert de propriété ──────────────────────────────

-- prevent_org_immutables : owner_id reste immuable côté client, SAUF quand
-- le GUC transactionnel cosmo.allow_owner_transfer vaut 'on' (posé
-- uniquement par transfer_org_ownership) ou hors contexte authentifié
-- (service_role — delete-account, comme en 067).
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
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id
     AND auth.uid() IS NOT NULL
     AND current_setting('cosmo.allow_owner_transfer', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'owner_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_org_ownership(p_org UUID, p_new_owner UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT owner_id INTO v_owner FROM public.organizations
  WHERE id = p_org
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  -- Seul l'owner ACTUEL transfère (pas un simple admin).
  IF v_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the owner can transfer ownership';
  END IF;

  IF p_new_owner IS NULL OR p_new_owner = auth.uid() THEN
    RAISE EXCEPTION 'Invalid new owner';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = p_org AND user_id = p_new_owner
  ) THEN
    RAISE EXCEPTION 'New owner must be a member of the organization';
  END IF;

  PERFORM set_config('cosmo.allow_owner_transfer', 'on', true); -- local à la tx

  UPDATE public.organizations SET owner_id = p_new_owner WHERE id = p_org;

  -- Le nouvel owner devient admin (idempotent) ; l'ancien owner RESTE
  -- admin — il peut ensuite se rétrograder/partir via les flux existants
  -- (la garde « dernier admin » de leave_organization continue de protéger).
  UPDATE public.organization_members
  SET role = 'admin'
  WHERE org_id = p_org AND user_id = p_new_owner;
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_org_ownership(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_org_ownership(UUID, UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_org_ownership(UUID, UUID) FROM anon;
