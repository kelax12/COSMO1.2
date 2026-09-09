# Sous-catégories hiérarchiques · spécification de la vague 1

> **Statut** : spécification validée, non implémentée. Écrite le 2026-09-09.
> **Périmètre de ce document** : vague 1 seulement (catégories personnelles + mode démo).
> Les vagues 2 et 3 sont décrites en fin de document, sans être spécifiées.

## 1. Le besoin

Les catégories de COSMO sont une liste plate. On veut pouvoir ranger une catégorie
sous une autre, sans limite de profondeur déclarée : « Travail › SEO › Backlinks ›
Annuaires ».

Décisions prises avec Axel le 2026-09-09 :

| Question | Décision |
|---|---|
| Périmètre | perso, entreprise (`team_categories`, `org_okr_categories`) et démo, en trois vagues |
| Filtrer un parent | remonte le parent **et tous ses descendants** |
| Affecter à un nœud non-feuille | autorisé, n'importe quel nœud |
| Couleur | héritée du parent à la création, surchargeable ensuite |
| Profondeur | illimitée dans le modèle, plafond de garde à 10 |
| Écran de gestion | arbre repliable, reparentage par le menu « Déplacer vers… » **uniquement**, sans glisser-déposer (décision du 2026-09-09 : rester simple et intuitif) |
| Sélection sur une tâche | liste déroulante arborescente avec recherche par chemin |
| Suppression d'un parent | choix dans la boîte de dialogue : remonter les enfants, ou supprimer la branche |
| Affichage sur une tâche | la feuille seule, chemin complet en infobulle |
| Ordre des sœurs | manuel, réorganisable (`position`) |
| Clé étrangère | posée dans cette vague, avec nettoyage préalable |

## 2. Ce que le code contient déjà, et qui change le plan

### 2.1 La référence est déjà un identifiant

🔴 **`tasks.category` et `okrs.category` stockent l'UUID de `categories.id`, pas le
nom.** La colonne est déclarée `TEXT` (mig. `001`, `003`), ce qui donne l'impression
du contraire, mais toute l'application compare des identifiants (`impact.ts`,
`local.repository.ts` avec ses `cat-1`), et `scripts/cosmo/api.mjs:69` le dit
explicitement : « `tasks.category` stocke un UUID de `categories.id`, PAS un nom ».

Conséquences, qui retirent de cette vague son morceau le plus risqué :

- **Aucune migration de référence n'est nécessaire.** Deux catégories « Design »
  sous deux parents différents fonctionnent dès aujourd'hui, puisque rien ne
  référence un nom.
