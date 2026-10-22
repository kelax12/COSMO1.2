-- ═══════════════════════════════════════════════════════════════════
-- 094 — Historique des tâches d'équipe (item UX #21)
--
-- ── LE PROBLÈME ────────────────────────────────────────────────────
--
-- « Qui a réassigné ça ? » « Quand la deadline a-t-elle bougé ? » n'ont pas
-- de réponse. Le flux d'activité actuel (`TeamActivityFeed`) est DÉRIVÉ de
-- l'état courant des tâches sur 14 jours : il ne voit donc que ce qui est
-- encore vrai, jamais ce qui a changé, et rien de rétroactif.
--
-- ── POURQUOI UN TRIGGER ET NON UNE ÉCRITURE CLIENT ─────────────────
--
-- Un journal écrit par le client n'est pas un journal : il manque toutes les
-- écritures faites hors de l'app (CLI, RPC, futures automatisations), et il
-- s'oublie au premier chemin de code ajouté. Le trigger, lui, ne peut pas
-- être contourné — c'est la seule forme qui rende l'historique digne de
-- confiance.
--
-- ── APPEND-ONLY ────────────────────────────────────────────────────
--
-- Aucune policy UPDATE ni DELETE : un journal qu'on peut réécrire ne prouve
-- rien. Même pattern que `kr_completions`. La purge se fait par la CASCADE de
-- la tâche, et `actor_id` passe à NULL si le compte est supprimé (RGPD, sans
-- perdre la trace de l'événement lui-même).
--
-- ⚠️ Le trigger est SECURITY DEFINER — nécessaire, car l'auteur d'une action
-- n'a par construction aucun droit d'INSERT sur ce journal (c'est ce qui le
-- rend append-only). Il est donc verrouillé : `SET search_path = ''`, insertion
-- littérale sans SQL dynamique, et aucun paramètre venant de l'appelant.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.team_task_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.team_tasks(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Champ modifié : 'status' | 'assignees' | 'deadline' | 'priority' | 'project' | 'name'
  field TEXT NOT NULL,
  -- Valeurs en texte : le journal doit rester lisible même si le type de la
  -- colonne d'origine change plus tard.
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- L'accès est toujours « l'historique de CETTE tâche, du plus récent au plus
-- ancien » : l'index doit porter les deux colonnes dans cet ordre.
CREATE INDEX IF NOT EXISTS idx_team_task_activity_task
  ON public.team_task_activity (task_id, created_at DESC);

ALTER TABLE public.team_task_activity ENABLE ROW LEVEL SECURITY;

-- SELECT seul. Pas d'INSERT client : seul le trigger écrit.
-- Pas d'UPDATE ni de DELETE : append-only.
DROP POLICY IF EXISTS "team_task_activity_select" ON public.team_task_activity;
CREATE POLICY "team_task_activity_select"
  ON public.team_task_activity FOR SELECT
  USING (public.can_access_team_task(task_id));

CREATE OR REPLACE FUNCTION public.log_team_task_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.team_task_activity (task_id, org_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, NEW.org_id, v_actor, 'status', OLD.status, NEW.status);
  END IF;

  IF NEW.assignee_ids IS DISTINCT FROM OLD.assignee_ids THEN
    INSERT INTO public.team_task_activity (task_id, org_id, actor_id, field, old_value, new_value)
    VALUES (
      NEW.id, NEW.org_id, v_actor, 'assignees',
      array_to_string(OLD.assignee_ids, ','),
      array_to_string(NEW.assignee_ids, ',')
    );
  END IF;

  IF NEW.deadline IS DISTINCT FROM OLD.deadline THEN
    INSERT INTO public.team_task_activity (task_id, org_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, NEW.org_id, v_actor, 'deadline', OLD.deadline::text, NEW.deadline::text);
  END IF;

  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    INSERT INTO public.team_task_activity (task_id, org_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, NEW.org_id, v_actor, 'priority', OLD.priority::text, NEW.priority::text);
  END IF;

  IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    INSERT INTO public.team_task_activity (task_id, org_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, NEW.org_id, v_actor, 'project', OLD.project_id::text, NEW.project_id::text);
  END IF;

  -- `name` est journalisé sans les valeurs : savoir QUE le titre a changé
  -- suffit, et stocker les anciens libellés ferait du journal une copie
  -- intégrale du contenu, avec la charge RGPD correspondante.
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    INSERT INTO public.team_task_activity (task_id, org_id, actor_id, field, old_value, new_value)
    VALUES (NEW.id, NEW.org_id, v_actor, 'name', NULL, NULL);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_team_task_activity() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_team_task_activity() FROM anon;

-- AFTER : on ne journalise que ce qui a effectivement été écrit. En BEFORE,
-- une écriture annulée plus loin dans la chaîne laisserait une trace fausse.
DROP TRIGGER IF EXISTS trg_log_team_task_activity ON public.team_tasks;

CREATE TRIGGER trg_log_team_task_activity
  AFTER UPDATE ON public.team_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.log_team_task_activity();

COMMENT ON TABLE public.team_task_activity IS
  'Journal append-only des modifications de tâches d''équipe (mig. 094). Écrit UNIQUEMENT par trigger — aucune policy INSERT/UPDATE/DELETE, volontairement.';

-- ─── 094b — Durcissement (correctif immédiat) ─────────────────────
--
-- L'advisor `authenticated_security_definer_function_executable` s'est allumé
-- après application de la 094 : `REVOKE ... FROM PUBLIC` ne retire PAS le
-- GRANT que Supabase pose par défaut sur le rôle `authenticated`. La fonction
-- devenait donc appelable via /rest/v1/rpc/log_team_task_activity.
--
-- L'appel échouerait (une fonction RETURNS trigger ne peut être invoquée que
-- par un trigger), mais une fonction SECURITY DEFINER exposée à l'API publique
-- n'a aucune raison d'exister — c'est la surface que la mig. 064b avait déjà
-- nettoyée pour les autres fonctions de trigger. Leçon à retenir : sur ce
-- projet, REVOKE FROM PUBLIC ne suffit jamais, il faut nommer `authenticated`.
--
-- Le trigger continue de fonctionner : il s'exécute avec les droits du
-- propriétaire de la fonction, indépendamment des GRANT d'exécution.

