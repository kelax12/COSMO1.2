-- ═══════════════════════════════════════════════════════════════════
-- 265 · Tâche créée automatiquement par une habitude
-- ═══════════════════════════════════════════════════════════════════
--
-- Une habitude peut demander qu'une tâche soit créée chaque jour prévu
-- (nom et durée de l'habitude, échéance = ce jour, catégorie choisie).
-- Une ligne ici = l'option est active ; pas de ligne = inactive.
--
-- Table à part plutôt que deux colonnes sur `habits` : `get_my_habits`
-- (mig. 254) garde son type de retour, aucune RPC n'est réécrite.
--
-- `last_day` est la clé d'idempotence : le client « réserve » le jour par un
-- UPDATE conditionnel (`last_day IS NULL OR last_day < jour`) et ne crée la
-- tâche que si la ligne lui revient. Deux onglets ou deux appareils ne créent
-- donc qu'une tâche par jour.
--
-- ORDRE : à appliquer AVANT le front qui lit `habit_auto_tasks`.
-- Idempotente / rejouable.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.habit_auto_tasks (
  habit_id   uuid NOT NULL,
  -- Cascade directe en plus de la clé composée (art. 17, comme la 248).
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- Identifiant de catégorie de la tâche créée (même forme que `tasks.category`).
  category   text CHECK (category IS NULL OR char_length(category) <= 100),
  last_day   date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT habit_auto_tasks_pkey PRIMARY KEY (habit_id, user_id),
  CONSTRAINT habit_auto_tasks_habit_fkey FOREIGN KEY (habit_id, user_id)
    REFERENCES public.habits (id, user_id) ON DELETE CASCADE
);

COMMENT ON TABLE public.habit_auto_tasks IS
  'Mig. 265 : une ligne = l''habitude cree une tache chaque jour prevu. '
  'last_day = dernier jour reserve (idempotence, UPDATE conditionnel client).';

CREATE INDEX IF NOT EXISTS habit_auto_tasks_user_idx ON public.habit_auto_tasks (user_id);

ALTER TABLE public.habit_auto_tasks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.habit_auto_tasks FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.habit_auto_tasks TO authenticated;

DROP POLICY IF EXISTS "habit_auto_tasks_select" ON public.habit_auto_tasks;
CREATE POLICY "habit_auto_tasks_select" ON public.habit_auto_tasks
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "habit_auto_tasks_insert" ON public.habit_auto_tasks;
CREATE POLICY "habit_auto_tasks_insert" ON public.habit_auto_tasks
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "habit_auto_tasks_update" ON public.habit_auto_tasks;
CREATE POLICY "habit_auto_tasks_update" ON public.habit_auto_tasks
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "habit_auto_tasks_delete" ON public.habit_auto_tasks;
CREATE POLICY "habit_auto_tasks_delete" ON public.habit_auto_tasks
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Une ligne ne change jamais de compte (checklist mass-assignment V1).
DROP TRIGGER IF EXISTS trg_habit_auto_tasks_user_id_immutable ON public.habit_auto_tasks;
CREATE TRIGGER trg_habit_auto_tasks_user_id_immutable
  BEFORE UPDATE ON public.habit_auto_tasks
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();
