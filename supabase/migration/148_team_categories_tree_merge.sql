-- ═══════════════════════════════════════════════════════════════════
-- Migration 148 — Fusion des catégories d'entreprise + arbre (parité perso)
--
-- POURQUOI LA FUSION. Le mode entreprise portait DEUX tables de catégories
-- qui font la même chose : `org_okr_categories` (mig. 078, OKR d'équipe,
-- rattachement par NOM) et `team_categories` (mig. 111, tâches/projets,
-- rattachement par FK). Deux écrans de gestion, deux palettes, deux façons de
-- compter l'impact d'une suppression — pour une seule idée (« étiquette
-- transverse d'organisation »). `team_categories` est gardée comme table
-- unique : c'est déjà la version FK, donc celle des deux qui ne perd jamais
-- son rattachement à un renommage.
--
-- POURQUOI L'ARBRE. Même modèle que `categories` personnelles (mig. 143/144/
-- 147) : liste d'adjacence (`parent_id` + `position`), pas de `ltree` ni de
-- table de fermeture — reparenter une branche reste un UPDATE d'une ligne.
-- Le trigger ci-dessous est le même corps que `enforce_category_tree()`,
-- adapté à un compte scindé par ORGANISATION plutôt que par UTILISATEUR, et
-- écrit direction avec `node_id`/`node_depth` (jamais `depth` seul) : c'est
-- la collision de nom qui a fait échouer la 143 personnelle deux fois de
-- suite (144 puis 147) avant d'être vue.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Arbre sur team_categories ──────────────────────────────────────

ALTER TABLE public.team_categories
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.team_categories(id) ON DELETE NO ACTION,
  ADD COLUMN IF NOT EXISTS position  INTEGER NOT NULL DEFAULT 0;

-- Même arbitrage que la mig. 143 (voir son commentaire) : NO ACTION plutôt que
-- RESTRICT, pour qu'une suppression d'ORGANISATION (team_categories.org_id
-- REFERENCES organizations(id) ON DELETE CASCADE) emporte une branche entière
-- en un seul DELETE groupé sans se heurter à un parent qui « part avant » son
-- enfant dans la même requête.
COMMENT ON COLUMN public.team_categories.parent_id IS
  'Catégorie parente. NULL = racine. NO ACTION : supprimer un parent en laissant ses enfants est refusé en fin de requête, mais une branche entière peut partir dans un seul DELETE (suppression d''organisation).';

CREATE INDEX IF NOT EXISTS idx_team_categories_parent
  ON public.team_categories(org_id, parent_id);

-- Unicité par fratrie : deux index partiels, comme la mig. 143 (deux NULL ne
-- sont jamais égaux en Postgres — une contrainte sur (org_id, parent_id, name)
-- ne contraindrait rien entre racines).
ALTER TABLE public.team_categories DROP CONSTRAINT IF EXISTS team_categories_org_id_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS ux_team_categories_sibling_name
  ON public.team_categories(org_id, parent_id, name)
  WHERE parent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_team_categories_root_name
  ON public.team_categories(org_id, name)
  WHERE parent_id IS NULL;

