-- ═══════════════════════════════════════════════════════════════════
-- 038 — Backfill the key_results table from legacy JSONB (faille D-2, step 1)
-- ═══════════════════════════════════════════════════════════════════
--
-- Context (verified on prod ykeugqfgklejcdbrmawy, 2026-06-07):
--   5 OKRs, all 5 store their KRs in the legacy JSONB column `okrs.key_results`,
--   but only 1 has rows in the dedicated `key_results` table. The repository's
--   `fetchKRsForOkrs` falls back to the JSONB when the table is empty for an OKR
--   — and that JSONB uses the LEGACY shape `{id, unit, title, target, current,
--   history}`, NOT the table shape (`current_value`, `target_value`,
--   `estimated_time`, `completed`). Consumed as a `KeyResult`, `target`/`current`
--   don't map to `targetValue`/`currentValue` → the UI shows broken values and
--   StatisticsPage computes `okrTime` as NaN.
--
-- This migration translates the JSONB into proper table rows so the table
-- becomes the single, correctly-typed source of truth. It does NOT touch the
-- JSONB column (it stays as an archive and as the load-bearing fallback for any
-- not-yet-migrated OKR — see CLAUDE.md / faille.md D-2; do NOT drop it without a
-- separate, reviewed migration).
--
-- Mapping:
--   current → current_value, target → target_value, title, unit verbatim,
--   estimated_time = 0 (absent from JSONB), completed = (target>0 AND current>=target),
--   id = fresh UUID (legacy ids like "kr1" are not UUIDs and cannot live in the
--   uuid PK column).
--
-- Safety:
--   - Only OKRs with NO existing table rows are backfilled (NOT EXISTS guard),
--     so the 1 already-migrated OKR is untouched and re-running is a no-op.
--   - `estimated_time = 0` keeps the StatisticsPage `history × estimated_time`
--     contribution at 0 — identical to the empty-table path → no stats change,
--     while fixing the broken current/target values.
--   - Validated via a BEGIN…ROLLBACK dry-run against prod before commit.
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO public.key_results
  (id, okr_id, user_id, title, unit, current_value, target_value, estimated_time, completed)
SELECT
  gen_random_uuid(),
  o.id,
  o.user_id,
  COALESCE(elem->>'title', ''),
  COALESCE(elem->>'unit', ''),
  COALESCE((elem->>'current')::numeric, 0),
  COALESCE((elem->>'target')::numeric, 0),
  0,
  (
    COALESCE((elem->>'target')::numeric, 0) > 0
    AND COALESCE((elem->>'current')::numeric, 0) >= COALESCE((elem->>'target')::numeric, 0)
  )
FROM public.okrs o
CROSS JOIN LATERAL jsonb_array_elements(o.key_results) AS elem
WHERE o.key_results IS NOT NULL
  AND jsonb_array_length(o.key_results) > 0
  AND NOT EXISTS (
    SELECT 1 FROM public.key_results kr WHERE kr.okr_id = o.id
  );
