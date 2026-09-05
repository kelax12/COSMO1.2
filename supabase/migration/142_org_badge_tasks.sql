-- ═══════════════════════════════════════════════════════════════════
-- 142_org_badge_tasks.sql — la pastille d'entreprise cesse de lire
-- jusqu'a 1 000 taches d'equipe pour afficher un nombre (finding C-05)
-- ═══════════════════════════════════════════════════════════════════
--
-- CE QUI SE PASSAIT. `Layout` monte `useOrgBadges`, donc sur TOUTES les pages
-- protegees, pour tout membre d'une organisation. Ce hook n'affiche aucune
-- liste : il en derive un chiffre et quatre libelles d'apercu. Il montait
-- pourtant `useTeamTasks`, c'est-a-dire `get_my_team_tasks(p_org)` suivi d'un
-- `.limit(1000)` — la lecture la plus chere du produit (SCALABILITY.md §2).
--
-- Le RECHARGEMENT avait ete coupe le 2026-08-27 (`useTeamTasks` a gagne
-- `background`), la LECTURE pas : elle partait toujours au premier montage,
-- sur chaque chargement d'application.
--
-- CE QUE LE CLIENT A REELLEMENT BESOIN DE SAVOIR, et rien d'autre :
--
--   1. les taches d'equipe NON TERMINEES qui me sont assignees et que je n'ai
--      pas creees moi-meme (s'auto-assigner ne notifie pas) — le comptage
--      derive, filet pour les organisations d'avant la mig. 095 ;
--   2. le NOM des taches visees par mes notifications non lues, pour que
--      l'apercu puisse nommer ce qu'il compte.
--
-- Les deux tiennent en quelques lignes. La borne `lastSeen` reste cote client :
-- elle vit dans `localStorage`, la base ne la connait pas, et lui passer un
-- horodatage en parametre aurait fait dependre la cle de cache d'une valeur qui
-- bouge a chaque visite de /entreprise.
--
-- ── POURQUOI CETTE FONCTION EST `SECURITY DEFINER` ──────────────────
--
-- ❌ Elle ne reecrit AUCUNE autorisation. Le perimetre est
-- `my_team_project_ids(org)` — exactement le predicat de
-- `can_access_team_project`, exprime en jointures indexables (mig. 113) —
-- appele une fois PAR ORGANISATION, jamais par ligne. C'est l'expression
-- d'autorisation deja utilisee par `get_my_team_tasks`, reprise telle quelle
-- avec deux filtres de plus.
--
-- Elle doit etre DEFINER pour la meme raison que `get_my_team_tasks` :
-- `my_team_project_ids` a `EXECUTE` revoque a `authenticated` (mig. 100/113),
-- le role effectif doit donc etre le proprietaire.
--
-- 🔴 La RPC d'agregat, elle, reste `SECURITY INVOKER` : `get_my_org_inbox()`
-- ne change pas de nature, elle APPELLE cette fonction comme elle appelle deja
-- `get_my_org_invitations` et `get_my_org_removal_notices`. C'est la regle
-- posee par la mig. 129 : agreger des lectures, oui ; agreger des
-- autorisations, jamais.
--
-- ── AUCUN PARAMETRE ─────────────────────────────────────────────────
--
-- Le perimetre vient de `auth.uid()` seul, comme toute la boite de reception.
-- Un `p_org` obligerait le client a attendre que l'organisation active soit
-- resolue, ce que la mig. 129 refuse explicitement.
--
-- ── BORNES ──────────────────────────────────────────────────────────
--
-- 200 assignations et 50 taches notifiees PAR ORGANISATION (window function),
-- jamais globalement : une borne globale tronquerait la troisieme organisation
-- d'un compte avec les lignes des deux premieres, et ca ne se verrait que chez
-- lui. C'est la regle de la mig. 129, appliquee ici aussi.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.my_org_badge_tasks()
RETURNS TABLE (
  org_id UUID,
  id UUID,
  name TEXT,
  created_at TIMESTAMPTZ,
  kind TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  WITH my_orgs AS (
    -- Index Scan sur idx_org_members_user_id.
    SELECT om.org_id
    FROM public.organization_members om
    WHERE om.user_id = (select auth.uid())
      AND (select auth.uid()) IS NOT NULL
  ),
  -- LE point du correctif : le sous-arbre managerial est materialise UNE fois
  -- par organisation (mig. 113), pas une fois par ligne de team_tasks.
  visible_projects AS (
    SELECT o.org_id, p.project_id
    FROM my_orgs o
    CROSS JOIN LATERAL (
      SELECT public.my_team_project_ids(o.org_id) AS project_id
    ) p
  ),
  -- 1) Assignations en cours qui ne viennent pas de moi. Le filtre
  --    `assignee_ids @> ARRAY[uid]` est servi par idx_team_tasks_assignees (GIN).
  assigned AS (
    SELECT t.org_id, t.id, t.name, t.created_at, 'assigned'::text AS kind,
           row_number() OVER (PARTITION BY t.org_id ORDER BY t.created_at DESC) AS rn
    FROM public.team_tasks t
    JOIN visible_projects vp
      ON vp.org_id = t.org_id AND vp.project_id = t.project_id
    WHERE t.completed = false
      AND t.assignee_ids @> ARRAY[(select auth.uid())]
      AND t.created_by IS DISTINCT FROM (select auth.uid())
  ),
  -- 2) Taches visees par mes notifications NON LUES. Elles peuvent etre
  --    terminees ou creees par moi : ce sont des libelles d'apercu, pas un
  --    comptage. Sans elles, la pastille afficherait un nombre qu'aucune liste
  --    ne peut expliquer.
  unread_task_ids AS (
    SELECT DISTINCT n.task_id
    FROM public.org_notifications n
    WHERE n.user_id = (select auth.uid())
      AND (select auth.uid()) IS NOT NULL
      AND n.read_at IS NULL
      AND n.task_id IS NOT NULL
  ),
  notified AS (
    SELECT t.org_id, t.id, t.name, t.created_at, 'notified'::text AS kind,
           row_number() OVER (PARTITION BY t.org_id ORDER BY t.created_at DESC) AS rn
    FROM public.team_tasks t
    JOIN visible_projects vp
      ON vp.org_id = t.org_id AND vp.project_id = t.project_id
    WHERE t.id IN (SELECT u.task_id FROM unread_task_ids u)
  )
  SELECT a.org_id, a.id, a.name, a.created_at, a.kind
  FROM assigned a WHERE a.rn <= 200
  UNION ALL
  SELECT n.org_id, n.id, n.name, n.created_at, n.kind
  FROM notified n WHERE n.rn <= 50;
