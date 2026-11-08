> ⚠️ **ARCHIVE : audit UI/UX du 2026-08-14 et ses six items soldés, extrait de `docs/UI-PATTERNS.md` le 2026-11-08, non maintenu.**
> Chaque passage décrit l'état **à sa date**, y compris ses listes « ce qui reste » : une bonne part a été faite depuis.
> État courant : [`docs/UI-PATTERNS.md`](../UI-PATTERNS.md). Les notes /100 ont cessé (ADR 0012) : [`docs/INDICATEURS.md`](../INDICATEURS.md).
> Les liens relatifs et les ancres de ce passage sont ceux de son document d'origine : certains ne résolvent plus.

## Dette UI/UX ouverte — audit du 2026-08-14

**Méthode** : mesures DOM/CSS sur l'app en mode démo (`npm run dev`), viewports 375×812 et
1280×720, 8 routes protégées. Les captures d'écran n'étaient pas disponibles : cet audit porte
donc sur ce qui est **mesurable** (géométrie, troncatures, tailles de cible, z-index, tokens),
pas sur l'esthétique ni l'équilibre visuel. Il remplace les findings de
[`archive/AUDIT-UI-2026-07-14.md`](../AUDIT-UI-2026-07-14.md), dont **7 des 16 points sont
corrigés** (FAB masquant le CTA Paramètres, chaîne morte OKRModal, `AddCategoryButton` extrait,
placeholder quick-add mobile, libellé « 365 jours », marges `mb-1.5`, `data-tutorial-id` du FAB).

### ✅ 1. Le titre de page — quatre tailles ramenées à deux (2026-08-24)

