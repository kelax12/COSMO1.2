# Patterns UI — COSMO

## Note UI / UX : 70 → 80 → **82 / 100** (2026-08-24 → 2026-08-25 → 2026-08-27)

| Finding de l'audit du 2026-08-14 | 08-24 | 08-25 | **08-27** |
|---|---|---|---|
| 1. Quatre tailles de titre de page | ✅ ramenées à deux | ✅ **+ 6 pages migrées** | ✅ |
| 2. Titres de tâches tronqués (12 sur `/tasks`) | ❌ ouvert | ✅ **12 → 2** (`line-clamp-2`) | ✅ |
| 3. Tableau Habitudes, colonne coupée | ❌ ouvert | ✅ **0 colonne coupée**, 375 px et 1 280 px | ✅ |
| 4. Échelle z-index incomplète | ✅ publiée + fermée par test | ✅ | ✅ |
| 5. Résidus de l'audit précédent | ✅ traités | ✅ | ✅ |
| 6. Cibles tactiles sous 44 px | ❌ 18 · 22 | ✅ **5 · 8**, les restantes conformes AA | non remesuré |
| 7. Écrans qui affichent un état vide pendant le chargement | ❌ 3 onglets entreprise | ❌ | ✅ **0**, squelettes + test |
| 8. Barre de navigation qui se réordonne après la réponse réseau | ❌ | ❌ | ✅ **corrigée** (F3) |
| 9. Clic qui emporte le visiteur hors de la landing sans prévenir | ❌ 2 chemins | ❌ | ✅ **0** |

### 2026-08-27 · +2, sur une classe de défaut que la liste de 2026-08-14 ne voyait pas

**Trois findings nouveaux, tous de la même famille : l'interface affirmait quelque chose qu'elle
ne savait pas encore, ou faisait quelque chose que personne n'avait demandé.** Ils n'étaient pas
dans l'audit d'origine parce que celui-ci mesurait de la **géométrie**, et que ces trois-là ne se
voient que **dans le temps** : pendant un chargement, pendant une réponse réseau, après un clic.

**7 · Trois écrans annonçaient des zéros faux** (commit `1d98f93`). `MyWorkTab`, `TeamTasksTab` et
`TeamOverviewTab` déstructuraient `const { data = [] }` sans jamais lire `isLoading` : pendant le
premier fetch ils rendaient leur état **vide** comme une vérité. « Aucune tâche pour l'instant »
sur l'Aperçu, « Créez d'abord un projet » à une organisation qui en a douze, et un tableau de bord
annonçant **0 tâche / 0 %** à un manager avant d'afficher ses vrais chiffres.

- *Un zéro faux coûte plus cher qu'une attente : c'est l'image dont on se souvient.*
- La garde est posée **au bon niveau** : sur Statistiques le sélecteur de période reste utilisable,
  seuls les chiffres attendent. Le compteur « x sur y affichées » attend aussi, « 0 sur 0 » étant
  une affirmation.
- Squelettes en gris neutre (`--color-hover`) et **non** `bg-accent`, qui vaut un bleu vif dans
  3 thèmes sur 4.
- Verrouillé par `org-loading-states.test.tsx` (4 cas), lui-même vérifié en neutralisant le garde
  de l'Aperçu, il tombe bien au rouge.

**8 · La navigation se réordonnait après coup** (commit `f32d080`). L'entrée « Entreprise » était
montée sur `{myOrg && …}` : la barre latérale se peignait sans elle, puis la faisait apparaître,
et tout ce qui suit, « Créer / rejoindre », la section AUTRE, les Paramètres, sautait d'une ligne
à chaque chargement de page. Le correctif réserve la place à partir d'un indice d'affichage
persisté (`wasOrgMember`). ⚠️ Le gain **n'est pas mesuré en CLS**, cf.
[`MOBILE.md`](./MOBILE.md) §2026-08-27 : la preuve est dans les tests d'état transitoire.

