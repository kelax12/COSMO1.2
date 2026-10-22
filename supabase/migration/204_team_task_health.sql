-- 204 · État déclaré d'une tâche d'équipe
--
-- Le menu « État » des KR (Dans les temps / À risque / En difficulté / Atteint)
-- s'étend aux tâches. Même vocabulaire que `team_projects.health` (mig. 190)
-- et que la santé des KR (mig. 160). « Atteint » n'est pas une valeur : c'est
-- `completed`, que le trigger de la mig. 091 synchronise déjà avec `status`.
--
-- Aucune policy à toucher : la colonne suit la RLS UPDATE existante de
-- `team_tasks`, et `get_my_team_tasks` (SETOF team_tasks) la rend d'office.

ALTER TABLE public.team_tasks
  ADD COLUMN IF NOT EXISTS health TEXT;

ALTER TABLE public.team_tasks
  DROP CONSTRAINT IF EXISTS team_tasks_health_check,
  ADD CONSTRAINT team_tasks_health_check
    CHECK (health IS NULL OR health IN ('on_track', 'at_risk', 'off_track'));
