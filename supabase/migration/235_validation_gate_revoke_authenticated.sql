-- ═══════════════════════════════════════════════════════════════════
-- 235 · Porte de validation : EXECUTE retiré à `authenticated` (2026-10-31)
--
-- La 233 révoquait `team_task_validation_gate()` pour PUBLIC et anon
-- seulement. Relu au catalogue le 2026-10-31 : `authenticated` gardait
-- EXECUTE (GRANT par défaut de Supabase, que REVOKE FROM PUBLIC ne retire
-- pas, mig. 094b). Une fonction de trigger n'est pas appelable directement,
-- mais elle reste visible des advisors et noie le signal (finding B-3).
-- Le déclenchement du trigger ne dépend pas de ce droit.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

REVOKE ALL ON FUNCTION public.team_task_validation_gate() FROM PUBLIC, anon, authenticated;

COMMIT;