**9 · Deux clics emportaient le visiteur hors de la landing.** Depuis le menu d'une carte membre
de la pyramide entreprise, « Voir ses tâches » ouvrait **directement** la démo (commit `c21754d`,
remplacé par une proposition explicite), et la confirmation qui a suivi était un toast
*dismissible*, donc contournable : elle devient une `AlertDialog` modale qui bloque l'interaction
tant que le visiteur n'a pas choisi (commit `722aba1`). **Règle qui en sort : un changement de
contexte irréversible se confirme dans un dialogue bloquant, jamais dans un toast.**

**Aperçu entreprise, refonte assumée en quatre commits** (`e6a873a` → `4b91816`) : la liste
« Prochaines échéances » devient une **frise chronologique** dont l'abscisse porte le temps, donc
un paquet d'échéances collées se voit ; « Mes échéances » disparaît, elle relistait en texte des
dates déjà portées par la carte de synthèse juste au-dessus ; « Mon agenda » prend sa demi-colonne
et se **groupe par jour**, en date locale comme les habitudes et les échéances. Sous `sm`, la
frise bascule en rail vertical, six libellés côte à côte sur 375 px se chevauchant quoi qu'on
fasse. Aucune position ne dépend d'une animation, `prefers-reduced-motion` ne change rien au
rendu.

**Pourquoi +2 et pas +5.** La relecture indépendante de la zone entreprise donne
**19 → 22 → 24 / 40** sur les dix heuristiques de Nielsen en trois passages le 2026-08-27, donc
une **majorité de critères encore sous la moyenne**. Quatre findings restent ouverts, et aucun
n'est cosmétique :

- 🟠 **P1 · deux grammaires de filtre pour la même donnée** entre les onglets « Tâches » et
  « Projets ». Ouvert depuis le premier passage, non traité.
- 🟠 **P1 · 4 destinations sur 7 hors écran** dans la barre d'onglets de `/entreprise` (335 px de
  barre pour 832 px de contenu, `hide-scrollbar`, aucun indice de continuation). La moitié
  mobile du problème est réglée, `/entreprise` n'étant plus dans « Plus » ; la barre d'onglets
  **interne**, elle, n'a pas bougé.
