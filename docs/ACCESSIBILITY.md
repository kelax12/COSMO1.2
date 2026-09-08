# Accessibilité (a11y) — COSMO

**Cibles** : WCAG 2.1 AA (obligation EAA — European Accessibility Act, applicable depuis le 28 juin 2025).
**Outillage** : `e2e/a11y-audit.spec.ts` (axe-core, 11 routes, dumpe les violations par route)
**+ Lighthouse CI** (`lighthouserc.json`, job `lighthouse`) sur les 4 routes prérendues.
**Gates CI** : les violations `impact: 'critical'` sont **bloquantes** (`assertNoCritical`). `serious` / `moderate` / `minor` sont dumpées dans `test-results/a11y/<route>.json` mais non bloquantes. Le score a11y de Lighthouse est **bloquant** sur `/`, `/guide`, `/blog`, `/pour-freelances`.

## 🔎 Ce que nos mesures prouvent, et ce qu'elles ne prouvent pas

🔴 **Tout ce que ce document appelle « mesuré » a été mesuré sur Chromium desktop**, en viewport de
bureau, par axe-core et par Playwright. Or **Playwright ne lit pas l'arbre d'accessibilité comme un
lecteur d'écran** : il interroge le DOM, `document.activeElement` et des attributs. Ce qui est
prouvé ici, c'est le **FOCUS**. Ce n'est pas l'**ANNONCE**.

| Prouvé aujourd'hui | Non prouvé, et donc à ne pas affirmer |
|---|---|
| Où part le focus à l'ouverture d'une surface, et où il revient à sa fermeture | Ce qu'un lecteur d'écran **prononce** en arrivant sur cet élément |
| Qu'une flèche déplace le focus, et de quelle cellule à quelle cellule | Le **rôle** annoncé (« case à cocher » plutôt que « bouton »), et l'état (« cochée », « sélectionné ») |
| Qu'un élément est atteignable au clavier, et en combien de tabulations | L'**ordre de lecture au balayage**, qui inclut le texte non focalisable et diffère de l'ordre de tabulation |
| Qu'un attribut ARIA est **présent** dans le DOM (`aria-label`, `aria-modal`, `aria-live`) | Qu'il produise **un effet audible** : une région live peut exister et n'être jamais vocalisée |
| Qu'un nom accessible existe (axe-core le vérifie) | Qu'il soit **intelligible** : « 27août » avait un nom accessible, et il était faux (finding D4) |
| Le comportement d'un clavier physique | Les gestes VoiceOver, le rotor, l'exploration au doigt, et ce que le double tap déclenche |

Conséquences pratiques, à tenir :

- ❌ **Ne jamais écrire dans ce document qu'un écran est « lisible par un lecteur d'écran »** tant
  que l'audit VoiceOver iOS n'a pas été joué. La formule autorisée est « le focus se déplace
  correctement », qui est ce qui a été observé.
- ❌ **Ne jamais compter un correctif d'annonce comme vérifié** parce qu'il est écrit. Les trois
  correctifs D4, D5 et E2 du 2026-08-27 portent sur ce qui est **prononcé** : ils n'ont jamais été
  entendus, seulement relus.
- ✅ **Le seul instrument qui mesure l'annonce est un vrai lecteur d'écran sur un vrai appareil.**
  La check-list est prête et se joue d'une traite :
  [`AUDIT-VOICEOVER-IOS.md`](./AUDIT-VOICEOVER-IOS.md).

## Note d'accessibilité : 76 → 79 → 80 → 81 → 82 → **83 / 100** (2026-08-24 → 2026-08-25 → 2026-08-27 → 2026-08-29 → 2026-09-03 → 2026-09-04)

> ### 2026-09-04 · +1, un critère A qui n'était couvert nulle part
>
> **2.4.1 Contourner des blocs (A)**, jusqu'ici absent du produit : aucune page protégée n'avait de
> lien d'évitement, donc la barre latérale entière se retabulait à chaque écran, et `/agenda` y
> ajoutait onze boutons homonymes avant le premier événement. Deux liens posés, tous deux
> assertionnés sur le déplacement de `document.activeElement`. Détail et arbitrage : § « C-54
> tranché » plus bas.
>
> ⚠️ **+1 seulement, et pas davantage** : le critère est désormais satisfait sur les routes
> protégées, pas sur les pages publiques (landing, blog, guide), qui n'ont pas été touchées.
> Le « 82 » d'avant est repris de la ligne du 2026-09-03 de ce même fichier, pas d'un tableau plus
> ancien.


> ### 2026-09-03 · +1, trois défauts réels, aucun visible par axe-core
>
> | # | Critère WCAG | Ce qui était cassé |
> |---|---|---|
> | **F1** | 2.1.1 Clavier (A) | Les flèches ne déplaçaient **pas** le focus dans le calendrier. `Button` n'était pas un `forwardRef` : la source shadcn amont est écrite pour React 19, où `ref` est une prop ordinaire, le projet est sur React 18. Le `ref.current?.focus()` de `CalendarDayButton` ne faisait rien depuis toujours. Prouvé dans le navigateur : Tab atteint la grille des jours, Flèche droite passe du 30 au 31 août |
> | **F2** | 1.4.1 Utilisation de la couleur (A) | Les liens rendus par `RichText` n'étaient pas soulignés : seule la couleur les distinguait du texte |
> | **F3** | 1.4.11 Contraste du non-texte (AA) | L'icône des sélecteurs de date natifs était **noire sur fond noir** en thème sombre, à cause d'un `filter: invert(1)` devenu contre-productif depuis que `.dark` pose `color-scheme: dark`. Mesuré côte à côte dans le navigateur, sur `date`, `time` et `datetime-local`, en thèmes Sombre et Noir |
>
> **Le point vient de F1**, qui est un défaut de clavier pur, donc de la moitié de WCAG qu'un scan
> automatique ne voit pas : axe-core ne teste pas si une flèche déplace réellement le focus. Le
> défaut vivait dans le composant `Button`, c'est-à-dire partout, mais un seul appelant du dépôt
> lui passe un `ref` (vérifié) : la portée réelle est le calendrier.
>
> ⚠️ **Ce que cette passe n'a pas fait** : les scores Lighthouse a11y n'ont pas été relus après ces
> trois correctifs, aucune cible tactile n'a été recomptée, et les quatre audits jamais faits
> (agenda, modals, clavier de bout en bout, VoiceOver iOS) restent à faire. Le calendrier COSMO
> ayant remplacé le picker natif sur **six surfaces** (cf. [`UI-PATTERNS.md`](./UI-PATTERNS.md)),
> c'est désormais un composant maison qui porte la saisie de date : son parcours clavier complet
> mérite un audit dédié, il n'a été vérifié que sur le déplacement du focus.

