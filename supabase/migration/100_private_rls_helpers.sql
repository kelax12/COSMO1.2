-- ═══════════════════════════════════════════════════════════════════
-- 100_private_rls_helpers.sql — ferme la fuite inter-organisations
--
-- PROBLÈME (mesuré en prod le 2026-08-14, PoC dans faille.md)
-- Les helpers qui portent la RLS du mode entreprise sont SECURITY DEFINER —
-- donc « sans RLS » — ET exposés comme RPC PostgREST à tout utilisateur
-- authentifié. Aucun ne vérifie que l'appelant appartient à l'organisation
-- passée en argument. Un utilisateur extérieur obtenait :
--   get_subtree(<org étrangère>, <root>)      -> 8 UUID de membres
--   org_admin_count(<org étrangère>)          -> 1
--   has_subordinates(<org étrangère>, <tiers>)-> true
-- alors que la lecture directe de organization_members renvoyait bien 0 ligne.
-- Scénario réel : un membre exclu connaît l'UUID de l'organisation et garde
-- indéfiniment la capacité d'énumérer ses membres.
--
-- POURQUOI PAS UNE GARDE DANS LA FONCTION
-- `claim_org_invite` appelle get_subtree ET has_subordinates alors que
-- l'appelant n'est PAS ENCORE membre (il est en train de rejoindre). Une garde
-- `is_org_member(p_org)` casserait l'invitation d'entreprise — le seul canal
-- d'acquisition qui convertit (7 acceptées sur 8).
--
-- POURQUOI UN REVOKE SUFFIT
-- Dans une fonction SECURITY DEFINER, le rôle effectif est le PROPRIÉTAIRE :
-- les appels internes (claim_org_invite, can_access_team_project…) continuent
-- donc de fonctionner après un REVOKE sur `authenticated`. Seuls les appels
-- DIRECTS depuis une policy s'évaluent avec le rôle courant — et il n'y en a
-- que deux, traités ci-dessous.
--
-- CE QUI RESTE EXÉCUTABLE, ET POURQUOI C'EST SANS FUITE
-- `is_above(p_org, p_user)` se réduit à « p_user est-il dans le sous-arbre
-- sous MOI ? » : son périmètre est borné par auth.uid(). Sur une organisation
-- étrangère, mon sous-arbre est vide, donc la réponse est toujours `false`.
-- Idem pour le nouveau `i_have_subordinates(p_org)`, qui force auth.uid().
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Variante sans paramètre utilisateur, pour la policy d'invitation ────
-- Répond uniquement « AI-JE des subordonnés dans cette org ? ». Ne peut donc
-- pas servir à sonder la hiérarchie d'un tiers.
CREATE OR REPLACE FUNCTION public.i_have_subordinates(p_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE org_id = p_org AND manager_id = (SELECT auth.uid())
  );
$function$;

REVOKE ALL ON FUNCTION public.i_have_subordinates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.i_have_subordinates(uuid) TO authenticated;

-- ── 2. Les deux policies qui appelaient un helper directement ──────────────
-- `org_team_members_insert` : `user_id IN (SELECT get_subtree(org_id, auth.uid()))`
-- est STRICTEMENT équivalent à `is_above(org_id, user_id)` — c'est la
-- définition même de is_above. Sémantique préservée à l'identique.
DROP POLICY IF EXISTS org_team_members_insert ON public.org_team_members;
CREATE POLICY org_team_members_insert ON public.org_team_members
  FOR INSERT
  WITH CHECK (
    public.can_manage_team(team_id)
    AND (
      public.is_org_admin(org_id)
      OR user_id = (SELECT auth.uid())
      OR public.is_above(org_id, user_id)
    )
  );

-- `org_invite_links_insert` : `has_subordinates(org_id, auth.uid())` devient
-- `i_have_subordinates(org_id)` — même question, sans le paramètre qui
-- permettait de sonder un tiers.
DROP POLICY IF EXISTS org_invite_links_insert ON public.org_invite_links;
CREATE POLICY org_invite_links_insert ON public.org_invite_links
  FOR INSERT
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND expires_at <= (now() + '7 days'::interval)
    AND claimed_at IS NULL
    AND claimed_by IS NULL
    AND (
      public.is_org_admin(org_id)
      OR (
        manager_id IS NOT NULL
        AND public.i_have_subordinates(org_id)
        AND (manager_id = (SELECT auth.uid()) OR public.is_above(org_id, manager_id))
      )
    )
  );

-- ── 3. Retrait des trois helpers de l'API exposée ─────────────────────────
-- Plus aucun appel direct depuis une policy après l'étape 2. Les appels
-- internes passent par le propriétaire et ne sont pas affectés.
REVOKE EXECUTE ON FUNCTION public.get_subtree(uuid, uuid)        FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.has_subordinates(uuid, uuid)   FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.org_admin_count(uuid)          FROM authenticated, anon;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- VÉRIFICATION APRÈS APPLICATION (lecture seule, à jouer en prod)
--
-- 1. Les trois helpers ne sont plus appelables par un utilisateur connecté :
--
-- select proname,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') as exposee
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and proname in ('get_subtree','has_subordinates','org_admin_count');
-- -- attendu : exposee = false pour les trois
--
-- 2. L'invitation d'entreprise fonctionne toujours (le flux critique) :
--    créer un lien d'invitation depuis l'UI en tant que manager non-admin,
--    puis le réclamer avec un autre compte. C'est le chemin qui utilise
--    claim_org_invite -> get_subtree/has_subordinates en interne.
--
-- 3. Le PoC de fuite ne passe plus. Depuis un compte membre d'une SEULE
--    organisation, viser une organisation étrangère :
--
-- begin;
-- set local role authenticated;
-- set local request.jwt.claims = '{"sub":"<uuid membre org A>","role":"authenticated"}';
-- select * from public.get_subtree('<uuid org B>', '<uuid membre org B>');
-- -- attendu : ERROR permission denied for function get_subtree
-- rollback;
-- ═══════════════════════════════════════════════════════════════════
