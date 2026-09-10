-- ═══════════════════════════════════════════════════════════════════
-- Migration 145 — `tasks.category` et `okrs.category` deviennent de vraies
--                  clés étrangères vers `categories`
--
-- POURQUOI (risque R-02, revue du 2026-09-02)
-- Aucune clé étrangère ne pointait vers `categories`. Supprimer une catégorie
-- laissait un identifiant mort dans chaque tâche et chaque objectif qui la
-- portait, sans avertissement et sans réparation possible : plus rien ne disait
-- quels éléments avaient porté la catégorie disparue.
--
-- La réaffectation avant suppression (`useReassignCategory`) tient cette
-- garantie côté APPLICATION. Cette migration la fait tenir par la BASE.
--
-- ⚠️ ON DELETE SET NULL, et non NO ACTION : la réaffectation reste le chemin
-- normal, ce SET NULL n'est que le filet de dernier recours si une suppression
-- passe malgré tout. Il ne remplace pas la boîte de dialogue qui demande où
-- partent les éléments.
--
-- ⚠️ À ne pas confondre avec le `ON DELETE NO ACTION` de `categories.parent_id`
-- (mig. 143) : celui-là REFUSE, parce qu'une branche ne doit jamais partir en
-- silence. Ici on ne refuse pas, on détache : une tâche ne doit jamais être
-- supprimée parce que sa catégorie l'a été.
--
-- 🔴 CONVERSION DE TYPE SUR `tasks`, LA TABLE LA PLUS CHARGÉE DU PRODUIT.
-- L'`ALTER … TYPE` prend un ACCESS EXCLUSIVE et réécrit la table. À jouer hors
-- heure de pointe, et à annoncer comme telle dans le runbook.
--
-- ── ÉTAT MESURÉ EN PRODUCTION LE 2026-09-10, AVANT ÉCRITURE ─────────
--
--     tasks : 749 lignes, 125 sans catégorie (''), 13 ORPHELINES
--     okrs  :  12 lignes,   1 sans catégorie (''),  0 orpheline
--
-- ⚠️ Ces chiffres datent de cette mesure-là et ne se recopient pas : ils sont
-- ici pour que la preuve d'application puisse être comparée à quelque chose.
-- Les 13 orphelines sont exactement le défaut que cette migration ferme.
--
-- ⚠️ Le filtre `category NOT IN (SELECT id::text FROM categories)` attrape AUSSI
-- toute valeur qui ne serait pas un UUID : une chaîne quelconque ne peut pas
-- figurer parmi les identifiants de catégorie. C'est ce qui rend le `::uuid` de
-- l'étape 4 sûr — après les étapes 2 et 3, il ne reste que des identifiants de
-- catégorie réels, ou NULL.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Tracer ce que la migration s'apprête à modifier ──────────────
DO $$
DECLARE
  orphan_tasks INTEGER;
  orphan_okrs  INTEGER;
  empty_tasks  INTEGER;
  empty_okrs   INTEGER;
BEGIN
  SELECT count(*) INTO orphan_tasks FROM public.tasks
   WHERE category <> '' AND category NOT IN (SELECT id::text FROM public.categories);
  SELECT count(*) INTO orphan_okrs FROM public.okrs
   WHERE category <> '' AND category NOT IN (SELECT id::text FROM public.categories);
  SELECT count(*) INTO empty_tasks FROM public.tasks WHERE category = '';
  SELECT count(*) INTO empty_okrs  FROM public.okrs  WHERE category = '';

  RAISE NOTICE 'Avant conversion — orphelins : % taches, % objectifs ; sans categorie : % taches, % objectifs',
    orphan_tasks, orphan_okrs, empty_tasks, empty_okrs;
END $$;

-- ── 2. Les orphelins passent à « sans catégorie » ───────────────────
--
-- Ils étaient DÉJÀ sans catégorie utilisable : la pastille était grise et le
-- nom un tiret. On ne perd rien, on cesse de mentir sur leur classement.
UPDATE public.tasks SET category = ''
 WHERE category <> '' AND category NOT IN (SELECT id::text FROM public.categories);
UPDATE public.okrs  SET category = ''
 WHERE category <> '' AND category NOT IN (SELECT id::text FROM public.categories);

-- ── 3. La chaîne vide devient NULL ──────────────────────────────────
--
-- Une clé étrangère ne peut pas référencer ''. Le DEFAULT part d'abord, sinon
-- toute insertion future réintroduirait la chaîne vide sous la contrainte.
ALTER TABLE public.tasks ALTER COLUMN category DROP DEFAULT;
ALTER TABLE public.okrs  ALTER COLUMN category DROP DEFAULT;

UPDATE public.tasks SET category = NULL WHERE category = '';
UPDATE public.okrs  SET category = NULL WHERE category = '';

-- ── 4. Conversion de type ───────────────────────────────────────────
ALTER TABLE public.tasks
  ALTER COLUMN category DROP NOT NULL,
  ALTER COLUMN category TYPE UUID USING category::uuid;
ALTER TABLE public.okrs
  ALTER COLUMN category DROP NOT NULL,
  ALTER COLUMN category TYPE UUID USING category::uuid;

-- ── 5. La contrainte ────────────────────────────────────────────────
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_category_fkey,
  ADD  CONSTRAINT tasks_category_fkey
       FOREIGN KEY (category) REFERENCES public.categories(id) ON DELETE SET NULL;
ALTER TABLE public.okrs
  DROP CONSTRAINT IF EXISTS okrs_category_fkey,
  ADD  CONSTRAINT okrs_category_fkey
       FOREIGN KEY (category) REFERENCES public.categories(id) ON DELETE SET NULL;

-- ⚠️ Sans index, chaque suppression de catégorie déclenche un Seq Scan de
-- `tasks` pour honorer le SET NULL.
CREATE INDEX IF NOT EXISTS idx_tasks_category ON public.tasks(category);
CREATE INDEX IF NOT EXISTS idx_okrs_category  ON public.okrs(category);

COMMENT ON COLUMN public.tasks.category IS
  'Catégorie de la tâche. NULL = aucune. FK vers categories(id), ON DELETE SET NULL : supprimer une catégorie détache, ne supprime jamais la tâche.';
COMMENT ON COLUMN public.okrs.category IS
  'Catégorie de l''objectif. NULL = aucune. FK vers categories(id), ON DELETE SET NULL.';

-- ── 6. Vérifier que la conversion n'a rien laissé derrière ──────────
DO $$
DECLARE
  restant_tasks INTEGER;
  restant_okrs  INTEGER;
BEGIN
  SELECT count(*) INTO restant_tasks FROM public.tasks t
    WHERE t.category IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.id = t.category);
  SELECT count(*) INTO restant_okrs FROM public.okrs o
    WHERE o.category IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.id = o.category);

  IF restant_tasks <> 0 OR restant_okrs <> 0 THEN
    RAISE EXCEPTION 'Orphelins restants apres conversion : % taches, % objectifs',
      restant_tasks, restant_okrs;
  END IF;

  RAISE NOTICE 'Apres conversion — zero orphelin, contrainte posee.';
END $$;
