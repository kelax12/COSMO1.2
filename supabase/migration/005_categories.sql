-- ═══════════════════════════════════════════════════════════════════
-- Migration 005 — Table categories
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6B7280',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name) -- Un utilisateur ne peut pas avoir deux catégories avec le même nom
);

-- RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY \"Users can read own categories\"
  ON categories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY \"Users can insert own categories\"
  ON categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY \"Users can update own categories\"
  ON categories FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY \"Users can delete own categories\"
  ON categories FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_categories_user_id ON categories(user_id);

-- Seed des catégories par défaut à la création d'un compte (via trigger)
CREATE OR REPLACE FUNCTION seed_default_categories()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO categories (user_id, name, color) VALUES
    (NEW.id, 'Personnel',  '#3B82F6'),
    (NEW.id, 'Travail',    '#EF4444'),
    (NEW.id, 'Santé',      '#10B981'),
    (NEW.id, 'Loisirs',    '#F59E0B'),
    (NEW.id, 'Finance',    '#8B5CF6');
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_seed_categories
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION seed_default_categories();
