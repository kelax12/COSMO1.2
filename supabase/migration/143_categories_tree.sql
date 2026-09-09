-- ═══════════════════════════════════════════════════════════════════
-- Migration 143 — Sous-catégories : l'arbre des catégories personnelles
--
-- POURQUOI
-- `categories` est une liste plate. On veut « Travail › SEO › Backlinks »,
-- sans limite de profondeur déclarée.
--
-- MODÈLE : liste d'adjacence (`parent_id`), pas de `ltree` ni de table de
-- fermeture. Raison décisive : reparenter une branche est alors un UPDATE
-- d'UNE ligne. Un chemin matérialisé devrait réécrire toute la branche, et
-- une table de fermeture serait une seconde source de vérité pour un arbre de
-- quelques dizaines de lignes.
--
-- ⚠️ AUCUNE RPC n'est créée. Un compte porte quelques dizaines de catégories et
-- le client les charge déjà toutes : dériver une branche est un calcul en
-- mémoire. Ajouter une lecture serveur pour ça la ferait partir depuis toutes
-- les pages protégées (cf. finding C-05).
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.categories(id) ON DELETE NO ACTION,
  ADD COLUMN IF NOT EXISTS position  INTEGER NOT NULL DEFAULT 0;

-- 🔴 NI CASCADE, NI RESTRICT : `NO ACTION`. La nuance décide d'un chemin RGPD.
--
-- Ce qu'on veut : supprimer un parent en laissant ses enfants derrière doit être
-- REFUSÉ, pour forcer l'application à avoir tranché « remonter les enfants » ou
-- « supprimer la branche ». `CASCADE` emporterait la branche en silence.
--
-- Mais `RESTRICT` se vérifie IMMÉDIATEMENT, ligne par ligne : il ne voit pas que
-- l'enfant part dans la MÊME requête. Or deux chemins suppriment les catégories
-- d'un compte en un seul DELETE groupé :
--
--   1. `delete-account` (Edge Function), qui balaie `USER_OWNED_TABLES` ;
--   2. la cascade de `user_id REFERENCES auth.users(id) ON DELETE CASCADE`,
--      déclenchée par la suppression du compte auth lui-même.
--
-- Avec `RESTRICT`, ces deux chemins échouent dès qu'un compte possède une seule
-- sous-catégorie, et la suppression de compte est BLOQUÉE. C'est exactement la
-- régression B9 (RGPD art. 17) que ce dépôt a déjà payée une fois.
--
-- `NO ACTION` vérifie en FIN DE REQUÊTE : la suppression groupée d'une branche
-- entière passe, celle d'un parent seul est toujours refusée. Même garantie,
-- sans le blocage.
--
-- ⚠️ L'application supprime catégorie par catégorie, en requêtes SÉPARÉES : pour
-- elle, l'ordre feuilles vers racine reste obligatoire.
COMMENT ON COLUMN public.categories.parent_id IS
  'Catégorie parente. NULL = racine. NO ACTION : supprimer un parent en laissant ses enfants est refusé en fin de requête, mais une branche entière peut partir dans un seul DELETE (suppression de compte).';

CREATE INDEX IF NOT EXISTS idx_categories_parent
  ON public.categories(user_id, parent_id);

-- ─── Unicité par fratrie : DEUX index, et c'est nécessaire ────────────
--
-- 🔴 En Postgres, deux NULL ne sont jamais égaux : une unicité sur
-- (user_id, parent_id, name) ne contraint RIEN entre racines, et on pourrait
-- créer deux « Travail » à la racine. L'index partiel WHERE parent_id IS NULL
-- est la seule forme qui les couvre.
--
-- L'ancienne contrainte UNIQUE(user_id, name) était plus stricte que les deux
-- réunies : sa suppression ne peut échouer sur aucune donnée existante.

ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_user_id_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS ux_categories_sibling_name
  ON public.categories(user_id, parent_id, name)
  WHERE parent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_categories_root_name
  ON public.categories(user_id, name)
  WHERE parent_id IS NULL;