> **Corrigé, sans la migration `MobileHeader`.** Les tailles MOBILE de `PageHeading` sont
> maintenant prises dans l'échelle fermée, pas dans l'échelle Tailwind brute :
> `hero` et `standard` → `text-display` (28 px, la taille canonique « titre de page », celle de
> /tasks) ; `compact` → `text-headline` (17 px). Les tailles desktop (`sm:` / `lg:`) sont
> **inchangées** : la refonte de l'échelle est mobile.
>
> Il reste donc deux tailles au lieu de quatre, et chacune se justifie : 28 px pour un titre de
> page, 17 px pour le seul cas où le titre COHABITE avec une icône et des badges sur une ligne
> (/entreprise, où c'est un nom d'organisation `truncate` — l'agrandir aggraverait le §2).
>
> **Migration des 6 pages faite le 2026-08-24** (arbitrage d'Axel). `/dashboard`, `/habits`,
> `/okr`, `/statistics`, `/settings` et `/entreprise` montent désormais `MobileHeader` sur mobile,
> avec le rendu desktop historique conservé et simplement masqué sous `md`. Les sept pages se
> comportent donc pareil : titre grand au repos, compacté dans une barre collante au scroll.
>
> 🔴 **Et la migration a révélé que `MobileHeader` n'avait JAMAIS fonctionné.** Il écoutait
> `window.scroll`, alors que `Layout.tsx` met tout le contenu dans un `<main class="flex-1
> overflow-auto">` : c'est LUI qui scrolle, et l'événement `scroll` d'un conteneur ne remonte pas
> jusqu'à `window`. Mesuré sur `/tasks` avant correctif : après 500 px de scroll, `window.scrollY`
> valait **0**, le titre restait à 28 px et le fond du header restait transparent. Le composant
> créé pour porter ce motif ne l'a jamais porté, sur la seule page qui l'utilisait.
> Il remonte maintenant les ancêtres jusqu'au premier conteneur réellement scrollable, avec repli
> sur `window` pour les pages hors Layout.
>
> Vérifié après correctif sur les 6 pages (viewport 375×812, mode démo) : un seul `h1` visible par
> page, aucun débordement horizontal, et compaction 28 px → 17 px avec fond opaque au scroll.
>
> ⚠️ **Piège de mesure rencontré** : quand le panneau navigateur n'est pas affiché, la page ne
> compose pas de frames et les **transitions CSS ne progressent pas**. `getComputedStyle` renvoie
> alors la valeur de DÉPART, ici 28 px, ce qui fait conclure à tort que rien ne se passe. Neutraliser
> la transition (`el.style.transition = 'none'`) avant de lire donne la vraie valeur.
>
> ⚠️ Cause racine trouvée au passage : `src/components/ui/typography.tsx` est **exclu du scan** de
> `src/design-system.guard.test.ts` (qui ignore `ui/`, à cause de shadcn). Le fichier qui DÉFINIT
> les titres de toutes les pages était donc le seul que la garde typographique ne regardait pas.

### Le diagnostic d'origine

Mesuré, viewport 375 px :

| Page | Taille du `h1` | Implémentation |
|---|---|---|
| `/tasks` | **28 px** | `MobileHeader` (échelle fermée, `text-display`) |
| `/habits`, `/okr`, `/statistics`, `/settings` | 24 px | `PageHeading variant="standard"` |
| `/dashboard` | 22 px | `PageHeading variant="hero"` (`text-title`) |
| `/entreprise` | **18 px** | `PageHeading variant="compact"` |

`src/components/mobile/MobileHeader.tsx` a été créé **précisément pour supprimer cette
incohérence** — son propre commentaire cite « trois échelles pour la même fonction ». Il n'a
qu'**un seul consommateur sur sept pages** (`TasksHeader`). La migration s'est arrêtée après la
page vitrine, donc le composant a ajouté une quatrième échelle au lieu d'en retirer trois.

**Correction** : migrer les 6 pages restantes vers `MobileHeader`, puis retirer les variantes
`hero` / `compact` de `PageHeading` (qui redevient le titre desktop). ~2 h.

### ✅ 2. Titres de tâches — deux lignes au lieu d'une (2026-08-25)

> `truncate` remplacé par `line-clamp-2` sur le titre de `TaskCard`.
> Mesuré après correctif, viewport 375 px, mode démo : **12 titres tronqués
> → 2**, et les libellés qui étaient coupés (« Préparer la réunion de
> lancement », « Rendez-vous médecin annuel 2026 ») s'affichent en entier.
>
> ⚠️ Sûr uniquement parce que la liste virtualisée MESURE chaque carte
> (`virtualizer.measureElement` dans `task-table/list.tsx`) : la hauteur
> variable est supportée. Ne pas revenir à `truncate` « pour la densité ».

### Le diagnostic d'origine

Sur `/tasks` en 375 px : **12 titres tronqués**, le pire à **124 px pour 220 px nécessaires**
(« Préparer présentation Q1 2026 »). Les cartes accordent 124–152 px au titre, soit ~40 % de la
largeur d'écran. L'ellipse est un pattern légitime, mais à ce ratio l'utilisateur ne peut plus
distinguer deux tâches au libellé proche — la liste de tâches est l'écran principal du produit.

Même symptôme sur `/entreprise` (6 titres, jusqu'à 32 %) et `/okr`.

**Correction** : arbitrer la répartition de la largeur dans la carte mobile (badges de priorité et
métadonnées avant le titre), ou passer le titre sur deux lignes (`line-clamp-2`). ~1 h.

### ✅ 3. Tableau Habitudes — colonne partielle, corrigée le 2026-08-25

> **La cause n'était ni le snap ni le `scrollLeft` : elle était ARITHMÉTIQUE.**
> La largeur disponible (334 px − 143 de colonne collante − 66 de colonne
> « série ») n'est pas un multiple de la largeur de colonne. Aucune position de
> scroll ne pouvait donc afficher que des colonnes entières, et le `snap-x`
> ajouté en juillet ne pouvait rien y faire.
>
> Correctif : largeur de colonne ÉLASTIQUE, calculée pour qu'un nombre entier
> tienne (`n = floor(disponible / largeurNaturelle)`, puis `disponible / n`),
> puis cadrage du scroll sur une frontière réelle mesurée.
>
> ⚠️ **On ÉLARGIT, jamais on ne rétrécit** : le contenu d'une cellule impose un
> plancher que l'algorithme de table respecte quoi qu'on écrive. Demander moins
> est ignoré en silence, et la colonne repart en morceau.
>
> Mesuré après correctif : **0 colonne coupée**, à 375 px comme à 1280 px, et
> stable au changement de période. Compromis assumé sur mobile : 2 jours
> entiers visibles au lieu de 3 entiers plus un tronqué.
>
> ⚠️ Pas de `ResizeObserver`, et c'est un choix APRÈS ESSAI : il se rappelait
> lui-même (la fonction modifie les largeurs qu'il observe). Deux gardes ont
> été essayées et mesurées, aucune n'était déterministe. Le recalcul suit donc
> les dépendances de l'effet. Un redimensionnement de fenêtre ne recalcule pas
> immédiatement : compromis assumé, corrigé au rendu suivant.

### Le diagnostic d'origine

Mesuré : `scrollLeft = 233,6 px`, la colonne « dim. 9 » est visible sur **30 px de 52**.

L'audit du 2026-07-14 recommandait du scroll-snap. **Il a été appliqué** (`snap-x snap-proximity
scroll-pl-[140px]` sur le conteneur, `snap-start` sur les `<th>`) et le symptôme persiste, parce
que la cause n'est pas le snap : `HabitTable.tsx:30` force `scrollLeft = scrollWidth` au montage
(pour afficher aujourd'hui), ce qui atterrit sur la **limite de scroll** — une position que le
snap ne peut pas corriger. Et la largeur disponible (334 − 143 de colonne collante = 191 px) n'est
pas un multiple de 52 px : il reste 3,67 colonnes.

**Correction** : rendre la largeur des colonnes de jour élastique pour qu'un nombre entier tienne
dans l'espace disponible, plutôt que `min-w-[40px] md:min-w-[50px]` fixe. Le snap devient alors
utile au lieu d'être décoratif.

### ✅ 4. z-index — l'échelle publiée était incomplète (2026-08-24)

> **Le diagnostic était à l'envers.** En relisant les « 8 valeurs hors barème » une par une, ce ne
> sont pas des accidents : elles portent un ORDRE réel et voulu. `AdModal` (300) doit passer devant
> `CookieBanner` (200) ; `PageTutorial` (500) devant tout le chrome ; un popover ouvert DANS une
> feuille portalisée (10000) devant la feuille (9999). Les rabattre sur 7 paliers aurait créé des
> collisions d'empilement pour faire entrer la réalité dans un tableau.
>
> Le vrai défaut était l'inverse : **le barème publié ne décrivait que la moitié des couches
> réelles.** L'échelle complète est donc publiée plus bas, et **fermée par un test**
> (`src/design-system.guard.test.ts`) : aucune valeur hors liste, et ajouter un cran demande de
> justifier l'ordre voulu.
>
> Deux valeurs seulement étaient de vrais accidents, et ont été migrées : `z-[3]`
> (décor du hero entreprise — le parent porte `opacity-60`, qui crée son propre contexte
> d'empilement, la valeur n'avait donc aucun effet) → `z-10` ; et `z-[75]` (`CompletedOKRsModal`)
> → le cran voisin `z-[70]`.

### Le diagnostic d'origine

L'[échelle documentée plus bas](#échelle-z-index-audit-2026-07) définit 7 paliers. Le code en
utilise **21**. Les 8 valeurs hors barème, chacune dans un seul composant :

| Valeur | Composant |
|---|---|
| `z-[90]` | `ColorSettingsModal.tsx` |
| `z-[110]` | *(plus aucun consommateur : `CategoryManager.tsx` supprimée le 2026-09-14)* |
| `z-[150]` | `WeeklyCheckinModal.tsx` |
| `z-[190]` | `DemoBridgePrompt.tsx` |
| `z-[250]` | `ShareInviteClaimer.tsx` |
| `z-[300]` | `AdModal.tsx` |
| `z-[500]` | `PageTutorial.tsx` |
| `z-[10000]` | `AssigneesPicker.tsx`, `RemoveFriendConfirm.tsx` |

Aucun bug d'empilement constaté aujourd'hui, mais la table a été publiée **et n'a pas tenu** :
chaque nouveau composant a repris l'habitude de choisir sa valeur. Une échelle qui n'est pas
vérifiée par un lint ne tient pas — même leçon que les invariants RLS et `check:rls`.

**Correction** : mapper ces 8 composants sur les paliers existants, puis ajouter une règle ESLint
`no-restricted-syntax` sur `z-[…]` hors liste. ~1 h 30.

### ✅ 5. Résidus de l'audit précédent — traités le 2026-08-24

> - `Bricolage Grotesque` : **déjà supprimé** avant cette passe (0 occurrence dans `src/`).
> - `hover:text-blue-700` sans variante dark : corrigé sur `ColorSettingsModal.tsx` et
>   `EventModalFormDesktop.tsx`. **Vérifié : plus aucun `hover:text-blue-700` sans
>   `dark:hover:text-blue-300` dans tout `src/`.**

### Le diagnostic d'origine

- **`Bricolage Grotesque` en dur** dans `SettingsPage.tsx:893` (`style={{ fontFamily }}`). Le
  `<link>` Google Fonts a bien été retiré — la police n'est donc **plus chargée** et ce `h3`
  retombe sur la police système. Une déclaration morte qui donne un rendu différent des autres
  titres. Supprimer la ligne. 5 min.
- **`hover:text-blue-700` sans variante dark** : `ColorSettingsModal.tsx:163` et
  `EventModalFormDesktop.tsx:342`. En thème sombre, le contraste **baisse** au survol.
  Ajouter `dark:hover:text-blue-300`. 10 min.

### ✅ 6. Cibles tactiles sous 44 px · corrigées le 2026-08-24

> **`/tasks` : 18 → 5. `/entreprise` : 22 → 8.** Croix des bannières 28 → 44, cloche de
> notifications 36 → 44, boutons « Masquer » 24 → 44, chips de filtre 40 → 44 sur mobile (le
> desktop garde sa densité), pastille de forfait 36 → 44, onglets d'organisation 42 → 44.
>
> Les restantes sont **conformes AA** : un lien inline dans une phrase (exempté), et des cibles
> de 24 à 32 px délibérément laissées telles quelles, les cases à cocher des listes denses à
> 24×24 parce que les lignes font 32 px (une cible de 44 déborderait de 6 px de chaque côté et
> cocherait la mauvaise tâche), les boutons-titres à 32 px pour la même raison.
>
> 📏 **Ne pas « corriger » ces exceptions.** WCAG 2.1 AA n'exige pas 44×44, c'est 2.5.5, niveau
> AAA. WCAG 2.2 ajoute 2.5.8 « Target Size (Minimum) » à **24×24** en AA. Les 44 px du projet sont
> une règle **interne** (iOS HIG), plus stricte que la conformité. Détail et arbitrages :
> [`ACCESSIBILITY.md`](../ACCESSIBILITY.md).

### Le diagnostic d'origine

18 sur `/tasks`, 22 sur `/entreprise`. Les plus petites sont des boutons icône seule :
24×24 (« Masquer cette information »), 28×28 (« Modifier le profil »), 36×36 (notifications).
La règle du projet est ≥ 44×44 ([`ACCESSIBILITY.md`](../ACCESSIBILITY.md)). Les chips de filtre
sont à 40 px de haut — juste sous la barre.

### ✅ Vérifié sain (ne pas re-suspecter)

- **Aucun débordement horizontal** sur les 8 routes, en 375 px comme en 1280 px.
- **Réactivité du thème** : les seules couleurs Tailwind en dur restantes (`bg-white`,
  `text-slate-900`) sont sur les pages marketing publiques, sombres par construction — c'est
  intentionnel. Le correctif de tokens du 2026-07-23 tient dans l'app.
- **Page Statistiques mobile** : zéro troncature.
- **FAB** : ne masque plus rien ; `SettingsPage` a bien le padding bas réservé, et l'identifiant
  de tutoriel est désormais dédié (`global-quick-add-fab`).
