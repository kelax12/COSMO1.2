-- ═══════════════════════════════════════════════════════════════════
-- 037 — kr_completions: cascade-delete completions when their KR is deleted
-- ═══════════════════════════════════════════════════════════════════
--
-- Bug (medium, non-UI data integrity):
--   `kr_completions` (the append-only journal feeding the dashboard "KR
--   réalisés" graph) had a FK only on `okr_id` (→ okrs ON DELETE CASCADE).
--   It had NO constraint on `kr_id`. So deleting a SINGLE Key Result from an
--   OKR (via the client `syncKRsToTable`, which DELETEs the key_results row)
--   left that KR's completion rows orphaned in the journal — they kept being
--   counted in the dashboard graph forever (silent over-count).
--
-- Fix:
--   Add `kr_completions.kr_id` → `key_results(id) ON DELETE CASCADE`. Removing
--   a KR now removes its journal rows automatically, at the DB level (no hot
--   client-path change, no risk to the load-bearing record/read logic).
--
-- Safety verified against prod (project ykeugqfgklejcdbrmawy, 2026-06-07):
--   - 0 orphaned rows (every kr_completions.kr_id already matches a
--     key_results.id), so the constraint validates without data loss.
--   - `recordKRReps` always runs AFTER `syncKRsToTable`, so future inserts
--     always reference an existing key_results row → FK never blocks a write.
--
-- Idempotent: safe to re-run.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Defensive: drop any completion whose KR no longer exists (currently 0).
--    An orphaned kr_id means the KR was already deleted, so its journal rows
--    should not survive anyway.
DELETE FROM public.kr_completions kc
WHERE kc.kr_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.key_results kr WHERE kr.id = kc.kr_id);

-- 2. Enforce cascade going forward.
ALTER TABLE public.kr_completions
  DROP CONSTRAINT IF EXISTS kr_completions_kr_id_fkey;

ALTER TABLE public.kr_completions
  ADD CONSTRAINT kr_completions_kr_id_fkey
  FOREIGN KEY (kr_id)
  REFERENCES public.key_results(id)
  ON DELETE CASCADE;
