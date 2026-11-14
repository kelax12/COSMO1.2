-- ═══════════════════════════════════════════════════════════════════
-- 253 · Retrait de `tasks.deadline` (DAT-01, phase « contract »)
--
-- 🔴 À APPLIQUER SEULEMENT APRÈS la 251, ET après vérification :
--   1. la 251 est en production depuis au moins sept jours (onglets restés
--      sur un ancien bundle rechargés : `NewVersionBanner`) ;
--   2. relecture au catalogue : 0 tâche dont une seule des deux colonnes est
--      renseignée, et 0 écart entre `due_date` et `echeance_jour(deadline)`
--      (requêtes en tête de `supabase/proofs/253.proof.sql`) ;
--   3. la preuve 253 rend « PREUVE-ANNULEE 0 ECHEC ».
-- Rangée dans `supabase/migration-differee/` : aucune base rejouée ne la voit
-- (la CI teste l'état de transition, celui de la production). Le jour de
-- l'application, la DÉPLACER dans `supabase/migration/` dans le même commit
-- que la relecture du catalogue, puis régénérer le contrat de données.
--
-- Le front livré avec la 251 sert déjà cet état (`deadline-columns.ts`), et
-- `toggle_task_complete_v2` n'écrit plus que `due_date` depuis la 251 : ce
-- fichier ne recrée rien, il retire.
--
-- Rejouable : sans `deadline`, le contrôle ne lit rien et les DROP sont
-- `IF EXISTS`. Preuve : `supabase/proofs/253.proof.sql`.
-- ═══════════════════════════════════════════════════════════════════

DO $garde$
DECLARE
  n bigint;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'deadline'
  ) THEN
    EXECUTE $q$
      SELECT count(*) FROM public.tasks
       WHERE (deadline IS NULL) <> (due_date IS NULL)
          OR (deadline IS NOT NULL AND due_date <> public.echeance_jour(deadline)
              AND due_date <> (deadline AT TIME ZONE 'Europe/Paris')::date)
    $q$ INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION '253 : % tâche(s) dont due_date ne correspond pas à deadline, rien n''est retiré', n;
    END IF;
  END IF;
END
$garde$;

DROP TRIGGER IF EXISTS trg_tasks_sync_echeance ON public.tasks;
DROP FUNCTION IF EXISTS public.tasks_sync_echeance();
DROP INDEX IF EXISTS public.idx_tasks_deadline;
ALTER TABLE public.tasks DROP COLUMN IF EXISTS deadline;

COMMENT ON COLUMN public.tasks.due_date IS
  'Échéance FACULTATIVE, un jour (mig. 251). NULL = aucune échéance. Seule colonne d''échéance depuis la mig. 253.';
