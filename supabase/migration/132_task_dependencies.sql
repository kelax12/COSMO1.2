-- ═══════════════════════════════════════════════════════════════════
-- Migration 132 — Dépendances entre tâches PERSONNELLES (« bloque / bloqué par »)
--
-- POURQUOI
-- Le mode entreprise sait depuis la mig. 108 qu'une tâche ne peut pas
-- commencer avant qu'une autre finisse. Le parcours personnel, non : il
-- affiche des échéances sans jamais dire ce qui les contraint. Or c'est le
-- même besoin, et c'est même le plus fréquent — « je ne peux pas rédiger
-- l'article tant que l'interview n'est pas transcrite » n'attend pas qu'on
-- soit cinq.
--
-- MODÈLE — calqué sur la mig. 108, à une différence près, décisive.
-- Une arête orientée `depends_on_id -> task_id` : « task_id est bloquée par
-- depends_on_id ». La clé primaire (task_id, depends_on_id) rend le doublon
-- impossible sans code applicatif.
--
-- LA DIFFÉRENCE : le périmètre n'est PAS délégué à `tasks` par un EXISTS,
-- comme la 108 le fait pour `team_tasks`. Deux raisons, et la seconde suffit
-- à elle seule :
--
--   1. PERFORMANCE. `tasks_select_own_or_shared` (mig. 049) est un OR entre
--      une égalité et un EXISTS : c'est le prédicat que la mig. 085 a dû
--      contourner par `get_my_tasks()` parce qu'il empêche l'usage de
--      `idx_tasks_user_id`. Le déléguer ici le paierait PAR ARÊTE — la
--      mig. 117 a dû rattraper exactement cette erreur côté entreprise.
--      `user_id` dénormalisé rend la policy plate et indexable dès le premier
--      jour, donc aucune RPC de contournement n'est nécessaire.
--
--   2. CLOISONNEMENT. Une tâche personnelle peut être PARTAGÉE. Déléguer à
--      « les tâches que je vois » ferait entrer dans le graphe des arêtes
--      entre deux tâches d'un autre compte, et le graphe d'une personne
--      raconte son organisation intime. Le graphe personnel est donc
--      strictement celui de son PROPRIÉTAIRE : un collaborateur ne voit ni
--      n'écrit les dépendances du propriétaire. C'est une limite assumée, pas
--      un oubli — la version partagée du graphe, c'est le mode entreprise.
--
-- DEUX INVARIANTS, TOUS DEUX TENUS PAR LA BASE
--   1. PAS DE CYCLE (trigger). Un cycle rend l'ordonnancement insensé et
--      ferait boucler tout parcours du graphe. Un client buggé ou deux onglets
--      concurrents ne doivent pas pouvoir en créer un.
--   2. MÊME PROPRIÉTAIRE (trigger). `user_id` n'est jamais pris de l'input :
--      il est redérivé de la tâche bloquée, et l'insertion est refusée si la
--      tâche bloquante appartient à quelqu'un d'autre. La policy vérifie
--      ensuite que ce propriétaire est bien l'appelant — le trigger BEFORE
--      s'exécutant avant le WITH CHECK, on ne peut pas s'écrire une arête
--      chez autrui.
--
-- Les deux fonctions de trigger sont SECURITY INVOKER (défaut) et REVOKE-ées
-- pour anon ET authenticated : une garde qui ne fait que VALIDER ne s'exécute
-- jamais avec des privilèges élargis, sinon ses messages d'erreur deviennent
-- un oracle sur des lignes non lisibles (mig. 064b / 094b / 109, finding B-3).
--
-- Idempotente (IF NOT EXISTS / CREATE OR REPLACE / DROP … IF EXISTS).
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.task_dependencies (
  -- La tâche BLOQUÉE (celle qui attend).
  task_id       UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  -- La tâche BLOQUANTE (celle qui doit finir d'abord).
  depends_on_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  -- Propriétaire des DEUX tâches. Dénormalisé, redérivé par trigger.
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id, depends_on_id),
  -- Cycle de longueur 1. Les cycles plus longs sont l'affaire du trigger,
  -- mais celui-ci se dit en une contrainte, donc il se dit ici.
  CONSTRAINT task_dependencies_no_self CHECK (task_id <> depends_on_id)
);

-- Le seul prédicat de policy porte sur `user_id` : c'est l'index qui décide
-- du coût de TOUTE lecture du graphe.
CREATE INDEX IF NOT EXISTS idx_task_dependencies_user
  ON public.task_dependencies(user_id);
-- La PK couvre déjà (task_id, …) ; le sens inverse (« que bloque cette
-- tâche ? ») est lu à chaque ouverture de tâche et mérite son propre index.
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on
  ON public.task_dependencies(depends_on_id);

-- ─── 2. Cohérence : même propriétaire, user_id honnête ──────────────

CREATE OR REPLACE FUNCTION public.validate_task_dependency()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_task_owner    UUID;
  v_depends_owner UUID;
