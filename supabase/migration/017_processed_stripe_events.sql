-- ═══════════════════════════════════════════════════════════════════
-- 017_processed_stripe_events.sql
--
-- Stripe webhook idempotency. The `stripe-webhook` Edge Function inserts
-- one row per delivered event keyed by event.id; the unique violation on
-- replay short-circuits processing. Required to defend against:
--   - Stripe retries after transient 500s
--   - Out-of-order delivery (resurrects deleted subscriptions otherwise)
--
-- Faille N8. Drop the table to disable dedup; the webhook tolerates this
-- gracefully (it logs and proceeds), so it's safe to evolve.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS processed_stripe_events (
  id TEXT PRIMARY KEY,                          -- Stripe event.id
  event_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,              -- Stripe event.created
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_stripe_events_created_at
  ON processed_stripe_events (created_at DESC);

-- This table is only written by the service_role-backed webhook function.
-- Lock it down so no anon/authenticated client can read or write.
ALTER TABLE processed_stripe_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No client access to processed_stripe_events" ON processed_stripe_events;
CREATE POLICY "No client access to processed_stripe_events"
  ON processed_stripe_events FOR ALL
  USING (false)
  WITH CHECK (false);
