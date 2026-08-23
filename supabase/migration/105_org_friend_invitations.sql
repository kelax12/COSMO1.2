-- ═══════════════════════════════════════════════════════════════════
-- Migration 105 — Inviter un AMI dans son entreprise, via la boîte de
--                 réception
--
-- CE QUI MANQUAIT
-- Trois façons d'entrer dans une organisation existaient déjà :
--   • le code permanent COSMO-XXXXXXXXXX → demande, validée par un admin ;
--   • un lien d'invitation à usage unique (`org_invite_links`, mig. 067) ;
--   • la création de l'organisation elle-même.
--
-- Aucune ne part de la relation d'amitié COSMO. Un membre qui voulait faire
-- venir un ami devait lui transmettre un code ou une URL par un canal
-- extérieur à l'app. L'invitation n'atterrissait nulle part : ni notification,
-- ni trace côté destinataire.
--
-- CE QUE FAIT CETTE MIGRATION
-- Une table d'invitations nominatives, sur le MÊME modèle « inbox » que
-- `shared_tasks` et `organization_join_requests` : une ligne en attente tant
-- que ni acceptée ni refusée. Le destinataire la voit dans sa boîte de
-- réception, à côté des tâches partagées et des demandes d'amis.
--
-- DÉCISIONS
--   • On n'invite QUE des amis confirmés (même modèle de confiance que le
--     partage de tâches, mig. 027/045). Sans ça, la table devient un canal de
--     spam nominatif vers n'importe quel compte.
--   • Le nouvel arrivant entre NON PLACÉ (`manager_id` NULL) : un admin le
--     range ensuite dans la pyramide. L'inviteur n'a pas forcément le droit
--     de décider d'une place, et un placement automatique sous l'inviteur
--     donnerait à n'importe quel membre le pouvoir de se créer des
--     subordonnés.
--   • Quota de sièges vérifié à l'ACCEPTATION, pas à l'invitation — comme
--     `claim_org_invite`. Une invitation émise sous le quota mais acceptée
--     après saturation doit échouer proprement, pas passer en douce.
--   • Écritures RPC-only : aucune policy INSERT/UPDATE/DELETE côté client, on
--     ne peut donc pas forger un `accepted_at` ni s'inviter soi-même.
-- ═══════════════════════════════════════════════════════════════════


-- ─── Table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  inviter_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  -- Une seule invitation par (org, personne) : ré-inviter réarme la ligne
  -- existante au lieu d'en empiler une deuxième dans la boîte de réception.
  UNIQUE (org_id, invitee_id),
  -- On ne s'invite pas soi-même.
  CONSTRAINT org_invitations_not_self CHECK (inviter_id <> invitee_id)
);

CREATE INDEX IF NOT EXISTS idx_org_invitations_invitee
  ON public.org_invitations (invitee_id) WHERE accepted_at IS NULL AND declined_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_org_invitations_org
  ON public.org_invitations (org_id);


-- ─── RLS ────────────────────────────────────────────────────────────
-- UNE SEULE policy PERMISSIVE par rôle+action (mig. 049).
-- Lecture : le destinataire voit ce qui le concerne ; les membres de l'org
-- voient les invitations émises en son nom (pour afficher « en attente »).
-- Écriture : rien. Tout passe par les deux RPC ci-dessous.

ALTER TABLE public.org_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_invitations_select" ON public.org_invitations;
CREATE POLICY "org_invitations_select"
  ON public.org_invitations FOR SELECT
  USING (
    (select auth.uid()) = invitee_id
    OR public.is_org_member(org_id)
  );


