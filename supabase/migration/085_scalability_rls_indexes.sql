-- ═══════════════════════════════════════════════════════════════════
-- 085 — Correctifs de scalabilité de l'audit architecture 2026-08-07
-- Rapport : AUDIT-ARCHITECTURE-2026-08-07.md
--
-- C1 (Critical) `tasks` : Seq Scan de la table GLOBALE à chaque lecture
-- H2 (High)     get_work_time_stats : périmètre défini par la RLS, pas par
--               l'utilisateur → les stats d'un manager incluent son équipe
-- H5 (High)     shared_lists : 4 policies en `auth.uid()` nu (règle mig. 043)
-- M4 (Medium)   14 clés étrangères sans index + RLS profiles → Seq Scan friends
--
-- Complète la mig. 084 (audit sécurité), qui a déjà traité la fusion des
-- policies PERMISSIVE d'`events` (AUD-15) et `team_task_comments` (AUD-16).
--
-- ⚠️ ORDRE DE DÉPLOIEMENT : appliquer cette migration AVANT le front.
-- `get_my_tasks()` doit exister quand le nouveau client l'appelle. L'ancien
-- client continue de fonctionner (les policies RLS restent inchangées) —
-- le déploiement est donc réversible sans downtime.
-- ═══════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════
-- C1 · `tasks` — lecture indexable au lieu d'un Seq Scan global
-- ═══════════════════════════════════════════════════════════════════
--
-- Constat (EXPLAIN sous le rôle `authenticated`, prod 2026-08-07) :
--
--   Limit
--     ->  Sort  (Sort Key: created_at DESC, id DESC)
--           ->  Seq Scan on tasks                              ← ❌
--                 Filter: (uid = user_id) OR (ANY (id = SubPlan))
--
-- Cause : la policy `tasks_select_own_or_shared` (mig. 049) fusionne « mes
-- tâches » et « les tâches partagées avec moi » avec un OR. Un OR entre une
-- égalité indexable et un EXISTS empêche Postgres d'utiliser
-- `idx_tasks_user_id` : il scanne la table ENTIÈRE, tous utilisateurs
-- confondus, puis trie. Le client (`SupabaseTasksRepository.getAll`) n'envoie
-- par ailleurs aucun `user_id = …`, il n'y a donc pas d'autre prédicat à
-- exploiter.
--
-- Conséquence : le coût d'une lecture croît avec la taille TOTALE de la table,
-- pas avec le volume de l'utilisateur. Un compte de 20 tâches paie le scan des
-- tâches de tout le monde. Amplifié par le polling du client, c'est le premier
-- point de rupture de l'application (≈ 10 000 utilisateurs).
--
-- Correctif : exprimer les deux ensembles comme un UNION de deux branches
-- indexables, dans une fonction. Plan obtenu après correctif :
--
--   Unique -> Sort -> Append
--     ->  Index Scan using idx_tasks_user_id on tasks        ← ✅
--     ->  Nested Loop
--           ->  shared_tasks (idx_shared_tasks_friend_id)
--           ->  Index Scan using tasks_pkey on tasks         ← ✅
--
-- Pourquoi SECURITY DEFINER : le corps ré-implémente EXACTEMENT le prédicat de
-- `tasks_select_own_or_shared`, mais en deux branches que le planificateur sait
-- indexer. En INVOKER, la RLS se ré-appliquerait PAR-DESSUS chaque branche et
-- réintroduirait le SubPlan qu'on cherche à éliminer.
--
-- ⚠️ Invariants de sécurité de cette fonction :
--   • Aucun paramètre : le périmètre vient UNIQUEMENT de auth.uid(). Il est
--     donc impossible de lire les tâches d'autrui en forgeant un argument.
--   • `auth.uid() IS NULL` → aucune ligne (anon ne peut rien lire).
--   • `SET search_path = ''` : pas de détournement par un schéma utilisateur.
--   • EXECUTE révoqué à PUBLIC/anon, accordé au seul rôle `authenticated`.
--   • Les policies RLS de `tasks` restent EN PLACE et inchangées : elles
--     protègent toujours les accès directs à la table (défense en profondeur).