REVOKE EXECUTE ON FUNCTION public.log_team_task_activity() FROM authenticated;

-- Même traitement pour les fonctions de la mig. 091 : SECURITY INVOKER (donc
-- hors advisors), mais rien ne justifie qu'elles soient appelables en RPC.
REVOKE EXECUTE ON FUNCTION public.sync_team_task_status() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_team_task_status() FROM anon;
REVOKE ALL ON FUNCTION public.sync_team_task_status() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.init_team_task_status() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.init_team_task_status() FROM anon;
REVOKE ALL ON FUNCTION public.init_team_task_status() FROM PUBLIC;

-- ─── 094c — Index sur les FK des mig. 092/093/094 ─────────────────
--
-- L'advisor `unindexed_foreign_keys` s'est allumé sur 4 FK introduites par ces
-- trois migrations. Ce n'est pas cosmétique : ces colonnes sont les cibles des
-- CASCADE / SET NULL déclenchés par `delete_organization` et par la suppression
-- de compte. Sans index, chacune de ces opérations impose un scan séquentiel
-- complet de la table référençante.
--
-- Ces index apparaîtront comme « unused » tant que les tables sont vides —
-- attendu, et c'est l'arbitrage déjà tranché par la mig. 044 (hygiène d'index) :
-- on indexe les clés étrangères, `unused_index` étant un signal de volumétrie
-- et non de correction.

CREATE INDEX IF NOT EXISTS idx_team_labels_created_by
  ON public.team_labels (created_by);

CREATE INDEX IF NOT EXISTS idx_team_task_subtasks_created_by
  ON public.team_task_subtasks (created_by);

CREATE INDEX IF NOT EXISTS idx_team_task_activity_actor
  ON public.team_task_activity (actor_id);

-- org_id : cible de la CASCADE de `delete_organization`, ET axe d'une future
-- vue « activité de toute l'entreprise ».
CREATE INDEX IF NOT EXISTS idx_team_task_activity_org
  ON public.team_task_activity (org_id, created_at DESC);