$fn$;

REVOKE ALL ON FUNCTION public.my_org_badge_tasks() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_org_badge_tasks() FROM anon;
GRANT EXECUTE ON FUNCTION public.my_org_badge_tasks() TO authenticated;

COMMENT ON FUNCTION public.my_org_badge_tasks() IS
  'Les seules taches d equipe dont la pastille d entreprise a besoin (mig. 142) : '
  'assignations en cours qui ne viennent pas de moi, et taches visees par mes '
  'notifications non lues. Remplace une lecture org-wide de team_tasks montee '
  'par Layout sur toutes les pages protegees. Aucun parametre : le perimetre '
  'vient de auth.uid() seul. SECURITY DEFINER uniquement pour appeler '
  'my_team_project_ids, dont EXECUTE est revoque a authenticated : '
  'l autorisation est celle de get_my_team_tasks, inchangee.';


-- ═══════════════════════════════════════════════════════════════════
-- La boite de reception gagne une section, et rien d'autre ne bouge
-- ═══════════════════════════════════════════════════════════════════
--
-- Le corps ci-dessous est celui de la mig. 129, a l'identique, plus la section
-- `badge_tasks`. La fonction reste `SECURITY INVOKER` : les sections qui ont
-- besoin de privileges eleves DELEGUENT, elles ne reecrivent rien.
CREATE OR REPLACE FUNCTION public.get_my_org_inbox()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $fn$
WITH me AS MATERIALIZED (
  SELECT (SELECT auth.uid()) AS uid
),
-- Ma demande d'adhesion en attente. `user_id = uid` est un filtre METIER,
-- pas un doublon de la RLS : cf. l'en-tete de la mig. 129.
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
  ), '[]'::jsonb),

  -- Section ajoutee par la mig. 142 : de quoi peindre la pastille sans lire la
  -- liste des taches d'equipe.
  'badge_tasks', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'org_id', b.org_id,
             'id', b.id,
             'name', b.name,
             'created_at', b.created_at,
             'kind', b.kind
           ) ORDER BY b.org_id, b.created_at DESC)
    FROM public.my_org_badge_tasks() b
  ), '[]'::jsonb)
);
$fn$;

COMMENT ON FUNCTION public.get_my_org_inbox() IS
  'Boite de reception d''entreprise en une lecture (mig. 129, etendue par la '
  '142) : invitations, avis de retrait, ma demande d''adhesion, demandes recues '
  'cote admin, notifications, et les taches dont la pastille a besoin. '
  'SECURITY INVOKER : la RLS de l''appelant s''applique, et les sections '
  'privilegiees delegent aux fonctions DEFINER existantes. Aucun parametre : le '
  'perimetre vient de auth.uid() seul.';

REVOKE ALL ON FUNCTION public.get_my_org_inbox() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_org_inbox() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_org_inbox() TO authenticated;


-- ═══════════════════════════════════════════════════════════════════
-- Verification — a executer APRES application
-- ═══════════════════════════════════════════════════════════════════
--
-- a) Les droits attendus (le helper de la 113 reste ferme) :
--
--   select p.proname,
--          has_function_privilege('anon',          p.oid, 'EXECUTE') as anon,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('my_team_project_ids','my_org_badge_tasks','get_my_org_inbox');
--
--   Attendu : my_team_project_ids f / f
--             my_org_badge_tasks  f / t
--             get_my_org_inbox    f / t
--
-- b) PARITE — le nombre affiche ne doit pas bouger. Pour un compte donne, et
--    pour CHACUNE de ses organisations, l'ensemble des assignations derivees
--    doit etre le meme qu'avant, c'est-a-dire celui que le client calculait
--    depuis get_my_team_tasks :
--
--   select array_agg(t.id order by t.id) as avant
--     from public.get_my_team_tasks('<org>') t
--    where t.completed = false
--      and t.assignee_ids @> array[auth.uid()]
--      and t.created_by is distinct from auth.uid();
--
--   select array_agg(b.id order by b.id) as apres
--     from public.my_org_badge_tasks() b
--    where b.org_id = '<org>' and b.kind = 'assigned';
--
--   Attendu : deux tableaux IDENTIQUES. A jouer sous le role de l'utilisateur,
--   jamais en service_role : la question porte sur ce que LUI voit.
--
-- c) L'isolation est inchangee — un compte qui n'est membre d'aucune
--    organisation ne voit rien, et personne ne voit la tache d'une
--    organisation etrangere :
--
--   select count(*) from public.my_org_badge_tasks();
--   Attendu : 0 pour un compte sans organisation.
