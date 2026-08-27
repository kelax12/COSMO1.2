-- ═══════════════════════════════════════════════════════════════════
-- 129_org_inbox_single_read.sql, la boite de reception d'entreprise en UNE
-- lecture au lieu de cinq
-- ═══════════════════════════════════════════════════════════════════
--
-- MESURE, 2026-08-27, edge_logs de production : le chargement de
-- l'application coute 25 requetes REST, dont HUIT pour le mode entreprise.
-- Cinq d'entre elles ne servent qu'a peindre une pastille de notification, et
-- elles partent depuis `Layout`, donc sur TOUTES les pages protegees, meme
-- quand aucun ecran entreprise n'est affiche :
--
--   rpc/get_my_org_invitations
--   rpc/get_my_org_removal_notices
--   organization_join_requests?user_id=eq.moi        (ma demande en attente)
--   organization_join_requests?org_id=eq.X           (vue admin)
--   org_notifications?org_id=eq.X
--   + profiles?id=in.(...)                           (conditionnelle, pour nommer
--                                                     les demandeurs)
--
-- `get_my_org_inbox()` les rend toutes ensemble, en un objet JSON.
--
-- ── AUCUN PARAMETRE, ET C'EST LE POINT ──────────────────────────────
--
-- Le perimetre vient de `auth.uid()` SEUL, comme `get_my_tasks` (mig. 085).
-- Prendre un `p_org` aurait oblige le client a attendre que l'organisation
-- active soit resolue avant de partir : on aurait echange quatre requetes
-- contre du delai, en serialisant ce qui partait en parallele. La fonction
-- rend donc les sections par organisation pour TOUTES mes organisations, et
-- le client filtre. Un compte appartient a une poignee d'organisations, et la
-- lecture est de toute facon bornee par organisation (voir plus bas).
--
-- ── SECURITY INVOKER, VOLONTAIREMENT ────────────────────────────────
--
-- 🔴 Agreger cinq lectures dans une fonction `SECURITY DEFINER` reviendrait a
-- reecrire cinq autorisations a la main, dans une fonction qui contourne la
-- RLS. C'est exactement la ou une agregation « de performance » devient une
-- fuite. Ici :
--
--   • les deux sections qui ONT besoin de privileges eleves ne sont pas
--     reecrites, elles APPELLENT les fonctions DEFINER existantes
--     (`get_my_org_invitations`, `get_my_org_removal_notices`), inchangees.
--     Elles existent parce qu'un invite, ou un ex-membre, ne peut plus lire
--     `organizations.name` ;
--   • les trois autres sections lisent leurs tables en direct, donc sous la
--     RLS de l'appelant, exactement comme le client le faisait.
--
-- Cette fonction n'ouvre donc AUCUN acces nouveau. Si une policy change
-- demain, elle suit.
--
-- ── CE QUI EST REPRODUIT A LA LETTRE ────────────────────────────────
--
--   • `my_join_request` : ma demande en attente la plus recente, ou null. Le
--     filtre `user_id = auth.uid()` est CONSERVE bien que la RLS l'autorise
--     deja par une branche : la policy est un OR avec `is_org_admin`, donc
--     sans ce filtre un admin verrait la demande d'un autre passer pour la
--     sienne. La RLS dit ce qu'on a le droit de lire, jamais ce qu'on veut
--     lire (lecon A-1, mig. 085).
--   • `join_requests` : la vue ADMIN, donc filtree par `is_org_admin(org_id)`
--     explicitement, avec le nom du demandeur resolu comme le faisait le
--     client (`display_name`, sinon la partie locale de l'email).
--   • les bornes par organisation sont celles d'avant : 200 demandes, 50
--     notifications, 50 invitations, 20 retraits. Elles sont appliquees PAR
--     ORGANISATION (window function) et non globalement : sans cela, un compte
--     membre de trois organisations verrait la troisieme tronquee par les deux
--     premieres, ce qui ne se serait vu que chez lui.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_my_org_inbox()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
WITH me AS MATERIALIZED (
  SELECT (SELECT auth.uid()) AS uid
),
-- Ma demande d'adhesion en attente. `user_id = uid` est un filtre METIER,
-- pas un doublon de la RLS : cf. l'en-tete.
mine AS (
  SELECT r.id, r.org_id, r.user_id, r.requested_at
  FROM organization_join_requests r, me
  WHERE r.user_id = me.uid
    AND r.accepted_at IS NULL
    AND r.rejected_at IS NULL
  ORDER BY r.requested_at DESC
  LIMIT 1
),
-- Vue admin : les demandes adressees aux organisations que j'administre.
admin_reqs AS (
  SELECT r.id, r.org_id, r.user_id, r.requested_at,
         row_number() OVER (PARTITION BY r.org_id ORDER BY r.requested_at ASC) AS rn
  FROM organization_join_requests r
  WHERE r.accepted_at IS NULL
    AND r.rejected_at IS NULL
    AND is_org_admin(r.org_id)
),
notifs AS (
  SELECT n.id, n.org_id, n.actor_id, n.kind, n.task_id, n.read_at, n.created_at,
         row_number() OVER (PARTITION BY n.org_id ORDER BY n.created_at DESC) AS rn
  FROM org_notifications n, me
  WHERE n.user_id = me.uid
)
SELECT jsonb_build_object(
  'invitations', COALESCE((
    SELECT jsonb_agg(to_jsonb(i) ORDER BY i.created_at DESC)
    FROM public.get_my_org_invitations() i
  ), '[]'::jsonb),

  'removal_notices', COALESCE((
    SELECT jsonb_agg(to_jsonb(n) ORDER BY n.created_at DESC)
    FROM public.get_my_org_removal_notices() n
  ), '[]'::jsonb),

  'my_join_request', (
    SELECT to_jsonb(m) FROM mine m
  ),

  'join_requests', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'id', a.id,
             'org_id', a.org_id,
             'user_id', a.user_id,
             'requested_at', a.requested_at,
             'requester_name', COALESCE(p.display_name, split_part(p.email, '@', 1)),
             'requester_email', p.email
           ) ORDER BY a.org_id, a.requested_at ASC)
    FROM admin_reqs a
    LEFT JOIN profiles p ON p.id = a.user_id
    WHERE a.rn <= 200
  ), '[]'::jsonb),

  'notifications', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'id', x.id,
             'org_id', x.org_id,
             'actor_id', x.actor_id,
             'kind', x.kind,
             'task_id', x.task_id,
             'read_at', x.read_at,
             'created_at', x.created_at
           ) ORDER BY x.org_id, x.created_at DESC)
    FROM notifs x
    WHERE x.rn <= 50
  ), '[]'::jsonb)
);
$$;

COMMENT ON FUNCTION public.get_my_org_inbox() IS
  'Boite de reception d''entreprise en une lecture (mig. 129) : invitations, '
  'avis de retrait, ma demande d''adhesion, demandes recues cote admin, '
  'notifications. SECURITY INVOKER : la RLS de l''appelant s''applique, et les '
  'deux sections privilegiees delegent aux fonctions DEFINER existantes. '
  'Aucun parametre : le perimetre vient de auth.uid() seul.';

REVOKE ALL ON FUNCTION public.get_my_org_inbox() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_org_inbox() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_org_inbox() TO authenticated;
