-- ═══════════════════════════════════════════════════════════════════
-- Table subscriptions — Source de vérité pour le statut premium
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  current_period_end TIMESTAMPTZ,
  premium_tokens INTEGER NOT NULL DEFAULT 0,
  win_streak INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Active RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Un utilisateur ne peut lire que SA propre ligne
CREATE POLICY \"Users can read own subscription\"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Un utilisateur peut insérer sa propre ligne (à la création du compte)
CREATE POLICY \"Users can insert own subscription\"
  ON subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Un utilisateur peut mettre à jour uniquement ses tokens et streak (pas son plan)
-- La mise à jour du plan doit passer par une Edge Function
CREATE POLICY \"Users can update own tokens\"
  ON subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND plan = (SELECT plan FROM subscriptions WHERE user_id = auth.uid()));

-- Index pour les lookups rapides
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
