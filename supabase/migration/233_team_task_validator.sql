-- ═══════════════════════════════════════════════════════════════════
-- 233 · Validation de tâche d'équipe, choisie à la création (2026-10-31)
--
-- ── LE PROBLÈME ────────────────────────────────────────────────────
--
-- « À valider » listait les tâches en statut `review` dont j'étais le
-- CRÉATEUR. Toute tâche déléguée revenait donc à son auteur, qu'il ait
-- voulu la relire ou non, et rien ne disait QUI devait valider.
--
-- ── CE QUE FAIT CETTE MIGRATION ─────────────────────────────────────
--
--   · `team_tasks.validator_id` : NULL (défaut) = aucune validation, une
--     tâche cochée est terminée. Renseigné = cette personne valide.
--   · Trigger `trg_team_task_validation_gate` (INVOKER), BEFORE UPDATE. Il
--     s'exécute APRÈS `trg_sync_team_task_status` (ordre alphabétique des
--     triggers BEFORE : « sync » < « team ») : il voit donc `completed` et
--     `status` déjà alignés. Si la tâche a un validateur et qu'un AUTRE que
--     lui la termine, elle part en `review` au lieu de `done`. Seul le
--     validateur la passe en terminée.
--   · Le validateur doit être un membre actif de l'organisation.
--   · Changer le validateur d'une tâche existante : son créateur, le
--     validateur lui-même, ou un admin de l'organisation. Sans ça, l'assigné
--     retirait la validation puis cochait.
--
-- ── CE QUI N'EST PAS TOUCHÉ, ET POURQUOI ───────────────────────────
--
--   · Aucune policy : la colonne relève de la policy UPDATE existante.
--   · `get_my_team_tasks` est `SETOF public.team_tasks` : elle rend la
--     colonne d'office.
--   · Sans `auth.uid()` (job serveur, automatisation), la porte ne bloque
--     rien : elle garde un geste d'utilisateur, pas le système.
--   · Les tâches existantes naissent sans validateur : celles en `review`
--     y restent, déplaçables à la main comme avant.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.team_tasks
  ADD COLUMN IF NOT EXISTS validator_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- « À valider » filtre sur le validateur à l'intérieur d'une organisation.
CREATE INDEX IF NOT EXISTS idx_team_tasks_org_validator
  ON public.team_tasks (org_id, validator_id)
  WHERE validator_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.team_task_validation_gate()
RETURNS trigger
LANGUAGE plpgsql
-- SECURITY INVOKER (défaut) : un trigger BEFORE ne doit rien pouvoir faire
-- que l'appelant ne puisse déjà faire (mig. 108).
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF NEW.validator_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.validator_id IS DISTINCT FROM OLD.validator_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.organization_members m
        WHERE m.org_id = NEW.org_id AND m.user_id = NEW.validator_id
          AND m.suspended_at IS NULL
          AND (m.access_expires_at IS NULL OR m.access_expires_at > now())
     ) THEN
    RAISE EXCEPTION 'validator_not_member' USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.validator_id IS DISTINCT FROM OLD.validator_id
     AND v_uid <> OLD.created_by
     AND v_uid IS DISTINCT FROM OLD.validator_id
     AND NOT EXISTS (
       SELECT 1 FROM public.organization_members m
        WHERE m.org_id = OLD.org_id AND m.user_id = v_uid AND m.role = 'admin'
     ) THEN
    RAISE EXCEPTION 'validator_change_forbidden' USING ERRCODE = '42501';
  END IF;

  -- La porte : terminée par un autre que le validateur → à valider.
  IF NEW.validator_id IS NOT NULL
     AND NEW.completed AND NOT OLD.completed
     AND v_uid <> NEW.validator_id THEN
    NEW.completed := false;
    NEW.completed_at := NULL;
    NEW.status := 'review';
    NEW.custom_status_id := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.team_task_validation_gate() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_team_task_validation_gate ON public.team_tasks;
CREATE TRIGGER trg_team_task_validation_gate
  BEFORE INSERT OR UPDATE ON public.team_tasks
  FOR EACH ROW EXECUTE FUNCTION public.team_task_validation_gate();

COMMENT ON COLUMN public.team_tasks.validator_id IS
  'Qui valide la tâche (mig. 233). NULL = aucune validation : cochée, elle est terminée. Renseigné : terminée par un autre, elle passe en review.';

COMMIT;
