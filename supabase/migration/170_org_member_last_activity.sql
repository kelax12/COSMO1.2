-- ═══════════════════════════════════════════════════════════════════
-- 170_org_member_last_activity.sql — « derniere activite » d'un membre
-- dans l'annuaire d'entreprise et sa fiche (audit passage a l'echelle,
-- 2026-09-23)
-- ═══════════════════════════════════════════════════════════════════
--
-- LE BESOIN. A cent membres, un admin ne sait plus qui travaille encore dans
-- l'organisation : l'annuaire n'affiche qu'un nom, un e-mail et un role. La
-- question « cette personne est-elle encore active ici ? » n'a aucune reponse.
--
-- CE QUE « ACTIVITE » VEUT DIRE ICI, ET RIEN D'AUTRE. La date la plus recente
-- parmi trois traces de TRAVAIL D'EQUIPE, toutes deja stockees :
--   1. une entree de `team_task_activity` dont il est l'auteur (mig. 094) ;
--   2. un commentaire qu'il a poste sur une tache d'equipe (mig. 082) ;
--   3. une tache d'equipe terminee qui lui etait assignee (`completed_at`).
--
-- ❌ JAMAIS `auth.users.last_sign_in_at`. C'est une donnee d'AUTHENTIFICATION
-- (traitement T1 du registre), pas une donnee de travail (T4). La lire ici
-- ferait d'un annuaire d'entreprise un outil de surveillance des connexions,
-- hors du traitement declare, et renseignerait un manager sur ce qu'un membre
-- fait de son compte PERSONNEL. On ne rend que ce que le travail d'equipe
-- montre deja a qui a le droit de le voir.
--
-- ── QUI PEUT LIRE QUOI ──────────────────────────────────────────────
--
-- Un admin de l'organisation : tous les membres. Un manager : son sous-arbre
-- STRICT (get_subtree), jamais ses pairs ni sa hierarchie. Un membre sans
-- subordonne : personne. C'est EXACTEMENT la regle des onglets « Taches » et
-- « Contribution » de la fiche membre (`isAbove` cote client), qui exposent
-- deja bien plus que cette date.
--
-- La fonction rend une ligne par membre DANS le perimetre, `last_activity_at`
-- valant NULL quand il n'y a aucune trace. Un membre hors perimetre est
-- ABSENT : le client distingue ainsi « rien a montrer » de « pas le droit ».
--
-- ── POURQUOI `SECURITY DEFINER` ─────────────────────────────────────
--
-- Pour la meme raison que `get_my_team_tasks` (mig. 113) et
-- `my_org_badge_tasks` (mig. 142) : `get_subtree` a `EXECUTE` revoque a
-- `authenticated` (mig. 100), le role effectif doit etre le proprietaire.
--
-- Ce n'est PAS une RPC d'agregat au sens de la mig. 129 : elle ne rassemble
-- pas N lectures portant chacune sa propre autorisation. Elle porte UNE
-- autorisation, hierarchique, posee en tete (`scope`), et ne rend qu'un
-- horodatage par personne, jamais une ligne de tache, un nom de projet ou un
-- commentaire. Un manager qui ne voit pas le projet ou son subordonne a
-- travaille apprend qu'il a travaille, pas sur quoi.
--
-- ⚠️ Invariants (ceux de get_my_team_tasks) :
--   • `p_org` est un FILTRE, jamais le perimetre. Le perimetre vient de
--     `auth.uid()` seul : un `p_org` ou l'appelant n'est pas membre rend 0 ligne.
--   • `auth.uid() IS NULL` → aucune ligne.
--   • `SET search_path = ''`, aucun SQL dynamique.
--   • EXECUTE revoque a PUBLIC et a anon, accorde au seul `authenticated`.
--
-- ── INDEXABLE ───────────────────────────────────────────────────────
--
-- Une recherche par personne, bornee a une ligne (`ORDER BY … LIMIT 1`) :
--   • activite   → nouvel index (actor_id, org_id, created_at DESC) ;
--   • commentaire → nouvel index (author_id, created_at DESC), puis la tache
--                   par sa cle primaire pour le filtre d'organisation ;
--   • completion  → idx_team_tasks_assignees (GIN, mig. 072), existant.
-- Le sous-arbre est materialise UNE fois (CTE `scope`), jamais par ligne.
-- ═══════════════════════════════════════════════════════════════════