> ### 2026-08-29 · +1, la gate Lighthouse mesure enfin, et elle bloque
>
> Le job `lighthouse` n'avait **jamais produit un rapport** depuis son ajout le 2026-08-24 : Chrome
> ne démarrait pas. Il tourne, et l'accessibilité des pages publiques est désormais mesurée à
> chaque push : `/` **93 à 97**, `/guide/` **96**, `/blog/` et `/pour-freelances/` **99**.
>
> Le seuil est **bloquant** à 0,90. Il avait d'abord été posé à 0,92, au plus près du mesuré, puis
> **redescendu le jour même** : la même page, sur le même build, donne 93 puis 97 entre deux
> passes. Un seuil à l'intérieur du bruit de mesure transforme la gate en pile ou face, et la
> première rougeur qui n'est pas une régression apprend à l'ignorer.
>
> ⚠️ **Le point n'est pas gagné sur un correctif** : aucun défaut d'accessibilité n'a été corrigé
> ces deux jours. Il est gagné parce qu'une régression franche sur les quatre pages publiques ne
> peut plus passer inaperçue. L'écart de 4 points entre deux passes reste, lui, inexpliqué.

| Ce qui compose la note | 08-24 | 08-25 | **08-27** |
|---|---|---|---|
| Violations de contraste sur `/okr` | 27 → 4 (corrigé le jour même) | **4** | 4, non remesuré |
| Thèmes non conformes AA sur `--color-text-muted` | 3 sur 4 → 0 | **0** | 0 |
| Cibles tactiles hors norme (`/tasks` · `/entreprise`) | 5 · 8 | **5 · 8** | non remesuré |
| Findings A-1 → A-11 ouverts | 1 (A-8 résiduel, arbitrage produit) | **1** | **1**, inchangé |
| Gates automatiques a11y | 1 (axe-core, `critical`) | **2** (+ Lighthouse a11y bloquant sur les pages publiques) | 2 |
| Audits jamais faits | agenda, modals, clavier, VoiceOver iOS | **inchangés** | **inchangés** |
| Défauts de nom accessible corrigés hors axe-core | · | · | **3** (D4, D5, E2, cf. §2026-08-27) |
| Libellés sous le plancher de 11 px | 79 | 79 | **75** |

### 2026-08-27 · +1, et le point est ailleurs que dans les gates

**Trois défauts corrigés, aucun n'était visible par axe-core**, ce qui est exactement le tiers de
WCAG qu'un scan automatique ne couvre pas. Ils viennent d'une relecture manuelle du mode
entreprise (commit `180fba1`) :

| # | Ce que le lecteur d'écran disait | Correctif |
|---|---|---|
| **D4** | La pastille de date de la frise se lisait **« 27août »** : deux fragments visuels collés, sans espace ni contexte d'année | Date complète en `sr-only`, fragments visuels en `aria-hidden`, plus un `<time dateTime>` lisible par la machine |
| **D5** | « Mes tâches (3)· 1 h 45 » : le `ml-2` séparait le **visuel**, pas le **nom accessible** | Séparateur porté par le texte, « (3) · 1 h 45 » |
| **E2** | La pastille de priorité n'était portée que par `title=`, **invisible au clavier et au toucher** | `role="img"` + `aria-label`, 4 fichiers |

Et une conséquence indirecte de la garde design-system (finding F1) : **quatre libellés de la
frise passent de 10 à 11 px**, le plancher lisible de l'échelle fermée. Le stock de tailles sous
11 px descend de **79 à 75**, mesuré par `src/design-system.guard.test.ts`, pas estimé.

**Pourquoi +1 et pas plus.** Les deux plafonds de la note n'ont pas bougé d'un pouce : le bouton
d'action principal est toujours à **3,34** (arbitrage d'Axel), et les **quatre audits jamais
faits** le sont toujours. Ce qui monte, c'est une classe de défaut que les gates ne verront jamais
et qu'il a fallu lire à la main.

> ⚠️ **La leçon vaut pour toute la zone entreprise** : `title=` n'est pas un nom accessible, et un
> texte découpé en fragments visuels se lit **collé**. Les deux se voient à la relecture, jamais
> dans une gate verte. La règle correspondante est ajoutée en bas de ce document.

**+3, et pas plus, parce que le gros du travail a été fait le 24, pas le 25.** Le seul apport
propre du 2026-08-25 est une **seconde** gate : jusqu'ici, aucune vérification a11y automatique ne
portait sur les pages **publiques**, celles qu'un prospect voit avant de créer un compte, et les
seules soumises à l'EAA sans réserve.

Ce qui plafonne la note tient en deux points, et aucun n'est technique :

