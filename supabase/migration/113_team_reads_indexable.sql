-- ═══════════════════════════════════════════════════════════════════
-- Migration 113 — lectures entreprise indexables (SCALABILITY.md §2)
--
-- CONTEXTE — le finding principal de l'audit de scalabilité du 2026-08-14,
-- mesuré en prod et jamais corrigé depuis.
--
-- Les policies du mode entreprise filtrent par un appel de fonction sur une
-- COLONNE de la ligne :
--
--   CREATE POLICY team_tasks_select ... USING (can_access_team_project(project_id))
--
-- Un prédicat de cette forme ne peut être servi par AUCUN index : Postgres lit
-- toute la table et évalue la fonction pour chaque ligne. Et
-- `can_access_team_project` n'est pas bon marché — par ligne, elle enchaîne
-- `is_org_member` + `is_org_admin` + un EXISTS sur `org_team_members` +
-- `get_subtree()`, qui est une CTE RÉCURSIVE sur `organization_members`.
--
-- Mesuré en prod le 2026-08-14, plans à chaud, rôle `authenticated` :
--
--   select * from team_tasks     Seq Scan + Filter  26 buffers / 1,49 ms / 7 lignes
--   select * from team_projects  Seq Scan + Filter  17 buffers / 1,09 ms / 4 lignes
--   select * from tasks (perso)  Seq Scan + OR      47 buffers / 0,53 ms / 710 lignes
--
-- Soit ≈ 60× le coût PAR LIGNE du prédicat personnel. Confirmation
-- indépendante par les compteurs cumulés : `organization_members` totalise
-- 1 144 966 seq_scan pour 11 lignes — c'est la fréquence d'appel des helpers,
-- pas un problème de plan. Projection linéaire : ~210 ms à 1 000 tâches
-- d'équipe, ~2,1 s à 10 000.
--
-- C'est EXACTEMENT la classe de bug corrigée pour `tasks` par la mig. 085,
-- reproduite sur les tables entreprise. Le correctif est le même, et il est
-- éprouvé : exprimer l'appartenance en JOINTURE INDEXABLE dans une RPC dédiée,
-- et laisser les policies en place en défense en profondeur.
--
-- CE QUI CHANGE, ET CE QUI NE CHANGE PAS
--   • Aucune policy n'est touchée. Les accès directs à la table restent
--     protégés exactement comme avant. Le déploiement est donc réversible sans
--     downtime : l'ancien client continue de fonctionner.
--   • Les index nécessaires EXISTENT DÉJÀ (idx_org_members_user_id,
--     idx_org_team_members_user, idx_org_team_members_org,
--     idx_team_projects_org, idx_team_projects_team, idx_team_tasks_project).
--     Le problème n'a jamais été l'indexation des tables d'appartenance, c'est
--     que la FORME du prédicat interdit d'utiliser un index sur la table lue.
--
-- L'IDÉE DU CORRECTIF, en une phrase : `get_subtree()` est appelée UNE fois
-- par organisation au lieu d'une fois par ligne lue. Le reste suit.
-- ═══════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════
-- 1) Helper — les projets d'une organisation que J'AI le droit de voir
-- ═══════════════════════════════════════════════════════════════════
--
-- Ré-implémente à la lettre le prédicat de `can_access_team_project`, mais en
-- trois branches UNION que le planificateur sait indexer, et avec le
-- sous-arbre managérial matérialisé une seule fois.
--
-- ⚠️ Invariants de sécurité (identiques à ceux de `get_my_tasks`, mig. 085) :
--   • `p_org` est un FILTRE, jamais le périmètre. Le périmètre vient
--     uniquement de `auth.uid()` : les trois branches exigent toutes une
--     appartenance de l'appelant. Forger un `p_org` étranger renvoie 0 ligne.
--   • `auth.uid() IS NULL` → aucune ligne (anon ne peut rien lire).
--   • `SET search_path = ''` — pas de détournement par un schéma utilisateur.
--   • EXECUTE révoqué à PUBLIC, anon ET authenticated : ce helper n'est appelé
--     que depuis les deux fonctions ci-dessous, qui sont SECURITY DEFINER —
--     le rôle effectif y est le PROPRIÉTAIRE, l'appel passe donc. C'est le
--     motif posé par la mig. 100 (ne pas exposer un helper en RPC), et il est
--     tenable ici précisément parce qu'AUCUNE policy ne cite cette fonction
--     (une policy s'évalue avec le rôle courant — c'est ce qui a cassé la
--     mig. 107, finding B-1).
CREATE OR REPLACE FUNCTION public.my_team_project_ids(p_org UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH my_membership AS (
    -- Index Scan sur idx_org_members_user_id (ou le pkey (org_id, user_id)).
    SELECT om.role
    FROM public.organization_members om
    WHERE om.user_id = (select auth.uid())
      AND om.org_id = p_org
      AND (select auth.uid()) IS NOT NULL
  ),
  my_teams AS (
    -- Index Scan sur idx_org_team_members_user.
    SELECT tm.team_id
    FROM public.org_team_members tm
    WHERE tm.user_id = (select auth.uid())
      AND tm.org_id = p_org
      AND (select auth.uid()) IS NOT NULL
  ),
  my_subtree AS (
    -- LE point du correctif : la CTE récursive est évaluée UNE fois pour
    -- l'organisation, pas une fois par ligne de team_projects / team_tasks.
    -- Le garde `EXISTS (my_membership)` évite de la payer pour un p_org
    -- auquel l'appelant n'appartient pas.
    SELECT public.get_subtree(p_org, (select auth.uid())) AS user_id
    WHERE EXISTS (SELECT 1 FROM my_membership)
  ),
  subordinate_teams AS (
    -- Équipes où l'un de mes subordonnés est membre. Index Scan sur
    -- idx_org_team_members_org, joint sur un ensemble déjà matérialisé.
    SELECT DISTINCT tm.team_id
    FROM public.org_team_members tm
    JOIN my_subtree s ON s.user_id = tm.user_id
    WHERE tm.org_id = p_org
  )

  -- Branche 1 — projets d'ORGANISATION (team_id NULL) : tout membre.
  --   ≡ (p.team_id IS NULL AND is_org_member(p.org_id))
  SELECT p.id
  FROM public.team_projects p
  WHERE p.org_id = p_org
    AND p.team_id IS NULL
    AND EXISTS (SELECT 1 FROM my_membership)

  UNION

  -- Branche 2 — admin de l'organisation : tous les projets.
  --   ≡ is_org_admin(p.org_id)
  SELECT p.id
  FROM public.team_projects p
  WHERE p.org_id = p_org
    AND EXISTS (SELECT 1 FROM my_membership WHERE role = 'admin')

  UNION

  -- Branche 3 — projets des équipes dont je suis membre, ou dont un de mes
  -- subordonnés est membre. Index Scan sur idx_team_projects_team.
  --   ≡ EXISTS (org_team_members tm WHERE tm.team_id = p.team_id
  --             AND (tm.user_id = auth.uid()
  --                  OR tm.user_id IN (SELECT get_subtree(p.org_id, auth.uid()))))
  SELECT p.id
  FROM public.team_projects p
  WHERE p.org_id = p_org
    AND p.team_id IN (
      SELECT team_id FROM my_teams
      UNION
      SELECT team_id FROM subordinate_teams
    );
$$;

REVOKE ALL ON FUNCTION public.my_team_project_ids(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_team_project_ids(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.my_team_project_ids(UUID) FROM authenticated;

COMMENT ON FUNCTION public.my_team_project_ids(UUID) IS
  'Projets de p_org visibles par auth.uid(), en trois branches indexables. '
  'Equivaut a can_access_team_project mais evalue le sous-arbre managerial UNE '
  'fois par organisation au lieu d une fois par ligne. Helper interne : NON '
  'expose en RPC, appele uniquement depuis get_my_team_projects / '
  'get_my_team_tasks (SECURITY DEFINER, role effectif = proprietaire).';


-- ═══════════════════════════════════════════════════════════════════
-- 2) Lecture de liste — team_projects
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_my_team_projects(p_org UUID)
RETURNS SETOF public.team_projects
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.*
  FROM public.team_projects p
  WHERE p.org_id = p_org
    AND p.id IN (SELECT public.my_team_project_ids(p_org));
$$;

REVOKE ALL ON FUNCTION public.get_my_team_projects(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_team_projects(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_team_projects(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_my_team_projects(UUID) IS
  'Lecture indexable des projets d equipe visibles. Remplace un SELECT direct '
  'sur team_projects, dont la policy (can_access_team_project) force un Seq '
  'Scan + CTE recursive par ligne. Perimetre derive de auth.uid() ; p_org est '
  'un filtre, pas une portee.';


-- ═══════════════════════════════════════════════════════════════════
-- 3) Lecture de liste — team_tasks
-- ═══════════════════════════════════════════════════════════════════
--
-- Les filtres applicatifs (projet, assigné, statut) restent côté PostgREST :
-- `supabase.rpc('get_my_team_tasks', …).eq('project_id', …)` s'applique au
-- résultat de la fonction, exactement comme sur une table. Les remonter en
-- paramètres SQL aurait figé le contrat de l'écran dans la base.
CREATE OR REPLACE FUNCTION public.get_my_team_tasks(p_org UUID)
RETURNS SETOF public.team_tasks
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT t.*
  FROM public.team_tasks t
  WHERE t.org_id = p_org
    AND t.project_id IN (SELECT public.my_team_project_ids(p_org));
$$;

REVOKE ALL ON FUNCTION public.get_my_team_tasks(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_team_tasks(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_team_tasks(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_my_team_tasks(UUID) IS
  'Lecture indexable des taches d equipe visibles. Meme correctif que '
  'get_my_tasks (mig. 085) applique aux tables entreprise. Perimetre derive de '
  'auth.uid() ; p_org est un filtre, pas une portee.';


-- ═══════════════════════════════════════════════════════════════════
-- 4) Vérification — à exécuter APRÈS application
-- ═══════════════════════════════════════════════════════════════════
--
-- a) Les droits sont ceux attendus (le helper fermé, les deux RPC ouvertes
--    au seul rôle authenticated) :
--
--   select p.proname,
--          has_function_privilege('anon',          p.oid, 'EXECUTE') as anon,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('my_team_project_ids','get_my_team_projects','get_my_team_tasks');
--
--   Attendu : my_team_project_ids  f / f
--             get_my_team_projects f / t
--             get_my_team_tasks    f / t
--
-- b) Le plan est bien indexable (sous le rôle authenticated, à CHAUD — un
--    premier EXPLAIN à froid mesure le remplissage du cache, pas le plan ;
--    c'est la leçon de SCALABILITY.md §6) :
--
--   explain (analyze, buffers) select * from get_my_team_tasks('<org_uuid>');
--
--   Attendu : plus aucun `Filter: can_access_team_project(...)`, et des
--   Index Scan sur idx_team_tasks_project / idx_org_members_user_id.
--
-- c) L'isolation est INCHANGÉE — un membre d'une autre organisation ne voit
--    rien, et un p_org forgé ne donne rien :
--
--   select count(*) from get_my_team_tasks('<org_dont_je_ne_suis_pas_membre>');
--   Attendu : 0