-- ─── RPC : invite_friend_to_org ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.invite_friend_to_org(p_org UUID, p_invitee UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_invitee = auth.uid() THEN
    RAISE EXCEPTION 'cannot_invite_self';
  END IF;

  -- L'inviteur doit appartenir à l'organisation qu'il prétend représenter.
  IF NOT public.is_org_member(p_org) THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;

  -- Même modèle de confiance que le partage de tâches (mig. 027/045) :
  -- amitié CONFIRMÉE uniquement. On n'accepte pas ici la variante « demande
  -- d'ami en attente » du partage : entrer dans une entreprise engage plus
  -- qu'accepter une tâche.
  IF NOT EXISTS (
    SELECT 1 FROM public.friends f
    WHERE f.user_id = auth.uid() AND f.friend_user_id = p_invitee
  ) THEN
    RAISE EXCEPTION 'not_a_friend';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = p_org AND user_id = p_invitee
  ) THEN
    RAISE EXCEPTION 'already_a_member';
  END IF;

  -- Ré-invitation : on réarme la ligne (un refus passé ne condamne pas).
  INSERT INTO public.org_invitations (org_id, inviter_id, invitee_id)
  VALUES (p_org, auth.uid(), p_invitee)
  ON CONFLICT (org_id, invitee_id) DO UPDATE
    SET inviter_id  = auth.uid(),
        created_at  = NOW(),
        accepted_at = NULL,
        declined_at = NULL
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invite_friend_to_org(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.invite_friend_to_org(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.invite_friend_to_org(UUID, UUID) TO authenticated;


-- ─── RPC : respond_org_invitation ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.respond_org_invitation(p_invitation UUID, p_accept BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inv public.org_invitations;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_inv FROM public.org_invitations
  WHERE id = p_invitation
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation_not_found';
  END IF;

  -- SEUL le destinataire répond. Un membre de l'org peut LIRE la ligne
  -- (policy SELECT) mais pas décider à sa place.
  IF v_inv.invitee_id <> auth.uid() THEN
    RAISE EXCEPTION 'invitation_not_found';
  END IF;

  IF v_inv.accepted_at IS NOT NULL OR v_inv.declined_at IS NOT NULL THEN
    RAISE EXCEPTION 'invitation_already_processed';
  END IF;

  IF NOT p_accept THEN
    UPDATE public.org_invitations SET declined_at = NOW() WHERE id = p_invitation;
    RETURN;
  END IF;

  -- Re-validation à l'acceptation : l'inviteur a pu être retiré de l'org
  -- entre-temps. Une invitation ne survit pas à celui qui l'a émise.
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = v_inv.org_id AND user_id = v_inv.inviter_id
  ) THEN
    RAISE EXCEPTION 'inviter_no_longer_member';
  END IF;

  -- Freemium (dormant tant que le flag n'est pas activé) — même garde que
  -- claim_org_invite et respond_join_request.
  IF NOT public.org_seats_allowed(v_inv.org_id) THEN
    RAISE EXCEPTION 'seat_limit_reached';
  END IF;

  -- Entrée NON PLACÉE : un admin range ensuite dans la pyramide.
  INSERT INTO public.organization_members (org_id, user_id, role, manager_id)
  VALUES (v_inv.org_id, auth.uid(), 'member', NULL)
  ON CONFLICT (org_id, user_id) DO NOTHING;

  UPDATE public.org_invitations SET accepted_at = NOW() WHERE id = p_invitation;
  UPDATE public.profiles SET account_type = 'business' WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.respond_org_invitation(UUID, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.respond_org_invitation(UUID, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.respond_org_invitation(UUID, BOOLEAN) TO authenticated;


-- ─── RPC : mes invitations en attente (enrichies) ───────────────────
-- La policy SELECT de `profiles` (durcissement N12, mig. 022) n'expose pas le
-- profil d'un tiers non ami. Or l'inviteur EST un ami — mais le NOM DE
-- L'ORGANISATION, lui, n'est pas lisible par un non-membre
-- (`organizations_select` = is_org_member). Sans cette RPC, la boîte de
-- réception afficherait « vous êtes invité dans … » sans pouvoir dire où.

CREATE OR REPLACE FUNCTION public.get_my_org_invitations()
RETURNS TABLE (
  id           UUID,
  org_id       UUID,
  org_name     TEXT,
  inviter_id   UUID,
  inviter_name TEXT,
  created_at   TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    i.id,
    i.org_id,
    o.name,
    i.inviter_id,
    COALESCE(p.display_name, split_part(p.email, '@', 1)),
    i.created_at
  FROM public.org_invitations i
  JOIN public.organizations o ON o.id = i.org_id
  LEFT JOIN public.profiles p ON p.id = i.inviter_id
  WHERE auth.uid() IS NOT NULL
    AND i.invitee_id = auth.uid()
    AND i.accepted_at IS NULL
    AND i.declined_at IS NULL
  ORDER BY i.created_at DESC
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION public.get_my_org_invitations() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_org_invitations() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_org_invitations() TO authenticated;

COMMENT ON FUNCTION public.get_my_org_invitations() IS
  'Invitations d''entreprise en attente pour l''utilisateur courant, avec le '
  'nom de l''organisation et de l''inviteur. SECURITY DEFINER parce que le '
  'nom d''une organisation n''est pas lisible par un non-membre. Périmètre '
  'dérivé de auth.uid() seul — aucun paramètre.';