1. **Le bouton d'action principal est à 3,34** (blanc sur le bleu de marque), sous les 4,5 requis.
   Le corriger demande d'assombrir la couleur de marque de 16 %, **arbitrage d'Axel**.
2. **Trois de ces quatre audits ont été faits le 2026-09-03** (A-3), au clavier et dans le
   navigateur : `/agenda` (FullCalendar), les modales (piège de focus, Échap, `aria-modal`) et le
   parcours clavier. **VoiceOver iOS sur un vrai appareil reste entier.** Cf. la section suivante.
   *Un scan automatique couvre environ un tiers des critères WCAG ; le reste demande un humain.*

## ✅ A-8 et A-11 tranchés le 2026-08-24 (mesurés, pas estimés)

Les deux findings « non prouvés » depuis mai traînaient parce que personne ne les avait
mesurés. Fait, dans le navigateur, mode démo, viewport 375×812.

### A-11 — `heading-order` : **caduc**

Séquence relevée sur `/okr` : `h1 → h2 → h3 → h2 → h3 → h2 → h3 → h3`.
**Aucun saut de niveau supérieur à 1.** Le finding est fermé, sans correctif.

### A-8 — contraste : **PROUVÉ, et bien plus large que « les pills OKR »**

27 violations de contraste sur `/okr`, dont 23 au ratio **3,79** — une seule et même
cause : le token `--color-text-muted`, qui porte les dates, les méta et les labels dans
toute l'application. Ce n'était pas un problème de pills.

| Thème | avant (sur surface / sur fond) | après | statut |
|---|---|---|---|
| clair | **2,56** / **2,45** | 4,74 / 4,53 | 🔴 le pire, corrigé |
| dark | 5,71 / 6,96 | inchangé | ✅ était déjà conforme |
| gris | **3,39** / **3,79** | 4,55 / 5,07 | corrigé |
| noir | **2,88** / **3,18** | 4,58 / 5,07 | corrigé |

**Trois thèmes sur quatre étaient non conformes AA.** Après correctif : 27 → **4**
violations sur `/okr`.

> 🟠 **Reste ouvert, et c'est un arbitrage produit, pas technique.** Deux des quatre
> violations restantes sont le bouton d'action principal : blanc sur
> `--color-accent-solid` (`rgb(56 139 253)`) = **3,34**, sous les 4,5 requis pour du
> texte normal. L'amener à 4,5 demande d'assombrir le bleu de marque de 16 %
> (`#2f75d5`, ratio 4,54). C'est un changement d'identité visuelle : il appartient à
> Axel, il n'a pas été fait ici.
> La 3ᵉ est une pastille de catégorie dont la couleur est **choisie par l'utilisateur**
> (contraste non garantissable par construction) ; la 4ᵉ est un bouton à 3,93.

### Cibles tactiles — mesurées et corrigées le 2026-08-24

| Page | avant | après | dont sous 24×24 (minimum WCAG 2.5.8) |
|---|---|---|---|
| `/tasks` | 18 | **5** | **1** — un lien inline dans une phrase (exempté) |
| `/entreprise` | 22 | **8** | **1** — le même lien inline |

Ce qui a été fait : croix des bannières 28→44, cloche de notifications 36→44, boutons
« Masquer » 24→44, chips de filtre 40→44 sur mobile (le desktop garde sa densité),
pastille de forfait 36→44, onglets d'organisation 42→44.

> ⚠️ **Deux décisions à ne pas « corriger » plus tard.**
> 1. Les cases à cocher des listes denses sont passées à **24×24**, pas 44. Les lignes
>    font 32 px : une cible de 44 déborderait de 6 px en haut et en bas et chevaucherait
>    la ligne voisine — on cocherait la mauvaise tâche. 24×24 est le minimum WCAG 2.5.8
>    (AA) atteint sans invoquer l'exception d'espacement.
> 2. Les boutons-titres de tâche sont passés à **32 px** (hauteur de leur ligne), pas 44,
>    pour la même raison : passer à 44 aurait fait grossir chaque ligne de 37 %.
>
> 📏 **Rappel de seuil, parce qu'il est souvent confondu** : WCAG 2.1 AA n'exige PAS
> 44×44. C'est 2.5.5 (AAA). WCAG 2.2 ajoute 2.5.8 « Target Size (Minimum) » à **24×24**
> en AA. Les 44 px du projet sont une règle INTERNE (iOS HIG), plus stricte que la
> conformité. Les cibles restantes entre 24 et 44 sont donc conformes AA.

## ⌨️ A-3 · audit clavier du 2026-09-03 (mesuré, pas estimé)

Premier parcours **au clavier** de ce dépôt, souris débranchée. Harnais :
`e2e/a11y-keyboard-audit.spec.ts`, qui embarque un **témoin** — une modale Radix sur laquelle les
trois détecteurs (entrée du focus, piège, Échap) doivent répondre « conforme ». S'il échoue, aucune
mesure du fichier n'a de valeur.

**Ce qui a été corrigé** (findings C-51 et C-52 de `a-faire-code.md`) :

- Le **calendrier COSMO** ne se pilotait pas au clavier, sur ses **huit** surfaces. Ouvrir le
  calendrier posait le focus sur la rangée de presets, où les flèches ne font rien ; le mois
  affiché était le mois COURANT même quand le champ portait une autre date ; et `initialFocus`
  était une prop **morte** depuis `react-day-picker` 9. Après correctif : le focus part du jour
  sélectionné, dans le bon mois, et `→ → ↓` déplace bien de 3 déc. à 4 déc. puis 11 déc.
