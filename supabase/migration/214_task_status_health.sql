-- ═══════════════════════════════════════════════════════════════════
-- 214 · Statut et État des tâches PERSONNELLES (2026-10-08)
--
-- ── LE PROBLÈME ────────────────────────────────────────────────────
--
-- Une tâche perso est « à faire » ou « terminée » (`tasks.completed`), et
-- rien d'autre. Le mode entreprise a depuis longtemps le Statut (mig. 091,
-- colonnes du Kanban) et l'État (mig. 204, Dans les temps / À risque / En
-- difficulté). Le perso n'avait ni l'un ni l'autre, donc pas de Tableau.
--
-- ── CE QUE FAIT CETTE MIGRATION ─────────────────────────────────────
--
--   · `status` : todo, in_progress, blocked, done. QUATRE valeurs et non
--     cinq : `review` est retiré exprès (décision d'Axel, 2026-10-08), une
--     relecture n'a pas de sens pour une personne seule.
--   · `health` : on_track, at_risk, off_track, ou NULL. Même vocabulaire que
--     `team_tasks.health` (mig. 204). « Atteint » n'est pas une valeur : c'est
--     `completed`.
--   · Un trigger garde `status` et `completed` d'accord dans LES DEUX SENS,
--     construction de la mig. 091. Le front actuel, qui n'écrit que
--     `completed`, continue de marcher sans changer une ligne.
--
-- ── CE QUI N'EST PAS TOUCHÉ, ET POURQUOI ───────────────────────────
--
--   · Aucune policy : les deux colonnes relèvent de `tasks_update_own_or_editor`
--     (propriétaire, ou collaborateur `editor` ayant accepté). Une seconde
--     policy PERMISSIVE est interdite (mig. 049).
--   · Aucun GRANT : `authenticated` a INSERT / UPDATE au niveau TABLE sur
--     `tasks`, relu au catalogue le 2026-10-08. Une colonne nouvelle en hérite.
--   · `get_my_tasks` / `get_pending_shared_tasks` sont `SETOF public.tasks` :
--     elles rendent les deux colonnes d'office.
--   · `toggle_task_complete_v2` : elle écrit `completed`, le trigger suit. Son
--     INSERT d'occurrence a une liste de colonnes EXPLICITE (relue au
--     catalogue le 2026-10-08) : l'occurrence naît `todo`, sans état.
--
-- ── RÈGLE DE SYNCHRONISATION (miroir : src/modules/tasks/status-sync.ts) ──
--
--   INSERT : completed → status = done ; status = done → completed (+ date).
--   UPDATE où `completed` bouge (case à cocher, RPC) : il décide.
--     → true : status = done (+ date si absente). → false : date effacée,
--       et status = todo s'il valait done.
--   UPDATE où seul `status` bouge (Tableau, fiche) : il décide.
--     → done : completed = true (+ date). Quitter done : completed = false,
--       completed_at = NULL.
--
-- Réversible par deux DROP COLUMN et un DROP FUNCTION : ce qui compte ici,
-- le projet étant sans PITR (faille.md A-9).
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Les colonnes ──────────────────────────────────────────────

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'todo',
  ADD COLUMN IF NOT EXISTS health TEXT;

-- Un CHECK plutôt qu'un ENUM, pour la raison de la mig. 091 : il se remplace
-- par un simple ALTER de contrainte.
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_status_check,
  ADD CONSTRAINT tasks_status_check
    CHECK (status IN ('todo', 'in_progress', 'blocked', 'done')),
  DROP CONSTRAINT IF EXISTS tasks_health_check,
  ADD CONSTRAINT tasks_health_check
    CHECK (health IS NULL OR health IN ('on_track', 'at_risk', 'off_track'));

-- ─── 2. Reprise de l'existant ─────────────────────────────────────

-- Ce qui est terminé devient `done`. On ne devine JAMAIS `in_progress` : rien
-- dans la donnée ne permet de le savoir, et un état inventé ferait mentir le
-- premier Tableau ouvert.
UPDATE public.tasks
   SET status = 'done'
 WHERE completed = true
   AND status <> 'done';

-- ─── 3. Cohérence bidirectionnelle ────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_task_status()
RETURNS trigger
LANGUAGE plpgsql
-- SECURITY INVOKER (défaut) : un trigger ne doit rien pouvoir faire que
-- l'appelant ne puisse déjà faire (mig. 108, finding B-3).
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.completed THEN
      NEW.status := 'done';
    ELSIF NEW.status = 'done' THEN
      NEW.completed := true;
      NEW.completed_at := COALESCE(NEW.completed_at, now());
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.completed IS DISTINCT FROM OLD.completed THEN
    -- `completed` a bougé (case à cocher, toggle_task_complete_v2) : il décide.
    -- `completed_at` suit, comme le fait déjà la RPC : une écriture directe
    -- de `completed` laissait sinon une date de fin sur une tâche ouverte.
    IF NEW.completed THEN
      NEW.status := 'done';
      NEW.completed_at := COALESCE(NEW.completed_at, now());
    ELSE
      NEW.completed_at := NULL;
      IF NEW.status = 'done' THEN
        NEW.status := 'todo';
      END IF;
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Seul le statut a bougé (Tableau, fiche) : il décide.
    IF NEW.status = 'done' THEN
      NEW.completed := true;
      NEW.completed_at := COALESCE(NEW.completed_at, now());
    ELSIF OLD.status = 'done' THEN
      NEW.completed := false;
      NEW.completed_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_status_sync ON public.tasks;
CREATE TRIGGER trg_tasks_status_sync
  BEFORE INSERT OR UPDATE OF completed, status ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.sync_task_status();

-- Règle 064b / 094b, mise en forme par la mig. 109 : aucune fonction de
-- trigger exécutable par `anon` ni `authenticated`, et `authenticated`
-- EXPLICITEMENT (REVOKE FROM PUBLIC ne retire pas le GRANT par défaut de
-- Supabase). Le privilège est vérifié au CREATE TRIGGER, pas au déclenchement.
REVOKE ALL ON FUNCTION public.sync_task_status() FROM PUBLIC, anon, authenticated;

COMMENT ON COLUMN public.tasks.status IS
  'Statut perso (mig. 214) : todo, in_progress, blocked, done. Tenu d''accord avec completed par trg_tasks_status_sync.';
COMMENT ON COLUMN public.tasks.health IS
  'État déclaré (mig. 214) : on_track, at_risk, off_track, NULL. Même vocabulaire que team_tasks.health (mig. 204).';

COMMIT;
