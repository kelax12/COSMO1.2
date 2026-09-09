# Sous-catégories hiérarchiques (vague 1) · plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre de ranger une catégorie personnelle sous une autre, sans limite de profondeur déclarée, avec un plafond de garde à 10.

**Architecture:** Liste d'adjacence (`categories.parent_id`), un trigger Postgres qui refuse cycles, profondeur excessive et parent d'un autre compte, et un module TypeScript pur (`tree.ts`) qui porte les mêmes règles côté client. Aucune RPC nouvelle : l'arbre entier est déjà chargé par `useCategories`, les descendants se calculent en mémoire.

**Tech Stack:** React 18 + TypeScript strict, TanStack React Query 5, Supabase (Postgres + RLS), Vitest, Tailwind + shadcn/ui, catalogues i18n maison (`src/locales/{fr,en}`).

**Spéc de référence :** [`docs/superpowers/specs/2026-09-09-sous-categories-hierarchiques-design.md`](../specs/2026-09-09-sous-categories-hierarchiques-design.md)

---

## À lire avant de commencer

### Comment lancer les tests sur ce poste

🔴 **`npm test` est ROUGE en local sur Windows** pour une raison sans rapport avec le produit : un fichier de test porte un shebang que Vitest n'avale pas sur cette plateforme, et il fait avorter le run entier. La CI est verte. Utiliser :

```bash
npx vitest run src
```

Pour un fichier précis :

```bash
npx vitest run src/modules/categories/tree.test.ts
```

### Règles du dépôt qui s'appliquent à ce plan

- **Imports** : toujours l'alias `@/`, jamais de chemin relatif remontant.
- **Pas de `as any`.** TypeScript strict, `noUnusedLocals`, `noUnusedParameters`. Un argument volontairement inutilisé se préfixe par `_`.
- **Aucune chaîne d'interface en dur.** `npm run i18n:scan` a un cliquet à **0** et c'est une gate CI. Toute chaîne visible passe par `useT`, et part dans `fr` **et** `en` (`npm run i18n:check` et `npm run i18n:identical`, tous deux à 0).
- **Jamais de `toast` dans un repository.** Les toasts vivent dans les hooks.
- **Une fonction de trigger est `SECURITY INVOKER`** (le défaut) et `REVOKE`-ée pour `PUBLIC, anon, authenticated`. C'est le motif exact de la mig. `132`.
- **Ne jamais appliquer les migrations `136` à `141`** : elles sont dans l'arbre, non appliquées, et appartiennent à d'autres sessions.
- **Commits fréquents.** Un commit par tâche au minimum.

### État de départ à connaître

- `tasks.category` et `okrs.category` contiennent **l'UUID de `categories.id`**, en colonne `TEXT`. Ce n'est pas un nom. Cf. `scripts/cosmo/api.mjs:69`.
- Il n'existe **aucune clé étrangère** vers `categories`. La tâche 16 la pose.
- `ColorSettingsModal` est un **éditeur par lot** : les créations portent un id `temp-<timestamp>` et rien n'est écrit avant « Enregistrer ».
- `src/components/CategoryManager.tsx` n'est monté nulle part. ❌ Ne pas le modifier.

---

## Structure des fichiers

| Fichier | Responsabilité | Tâche |
|---|---|---|
| `src/modules/categories/tree.ts` | **Créer.** Toutes les règles de l'arbre, pures, sans React ni réseau | 1 |
| `src/modules/categories/tree.test.ts` | **Créer.** Tests du module ci-dessus | 1 |
| `supabase/migration/143_categories_tree.sql` | **Créer.** `parent_id`, `position`, unicité par fratrie, trigger de garde | 2 |
| `scripts/migration-guards.test.mjs` | **Modifier.** Garde : un trigger `SECURITY DEFINER` doit échouer | 2 |
| `src/modules/categories/types.ts` | **Modifier.** `parentId`, `position` | 3 |
| `src/modules/categories/repository.ts` | **Modifier.** Repository démo : mêmes refus que le trigger | 3 |
| `src/modules/categories/repository.test.ts` | **Modifier.** Tests des refus démo | 3 |
| `src/modules/categories/supabase.repository.ts` | **Modifier.** Mapping `parent_id` / `position` | 4 |
| `src/modules/categories/supabase.repository.test.ts` | **Modifier.** Tests du mapping | 4 |
| `src/modules/categories/hooks.ts` | **Modifier.** Couleur héritée, `useMoveCategory` | 5 |
| `src/modules/categories/hooks.test.tsx` | **Modifier.** Tests des hooks | 5 |
| `src/modules/categories/impact.ts` | **Modifier.** Impact de branche, chaînes via ancêtre supprimé | 6 |
| `src/modules/categories/impact.test.ts` | **Modifier.** Tests correspondants | 6 |
| `src/modules/ui-states/constants.ts` + `hooks.ts` | **Modifier.** État replié de l'arbre | 7 |
| `src/components/category/CategoryTreeRow.tsx` | **Créer.** Une ligne de l'arbre dans la modale | 7 |
| `src/components/ColorSettingsModal.tsx` | **Modifier.** Arbre, « + » par ligne, ordre d'écriture, déplacement | 7, 8, 9, 10 (suppression) |
| `src/components/category/MoveCategoryDialog.tsx` | **Créer.** « Déplacer vers… » | 9 |
| `src/components/category/DeleteCategoryDialog.tsx` | **Modifier.** Impact de branche, deux issues | 10 |
| `src/components/category/CategoryTreeSelect.tsx` | **Créer.** Liste déroulante arborescente avec recherche | 11 |
| `src/components/task-modal/CategoryField.tsx` | **Modifier.** Utilise le sélecteur ci-dessus | 11 |
| `src/components/TaskFilter.tsx` | **Modifier.** Filtre arborescent, descendants inclus | 12 |
| `src/components/TaskCategoryIndicator.tsx` | **Modifier.** Chemin en infobulle | 13 |
| `src/modules/categories/repository.ts` (seeds) | **Modifier.** Seeds démo arborescents | 14 |
| `supabase/migration/144_categories_fk.sql` | **Créer.** Nettoyage, conversion UUID, clé étrangère | 16 |
| `src/modules/tasks/supabase.repository.ts` | **Modifier.** `''` ↔ `NULL` au mapping | 16 |
| `src/modules/okrs/supabase.repository.ts` | **Modifier.** Idem | 16 |

---

## Task 1: Le module `tree.ts`

Module pur, aucune dépendance React ni réseau. C'est lui qui porte toutes les règles de l'arbre côté client, et c'est le seul endroit où elles sont écrites.

**Files:**
- Create: `src/modules/categories/tree.ts`
- Test: `src/modules/categories/tree.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `src/modules/categories/tree.test.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import {
  CATEGORY_MAX_DEPTH,
  ancestorIds,
  buildTree,
  categoryPath,
  childrenOf,
  descendantIds,
  formatPath,
  orderByDepth,
  treeDepth,
  wouldCreateCycle,
} from './tree';
import type { Category } from './types';

const cat = (id: string, parentId: string | null, position = 0, name = id): Category => ({
  id,
  name,
  color: '#3B82F6',
  parentId,
  position,
});

//        travail            perso
//       /       \             |
//     seo      design       sante
//      |
//  backlinks
const TREE: Category[] = [
  cat('travail', null, 0, 'Travail'),
  cat('perso', null, 1, 'Perso'),
  cat('seo', 'travail', 0, 'SEO'),
  cat('design', 'travail', 1, 'Design'),
  cat('backlinks', 'seo', 0, 'Backlinks'),
  cat('sante', 'perso', 0, 'Santé'),
];

describe('childrenOf', () => {
  it('rend les enfants DIRECTS, triés par position', () => {
    expect(childrenOf('travail', TREE).map((c) => c.id)).toEqual(['seo', 'design']);
  });

  it('rend les racines pour un parent null', () => {
    expect(childrenOf(null, TREE).map((c) => c.id)).toEqual(['travail', 'perso']);
  });

  it('rend un tableau vide pour une feuille', () => {
    expect(childrenOf('backlinks', TREE)).toEqual([]);
  });
});

describe('descendantIds', () => {
  it('rend toute la branche, sans le nœud lui-même', () => {
    expect(descendantIds('travail', TREE).sort()).toEqual(['backlinks', 'design', 'seo']);
  });

  it('rend un tableau vide pour une feuille', () => {
    expect(descendantIds('backlinks', TREE)).toEqual([]);
  });

  // Le trigger empêche d'en créer, mais un client ne doit JAMAIS geler sur une
  // donnée inattendue : une base restaurée ou un bug de migration suffirait.
  it('ne boucle pas sur un cycle déjà présent en données', () => {
    const cyclic = [cat('a', 'b'), cat('b', 'a')];
    expect(() => descendantIds('a', cyclic)).not.toThrow();
    expect(descendantIds('a', cyclic)).toEqual(['b']);
  });
});

describe('ancestorIds', () => {
  it('rend les ancêtres de la racine au parent direct', () => {
    expect(ancestorIds('backlinks', TREE)).toEqual(['travail', 'seo']);
  });

  it('rend un tableau vide pour une racine', () => {
    expect(ancestorIds('travail', TREE)).toEqual([]);
  });

  it('ne boucle pas sur un cycle déjà présent en données', () => {
    const cyclic = [cat('a', 'b'), cat('b', 'a')];
    expect(() => ancestorIds('a', cyclic)).not.toThrow();
  });
});

describe('categoryPath / formatPath', () => {
  it('rend le chemin complet de la racine à la feuille', () => {
    expect(categoryPath('backlinks', TREE).map((c) => c.name)).toEqual(['Travail', 'SEO', 'Backlinks']);
  });

  it('rend un tableau vide pour un identifiant inconnu', () => {
    expect(categoryPath('inconnu', TREE)).toEqual([]);
  });

  it('formate avec le séparateur demandé', () => {
    expect(formatPath(categoryPath('backlinks', TREE))).toBe('Travail › SEO › Backlinks');
  });
});

describe('treeDepth', () => {
  it('compte la racine comme le niveau 1', () => {
    expect(treeDepth('travail', TREE)).toBe(1);
    expect(treeDepth('seo', TREE)).toBe(2);
    expect(treeDepth('backlinks', TREE)).toBe(3);
  });
});

describe('wouldCreateCycle', () => {
  it('refuse l auto-parentage', () => {
    expect(wouldCreateCycle('travail', 'travail', TREE)).toBe(true);
  });

  it('refuse un parent qui est un DESCENDANT (cycle indirect)', () => {
    expect(wouldCreateCycle('travail', 'backlinks', TREE)).toBe(true);
  });

  it('accepte un déplacement légitime', () => {
    expect(wouldCreateCycle('design', 'seo', TREE)).toBe(false);
    expect(wouldCreateCycle('seo', null, TREE)).toBe(false);
  });
});

describe('buildTree', () => {
  it('imbrique les nœuds et respecte position puis nom', () => {
    const roots = buildTree(TREE);
    expect(roots.map((n) => n.category.id)).toEqual(['travail', 'perso']);
    expect(roots[0].children.map((n) => n.category.id)).toEqual(['seo', 'design']);
    expect(roots[0].children[0].children.map((n) => n.category.id)).toEqual(['backlinks']);
  });

  it('remonte à la racine un nœud dont le parent est absent', () => {
    const orphan = [cat('x', 'parent-disparu')];
    expect(buildTree(orphan).map((n) => n.category.id)).toEqual(['x']);
  });
});

describe('orderByDepth', () => {
  it('rend les parents AVANT leurs enfants', () => {
    const shuffled = [cat('backlinks', 'seo'), cat('travail', null), cat('seo', 'travail')];
    expect(orderByDepth(shuffled).map((c) => c.id)).toEqual(['travail', 'seo', 'backlinks']);
  });

  it('laisse passer un parent DÉJÀ existant hors du lot', () => {
    // « seo » a un parent qui n'est pas dans le lot : il est déjà en base.
    expect(orderByDepth([cat('seo', 'travail')]).map((c) => c.id)).toEqual(['seo']);
  });

  it('lève sur un lot non ordonnançable plutôt que de boucler', () => {
    expect(() => orderByDepth([cat('a', 'b'), cat('b', 'a')])).toThrow(/cycle/i);
  });
});

