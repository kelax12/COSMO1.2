-- ═══════════════════════════════════════════════════════════════════
-- 044_index_hygiene.sql — hygiène d'index (advisors performance live 2026-06-11)
--
-- Source : `get_advisors(performance)` sur le projet prod —
--   - unindexed_foreign_keys (1) : friends.friend_user_id (FK vers auth.users
--     sans index → chaque DELETE auth.users / lookup FK scanne friends ; la
--     colonne est aussi sondée par le sous-EXISTS de shared_tasks_insert).
--   - duplicate_index (2) : les deux sur shared_tasks.
--   - unused_index (15) : index jamais utilisés d'après pg_stat_user_indexes.
--
-- Décision verrouillée (arbitrage humain) — 3 index « unused » CONSERVÉS
-- malgré l'advisor, car ils couvrent des accès réels susceptibles de
-- devenir chauds à plus gros volume :
--   - idx_tasks_deadline           (getByDate() filtre deadline)
--   - idx_friends_user_friend      (couvre le sous-EXISTS de shared_tasks_insert)
--   - idx_kr_completions_user_id   (lectures dashboard scoppées RLS par user)
--   - idx_subscriptions_stripe_customer_id (getUidFromCustomer du webhook
--     Stripe filtre eq(stripe_customer_id) — « unused » uniquement parce que
--     les webhooks tirent rarement ; à l'échelle c'est 1 ligne/user)
-- → on ne droppe que les 11 autres inutilisés + les 2 doublons confirmés.
-- ═══════════════════════════════════════════════════════════════════

-- ── FK non indexée (advisor unindexed_foreign_keys) ─────────────────
CREATE INDEX IF NOT EXISTS idx_friends_friend_user_id
  ON friends (friend_user_id);

-- idx_kr_completions_kr_id : signalé « unused » mais couvre la FK
-- kr_completions_kr_id_fkey (ON DELETE CASCADE, mig 037) — sans lui, chaque
-- DELETE de key_results scanne kr_completions. L'advisor post-apply l'a
-- confirmé (unindexed_foreign_keys) → conservé/recréé.
CREATE INDEX IF NOT EXISTS idx_kr_completions_kr_id
  ON kr_completions (kr_id);

-- ── Doublons shared_tasks (advisor duplicate_index) ─────────────────
-- idx_shared_tasks_task est un doublon exact de idx_shared_tasks_task_id (gardé).
DROP INDEX IF EXISTS idx_shared_tasks_task;
-- ux_shared_tasks_task_friend duplique shared_tasks_task_id_friend_id_key,
-- qui est adossé à la contrainte UNIQUE (vérifié via pg_constraint.conindid)
-- → on garde l'index de contrainte, on droppe le doublon orphelin.
DROP INDEX IF EXISTS ux_shared_tasks_task_friend;

-- ── Index jamais utilisés (advisor unused_index, stats live) ────────
-- Chaque index droppé est trivialement recréable si un pattern d'accès
-- l'exige plus tard ; ils coûtent en écriture (maintenance) pour zéro lecture.
DROP INDEX IF EXISTS idx_tasks_category;
DROP INDEX IF EXISTS idx_events_start_time;
DROP INDEX IF EXISTS idx_events_recurrence;
DROP INDEX IF EXISTS idx_okrs_completed;
DROP INDEX IF EXISTS idx_friends_email;
DROP INDEX IF EXISTS idx_friend_requests_sender_receiver_status;
DROP INDEX IF EXISTS idx_processed_stripe_events_created_at;
DROP INDEX IF EXISTS idx_lists_user_position;
DROP INDEX IF EXISTS idx_key_results_completed;
DROP INDEX IF EXISTS idx_key_results_completed_at;
