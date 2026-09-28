-- ═══════════════════════════════════════════════════════════════════
-- 200 · Retrait des cycles d'OKR, de la capacité hebdomadaire et des liens
--       hiérarchiques secondaires (mode Entreprise, 2026-09-28)
--
-- ⚠️ ÉCRITE LE 2026-09-28, NON APPLIQUÉE. Ordre : APRÈS 160 et 196.
--
-- Les trois fonctionnalités ont quitté le front le 2026-09-28 (commits
-- ea7d47e6 et a88b7864) : elles compliquaient le produit pour peu d'apport.
-- Aucun écran ne lit ni n'écrit plus ces objets.
--
-- Relu en production le 2026-09-28, avant écriture :
--   · `okr_cycles`, `org_member_capacity`, `org_member_secondary_managers` :
--     0 ligne chacune ; `team_okrs.cycle_id` non NULL : 0 ligne. Rien à perdre ;
--   · aucune vue ne dépend de ces tables ;
--   · trois fonctions seulement les citent : les deux gardes de la 196, et
--     `validate_team_okr_parent` (160), réécrite ici SANS le contrôle de cycle.
--
-- Le trigger `trg_validate_team_okr_parent` porte `UPDATE OF ..., cycle_id` :
-- il est recréé AVANT de retirer la colonne, sinon le DROP COLUMN échoue.
--
-- ⚠️ Irréversible pour les données éventuelles de `org_member_capacity` et
-- `org_member_secondary_managers`. Retour arrière du schéma : rejouer 160
-- (partie cycles) et 196.
--
-- Les entrées de ces deux tables dans `check-erasure-coverage.mjs` et
-- `check-portability-export.mjs` RESTENT : ces gardes lisent les
-- `CREATE TABLE` de la 196, qui est toujours au dépôt.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Cycles d'OKR ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.validate_team_okr_parent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.parent_okr_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.team_okrs WHERE id = NEW.parent_okr_id AND org_id = NEW.org_id) THEN
    RAISE EXCEPTION 'okr_parent_not_in_org';
  END IF;
  IF EXISTS (
    WITH RECURSIVE up(id, depth) AS (
      SELECT NEW.parent_okr_id, 0
      UNION ALL
      SELECT o.parent_okr_id, u.depth + 1
        FROM public.team_okrs o JOIN up u ON o.id = u.id
       WHERE o.parent_okr_id IS NOT NULL AND u.depth < 20
    )
    SELECT 1 FROM up WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'okr_parent_cycle';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.validate_team_okr_parent() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_validate_team_okr_parent ON public.team_okrs;
CREATE TRIGGER trg_validate_team_okr_parent
  BEFORE INSERT OR UPDATE OF parent_okr_id ON public.team_okrs
  FOR EACH ROW EXECUTE FUNCTION public.validate_team_okr_parent();

DROP INDEX IF EXISTS public.idx_team_okrs_cycle;
ALTER TABLE public.team_okrs DROP COLUMN IF EXISTS cycle_id;
DROP TABLE IF EXISTS public.okr_cycles;

-- ── 2. Capacité hebdomadaire ───────────────────────────────────────

DROP TABLE IF EXISTS public.org_member_capacity;
DROP FUNCTION IF EXISTS public.org_member_capacity_before_write();

-- ── 3. Liens hiérarchiques secondaires ─────────────────────────────

DROP TABLE IF EXISTS public.org_member_secondary_managers;
DROP FUNCTION IF EXISTS public.org_member_secondary_before_insert();

COMMIT;

-- ── Vérification après application (catalogue, pas ledger) ─────────
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
--    AND table_name IN ('okr_cycles', 'org_member_capacity', 'org_member_secondary_managers'); -- 0
-- SELECT column_name FROM information_schema.columns WHERE table_schema = 'public'
--    AND table_name = 'team_okrs' AND column_name = 'cycle_id';                               -- 0
-- SELECT pg_get_functiondef('public.validate_team_okr_parent'::regproc);    -- sans « cycle_id »
-- SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgname = 'trg_validate_team_okr_parent';
--    -- « UPDATE OF parent_okr_id » seul