describe('CATEGORY_MAX_DEPTH', () => {
  it('vaut 10, la même valeur que le trigger', () => {
    expect(CATEGORY_MAX_DEPTH).toBe(10);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

```bash
npx vitest run src/modules/categories/tree.test.ts
```

Attendu : ÉCHEC, `Failed to resolve import "./tree"`.

- [ ] **Step 3: Écrire le module**

Créer `src/modules/categories/tree.ts` :

```typescript
// ═══════════════════════════════════════════════════════════════════
// L'ARBRE DES CATÉGORIES — logique pure
// ═══════════════════════════════════════════════════════════════════
//
// Miroir client du trigger `enforce_category_tree` (mig. 143). Les deux disent
// la même chose ; la base FAIT foi, ce module sert à ne pas proposer un geste
// que le serveur refusera.
//
// Aucun React, aucun réseau : ces règles se testent sans monter un composant,
// comme `impact.ts`.
//
// ⚠️ TOUTE remontée d'ancêtres porte un `Set` de nœuds déjà vus. Le trigger
// empêche de créer un cycle, mais un client ne doit jamais GELER sur une donnée
// inattendue (base restaurée, migration partielle, données de test).

import type { Category } from './types';

/**
 * Profondeur maximale, racine comptée comme le niveau 1.
 *
 * Valeur unique côté client, et la MÊME que celle du trigger. Les changer
 * séparément produirait une interface qui propose ce que la base refuse.
 */
export const CATEGORY_MAX_DEPTH = 10;

/** Séparateur affiché entre les crans d'un chemin. */
export const PATH_SEPARATOR = ' › ';

export interface CategoryNode {
  category: Category;
  children: CategoryNode[];
}

/** Tri d'une fratrie : `position` d'abord, puis le nom, pour être déterministe. */
const bySibling = (a: Category, b: Category): number =>
  a.position - b.position || a.name.localeCompare(b.name);

/** Enfants DIRECTS de `parentId` (`null` pour les racines), triés. */
export function childrenOf(parentId: string | null, categories: readonly Category[]): Category[] {
  return categories.filter((c) => c.parentId === parentId).sort(bySibling);
}

/** Tous les descendants de `id`, le nœud lui-même exclu. */
export function descendantIds(id: string, categories: readonly Category[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>([id]);
  const queue: string[] = [id];

  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const child of categories) {
      if (child.parentId !== current || seen.has(child.id)) continue;
      seen.add(child.id);
      out.push(child.id);
      queue.push(child.id);
    }
  }

  return out;
}

/** Ancêtres de `id`, de la racine au parent direct. */
export function ancestorIds(id: string, categories: readonly Category[]): string[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const out: string[] = [];
  const seen = new Set<string>([id]);

  let current = byId.get(id)?.parentId ?? null;
  while (current !== null && !seen.has(current)) {
    seen.add(current);
    if (!byId.has(current)) break; // parent absent : on s'arrête, on ne lève pas
    out.unshift(current);
    current = byId.get(current)?.parentId ?? null;
  }

  return out;
}

/** Chemin complet, de la racine à `id` inclus. Vide si `id` est inconnu. */
export function categoryPath(id: string, categories: readonly Category[]): Category[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const self = byId.get(id);
  if (!self) return [];
  const path = ancestorIds(id, categories).map((a) => byId.get(a)).filter((c): c is Category => Boolean(c));
  return [...path, self];
}

/** « Travail › SEO › Backlinks ». */
export function formatPath(path: readonly Category[], separator = PATH_SEPARATOR): string {
  return path.map((c) => c.name).join(separator);
}

/** Profondeur de `id`, racine comptée comme 1. `0` si `id` est inconnu. */
export function treeDepth(id: string, categories: readonly Category[]): number {
  if (!categories.some((c) => c.id === id)) return 0;
  return ancestorIds(id, categories).length + 1;
}

/** Rattacher `id` sous `newParentId` créerait-il un cycle ? */
export function wouldCreateCycle(
  id: string,
  newParentId: string | null,
  categories: readonly Category[],
): boolean {
  if (newParentId === null) return false;
  if (newParentId === id) return true;
  return descendantIds(id, categories).includes(newParentId);
}

/** Liste plate vers arbre. Un nœud dont le parent est absent devient racine. */
export function buildTree(categories: readonly Category[]): CategoryNode[] {
  const known = new Set(categories.map((c) => c.id));
  const nodes = new Map<string, CategoryNode>(
    categories.map((c) => [c.id, { category: c, children: [] }]),
  );
  const roots: CategoryNode[] = [];

  for (const category of [...categories].sort(bySibling)) {
    const node = nodes.get(category.id) as CategoryNode;
    const parentId = category.parentId;
    if (parentId !== null && known.has(parentId) && parentId !== category.id) {
      (nodes.get(parentId) as CategoryNode).children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * Trie un LOT de créations de façon qu'un parent soit toujours écrit avant ses
 * enfants.
 *
 * 🔴 POURQUOI. La modale de gestion crée en lot, et un enfant créé dans le même
 * lot que son parent référence un identifiant `temp-` qui ne désigne aucune
 * ligne serveur. Écrire dans le désordre pose un `parentId` invalide.
 *
 * Un parent ABSENT du lot est considéré comme déjà existant en base : c'est le
 * cas normal quand on ajoute un enfant à une catégorie enregistrée.
 *
 * Lève si le lot n'est pas ordonnançable, plutôt que de boucler.
 */
export function orderByDepth<T extends { id: string; parentId: string | null }>(
  items: readonly T[],
): T[] {
  const inBatch = new Set(items.map((i) => i.id));
  const placed = new Set<string>();
  const out: T[] = [];
  let remaining = [...items];

  while (remaining.length > 0) {
    const ready = remaining.filter(
      (i) => i.parentId === null || !inBatch.has(i.parentId) || placed.has(i.parentId),
    );
    if (ready.length === 0) {
      throw new Error('Category batch is not orderable: cycle among pending rows');
    }
    for (const item of ready) {
      placed.add(item.id);
      out.push(item);
    }
    remaining = remaining.filter((i) => !placed.has(i.id));
  }

  return out;
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

```bash
npx vitest run src/modules/categories/tree.test.ts
```

Attendu : PASS. Les tests référencent `Category.parentId` et `Category.position`, qui n'existent pas encore dans `types.ts` : **si `npm run typecheck` échoue à cette étape, c'est normal**, la tâche 3 le referme. Les tests Vitest passent malgré tout (transpilation sans vérification de types).

- [ ] **Step 5: Commit**

```bash
git add src/modules/categories/tree.ts src/modules/categories/tree.test.ts
git commit -m "feat(categories): module pur de l'arbre (tree.ts)"
```

---

## Task 2: Migration `143` · l'arbre en base

**Files:**
- Create: `supabase/migration/143_categories_tree.sql`
- Modify: `scripts/migration-guards.test.mjs`

- [ ] **Step 1: Écrire la migration**

Créer `supabase/migration/143_categories_tree.sql` :

```sql
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

-- 🔴 NI CASCADE, NI RESTRICT : `NO ACTION`. La nuance decide d'un chemin RGPD.
-- `RESTRICT` se verifie IMMEDIATEMENT, ligne par ligne, donc il refuse une
-- suppression groupee ou parent et enfants partent ensemble : `delete-account`
-- et la cascade depuis `auth.users` echoueraient des qu'un compte a une seule
-- sous-categorie, bloquant la suppression de compte (regression B9, RGPD art. 17).
-- `NO ACTION` verifie en FIN DE REQUETE : meme garantie, sans le blocage.
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

CREATE OR REPLACE FUNCTION public.enforce_category_tree()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_category_tree ON public.categories;
CREATE TRIGGER trg_enforce_category_tree
  BEFORE INSERT OR UPDATE OF parent_id ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.enforce_category_tree();

-- ⚠️ `authenticated` EXPLICITEMENT : REVOKE … FROM PUBLIC ne lui retire rien.
REVOKE ALL ON FUNCTION public.enforce_category_tree() FROM PUBLIC, anon, authenticated;
```

- [ ] **Step 2: Vérifier la migration avec la garde statique du dépôt**

```bash
npm run validate:migrations
```

Attendu : sortie sans erreur, code 0.

```bash
npm run check:rls
```

Attendu : code 0. Cette migration ne touche aucune policy, les invariants RLS restent inchangés.

- [ ] **Step 3: Ajouter un cas de garde qui refuse un trigger `SECURITY DEFINER`**

Dans `scripts/migration-guards.test.mjs`, ajouter en fin de fichier :

```javascript
// ── Une garde d'arbre ne doit JAMAIS être SECURITY DEFINER (mig. 143) ──
//
// Un trigger BEFORE s'exécute avant le WITH CHECK de la RLS : en DEFINER, ses
// messages d'erreur deviennent un oracle sur des lignes non lisibles (B-3).
// Ce cas EXISTE pour être vu rouge : il a été vérifié en retirant le mot
// SECURITY INVOKER de la migration réelle avant d'être committé.
describe('trigger de garde de l arbre des categories', () => {
  it('refuse une fonction de trigger SECURITY DEFINER', () => {
    write(
      '143_categories_tree.sql',
      `CREATE OR REPLACE FUNCTION public.enforce_category_tree()
       RETURNS TRIGGER AS $$ BEGIN RETURN NEW; END; $$
       LANGUAGE plpgsql SECURITY DEFINER;
       CREATE TRIGGER trg_enforce_category_tree
         BEFORE INSERT ON public.categories
         FOR EACH ROW EXECUTE FUNCTION public.enforce_category_tree();`,
    );
    const { code, out } = run(VALIDATE);
    expect(code).not.toBe(0);
    expect(out).toMatch(/DEFINER/i);
  });

  it('accepte la fonction reelle, en INVOKER et REVOKE-ee', () => {
    write(
      '143_categories_tree.sql',
      readFileSync(resolve(ROOT, 'supabase/migration/143_categories_tree.sql'), 'utf8'),
    );
    expect(run(VALIDATE).code).toBe(0);
  });
});
```

- [ ] **Step 4: Lancer la garde et vérifier les DEUX cas**

```bash
npx vitest run scripts/migration-guards.test.mjs
```

Attendu : PASS pour les deux cas.

🔴 **Si le premier cas passe alors que la fonction est en `DEFINER`, la garde ne mesure rien.** Il faut alors étendre `scripts/validate-migrations.mjs` pour qu'il refuse une fonction de trigger `SECURITY DEFINER`, et relancer. Une garde qu'on n'a jamais vue rouge est une intention, pas une garde.

- [ ] **Step 5: Commit**

```bash
git add supabase/migration/143_categories_tree.sql scripts/migration-guards.test.mjs
git commit -m "feat(db): migration 143, arbre des categories personnelles"
```

- [ ] **Step 6: Appliquer en production, après relecture par Axel**

⚠️ **Ne pas appliquer sans son accord explicite**, et ne pas appliquer au passage les migrations `136` à `141`, qui appartiennent à d'autres sessions.

Après application, vérifier acteur par acteur dans une transaction annulée par un `RAISE` final :

```sql
BEGIN;
-- 1. un enfant légitime passe
-- 2. l'auto-parentage est refusé
-- 3. un cycle à trois maillons est refusé
-- 4. un parent appartenant à un autre compte est refusé
-- 5. la profondeur 11 est refusée, la 10 acceptée
-- 5bis. 🔴 DÉPLACER une branche haute de 4 crans sous un nœud au niveau 8 est
--       REFUSÉ (ses feuilles atteindraient 12). C'est le cas que la seule
--       profondeur du nœud écrit laisse passer, et il ne se teste QUE par un
--       UPDATE de `parent_id`, jamais par un INSERT.
-- 6. deux racines de même nom sont refusées (ux_categories_root_name)
-- 7. deux sœurs de même nom sont refusées, deux « Design » sous deux parents
--    différents sont acceptées
RAISE EXCEPTION 'rollback volontaire';
```

---

## Task 3: Types et repository démo

**Files:**
- Modify: `src/modules/categories/types.ts`
- Modify: `src/modules/categories/repository.ts`
- Test: `src/modules/categories/repository.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter dans `src/modules/categories/repository.test.ts` :

```typescript
describe('LocalStorageCategoriesRepository — arbre', () => {
  it('crée une racine quand parentId est absent', async () => {
    const repo = new LocalStorageCategoriesRepository();
    const created = await repo.create({ name: 'Nouvelle', color: '#000000' });
    expect(created.parentId).toBeNull();
    expect(created.position).toBe(0);
  });

  it('crée un enfant sous un parent existant', async () => {
    const repo = new LocalStorageCategoriesRepository();
    const parent = await repo.create({ name: 'Parent', color: '#000000' });
    const child = await repo.create({ name: 'Enfant', color: '#000000', parentId: parent.id });
    expect(child.parentId).toBe(parent.id);
  });

  // 🔴 Le repository démo doit refuser EXACTEMENT ce que le trigger refuse.
  // Sinon la démo autorise ce que la production rejette, et le bug ne se
  // découvre qu'en production.
  it('refuse l auto-parentage', async () => {
    const repo = new LocalStorageCategoriesRepository();
    const c = await repo.create({ name: 'Seule', color: '#000000' });
    await expect(repo.update(c.id, { parentId: c.id })).rejects.toThrow();
  });

  it('refuse un cycle indirect', async () => {
    const repo = new LocalStorageCategoriesRepository();
    const a = await repo.create({ name: 'A', color: '#000000' });
    const b = await repo.create({ name: 'B', color: '#000000', parentId: a.id });
    await expect(repo.update(a.id, { parentId: b.id })).rejects.toThrow();
  });

  it('refuse un parent inexistant', async () => {
    const repo = new LocalStorageCategoriesRepository();
    await expect(
      repo.create({ name: 'Orpheline', color: '#000000', parentId: 'nexiste-pas' }),
    ).rejects.toThrow();
  });

  it('refuse une profondeur au-delà de CATEGORY_MAX_DEPTH', async () => {
    const repo = new LocalStorageCategoriesRepository();
    let parentId: string | null = null;
    for (let level = 1; level <= CATEGORY_MAX_DEPTH; level += 1) {
      const created: Category = await repo.create({ name: `N${level}`, color: '#000000', parentId });
      parentId = created.id;
    }
    await expect(
      repo.create({ name: 'Trop profond', color: '#000000', parentId }),
    ).rejects.toThrow();
  });

  it('refuse la suppression d une catégorie qui a des enfants', async () => {
    const repo = new LocalStorageCategoriesRepository();
    const parent = await repo.create({ name: 'Parent', color: '#000000' });
    await repo.create({ name: 'Enfant', color: '#000000', parentId: parent.id });
    await expect(repo.delete(parent.id)).rejects.toThrow();
  });
});
```

Ajouter les imports nécessaires en tête du fichier de test :

```typescript
import { CATEGORY_MAX_DEPTH } from './tree';
import type { Category } from './types';
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

```bash
npx vitest run src/modules/categories/repository.test.ts
```

Attendu : ÉCHEC, `created.parentId` vaut `undefined` et les refus ne se produisent pas.

- [ ] **Step 3: Étendre les types**

Remplacer le contenu de `src/modules/categories/types.ts` :

```typescript
// ═══════════════════════════════════════════════════════════════════
// CATEGORIES MODULE - Type Definitions
// ═══════════════════════════════════════════════════════════════════

/**
 * Category — une catégorie de tâche / objectif, avec sa couleur.
 *
 * `parentId` porte l'arbre (mig. 143). `null` = racine.
 * `position` ordonne une FRATRIE, jamais l'arbre entier.
 */
export interface Category {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  position: number;
}

/**
 * Entrée de création.
 *
 * ⚠️ `color`, `parentId` et `position` sont OPTIONNELS ici, alors qu'ils sont
 * obligatoires sur `Category` : une création sans eux reste une racine en fin
 * de liste, de la couleur par défaut, ce qui garde intacts tous les appelants
 * existants. `color` absente est HÉRITÉE du parent (tâche 5).
 *
 * ❌ Ne JAMAIS y ajouter `id` : l'identifiant d'une restauration passe par le
 * second argument de `create()` (`src/lib/restore-id.ts`, R-08).
 */
export type CreateCategoryInput = {
  name: string;
  color?: string;
  parentId?: string | null;
  position?: number;
};

/** Entrée de mise à jour. `parentId` y est admis : c'est le déplacement. */
export type UpdateCategoryInput = Partial<Omit<Category, 'id'>>;
```

Et dans `src/modules/categories/constants.ts` :

```typescript
/**
 * Couleur d'une catégorie racine créée sans couleur.
 *
 * ⚠️ Valeur unique : elle était écrite en dur dans `ColorSettingsModal`
 * (`#3B82F6`) et nulle part ailleurs.
 */
export const DEFAULT_CATEGORY_COLOR = '#3B82F6';
```

- [ ] **Step 4: Étendre le repository démo**

Dans `src/modules/categories/repository.ts`, ajouter en tête les imports :

```typescript
import { wouldCreateCycle, wouldExceedMaxDepth } from './tree';
import { DEFAULT_CATEGORY_COLOR } from './constants';
```

⚠️ `CATEGORIES_STORAGE_KEY` est déjà importé depuis `./constants` dans ce fichier : compléter l'import existant plutôt que d'en ajouter un second.

Ajouter dans la classe `LocalStorageCategoriesRepository`, avant `create` :

```typescript
  /**
   * Miroir du trigger `enforce_category_tree` (mig. 143).
   *
   * 🔴 Le mode démo doit refuser EXACTEMENT ce que la production refuse. Une
   * démo plus permissive laisse écrire un état que le serveur rejettera, et le
   * défaut ne se découvre qu'après la bascule.
   */
  private assertTreeIsValid(id: string, parentId: string | null, categories: Category[]): void {
    if (parentId === null) return;
    if (parentId === id) throw makeApiError('validation');
    if (!categories.some((c) => c.id === parentId)) throw makeApiError('not_found');
    if (wouldCreateCycle(id, parentId, categories)) throw makeApiError('validation');

    // 🔴 `treeDepth(id) > CATEGORY_MAX_DEPTH` NE SUFFIT PAS : ça ne mesure que
    // le nœud écrit, donc déplacer une branche haute de 4 crans sous un nœud au
    // niveau 8 passerait, en mettant ses feuilles au niveau 12.
    // `wouldExceedMaxDepth` ajoute la hauteur de la branche déplacée.
    if (wouldExceedMaxDepth(id, parentId, categories)) throw makeApiError('validation');
  }
```

Remplacer `create` :

```typescript
  async create(input: CreateCategoryInput, options?: CreateOptions): Promise<Category> {
    const categories = this.getCategories();
    const id = options?.restoreId ?? crypto.randomUUID();
    const parentId = input.parentId ?? null;

    this.assertTreeIsValid(id, parentId, categories);

    const newCategory: Category = {
      name: input.name,
      color: input.color ?? DEFAULT_CATEGORY_COLOR,
      parentId,
      position: input.position ?? categories.filter((c) => c.parentId === parentId).length,
      // Parite avec le repository Supabase : `restoreId` vient d'un
      // « Annuler », jamais d'un formulaire (R-08).
      id,
    };
    this.saveCategories([...categories, newCategory]);
    return newCategory;
  }
```

Remplacer `update` :

```typescript
  async update(id: string, updates: UpdateCategoryInput): Promise<Category> {
    const categories = this.getCategories();
    const index = categories.findIndex(c => c.id === id);

    if (index === -1) {
      throw makeApiError('not_found');
    }

    if (updates.parentId !== undefined) {
      this.assertTreeIsValid(id, updates.parentId, categories);
    }

    const updatedCategory: Category = { ...categories[index], ...updates };
    categories[index] = updatedCategory;
    this.saveCategories(categories);
    return updatedCategory;
  }
```

Remplacer `delete` :

```typescript
  async delete(id: string): Promise<void> {
    const categories = this.getCategories();

    // Miroir du ON DELETE NO ACTION de la mig. 143 : une branche ne part jamais
    // en silence. L'appelant doit avoir décidé du sort des enfants.
    if (categories.some((c) => c.parentId === id)) {
      throw makeApiError('validation');
    }

    const filtered = categories.filter(c => c.id !== id);

    if (filtered.length === categories.length) {
      throw makeApiError('not_found');
    }

    this.saveCategories(filtered);
  }
```

Enfin, compléter les seeds démo existants pour qu'ils portent les nouveaux champs (l'arborescence de démonstration arrive en tâche 14) :

```typescript
const DEMO_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Travail', color: '#3B82F6', parentId: null, position: 0 },
  { id: 'cat-2', name: 'Personnel', color: '#10B981', parentId: null, position: 1 },
  { id: 'cat-3', name: 'Santé', color: '#EF4444', parentId: null, position: 2 },
  { id: 'cat-4', name: 'Apprentissage', color: '#8B5CF6', parentId: null, position: 3 },
  { id: 'cat-5', name: 'Projets', color: '#F97316', parentId: null, position: 4 },
];
```

- [ ] **Step 5: Lancer les tests**

```bash
npx vitest run src/modules/categories/repository.test.ts src/modules/categories/tree.test.ts
```

Attendu : PASS.

⚠️ `makeApiError('validation')` doit exister dans `src/lib/normalizeApiError.ts`. Vérifier :

```bash
grep -n "validation" src/lib/normalizeApiError.ts
```

Si la clé n'existe pas, utiliser le code d'erreur générique déjà présent dans ce fichier plutôt que d'en inventer un, et adapter les tests en conséquence.

- [ ] **Step 6: Commit**

```bash
git add src/modules/categories/types.ts src/modules/categories/repository.ts src/modules/categories/repository.test.ts
git commit -m "feat(categories): parentId et position, repository demo aligne sur le trigger"
```

---

## Task 4: Repository Supabase

**Files:**
- Modify: `src/modules/categories/supabase.repository.ts`
- Test: `src/modules/categories/supabase.repository.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter dans `src/modules/categories/supabase.repository.test.ts` :

```typescript
describe('SupabaseCategoriesRepository — arbre', () => {
  it('lit parent_id et position depuis la base', async () => {
    // Adapter au harnais de mock déjà présent en tête de ce fichier.
    const row = { id: 'c1', name: 'SEO', color: '#000', parent_id: 'c0', position: 2 };
    const mapped = await readSingleRow(row);
    expect(mapped).toMatchObject({ id: 'c1', parentId: 'c0', position: 2 });
  });

  it('rend parentId null quand la colonne est NULL', async () => {
    const mapped = await readSingleRow({ id: 'c1', name: 'X', color: '#000', parent_id: null, position: 0 });
    expect(mapped.parentId).toBeNull();
  });

  it('écrit parent_id et position à la création', async () => {
    await repo.create({ name: 'SEO', color: '#000', parentId: 'c0', position: 3 });
    expect(lastInsert()).toMatchObject({ name: 'SEO', color: '#000', parent_id: 'c0', position: 3 });
  });

  // 🔴 La whitelist mapToDb reste une FRONTIÈRE : un champ non listé ne doit
  // jamais atteindre la base, `user_id` en premier lieu.
  it('n envoie jamais user_id depuis le payload', async () => {
    await repo.create({ name: 'X', color: '#000', ...({ user_id: 'autre' } as object) });
    expect(lastInsert().user_id).not.toBe('autre');
  });

  it('écrit parent_id à null quand on remonte une catégorie à la racine', async () => {
    await repo.update('c1', { parentId: null });
    expect(lastUpdate()).toMatchObject({ parent_id: null });
  });
});
```

⚠️ `readSingleRow`, `lastInsert`, `lastUpdate` et `repo` sont les helpers du harnais **déjà présent** en tête de `supabase.repository.test.ts`. Lire le fichier avant d'écrire, et réutiliser ses noms réels plutôt que d'en créer.

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

```bash
npx vitest run src/modules/categories/supabase.repository.test.ts
```

Attendu : ÉCHEC, `parentId` est `undefined` et `parent_id` n'est jamais envoyé.

- [ ] **Step 3: Étendre le mapping**

Dans `src/modules/categories/supabase.repository.ts`, remplacer les deux interfaces de ligne :

```typescript
interface CategoryRow {
  id: string;
  name: string;
  color: string;
  parent_id: string | null;
  position: number;
  user_id?: string;
  created_at?: string;
}

interface CategoryDbInput {
  name?: string;
  color?: string;
  parent_id?: string | null;
  position?: number;
  user_id?: string;
}
```

Remplacer `mapFromDb` et `mapToDb` :

```typescript
  private mapFromDb(row: CategoryRow): Category {
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      parentId: row.parent_id ?? null,
      position: row.position ?? 0,
    };
  }

  /**
   * Whitelist. ❌ Ne JAMAIS y ajouter `user_id` ni `id` : le premier est posé
   * par le serveur depuis la session, le second passe par le second argument
   * de `create()` (R-08).
   *
   * ⚠️ `parentId: null` est une valeur SIGNIFIANTE (« remonter à la racine ») :
   * le test doit être `!== undefined`, jamais une vérité JavaScript.
   */
  private mapToDb(input: Partial<Category>): CategoryDbInput {
    const result: CategoryDbInput = {};
    if (input.name !== undefined) result.name = input.name;
    if (input.color !== undefined) result.color = input.color;
    if (input.parentId !== undefined) result.parent_id = input.parentId;
    if (input.position !== undefined) result.position = input.position;
    return result;
  }
```

Adapter l'ordre de lecture pour que la fratrie sorte triée :

```typescript
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('position', { ascending: true })
      .order('name', { ascending: true })
      .limit(200); // Sécurité — les catégories ne devraient jamais dépasser 200
```

- [ ] **Step 4: Lancer les tests**

```bash
npx vitest run src/modules/categories/supabase.repository.test.ts
```

Attendu : PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/categories/supabase.repository.ts src/modules/categories/supabase.repository.test.ts
git commit -m "feat(categories): mapping parent_id et position cote Supabase"
```

---

## Task 5: Hooks · couleur héritée et déplacement

**Files:**
- Modify: `src/modules/categories/hooks.ts`
- Modify: `src/modules/categories/index.ts`
- Test: `src/modules/categories/hooks.test.tsx`

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter dans `src/modules/categories/hooks.test.tsx` :

```typescript
describe('useCreateCategory — couleur héritée', () => {
  it('reprend la couleur du parent quand aucune couleur n est donnée', async () => {
    // Le cache contient un parent rouge.
    seedCategories([
      { id: 'p', name: 'Parent', color: '#EF4444', parentId: null, position: 0 },
    ]);
    const { result } = renderHook(() => useCreateCategory(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ name: 'Enfant', parentId: 'p' });
    });
    expect(lastCreateInput()).toMatchObject({ color: '#EF4444', parentId: 'p' });
  });

  it('respecte une couleur explicitement fournie', async () => {
    seedCategories([
      { id: 'p', name: 'Parent', color: '#EF4444', parentId: null, position: 0 },
    ]);
    const { result } = renderHook(() => useCreateCategory(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ name: 'Enfant', color: '#10B981', parentId: 'p' });
    });
    expect(lastCreateInput().color).toBe('#10B981');
  });

  it('retombe sur la couleur par défaut pour une racine', async () => {
    seedCategories([]);
    const { result } = renderHook(() => useCreateCategory(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ name: 'Racine' });
    });
    expect(lastCreateInput().color).toBe(DEFAULT_CATEGORY_COLOR);
  });
});