- Les **libellés ARIA du calendrier étaient en anglais** (« Go to the Previous Month »,
  « Today, jeudi 3 septembre 2026 ») : `react-day-picker` ne traduit que les DATES, jamais ses
  libellés. Idem pour le bouton de fermeture par défaut de `DialogContent`, nommé `Close` sur sept
  composants du produit.

**Ce qui reste ouvert**, mesuré et non corrigé :

| Constat | Où | Finding |
|---|---|---|
| ~~Aucune modale maison ne piège le focus~~ | `EventModal`, `HabitModal`, les feuilles | C-53, **corrigé le 2026-09-05**, cf. § « C-53 refermé » |
| ~~`EventModal` : le focus **reste derrière** la modale, et Échap ne ferme pas~~ | `/agenda` | C-53, **corrigé le 2026-09-05** |
| `/agenda` : **0 cellule de jour focalisable** sur 8 | FullCalendar | C-54, **tranché le 2026-09-04**, cf. section suivante |
| Trois surfaces que les sondes n'ont pas atteintes | calendrier ouvert depuis un MENU | C-55 |

⚠️ **Limites, à dire plutôt qu'à laisser croire.** Tout vient de **Chromium desktop** ; ce qui est
prouvé, c'est le déplacement du FOCUS, pas ce qu'un lecteur d'écran ANNONCE (le partage exact est
dans le § « Ce que nos mesures prouvent » en tête de ce document). Deux modales sur cinquante-huit
ont été réellement ouvertes : l'absence totale d'utilitaire de piège de focus dans le dépôt rend le
résultat généralisable, mais c'est une inférence.
⚠️ **Cette limite vaut toujours après le correctif, dans l'autre sens** : dix surfaces sont câblées
et mesurées, les quarante-huit autres ne le sont pas. « Le hook existe » ne veut pas dire « toutes
les modales piègent le focus » — ne jamais écrire la seconde phrase à la place de la première.

### C-53 refermé le 2026-09-05 · un hook porte le piège, pas 58 fichiers

`useModalA11y` (`src/hooks/use-modal-a11y.ts`) porte, pour toute surface modale maison, le piège
de focus, la restitution du focus au déclencheur, Échap et `role="dialog" aria-modal="true"`.
Aucune surface n'a été corrigée à la main, et **Radix n'a pas été généralisé**.

🔴 **L'énoncé vérifiable a changé de nature le 2026-09-08 : ce n'est plus une liste tenue à la
main, c'est un CLIQUET.** `src/components/modal-a11y.guard.test.ts` balaie `src/**/*.tsx`, retient
tout fichier qui monte une surface modale maison, et exige de chacun qu'il importe `useModalA11y`.
Les exceptions sont déclarées dans le fichier, **une par une, avec leur motif**.

**53 surfaces sont câblées.** Ce chiffre n'est plus à recompter : s'il baisse, la garde échoue.
Une liste qu'on relit à la main est une liste qu'on oubliera de relire — c'est exactement comme ça
que ce finding est resté ouvert pendant trois passes.

⚠️ **Câblé n'est pas mesuré, et les deux ne se confondent pas.** 10 surfaces sont mesurées au
clavier dans un vrai navigateur (liste ci-dessous) ; les 43 autres sont câblées et couvertes par le
cliquet, pas par une mesure. Écrire « les 53 piègent le focus » serait exactement le glissement que
ce paragraphe existe pour empêcher.

#### Ce que la garde a trouvé que l'inventaire manuel avait raté (2026-09-08)

Elle n'a pas seulement figé l'existant, elle a corrigé le recensement :

- **6 surfaces absentes de l'inventaire manuel**, qui cherchait `fixed inset-0` alors qu'elles ne
  portaient qu'un `role="dialog"` posé à la main. Cinq se sont révélées être des **popovers ancrés**
  ou un carton de tutoriel — non modaux, déclarés comme tels avec leur motif ; piéger le focus dans
  un popover empêcherait d'en sortir en tabulant, ce qui est précisément sa façon de se fermer.
- **5 surfaces câblées gardaient un Échap écrit à la main**, en plus de celui du hook. Le
  comportement était identique, donc invisible — mais deux propriétaires pour une touche, ce sont
  deux endroits où la règle de fermeture peut diverger. C'est le défaut d'origine de `HabitModal`,
  réapparu en cinq exemplaires. La garde le refuse désormais.
- L'une d'elles, `BulkAddToListModal`, portait une fermeture **à étages** : Échap annule d'abord le
  sous-formulaire de création, et ne ferme la modale qu'au second appui. Déplacer la touche sans
  déplacer l'escalade aurait fait perdre une saisie en cours, **sans que rien ne le signale**.
- Le détecteur lisait aussi les **commentaires** : un fichier `.ts` était signalé parce qu'un
  commentaire y décrit un overlay. Le JSX vit dans les `.tsx`, s'y restreindre supprime la classe
  entière de faux positifs.

🔎 **Témoins.** La garde compte les surfaces détectées et refuse de passer sous 40 : sans ça, casser
le détecteur rendrait le fichier **vert**. Et elle a été vue échouer, en retirant le hook de
`WeeklyCheckinModal` : elle nomme le fichier fautif.

#### Trois règles que le câblage des 43 a dégagées

- ❌ **Le chemin de fermeture n'est pas toujours `onClose`.** C'est `onCancel`, `onSnooze`,
  `closeAfter`, `onOpenChange(false)`, ou un `setState`. Échap doit emprunter **exactement** le
  chemin du voile et de la croix, jamais un raccourci.
- ❌ **Une surface qui refuse de fermer pendant une opération refuse aussi Échap.**
  `ReassignManagerSheet`, `TeamTaskModal` et `BugReportModal` gardent leur fermeture derrière un
  `pending` / `sending` : sans la même garde sur la touche, Échap ferait ce qu'aucun clic ne peut
  faire — abandonner un réattachement en cours, ou perdre une saisie sans savoir si le mail est
  parti.
