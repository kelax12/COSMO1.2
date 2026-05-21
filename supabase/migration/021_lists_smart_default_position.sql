-- ═══════════════════════════════════════════════════════════════════
-- Migration 021 — Lists : smart rules + default + position (drag-to-reorder)
-- ═══════════════════════════════════════════════════════════════════
-- Ajoute 4 colonnes optionnelles à `lists` :
--   - type         : 'manual' (défaut) ou 'smart'
--   - smart_rule   : preset name (overdue, this-week, no-deadline, ...)
--   - is_default   : épingle UNE liste comme sélectionnée par défaut
--   - position     : ordre d'affichage (drag-to-reorder)
--
-- Toutes optionnelles, rétro-compatibles : les listes existantes
-- restent 'manual' et conservent leur ordre alphabétique tant qu'une
-- position n'est pas posée.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE lists
  ADD COLUMN IF NOT EXISTS type        TEXT    NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS smart_rule  TEXT,
  ADD COLUMN IF NOT EXISTS is_default  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS position    INTEGER;

-- Contrainte : type doit être l'un des deux valeurs autorisées
ALTER TABLE lists
  DROP CONSTRAINT IF EXISTS lists_type_check;
ALTER TABLE lists
  ADD CONSTRAINT lists_type_check CHECK (type IN ('manual', 'smart'));

-- Contrainte : smart_rule doit être nul OU dans la whitelist
ALTER TABLE lists
  DROP CONSTRAINT IF EXISTS lists_smart_rule_check;
ALTER TABLE lists
  ADD CONSTRAINT lists_smart_rule_check CHECK (
    smart_rule IS NULL OR smart_rule IN (
      'overdue', 'this-week', 'no-deadline', 'high-priority', 'bookmarked'
    )
  );

-- Une seule liste par défaut par utilisateur (index partiel unique)
DROP INDEX IF EXISTS idx_lists_one_default_per_user;
CREATE UNIQUE INDEX idx_lists_one_default_per_user
  ON lists(user_id) WHERE is_default = TRUE;

-- Index pour le tri par position (avec fallback name si position est null)
DROP INDEX IF EXISTS idx_lists_user_position;
CREATE INDEX idx_lists_user_position ON lists(user_id, position NULLS LAST, name);