describe('useMoveCategory', () => {
  it('écrit parentId ET position en une seule mutation', async () => {
    const { result } = renderHook(() => useMoveCategory(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 'c1', parentId: 'p', position: 2 });
    });
    expect(lastUpdateArgs()).toMatchObject({ id: 'c1', updates: { parentId: 'p', position: 2 } });
  });

  it('accepte parentId null pour remonter à la racine', async () => {
    const { result } = renderHook(() => useMoveCategory(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 'c1', parentId: null, position: 0 });
    });
    expect(lastUpdateArgs().updates.parentId).toBeNull();
  });
});

describe('useRestoreCategory', () => {
  // 🔴 R-08 : restaurer une catégorie à la RACINE parce qu'on n'a pas rendu son
  // parentId est une réparation en apparence seulement.
  it('restitue le parentId d origine, pas seulement l id', async () => {
    const snapshot = { id: 'c1', name: 'SEO', color: '#000', parentId: 'p', position: 3 };
    const { result } = renderHook(() => useRestoreCategory(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(snapshot);
    });
    expect(lastCreateInput()).toMatchObject({ parentId: 'p', position: 3 });
    expect(lastCreateOptions()).toEqual({ restoreId: 'c1' });
  });
});
```

⚠️ `seedCategories`, `wrapper`, `lastCreateInput`, `lastCreateOptions`, `lastUpdateArgs` sont à construire sur le harnais **déjà présent** dans `hooks.test.tsx`. Le lire avant d'écrire.

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

```bash
npx vitest run src/modules/categories/hooks.test.tsx
```

Attendu : ÉCHEC, `useMoveCategory` n'existe pas.

- [ ] **Step 3: Implémenter**

`DEFAULT_CATEGORY_COLOR` a été posée dans `constants.ts` à la tâche 3. Dans `src/modules/categories/hooks.ts`, remplacer `useCreateCategory` :

```typescript
/**
 * Création d'une catégorie.
 *
 * ⚠️ La couleur est HÉRITÉE du parent au moment de la CRÉATION, pas résolue au
 * rendu : une couleur calculée à l'affichage repeindrait rétroactivement toutes
 * les sous-catégories le jour où on change celle du parent. Elle reste
 * surchargeable ensuite, comme n'importe quelle couleur.
 */