- ❌ **Un hook ne se pose jamais après un `return` anticipé.** Sept fichiers ont un état de
  chargement ou un `if (!open) return null` avant leur surface. Le codemod refusait ces cas, et
  ESLint a rattrapé les deux fois où j'ai passé outre : `react-hooks/rules-of-hooks` avait raison.

#### Les 10 surfaces mesurées au clavier

**Les 9 mesurées dans un vrai navigateur** (`e2e/a11y-keyboard-audit.spec.ts`, Chromium,
14 tests verts le 2026-09-08). Cinq détecteurs sauf mention : `focusMovedIn` · `trapped` ·
`escClosed` · `role="dialog"` · `aria-modal="true"`.

| Surface | Chemin mesuré | En plus des cinq détecteurs |
|---|---|---|
| `HabitModal` | `/habits`, bouton de création | — |
| `EventModal` | `/agenda`, bouton « Nouveau » | Échap passe par `guardedClose` |
| `MobileMoreSheet` | « Plus d'options », viewport 375 × 812 | — |
| `ConfirmDiscardDialog` | Échap sur un `EventModal` modifié | prend le piège au parent, le lui rend |
| `ColorSettingsModal` | `EventModal` → « Créer une catégorie » | prend le piège au parent, le lui rend |
| `RecurrenceDaysModal` | `EventModal` → récurrence « Personnaliser » | prend le piège au parent, le lui rend |
| `TaskActionsSheet` | `/tasks` mobile, « Afficher les actions » | — |
| `MobileAddToList` | `TaskActionsSheet` → « Ajouter à une liste » | relais de surface, pas empilement |
| `ShareListSheet` | `/tasks` desktop, liste **manuelle** créée puis survolée | — |

**La 10ᵉ, `BottomSheet`, est mesurée en jsdom, et il faut dire pourquoi.** Aucun geste utilisateur
ne l'ouvre : son unique consommateur produit est `WeeklyRecapSheet`, monté derrière
`WEEKLY_RECAP_ENABLED = false` (`src/pages/HabitsPage.tsx`). Un test de navigateur devrait activer
du code mort pour l'atteindre. Le composant réel est donc monté dans
`src/components/mobile/mobile-primitives.test.tsx`, sur `focusMovedIn`, `trapped`, `escClosed` et
`aria-modal` — les mêmes détecteurs, un environnement plus faible : jsdom ne calcule aucune
géométrie et ne simule aucune tabulation native.
⚠️ **Le jour où ce drapeau repasse à `true`, cette couverture ne suffit plus** : il faudra une ligne
dans le harnais clavier.

**Ce que les mesures ont appris sur le produit, en passant :**

- Le jeu de démo ne contient **que des listes intelligentes**, et « Partager » n'est monté que pour
  `list.type !== 'smart'`. La garde `ShareListSheet` crée donc sa liste manuelle : sans ça elle
  n'aurait jamais trouvé son déclencheur et aurait **expiré**. Un timeout n'est pas un résultat.
- `AddToListModal` aiguille sur `useIsMobile()` : au-dessus du point de rupture il rend
  `DesktopAddToList`, qui **n'est pas câblée**. Mesurer sur desktop aurait parlé d'un autre
  composant que celui que la garde nomme.
- `TaskActionsSheet` appartient à la carte mobile : au-dessus du point de rupture, le bouton
  « Actions pour … » existe encore mais n'ouvre pas cette surface.
- L'URL passe à `/tasks` **avant** que le chunk lazy ait remplacé le tableau de bord. Trois sondes
  successives ont mesuré le dashboard en croyant lire la page Tâches : les gardes attendent
  désormais un élément DE la page, jamais un délai.

Les lignes correspondantes de `e2e/a11y-keyboard-audit.spec.ts` sont passées de `console.log` à
`expect` : un rapport que personne ne lit est une archive, pas une garde.

#### Ce que la passe du 2026-09-08 a ajouté, et pourquoi

`EventModal` était la dernière des trois surfaces principales à ne pas être câblée, et c'est celle
qui portait le seul cas que le câblage pouvait casser : ses **trois modales frères**. Deux gardes
ont donc été écrites, et chacune a été **vue échouer** avant d'être retenue.

- **Échap passe par `guardedClose`.** Le mode d'échec visé est silencieux : un Échap branché sur
  `onClose` au lieu de `guardedClose` ferme proprement, sans erreur, et jette une saisie que le
  même geste à la souris aurait protégée. La garde ouvre un événement existant, modifie le titre,
  presse Échap, et exige que la confirmation d'abandon s'affiche, que `EventModal` reste montée et
  que la saisie soit intacte — puis qu'elle le soit encore après avoir refusé l'abandon.
  🔎 **Témoin** : en remplaçant `onClose: guardedClose` par `onClose` dans `EventModal.tsx`, la
  garde vire au rouge sur « Échap ne passe pas par guardedClose : la saisie est perdue ».
