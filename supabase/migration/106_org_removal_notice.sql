-- ═══════════════════════════════════════════════════════════════════
-- Migration 106 — Être retiré d'une entreprise se dit
--
-- CONSTAT
-- `remove_member` (mig. 066, puis 104) supprime la ligne, re-parente les
-- subordonnés, purge les équipes… et ne prévient personne. Côté membre exclu,
-- l'entreprise disparaît simplement de la navigation entre deux chargements.
-- Rien ne distingue « on m'a retiré » d'un bug de l'application.
--
-- CE QU'ON RÉUTILISE, ET POURQUOI ÇA MARCHE ICI
-- `org_notifications` (mig. 095) semble réservée aux membres, mais sa policy
-- SELECT est `user_id = auth.uid()` — PAS `is_org_member`. Un ex-membre peut
-- donc toujours lire les siennes. C'est exactement la propriété dont on a
-- besoin, et c'est ce qui évite d'inventer une table de plus.
--
-- Ce qui manque en revanche : le NOM de l'organisation. `organizations_select`
-- est réservée aux membres, donc l'ex-membre lit son id sans pouvoir le
-- nommer. D'où la RPC SECURITY DEFINER en fin de fichier.
--
-- DÉCISIONS
--   • Seul `remove_member` notifie. `leave_organization` non : on n'annonce
--     pas à quelqu'un une décision qu'il vient de prendre lui-même.
--   • `actor_id` = l'admin qui retire. La table le permet déjà, et savoir QUI
--     a retiré change la lecture de l'événement.
--   • Aucune policy d'écriture ajoutée : `remove_member` est SECURITY DEFINER,
--     elle insère sans passer par la RLS. Le client, lui, ne peut que lire,
--     marquer lue et supprimer la sienne — inchangé depuis la 095.
-- ═══════════════════════════════════════════════════════════════════


-- ─── 1 · Nouveau genre de notification ──────────────────────────────
-- La contrainte est remplacée, pas étendue en place : Postgres n'a pas de
-- « ALTER CHECK ». Les trois genres existants sont conservés à l'identique.

ALTER TABLE public.org_notifications
  DROP CONSTRAINT IF EXISTS org_notifications_kind_check;

ALTER TABLE public.org_notifications
  ADD CONSTRAINT org_notifications_kind_check
  CHECK (kind IN ('task_assigned', 'mention', 'task_overdue', 'org_removed'));


-- ─── 2 · remove_member notifie l'exclu ──────────────────────────────
-- Corps de la mig. 104 (purge des équipes incluse) + l'insertion de la
-- notification. Elle est faite AVANT le DELETE de la ligne membre : après,
-- `is_org_member` serait faux, et un futur garde d'écriture sur la table
-- rejetterait l'insertion. L'ordre est donc une précaution, pas un hasard.

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

  -- Les appartenances d'équipe partent avec le membre (mig. 104).
  DELETE FROM public.org_team_members
  WHERE org_id = p_org AND user_id = p_user;

  -- NOUVEAU (mig. 106) : l'exclu est prévenu, et par qui.
  INSERT INTO public.org_notifications (org_id, user_id, actor_id, kind)
  VALUES (p_org, p_user, auth.uid(), 'org_removed');

  DELETE FROM public.organization_members
  WHERE org_id = p_org AND user_id = p_user;

  -- Le membre retiré redevient particulier SEULEMENT s'il n'a plus aucune org.
  IF NOT EXISTS (SELECT 1 FROM public.organization_members WHERE user_id = p_user) THEN
    UPDATE public.profiles SET account_type = 'personal' WHERE id = p_user;
  END IF;
END;
$$;


-- ─── 3 · Lecture par l'ex-membre, avec le nom de l'organisation ─────
-- SECURITY DEFINER pour la seule raison décrite en tête : `organizations` est
-- illisible pour un non-membre, et c'est précisément notre lecteur ici.
-- Périmètre dérivé de auth.uid() seul, aucun paramètre à forger.

CREATE OR REPLACE FUNCTION public.get_my_org_removal_notices()
RETURNS TABLE (
  id         UUID,
  org_id     UUID,
  org_name   TEXT,
  actor_name TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    n.id,
    n.org_id,
    o.name,
    COALESCE(p.display_name, split_part(p.email, '@', 1)),
    n.created_at
  FROM public.org_notifications n
  JOIN public.organizations o ON o.id = n.org_id
  LEFT JOIN public.profiles p ON p.id = n.actor_id
  WHERE auth.uid() IS NOT NULL
    AND n.user_id = auth.uid()
    AND n.kind = 'org_removed'
    AND n.read_at IS NULL
  ORDER BY n.created_at DESC
  LIMIT 20;
$$;

REVOKE ALL ON FUNCTION public.get_my_org_removal_notices() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_org_removal_notices() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_org_removal_notices() TO authenticated;

COMMENT ON FUNCTION public.get_my_org_removal_notices() IS
  'Retraits d''entreprise non acquittés pour l''utilisateur courant, avec le '
  'nom de l''organisation et de l''auteur du retrait. SECURITY DEFINER parce '
  'qu''un ex-membre ne peut plus lire `organizations`.';
