-- Preuve de la mig. 243 (ARC-02, une seule règle de visibilité des projets
-- d'équipe), acteur par acteur.
--
-- Forme de `208-210.proof.sql` : un SEUL bloc `DO` qui se termine TOUJOURS
-- par `RAISE EXCEPTION`. La migration est EMBARQUÉE (texte identique au
-- fichier, vérifié par `e2e/rls/preuves-dette-sql.test.ts`) : la preuve se
-- joue AVANT application et s'annule avec elle.
--   supabase db query --linked -f supabase/proofs/243.proof.sql
--   → « PREUVE-ANNULEE 0 ECHEC | ok 00 … | ok 01 A … »
--
-- 00 AVANT tout : le corps vivant de `can_access_team_project` est celui que
--    la 243 sauvegarde en en-tête (194 : équipes associées ET membres
--    directs), ou déjà celui de la 243. Sinon le retour arrière écrit dans la
--    migration serait faux : ECHEC, et on ne conclut rien d'autre.
-- Puis, pour chaque acteur (A admin · M manager de C · C équipe porteuse ·
-- PM membre direct de P2 · TT équipe associée à P1 · L sans lien · F ancien
-- membre · X admin d'une autre organisation), sous `authenticated` :
--   · les projets que voit la RPC = ceux que voit la lecture directe sous
--     RLS = ceux pour lesquels `can_access_team_project` dit vrai = l'attendu ;
--   · tâches, dépendances de tâches, dépendances de projets : directe = RPC.
-- Une tâche de P1 est à la corbeille avec une dépendance vers elle, et P1
-- dépend de P3 (cloisonné) : les deux cellules où policies et RPC
-- divergeaient avant la 243.
-- Passe témoin : jouée SANS la migration (retirer l'EXECUTE) sur la
-- production d'avant, les lignes « deps » de C, M et TT doivent échouer.

DO $proof$
DECLARE
  r   text[] := '{}';
  ko  int := 0;
  A  constant uuid := '00000000-0000-0000-0000-0000000a0243';
  M  constant uuid := '00000000-0000-0000-0000-0000000b0243';
  C  constant uuid := '00000000-0000-0000-0000-0000000c0243';
  PM constant uuid := '00000000-0000-0000-0000-0000000d0243';
  TT constant uuid := '00000000-0000-0000-0000-0000000e0243';
  L  constant uuid := '00000000-0000-0000-0000-0000000f0243';
  F  constant uuid := '00000000-0000-0000-0000-000000100243';
  X  constant uuid := '00000000-0000-0000-0000-000000110243';
  O  constant uuid := '10000000-0000-0000-0000-000000000243';
  O2 constant uuid := '10000000-0000-0000-0000-000000002243';
  T1 constant uuid := '20000000-0000-0000-0000-000000010243';
  T2 constant uuid := '20000000-0000-0000-0000-000000020243';
  T3 constant uuid := '20000000-0000-0000-0000-000000030243';
  P0 constant uuid := '30000000-0000-0000-0000-000000000243';
  P1 constant uuid := '30000000-0000-0000-0000-000000010243';
  P2 constant uuid := '30000000-0000-0000-0000-000000020243';
  P3 constant uuid := '30000000-0000-0000-0000-000000030243';
  K0  constant uuid := '40000000-0000-0000-0000-000000000243';
  K1a constant uuid := '40000000-0000-0000-0000-0000000a1243';
  K1b constant uuid := '40000000-0000-0000-0000-0000000b1243';
  K1d constant uuid := '40000000-0000-0000-0000-0000000d1243';
  K2  constant uuid := '40000000-0000-0000-0000-000000020243';
  K3  constant uuid := '40000000-0000-0000-0000-000000030243';
  acteurs  uuid[];
  noms     text[] := ARRAY['A', 'M', 'C', 'PM', 'TT', 'L', 'F', 'X'];
  attendus text[] := ARRAY['P0,P1,P2,P3', 'P0,P1', 'P0,P1', 'P0,P2', 'P0,P1', 'P0', '', ''];
  corps text;
  i int;
  v_rpc text; v_dir text; v_sca text;
BEGIN
  acteurs := ARRAY[A, M, C, PM, TT, L, F, X];

  -- ── 00 · le corps vivant est-il celui que la 243 sauvegarde ? ──────
  corps := pg_get_functiondef('public.can_access_team_project(uuid)'::regprocedure);
  IF corps LIKE '%my_team_project_ids(p.org_id)%' THEN
    r := r || 'info 00 can_access_team_project porte deja le corps de la 243'::text;
  ELSIF corps LIKE '%team_project_teams%' AND corps LIKE '%team_project_members%' AND corps LIKE '%get_subtree%' THEN
    r := r || 'ok 00 corps vivant = celui de la 194, sauvegarde en en-tete de la 243'::text;
  ELSE
    RAISE EXCEPTION 'PREUVE-ANNULEE 1 ECHEC | ECHEC 00 corps vivant de can_access_team_project inattendu : relire pg_get_functiondef et corriger la sauvegarde de la 243 avant tout';
  END IF;

  EXECUTE $mig$
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
$mig$;

  -- ── Fixtures (rôle propriétaire) ──────────────────────────────────
  INSERT INTO auth.users(id, email) VALUES
    (A, 'a243@proof.invalid'), (M, 'm243@proof.invalid'), (C, 'c243@proof.invalid'), (PM, 'pm243@proof.invalid'),
    (TT, 'tt243@proof.invalid'), (L, 'l243@proof.invalid'), (F, 'f243@proof.invalid'), (X, 'x243@proof.invalid');
  INSERT INTO public.profiles(id, email, display_name)
    SELECT id, email, split_part(email, '@', 1) FROM auth.users WHERE email LIKE '%243@proof.invalid'
    ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.organizations(id, name, join_code, owner_id) VALUES (O, 'Proof243', 'PRF243', A), (O2, 'Proof243b', 'PRF2432', X);
  INSERT INTO public.organization_members(org_id, user_id, role, manager_id) VALUES
    (O, A, 'admin', NULL), (O, M, 'member', A), (O, C, 'member', M), (O, PM, 'member', A),
    (O, TT, 'member', A), (O, L, 'member', A), (O, F, 'member', A), (O2, X, 'admin', NULL)
    ON CONFLICT DO NOTHING;
  INSERT INTO public.org_teams(id, org_id, name, created_by) VALUES
    (T1, O, 'Porteuse', A), (T2, O, 'Transverse', A), (T3, O, 'Vide', A);
  INSERT INTO public.org_team_members(team_id, org_id, user_id, is_lead) VALUES
    (T1, O, C, false), (T1, O, F, false), (T2, O, TT, false);
  INSERT INTO public.team_projects(id, org_id, name, team_id, created_by) VALUES
    (P0, O, 'P0', NULL, A), (P1, O, 'P1', T1, A), (P2, O, 'P2', T3, A), (P3, O, 'P3', T3, A);
  INSERT INTO public.team_project_teams(project_id, team_id, org_id) VALUES (P1, T2, O);
  INSERT INTO public.team_project_members(project_id, user_id, org_id, role) VALUES
    (P2, PM, O, 'contributor'), (P3, F, O, 'contributor');
  INSERT INTO public.team_tasks(id, org_id, project_id, name, created_by) VALUES
    (K0, O, P0, 'K0', A), (K1a, O, P1, 'K1a', A), (K1b, O, P1, 'K1b', A), (K1d, O, P1, 'K1d', A),
    (K2, O, P2, 'K2', A), (K3, O, P3, 'K3', A);
  INSERT INTO public.team_task_dependencies(task_id, depends_on_id, org_id) VALUES (K1a, K1b, O), (K1a, K1d, O);
  INSERT INTO public.team_project_dependencies(project_id, depends_on_id, org_id) VALUES (P1, P0, O), (P1, P3, O), (P2, P0, O);
  UPDATE public.team_tasks SET deleted_at = now() WHERE id = K1d;
  DELETE FROM public.organization_members WHERE org_id = O AND user_id = F;

  -- ── Acteur par acteur ─────────────────────────────────────────────
  EXECUTE 'SET LOCAL ROLE authenticated';
  FOR i IN 1 .. array_length(acteurs, 1) LOOP
    PERFORM set_config('request.jwt.claim.sub', acteurs[i]::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', acteurs[i], 'role', 'authenticated')::text, true);

    SELECT coalesce(string_agg(lbl, ',' ORDER BY lbl), '') INTO v_rpc FROM (
      SELECT CASE z.id WHEN P0 THEN 'P0' WHEN P1 THEN 'P1' WHEN P2 THEN 'P2' WHEN P3 THEN 'P3' ELSE z.id::text END AS lbl
        FROM public.get_my_team_projects(O) z) s;
    SELECT coalesce(string_agg(lbl, ',' ORDER BY lbl), '') INTO v_dir FROM (
      SELECT CASE z.id WHEN P0 THEN 'P0' WHEN P1 THEN 'P1' WHEN P2 THEN 'P2' WHEN P3 THEN 'P3' ELSE z.id::text END AS lbl
        FROM public.team_projects z WHERE z.org_id = O) s;
    SELECT coalesce(string_agg(v.lbl, ',' ORDER BY v.lbl), '') INTO v_sca
      FROM (VALUES (P0, 'P0'), (P1, 'P1'), (P2, 'P2'), (P3, 'P3')) v(id, lbl)
     WHERE public.can_access_team_project(v.id);
    IF v_rpc = attendus[i] AND v_dir = attendus[i] AND v_sca = attendus[i] THEN
      r := r || format('ok %s projets {%s} : RPC = directe = can_access', noms[i], attendus[i]);
    ELSE
      ko := ko + 1;
      r := r || format('ECHEC %s projets attendu {%s} : RPC {%s} directe {%s} can_access {%s}', noms[i], attendus[i], v_rpc, v_dir, v_sca);
    END IF;

    SELECT coalesce(string_agg(id::text, ',' ORDER BY id), '') INTO v_rpc FROM public.get_my_team_tasks(O);
    SELECT coalesce(string_agg(id::text, ',' ORDER BY id), '') INTO v_dir FROM public.team_tasks WHERE org_id = O;
    IF v_rpc = v_dir THEN r := r || format('ok %s taches : RPC = directe', noms[i]);
    ELSE ko := ko + 1; r := r || format('ECHEC %s taches : RPC {%s} directe {%s}', noms[i], v_rpc, v_dir); END IF;

    SELECT coalesce(string_agg(task_id || '>' || depends_on_id, ',' ORDER BY task_id, depends_on_id), '') INTO v_rpc
      FROM public.get_my_team_task_dependencies(O);
    SELECT coalesce(string_agg(task_id || '>' || depends_on_id, ',' ORDER BY task_id, depends_on_id), '') INTO v_dir
      FROM public.team_task_dependencies WHERE org_id = O;
    IF v_rpc = v_dir THEN r := r || format('ok %s deps de taches : RPC = directe', noms[i]);
    ELSE ko := ko + 1; r := r || format('ECHEC %s deps de taches : RPC {%s} directe {%s}', noms[i], v_rpc, v_dir); END IF;

    SELECT coalesce(string_agg(project_id || '>' || depends_on_id, ',' ORDER BY project_id, depends_on_id), '') INTO v_rpc
      FROM public.get_my_team_project_dependencies(O);
    SELECT coalesce(string_agg(project_id || '>' || depends_on_id, ',' ORDER BY project_id, depends_on_id), '') INTO v_dir
      FROM public.team_project_dependencies WHERE org_id = O;
    IF v_rpc = v_dir THEN r := r || format('ok %s deps de projets : RPC = directe', noms[i]);
    ELSE ko := ko + 1; r := r || format('ECHEC %s deps de projets : RPC {%s} directe {%s}', noms[i], v_rpc, v_dir); END IF;
  END LOOP;
  EXECUTE 'RESET ROLE';

  RAISE EXCEPTION 'PREUVE-ANNULEE % ECHEC | %', ko, array_to_string(r, ' | ');
END $proof$;