- **Le piège se déplace, dans les DEUX sens.** À l'ouverture d'un frère le focus entre chez lui et
  y reste ; à sa fermeture, `EventModal` le rattrape. Ne vérifier que l'aller laisserait passer une
  modale parente définitivement inerte derrière son enfant refermé — un écran qu'on voit et où le
  clavier ne fait plus rien.
  🔎 **Témoin** : en neutralisant `isTopmost` (la fonction rend `true` quel que soit l'appelant),
  Échap traverse et ferme les **deux** surfaces d'un coup ; la garde échoue sur « fermer la modale
  enfant ne doit pas fermer le parent ».
- ⚠️ **Les surfaces sont désignées par leur NOM ACCESSIBLE**, jamais par
  `div.fixed.inset-0 … .last()`. Avec deux overlays empilés, « le dernier » désigne tantôt le
  parent, tantôt l'enfant : l'assertion changerait de cible en cours de test sans jamais échouer.
  Ce choix fait au passage de `aria-label` une chose testée, pas seulement posée.
- ⚠️ **Un rôle EXPLICITE écrase le rôle implicite.** La puce « Personnaliser » de la récurrence est
  un `<button role="radio">` : cherchée comme un bouton, elle est introuvable, et le test **expire**
  au lieu d'échouer sur ce qu'il mesure. Un timeout n'est pas un résultat.

- 🔴 **Un gestionnaire de modale ne peut pas dépendre de l'endroit où se trouve le focus.**
  `HabitModal` avait déjà un Échap : un `onKeyDown` React posé sur l'overlay, donc suspendu à la
  remontée d'un évènement depuis l'élément focalisé. Focus sorti, Échap mort — c'est-à-dire
  inopérant exactement dans le cas qu'il existait pour rattraper. L'écouteur vit désormais sur
  `document`, en **capture**, ce qui le protège aussi des champs qui appellent `stopPropagation`
  sur leurs touches (les champs de date natifs le font).
- 🔴 **Une pile, parce que les modales s'empilent réellement.** `EventModal` rend
  `ConfirmDiscardDialog`, `ColorSettingsModal` et `RecurrenceDaysModal` en **frères** de son
  overlay, pas dedans : sans pile, le piège du parent leur reprendrait le focus. Seule la dernière
  surface empilée réagit à Échap et au Tab.
- ❌ **`aria-modal` n'est pas décoratif ici.** Il manquait partout, y compris sur le témoin Radix —
  acceptable pour Radix, qui neutralise les frères par `aria-hidden`, et pas pour une modale
  maison, qui ne fait ni l'un ni l'autre.
- ⚠️ **`focusReturned` est mesuré et imprimé, jamais assertionné** : le témoin Radix lui-même le
  rend `false`. Un détecteur que la bibliothèque de référence ne passe pas mesure le détecteur,
  pas la modale.
- ⚠️ **Le hook existe, 53 surfaces y passent, et un cliquet le tient** (2026-09-08). Ce n'était
  pas le cas pendant les trois premières passes : le câblage s'est fait par vagues, et la liste des
  surfaces restantes vivait dans un fichier Markdown. Elle vit maintenant dans un test. **Câblé
  n'est toujours pas mesuré** : 10 surfaces sont mesurées au clavier, 43 sont câblées et gardées.

### C-54 tranché le 2026-09-04 · le bouton « Nouveau » EST le chemin clavier de l'agenda

**Décision rendue, pas différée.** Les cellules de jour de FullCalendar restent hors du parcours de
tabulation, et le motif grille ARIA n'est **pas** adopté. Créer un événement au clavier passe par le
bouton « Nouveau », qui ouvre la saisie pré-remplie sur le prochain créneau libre. Ce qui a été
corrigé dans la même passe, c'est le coût du trajet : deux liens d'évitement, qui manquaient.

**Pourquoi ce sens.** Adopter le motif grille n'est pas un réglage, c'est un composant : gérer
`tabindex` roving sur 7 colonnes × N créneaux, câbler les huit flèches, `Home` / `Fin` / `PagePrec` /
`PageSuiv`, annoncer la cellule active, et refaire le tout à chaque changement de vue (jour, semaine,
mois) et à chaque zoom, les cinq crans de `slotDuration` compris. Le geste équivalent existe déjà,
il est atteignable, et il ouvre un formulaire où le jour et l'heure se saisissent explicitement.
L'écart réel entre les deux chemins est un confort, pas un accès.

**Ce qui a changé** (`src/components/SkipLink.tsx`) :

- un lien d'évitement **global**, premier arrêt de tabulation de `Layout`, qui pose le focus sur le
  `<main>` et saute la barre latérale entière : logo, thème, recherche, dix entrées de navigation,
  état de synchronisation, signalement de bug ;
- un **second** lien, propre à `/agenda`, qui saute le panneau des tâches, ses filtres et ses onze
  boutons « Options de la tâche » tous nommés pareil. Il n'est monté que lorsque ce panneau est
  ouvert, et sur desktop seulement : sur mobile le panneau est un calque, il ne s'interpose pas dans
  l'ordre de tabulation quand il est fermé.

**Mesuré après correctif** (2026-09-04, Chromium desktop, jeu de démo, `e2e/a11y-keyboard-audit.spec.ts`) :

| Trajet | Tabulations |
|---|---|
| Haut de page → `<main>` | 1, puis Entrée |
| `<main>` → conteneur du calendrier | 1, puis Entrée |
| Conteneur du calendrier → premier événement | 1 |
| Bouton « Nouveau » → modale de saisie | ~~4~~ → **0** (remesuré le 2026-09-08) |
| Bouton « Nouveau » → premier champ d'heure | ~~7~~ → **3** (remesuré le 2026-09-08) |

⚠️ **Le « 38 tabulations » du 2026-09-03 était compté trop bas.** La marche partait de
`body.press('Tab')` alors que le focus se trouvait encore sur le lien « Agenda » de la barre
latérale, cliqué par la fixture : Chromium garde ce lien comme point de départ de la navigation
séquentielle, et la mesure repartait donc du MILIEU de la navigation. Le chiffre sous-estimait le
trajet réel depuis le haut de page. Un `blur()` ne corrige rien, le point de départ lui survit :
les mesures ci-dessus repartent d'un **rechargement**.

**Ce que la décision NE règle pas, et qu'il ne faut pas laisser croire réglé :**

- ✅ **RÉGLÉ DEPUIS, et ce paragraphe disait le contraire.** Il affirmait que le focus n'entre pas
  dans la modale de saisie et qu'Échap ne la ferme pas — vrai le 2026-09-04, faux depuis que
  `EventModal` est câblée sur `useModalA11y`. Remesuré le 2026-09-08 : le focus **entre** à
  l'ouverture, Échap **ferme** (via `guardedClose`), et le trajet jusqu'au premier champ d'heure
  tombe de 7 tabulations à **3**, toutes DANS la modale. Les deux lignes du tableau ci-dessus
  portent leur ancienne valeur barrée : un « avant » se relit à sa source, il ne se recopie pas.
- Une `<table>` de FullCalendar porte `role="grid"` sans aucun descendant focalisable géré, donc
  annonce un motif d'interaction qu'elle n'implémente pas. Le rôle vient de la bibliothèque, sur un
  arbre qu'elle re-rend à chaque changement de vue : le réécrire demanderait de repasser derrière
  chaque rendu. **Arbitrage assumé, pas oubli** : on ne patche pas le rôle, on ne prétend pas non
  plus que le motif grille est implémenté. Si un audit lecteur d'écran montre que l'annonce
  « tableau de N lignes » égare réellement, la réponse sera d'adopter le motif, pas de maquiller le
  rôle.
- Rien de tout ceci n'a été entendu dans un lecteur d'écran. Ce qui est prouvé, c'est le déplacement
  du FOCUS (cf. le § « Ce que nos mesures prouvent » en tête de ce document).

**Gardes** : deux tests assertionnés dans `e2e/a11y-keyboard-audit.spec.ts`, **vus rouges avant
d'être verts** (la première assertion tombait sur « OKR », ce qui a précisément révélé le biais de
mesure ci-dessus). Le premier vérifie que
chaque lien d'évitement **déplace `document.activeElement`** vers sa cible, jamais qu'il fait
défiler : un lien dont la cible a perdu son `tabIndex={-1}` fait défiler sans déplacer le focus,
c'est le mode d'échec silencieux du lien d'évitement. Le second remonte l'ordre de tabulation depuis
le calendrier jusqu'au bouton « Nouveau », l'active à la touche Entrée, et redescend jusqu'à un champ
d'heure : c'est la décision elle-même qui est gardée, pas seulement le lien.