- 🟡 **P2 · la frise entreprise répète les tâches qui me sont assignées** (`buildOrgEvents`
  n'exclut pas `currentUserId`).
- 🟡 **P2 · deux compteurs de notifications affichent 4 et 3 sous la même étiquette.**
- ⚪️ **Aucun état d'erreur éprouvé** dans la zone : les squelettes traitent l'attente, pas l'échec.

**+10.** Les **six** findings de l'audit du 2026-08-14 sont refermés. C'est le seul document du
dossier dont la liste d'origine est entièrement traitée.

**Pourquoi 80 et pas 95.** Un audit qui referme tous ses findings ne prouve qu'une chose : que
*ces* findings étaient les bons. Or celui-ci porte, de son propre aveu, sur ce qui est
**mesurable**, géométrie, troncatures, tailles de cible, z-index, tokens, et pas sur
l'esthétique ni l'équilibre visuel, faute de captures d'écran au moment de l'audit. Et le finding
structurel qui explique la moitié de cette liste vit ailleurs : **deux langages visuels mobiles
coexistent** (cf. [`MOBILE.md`](./MOBILE.md) §2, adhérence 13 %). Tant qu'il tient, cette liste se
reconstituera.

**Le geste qui ferait vraiment monter la note** est donc un audit visuel, captures, comparaison,
jugement, et non une mesure de plus.

---

## Dette UI/UX ouverte — audit du 2026-08-14

**Méthode** : mesures DOM/CSS sur l'app en mode démo (`npm run dev`), viewports 375×812 et
1280×720, 8 routes protégées. Les captures d'écran n'étaient pas disponibles : cet audit porte
donc sur ce qui est **mesurable** (géométrie, troncatures, tailles de cible, z-index, tokens),
pas sur l'esthétique ni l'équilibre visuel. Il remplace les findings de
[`archive/AUDIT-UI-2026-07-14.md`](./archive/AUDIT-UI-2026-07-14.md), dont **7 des 16 points sont
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
| `z-[110]` | `CategoryManager.tsx` |
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
> [`ACCESSIBILITY.md`](./ACCESSIBILITY.md).

### Le diagnostic d'origine

18 sur `/tasks`, 22 sur `/entreprise`. Les plus petites sont des boutons icône seule :
24×24 (« Masquer cette information »), 28×28 (« Modifier le profil »), 36×36 (notifications).
La règle du projet est ≥ 44×44 ([`ACCESSIBILITY.md`](./ACCESSIBILITY.md)). Les chips de filtre
sont à 40 px de haut — juste sous la barre.

### ✅ Vérifié sain (ne pas re-suspecter)

- **Aucun débordement horizontal** sur les 8 routes, en 375 px comme en 1280 px.
- **Réactivité du thème** : les seules couleurs Tailwind en dur restantes (`bg-white`,
  `text-slate-900`) sont sur les pages marketing publiques, sombres par construction — c'est
  intentionnel. Le correctif de tokens du 2026-07-23 tient dans l'app.
- **Page Statistiques mobile** : zéro troncature.
- **FAB** : ne masque plus rien ; `SettingsPage` a bien le padding bas réservé, et l'identifiant
  de tutoriel est désormais dédié (`global-quick-add-fab`).

## Listes — modèle étendu (types, smart, virtuelle)

`src/modules/lists/types.ts` — `TaskList` étendu avec 4 champs optionnels (rétro-compatibles) :
- `type?: 'manual' | 'smart'` — défaut `'manual'`
- `smartRule?: SmartRulePreset` — `'overdue' | 'this-week' | 'high-priority'`
- `isDefault?: boolean` — épingle UNE liste comme sélectionnée à l'ouverture
- `position?: number` — ordre d'affichage (drag-to-reorder)

**Migration SQL** : `021_lists_smart_default_position.sql` ajoute les 4 colonnes + CHECK constraints + unique partial index "un seul isDefault par user" + index user_id+position.

### Smart rules engine

`src/modules/lists/smart-rules.ts` — `SMART_PRESETS: SmartPresetDef[]` avec 3 presets (overdue / this-week / high-priority). Chaque preset a un `matches(task, now)` pur. Helper `tasksInList(list, allTasks, now)` retourne les tâches d'une liste manuelle OU smart (transparent côté caller).

**Anciens presets retirés** : `'no-deadline'` et `'bookmarked'`.

### Liste virtuelle « Aujourd'hui »

Sentinel ID = `'virtual-today'` (constante `VIRTUAL_TODAY_ID`). **Jamais en base** — calculée à l'affichage via `tasksDueToday(allTasks)` (filtre `deadline === today AND !completed`).

- Visible par défaut, masquable via `localStorage.cosmo_lists_today_hidden = '1'`
- Si sélectionnée et qu'on la masque → `selectedListId` repasse à null
- Bouton « + » au hover ouvre le mode sélection multi-tâches ; à la validation, chaque tâche se voit poser `deadline = today 23:59:59` via `updateTaskMutation` (pas `addTaskToListMutation`)

### SmartListMenu (popover ✨)

`src/components/SmartListMenu.tsx` — déclenché par bouton ✨ violet à côté du « + Nouvelle liste ». Affiche : Aujourd'hui (toggle show/hide), Liste par défaut (si une liste est `isDefault`), Smart presets (3 lignes). Cliquer un preset **actif** (✓) le supprime (toggle visibilité, même comportement que la corbeille rouge). Cliquer un preset inactif le crée et le sélectionne.

**Rendu via `createPortal(content, document.body)` + `position: fixed`** — sinon le popover était clippé par `overflow-x-auto` de la barre de chips. Trigger position mesurée via `getBoundingClientRect()` dans `useLayoutEffect`. z-index 9999.

### Drag-to-reorder local state

`Reorder.Group values={lists}` avec `lists` venant de React Query causait un snap-back après drop. **Fix** : state local `orderedLists` mis à jour immédiatement par `setOrderedLists(newOrder)` dans `onReorder`. Synchronisé depuis `lists` **uniquement** quand la composition change (ids ou count). Désactivé sur mobile.

### Couleurs personnalisées (hex)

`resolveListColor(color)` : si format `#RRGGBB` → utilisé tel quel, sinon lookup palette nominée. UI : Shift+clic sur la pastille ouvre un `<input type="color">` caché.

## EventModal — `lockedFields` & section repliée

### Prop `lockedFields?: ('title' | 'startDate' | 'endDate')[]`

Verrouille certains champs pré-remplis en lecture seule. Style locked : `bg-slate-50 cursor-not-allowed opacity-80`, distinct du style "prefilled" (bleu clair).

**Cas d'usage** : `HabitActionsMenu` → « Planifier dans l'agenda » passe `lockedFields={['title', 'startDate']}`. `endDate` est auto-synchronisé depuis `startDate`.

### Section « Description » repliée par défaut

État `showDescription` initialisé via `useEffect([isOpen])` (pas `[notes]`). Visible par défaut uniquement si l'event a déjà des notes. Sinon, bouton bleu **« + Ajouter un commentaire »**.

### Section « Aperçu » retirée

Supprimée pour tous les modes (add/edit/convert) — elle dupliquait des infos déjà visibles.

## HabitActionsMenu — habit → tâche/event

`src/components/HabitActionsMenu.tsx` — bouton « ... » dans HabitCard (ordre : `Edit2` → `MoreHorizontal` → `Trash2`). Popover via `createPortal` + position fixed.

1. **Créer une tâche** :
   ```ts
   createTaskMutation.mutate({
     name: habit.name, priority: 3, category: categories[0]?.id,
     deadline: todayEod(), estimatedTime: habit.estimatedTime,
     bookmarked: false, completed: false,
   })
   ```
2. **Planifier dans l'agenda** : ouvre `EventModal` en mode `'add'` (pré-remplit date à aujourd'hui + start 12:00 + end basé sur estimatedTime). Avec `lockedFields={['title', 'startDate']}`.

