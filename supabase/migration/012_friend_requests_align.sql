-- ═══════════════════════════════════════════════════════════════════
-- Migration 012 — Alignement friend_requests sur le schéma de prod
--
-- La migration 007_friends.sql définissait friend_requests avec une
-- colonne `user_id` (sender). En prod, le schéma a évolué via le
-- dashboard Supabase pour utiliser `sender_id` / `receiver_id` / `sender_email`,
-- avec triggers de remplissage automatique et fonction SECURITY DEFINER pour
-- l'acceptation. Cette migration reproduit cet état pour qu'un projet
-- Supabase neuf déployé depuis le repo soit fonctionnel.
--
-- Idempotente : peut être ré-exécutée sans erreur sur la prod existante.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Colonnes ─────────────────────────────────────────────────────
ALTER TABLE friend_requests ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE friend_requests ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE friend_requests ADD COLUMN IF NOT EXISTS sender_email TEXT;

-- Backfill depuis user_id si la colonne existe encore (anciennes installations)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'friend_requests' AND column_name = 'user_id'
  ) THEN
    EXECUTE 'UPDATE friend_requests SET sender_id = user_id WHERE sender_id IS NULL';
  END IF;
END $$;

-- ─── 2. Triggers de remplissage ──────────────────────────────────────

-- trg_set_receiver_id : résout l'email du destinataire en user_id
CREATE OR REPLACE FUNCTION set_friend_request_receiver_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.receiver_id IS NULL AND NEW.email IS NOT NULL THEN
    SELECT id INTO NEW.receiver_id FROM auth.users WHERE auth.users.email = NEW.email LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_set_receiver_id ON friend_requests;
CREATE TRIGGER trg_set_receiver_id
  BEFORE INSERT OR UPDATE OF email ON friend_requests
  FOR EACH ROW EXECUTE FUNCTION set_friend_request_receiver_id();

-- trg_set_sender_email : remplit sender_email depuis sender_id
CREATE OR REPLACE FUNCTION set_friend_request_sender_email()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sender_email IS NULL AND NEW.sender_id IS NOT NULL THEN
    SELECT email INTO NEW.sender_email FROM auth.users WHERE auth.users.id = NEW.sender_id LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_set_sender_email ON friend_requests;
CREATE TRIGGER trg_set_sender_email
  BEFORE INSERT OR UPDATE OF sender_id ON friend_requests
  FOR EACH ROW EXECUTE FUNCTION set_friend_request_sender_email();

-- ─── 3. Index ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender_id ON friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver_id ON friend_requests(receiver_id);

-- ─── 4. Fonction accept_friend_request (SECURITY DEFINER) ────────────
-- Crée l'amitié bidirectionnelle après vérification que l'appelant est bien
-- le destinataire de la demande.
CREATE OR REPLACE FUNCTION accept_friend_request(request_id UUID)
RETURNS void AS $$
DECLARE
  req RECORD;
  sender_user RECORD;
  receiver_user RECORD;
BEGIN
  SELECT * INTO req FROM friend_requests WHERE id = request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found';
  END IF;

  IF req.receiver_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the receiver can accept this request';
  END IF;

  IF req.status <> 'pending' THEN
    RAISE EXCEPTION 'Request already processed';
  END IF;

  SELECT id, email, raw_user_meta_data INTO sender_user FROM auth.users WHERE id = req.sender_id;
  SELECT id, email, raw_user_meta_data INTO receiver_user FROM auth.users WHERE id = req.receiver_id;

  -- Insertion amitié côté receiver → voit le sender
  INSERT INTO friends (user_id, name, email)
  VALUES (
    receiver_user.id,
    COALESCE(sender_user.raw_user_meta_data->>'name', split_part(sender_user.email, '@', 1)),
    sender_user.email
  )
  ON CONFLICT (user_id, email) DO NOTHING;

  -- Insertion amitié côté sender → voit le receiver
  INSERT INTO friends (user_id, name, email)
  VALUES (
    sender_user.id,
    COALESCE(receiver_user.raw_user_meta_data->>'name', split_part(receiver_user.email, '@', 1)),
    receiver_user.email
  )
  ON CONFLICT (user_id, email) DO NOTHING;

  UPDATE friend_requests SET status = 'accepted' WHERE id = request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION accept_friend_request(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION accept_friend_request(UUID) TO authenticated;

-- ─── 5. Contraintes ──────────────────────────────────────────────────
-- sender_id ne devient NOT NULL qu'une fois la backfill faite (on ne force
-- pas pour ne pas casser une prod ancienne)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM friend_requests WHERE sender_id IS NULL
  ) THEN
    ALTER TABLE friend_requests ALTER COLUMN sender_id SET NOT NULL;
  END IF;
END $$;
