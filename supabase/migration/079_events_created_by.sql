-- ═══════════════════════════════════════════════════════════════════
-- 079_events_created_by.sql — Auteur d'un événement (perso vs manager)
-- ═══════════════════════════════════════════════════════════════════
--
-- Quand un manager crée un événement dans l'agenda d'un subordonné
-- (createForUser, mig. 077), `user_id` = le subordonné (propriétaire) mais
-- l'AUTEUR est le manager. On trace l'auteur pour que le subordonné puisse
-- distinguer, dans son agenda perso, un événement pro (créé par son manager)
-- d'un événement perso — l'UI affiche alors l'avatar du créateur.
--
-- Backfill : les événements existants ont created_by = user_id (auto-créés).

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

UPDATE public.events SET created_by = user_id WHERE created_by IS NULL;

ALTER TABLE public.events ALTER COLUMN created_by SET DEFAULT auth.uid();