## InboxMenu — point unique pour la validation collaborative

`src/components/InboxMenu.tsx` est le **seul** endroit pour valider : demandes d'amis reçues +
tâches assignées par d'autres. (Il a remplacé l'ancien `SocialRequests.tsx` de la colonne droite
du Dashboard, supprimé depuis.)

Pour les tâches : filtre `t.isCollaborative && t.sharedBy && t.sharedBy !== user?.name`. Accepter = `{ sharedBy: undefined, isCollaborative: true }`. Refuser = `{ sharedBy: undefined, isCollaborative: false, collaborators: [] }`.

**Ne pas recréer un 2ème composant** qui validerait les mêmes tâches — `SharedTasksHistory.tsx` (supprimé) faisait ça et créait de la duplication.

## Liens d'invitation (mig. 046)

`ShareLinkField` (dans la vue Collaborateurs de `TaskModal`) affiche un lien copiable `/invite/<token>` (table `share_links`, token = uuid, 7 jours, révocable par DELETE). `InvitePage` (route publique) pose le token dans `localStorage.cosmo_pending_share_invite` puis redirige ; `ShareInviteClaimer` (monté au niveau App) claim via la RPC SECURITY DEFINER `claim_share_link` dès que l'utilisateur est authentifié. Feature Supabase-only — masquée en démo. **En création** (pas encore de `taskId` → FK `share_links.task_id`), `ShareLinkField` reçoit un callback `onGenerate` (= `useTaskModal.onGenerateShareLink`) et affiche un bouton **« Générer le lien »** : au clic, la tâche est persistée à la volée (`createTaskWithShares` dans `task-modal/save-task.ts`, avec les collaborateurs déjà sélectionnés), le hook stocke `createdTask` → la popup bascule en mode édition (`effectiveTask`/`effectiveIsCreating`) et le vrai lien s'affiche. Pas de tâche fantôme : rien n'est persisté tant que le lien n'est pas demandé. Sans `onGenerate`, fallback = placeholder désactivé.

Collaborateur **en attente** : `CollaboratorItem` marque l'état via `isPending` (demande d'ami envoyée, avatar orange + « ⏳ Demande d'ami envoyée ») ou `sentBadge` (partage émis non accepté, pastille « Envoyé » + « En attente d'acceptation »). Côté listes (`TaskTable` desktop + `TaskCard` mobile), un **sablier** ambre (`Hourglass`) s'affiche à côté des avatars de collaborateurs quand `usePendingCollaboratorTaskIds` (partage émis avec `accepted !== true`) contient la tâche.

