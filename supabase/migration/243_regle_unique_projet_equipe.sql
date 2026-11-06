-- ═══════════════════════════════════════════════════════════════════
-- 243 · Une seule règle « qui voit quel projet d'équipe » (ARC-02, V9.2)
--
-- LE DÉFAUT. Deux fonctions disaient, chacune à sa façon, qui voit un projet
-- d'équipe :
--
--   · `can_access_team_project(p_project)`  (scalaire, par ligne) : appelée par
--     les policies de `team_projects`, `team_tasks` et d'une vingtaine d'autres
--     (commentaires, sous-tâches, étiquettes, champs, messages, liens KR…) ;
--   · `my_team_project_ids(p_org)`          (ensembliste, une fois par org) :
--     appelée par les RPC de lecture indexables `get_my_team_*` (mig. 113,
--     117, 152, 153, 160, 190), qui sont `SECURITY DEFINER` et ne passent
--     donc PAS par les policies.
--
-- Deux textes pour une règle : ils ont déjà divergé une fois. Les mig. 164
-- (équipes associées) et 190 (membres directs) ont chacune réécrit LES DEUX,
-- en parallèle ; appliquée en second, chacune effaçait l'ajout de l'autre
-- (réconciliées par la 194). Rien n'empêchait une troisième fois.
--
-- LE CORRECTIF. `my_team_project_ids` devient LA règle, et
-- `can_access_team_project` n'est plus qu'une question posée à cette règle :
-- « ce projet est-il dans l'ensemble des projets que je vois dans SON
-- organisation ? ». Toute évolution de la visibilité (nouvelle branche, rôle,
-- suspension) s'écrit désormais UNE fois, dans `my_team_project_ids`, et
-- vaut à la fois pour les policies et pour les RPC.
--
-- POURQUOI PAS DES RPC `SECURITY INVOKER`. Une RPC INVOKER lit les tables
-- sous la RLS de l'appelant : la policy `can_access_team_project(project_id)`
-- y serait réévaluée PAR LIGNE, ce que la mig. 113 a précisément retiré
-- (≈ 60× le coût par ligne du prédicat personnel, mesuré en prod le
-- 2026-08-14). Et `my_team_project_ids` n'est pas exécutable par
-- `authenticated`, à dessein (mig. 100, 113). Les RPC restent donc DEFINER,
-- inchangées, et leur plan est celui d'aujourd'hui : cette migration ne
-- touche à AUCUNE d'elles. L'exception à la règle « une RPC d'agrégat est
-- INVOKER » est écrite dans `src/modules/CLAUDE.md`, avec sa condition : la
-- RPC DEFINER tire son périmètre de `my_team_project_ids`, rien d'autre.
--
-- ÉQUIVALENCE. Le nouveau corps rend exactement l'ancien prédicat, branche
-- par branche (relu contre la 194) : membre actif de l'organisation
-- (`is_org_member` dans `my_membership`) ET (projet sans équipe OU admin OU
-- équipe porteuse/associée à moi ou à mon sous-arbre OU membre direct).
-- La seule hypothèse : une appartenance d'équipe, une équipe associée
-- (`team_project_teams`) et un membre direct (`team_project_members`)
-- portent l'`org_id` de leur projet. Le trigger de la 190 le redérive pour
-- les membres directs ; la policy d'insertion de la 164 l'exige pour les
-- équipes associées. Une ligne incohérente posée par `service_role` serait
-- ignorée par la nouvelle règle, là où l'ancienne l'aurait suivie : l'écart
-- possible ne va que dans le sens fermé.
-- Le test `e2e/rls/regle-unique-projet.test.ts` le vérifie acteur par acteur
-- (admin, manager, membre du projet, équipe transverse, membre sans lien,
-- ancien membre, tiers) : lecture directe sous RLS et RPC rendent les mêmes
-- lignes.
--
-- DEUX DIVERGENCES DÉJÀ PRÉSENTES, refermées ici du côté de l'intention
-- écrite dans les RPC (les deux ne font que RESTREINDRE la lecture directe) :
--   · `team_task_dependencies_select` ne regardait que la tâche bloquée : une
--     dépendance vers une tâche À LA CORBEILLE restait lisible en direct,
--     alors que `get_my_team_task_dependencies` la retire (« une dépendance
--     dont UN des deux bouts est à la corbeille disparaît avec lui », mig.
--     152). Les deux bouts sont dans le même projet (trigger de la mig. 108) :
--     exiger que la tâche bloquante soit lisible revient à exiger qu'elle ne
--     soit pas à la corbeille.
--   · `team_project_dependencies_select` ne regardait que le projet bloqué :
--     une arête vers un projet CLOISONNÉ révélait son identifiant en lecture
--     directe, ce que `get_my_team_project_dependencies` refuse (« sinon elle
--     révélerait l'identifiant d'un projet cloisonné », mig. 153).
--
-- COÛT. `can_access_team_project` reste appelée par ligne par les policies
-- (lecture directe, Realtime, tables filles) ; un appel calcule désormais
-- l'ensemble des projets visibles de l'organisation (index `org_id`,
-- `get_subtree` une fois) au lieu d'un EXISTS ciblé : même ordre de
-- grandeur, `get_subtree` restant le terme dominant des deux. Les listes de
-- l'application passent par les RPC, dont le plan ne change pas.
--
-- 🔴 Les droits sont conservés : `CREATE OR REPLACE` garde l'ACL de la
--    fonction (EXECUTE à `authenticated`, retiré à `anon`, mig. 068/069).
-- 🔴 `my_team_project_ids` n'est PAS réécrite : son corps vivant est celui de
--    la 194, et c'est lui qui devient la règle.
-- Idempotente (CREATE OR REPLACE, DROP POLICY IF EXISTS puis CREATE).
-- Preuve : `supabase/proofs/243.proof.sql` (refuse de conclure si le corps
-- vivant de `can_access_team_project` n'est pas celui sauvegardé ci-dessous).
--
-- ── RETOUR ARRIÈRE : corps vivants remplacés (mig. 194, 108, 153) ─────
--
-- CREATE OR REPLACE FUNCTION public.can_access_team_project(p_project uuid)
-- RETURNS boolean
-- LANGUAGE sql
-- STABLE SECURITY DEFINER
-- SET search_path TO ''
-- AS $$
--   SELECT EXISTS (
--     SELECT 1 FROM public.team_projects p
--     WHERE p.id = p_project
--       AND public.is_org_member(p.org_id)
--       AND (
--         p.team_id IS NULL
--         OR public.is_org_admin(p.org_id)
--         OR EXISTS (
--           SELECT 1 FROM public.org_team_members tm
--           WHERE (
--               tm.team_id = p.team_id
--               OR tm.team_id IN (SELECT ptt.team_id FROM public.team_project_teams ptt
--                                  WHERE ptt.project_id = p.id)
--             )
--             AND (
--               tm.user_id = auth.uid()
--               OR tm.user_id IN (SELECT public.get_subtree(p.org_id, auth.uid()))
--             )
--         )
--         OR EXISTS (
--           SELECT 1 FROM public.team_project_members pm
--           WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
--         )
--       )
--   );
-- $$;
--
-- DROP POLICY IF EXISTS "team_task_dependencies_select" ON public.team_task_dependencies;
-- CREATE POLICY "team_task_dependencies_select"
--   ON public.team_task_dependencies FOR SELECT
--   USING (
--     EXISTS (SELECT 1 FROM public.team_tasks t WHERE t.id = task_id)
--   );
--
-- DROP POLICY IF EXISTS "team_project_dependencies_select" ON public.team_project_dependencies;
-- CREATE POLICY "team_project_dependencies_select"
--   ON public.team_project_dependencies FOR SELECT
--   USING (EXISTS (SELECT 1 FROM public.team_projects p WHERE p.id = project_id));
--
-- Relecture au catalogue après application :
--   SELECT pg_get_functiondef('public.can_access_team_project(uuid)'::regprocedure);
--     → contient `my_team_project_ids(p.org_id)`, plus `get_subtree`
--   SELECT polname, pg_get_expr(polqual, polrelid) FROM pg_policy
--    WHERE polrelid IN ('public.team_task_dependencies'::regclass,
--                       'public.team_project_dependencies'::regclass)
--      AND polcmd = 'r';
--     → deux EXISTS chacune (task_id ET depends_on_id)
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.can_access_team_project(p_project uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_projects p
    WHERE p.id = p_project
      AND p.id IN (SELECT public.my_team_project_ids(p.org_id))
  );
$$;

COMMENT ON FUNCTION public.can_access_team_project(uuid) IS
  'Visibilite d un projet d equipe, posee a la regle unique my_team_project_ids '
  '(mig. 243). Ne jamais y reecrire un predicat : faire evoluer my_team_project_ids, '
  'qui vaut a la fois pour les policies et pour les RPC get_my_team_*.';

DROP POLICY IF EXISTS "team_task_dependencies_select" ON public.team_task_dependencies;
CREATE POLICY "team_task_dependencies_select"
  ON public.team_task_dependencies FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.team_tasks t WHERE t.id = task_id)
    AND EXISTS (SELECT 1 FROM public.team_tasks b WHERE b.id = depends_on_id)
  );

DROP POLICY IF EXISTS "team_project_dependencies_select" ON public.team_project_dependencies;
CREATE POLICY "team_project_dependencies_select"
  ON public.team_project_dependencies FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.team_projects p WHERE p.id = project_id)
    AND EXISTS (SELECT 1 FROM public.team_projects q WHERE q.id = depends_on_id)
  );
