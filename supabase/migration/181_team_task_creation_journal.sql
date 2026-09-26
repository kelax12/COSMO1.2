-- ═══════════════════════════════════════════════════════════════════
-- 181 — Le journal des tâches d'équipe enregistre aussi les CRÉATIONS
--
-- ── LE PROBLÈME (cohérence globale, 2026-09-25) ────────────────────
--
-- Deux sources pour « ce qui s'est passé » : l'Aperçu RECONSTRUISAIT les
-- créations à partir de l'état courant des tâches (`created_at`), tandis que
-- tout le reste (complétions, réassignations, reports) venait du journal
-- `team_task_activity` (mig. 094), qui ne voyait que les UPDATE. Une tâche
-- supprimée disparaissait de l'historique de l'Aperçu, pas du journal ; une
-- tâche créée par la CLI n'y figurait que par déduction.
--
-- Règle : une seule source, le journal. Il lui manquait l'INSERT.
--
-- ── CE QUE FAIT CETTE MIGRATION ────────────────────────────────────
--
--   1. Trigger AFTER INSERT sur `team_tasks` → une ligne `field = 'created'`
--      (valeurs NULL : l'intitulé ne se copie pas dans le journal, même choix
--      que `name` en 094, pour la même raison RGPD).
--   2. Reprise de l'historique : une ligne `created` par tâche existante qui
--      n'en a pas, datée de sa création. Idempotente.
--
-- Même verrouillage que `log_team_task_activity` (094/094b) : SECURITY
-- DEFINER parce que l'auteur n'a aucun droit d'INSERT sur un journal
-- append-only, `search_path = ''`, aucun paramètre venant de l'appelant, et
-- EXECUTE retiré à `anon` ET `authenticated` (REVOKE PUBLIC ne suffit jamais).
--
-- L'acteur : `auth.uid()`, ou `created_by` quand l'insertion vient d'un rôle
-- serveur (RPC transactionnelle, CLI). La mig. 170 compte ces lignes comme de
-- l'activité du membre : créer une tâche EST travailler.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.log_team_task_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.team_task_activity (task_id, org_id, actor_id, field, old_value, new_value, created_at)
  VALUES (NEW.id, NEW.org_id, COALESCE(auth.uid(), NEW.created_by), 'created', NULL, NULL, COALESCE(NEW.created_at, now()));
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_team_task_creation() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_team_task_creation() FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_team_task_creation() FROM authenticated;

DROP TRIGGER IF EXISTS trg_log_team_task_creation ON public.team_tasks;
CREATE TRIGGER trg_log_team_task_creation
  AFTER INSERT ON public.team_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.log_team_task_creation();

-- Reprise : les tâches déjà là. `created_by` passe à NULL si le compte n'existe
-- plus (la FK `actor_id → auth.users` le refuserait, et l'événement reste vrai).
INSERT INTO public.team_task_activity (task_id, org_id, actor_id, field, old_value, new_value, created_at)
SELECT t.id,
       t.org_id,
       CASE WHEN EXISTS (SELECT 1 FROM auth.users u WHERE u.id = t.created_by) THEN t.created_by END,
       'created', NULL, NULL,
       t.created_at
FROM public.team_tasks t
WHERE NOT EXISTS (
  SELECT 1 FROM public.team_task_activity a WHERE a.task_id = t.id AND a.field = 'created'
);

COMMENT ON FUNCTION public.log_team_task_creation() IS
  'Journal append-only (mig. 181) : une ligne ''created'' par tâche d''équipe insérée. Seule source des créations affichées par l''Aperçu.';
