-- ═══════════════════════════════════════════════════════════════════
-- 111 — Catégories d'entreprise (team_categories) : distinctes des projets
--
-- Le mode entreprise n'a aujourd'hui qu'une seule dimension de classement
-- (le projet). Ce n'est pas la même chose qu'une catégorie : un projet est
-- une UNITÉ DE TRAVAIL (a une équipe, des tâches, un cycle de vie — archivé
-- un jour) ; une catégorie est une ÉTIQUETTE TRANSVERSE (« Marketing »,
-- « Support client »…) qui peut regrouper plusieurs projets et se retrouver
-- directement sur une tâche, indépendamment de son projet.
--
-- Même schéma que `org_okr_categories` (mig. 078), à une différence près :
-- ici la relation est un vrai FK (`category_id`), pas un nom recopié — un
-- projet/une tâche ne doit pas perdre sa catégorie si elle est renommée.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.team_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name       TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  color      TEXT NOT NULL DEFAULT '#6366f1',
  created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_team_categories_org ON public.team_categories(org_id);

ALTER TABLE public.team_categories ENABLE ROW LEVEL SECURITY;

-- Toute l'organisation lit les catégories (elles s'affichent sur les tâches
-- de tout le monde) ; seuls les managers/admins les créent, modifient,
-- suppriment — même partage des droits que les projets (mig. 062).
DROP POLICY IF EXISTS "team_categories_select" ON public.team_categories;
CREATE POLICY "team_categories_select"
  ON public.team_categories FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "team_categories_insert" ON public.team_categories;
CREATE POLICY "team_categories_insert"
  ON public.team_categories FOR INSERT
  WITH CHECK (public.is_org_manager(org_id) AND created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS "team_categories_update" ON public.team_categories;
CREATE POLICY "team_categories_update"
  ON public.team_categories FOR UPDATE
  USING (public.is_org_manager(org_id))
  WITH CHECK (public.is_org_manager(org_id));

DROP POLICY IF EXISTS "team_categories_delete" ON public.team_categories;
CREATE POLICY "team_categories_delete"
  ON public.team_categories FOR DELETE
  USING (public.is_org_manager(org_id));

-- ─── Rattachement projet / tâche ──────────────────────────────────────
--
-- ON DELETE SET NULL : supprimer une catégorie ne doit jamais supprimer les
-- projets/tâches qui la portaient, seulement les en détacher (même logique
-- que team_labels, mig. 093).

ALTER TABLE public.team_projects
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.team_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_team_projects_category ON public.team_projects(category_id);

ALTER TABLE public.team_tasks
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.team_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_team_tasks_category ON public.team_tasks(category_id);

-- Aucune policy nouvelle sur team_projects/team_tasks : `category_id` est une
-- colonne de plus sur des tables déjà couvertes par leurs policies UPDATE/
-- INSERT existantes (mig. 062) — le client la whiteliste explicitement dans
-- son propre mapToDb, comme toutes les autres colonnes.

COMMENT ON TABLE public.team_categories IS
  'Catégories d''entreprise (mig. 111) : étiquette transverse, distincte du projet. Un projet ET une tâche peuvent en porter une (team_projects.category_id, team_tasks.category_id).';