CREATE OR REPLACE FUNCTION public.get_my_tasks()
RETURNS SETOF public.tasks
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  -- Branche 1 : mes propres tâches (Index Scan sur idx_tasks_user_id).
  SELECT t.*
  FROM public.tasks t
  WHERE auth.uid() IS NOT NULL
    AND t.user_id = auth.uid()

  UNION

  -- Branche 2 : les tâches partagées avec moi (Index Scan sur
  -- idx_shared_tasks_friend_id, puis tasks_pkey).
  SELECT t.*
  FROM public.tasks t
  JOIN public.shared_tasks st ON st.task_id = t.id
  WHERE auth.uid() IS NOT NULL
    AND st.friend_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_tasks() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_tasks() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_tasks() TO authenticated;

COMMENT ON FUNCTION public.get_my_tasks() IS
  'Lecture indexable des tâches visibles (miennes UNION partagées). Remplace '
  'un SELECT direct sur `tasks`, dont la policy OR force un Seq Scan global. '
  'Périmètre dérivé exclusivement de auth.uid() — aucun paramètre.';


-- ═══════════════════════════════════════════════════════════════════
-- H2 · get_work_time_stats — le périmètre redevient « moi », explicitement
-- ═══════════════════════════════════════════════════════════════════
--
-- La fonction est SECURITY INVOKER et ne filtrait QUE par la RLS. Or depuis la
-- mig. 077, la RLS d'`events` laisse un manager lire les événements non privés
-- de ses subordonnés, et celle de `tasks` renvoie les tâches partagées avec
-- l'utilisateur. Résultat : le « temps investi » PERSONNEL d'un manager
-- agrégeait silencieusement celui de toute son équipe.
--
-- Règle générale posée ici : ne JAMAIS laisser la RLS définir le périmètre d'un
-- calcul métier. La RLS dit ce qu'on a le DROIT de lire ; elle ne dit pas ce
-- qu'on VEUT compter. Les quatre sous-requêtes filtrent donc désormais
-- `user_id = auth.uid()` explicitement.
--
-- Le corps est par ailleurs identique à la mig. 074 (mêmes gardes regex sur les
-- dates JSONB, même cap de 32 plages, même arrondi).

CREATE OR REPLACE FUNCTION public.get_work_time_stats(p_ranges jsonb, p_tz text DEFAULT 'UTC'::text)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
WITH ranges AS (
  SELECT ord,
         (elem->>'start')::date AS d_start,
         (elem->>'end')::date   AS d_end
  FROM jsonb_array_elements(p_ranges) WITH ORDINALITY AS t(elem, ord)
  WHERE ord <= 32
    AND (elem->>'start') ~ '^\d{4}-\d{2}-\d{2}$'
    AND (elem->>'end')   ~ '^\d{4}-\d{2}-\d{2}$'
),
agg AS (
  SELECT
    r.ord,
    COALESCE((
      SELECT SUM(t.estimated_time)
      FROM tasks t
      WHERE t.user_id = auth.uid()          -- H2 : périmètre explicite
        AND t.completed
        AND t.completed_at IS NOT NULL
        AND (t.completed_at AT TIME ZONE p_tz)::date BETWEEN r.d_start AND r.d_end
    ), 0) AS tasks_time,
    COALESCE((
      SELECT SUM(EXTRACT(EPOCH FROM (e.end_time - e.start_time)) / 60)
      FROM events e
      WHERE e.user_id = auth.uid()          -- H2 : périmètre explicite
        AND (e.start_time AT TIME ZONE p_tz)::date BETWEEN r.d_start AND r.d_end
    ), 0) AS events_time,
    COALESCE((
      SELECT SUM(c.cnt * h.estimated_time)
      FROM habits h
      CROSS JOIN LATERAL (
        SELECT COUNT(*) AS cnt
        FROM jsonb_each(h.completions) AS kv(day, done)
        WHERE kv.done = 'true'::jsonb
          AND kv.day ~ '^\d{4}-\d{2}-\d{2}$'
          AND kv.day::date BETWEEN r.d_start AND r.d_end
      ) c
      WHERE h.user_id = auth.uid()          -- H2 : périmètre explicite
    ), 0) AS habits_time,
    COALESCE((
      SELECT SUM(
        (hist.elem->>'increment')::numeric
        * COALESCE((kr.elem->>'estimatedTime')::numeric, 0)
      )
      FROM okrs o
      CROSS JOIN LATERAL jsonb_array_elements(o.key_results) AS kr(elem)
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(kr.elem->'history', '[]'::jsonb)) AS hist(elem)
      WHERE o.user_id = auth.uid()          -- H2 : périmètre explicite
        AND hist.elem->>'date' ~ '^\d{4}-\d{2}-\d{2}'
        AND (hist.elem->>'increment') ~ '^-?\d+(\.\d+)?$'
        AND (kr.elem->>'estimatedTime' IS NULL OR (kr.elem->>'estimatedTime') ~ '^\d+(\.\d+)?$')
        AND substring(hist.elem->>'date' FROM 1 FOR 10)::date BETWEEN r.d_start AND r.d_end
    ), 0) AS okr_time
  FROM ranges r
)
SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'tasksTime',  ROUND(tasks_time)::int,
  'eventsTime', ROUND(events_time)::int,
  'habitsTime', ROUND(habits_time)::int,
  'okrTime',    ROUND(okr_time)::int,
  'totalTime',  ROUND(tasks_time + events_time + habits_time + okr_time)::int
) ORDER BY ord), '[]'::jsonb)
FROM agg;
$function$;


