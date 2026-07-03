-- ═══════════════════════════════════════════════════════════════════
-- Migration 053 — Colonne updated_at sur public.tasks (#40 UX)
--
-- Le point #40 (« modifiée il y a 2 h » sur les cartes de collaboration)
-- lit task.updatedAt (mappers.ts → row.updated_at), mais la colonne
-- n'existait pas en prod : le statut ne s'affichait jamais.
--
-- Ajoute `updated_at timestamptz` (défaut now()) + trigger BEFORE UPDATE
-- qui la met à jour automatiquement. Lecture seule côté client :
-- mapTaskToDb n'émet jamais updated_at (géré serveur uniquement).
--
-- Sécurité : RLS inchangée ; additif et réversible.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.tasks.updated_at IS
  'Dernière modification (trigger serveur — lecture seule client, #40).';

CREATE OR REPLACE FUNCTION public.set_tasks_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tasks_updated_at();