-- ─── Garde d'intégrité de l'arbre ────────────────────────────────────
--
-- ⚠️ SECURITY INVOKER (défaut) et REVOKE pour PUBLIC, anon ET authenticated,
-- exactement comme les gardes de la mig. 132. Un trigger BEFORE s'exécute AVANT
-- le WITH CHECK de la RLS : en DEFINER, ses messages d'erreur deviendraient un
-- oracle sur des lignes non lisibles (finding B-3).

-- ⚠️ `SET search_path` explicite, comme les gardes de la mig. 132 : sans lui,
-- l'advisor Supabase `function_search_path_mutable` se rallume, et le corps
-- dépendrait du chemin de l'appelant (la mig. 024 a déjà payé cette leçon).
CREATE OR REPLACE FUNCTION public.enforce_category_tree()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  ancestor        UUID;
  ancestor_owner  UUID;
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

  SELECT user_id INTO ancestor_owner FROM public.categories WHERE id = NEW.parent_id;
  IF ancestor_owner IS NULL THEN
    RAISE EXCEPTION 'Parent category does not exist';
  END IF;
  IF ancestor_owner <> NEW.user_id THEN
    RAISE EXCEPTION 'A category must stay within a single account';
  END IF;

  -- Remontée des ancêtres : cycle et profondeur d'un seul parcours.
  -- `hops` borne le parcours même si un cycle existait déjà en données.
  ancestor := NEW.parent_id;
  WHILE ancestor IS NOT NULL AND hops <= 64 LOOP
    IF ancestor = NEW.id THEN
      RAISE EXCEPTION 'This parent would create a cycle';
    END IF;
    depth := depth + 1;
    IF depth > 10 THEN
      RAISE EXCEPTION 'Category nesting is limited to 10 levels';
    END IF;
    SELECT parent_id INTO ancestor FROM public.categories WHERE id = ancestor;
    hops := hops + 1;
  END LOOP;

  -- 🔴 LA PROFONDEUR DU NŒUD ÉCRIT NE SUFFIT PAS.
  -- La boucle ci-dessus ne mesure que `NEW`. Déplacer une branche haute de 4
  -- crans sous un nœud au niveau 8 met ses FEUILLES au niveau 12, alors que
  -- `NEW` lui-même n'atteint que 9 : le trigger ne se déclenche pas, puisque
  -- les lignes descendantes ne sont pas écrites et ne le font donc jamais
  -- partir. Il faut ajouter la HAUTEUR de la branche déplacée.
  -- (Défaut trouvé en revue de code sur le module client `tree.ts`, qui portait
  -- exactement la même erreur ; `wouldExceedMaxDepth` en est le miroir.)
  --
  -- ⚠️ `depth < 64` borne la descente : le trigger interdit les cycles, mais
  -- une base restaurée ne doit pas pouvoir faire boucler une CTE récursive.
  WITH RECURSIVE branch(id, depth) AS (
    SELECT NEW.id, 1
    UNION ALL
    SELECT c.id, b.depth + 1
      FROM public.categories c
      JOIN branch b ON c.parent_id = b.id
     WHERE b.depth < 64
  )
  SELECT max(depth) INTO branch_height FROM branch;

  IF depth + COALESCE(branch_height, 1) - 1 > 10 THEN
    RAISE EXCEPTION 'Category nesting is limited to 10 levels';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_category_tree ON public.categories;
CREATE TRIGGER trg_enforce_category_tree
  BEFORE INSERT OR UPDATE OF parent_id ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.enforce_category_tree();

-- ⚠️ `authenticated` EXPLICITEMENT : REVOKE … FROM PUBLIC ne lui retire rien.
REVOKE ALL ON FUNCTION public.enforce_category_tree() FROM PUBLIC, anon, authenticated;