-- ═══════════════════════════════════════════════════════════════════
-- H5 · shared_lists — auth.uid() wrappé (convention mig. 043)
-- ═══════════════════════════════════════════════════════════════════
--
-- Un `auth.uid()` nu dans une policy est ré-évalué PAR LIGNE scannée ; wrappé
-- en `(select auth.uid())`, Postgres le traite comme un InitPlan évalué une
-- seule fois par requête. La mig. 059 (partage de listes) a réintroduit la
-- forme nue sur les 4 policies — confirmé par l'advisor `auth_rls_initplan`
-- (vérifié live le 2026-08-07).
--
-- Sémantique STRICTEMENT identique : seule la forme d'appel change.
-- La garde CI `scripts/check-rls-advisors.mjs` empêche désormais la récidive.

DROP POLICY IF EXISTS "shared_lists_select" ON public.shared_lists;
CREATE POLICY "shared_lists_select"
  ON public.shared_lists FOR SELECT
  USING (
    (select auth.uid()) = shared_by OR (select auth.uid()) = friend_id
  );

DROP POLICY IF EXISTS "shared_lists_insert" ON public.shared_lists;
CREATE POLICY "shared_lists_insert"
  ON public.shared_lists FOR INSERT
  WITH CHECK ((select auth.uid()) = shared_by);

DROP POLICY IF EXISTS "shared_lists_update" ON public.shared_lists;
CREATE POLICY "shared_lists_update"
  ON public.shared_lists FOR UPDATE
  USING ((select auth.uid()) = friend_id)
  WITH CHECK ((select auth.uid()) = friend_id);

DROP POLICY IF EXISTS "shared_lists_delete" ON public.shared_lists;
CREATE POLICY "shared_lists_delete"
  ON public.shared_lists FOR DELETE
  USING (
    (select auth.uid()) = shared_by OR (select auth.uid()) = friend_id
  );


-- ─── org_team_members_insert : auth.uid() nu DANS un argument de fonction ──
--
-- Trouvé par la nouvelle garde CI `scripts/check-rls-advisors.mjs`, et
-- ABSENT du rapport d'advisor Supabase : l'advisor `auth_rls_initplan` ne
-- descend pas dans les arguments d'un appel de fonction. Ici l'occurrence est
-- imbriquée dans `get_subtree(org_id, auth.uid())`, à l'intérieur d'un
-- sous-SELECT — donc ré-évaluée par ligne, sans qu'aucun outil ne le signale.
--
-- C'est précisément le type de dérive qui justifie une garde statique EN PLUS
-- des advisors : les deux ont des angles morts différents.
--
-- Sémantique inchangée : `get_subtree` est STABLE, l'argument est le même.

