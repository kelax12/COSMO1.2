-- ═══════════════════════════════════════════════════════════════════
-- Table messages — Persistance des messages de la messagerie
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id TEXT NOT NULL, -- Peut être un user_id ou un group_id
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Un utilisateur voit ses messages envoyés et reçus
CREATE POLICY \"Users see their own messages\"
  ON chat_messages FOR SELECT
  USING (auth.uid() = sender_id OR receiver_id = auth.uid()::text);

-- Un utilisateur peut envoyer des messages
CREATE POLICY \"Users can send messages\"
  ON chat_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Un utilisateur peut marquer ses messages reçus comme lus
CREATE POLICY \"Users can mark messages as read\"
  ON chat_messages FOR UPDATE
  USING (receiver_id = auth.uid()::text)
  WITH CHECK (receiver_id = auth.uid()::text);

CREATE INDEX idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX idx_chat_messages_receiver ON chat_messages(receiver_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at DESC);
