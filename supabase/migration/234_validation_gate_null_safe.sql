-- ═══════════════════════════════════════════════════════════════════
-- 234 · Porte de validation : comparaison au créateur sûre face à NULL (2026-10-31)
--
-- La 233 écrivait `v_uid <> OLD.created_by`. `created_by` passe à NULL quand
-- son auteur supprime son compte ; `x <> NULL` vaut NULL, la garde ne se
-- déclenchait pas, et N'IMPORTE QUEL membre pouvait retirer le validateur
-- d'une telle tâche puis la cocher. `IS DISTINCT FROM` ferme ce trou : sans
-- créateur, seuls le validateur et un admin changent le validateur.
-- Trouvé par revue de sécurité du commit, 0 ligne concernée au moment du correctif.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

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
     AND v_uid IS DISTINCT FROM OLD.created_by
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

COMMIT;
