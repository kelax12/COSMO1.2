-- ═══════════════════════════════════════════════════════════════════
-- Migration 144 — `enforce_category_tree()` : la CTE et la variable
--                   s'appelaient toutes les deux `depth`
--
-- 🔴 CE QUI S'EST PASSÉ. La mig. 143 a été appliquée en production, et la
-- vérification qui a suivi a montré que **toute création d'une sous-catégorie
-- échouait** :
--
--     ERROR: column reference "depth" is ambiguous
--
-- La CTE récursive déclarait `branch(id, depth)` pendant que le bloc PL/pgSQL
-- déclarait une variable `depth`. Sur `SELECT max(depth) INTO branch_height
-- FROM branch`, Postgres ne sait pas laquelle des deux on désigne, et refuse.
-- Le trigger levait donc sur le chemin le plus banal de la fonctionnalité.
--
-- 🔴 CE QUE ÇA APPREND, ET QUI DÉPASSE CE FICHIER.
-- La 143 avait passé, dans l'ordre : `npm run validate:migrations`,
-- `npm run check:rls`, les gardes de `migration-guards.test.mjs`, une revue de
-- conformité à la spéc et une revue de qualité de code. **Aucune de ces cinq
-- vérifications n'exécute le SQL.** Une collision de noms entre une colonne de
-- CTE et une variable PL/pgSQL ne se voit pas en lisant : elle se voit en
-- appelant. La seule chose qui l'a trouvée est la vérification acteur par acteur
-- en transaction annulée, celle que le plan impose APRÈS application.
--
-- ⚠️ Versionné sous son PROPRE numéro plutôt que replié dans la 143, qui est
-- déjà appliquée. C'est la règle que le ledger a apprise avec
-- `119b_habits_bounded_payload_future_guard` : un correctif appliqué en prod ne
-- s'édite jamais dans un fichier déjà passé, sinon rejouer le dépôt sur base
-- vierge ne donne plus le même état.
--
-- Correctif : les colonnes de la CTE deviennent `node_id` / `node_depth`, et
-- l'agrégat est qualifié par l'alias. Aucun changement de comportement voulu.
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
  -- variable PL/pgSQL du même nom qui a fait échouer la 143.
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
