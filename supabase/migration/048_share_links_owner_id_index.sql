-- ═══════════════════════════════════════════════════════════════════
-- Migration 048 — Index de couverture sur la FK share_links.owner_id
--
-- Advisor Supabase `unindexed_foreign_keys` (0001) : la contrainte
-- `share_links_owner_id_fkey` (colonne owner_id) n'a pas d'index de
-- couverture. L'index composite existant `idx_share_links_task_owner`
-- (task_id, owner_id) ne compte PAS : Postgres exige owner_id en colonne
-- DE TÊTE pour couvrir la FK (sinon scan séquentiel sur les ON DELETE
-- CASCADE et les lookups par propriétaire — ex. listing des liens d'un
-- utilisateur, révocation, purge delete-account).
--
-- Impact : accélère (a) la cascade ON DELETE de auth.users → share_links,
-- (b) les requêtes `WHERE owner_id = auth.uid()` des policies SELECT/DELETE
-- de la table. Additif et réversible (DROP INDEX), aucune logique modifiée.
-- ═══════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_share_links_owner_id
  ON public.share_links (owner_id);