## Showcases LandingPage — mobile vs desktop

`src/components/showcase/` :
- 5 desktop : `TaskTableShowcase`, `AgendaShowcase`, `OKRCardShowcase`, `HabitHeatmapShowcase`, `StatsShowcase`
- 5 mobile : exportés depuis `MobileShowcases.tsx`

Choisi via `useIsMobile()` dans `LandingPage`. Les showcases mobile reproduisent fidèlement les composants réels. Le folder `src/components/showcase/` est ignoré par ESLint.

## EmptyState — composant réutilisable

`src/components/EmptyState.tsx` — icône + titre positif + description + CTA. Branché sur TodayTasks et TodayHabits. À utiliser pour toute liste vide nouvelle.

Props : `icon: LucideIcon, title, description?, actionLabel?, onAction?, accentColor?, compact?`.

## Onboarding & Tutoriels

### OnboardingOverlay — supprimé (2026-07, commit c170e37)

Le tutoriel 3 étapes affiché après `loginDemo()` a été **retiré volontairement** et le composant supprimé du repo (purge 2026-07-15). L'onboarding démo repose désormais sur `OnboardingExampleTasks` (tâches d'exemple au premier login) et les `PageTutorial` par page. Ne pas recréer d'overlay bloquant à l'entrée en démo.

### PageTutorial — tutoriel par page

`src/components/tutorial/PageTutorial.tsx` — spotlight, flèche, démos d'actions automatiques.

Architecture :
- `tutorial/types.ts` — `TutorialStep` : title, description, target (selector CSS), cardPlacement, action ('click' | 'pulse' | 'drag-ghost' | 'drag-and-resize' | 'type' | 'custom'), dimLevel, ghostLabel, visibility
- `tutorial/useTutorial.ts` — gère le flag `cosmo_tutorial_seen_<key>`
- `tutorial/PageTutorial.tsx` — orchestrateur

**Configs séparées par viewport** : chaque page a `<page>.desktop.ts` ET `<page>.mobile.ts`. Choisi via `useIsMobile()` :

```tsx
const isMobile = useIsMobile();
const tutorial = useTutorial(isMobile ? 'tasks_mobile' : 'tasks_desktop');
const steps = isMobile ? tasksTutorialStepsMobile : tasksTutorialStepsDesktop;
```

Flags : `cosmo_tutorial_seen_tasks_(desktop|mobile)`, idem `agenda`, `habits`, `okr`.

**Visuel spotlight** : voile sombre via `boxShadow: 0 0 0 9999px <color>` sur le hole. PAS de fullscreen overlay avec `backdropFilter: blur`. `dimLevel: 'light'` (0.35) sur les steps Agenda/Calendar.

**Action `drag-and-resize`** (Agenda) : ghost coloré animé (4 phases) + indicateur de poignée resize. Pas de manipulation DOM réelle.

**Markers `data-tutorial-id`** :
- TasksPage : `tasks-filter`, `tasks-calendar-toggle`, `tasks-create-button`, `tasks-fab`, `tasks-list`, `tasks-lists`
- AgendaPage : `agenda-view-switcher`, `agenda-task-sidebar-toggle`, `agenda-calendar-grid`
- HabitsPage : `habits-view-switcher`, `habits-create-button`, `habits-fab`, `habits-list`
- OKRPage : `okr-category-filter`, `okr-create-button`, `okr-first-card`

> **Ne pas renommer** un `data-tutorial-id` sans grep les tutorials d'abord.

### Ré-afficher un tutoriel
```js
['tasks','agenda','habits','okr'].forEach(p => {
  localStorage.removeItem(`cosmo_tutorial_seen_${p}_desktop`);
  localStorage.removeItem(`cosmo_tutorial_seen_${p}_mobile`);
});
```

## Thèmes — 3 valeurs, source unique

`light` · `dark` · `black`. **Source de vérité : `src/lib/theme.ts`** (`Theme`, `resolveInitialTheme`, `applyTheme`, `isTheme`) — consommée par `src/main.tsx` (avant premier paint) et `src/hooks/useDarkMode.ts`. Ne pas redupliquer la résolution ailleurs.