- **Aucune stratégie de double écriture n'est nécessaire.** Un onglet resté sur un
  ancien bundle continue d'écrire un identifiant de catégorie valide ; il ignore
  simplement `parent_id`. Le risque « onglets zombies » (91,5 % du trafic Supabase
  venait d'onglets jamais rechargés) ne s'applique pas ici.
- Ce qui reste vrai de l'analyse initiale : `UNIQUE(user_id, name)` doit devenir une
  unicité par fratrie, et le CLI doit savoir résoudre un chemin.

⚠️ **Ne jamais réécrire ce constat de mémoire.** Il a été faux une fois pendant la
conception : la première lecture concluait « la colonne stocke le nom », et cette
erreur avait produit une décision de migration entière, inutile.

### 2.2 Il n'y a aucune clé étrangère vers `categories`

Vérifié en production (`impact.ts`, revue R-02 du 2026-09-02) : zéro contrainte
enfant. `delete(id)` retire la ligne et laisse un identifiant mort dans les tâches et
les OKR. Mesuré avant correctif : **13 tâches sur 611 et 2 OKR sur 14 déjà
orphelins**. La réaffectation avant suppression (`useReassignCategory`) tient
aujourd'hui cette garantie **côté application seulement**.

### 2.3 La modale de gestion est un éditeur par lot

`ColorSettingsModal` accumule les changements en état local (`localCategories`), les
créations portant un identifiant `temp-<timestamp>`, et n'écrit qu'à
l'enregistrement. `reassignOptions` exclut déjà les `temp-` comme destinations de
réaffectation, précisément parce qu'ils ne désignent aucune ligne serveur.

### 2.4 Ce qui ne porte pas de catégorie

Les habitudes et les événements n'ont **pas** de catégorie : ils n'empruntent que la
couleur d'une catégorie. `impact.ts` le note déjà. Rien à faire pour eux.

### 2.5 Code mort à ne pas confondre

`src/components/CategoryManager.tsx` (452 lignes, avec son propre type `Category`
portant un `icon`) **n'est monté nulle part** : seuls ses helpers `getColorHex` et
`COLORS` sont importés, par `OKRPage` et `TeamOKRTab`. Ce n'est pas la modale à
modifier. Son sort n'est pas traité par cette spéc.

## 3. Base de données

Numéros libres à partir de **143** (146 fichiers présents, dernière appliquée `142`).
⚠️ Les `136` à `141` sont dans l'arbre et non appliquées : elles appartiennent à
d'autres sessions et ne doivent pas être appliquées au passage.

### 3.1 `143_categories_tree.sql`

```sql
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.categories(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS position  INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories(user_id, parent_id);
```

🔴 **`ON DELETE RESTRICT`, jamais `CASCADE`.** Supprimer un parent ne doit pas
emporter sa branche en silence. La base refuse, ce qui force l'application à avoir
pris explicitement la décision « remonter les enfants » ou « supprimer la branche ».
Même esprit que le `ON DELETE SET NULL` de `team_labels` (mig. `093`) : une
suppression ne détruit jamais ce qui n'était pas visé.

**L'unicité demande deux index, pas un.**

```sql
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_user_id_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS ux_categories_sibling_name
  ON public.categories(user_id, parent_id, name) WHERE parent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_categories_root_name
  ON public.categories(user_id, name) WHERE parent_id IS NULL;
```

🔴 **Pourquoi deux.** En Postgres, deux `NULL` ne sont jamais égaux : une unicité sur
`(user_id, parent_id, name)` ne contraint **rien entre racines**, et on pourrait
créer deux « Travail » à la racine. L'index partiel `WHERE parent_id IS NULL` est la
seule forme qui les couvre.

⚠️ **Prérequis de migration** : la contrainte actuelle `UNIQUE(user_id, name)` est
plus stricte que les deux nouvelles réunies. Sa suppression ne peut donc pas échouer
sur des données existantes, et aucune donnée n'a besoin d'être nettoyée pour cette
partie.

**Le trigger de garde** `enforce_category_tree`, `BEFORE INSERT OR UPDATE`, refuse :

1. l'auto-parentage (`parent_id = id`) ;
2. tout cycle, par remontée des ancêtres depuis `parent_id` ;
3. une profondeur au-delà de **10** (`CATEGORY_MAX_DEPTH`), en comptant la racine
   comme le niveau 1 ;
4. un parent appartenant à un **autre compte** (`parent.user_id <> NEW.user_id`).

🔴 Le trigger est en **`SECURITY INVOKER`** (le défaut) et `REVOKE`-é pour `anon`,
comme l'exigent les mig. `064b` / `094b` et le finding B-3 : un trigger `BEFORE`
s'exécute avant le `WITH CHECK` de la RLS, et en `DEFINER` ses messages d'erreur
deviennent un oracle sur des lignes non lisibles.

⚠️ La règle 4 est ce qui empêche de rattacher sa propre catégorie sous celle d'un
autre compte. Sans elle, la RLS laisserait passer : elle juge la ligne écrite, pas la
ligne référencée.

**Aucune RPC n'est créée.** Un compte porte quelques dizaines de catégories et
`useCategories` charge déjà l'arbre entier. Le calcul des descendants se fait en
mémoire, côté client. ❌ Ne jamais ajouter d'aller-retour serveur pour dériver une
branche : ce serait une lecture de plus sur toutes les pages protégées, exactement ce
que la règle « agréger des lectures » et le finding C-05 ont fermé ailleurs.

### 3.2 `144_categories_fk.sql`

Ferme R-02 au niveau de la base. Ordre impératif :

1. Compter les orphelins et les enregistrer dans un `RAISE NOTICE` (trace de ce que
   la migration a modifié).
2. `UPDATE tasks SET category = NULL WHERE category <> '' AND category NOT IN (SELECT id::text FROM categories)` ; idem `okrs`.
3. `UPDATE tasks SET category = NULL WHERE category = ''` ; idem `okrs`.
4. `ALTER TABLE tasks ALTER COLUMN category DROP NOT NULL, ALTER COLUMN category DROP DEFAULT, ALTER COLUMN category TYPE UUID USING category::uuid` ; idem `okrs`.
5. `ADD CONSTRAINT ... FOREIGN KEY (category) REFERENCES categories(id) ON DELETE SET NULL`.

🔴 **Cette migration se prouve avant d'être appliquée**, dans une transaction annulée
par un `RAISE` final, comme les `131` et `132` :

- nombre d'orphelins avant, et zéro après ;
- **aucune tâche non orpheline ne change de catégorie** (comparaison par empreinte de
  l'ensemble `(id, category)` prise avant l'`ALTER`) ;
- la conversion `::uuid` ne lève sur aucune ligne (une valeur non-UUID restée en base
  ferait échouer l'étape 4 après que les étapes 2 et 3 ont écrit).

⚠️ C'est une **conversion de type sur la table la plus chargée du produit**. Elle
prend un `ACCESS EXCLUSIVE` le temps de la réécriture. À jouer hors heure de pointe,
et à annoncer comme telle dans le runbook.

⚠️ `ON DELETE SET NULL` et non `RESTRICT` : la réaffectation avant suppression reste
le chemin normal (R-02), et le `SET NULL` n'est que le filet de dernier recours si
une suppression passe malgré tout. Il ne remplace pas `useReassignCategory`, qui
continue de demander où partent les éléments.

## 4. Couche TypeScript

### 4.1 Types

```typescript
export interface Category {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  position: number;
}
```

`color` reste obligatoire. L'héritage se résout **au moment de la création**, pas au
moment du rendu : une couleur calculée à l'affichage changerait rétroactivement
toutes les sous-catégories le jour où on repeint leur parent, ce que personne n'a
demandé.

### 4.2 `src/modules/categories/tree.ts`

Module **pur**, sans React ni réseau, sur le modèle d'`impact.ts`. Toutes les règles
de l'arbre y vivent, et s'y testent sans monter un composant.

| Fonction | Contrat |
|---|---|
| `buildTree(categories)` | liste plate vers arbre, trié par `position` puis `name` |
| `childrenOf(id, categories)` | enfants directs |
| `descendantIds(id, categories)` | tous les descendants, hors le nœud lui-même |
| `ancestorIds(id, categories)` | ancêtres, de la racine au parent direct |
| `categoryPath(id, categories)` | `Category[]` de la racine à la feuille |
| `formatPath(path, sep)` | « Travail › SEO › Backlinks » |
| `wouldCreateCycle(id, newParentId, categories)` | miroir client du trigger |
| `treeDepth(id, categories)` | miroir client du plafond |
| `CATEGORY_MAX_DEPTH` | `10`, exportée, valeur unique côté client |

⚠️ Ces fonctions sont **défensives contre un cycle déjà présent en données** : toute
remontée d'ancêtres porte un `Set` de nœuds vus et s'arrête, plutôt que de boucler à
l'infini. Le trigger empêche d'en créer, mais un client ne doit jamais geler sur une
donnée inattendue.

### 4.3 L'absence de catégorie

🔴 **`NO_CATEGORY` reste la chaîne vide au niveau TypeScript.** La bascule vers
`NULL` introduite par la migration `144` est absorbée dans `mapTaskToDb` /
`mapDbToTask` et leurs équivalents OKR, et **nulle part ailleurs**. Propager `null`
jusqu'aux composants imposerait de revoir des dizaines de comparaisons
`t.category === ...` pour un gain nul, et créerait deux marqueurs d'absence à
vérifier partout : exactement ce que le commentaire d'`impact.ts` interdit déjà.

### 4.4 `impact.ts`

`categoryImpact(id, tasks, okrs, categories, { branch })` gagne :

- un décompte des **sous-catégories** de la branche ;
- l'option `branch` qui étend les compteurs de tâches et d'OKR à tous les
  descendants.

`resolveReassignTargets` doit désormais suivre les chaînes qui **passent par un
parent supprimé** : supprimer « Travail » en désignant « Travail › SEO » comme
destination est un cas atteignable en deux décisions, et il doit retomber sur une
catégorie qui survit, ou sur « aucune ». La fonction fait déjà ce travail pour les
chaînes plates ; il faut ajouter le cas où la destination disparaît parce que son
ancêtre disparaît.

### 4.5 Repository et hooks

- `create(input, id?)` accepte `parentId` et `position`. La signature à deux
  arguments (`src/lib/restore-id.ts`) est conservée : ❌ ne jamais faire passer un
  `id` par le payload, c'est l'oracle d'existence refermé par R-08.
- `useCreateCategory` calcule la couleur héritée quand `parentId` est fourni et que
  l'appelant ne donne pas de couleur.
- Un `useMoveCategory({ id, parentId, position })` unique : c'est la **seule**
  mutation derrière le menu « Déplacer vers… », seul geste de reparentage.
  ❌ Ne jamais lui adjoindre un glisser-déposer.
- `local.repository.ts` (démo) reproduit le trigger : cycles, profondeur, parent d'un
  autre compte. Sinon la démo autorise ce que la production refuse.

## 5. La modale de gestion

`ColorSettingsModal` reste le point d'entrée : cinq écrans la montent déjà
(`TasksSummary`, `EventModal`, `HabitModal`, `TaskModal`, `OKRModalSheet`), et une
page dédiée sortirait l'utilisateur de sa création de tâche.

**Gabarit** : modale sur desktop, **feuille plein écran sur téléphone**. Une
bottom-sheet basse ne tient pas un arbre à six niveaux. Le mouvement passe par
`useSheetMotion` / `useSheetDrag` (jamais écrit à la main), et la position finale
vient du CSS, jamais d'une animation de transform.

**Contenu** :

- arbre indenté, chevrons de repli, état replié mémorisé dans `ui-states` ;
- un « + » par ligne, qui crée un enfant `temp-` avec `parentId` pré-rempli et la
  **couleur du parent** (au lieu du `#3B82F6` en dur actuel), déplié, focus sur le
  champ de nom ;
- le « + Ajouter » du pied continue de créer une **racine** ;
- un menu « … » par ligne avec « Déplacer vers… », **seul** chemin de reparentage
  et de réordonnancement, identique à la souris, au doigt et au clavier. Le
  sélecteur de destination exclut la ligne elle-même, ses descendants, et toute
  ligne `temp-`.

🔴 **Pas de glisser-déposer** (décision du 2026-09-09). La fonctionnalité doit rester
simple et intuitive : un seul geste, qui marche partout, plutôt que deux chemins dont
l'un ne fonctionne ni au doigt ni au clavier et demande un auto-défilement, des zones
de dépôt et un état de survol. ❌ Ne pas le réintroduire « pour le confort desktop » :
il n'ajouterait aucune capacité, seulement une seconde définition du même geste.

### 5.1 L'ordre d'écriture à l'enregistrement

🔴 **Le point le plus fragile de cette vague.** `handleSave` envoie aujourd'hui toutes
les créations dans un `Promise.all`. Un enfant créé dans le même lot que son parent
référence un `parentId` en `temp-`, qui ne désigne aucune ligne serveur.

La sauvegarde doit :

1. trier les créations **par profondeur croissante** dans l'arbre local ;
2. les créer niveau par niveau, en séquence entre niveaux ;
3. tenir une table `temp-<id>` vers identifiant réel, et substituer le `parentId` de
   chaque enfant avant de l'écrire.

⚠️ Un cycle formé **uniquement de lignes `temp-`** n'est pas atteignable par
l'interface (on ne peut désigner comme parent qu'une ligne déjà placée), mais le tri
par profondeur doit malgré tout détecter un lot non ordonnançable et échouer
proprement plutôt que de boucler.

C'est la même famille de problème que `reassignOptions`, qui exclut déjà les
`temp-` : une valeur locale ne peut jamais être écrite comme référence.

### 5.2 Suppression

La boîte (`DeleteCategoryDialog`) annonce l'impact de la **branche entière** :
N sous-catégories, M tâches, K OKR. Elle propose deux issues :

- **remonter les enfants d'un cran** : ils prennent le `parentId` du supprimé, donc
  deviennent racines si on supprimait une racine ;
- **supprimer la branche** : toute la branche part, et son contenu est réaffecté vers
  une destination choisie, ou vers « aucune catégorie ».

🔴 **La réaffectation reste AVANT la suppression**, et la suppression d'une branche se
fait **des feuilles vers la racine** : `ON DELETE RESTRICT` refuse l'ordre inverse, et
c'est voulu, la base doit refuser ce que l'application n'a pas ordonné.

⚠️ **L'annulation** (`useRestoreCategory`) restaure l'identifiant d'origine **et le
`parentId`**. Restaurer une catégorie à la racine parce qu'on n'a pas rendu son parent
est une réparation en apparence seulement, exactement le défaut que R-08 ferme. Si le
parent a lui-même été supprimé, la restauration le remonte d'abord, ou retombe à la
racine en le disant.

### 5.3 Accessibilité

La modale monte déjà `useModalA11y` : rien à recâbler, mais l'arbre doit être
navigable au clavier (rôles `tree` / `treeitem`, `aria-expanded`, `aria-level`,
flèches pour parcourir, `Entrée` pour renommer). Le reparentage passe par le menu
« Déplacer vers… », qui est atteignable au clavier par construction : c'est une des
raisons pour lesquelles il est le seul chemin retenu.

## 6. Sélection, filtres, affichage

- **`CategoryField`** passe des pastilles à plat à une liste déroulante arborescente
  avec recherche, la recherche affichant le **chemin complet**. Composant partagé,
  réutilisé par `OKRModalSheet`, `EventModal` (sélection de couleur) et
  `QuickAddBar`. ❌ Pas de menus en cascade : mauvais au doigt et au clavier.
- **`TaskFilter` / `TaskSidebar`** : arbre repliable, avec le nombre de tâches par
  branche. 🔴 **Filtrer un parent remonte toute sa branche** : c'est un changement de
  sémantique du filtre existant, à assumer et à documenter. Un compte dont les
  catégories restent plates ne voit aucune différence.
- **Sur la tâche** (`TaskCategoryIndicator`, `TaskCard`, `TaskTable`) : **la feuille
  seule**, chemin complet en infobulle ou à l'appui long. Les listes mobiles n'ont pas
  de largeur à céder.
- **Démo** : les seeds passent à deux racines subdivisées (par exemple
  « Travail › SEO › Backlinks » et « Perso › Santé »), les tâches existantes réparties
  dedans. L'overlay anglais passe par `localizeSeed` / `isEnglishSeed`, comme le reste
  des seeds.

## 7. i18n

Tous les libellés nouveaux partent dans `fr` **et** `en`, dans le namespace `tasks`
pour la modale et `common` pour les actions partagées.

- `npm run i18n:check` (parité des clés) doit rester vert ;
- `npm run i18n:scan` a un cliquet à **0** : aucune chaîne en dur, y compris dans un
  texte JSX contenant une interpolation, un texte sur plusieurs lignes, une propriété
  d'objet `label:` et une valeur par défaut de prop, les quatre formes auxquelles
  l'heuristique était aveugle ;
- `npm run i18n:identical` a un cliquet à **0** : une valeur `en` recopiée du français
  échoue, sauf déclaration motivée dans l'allowlist. ❌ Ne jamais y déclarer une
  phrase.

## 8. Tests et gardes

| Ce qu'on garde | Comment |
|---|---|
| Règles de l'arbre | tests purs sur `tree.ts` : cycles directs et indirects, profondeur 10 et 11, parent d'un autre compte, cycle préexistant en données qui ne doit pas geler |
| Ordre de création par profondeur | test de garde sur `handleSave`, **avec un témoin** qui échoue si l'écriture redevient parallèle |
| Réaffectation avant suppression | extension des tests existants de `resolveReassignTargets` au cas « destination dont l'ancêtre est supprimé » |
| Restauration | `useRestoreCategory` rend l'`id` **et** le `parentId` d'origine |
| Parité démo / production | le repository local refuse ce que le trigger refuse |
| Migrations | `npm run validate:migrations`, `npm run check:rls` |
| Migration `144` | preuve en transaction annulée, avant application (§3.2) |

🔴 **Chaque garde ajoutée part avec un témoin.** Quatre gardes de ce dépôt ont été
prises en train de répondre sans mesurer entre le 08-30 et le 09-03. Une garde qui se
trompe dans le sens rassurant est pire qu'une garde absente.

## 9. Ordre de livraison

1. `tree.ts` et ses tests (aucune dépendance, aucun risque).
2. Migration `143`, prouvée puis appliquée.
3. Types, repository, hooks, repository démo.
4. Modale de gestion, avec le menu « Déplacer vers… ».
5. `CategoryField`, filtres, affichage.
6. Seeds démo.
7. Migration `144`, prouvée puis appliquée hors heure de pointe.

⚠️ La `144` est **en dernier** et volontairement séparable : si elle doit être
reportée, tout le reste de la vague reste livrable et cohérent.

## 10. Réserve portée à la connaissance d'Axel

La vague 1 reste large, la migration `144` étant une conversion de type sur `tasks`.
Elle est pour cette raison placée en dernier et rendue séparable (§9).

Le glisser-déposer, envisagé puis **retiré du périmètre le 2026-09-09**, n'est plus un
candidat au report : il n'est plus dans le plan du tout.

## 11. Hors périmètre, vagues suivantes

**Vague 2, entreprise.** `team_categories` (mig. `111`) et `org_okr_categories`
(mig. `078`) portent déjà de vraies clés étrangères : seul `parent_id` manque. Les
créations et déplacements passent par le droit **`category.manage`** de la mig. `115`.
❌ Ne jamais les gater par `is_org_manager` : c'est une position, pas un droit.

**Vague 3, surfaces annexes.**

- CLI : `resolveCategoryId` accepte un chemin (`"Travail/SEO"`), accepte encore un nom
  seul tant qu'il est unique, et **échoue en listant les candidats** en cas
  d'ambiguïté plutôt que de prendre la première correspondance. `cosmo categories`
  affiche l'arbre.
- Statistiques : agrégation par **racine**, dépliable d'un cran. Un camembert à
  quarante feuilles ne se lit pas.