### Gate axe-core · le chiffre qui manquait

Dix routes scannées le 2026-09-03 : **zéro `critical`**, et **trois** violations `serious`
distinctes une fois dédoublonnées, toutes de contraste, portées par **deux tokens** —
`--color-error` (`#ef4444`, 3,76:1 sur blanc) et `--color-accent-solid` (`#2563eb`, 4,31:1 sur son
fond teinté), toutes dans le bandeau d'échéances. Passer la gate à `serious` est donc **bon marché
mais pas gratuit** : `red-600` (`#dc2626`, 4,83:1) suffit pour les deux premières, la troisième est
le même arbitrage que le bleu de marque.

## Findings résiduels de l'audit du 2026-05-29

L'audit d'origine listait A-1 → A-11. Vérifié dans le code le **2026-08-14** :

| ID | Sujet | État réel |
|---|---|---|
| A-1 → A-6 | Critical (aria-label, labels, `<main>`, `<th>` vides…) | ✅ Corrigés — codifiés en règles ci-dessous |
| A-7 | `text-blue-100` sur `bg-blue-600` (4.23:1) | ✅ Corrigé — plus aucune occurrence dans `src/` |
| A-8 | Pills OKR `text-*-600 / bg-*-100` sous 4.5:1 | ✅ **Tranché le 2026-08-24** : la cause n'était pas les pills mais le token `--color-text-muted` ; 27 → 4 violations. Résiduel : le bleu de marque à 3,34 (arbitrage produit, cf. plus haut) |
| A-9 | `page-has-heading-one` (h1 animé en `opacity:0`) | ✅ Caduc — plus aucun `motion.h1` dans `src/pages/` |
| A-10 | `CookieBanner` hors landmark | ✅ Corrigé — `motion.aside` + `aria-label` |
| A-11 | `heading-order` OKR (`h3` après `h1`) | ✅ **Caduc, mesuré le 2026-08-24** · aucun saut de niveau > 1 sur `/okr` |

**Il ne reste donc aucun finding « non prouvé » : les deux qui traînaient depuis mai ont été
mesurés, pas estimés.** C'est la leçon de méthode de cette série : un finding qu'on n'a jamais
mesuré n'est ni vrai ni faux, il est **inutilisable** : A-8 s'est révélé cinq fois plus large que
son intitulé, A-11 purement caduc, et les deux avaient survécu trois mois côte à côte.

**Cibles tactiles, corrigées le 2026-08-24, remesurées le 2026-08-25** : `/tasks` 18 → **5**,
`/entreprise` 22 → **8**. Les restantes sont soit des liens inline dans une phrase (exemptés), soit
des cibles de 24 à 32 px **conformes AA** (WCAG 2.5.8 exige 24×24, pas 44, cf. le rappel de seuil
plus haut). Détail : [`UI-PATTERNS.md`](./UI-PATTERNS.md) §Dette UI/UX ouverte.

Reste ouvert par ailleurs : **VoiceOver iOS sur un vrai appareil**, le seul des quatre audits que
le 2026-09-03 n'a pas passé — il ne se simule pas. Les trois autres (`/agenda`, modales, parcours
clavier) sont couverts par la section « A-3 » ci-dessus, avec leurs findings ouverts.
**Sa check-list est prête depuis le 2026-09-04** et se joue d'une traite, témoin compris :
[`AUDIT-VOICEOVER-IOS.md`](./AUDIT-VOICEOVER-IOS.md). Ce qui manque n'est plus le protocole, c'est
l'appareil et l'heure.
Objectif de durcissement : la gate peut passer de `critical` à `serious` **au prix de deux tokens**,
chiffrés ci-dessus — et non « gratuitement », comme cette page l'a écrit du 2026-08-24 au 2026-09-03
sans jamais compter les violations concernées.

