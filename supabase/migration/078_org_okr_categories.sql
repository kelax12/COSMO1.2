-- ═══════════════════════════════════════════════════════════════════
-- 078_org_okr_categories.sql — Catégories d'OKR d'entreprise (partagées)
-- ═══════════════════════════════════════════════════════════════════
--
-- Vrai système de catégories pour les OKR d'équipe (parité mode perso) :
-- entités org-scopées (nom + couleur), partagées par tous les membres.
-- Les managers/admins les créent et les suppriment. `team_okrs.category`
-- (colonne texte existante) stocke le NOM de la catégorie ; la couleur est
-- résolue via cette table côté client. Aucune modif de team_okrs.

CREATE TABLE IF NOT EXISTS public.org_okr_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name       TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  color      TEXT NOT NULL DEFAULT '#6366f1',
  created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_org_okr_categories_org ON public.org_okr_categories(org_id);

ALTER TABLE public.org_okr_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_okr_categories_select" ON public.org_okr_categories;
CREATE POLICY "org_okr_categories_select"
  ON public.org_okr_categories FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "org_okr_categories_insert" ON public.org_okr_categories;
CREATE POLICY "org_okr_categories_insert"
  ON public.org_okr_categories FOR INSERT
  WITH CHECK (public.is_org_manager(org_id) AND created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "org_okr_categories_update" ON public.org_okr_categories;
CREATE POLICY "org_okr_categories_update"
  ON public.org_okr_categories FOR UPDATE
  USING (public.is_org_manager(org_id))
  WITH CHECK (public.is_org_manager(org_id));

DROP POLICY IF EXISTS "org_okr_categories_delete" ON public.org_okr_categories;
CREATE POLICY "org_okr_categories_delete"
  ON public.org_okr_categories FOR DELETE
  USING (public.is_org_manager(org_id));