BEGIN
  SELECT user_id INTO v_task_owner
    FROM public.tasks WHERE id = NEW.task_id;
  SELECT user_id INTO v_depends_owner
    FROM public.tasks WHERE id = NEW.depends_on_id;

  IF v_task_owner IS NULL OR v_depends_owner IS NULL THEN
    RAISE EXCEPTION 'Both tasks must exist';
  END IF;

  IF v_task_owner IS DISTINCT FROM v_depends_owner THEN
    RAISE EXCEPTION 'A dependency must stay within a single account';
  END IF;

  -- `user_id` n'est jamais pris depuis l'input : il est redérivé de la tâche.
  -- La policy WITH CHECK, évaluée APRÈS ce trigger, vérifie ensuite qu'il
  -- s'agit bien de l'appelant.
  NEW.user_id := v_task_owner;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_task_dependency ON public.task_dependencies;
CREATE TRIGGER trg_validate_task_dependency
  BEFORE INSERT OR UPDATE ON public.task_dependencies
  FOR EACH ROW EXECUTE FUNCTION public.validate_task_dependency();

-- ─── 3. Anti-cycle ──────────────────────────────────────────────────
-- Refuse l'arête si la tâche bloquante dépend DÉJÀ, directement ou non, de la
-- tâche bloquée. La récursion part de `depends_on_id` et remonte ses propres
-- bloquantes : atteindre `task_id` prouve le cycle.
--
-- `depth` borne la descente à 200 : sans elle, un cycle déjà présent en base
-- ferait boucler le trigger au lieu de rejeter l'insertion.

CREATE OR REPLACE FUNCTION public.prevent_task_dependency_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    WITH RECURSIVE upstream(id, depth) AS (
      SELECT NEW.depends_on_id, 0
      UNION ALL
      SELECT d.depends_on_id, u.depth + 1
        FROM public.task_dependencies d
        JOIN upstream u ON d.task_id = u.id
       WHERE u.depth < 200
    )
    SELECT 1 FROM upstream WHERE id = NEW.task_id
  ) THEN
    RAISE EXCEPTION 'This dependency would create a cycle';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_task_dependency_cycle ON public.task_dependencies;
CREATE TRIGGER trg_prevent_task_dependency_cycle
  BEFORE INSERT OR UPDATE ON public.task_dependencies
  FOR EACH ROW EXECUTE FUNCTION public.prevent_task_dependency_cycle();

-- ⚠️ `authenticated` EXPLICITEMENT : `REVOKE … FROM PUBLIC` ne retire pas le
-- GRANT nominatif que Supabase pose par défaut sur le schéma `public`.
REVOKE ALL ON FUNCTION public.validate_task_dependency()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_task_dependency_cycle() FROM PUBLIC, anon, authenticated;

-- ─── 4. RLS ─────────────────────────────────────────────────────────
-- UNE seule policy PERMISSIVE par rôle+action (mig. 049), et un prédicat qui
-- ne dépend PAS de la ligne : `(SELECT auth.uid())` est hissé en InitPlan, la
-- comparaison devient une condition d'index sur `idx_task_dependencies_user`.
-- C'est la règle posée par la 043 et re-démontrée par la 128.

ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_dependencies_select" ON public.task_dependencies;
CREATE POLICY "task_dependencies_select"
  ON public.task_dependencies FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- `user_id` a été redérivé par le trigger BEFORE : exiger qu'il soit
-- l'appelant suffit à garantir qu'on possède LES DEUX tâches.
DROP POLICY IF EXISTS "task_dependencies_insert" ON public.task_dependencies;
CREATE POLICY "task_dependencies_insert"
  ON public.task_dependencies FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "task_dependencies_delete" ON public.task_dependencies;
CREATE POLICY "task_dependencies_delete"
  ON public.task_dependencies FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Pas de policy UPDATE : une arête n'a rien de modifiable — on la supprime et
-- on en crée une autre. Sans policy, l'UPDATE est refusé par défaut.

COMMENT ON TABLE public.task_dependencies IS
  'Dependances entre taches personnelles (bloque / bloquee par). Perimetre '
  'strictement limite au proprietaire : contrairement a team_task_dependencies '
  '(mig. 108), la policy ne delegue PAS a tasks — le OR de la mig. 049 est non '
  'indexable, et une tache personnelle peut etre partagee.';

COMMIT;

-- ═══════════════════════════════════════════════════════════════════
-- Vérification — à exécuter APRÈS application
-- ═══════════════════════════════════════════════════════════════════
--
--   -- Une seule policy PERMISSIVE par action, et aucune pour UPDATE.
--   select cmd, count(*) from pg_policies
--    where schemaname = 'public' and tablename = 'task_dependencies'
--    group by cmd;
--   Attendu : SELECT 1 / INSERT 1 / DELETE 1, pas de ligne UPDATE.
--
--   -- Les deux gardes ne sont executables par personne.
--   select p.proname,
--          has_function_privilege('anon',          p.oid, 'EXECUTE') as anon,
--          has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('validate_task_dependency', 'prevent_task_dependency_cycle');
--   Attendu : f / f pour les deux.
--
--   -- Plan indexable (a CHAUD, connecte comme un utilisateur reel).
--   explain (analyze, buffers) select * from public.task_dependencies;
--   Attendu : Index Scan sur idx_task_dependencies_user, jamais de Seq Scan.
