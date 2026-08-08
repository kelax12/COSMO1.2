-- ═══════════════════════════════════════════════════════════════════
-- 091 — Statuts de tâche d'équipe (item UX #9)
--
-- ── LE PROBLÈME ────────────────────────────────────────────────────
--
-- `team_tasks.completed` est un booléen. Une tâche est donc « à faire » ou
-- « terminée », et rien d'autre. Impossible de distinguer :
--
--   * ce qui est EN COURS de ce qui n'a jamais été commencé,
--   * ce qui attend une RELECTURE de ce qui est réellement fini,
--   * ce qui est BLOQUÉ de ce qui avance normalement.
--
-- Conséquence produit : le kanban existant ne peut colonner que par ASSIGNÉ,
-- ce qui est une vue de charge, pas une vue de flux. « Où en est-on ? » n'a
-- aucune réponse dans l'outil.
--
-- ── POURQUOI ADDITIF ET NON UN REMPLACEMENT ────────────────────────
--
-- `completed` est lu dans ~14 fichiers front (listes, stats, kanban, badges,
-- timeline, charge d'équipe) et écrit par `toggle`. Le renommer d'un coup
-- imposerait un déploiement atomique base+front, impossible ici : le front est
-- servi par Vercel et la base est migrée séparément. Entre les deux, l'app en
-- production lirait une colonne disparue.
--
-- On ajoute donc `status` À CÔTÉ de `completed`, et un trigger garde les deux
-- cohérents dans LES DEUX SENS. Conséquences :
--
--   * le front actuel, qui n'écrit que `completed`, continue de fonctionner
--     sans une ligne de changement ;
--   * le nouveau front peut écrire `status` ; `completed` suit tout seul, donc
--     les stats, badges et graphiques existants restent justes ;
--   * la migration est réversible par un simple DROP COLUMN — ce qui compte
--     ici, le projet étant sur un plan Supabase sans PITR (faille.md A-9).
--
-- ── RLS ────────────────────────────────────────────────────────────
--
-- Aucune policy nouvelle : `status` est une colonne de `team_tasks`, déjà
-- couverte par les policies de la mig. 062 (+ 072). On ne crée pas de seconde
-- policy PERMISSIVE (garde-fou CLAUDE.md / advisor multiple_permissive_policies).
--
-- Le trigger est SECURITY INVOKER (défaut) : il ne doit JAMAIS contourner la
-- RLS de l'appelant — leçon de l'audit du 2026-07-26, où un trigger de garde
-- en SECURITY DEFINER élargissait silencieusement les droits.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. La colonne ────────────────────────────────────────────────

ALTER TABLE public.team_tasks
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'todo';

-- Vocabulaire fermé. Un CHECK plutôt qu'un ENUM : ajouter une valeur à un
-- type ENUM exige ALTER TYPE, non transactionnel avant PG12 et toujours
-- pénible à annuler ; un CHECK se remplace par un simple ALTER de contrainte.
ALTER TABLE public.team_tasks
  DROP CONSTRAINT IF EXISTS team_tasks_status_check;

ALTER TABLE public.team_tasks
  ADD CONSTRAINT team_tasks_status_check
  CHECK (status IN ('todo', 'in_progress', 'review', 'blocked', 'done'));

-- ─── 2. Reprise de l'existant ─────────────────────────────────────

-- Les tâches déjà terminées deviennent 'done' ; toutes les autres restent
-- 'todo'. On ne devine PAS 'in_progress' : rien dans la donnée actuelle ne
-- permet de le savoir, et inventer un état ferait mentir le premier kanban
-- que l'équipe ouvrira.
UPDATE public.team_tasks
   SET status = 'done'
 WHERE completed = true
   AND status <> 'done';

-- ─── 3. Cohérence bidirectionnelle ────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_team_task_status()
RETURNS trigger
LANGUAGE plpgsql
-- SECURITY INVOKER (défaut) : ce trigger ne doit rien pouvoir faire que
-- l'appelant ne puisse déjà faire.
SET search_path = ''
AS $$
BEGIN
  -- Cas 1 : le client écrit `status` (nouveau front).
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'done' THEN
      NEW.completed := true;
      -- Ne pas écraser un completed_at déjà posé : la date de complétion
      -- d'origine est ce qui alimente vélocité et « terminées cette semaine ».
      NEW.completed_at := COALESCE(OLD.completed_at, now());
    ELSE
      NEW.completed := false;
      NEW.completed_at := NULL;
    END IF;

  -- Cas 2 : le client écrit `completed` (front actuel, inchangé).
  ELSIF NEW.completed IS DISTINCT FROM OLD.completed THEN
    IF NEW.completed THEN
      NEW.status := 'done';
      NEW.completed_at := COALESCE(NEW.completed_at, now());
    ELSE
      -- Décocher renvoie à 'todo' et non à l'état antérieur : on ne le
      -- connaît pas, et prétendre le restaurer serait une invention.
      NEW.status := 'todo';
      NEW.completed_at := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_team_task_status ON public.team_tasks;

CREATE TRIGGER trg_sync_team_task_status
  BEFORE UPDATE ON public.team_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_team_task_status();

-- L'insertion aussi : une tâche créée avec completed = true doit naître 'done'.
CREATE OR REPLACE FUNCTION public.init_team_task_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.completed THEN
    NEW.status := 'done';
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  ELSIF NEW.status = 'done' THEN
    NEW.completed := true;
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_init_team_task_status ON public.team_tasks;

CREATE TRIGGER trg_init_team_task_status
  BEFORE INSERT ON public.team_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.init_team_task_status();

-- ─── 4. Index ─────────────────────────────────────────────────────

-- Le kanban par statut filtre toujours sur l'organisation d'abord : l'index
-- composite sert donc les deux clauses, là où un index sur `status` seul
-- serait ignoré (cardinalité de 5 valeurs sur toute la plateforme).
CREATE INDEX IF NOT EXISTS idx_team_tasks_org_status
  ON public.team_tasks (org_id, status);

COMMENT ON COLUMN public.team_tasks.status IS
  'Statut de flux : todo | in_progress | review | blocked | done. Synchronisé avec `completed` par trigger dans les deux sens (mig. 091) — `completed` reste la colonne lue par le front existant.';