export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  const repository = useCategoriesRepository();

  return useMutation({
    mutationFn: (input: CreateCategoryInput) => {
      const known = queryClient.getQueryData<Category[]>(categoryKeys.lists()) ?? [];
      const parent = input.parentId ? known.find((c) => c.id === input.parentId) : undefined;
      return repository.create({
        ...input,
        color: input.color ?? parent?.color ?? DEFAULT_CATEGORY_COLOR,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
    onError: (error: Error) => {
      toast.error(translator('errors').t('mutation.createCategory', { message: error.message }));
    },
  });
};
```

`CreateCategoryInput` rend déjà `color` optionnel depuis la tâche 3, et le repository démo retombe déjà sur `DEFAULT_CATEGORY_COLOR` : rien à changer de ce côté.

Ajouter `useMoveCategory` à la fin de la section des mutations de `hooks.ts` :

```typescript
/**
 * Déplacement d'une catégorie : reparentage ET réordonnancement.
 *
 * 🔴 UNE SEULE mutation, et UN SEUL geste d'interface : le menu
 * « Déplacer vers… ». ❌ Ne jamais lui adjoindre un glisser-déposer : la
 * décision produit du 2026-09-09 est que cette fonctionnalité doit rester
 * simple et intuitive, et un second chemin serait un second endroit où la
 * règle peut diverger.
 */
export const useMoveCategory = () => {
  const queryClient = useQueryClient();
  const repository = useCategoriesRepository();

  return useMutation({
    mutationFn: ({ id, parentId, position }: { id: string; parentId: string | null; position: number }) =>
      repository.update(id, { parentId, position }),

    onMutate: async ({ id, parentId, position }) => {
      await queryClient.cancelQueries({ queryKey: categoryKeys.all });
      const previousCategories = queryClient.getQueryData<Category[]>(categoryKeys.lists());
      if (previousCategories) {
        queryClient.setQueryData<Category[]>(categoryKeys.lists(), (old) =>
          old?.map((c) => (c.id === id ? { ...c, parentId, position } : c)),
        );
      }
      return { previousCategories };
    },

    onError: (error: Error, _variables, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(categoryKeys.lists(), context.previousCategories);
      }
      toast.error(translator('errors').t('mutation.moveCategory', { message: error.message }));
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });
};
```

`useRestoreCategory` **n'a pas besoin d'être modifié** : `splitRestore` conserve tous les champs sauf `id`, donc `parentId` et `position` traversent déjà. Le test de l'étape 1 le vérifie plutôt que de le supposer.

Ajouter la clé d'erreur dans `src/locales/fr/errors.json` :

```json
"mutation.moveCategory": "Impossible de déplacer la catégorie : {message}"
```

et dans `src/locales/en/errors.json` :

```json
"mutation.moveCategory": "Could not move the category: {message}"
```

Exporter dans `src/modules/categories/index.ts` :

```typescript
export {
  useCreateCategory,
  useUpdateCategory,
  useMoveCategory,
  useDeleteCategory,
  useRestoreCategory,
} from './hooks';

export { DEFAULT_CATEGORY_COLOR } from './constants';

export {
  CATEGORY_MAX_DEPTH,
  buildTree,
  categoryPath,
  childrenOf,
  descendantIds,
  ancestorIds,
  formatPath,
  orderByDepth,
  treeDepth,
  wouldCreateCycle,
} from './tree';
export type { CategoryNode } from './tree';
```

- [ ] **Step 4: Lancer les tests**

```bash
npx vitest run src/modules/categories
```

Attendu : PASS pour tout le module.

- [ ] **Step 5: Vérifier la parité i18n**

```bash
npm run i18n:check
```

Attendu : code 0.

- [ ] **Step 6: Commit**

```bash
git add src/modules/categories src/locales/fr/errors.json src/locales/en/errors.json
git commit -m "feat(categories): couleur heritee a la creation et useMoveCategory"
```

---

## Task 6: Impact de branche et chaînes de réaffectation

**Files:**
- Modify: `src/modules/categories/impact.ts`
- Test: `src/modules/categories/impact.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

Ajouter dans `src/modules/categories/impact.test.ts` :

```typescript
import { branchImpact, resolveReassignTargets } from './impact';
import type { Category } from './types';

const c = (id: string, parentId: string | null): Category => ({
  id, name: id, color: '#000', parentId, position: 0,
});

//  cat-a
//    └── cat-b
//          └── cat-c
const CATS: Category[] = [c('cat-a', null), c('cat-b', 'cat-a'), c('cat-c', 'cat-b')];

describe('branchImpact', () => {
  it('compte les sous-catégories de toute la branche', () => {
    expect(branchImpact('cat-a', TASKS, OKRS, CATS).subcategories).toBe(2);
  });

  it('agrège les tâches et objectifs des descendants', () => {
    const tasks = [task('t1', 'cat-a'), task('t2', 'cat-c')];
    expect(branchImpact('cat-a', tasks, [], CATS)).toMatchObject({ tasks: 2, subcategories: 2 });
  });

  it('rend zéro sous-catégorie pour une feuille', () => {
    expect(branchImpact('cat-c', TASKS, OKRS, CATS).subcategories).toBe(0);
  });
});

describe('resolveReassignTargets — destination emportée par sa branche', () => {
  // 🔴 Supprimer « cat-a » en désignant « cat-b » (son enfant) comme
  // destination est atteignable en deux décisions. « cat-b » disparaît AVEC la
  // branche : la destination doit retomber sur une catégorie qui survit.
  it('ne renvoie pas vers une catégorie emportée par la branche supprimée', () => {
    const removed = ['cat-a', 'cat-b', 'cat-c'];
    const chosen = { 'cat-a': 'cat-b' };
    expect(resolveReassignTargets(removed, chosen)).toMatchObject({ 'cat-a': NO_CATEGORY });
  });

  it('conserve une destination qui survit', () => {
    expect(resolveReassignTargets(['cat-a'], { 'cat-a': 'cat-survivante' })).toMatchObject({
      'cat-a': 'cat-survivante',
    });
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

```bash
npx vitest run src/modules/categories/impact.test.ts
```

Attendu : ÉCHEC, `branchImpact` n'existe pas.

- [ ] **Step 3: Implémenter**

Ajouter dans `src/modules/categories/impact.ts` :

```typescript
import { descendantIds } from './tree';
import type { Category } from './types';

/** Impact d'une suppression de BRANCHE : le nœud et tous ses descendants. */
export interface BranchImpact extends CategoryImpact {
  /** Sous-catégories emportées, le nœud lui-même exclu. */
  subcategories: number;
}

/**
 * Ce que la suppression de la BRANCHE de `categoryId` laisserait orphelin.
 *
 * 🔴 Compter le seul nœud visé donnerait un chiffre faux dans la boîte de
 * confirmation : supprimer « Travail » emporte aussi les tâches rangées dans
 * « Travail › SEO ». Annoncer moins que ce qu'on supprime est exactement le
 * défaut que R-02 ferme.
 */
export function branchImpact(
  categoryId: string | null | undefined,
  tasks: readonly Task[],
  okrs: readonly OKR[],
  categories: readonly Category[],
): BranchImpact {
  if (!categoryId) return { ...EMPTY_IMPACT, subcategories: 0 };

  const branch = [categoryId, ...descendantIds(categoryId, categories)];
  const ids = new Set(branch);
  const taskCount = tasks.filter((t) => ids.has(t.category)).length;
  const okrCount = okrs.filter((o) => ids.has(o.category)).length;

  return {
    tasks: taskCount,
    okrs: okrCount,
    total: taskCount + okrCount,
    subcategories: branch.length - 1,
  };
}

/** Identifiants à réaffecter pour toute une branche. */
export function branchDependents(
  categoryId: string | null | undefined,
  tasks: readonly Task[],
  okrs: readonly OKR[],
  categories: readonly Category[],
): CategoryDependents {
  if (!categoryId) return { taskIds: [], okrIds: [] };
  const ids = new Set([categoryId, ...descendantIds(categoryId, categories)]);
  return {
    taskIds: tasks.filter((t) => ids.has(t.category)).map((t) => t.id),
    okrIds: okrs.filter((o) => ids.has(o.category)).map((o) => o.id),
  };
}
```

`resolveReassignTargets` **n'a pas besoin d'être modifié** : l'appelant lui passe la liste complète des identifiants supprimés, branche comprise, et sa boucle suit déjà la chaîne jusqu'à une catégorie qui survit. Le test de l'étape 1 le vérifie plutôt que de le supposer. ⚠️ Si le test échoue, c'est que l'appelant ne passe pas la branche entière dans `removedIds` : corriger l'appelant, pas la fonction.

- [ ] **Step 4: Lancer les tests**

```bash
npx vitest run src/modules/categories/impact.test.ts
```

Attendu : PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/categories/impact.ts src/modules/categories/impact.test.ts
git commit -m "feat(categories): impact de branche pour la suppression"
```

---

## Task 7: L'arbre dans la modale de gestion

**Files:**
- Modify: `src/modules/ui-states/constants.ts`
- Modify: `src/modules/ui-states/hooks.ts`
- Modify: `src/modules/ui-states/index.ts`
- Create: `src/components/category/CategoryTreeRow.tsx`
- Modify: `src/components/ColorSettingsModal.tsx`

- [ ] **Step 1: Ajouter l'état replié dans `ui-states`**

Dans `src/modules/ui-states/constants.ts` :

```typescript
/** Catégories repliées dans l'arbre de gestion, par identifiant. */
export const CATEGORY_COLLAPSED_KEY = 'cosmo_category_collapsed';
```

Dans `src/modules/ui-states/hooks.ts`, ajouter un store et son hook, sur le modèle **exact** de `useFavoriteColors` déjà présent dans ce fichier (`useSyncExternalStore` + état au niveau module + persistance dans un `try` / `catch`).

Ajouter `CATEGORY_COLLAPSED_KEY` à l'import de `./constants` en tête de fichier, puis, avec les autres lecteurs :

```typescript
function readCollapsedCategories(): string[] {
  try {
    const stored = localStorage.getItem(CATEGORY_COLLAPSED_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string');
    }
  } catch { /* ignore */ }
  return [];
}
```

Avec les autres états de module :

```typescript
let collapsedCategoriesState: string[] = readCollapsedCategories();
const collapsedCategoriesListeners = new Set<() => void>();
```

Puis le hook :

```typescript
// ═══════════════════════════════════════════════════════════════════
// CATÉGORIES REPLIÉES — état de l'arbre de gestion
// ═══════════════════════════════════════════════════════════════════
//
// ⚠️ On mémorise ce qui est REPLIÉ, pas ce qui est déplié : une catégorie
// nouvellement créée n'est dans aucune des deux listes, et le défaut doit être
// « visible ». Mémoriser les dépliées ferait naître chaque nouvel enfant
// invisible sous son parent.
//
// ⚠️ Lecture dans un try/catch : un `JSON.parse` nu sur `localStorage` fait
// tomber la page si la valeur est corrompue (règle B14).

export const useCollapsedCategories = () => {
  const collapsed = useSyncExternalStore(
    (cb) => { collapsedCategoriesListeners.add(cb); return () => collapsedCategoriesListeners.delete(cb); },
    () => collapsedCategoriesState,
    () => collapsedCategoriesState,
  );

  const setCollapsed = useCallback((id: string, isCollapsed: boolean) => {
    const next = isCollapsed
      ? [...collapsedCategoriesState.filter((c) => c !== id), id]
      : collapsedCategoriesState.filter((c) => c !== id);
    collapsedCategoriesState = next;
    try { localStorage.setItem(CATEGORY_COLLAPSED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    collapsedCategoriesListeners.forEach((l) => l());
  }, []);

  const isCollapsed = useCallback((id: string) => collapsed.includes(id), [collapsed]);

  return { collapsed, setCollapsed, isCollapsed };
};
```

Exporter `CATEGORY_COLLAPSED_KEY` et `useCollapsedCategories` dans `src/modules/ui-states/index.ts`.

- [ ] **Step 2: Écrire la ligne d'arbre**

Créer `src/components/category/CategoryTreeRow.tsx` :

```tsx
import React from 'react';
import { ChevronRight, ChevronDown, Plus, Trash2, MoreHorizontal } from 'lucide-react';
import { useT } from '@/i18n/useT';

/**
 * Une ligne de l'arbre des catégories dans la modale de gestion.
 *
 * ⚠️ Rôles ARIA d'arbre : la ligne est un `treeitem`, elle porte son niveau et
 * son état déplié. Sans eux, un lecteur d'écran lit une liste plate, et
 * l'indentation visuelle ne dit rien.
 *
 * ⚠️ `aria-level` commence à 1 pour une racine, comme `treeDepth`.
 */
interface CategoryTreeRowProps {
  id: string;
  name: string;
  color: string;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onAddChild: () => void;
  onMove: () => void;
  onDelete: () => void;
  /** Vrai quand la profondeur maximale est atteinte : « + » est désactivé. */
  atMaxDepth: boolean;
}

const CategoryTreeRow: React.FC<CategoryTreeRowProps> = ({
  id, name, color, depth, hasChildren, isExpanded,
  onToggle, onNameChange, onColorChange, onAddChild, onMove, onDelete, atMaxDepth,
}) => {
  const { t } = useT('tasks');

  return (
    <div
      role="treeitem"
      aria-level={depth}
      aria-expanded={hasChildren ? isExpanded : undefined}
      className="flex items-center gap-2 min-h-11"
      style={{ paddingInlineStart: `${(depth - 1) * 16}px` }}
    >
      {hasChildren ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={isExpanded ? t('colorModal.collapse') : t('colorModal.expand')}
          className="p-1 shrink-0"
        >
          {isExpanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
        </button>
      ) : (
        <span className="w-6 shrink-0" aria-hidden="true" />
      )}

      <input
        type="color"
        value={color}
        onChange={(e) => onColorChange(e.target.value)}
        aria-label={t('colorModal.colorFor', { name })}
        className="w-7 h-7 shrink-0 rounded"
      />

      <input
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        aria-label={t('colorModal.nameFor', { name })}
        className="flex-1 min-w-0 min-h-11 bg-transparent text-sm text-[rgb(var(--color-text-primary))]"
      />

      <button
        type="button"
        onClick={onAddChild}
        disabled={atMaxDepth}
        aria-label={t('colorModal.addChildTo', { name })}
        title={atMaxDepth ? t('colorModal.maxDepthReached') : undefined}
        className="p-2 shrink-0 disabled:opacity-40"
      >
        <Plus size={14} aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onMove}
        aria-label={t('colorModal.moveCategory', { name })}
        className="p-2 shrink-0"
      >
        <MoreHorizontal size={14} aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={onDelete}
        aria-label={t('colorModal.deleteCategory', { name })}
        className="p-2 shrink-0 text-red-600 dark:text-red-400"
      >
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </div>
  );
};

export default CategoryTreeRow;
```

Identifiant `id` non utilisé dans le rendu : le retirer des props si TypeScript s'en plaint (`noUnusedParameters`), ou le poser en `data-category-id` pour les tests.

- [ ] **Step 3: Ajouter les clés i18n**

Dans `src/locales/fr/tasks.json` :

```json
"colorModal.expand": "Déplier",
"colorModal.collapse": "Replier",
"colorModal.colorFor": "Couleur de {name}",
"colorModal.nameFor": "Nom de {name}",
"colorModal.addChildTo": "Ajouter une sous-catégorie à {name}",
"colorModal.moveCategory": "Déplacer {name}",
"colorModal.deleteCategory": "Supprimer {name}",
"colorModal.maxDepthReached": "Profondeur maximale atteinte",
"colorModal.addRoot": "Ajouter une catégorie"
```

Dans `src/locales/en/tasks.json` :

```json
"colorModal.expand": "Expand",
"colorModal.collapse": "Collapse",
"colorModal.colorFor": "Colour of {name}",
"colorModal.nameFor": "Name of {name}",
"colorModal.addChildTo": "Add a subcategory to {name}",
"colorModal.moveCategory": "Move {name}",
"colorModal.deleteCategory": "Delete {name}",
"colorModal.maxDepthReached": "Maximum depth reached",
"colorModal.addRoot": "Add a category"
```

- [ ] **Step 4: Câbler l'arbre dans la modale**

Dans `src/components/ColorSettingsModal.tsx` :

1. Importer `buildTree`, `CATEGORY_MAX_DEPTH`, `treeDepth` depuis `@/modules/categories`, `CategoryTreeRow`, et `useCollapsedCategories`.
2. Remplacer le rendu de la liste plate par un rendu récursif de `buildTree(localCategories)`, chaque nœud rendant une `CategoryTreeRow` puis ses enfants si déplié.
3. Le conteneur de l'arbre porte `role="tree"` et un `aria-label` tiré du catalogue.
4. `handleAddCategory` prend un paramètre :

```typescript
  const handleAddCategory = (parentId: string | null = null) => {
    const newId = `temp-${Date.now()}`;
    const parent = parentId ? localCategories.find((c) => c.id === parentId) : undefined;
    const newCat: Category = {
      id: newId,
      name: '',
      // Couleur héritée du parent : une famille se lit à la teinte.
      color: parent?.color ?? DEFAULT_CATEGORY_COLOR,
      parentId,
      position: localCategories.filter((c) => c.parentId === parentId).length,
    };
    setLocalCategories([...localCategories, newCat]);
    if (parentId) setExpanded(parentId, true);
    // … le scroll existant est conservé
  };
```

5. Le gabarit mobile passe en plein écran. La feuille garde `useSheetMotion` / `useSheetDrag` : ❌ ne jamais écrire le mouvement à la main, et la position finale vient du CSS, jamais d'une animation de transform (un utilisateur en `prefers-reduced-motion` verrait sinon la feuille rester hors écran).

- [ ] **Step 5: Vérifier dans le navigateur**

Le mode démo suffit : aucune migration n'est nécessaire pour l'essayer.

1. Lancer l'aperçu, ouvrir la modale des couleurs depuis la page Tâches.
2. Cliquer le « + » d'une ligne : un enfant apparaît, indenté, de la couleur du parent, avec le focus dans son champ de nom.
3. Replier puis déplier : l'état survit à la fermeture et à la réouverture de la modale.
4. Vérifier avec Tab et les flèches que chaque ligne est atteignable.

- [ ] **Step 6: Commit**

```bash
git add src/modules/ui-states src/components/category/CategoryTreeRow.tsx src/components/ColorSettingsModal.tsx src/locales/fr/tasks.json src/locales/en/tasks.json
git commit -m "feat(categories): arbre repliable et creation d'enfant dans la modale"
```

---

## Task 8: L'ordre d'écriture à l'enregistrement

Le point le plus fragile de la vague. À traiter par un test avant tout code.

**Files:**
- Modify: `src/components/ColorSettingsModal.tsx`
- Create: `src/components/color-settings-save-order.test.ts`

- [ ] **Step 1: Extraire la logique d'ordonnancement dans une fonction pure**

Créer, dans `src/components/ColorSettingsModal.tsx`, une fonction **exportée** et testable :

```typescript
/**
 * Plan d'écriture d'un lot de créations.
 *
 * 🔴 POURQUOI. Un enfant créé dans le MÊME lot que son parent porte un
 * `parentId` en `temp-`, qui ne désigne aucune ligne serveur. Le `Promise.all`
 * d'origine envoyait tout en parallèle : l'enfant partait avec une référence
 * invalide.
 *
 * On crée donc par niveau, et on substitue chaque `temp-` par l'identifiant
 * réel rendu par la création du parent.
 */
export function planCreations(drafts: readonly Category[]): Category[] {
  return orderByDepth(drafts.filter((c) => c.id.startsWith('temp-')));
}
```

- [ ] **Step 2: Écrire les tests qui échouent**

Créer `src/components/color-settings-save-order.test.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import { planCreations } from './ColorSettingsModal';
import type { Category } from '@/modules/categories';

const draft = (id: string, parentId: string | null): Category => ({
  id, name: id, color: '#000', parentId, position: 0,
});

describe('planCreations', () => {
  it('rend un parent avant son enfant, même déclarés dans le désordre', () => {
    const plan = planCreations([draft('temp-2', 'temp-1'), draft('temp-1', null)]);
    expect(plan.map((c) => c.id)).toEqual(['temp-1', 'temp-2']);
  });

  it('ignore les catégories déjà enregistrées', () => {
    const plan = planCreations([draft('cat-1', null), draft('temp-1', 'cat-1')]);
    expect(plan.map((c) => c.id)).toEqual(['temp-1']);
  });

  it('accepte un enfant dont le parent est déjà en base', () => {
    expect(planCreations([draft('temp-1', 'cat-existante')]).map((c) => c.id)).toEqual(['temp-1']);
  });

  // ─── TÉMOIN ────────────────────────────────────────────────────────
  // 🔴 Ce cas existe pour prouver que le détecteur DÉTECTE. Sans lui, une
  // implémentation qui rendrait le lot inchangé passerait les trois cas
  // ci-dessus par hasard, l'ordre d'entrée étant parfois déjà bon.
  it('TÉMOIN : un lot déjà trié à l envers n est PAS rendu tel quel', () => {
    const reversed = [draft('temp-3', 'temp-2'), draft('temp-2', 'temp-1'), draft('temp-1', null)];
    expect(planCreations(reversed).map((c) => c.id)).not.toEqual(reversed.map((c) => c.id));
    expect(planCreations(reversed).map((c) => c.id)).toEqual(['temp-1', 'temp-2', 'temp-3']);
  });
});
```

- [ ] **Step 3: Lancer les tests pour vérifier qu'ils échouent**

```bash
npx vitest run src/components/color-settings-save-order.test.ts
```

Attendu : ÉCHEC, `planCreations` n'est pas exportée.

- [ ] **Step 4: Réécrire `handleSave`**

Dans `src/components/ColorSettingsModal.tsx`, remplacer la partie « Create or update categories » :

```typescript
      // ⚠️ Les MISES À JOUR peuvent partir en parallèle : elles visent des
      // lignes qui existent déjà. Ce sont les CRÉATIONS qui doivent respecter
      // un ordre, un enfant ne pouvant pas référencer un parent inexistant.
      const updatePromises = localCategories
        .filter((lc) => !lc.id.startsWith('temp-'))
        .map((lc) => {
          const existing = categories.find((cat) => cat.id === lc.id);
          if (!existing) return Promise.resolve();
          if (
            existing.name === lc.name &&
            existing.color === lc.color &&
            existing.parentId === lc.parentId &&
            existing.position === lc.position
          ) {
            return Promise.resolve();
          }
          return updateCategoryMutation.mutateAsync({
            id: lc.id,
            updates: {
              name: lc.name,
              color: lc.color,
              parentId: lc.parentId,
              position: lc.position,
            },
          });
        });

      await Promise.all([...deletePromises, ...updatePromises]);

      // Créations : par niveau, en séquence, avec substitution des `temp-`.
      const tempToReal = new Map<string, string>();
      for (const draft of planCreations(localCategories)) {
        const parentId = draft.parentId?.startsWith('temp-')
          ? tempToReal.get(draft.parentId) ?? null
          : draft.parentId;
        const created = await createCategoryMutation.mutateAsync({
          name: draft.name,
          color: draft.color,
          parentId,
          position: draft.position,
        });
        tempToReal.set(draft.id, created.id);
      }
```

⚠️ Les suppressions restent **avant** les créations et les mises à jour, et la réaffectation reste avant les suppressions : cet ordre est celui de R-02, il ne se réarrange pas pour des raisons de lisibilité.

- [ ] **Step 5: Lancer les tests**

```bash
npx vitest run src/components/color-settings-save-order.test.ts
```

Attendu : PASS, témoin compris.

- [ ] **Step 6: Vérifier dans le navigateur, en mode démo**

Créer un parent ET son enfant **sans enregistrer entre les deux**, puis enregistrer. Rouvrir la modale : l'enfant doit être sous son parent, pas à la racine.

- [ ] **Step 7: Commit**

```bash
git add src/components/ColorSettingsModal.tsx src/components/color-settings-save-order.test.ts
git commit -m "fix(categories): creer les parents avant les enfants a l'enregistrement"
```

---

## Task 9: « Déplacer vers… »

**Files:**
- Create: `src/components/category/MoveCategoryDialog.tsx`
- Modify: `src/components/ColorSettingsModal.tsx`

- [ ] **Step 1: Écrire la boîte de déplacement**

Créer `src/components/category/MoveCategoryDialog.tsx` :

```tsx
import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { CATEGORY_MAX_DEPTH, categoryPath, descendantIds, formatPath, treeDepth } from '@/modules/categories';
import type { Category } from '@/modules/categories';

/**
 * « Déplacer vers… » — le SEUL chemin de reparentage.
 *
 * 🔴 Pas de glisser-déposer, décision du 2026-09-09 : la fonctionnalité doit
 * rester simple et intuitive. Ce menu marche partout, à la souris, au doigt et
 * au clavier, sans cas particulier ni auto-défilement, et il n'a pas besoin
 * d'un second chemin qui ferait la même chose autrement.
 *
 * Destinations exclues, et pourquoi :
 *   - la catégorie elle-même  → cycle immédiat
 *   - ses descendants         → cycle indirect
 *   - toute ligne `temp-`     → ne désigne aucune ligne serveur
 *   - toute destination qui ferait dépasser CATEGORY_MAX_DEPTH, en comptant la
 *     HAUTEUR de la branche déplacée, pas seulement le nœud
 */
interface MoveCategoryDialogProps {
  open: boolean;
  category: Category | null;
  categories: Category[];
  onCancel: () => void;
  onConfirm: (parentId: string | null) => void;
}

const MoveCategoryDialog: React.FC<MoveCategoryDialogProps> = ({
  open, category, categories, onCancel, onConfirm,
}) => {
  const { t } = useT('tasks');
  const [target, setTarget] = useState<string>('');

  const options = useMemo(() => {
    if (!category) return [];
    const forbidden = new Set([category.id, ...descendantIds(category.id, categories)]);

    // Hauteur de la branche déplacée : déplacer « SEO » emporte « Backlinks ».
    const branch = [category.id, ...descendantIds(category.id, categories)];
    const branchHeight = Math.max(
      ...branch.map((id) => treeDepth(id, categories) - treeDepth(category.id, categories) + 1),
    );

    return categories.filter((c) => {
      if (forbidden.has(c.id)) return false;
      if (c.id.startsWith('temp-')) return false;
      return treeDepth(c.id, categories) + branchHeight <= CATEGORY_MAX_DEPTH;
    });
  }, [category, categories]);

  const { ref, dialogProps } = useModalA11y<HTMLDivElement>({
    open,
    onClose: onCancel,
    label: t('colorModal.moveTitle'),
  });

  if (!open || !category) return null;

  return (
    <div ref={ref} {...dialogProps} className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-md" onClick={onCancel} />
      <div className="relative bg-[rgb(var(--color-surface))] rounded-xl w-full max-w-sm p-6 border border-[rgb(var(--color-border))]">
        <h3 className="text-lg font-bold mb-4 text-[rgb(var(--color-text-primary))]">
          {t('colorModal.moveTitle')}
        </h3>

        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          aria-label={t('colorModal.moveTarget')}
          className="w-full min-h-11 rounded-xl border px-3 text-sm bg-[rgb(var(--color-hover))] border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))]"
        >
          <option value="">{t('colorModal.moveToRoot')}</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {formatPath(categoryPath(c.id, categories))}
            </option>
          ))}
        </select>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1 min-h-11" onClick={onCancel}>
            {t('colorModal.moveCancel')}
          </Button>
          <Button className="flex-1 min-h-11" onClick={() => onConfirm(target === '' ? null : target)}>
            {t('colorModal.moveConfirm')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MoveCategoryDialog;
```

- [ ] **Step 2: Ajouter les clés i18n**

`src/locales/fr/tasks.json` :

```json
"colorModal.moveTitle": "Déplacer la catégorie",
"colorModal.moveTarget": "Nouvelle catégorie parente",
"colorModal.moveToRoot": "À la racine, sans parent",
"colorModal.moveCancel": "Annuler",
"colorModal.moveConfirm": "Déplacer"
```

`src/locales/en/tasks.json` :

```json
"colorModal.moveTitle": "Move category",
"colorModal.moveTarget": "New parent category",
"colorModal.moveToRoot": "To the top level, no parent",
"colorModal.moveCancel": "Cancel",
"colorModal.moveConfirm": "Move"
```

- [ ] **Step 3: Câbler dans la modale**

Dans `ColorSettingsModal`, un état `categoryToMove: string | null`, le bouton « … » de `CategoryTreeRow` le renseigne, et la confirmation modifie **l'état local** (`setLocalCategories`), pas la base : la modale reste un éditeur par lot, et l'écriture a lieu à l'enregistrement, via le chemin de la tâche 8.

⚠️ `MoveCategoryDialog` est rendu en **frère** de l'overlay de la modale. `useModalA11y` empile les surfaces (`openStack`), donc seule la dernière ouverte réagit à Échap : c'est le comportement voulu, ne pas le contourner.

- [ ] **Step 4: Vérifier au clavier dans le navigateur**

En mode démo, atteindre le bouton « … » d'une sous-catégorie **au clavier seul**, ouvrir la boîte, choisir une destination, confirmer, puis vérifier que le focus revient sur le déclencheur. Échap doit fermer sans déplacer.

- [ ] **Step 5: Commit**

```bash
git add src/components/category/MoveCategoryDialog.tsx src/components/ColorSettingsModal.tsx src/locales/fr/tasks.json src/locales/en/tasks.json
git commit -m "feat(categories): deplacer une categorie au clavier et sur mobile"
```

---

## Task 10: Suppression d'une branche

**Files:**
- Modify: `src/components/category/DeleteCategoryDialog.tsx`
- Modify: `src/components/ColorSettingsModal.tsx`

- [ ] **Step 1: Étendre la boîte de dialogue**

Dans `DeleteCategoryDialog`, ajouter deux props :

```typescript
  /** Arbre complet, pour calculer l'impact de la branche. */
  categoriesTree: Category[];
  /**
   * Issue choisie pour les enfants. `onConfirm` la rend avec la destination.
   *
   * - `promote` : les enfants prennent le parent du supprimé
   * - `deleteBranch` : toute la branche part, son contenu est réaffecté
   */
  onConfirm: (reassignTo: string, childrenMode: 'promote' | 'deleteBranch') => void;
```

Remplacer le calcul d'impact par `branchImpact`, et n'afficher le choix `promote` / `deleteBranch` que si `impact.subcategories > 0`. Le défaut est **`promote`** : c'est l'issue qui ne détruit rien, donc la moins surprenante, exactement le raisonnement qui a fait choisir `NO_CATEGORY` par défaut pour la réaffectation.

⚠️ Quand `promote` est choisi, la réaffectation ne porte que sur le **nœud visé**, pas sur la branche : ses enfants survivent avec leur contenu. Utiliser `categoryDependents` dans ce cas, `branchDependents` dans l'autre. Se tromper de fonction déplacerait des tâches qui n'avaient pas à bouger.

- [ ] **Step 2: Ajouter les clés i18n**

`src/locales/fr/overlays.json` :

```json
"deleteCategory.impactSubcategories_one": "{count} sous-catégorie sera supprimée",
"deleteCategory.impactSubcategories_other": "{count} sous-catégories seront supprimées",
"deleteCategory.childrenLabel": "Que faire des sous-catégories ?",
"deleteCategory.childrenPromote": "Les remonter d'un cran",
"deleteCategory.childrenDeleteBranch": "Supprimer toute la branche"
```

`src/locales/en/overlays.json` :

```json
"deleteCategory.impactSubcategories_one": "{count} subcategory will be deleted",
"deleteCategory.impactSubcategories_other": "{count} subcategories will be deleted",
"deleteCategory.childrenLabel": "What about the subcategories?",
"deleteCategory.childrenPromote": "Move them up one level",
"deleteCategory.childrenDeleteBranch": "Delete the whole branch"
```

⚠️ Vérifier la convention de pluriel réellement utilisée par `tp()` dans ce dépôt (`src/i18n/`) avant d'écrire ces clés, et s'y conformer plutôt que d'inventer les suffixes.

- [ ] **Step 3: Appliquer l'issue dans la modale**

Dans `ColorSettingsModal`, `confirmDeleteLocal(reassignTo, childrenMode)` :

- `promote` : chaque enfant direct prend le `parentId` du supprimé, puis le nœud est retiré de l'état local.
- `deleteBranch` : le nœud **et tous ses descendants** sont retirés, et **tous leurs identifiants** entrent dans `removed`, donc dans `resolveReassignTargets`. C'est ce qui fait retomber une destination emportée par la branche sur une catégorie qui survit (test de la tâche 6).

🔴 À l'enregistrement, une branche se supprime **des feuilles vers la racine** : l'application écrit une suppression par catégorie, en requêtes séparées, et `ON DELETE NO ACTION` refuse alors l'ordre inverse. Trier les suppressions par profondeur **décroissante**, ce qui s'obtient en inversant `orderByDepth`.

- [ ] **Step 4: Vérifier dans le navigateur**

En mode démo, avec des tâches rangées dans une sous-catégorie :

1. Supprimer un parent en choisissant « remonter » : les enfants deviennent racines, aucune tâche ne bouge.
2. Supprimer un parent en choisissant « supprimer la branche » et une destination : les compteurs annoncés correspondent à ce qui se passe réellement.
3. Vérifier qu'« Annuler » restaure la catégorie **sous son parent d'origine**.

- [ ] **Step 5: Commit**

```bash
git add src/components/category/DeleteCategoryDialog.tsx src/components/ColorSettingsModal.tsx src/locales/fr/overlays.json src/locales/en/overlays.json
git commit -m "feat(categories): suppression d'une branche avec choix du sort des enfants"
```

---

## Task 11: Le sélecteur arborescent

**Files:**
- Create: `src/components/category/CategoryTreeSelect.tsx`
- Modify: `src/components/task-modal/CategoryField.tsx`

- [ ] **Step 1: Écrire le sélecteur**

Créer `src/components/category/CategoryTreeSelect.tsx` :

```tsx
import React, { useMemo, useState } from 'react';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { buildTree, categoryPath, formatPath } from '@/modules/categories';
import type { Category, CategoryNode } from '@/modules/categories';

/**
 * Sélecteur de catégorie arborescent, avec recherche par chemin.
 *
 * ⚠️ Un parent reste SÉLECTIONNABLE : une tâche peut vivre dans « Travail »
 * même si « Travail › SEO » existe. C'est une décision produit, pas un oubli.
 *
 * ❌ Pas de menus en cascade : ils sont impraticables au doigt et au clavier.
 * Un panneau unique, indenté, plus une recherche, tient à n'importe quelle
 * profondeur.
 *
 * ⚠️ La recherche filtre sur le CHEMIN COMPLET et l'affiche : chercher
 * « backlinks » doit trouver « Travail › SEO › Backlinks », sinon une feuille
 * profonde est introuvable dès qu'on ne se souvient plus de son parent.
 */
interface CategoryTreeSelectProps {
  value: string;
  onChange: (categoryId: string) => void;
  categories: Category[];
}

const CategoryTreeSelect: React.FC<CategoryTreeSelectProps> = ({ value, onChange, categories }) => {
  const { t } = useT('tasks');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const close = () => { setOpen(false); setQuery(''); };

  // Échap emprunte EXACTEMENT le chemin du clic à l'extérieur : `close`.
  const { ref, dialogProps } = useModalA11y<HTMLDivElement>({
    open,
    onClose: close,
    label: t('fields.category'),
  });

  const selectedPath = useMemo(
    () => (value ? formatPath(categoryPath(value, categories)) : ''),
    [value, categories],
  );

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') return null;
    return categories
      .map((c) => ({ category: c, path: formatPath(categoryPath(c.id, categories)) }))
      .filter((m) => m.path.toLowerCase().includes(needle));
  }, [query, categories]);

  const pick = (id: string) => { onChange(id); close(); };

  const renderNode = (node: CategoryNode, depth: number): React.ReactNode => (
    <React.Fragment key={node.category.id}>
      <button
        type="button"
        role="option"
        aria-selected={node.category.id === value}
        onClick={() => pick(node.category.id)}
        style={{ paddingInlineStart: `${8 + depth * 16}px` }}
        className="flex w-full items-center gap-2 min-h-11 text-left text-sm text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))]"
      >
        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: node.category.color }} />
        <span className="truncate">{node.category.name}</span>
      </button>
      {node.children.map((child) => renderNode(child, depth + 1))}
    </React.Fragment>
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full min-h-11 rounded-xl border px-3 text-left text-sm bg-[rgb(var(--color-hover))] border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))]"
      >
        {selectedPath || t('fields.categoryNone')}
      </button>

      {open && (
        <div ref={ref} {...dialogProps} className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-md" onClick={close} />
          <div className="relative w-full sm:max-w-sm max-h-[70vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] p-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('fields.categorySearch')}
              aria-label={t('fields.categorySearch')}
              className="w-full min-h-11 rounded-xl px-3 mb-2 text-sm bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))]"
            />

            <div role="listbox" aria-label={t('fields.category')}>
              <button
                type="button"
                role="option"
                aria-selected={value === ''}
                onClick={() => pick('')}
                className="flex w-full items-center min-h-11 px-2 text-left text-sm text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]"
              >
                {t('fields.categoryNone')}
              </button>

              {matches === null
                ? buildTree(categories).map((node) => renderNode(node, 0))
                : matches.length === 0
                  ? <p className="px-2 py-3 text-sm text-[rgb(var(--color-text-muted))]">{t('fields.categoryNoResult')}</p>
                  : matches.map((m) => (
                      <button
                        key={m.category.id}
                        type="button"
                        role="option"
                        aria-selected={m.category.id === value}
                        onClick={() => pick(m.category.id)}
                        className="flex w-full items-center gap-2 min-h-11 px-2 text-left text-sm text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))]"
                      >
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: m.category.color }} />
                        <span className="truncate">{m.path}</span>
                      </button>
                    ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryTreeSelect;
```

- [ ] **Step 2: Ajouter les clés i18n**

`src/locales/fr/tasks.json` :

```json
"fields.categorySearch": "Rechercher une catégorie",
"fields.categoryNone": "Aucune catégorie",
"fields.categoryNoResult": "Aucune catégorie ne correspond"
```

`src/locales/en/tasks.json` :

```json
"fields.categorySearch": "Search a category",
"fields.categoryNone": "No category",
"fields.categoryNoResult": "No category matches"
```

- [ ] **Step 3: Brancher `CategoryField`**

Remplacer les pastilles à plat par `CategoryTreeSelect`. La prop `onChange: (categoryId: string) => void` **ne change pas** : les appelants (`TaskModal`, `OKRModalSheet`, `QuickAddBar`) ne sont pas touchés.

- [ ] **Step 4: Vérifier dans le navigateur**

En mode démo : créer une tâche, choisir une sous-catégorie profonde, vérifier qu'elle est bien enregistrée, puis rechercher par le nom de la feuille seule.

- [ ] **Step 5: Commit**

```bash
git add src/components/category/CategoryTreeSelect.tsx src/components/task-modal/CategoryField.tsx src/locales/fr/tasks.json src/locales/en/tasks.json
git commit -m "feat(categories): selecteur arborescent avec recherche par chemin"
```

---

## Task 12: Filtrer une branche

**Files:**
- Modify: `src/components/TaskFilter.tsx`
- Test: `src/components/task-filter-branch.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

Créer `src/components/task-filter-branch.test.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import { matchesCategoryFilter } from './TaskFilter';
import type { Category } from '@/modules/categories';

const c = (id: string, parentId: string | null): Category => ({
  id, name: id, color: '#000', parentId, position: 0,
});

const CATS = [c('travail', null), c('seo', 'travail'), c('backlinks', 'seo'), c('perso', null)];

describe('matchesCategoryFilter', () => {
  it('remonte les tâches du parent ET de toute sa branche', () => {
    expect(matchesCategoryFilter('backlinks', 'travail', CATS)).toBe(true);
    expect(matchesCategoryFilter('seo', 'travail', CATS)).toBe(true);
    expect(matchesCategoryFilter('travail', 'travail', CATS)).toBe(true);
  });

  it('ne remonte pas une autre branche', () => {
    expect(matchesCategoryFilter('perso', 'travail', CATS)).toBe(false);
  });

  it('laisse tout passer quand aucun filtre n est posé', () => {
    expect(matchesCategoryFilter('perso', '', CATS)).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

```bash
npx vitest run src/components/task-filter-branch.test.ts
```

Attendu : ÉCHEC, `matchesCategoryFilter` n'existe pas.

- [ ] **Step 3: Implémenter**

Dans `src/components/TaskFilter.tsx` :

```typescript
/**
 * Une tâche passe-t-elle le filtre de catégorie ?
 *
 * 🔴 CHANGEMENT DE SÉMANTIQUE ASSUMÉ (2026-09-09). Filtrer « Travail » remonte
 * désormais aussi les tâches de « Travail › SEO ». C'est l'attente naturelle
 * d'un arbre ; un compte dont les catégories restent plates ne voit aucune
 * différence, `descendantIds` rendant alors un tableau vide.
 */
export function matchesCategoryFilter(
  taskCategory: string,
  selected: string,
  categories: readonly Category[],
): boolean {
  if (selected === '') return true;
  if (taskCategory === selected) return true;
  return descendantIdSet(selected, categories).has(taskCategory);
}
```

⚠️ **Hisser le `Set` hors de la boucle** dans le composant. Appelée telle quelle
pour chaque tâche, cette fonction refait le parcours de la branche à chaque
élément filtré : le coût devient quadratique en catégories alors qu'il est plat
si le `Set` est calculé une fois. Dans `TaskFilter`, mémoriser
`useMemo(() => descendantIdSet(selected, categories), [selected, categories])`
et passer le `Set` au prédicat.

Remplacer la liste plate de catégories du filtre par le même rendu d'arbre repliable que la modale, en réutilisant `buildTree`.

- [ ] **Step 4: Lancer le test**

```bash
npx vitest run src/components/task-filter-branch.test.ts
```

Attendu : PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/TaskFilter.tsx src/components/task-filter-branch.test.ts
git commit -m "feat(categories): filtrer un parent remonte toute sa branche"
```

---

## Task 13: Le chemin sur la tâche

**Files:**
- Modify: `src/components/TaskCategoryIndicator.tsx`

- [ ] **Step 1: Afficher la feuille, le chemin en infobulle**

La pastille continue d'afficher `category.name`, donc **la feuille seule**. Elle gagne un `title` valant le chemin complet :

```tsx
  const path = useMemo(() => categoryPath(categoryId, categories), [categoryId, categories]);
  const fullPath = formatPath(path);
  // Une infobulle seule n'est pas atteignable au clavier ni au doigt :
  // `aria-label` porte la même information pour un lecteur d'écran.
  <span title={fullPath} aria-label={fullPath}>{path[path.length - 1]?.name}</span>
```

⚠️ Ne pas afficher le chemin complet dans la pastille : les cartes de tâche mobiles n'ont pas de largeur à céder, et c'est la raison pour laquelle cette option a été écartée.

- [ ] **Step 2: Vérifier dans le navigateur, en 375 px de large**

Utiliser l'émulation mobile. La carte de tâche ne doit pas gagner en largeur ni provoquer de défilement horizontal.

- [ ] **Step 3: Commit**

```bash
git add src/components/TaskCategoryIndicator.tsx
git commit -m "feat(categories): chemin complet en infobulle sur la pastille"
```

---

## Task 14: Seeds de démonstration arborescents

**Files:**
- Modify: `src/modules/categories/repository.ts`
- Modify: `src/modules/tasks/local.repository.ts`

- [ ] **Step 1: Réécrire les seeds de catégories**

Dans `src/modules/categories/repository.ts` :

```typescript
// Deux racines subdivisées : la hiérarchie se VOIT sans avoir à la construire.
const DEMO_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Travail',       color: '#3B82F6', parentId: null,    position: 0 },
  { id: 'cat-6', name: 'SEO',           color: '#3B82F6', parentId: 'cat-1', position: 0 },
  { id: 'cat-7', name: 'Backlinks',     color: '#3B82F6', parentId: 'cat-6', position: 0 },
  { id: 'cat-5', name: 'Projets',       color: '#F97316', parentId: 'cat-1', position: 1 },
  { id: 'cat-2', name: 'Personnel',     color: '#10B981', parentId: null,    position: 1 },
  { id: 'cat-3', name: 'Santé',         color: '#EF4444', parentId: 'cat-2', position: 0 },
  { id: 'cat-4', name: 'Apprentissage', color: '#8B5CF6', parentId: 'cat-2', position: 1 },
];

const DEMO_CATEGORIES_EN: Record<string, Partial<Category>> = {
  'cat-1': { name: 'Work' },
  'cat-2': { name: 'Personal' },
  'cat-3': { name: 'Health' },
  'cat-4': { name: 'Learning' },
  'cat-5': { name: 'Projects' },
  'cat-6': { name: 'SEO' },
  'cat-7': { name: 'Backlinks' },
};
```

⚠️ Les identifiants existants (`cat-1` à `cat-5`) sont **conservés** : les ~100 tâches de démonstration les référencent. En créer de nouveaux orphelinerait tout le jeu de démonstration.

⚠️ `cat-6` et `cat-7` doivent apparaître dans l'overlay anglais, même quand le nom ne change pas. Sans quoi `npm run i18n:identical` ne dit rien (les seeds en sont exclus), mais la démo anglaise afficherait une entrée non traduite si le nom venait à changer.

- [ ] **Step 2: Ranger quelques tâches de démo dans les sous-catégories**

Dans `src/modules/tasks/local.repository.ts`, réaffecter une dizaine de tâches sur `cat-6` et `cat-7`, de façon que le filtre par branche montre visiblement son effet.

⚠️ **Aucun `Math.random()`** : l'historique de démonstration est déterministe (`generateCompletions`), et cette règle vaut pour tous les seeds.

- [ ] **Step 3: Vérifier dans le navigateur**

Se connecter en mode démo (`loginDemo()` recharge les seeds via `clearDemoStorage()`), ouvrir la modale de gestion : l'arbre doit apparaître. Filtrer « Travail » doit remonter les tâches de « Backlinks ».

Puis basculer en anglais et vérifier les noms.

- [ ] **Step 4: Commit**

```bash
git add src/modules/categories/repository.ts src/modules/tasks/local.repository.ts
git commit -m "feat(demo): seeds de categories arborescents"
```

---

## Task 15: Vérification intermédiaire

**Files:** aucun. Tâche de contrôle.

- [ ] **Step 1: Toute la suite**

```bash
npx vitest run src
```

Attendu : PASS. Toute régression se corrige ici, pas plus tard.

- [ ] **Step 2: Types et lint**

```bash
npm run typecheck
```

Attendu : 0 erreur.

```bash
npm run lint
```

Attendu : 0 erreur.

- [ ] **Step 3: Les trois gates i18n**

```bash
npm run i18n:check
```

```bash
npm run i18n:scan
```

```bash
npm run i18n:identical
```

Attendu : code 0 pour les trois. En cas d'échec du scan, `npm run i18n:scan -- --list` dit **lesquelles**.

🔴 **Ne JAMAIS relever un seuil pour faire passer la CI.** Les trois cliquets sont à 0, et ils y restent.

- [ ] **Step 4: Le budget de bundle**

```bash
npm run build
```

```bash
npm run check:bundle
```

Attendu : code 0. 🔴 La garde **exige `VITE_SENTRY_DSN` au build** : sans elle, Rollup élimine `@sentry/react` et la mesure sous-estime le chemin critique d'environ 45 ko. La marge réelle n'est que de 11,9 ko : si l'arbre a fait grossir le chemin critique au-delà, il faut charger le sélecteur en `React.lazy` plutôt que de relever le plafond.

- [ ] **Step 5: Commit s'il y a eu des corrections**

```bash
git commit -am "fix(categories): corrections issues de la verification intermediaire"
```

---

## Task 16: Migration `144` · la clé étrangère

⚠️ **En dernier, et volontairement séparable.** Si elle doit être reportée, tout ce qui précède reste livrable et cohérent.

**Files:**
- Create: `supabase/migration/144_categories_fk.sql`
- Modify: `src/modules/tasks/supabase.repository.ts`
- Modify: `src/modules/okrs/supabase.repository.ts`

- [ ] **Step 1: Écrire la migration**

Créer `supabase/migration/144_categories_fk.sql` :

```sql
-- ═══════════════════════════════════════════════════════════════════
-- Migration 144 — `tasks.category` et `okrs.category` deviennent de vraies FK
--
-- POURQUOI (risque R-02, revue du 2026-09-02)
-- Aucune clé étrangère ne pointait vers `categories`. Supprimer une catégorie
-- laissait un identifiant mort dans chaque tâche et chaque objectif qui la
-- portait. Mesuré en production AVANT correctif applicatif : 13 tâches sur 611
-- et 2 objectifs sur 14 étaient déjà dans cet état.
--
-- La réaffectation avant suppression (`useReassignCategory`) tient cette
-- garantie côté APPLICATION. Cette migration la fait tenir par la BASE.
--
-- ⚠️ ON DELETE SET NULL, pas NO ACTION : la réaffectation reste le chemin
-- normal, le SET NULL n'est que le filet de dernier recours. Il ne remplace
-- pas le dialogue qui demande où partent les éléments.
--
-- 🔴 CONVERSION DE TYPE SUR `tasks`, la table la plus chargée du produit :
-- ACCESS EXCLUSIVE le temps de la réécriture. À jouer hors heure de pointe.
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  orphan_tasks INTEGER;
  orphan_okrs  INTEGER;
BEGIN
  SELECT count(*) INTO orphan_tasks
    FROM public.tasks
   WHERE category <> '' AND category NOT IN (SELECT id::text FROM public.categories);
  SELECT count(*) INTO orphan_okrs
    FROM public.okrs
   WHERE category <> '' AND category NOT IN (SELECT id::text FROM public.categories);
  RAISE NOTICE 'Orphelins avant nettoyage : % taches, % objectifs', orphan_tasks, orphan_okrs;
END $$;

-- 1. Les orphelins passent à NULL. Ils étaient DÉJÀ sans catégorie utilisable :
--    on ne perd rien, on cesse de mentir sur leur classement.
UPDATE public.tasks SET category = ''
 WHERE category <> '' AND category NOT IN (SELECT id::text FROM public.categories);
UPDATE public.okrs  SET category = ''
 WHERE category <> '' AND category NOT IN (SELECT id::text FROM public.categories);

-- 2. La chaîne vide devient NULL : une FK ne peut pas référencer ''.
ALTER TABLE public.tasks ALTER COLUMN category DROP DEFAULT;
ALTER TABLE public.okrs  ALTER COLUMN category DROP DEFAULT;
UPDATE public.tasks SET category = NULL WHERE category = '';
UPDATE public.okrs  SET category = NULL WHERE category = '';

-- 3. Conversion de type.
ALTER TABLE public.tasks
  ALTER COLUMN category DROP NOT NULL,
  ALTER COLUMN category TYPE UUID USING category::uuid;
ALTER TABLE public.okrs
  ALTER COLUMN category DROP NOT NULL,
  ALTER COLUMN category TYPE UUID USING category::uuid;

-- 4. La contrainte.
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_category_fkey
  FOREIGN KEY (category) REFERENCES public.categories(id) ON DELETE SET NULL;
ALTER TABLE public.okrs
  ADD CONSTRAINT okrs_category_fkey
  FOREIGN KEY (category) REFERENCES public.categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_category ON public.tasks(category);
CREATE INDEX IF NOT EXISTS idx_okrs_category  ON public.okrs(category);
```

- [ ] **Step 2: Absorber `NULL` dans le mapping, et nulle part ailleurs**

🔴 **`NO_CATEGORY` reste la chaîne vide côté TypeScript.** Propager `null` jusqu'aux composants imposerait de revoir des dizaines de comparaisons `t.category === ...` pour un gain nul, et créerait deux marqueurs d'absence à vérifier partout.

Dans `src/modules/tasks/supabase.repository.ts`, au mapping de lecture :

```typescript
      // La base porte NULL depuis la mig. 144 ; le modèle client porte la
      // chaîne vide (NO_CATEGORY). La conversion vit ICI, et nulle part ailleurs.
      category: row.category ?? '',
```

et au mapping d'écriture :

```typescript
      if (input.category !== undefined) result.category = input.category === '' ? null : input.category;
```

Faire la même chose dans `src/modules/okrs/supabase.repository.ts`.

- [ ] **Step 3: Écrire les tests du mapping**

Ajouter dans `src/modules/tasks/supabase.repository.test.ts` :

```typescript
describe('mapping de category (mig. 144)', () => {
  it('lit NULL comme la chaîne vide', async () => {
    expect((await readSingleRow({ ...ROW, category: null })).category).toBe('');
  });

  it('écrit la chaîne vide comme NULL', async () => {
    await repo.update('t1', { category: '' });
    expect(lastUpdate().category).toBeNull();
  });

  it('laisse passer un identifiant tel quel', async () => {
    await repo.update('t1', { category: 'cat-1' });
    expect(lastUpdate().category).toBe('cat-1');
  });
});
```

- [ ] **Step 4: Lancer les tests**

```bash
npx vitest run src/modules/tasks src/modules/okrs
```

Attendu : PASS.

- [ ] **Step 5: Valider les migrations**

```bash
npm run validate:migrations
```

Attendu : code 0.

- [ ] **Step 6: Prouver la migration AVANT de l'appliquer**

🔴 **Ne pas appliquer sans avoir joué cette preuve**, dans une transaction annulée par un `RAISE` final :

```sql
BEGIN;
-- Empreinte AVANT : l'ensemble des couples (id, category) non orphelins
CREATE TEMP TABLE before_fp AS
  SELECT id, category FROM public.tasks
   WHERE category <> '' AND category IN (SELECT id::text FROM public.categories);

-- … jouer ici le contenu de 144_categories_fk.sql …

-- 1. Zéro orphelin après
-- 2. Aucune tâche non orpheline n'a changé de catégorie :
--    SELECT count(*) FROM before_fp b JOIN public.tasks t USING (id)
--     WHERE t.category::text IS DISTINCT FROM b.category;   -- doit valoir 0
-- 3. La conversion ::uuid n'a levé sur aucune ligne (sinon on ne serait pas ici)

RAISE EXCEPTION 'rollback volontaire';
```

- [ ] **Step 7: Commit**

```bash
git add supabase/migration/144_categories_fk.sql src/modules/tasks/supabase.repository.ts src/modules/okrs/supabase.repository.ts src/modules/tasks/supabase.repository.test.ts
git commit -m "feat(db): migration 144, cle etrangere de category vers categories"
```

- [ ] **Step 8: Appliquer en production, hors heure de pointe, après accord d'Axel**

Puis remesurer les orphelins : ils doivent valoir 0, et la contrainte doit exister.

---

## Task 17: Vérification finale

**Files:** aucun. Tâche de contrôle.

- [ ] **Step 1: Suite complète, types, lint**

```bash
npx vitest run src
```

```bash
npm run typecheck
```

```bash
npm run lint
```

Attendu : PASS et 0 erreur pour les trois.

- [ ] **Step 2: Gardes de migration et RLS**

```bash
npm run validate:migrations
```

```bash
npm run check:rls
```

Attendu : code 0. `check:rls` doit rester vert : cette vague ne crée aucune policy, et n'en modifie aucune.

- [ ] **Step 3: Gates i18n**

```bash
npm run i18n:check
```

```bash
npm run i18n:scan
```

```bash
npm run i18n:identical
```

Attendu : code 0 pour les trois.

- [ ] **Step 4: Bundle**

```bash
npm run build
```

```bash
npm run check:bundle
```

Attendu : code 0, avec `VITE_SENTRY_DSN` défini au build.

- [ ] **Step 5: Parcours manuel, en mode démo et en production**

1. Créer un arbre à trois niveaux, avec un parent et son enfant créés **dans le même enregistrement**.
2. Déplacer une branche par le menu « Déplacer vers… », à la souris puis au clavier.
3. Supprimer un parent des deux façons, puis « Annuler » et vérifier que la catégorie revient **sous son parent**.
4. Filtrer sur un parent : les tâches des descendants remontent.
5. Refaire les points 1 à 4 sur un viewport de 375 px de large.
6. Refaire le point 1 **au clavier seul**.
7. Vérifier avec `prefers-reduced-motion` activé que la feuille mobile s'ouvre bien à l'écran. ⚠️ Ce réglage est actif sur la machine d'Axel : si « rien ne s'affiche », c'est la première chose à vérifier.

- [ ] **Step 6: Mettre la documentation à jour**

Dans `CLAUDE.md`, section « Base de données Supabase », ajouter les migrations `143` et `144` avec leur date d'application réelle et ce qui a été vérifié.

🔴 **Ne jamais écrire « appliquée » sans la date**, et ne jamais recopier un « avant » depuis un tableau plus ancien : il se reconstruit à un commit nommé.

- [ ] **Step 7: Commit final**

```bash
git add CLAUDE.md
git commit -m "docs: migrations 143 et 144 appliquees, sous-categories livrees"
```

---

## Couverture de la spécification

| Section de la spéc | Tâche |
|---|---|
| §2.1 la référence est déjà un identifiant | constat, aucune tâche nécessaire |
| §2.2 absence de clé étrangère | 16 |
| §2.3 éditeur par lot | 8 |
| §3.1 migration 143 | 2 |
| §3.2 migration 144 | 16 |
| §4.1 types | 3 |
| §4.2 `tree.ts` | 1 |
| §4.3 `NO_CATEGORY` reste `''` | 16 |
| §4.4 impact de branche | 6 |
| §4.5 repository et hooks | 3, 4, 5 |
| §5 modale, gabarit, « + » par ligne | 7 |
| §5.1 ordre d'écriture | 8 |
| §5.2 suppression | 10 |
| §5.3 accessibilité | 7, 9 |
| §6 sélection, filtres, affichage | 11, 12, 13 |
| §6 seeds démo | 14 |
| §7 i18n | 5, 7, 9, 10, 11, et gates en 15 et 17 |
| §8 tests et gardes | 1, 2, 3, 4, 5, 6, 8, 12, 15, 17 |
| §9 ordre de livraison | ordre des tâches 1 à 16 |
| §10 réserve | sans objet : le glisser-déposer a été retiré du périmètre le 2026-09-09 |
| §11 vagues 2 et 3 | hors périmètre |
