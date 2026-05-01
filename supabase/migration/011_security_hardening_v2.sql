-- ═══════════════════════════════════════════════════════════════════
-- Migration 011 — Security hardening v2 (compléments à 010)
-- - N1 : subscriptions UPDATE sans WITH CHECK + sans trigger user_id
-- - N2 : shared_tasks UPDATE sans WITH CHECK
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. subscriptions : verrouille la mutation user_id + WITH CHECK ──
DROP POLICY IF EXISTS "Users can update own subscription" ON subscriptions;

CREATE POLICY "Users can update own subscription"
  ON subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ajoute le trigger prevent_user_id_change si la fonction existe (créée en 010)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'prevent_user_id_change') THEN
    DROP TRIGGER IF EXISTS trg_prevent_user_id_change ON subscriptions;
    CREATE TRIGGER trg_prevent_user_id_change
      BEFORE UPDATE ON subscriptions
      FOR EACH ROW EXECUTE FUNCTION prevent_user_id_change();
  END IF;
END $$;

-- ─── 2. shared_tasks UPDATE : ajoute WITH CHECK ──────────────────────
DROP POLICY IF EXISTS "Owners can update shared_tasks" ON shared_tasks;

CREATE POLICY "Owners can update shared_tasks"
  ON shared_tasks FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM tasks WHERE tasks.id = shared_tasks.task_id AND tasks.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM tasks WHERE tasks.id = shared_tasks.task_id AND tasks.user_id = auth.uid())
  );
