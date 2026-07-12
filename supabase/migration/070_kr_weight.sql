-- ═══════════════════════════════════════════════════════════════════
-- Migration 070 — Coefficient d'importance des Key Results
--
-- Ajoute une colonne `weight` (entier 1–10, défaut 1) aux KR personnels
-- (table `key_results`, mig. 008) et aux KR d'équipe (`team_key_results`,
-- mig. 063). La progression globale d'un OKR devient une moyenne pondérée
-- par ce coefficient (calcul côté client — recalcProgress / okrProgress).
--
-- Rétrocompat : DEFAULT 1 → tous les KR existants gardent une moyenne simple.
-- Idempotente (ADD COLUMN IF NOT EXISTS). RLS inchangée (pas de nouvelle
-- policy : `weight` est couvert par les policies existantes de chaque table).
-- Le JSONB `okrs.key_results` porte aussi `weight` (aucun DDL nécessaire).
-- ═══════════════════════════════════════════════════════════════════

-- ─── KR personnels ─────────────────────────────────────────────────
ALTER TABLE public.key_results
  ADD COLUMN IF NOT EXISTS weight INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'key_results_weight_range'
  ) THEN
    ALTER TABLE public.key_results
      ADD CONSTRAINT key_results_weight_range CHECK (weight BETWEEN 1 AND 10);
  END IF;
END $$;

-- ─── KR d'équipe (mode entreprise) ─────────────────────────────────
ALTER TABLE public.team_key_results
  ADD COLUMN IF NOT EXISTS weight INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'team_key_results_weight_range'
  ) THEN
    ALTER TABLE public.team_key_results
      ADD CONSTRAINT team_key_results_weight_range CHECK (weight BETWEEN 1 AND 10);
  END IF;
END $$;
