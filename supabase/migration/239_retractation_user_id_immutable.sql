-- ═══════════════════════════════════════════════════════════════════
-- 239 · `user_id` immuable sur les tables de la 237 (checklist V1)
-- ═══════════════════════════════════════════════════════════════════
--
-- La 237 a créé `billing_acceptances` et `org_withdrawals` avec un `user_id`
-- sans le trigger `prevent_user_id_change` exigé sur toute table qui en porte
-- un (mass-assignment V1, `validate:migrations` règle 15). Correctif sous son
-- propre numéro : la 237 est en prod (ledger `20261101143758`).
--
-- `billing_acceptances` refusait déjà tout changement de `user_id` par son
-- trigger append-only : le second trigger y est redondant, il aligne la
-- table sur la règle commune. `org_withdrawals` n'avait aucune protection.
-- Aucun `user_id` n'y porte de FK : la suppression de compte ne déclenche
-- aucun UPDATE (décision `conserve`, scripts/check-erasure-coverage.mjs).

CREATE OR REPLACE TRIGGER trg_billing_acceptances_user_id_immutable
  BEFORE UPDATE ON public.billing_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();

CREATE OR REPLACE TRIGGER trg_org_withdrawals_user_id_immutable
  BEFORE UPDATE ON public.org_withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_id_change();