DROP POLICY IF EXISTS "org_team_members_insert" ON public.org_team_members;
CREATE POLICY "org_team_members_insert"
  ON public.org_team_members FOR INSERT
  WITH CHECK (
    public.can_manage_team(team_id)
    AND (
      public.is_org_admin(org_id)
      OR user_id = (select auth.uid())
      OR user_id IN (SELECT public.get_subtree(org_id, (select auth.uid())))
    )
  );


-- ═══════════════════════════════════════════════════════════════════
-- M4 · Index manquants
-- ═══════════════════════════════════════════════════════════════════
--
-- (a) Clés étrangères sans index couvrant (advisor `unindexed_foreign_keys`,
--     14 findings le 2026-08-07). Sans index, chaque DELETE de la ligne PARENT
--     force un scan complet de la table enfant pour vérifier la contrainte.
--     Concrètement : supprimer une organisation de 500 membres devient un
--     empilement de scans, puis un timeout.
--
--     `CREATE INDEX IF NOT EXISTS` (et non CONCURRENTLY) : les tables sont
--     petites aujourd'hui et CONCURRENTLY est interdit dans un bloc
--     transactionnel — ce que le runner de migration utilise.

CREATE INDEX IF NOT EXISTS idx_events_created_by             ON public.events(created_by);
CREATE INDEX IF NOT EXISTS idx_demo_devices_converted_user    ON public.demo_devices(converted_user_id);
CREATE INDEX IF NOT EXISTS idx_org_invite_links_claimed_by    ON public.org_invite_links(claimed_by);
CREATE INDEX IF NOT EXISTS idx_org_invite_links_manager       ON public.org_invite_links(manager_id);
CREATE INDEX IF NOT EXISTS idx_org_okr_categories_created_by  ON public.org_okr_categories(created_by);
CREATE INDEX IF NOT EXISTS idx_org_team_members_added_by      ON public.org_team_members(added_by);
CREATE INDEX IF NOT EXISTS idx_org_teams_created_by           ON public.org_teams(created_by);
CREATE INDEX IF NOT EXISTS idx_org_members_manager_id         ON public.organization_members(manager_id);
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id         ON public.organizations(owner_id);
CREATE INDEX IF NOT EXISTS idx_team_okr_teams_added_by        ON public.team_okr_teams(added_by);
CREATE INDEX IF NOT EXISTS idx_team_okrs_created_by           ON public.team_okrs(created_by);
CREATE INDEX IF NOT EXISTS idx_team_projects_created_by       ON public.team_projects(created_by);
CREATE INDEX IF NOT EXISTS idx_team_task_comments_author      ON public.team_task_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_team_tasks_created_by          ON public.team_tasks(created_by);

-- (b) RLS `profiles` → Seq Scan de la table `friends` GLOBALE.
--
--     La policy « Users can read own, friends or org profiles » compare
--     `lower(f.email) = lower(profiles.email)`. Aucun index ne couvre
--     `lower(email)` sur `friends`, donc chaque lecture de profil scanne
--     l'intégralité de la table (vérifié par EXPLAIN : `Seq Scan on friends f`).
--     Cette table est GLOBALE — son volume croît avec le nombre total de
--     relations d'amitié de la plateforme, pas avec celles de l'utilisateur.
--
--     Index fonctionnel composite : `user_id` d'abord (sélectif, c'est le
--     prédicat qui réduit), puis `lower(email)` pour la comparaison.

CREATE INDEX IF NOT EXISTS idx_friends_user_lower_email
  ON public.friends(user_id, lower(email));


-- ═══════════════════════════════════════════════════════════════════
-- Vérification post-application (à exécuter manuellement)
-- ═══════════════════════════════════════════════════════════════════
--
--   BEGIN;
--   SET LOCAL ROLE authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<un-uuid-réel>","role":"authenticated"}';
--   EXPLAIN (COSTS OFF) SELECT * FROM get_my_tasks();
--   ROLLBACK;
--
-- Attendu : `Index Scan using idx_tasks_user_id` + `Index Scan using tasks_pkey`.
-- Aucun `Seq Scan on tasks` ne doit apparaître.
