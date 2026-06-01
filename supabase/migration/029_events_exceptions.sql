-- Migration 029 : ajoute le champ exceptions sur la table events
-- Permet de supprimer une seule occurrence d'un événement récurrent
-- sans supprimer le master.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS exceptions text[] NOT NULL DEFAULT '{}';