Sur mobile, un visiteur sans `localStorage.theme` démarre en `black` ; un choix explicite prime toujours. Les valeurs historiques `midnight` et `monochrome` sont migrées vers `black` au chargement.

### `black` — palette GitHub (graphite + accent bleu, 2026-07-22)

Le thème `black` fusionne les anciens `midnight` (OLED + accent) et `black` (monochrome, sans couleur) en un seul thème reprenant la palette GitHub dark : fond `#24292e`, surfaces `#2b3137`, accent `#58a6ff` (texte/bordures) / `#1f6feb` (fonds pleins). Tokens dans `src/index.css → .black`, RGB (`--color-*`) et HSL (shadcn) toujours en valeurs synchronisées — ne jamais faire diverger les deux familles.

Le variant Tailwind `monochrome:` et la classe `.monochrome` **ont été entièrement supprimés** (plugin `addVariant` retiré de `tailwind.config.js`, ~250 classes `monochrome:*` reciblées ou supprimées dans les composants). Ne pas les réintroduire — le thème `black` porte désormais de la couleur (accent bleu) comme les deux autres.

### Bordures — tokens sémantiques (2026-07-22)

`--color-border` (défaut) · `--color-border-muted` (discret) · `--color-border-strong` (survol), déclarés dans les 3 thèmes. Le focus change la **couleur** de bordure vers `--color-accent` via un `box-shadow` inset 1px — jamais l'épaisseur (`border-2`), pour ne pas décaler le contenu voisin. Ne pas réintroduire `border-slate-*` / `hover:border-blue-*` codés en dur ni `focus:border-2` sur les champs de formulaire — utiliser les tokens.

## Échelle z-index (audit 2026-07)

Paliers en usage — **choisir dans cette table**, ne pas inventer de nouvelle valeur :

| Palier | Usage | Exemples |
|---|---|---|
| `z-10` – `z-30` | Éléments locaux (sticky headers, badges, overlays de carte) | headers de modals, chips |
| `z-40` | UI flottante de page : FAB quick-add, indicateur sync | `Layout.tsx` |
| `z-50` | Modals/sheets standards + MobileTabBar | TaskModal, EventModal, HabitModal |
| `z-[60]` `z-[70]` `z-[80]` `z-[90]` | Couches SUCCESSIVES au-dessus d'un modal ouvert. Quatre crans, pas un intervalle : `ColorSettingsModal` empile 80 puis 90 | QuickAddBar `z-[70]`, ColorSettingsModal 80/90 |
| `z-[100]` `z-[110]` | Popovers Radix au-dessus d'un modal (110 = imbriqué dans 100) | `date-picker.tsx`, `CategoryManager` |
| `z-[150]` | Modal plein écran au-dessus du chrome applicatif | `WeeklyCheckinModal` |
| `z-[190]` `z-[200]` | Surfaces système : bannières, CommandPalette, PremiumGateModal | `DemoBridgePrompt` 190, `CookieBanner` 200 |
| `z-[250]` `z-[300]` | Interstitiels AU-DESSUS des surfaces système | `ShareInviteClaimer`, `AdModal` |
| `z-[500]` | Tutoriel de page — au-dessus de tout le chrome | `PageTutorial` |
| `z-[9999]` `z-[10000]` | `createPortal` + `position: fixed` (10000 = popover DANS une feuille portalisée) | SmartListMenu, `AssigneesPicker` |

> 🔒 **Liste fermée, vérifiée par `src/design-system.guard.test.ts`.** Toute valeur `z-[…]` hors
> de ces crans échoue en CI. Ajouter un cran est permis — il faut le poser ici ET dans le test, en
> justifiant l'ordre voulu. La version précédente de cette table listait 7 paliers pendant que le
> code en utilisait 16 : une échelle qu'aucun script ne vérifie ne tient pas.

## Shadcn UI — exceptions documentées

Les composants dans `src/components/ui/` sont normalement **non modifiés** (gérés par la CLI shadcn). Si une modif est nécessaire, **la documenter ici** :

