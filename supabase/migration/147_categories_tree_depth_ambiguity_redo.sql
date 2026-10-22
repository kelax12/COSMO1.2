-- ═══════════════════════════════════════════════════════════════════
-- Migration 147 — Re-applique le correctif de la 144 : la fonction en
--                   prod portait ENCORE le bug « depth ambiguous »
--
-- 🔴 CE QUI S'EST PASSÉ. Le ledger de production porte bien une ligne
-- `144_categories_tree_depth_ambiguity` (appliquée le 2026-09-09), et
-- CLAUDE.md la décrivait comme le correctif de l'ambiguïté `depth` /
-- `depth` entre la CTE et la variable PL/pgSQL de `enforce_category_tree()`.
--
-- Le 2026-09-13, un signalement en production a montré que la création
-- d'une sous-catégorie échouait TOUJOURS avec :
--
--     ERROR: column reference "depth" is ambiguous
--
-- `pg_get_functiondef()` sur la fonction live a confirmé que son corps
-- était encore EXACTEMENT celui de la 143 (`branch(id, depth)`), pas
-- celui de la 144 (`branch(node_id, node_depth)`). Reproduit dans une
-- transaction annulée avant ce correctif : la même erreur.
--
-- ⚠️ CE QUE ÇA APPREND. Une ligne au ledger ne prouve pas qu'une
-- `CREATE OR REPLACE FUNCTION` a réellement remplacé le corps vivant —
-- même famille de défaut que le drift des Edge Functions (finding C-35) :
-- le dépôt (et ici, le ledger) décrit ce qu'on a voulu écrire, pas
-- nécessairement ce qui s'exécute. La seule preuve valable reste
-- `pg_get_functiondef` sur la fonction EN PROD, ou une transaction
-- annulée qui rejoue le chemin applicatif réel.
--
-- Correctif : identique à la 144, réappliqué ici sous son propre numéro
-- (jamais en éditant un fichier déjà « appliqué », même si l'application
-- réelle est douteuse — même règle que `119b`).
-- ═══════════════════════════════════════════════════════════════════

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
  -- `NEW` lui-même n'atteint que 9 : les lignes descendantes ne sont pas
  -- écrites, donc le trigger ne part jamais pour elles. Il faut ajouter la
  -- HAUTEUR de la branche déplacée. (`wouldExceedMaxDepth` en est le miroir
  -- client, dans `src/modules/categories/tree.ts`.)
  --
  -- ⚠️ `node_depth`, et surtout PAS `depth` : c'est la collision avec la
  -- variable PL/pgSQL du même nom qui a fait échouer la 143 (et qui a
  -- survécu en prod jusqu'à cette migration malgré la 144).
  --
  -- ⚠️ `node_depth < 64` borne la descente : le trigger interdit les cycles,
  -- mais une base restaurée ne doit pas pouvoir faire boucler la récursion.
  WITH RECURSIVE branch(node_id, node_depth) AS (
    SELECT NEW.id, 1
    UNION ALL
    SELECT c.id, b.node_depth + 1
      FROM public.categories c
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

-- ⚠️ `authenticated` EXPLICITEMENT : REVOKE … FROM PUBLIC ne lui retire rien.
REVOKE ALL ON FUNCTION public.enforce_category_tree() FROM PUBLIC, anon, authenticated;