## Règles

- ✅ **Touch targets ≥ 44×44 px** (WCAG 2.5.5) — `min-w-11 min-h-11` ou wrapper l'icône.
- ✅ **`aria-label` obligatoire** sur tout `<button>` qui ne contient qu'une icône — `title=` est ignoré par les lecteurs d'écran sur mobile. Ajouter `aria-hidden="true"` sur l'icône lucide enfant. (Faille A-1.)
- ✅ **`<input>` doit avoir un label associé** : `<label htmlFor>` + `id`, `aria-label`, ou `aria-labelledby`. Sur formulaires dynamiques — `aria-label={"Avancement de <X> sur <Y>"}`. (Faille A-2.)
- ✅ **Checkbox custom** stylé en `<button>` : `role="checkbox"` + `aria-checked={state}` + `aria-label` dynamique. Exemples : TodayTasks, HabitTable DayButtons.
- ✅ **`focus-visible:`** sur tous les boutons custom — navigation clavier (iPad + clavier physique).
- ✅ **`aria-pressed`** sur les toggles (favoris, terminées, sélections).
- ✅ **`<main>` landmark obligatoire** sur toute page racine (LandingPage, LoginPage, SignupPage…). Layout protégé contient déjà `<main>`. (Faille A-5 — sans `<main>`, axe flag jusqu'à 162 nodes "not contained by landmarks".)
- ✅ **`<th>` vides** (colonnes d'icônes) : ajouter `<span className="sr-only">Label</span>`. (Faille A-6.)
- ✅ **Liens dans un paragraphe** : `underline underline-offset-2` toujours visible — pas seulement `hover:underline` (WCAG 1.4.1).
- ✅ **Contraste texte ≥ 4.5:1** sur fond clair (3:1 pour large 18pt+ / 14pt bold). `text-green-600` (3.29:1) → `text-green-700` (4.78:1). `text-blue-100` sur bleu 600 (4.23:1) → `text-white`. Vérifier via axe-core.
- ✅ Préférer `<button>` à `<div onClick>`.
- ❌ **Pas de changement de contenu sans annonce** — `role="status"` ou `aria-live="polite"`.
- ❌ **Pas de couleur seule pour transmettre l'information** — toujours doubler avec une icône, du texte, ou un état.
- ❌ **Pas de `motion.h1 initial={{opacity:0}}`** sans aussi laisser un h1 statique présent — axe flag `page-has-heading-one`.
- ✅ **Un texte découpé en fragments visuels doit avoir un nom accessible ENTIER** (2026-08-27, D4/D5) : mettre la phrase complète en `sr-only`, passer les fragments en `aria-hidden`, et pour une date ajouter un `<time dateTime>`. Sans ça, « 27 » + « août » empilés se lisent « 27août », et un espacement obtenu par `ml-2` n'existe pas pour un lecteur d'écran.
- ✅ **Une prop d'accessibilité recopiée d'un exemple se vérifie CONTRE LA VERSION INSTALLéE**
  (2026-09-03, C-51). `initialFocus` de `react-day-picker` survit dans les types, marqué déprécié,
  et n'est plus lu par personne : la prop était écrite, le focus n'allait nulle part. Même classe
  que le `Button` non `forwardRef` du 2026-08-30. **Une prop qui ne fait rien ne prévient pas.**
- ✅ **Une bibliothèque traduit ses DATES, pas ses libellés ARIA** (2026-09-03, C-52). Passer
  `locale` à `react-day-picker` laisse « Go to the Previous Month » intact. Ces chaînes vivent dans
  `node_modules` : `i18n:scan` ne peut pas les voir, et ne le pourra jamais.
- ✅ **Tout bloc répété avant le contenu se saute** (2026-09-04, C-54, WCAG 2.4.1). Un lien
  d'évitement se pose avec `SkipLink`, et sa cible porte `tabIndex={-1}` : sans lui, `href="#x"`
  fait DÉFILER sans déplacer le focus, et la garde paraît verte pendant que le clavier reste
  coincé. Un second lien se justifie quand une page interpose son propre bloc, comme le panneau
  des tâches de `/agenda` et ses onze boutons homonymes.
- ✅ **Une pastille purement visuelle qui porte une information est `role="img"` + `aria-label`** (2026-08-27, E2). `title=` seul ne se voit ni au clavier ni au toucher, et ne remplace pas un nom accessible.

## Ne jamais faire — Accessibilité

- ❌ Créer un `<button>` icon-only sans `aria-label` (A-1, critical).
- ❌ Créer un `<input>` sans label associé (A-2, critical).
- ❌ Page racine publique sans `<main>` landmark (A-5).
- ❌ `<th>` vide pour une colonne d'icône — ajouter `<span className="sr-only">Label</span>` (A-6).
- ❌ Lien dans un paragraphe distingué uniquement par couleur (A-4 / WCAG 1.4.1).
- ❌ `text-green-600`, `text-blue-100` sur fond clair sans vérifier le contraste 4.5:1.
- ❌ Faire annoncer une checkbox custom comme « bouton » — utiliser `role="checkbox" aria-checked`.
- ❌ Annoncer un motif d'interaction qu'on n'implémente pas (`role="grid"` sans descendant
  focalisable géré, `role="dialog"` sans piège de focus). Un rôle est une PROMESSE de clavier.