-- `idx_team_task_activity_actor` (actor_id seul, mig. 094c) reste en place :
-- il sert la cascade `ON DELETE SET NULL` de la suppression de compte, et le
-- retirer n'est pas l'objet de cette migration.
CREATE INDEX IF NOT EXISTS idx_team_task_activity_actor_org_recent
  ON public.team_task_activity (actor_id, org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_team_task_comments_author_recent
  ON public.team_task_comments (author_id, created_at DESC);


CREATE OR REPLACE FUNCTION public.get_org_member_last_activity(p_org UUID)
RETURNS TABLE (
  user_id UUID,
  last_activity_at TIMESTAMPTZ,
  source TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  WITH me AS (
    -- Index Scan sur la cle primaire (org_id, user_id).
    SELECT om.role
    FROM public.organization_members om
    WHERE om.org_id = p_org
      AND om.user_id = (select auth.uid())
      AND (select auth.uid()) IS NOT NULL
  ),
  scope AS (
    -- Admin : toute l'organisation.
    SELECT m.user_id
    FROM public.organization_members m
    WHERE m.org_id = p_org
      AND EXISTS (SELECT 1 FROM me WHERE me.role = 'admin')
    UNION
    -- Manager : son sous-arbre strict, evalue UNE fois. Le garde EXISTS(me)
    -- evite de payer la CTE recursive pour un p_org etranger.
    SELECT s.user_id
    FROM (SELECT public.get_subtree(p_org, (select auth.uid())) AS user_id) s
    WHERE EXISTS (SELECT 1 FROM me)
  )
  SELECT sc.user_id, latest.at, latest.source
  FROM scope sc
  LEFT JOIN LATERAL (
    SELECT u.at, u.source
    FROM (
      (SELECT a.created_at AS at, 'activity'::text AS source
         FROM public.team_task_activity a
        WHERE a.actor_id = sc.user_id
          AND a.org_id = p_org
        ORDER BY a.created_at DESC
        LIMIT 1)
      UNION ALL
      (SELECT c.created_at, 'comment'::text
         FROM public.team_task_comments c
         JOIN public.team_tasks t ON t.id = c.task_id
        WHERE c.author_id = sc.user_id
          AND t.org_id = p_org
        ORDER BY c.created_at DESC
        LIMIT 1)
      UNION ALL
      (SELECT t.completed_at, 'completion'::text
         FROM public.team_tasks t
        WHERE t.assignee_ids @> ARRAY[sc.user_id]
          AND t.org_id = p_org
          AND t.completed_at IS NOT NULL
        ORDER BY t.completed_at DESC
        LIMIT 1)
    ) u
    ORDER BY u.at DESC
    LIMIT 1
  ) latest ON true;
$fn$;

REVOKE ALL ON FUNCTION public.get_org_member_last_activity(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_org_member_last_activity(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_org_member_last_activity(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_org_member_last_activity(UUID) IS
  'Derniere trace de travail d equipe (activite de tache, commentaire, tache '
  'assignee terminee) de chaque membre dans le perimetre de l appelant : toute '
  'l organisation pour un admin, le sous-arbre strict pour un manager, personne '
  'sinon (mig. 170). Jamais auth.users.last_sign_in_at. SECURITY DEFINER '
  'uniquement pour appeler get_subtree, dont EXECUTE est revoque a '
  'authenticated. p_org est un filtre, pas une portee.';


-- ═══════════════════════════════════════════════════════════════════
-- Verification — a executer APRES application
-- ═══════════════════════════════════════════════════════════════════
--
-- a) Les droits attendus :
--
--   select p.proname,
--          has_function_privilege('anon',          p.oid, 'EXECUTE') as anon,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth,
--          p.prosecdef, p.proconfig
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'get_org_member_last_activity';
--
--   Attendu : anon f, auth t, prosecdef t, proconfig {search_path=""}.
--
-- b) Le perimetre, acteur par acteur, EN TRANSACTION ANNULEE, sous le role
--    `authenticated` avec `request.jwt.claims` pose sur chacun :
--
--   • admin de l'org       → une ligne par membre de l'org (count = membres) ;
--   • manager non admin    → exactement get_subtree(org, lui), sans lui-meme ;
--   • membre sans subordonne → 0 ligne ;
--   • compte d'une AUTRE org, p_org forge → 0 ligne ;
--   • anon                 → permission denied.
--
-- c) Le plan, a CHAUD (un premier EXPLAIN a froid mesure le cache) :
--
--   explain (analyze, buffers) select * from public.get_org_member_last_activity('<org>');
--
--   Attendu : Index Scan sur idx_team_task_activity_actor_org_recent et
--   idx_team_task_comments_author_recent, Bitmap Index Scan sur
--   idx_team_tasks_assignees ; aucun Seq Scan sur team_task_activity.
