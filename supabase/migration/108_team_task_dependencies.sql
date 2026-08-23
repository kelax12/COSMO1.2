-- ═══════════════════════════════════════════════════════════════════
-- Migration 108 — Dépendances entre tâches d'équipe (« bloque / bloqué par »)
--
-- POURQUOI
-- La vue Planning (`TeamProjectsTimeline`) positionne chaque tâche à son
-- échéance, mais rien n'exprime qu'une tâche ne PEUT PAS commencer avant
-- qu'une autre finisse. Un responsable voyait donc des dates sans voir ce qui
-- les contraint : replanifier une tâche n'annonçait aucune des tâches qu'elle
-- retarde en cascade. C'est aussi ce qui manque pour calculer un chemin
-- critique, c'est-à-dire la seule chaîne dont tout retard décale le projet.
--
-- MODÈLE
-- Une arête orientée `depends_on_id -> task_id` : « task_id est bloquée par
-- depends_on_id ». La clé primaire (task_id, depends_on_id) rend le doublon
-- impossible sans code applicatif.
--
-- `org_id` est dénormalisé — même pattern que `org_team_members` et
-- `team_key_results` — pour garder des policies plates et un index utile.
-- Le trigger de cohérence garantit qu'il ne peut pas mentir.
--
-- DEUX INVARIANTS, TOUS DEUX TENUS PAR LA BASE
--   1. PAS DE CYCLE. Un cycle rendrait le tri topologique impossible et le
--      calcul du chemin critique non terminant. Un client buggé, deux
--      onglets concurrents ou un import ne doivent pas pouvoir en créer un :
--      la garde est un trigger, pas une vérification côté client.
--   2. MÊME PROJET. Une dépendance ne traverse pas les projets. Sans cette
--      règle, une tâche d'un projet cloisonné apparaîtrait comme bloquante
--      dans un projet auquel on a accès — donc une fuite par le graphe.
--
-- Idempotente (IF NOT EXISTS / CREATE OR REPLACE).
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.team_task_dependencies (
  -- La tâche BLOQUÉE (celle qui attend).
  task_id       UUID NOT NULL REFERENCES public.team_tasks(id) ON DELETE CASCADE,
  -- La tâche BLOQUANTE (celle qui doit finir d'abord).
  depends_on_id UUID NOT NULL REFERENCES public.team_tasks(id) ON DELETE CASCADE,
  org_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by    UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id, depends_on_id),
  -- Cycle de longueur 1. Les cycles plus longs sont l'affaire du trigger,
  -- mais celui-ci se dit en une contrainte, donc il se dit ici.
  CONSTRAINT team_task_dependencies_no_self CHECK (task_id <> depends_on_id)
);

-- La PK couvre déjà (task_id, …) ; le sens inverse (« que bloque cette
-- tâche ? ») est lu à chaque ouverture de tâche et mérite son propre index.
CREATE INDEX IF NOT EXISTS idx_team_task_deps_depends_on
  ON public.team_task_dependencies(depends_on_id);
CREATE INDEX IF NOT EXISTS idx_team_task_deps_org
  ON public.team_task_dependencies(org_id);

-- ─── 2. Cohérence : même projet, org_id honnête ─────────────────────

CREATE OR REPLACE FUNCTION public.validate_team_task_dependency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_task_project    UUID;
  v_task_org        UUID;
  v_depends_project UUID;
BEGIN
  SELECT project_id, org_id INTO v_task_project, v_task_org
    FROM public.team_tasks WHERE id = NEW.task_id;
  SELECT project_id INTO v_depends_project
    FROM public.team_tasks WHERE id = NEW.depends_on_id;

  IF v_task_project IS NULL OR v_depends_project IS NULL THEN
    RAISE EXCEPTION 'Both tasks must exist';
  END IF;

  IF v_task_project IS DISTINCT FROM v_depends_project THEN
    RAISE EXCEPTION 'A dependency must stay within a single project';
  END IF;

  -- `org_id` n'est jamais pris depuis l'input : il est redérivé de la tâche.
  NEW.org_id := v_task_org;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_team_task_dependency ON public.team_task_dependencies;
CREATE TRIGGER trg_validate_team_task_dependency
  BEFORE INSERT OR UPDATE ON public.team_task_dependencies
  FOR EACH ROW EXECUTE FUNCTION public.validate_team_task_dependency();

-- ─── 3. Anti-cycle ──────────────────────────────────────────────────
-- Refuse l'arête si la tâche bloquante dépend DÉJÀ, directement ou non, de
-- la tâche bloquée. La récursion part de `depends_on_id` et remonte ses
-- propres bloquantes : atteindre `task_id` prouve le cycle.
--
-- `depth` borne la descente à 200 : sans elle, un cycle déjà présent en base
-- (créé avant cette migration) ferait boucler le trigger au lieu de rejeter
-- l'insertion.

CREATE OR REPLACE FUNCTION public.prevent_team_task_dependency_cycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    WITH RECURSIVE upstream(id, depth) AS (
      SELECT NEW.depends_on_id, 0
      UNION ALL
      SELECT d.depends_on_id, u.depth + 1
        FROM public.team_task_dependencies d
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

DROP TRIGGER IF EXISTS trg_prevent_team_task_dependency_cycle ON public.team_task_dependencies;
CREATE TRIGGER trg_prevent_team_task_dependency_cycle
  BEFORE INSERT OR UPDATE ON public.team_task_dependencies
  FOR EACH ROW EXECUTE FUNCTION public.prevent_team_task_dependency_cycle();

-- ─── 4. RLS ─────────────────────────────────────────────────────────
-- Le périmètre est délégué à `team_tasks` par un EXISTS : ces sous-requêtes
-- s'évaluent avec le RÔLE COURANT, donc la RLS de `team_tasks` s'y applique
-- pleinement. Une tâche invisible rend sa dépendance invisible, sans qu'on
-- ait à réécrire — ni à maintenir en double — la règle de cloisonnement.
--
-- On n'introduit volontairement AUCUN helper SECURITY DEFINER ici : c'est
-- exactement ce qui avait ouvert la fuite inter-organisations de la mig. 100.

ALTER TABLE public.team_task_dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_task_dependencies_select" ON public.team_task_dependencies;
CREATE POLICY "team_task_dependencies_select"
  ON public.team_task_dependencies FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.team_tasks t WHERE t.id = task_id)
  );

-- Écriture : il faut voir LES DEUX tâches. Voir seulement la bloquée
-- permettrait de la rattacher à une tâche qu'on n'a pas le droit de lire.
DROP POLICY IF EXISTS "team_task_dependencies_insert" ON public.team_task_dependencies;
CREATE POLICY "team_task_dependencies_insert"
  ON public.team_task_dependencies FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.team_tasks t WHERE t.id = task_id)
    AND EXISTS (SELECT 1 FROM public.team_tasks t WHERE t.id = depends_on_id)
  );

DROP POLICY IF EXISTS "team_task_dependencies_delete" ON public.team_task_dependencies;
CREATE POLICY "team_task_dependencies_delete"
  ON public.team_task_dependencies FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM public.team_tasks t WHERE t.id = task_id)
  );

-- Pas de policy UPDATE : une arête n'a rien de modifiable — on la supprime et
-- on en crée une autre. Sans policy, l'UPDATE est refusé par défaut.

COMMIT;