-- ⚠️ SECURITY INVOKER (défaut) + REVOKE explicite PUBLIC/anon/authenticated,
-- comme `enforce_category_tree()` : un trigger BEFORE s'exécute avant le
-- WITH CHECK de la RLS, en DEFINER ses erreurs deviendraient un oracle sur des
-- lignes non lisibles (finding B-3).
CREATE OR REPLACE FUNCTION public.enforce_team_category_tree()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  ancestor        UUID;
  ancestor_org    UUID;
  depth           INTEGER := 1;
  hops            INTEGER := 0;
  branch_height   INTEGER := 1;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'A category cannot be its own parent';
  END IF;

  SELECT org_id INTO ancestor_org FROM public.team_categories WHERE id = NEW.parent_id;
  IF ancestor_org IS NULL THEN
    RAISE EXCEPTION 'Parent category does not exist';
  END IF;
  IF ancestor_org <> NEW.org_id THEN
    RAISE EXCEPTION 'A category must stay within a single organization';
  END IF;

  ancestor := NEW.parent_id;
  WHILE ancestor IS NOT NULL AND hops <= 64 LOOP
    IF ancestor = NEW.id THEN
      RAISE EXCEPTION 'This parent would create a cycle';
    END IF;
    depth := depth + 1;
    IF depth > 10 THEN
      RAISE EXCEPTION 'Category nesting is limited to 10 levels';
    END IF;
    SELECT parent_id INTO ancestor FROM public.team_categories WHERE id = ancestor;
    hops := hops + 1;
  END LOOP;

  -- Hauteur de la branche déplacée, pas seulement la profondeur du nœud écrit
  -- (même correctif que la mig. 147, avec le même `node_id`/`node_depth`
  -- pour ne jamais rejouer la collision de nom qui l'a fait échouer deux fois).
  WITH RECURSIVE branch(node_id, node_depth) AS (
    SELECT NEW.id, 1
    UNION ALL
    SELECT c.id, b.node_depth + 1
      FROM public.team_categories c
      JOIN branch b ON c.parent_id = b.node_id
     WHERE b.node_depth < 64
  )
  SELECT max(b.node_depth) INTO branch_height FROM branch b;

  IF depth + COALESCE(branch_height, 1) - 1 > 10 THEN
    RAISE EXCEPTION 'Category nesting is limited to 10 levels';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_team_category_tree ON public.team_categories;
CREATE TRIGGER trg_enforce_team_category_tree
  BEFORE INSERT OR UPDATE OF parent_id ON public.team_categories
  FOR EACH ROW EXECUTE FUNCTION public.enforce_team_category_tree();

REVOKE ALL ON FUNCTION public.enforce_team_category_tree() FROM PUBLIC, anon, authenticated;

-- ─── 2. team_okrs rejoint le FK, comme team_tasks/team_projects (mig. 111) ──

ALTER TABLE public.team_okrs
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.team_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_team_okrs_category ON public.team_okrs(category_id);

-- ─── 3. Migration des données : org_okr_categories → team_categories ───────
--
-- Fusion par (org_id, name) : une catégorie qui existe déjà côté
-- `team_categories` (même org, même nom) est réutilisée telle quelle, pour ne
-- jamais créer deux lignes qui porteraient le même nom à la racine (la
-- contrainte d'unicité ci-dessus le refuserait de toute façon).

INSERT INTO public.team_categories (id, org_id, name, color, created_by, created_at)
SELECT o.id, o.org_id, o.name, o.color, o.created_by, o.created_at
FROM public.org_okr_categories o
WHERE NOT EXISTS (
  SELECT 1 FROM public.team_categories t
   WHERE t.org_id = o.org_id AND t.name = o.name
);

-- Rattache chaque OKR d'équipe à l'id `team_categories` de son ancien nom
-- (qu'il vienne d'être inséré ci-dessus, ou qu'il existait déjà côté tâches).
UPDATE public.team_okrs k
   SET category_id = t.id
  FROM public.team_categories t
 WHERE k.category IS NOT NULL
   AND t.org_id = k.org_id
   AND t.name = k.category
   AND k.category_id IS NULL;

-- La colonne texte est retirée : `category_id` est désormais la seule source,
-- comme `team_tasks.category_id` / `team_projects.category_id`.
ALTER TABLE public.team_okrs DROP COLUMN IF EXISTS category;

-- `org_okr_categories` n'a plus de lecteur : ses policies partent avec elle.
DROP TABLE IF EXISTS public.org_okr_categories;

COMMENT ON TABLE public.team_categories IS
  'Catégories d''entreprise (mig. 111, arbre mig. 148) : étiquette transverse hiérarchique, partagée par les tâches (team_tasks.category_id), les projets (team_projects.category_id) et les OKR d''équipe (team_okrs.category_id). Remplace org_okr_categories (mig. 078, fusionnée ici).';