| Fichier | Modification | Raison | Commit |
|---|---|---|---|
| `dialog.tsx` | `DialogOverlay` : `bg-black/50` → `bg-black/30 backdrop-blur-md` | Cohérence iOS sheet style | `5e2336a` |
| `dialog.tsx` | `DialogOverlay` : `function` → `React.forwardRef` + `displayName` | Radix passait un ref → warning React. Test : `src/components/ui/dialog.test.tsx` | `2026-06-19` |
| `dialog.tsx` | `DialogContent` : prop `variant` (`'default'` \| `'bottom-sheet'`) — slide-from-bottom avec easing iOS | Animation bottom-sheet mobile TaskModal | `pending` |
| `chart.tsx` | `ChartStyle` : whitelist regex sur `color` + sanitization `id`/`key` avant `dangerouslySetInnerHTML` | M-11 — durcir CSS injection | `pending` |
| `chart.tsx` | `ChartTooltipContent` / `ChartLegendContent` : types découplés de Recharts | Recharts v3 a remanié les types Tooltip/Legend → 8 erreurs `tsc`. Runtime inchangé | `pending` |

Toute nouvelle modif doit s'ajouter dans cette table.

## Ne jamais faire — UI

### 🎨 Convention code
- ❌ Modifier les fichiers `src/components/ui/` **sans documenter l'exception**
- ❌ Ajouter des `as any` pour contourner les erreurs TypeScript
- ❌ Appeler `toast.error()` depuis un repository ou `normalizeApiError`
- ❌ Forcer `theme="dark"` sur le `Toaster` (utiliser `theme="system"`)
- ❌ Réintroduire la section « Aperçu » dans EventModal
- ❌ Forcer `showDescription = true` au mount par défaut
- ❌ Ajouter un champ à `lockedFields` sans gérer le visuel `disabled`/`readOnly` + style locked
- ❌ **Déstructurer `const { data = [] } = useX()` sans lire `isLoading`** quand la valeur alimente un chiffre, un compteur ou un état vide visible (2026-08-27, finding 7). Le tableau vide par défaut se rend comme une **affirmation** : « 0 tâche », « aucun projet ». Rendre un squelette (`src/components/skeletons`, `OrgLoadingSkeletons`), en gris neutre `--color-hover` et **jamais** `bg-accent`, qui vaut un bleu vif dans 3 thèmes sur 4
- ❌ **Confirmer un changement de contexte irréversible par un toast** (2026-08-27, finding 9) : il est *dismissible*, donc contournable. Un départ hors de la page, une perte de saisie, une navigation qui remplace l'écran se confirment dans un dialogue **bloquant** (`AlertDialog`)
- ❌ **Monter une entrée de navigation sur `{data && …}`** (2026-08-27, finding 8) : la barre se peint sans elle, puis la fait apparaître, et tout ce qui suit saute d'une ligne. Réserver la place à partir d'un indice persisté, et ne jamais confondre cet indice avec une autorisation (cf. [`../faille.md`](../faille.md))

### 📋 Listes & SmartListMenu
- ❌ Popover positionné en `absolute` dans une barre `overflow-x-auto` — utiliser `createPortal` + `position: fixed`
- ❌ Stocker la liste virtuelle « Aujourd'hui » dans la table `lists` — filtre dynamique `tasksDueToday()`, sentinel `VIRTUAL_TODAY_ID`
- ❌ `Reorder.Group` avec React Query : `values={lists}` directement — maintenir un state local `orderedLists`
- ❌ Recréer un 2ème composant qui valide les tâches assignées — **InboxMenu est le point unique**

### 🧭 Tutoriels & onboarding
- ❌ Recréer un overlay d'onboarding bloquant à l'entrée en mode démo (supprimé par c170e37)
- ❌ `useEffect([], ...)` pour détecter `cosmo_onboarding_pending` — dépendre de `[isDemo, location.pathname]`
- ❌ Fusionner les configs tutoriel desktop/mobile en un seul fichier
- ❌ Manipuler le DOM réel (FullCalendar drag) depuis une action de tutoriel — animation pure
- ❌ Ajouter du `backdropFilter: blur` au voile du PageTutorial
