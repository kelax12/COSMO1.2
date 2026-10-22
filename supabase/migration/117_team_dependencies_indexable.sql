-- ═══════════════════════════════════════════════════════════════════
-- Migration 117 — `team_task_dependencies` : lecture indexable
--
-- CONTEXTE. La mig. 113 a rendu indexables les lectures de `team_projects` et
-- `team_tasks`. Elle laissait un trou, signalé à l'époque dans
-- `docs/SCALABILITY.md` §2bis : `team_task_dependencies` délègue son périmètre
-- à `team_tasks` et hérite donc du coût qu'on venait d'éliminer.
--
--   CREATE POLICY team_task_dependencies_select
--     USING (EXISTS (SELECT 1 FROM public.team_tasks t WHERE t.id = task_id));
--
-- Le `t.id = task_id` est bien servi par `team_tasks_pkey`, mais la
-- sous-requête déclenche la RLS de `team_tasks` sur la ligne trouvée : donc
-- UNE évaluation de `can_access_team_project(project_id)` par arête lue, et
-- avec elle une CTE RÉCURSIVE `get_subtree` sur `organization_members`.
--
-- Volume actuel : 0 ligne, donc invisible aujourd'hui. C'est précisément
-- pourquoi on le traite maintenant : une fois la table pleine, le symptôme
-- apparaît sur un écran (le graphe de dépendances) qui charge TOUTES les
-- arêtes d'un coup, avec un plafond client de 5 000.
--
-- CORRECTIF. Même motif que la mig. 113 : réutiliser `my_team_project_ids()`,
-- qui matérialise le sous-arbre managérial UNE fois par organisation, puis
-- joindre sur `team_tasks.project_id` (Index Scan `idx_team_tasks_project`).
--
-- CE QUI NE CHANGE PAS : les trois policies restent en place, inchangées.
-- Les accès directs à la table sont protégés exactement comme avant, et le
-- déploiement est réversible sans downtime.
--
-- ⚠️ La sémantique est reproduite À LA LETTRE : la policy SELECT exige de voir
-- la tâche BLOQUÉE (`task_id`), pas celle dont elle dépend. Ne pas « durcir »
-- en exigeant les deux : l'écran doit pouvoir afficher qu'une tâche visible
-- dépend d'une tâche qui ne l'est pas, sinon l'arête disparaît et le graphe
-- ment sur l'ordonnancement. C'est l'écriture (INSERT) qui exige les deux.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_my_team_task_dependencies(p_org UUID)
RETURNS SETOF public.team_task_dependencies
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT d.*
  FROM public.team_task_dependencies d
  JOIN public.team_tasks t ON t.id = d.task_id
  WHERE d.org_id = p_org
    AND t.project_id IN (SELECT public.my_team_project_ids(p_org));
$$;

REVOKE ALL ON FUNCTION public.get_my_team_task_dependencies(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_team_task_dependencies(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_team_task_dependencies(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_my_team_task_dependencies(UUID) IS
  'Lecture indexable des dependances de taches d equipe. Ferme le trou laisse '
  'par la mig. 113 (cf. SCALABILITY.md 2bis) : la policy delegue son perimetre '
  'a team_tasks et payait donc can_access_team_project PAR ARETE. Perimetre '
  'derive de auth.uid() ; p_org est un filtre, pas une portee.';

-- ═══════════════════════════════════════════════════════════════════
-- Vérification — à exécuter APRÈS application
-- ═══════════════════════════════════════════════════════════════════
--
--   select p.proname,
--          has_function_privilege('anon',          p.oid, 'EXECUTE') as anon,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'get_my_team_task_dependencies';
--   Attendu : f / t
--
--   -- Isolation : un p_org forge ne rend rien.
--   select count(*) from get_my_team_task_dependencies('<org_etrangere>');
--   Attendu : 0
--
--   -- Plan (a CHAUD) : plus aucun Filter can_access_team_project.
--   explain (analyze, buffers)
--     select * from get_my_team_task_dependencies('<org_uuid>');
