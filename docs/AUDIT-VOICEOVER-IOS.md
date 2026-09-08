# Audit VoiceOver iOS · check-list à jouer d'une traite

**Statut : à jouer. Rien dans ce fichier n'est coché.** C'est le **quatrième** des audits
d'accessibilité listés par `C-24` (`a-faire-code.md`), et le seul que le 2026-09-03 n'a pas passé.
Les trois autres (parcours clavier, modales, `/agenda`) l'ont été, sur **Chromium desktop**, avec le
harnais `e2e/a11y-keyboard-audit.spec.ts`.

🔴 **Il ne se simule pas, et il ne se déduit pas.** Playwright interroge le DOM et
`document.activeElement` : ce qui est prouvé aujourd'hui, c'est le **FOCUS**, jamais l'**ANNONCE**.
La limite complète est écrite dans [`ACCESSIBILITY.md`](./ACCESSIBILITY.md) § « Ce que nos mesures
prouvent, et ce qu'elles ne prouvent pas ». Cette page existe pour qu'une seule séance sur un
iPhone réel la referme.

> **Révision du 2026-09-08.** La version du 2026-09-04 (commit `7008bc6`) précédait le câblage
> C-53. Depuis, **53 surfaces modales maison** passent par `useModalA11y`, chacune avec un **nom
> accessible connu**, et 8 autres sont déclarées non modales avec leur motif
> (`src/components/modal-a11y.guard.test.ts`). La check-list a été reprise sur ce périmètre :
> chaque surface atteignable sur iPhone a désormais sa ligne, avec le nom qu'elle **doit** dire.
> Ce qui n'est pas atteignable sur iPhone est **nommé et motivé** en annexe B, pour qu'un écran non
> joué ne se confonde jamais avec un écran conforme. La page `/tasks` a été redessinée dans la même
> fenêtre (chips de listes, carte à balayage, feuille d'actions) : sa section a été refaite sur les
> gestes d'aujourd'hui.
>
> ⚠️ **Le câblage ne rend pas cet audit inutile, il le rend mesurable.** `useModalA11y` pose le
> piège de focus, la restitution du focus et `aria-modal` : ce sont des propriétés du DOM,
> vérifiées au clavier sur 10 surfaces et tenues par un cliquet sur les 43 autres. Ce que VoiceOver
> en fait reste **entièrement non mesuré**.

- **Durée** : environ 90 minutes, préparation comprise (60 pour les sections 1 à 12, 30 de plus si
  tu joues l'annexe A en entier).
- **Où** : `https://thecosmo.app`, **en mode démo**. Aucune donnée réelle n'est touchée, et les
  seeds garantissent qu'il y a quelque chose à lire sur chaque écran.
- **Ce que ça produit** : des findings `V-xx`, qui rejoignent `a-faire-code.md` comme les autres.
  Pas de correctif pendant la séance : on mesure, on note, on corrige après.

---

## 0. Préparation (5 min)

1. **Un iPhone réel.** Le simulateur Xcode ne compte pas : son VoiceOver n'est pas le même et les
   gestes n'existent pas. C'est la même règle que M-25 dans `a-faire-manuel.md`.
2. **Noter en tête du compte-rendu** : modèle, version d'iOS, version de Safari
   (Réglages › Général › Informations). Sans ces trois lignes, un finding n'est pas reproductible.
3. **Raccourci d'accessibilité** : Réglages › Accessibilité › Raccourci d'accessibilité ›
   VoiceOver. Un triple-clic sur le bouton latéral l'allume et l'éteint. Indispensable : sans lui,
   sortir de VoiceOver au milieu de l'audit est pénible.
4. **Débit de parole vers 40 %** (Réglages › Accessibilité › VoiceOver › Débit). À vitesse par
   défaut on entend une bouillie, et on note ce qu'on croit avoir entendu.
5. **Safari, portrait, thème clair, aucun zoom d'affichage** pour la première passe. Les variantes
   se jouent à l'étape 12.
6. **Le dictaphone en marche.** C'est le seul moyen fiable de garder l'annonce **verbatim** :
   reformuler ce que VoiceOver a dit, c'est perdre le défaut.
7. **iPhone en français** pour la passe principale. Une passe en anglais est prévue à l'étape 12 :
   cinq noms de surfaces sont écrits **en dur en français** dans le code, et c'est là qu'ils
   s'entendront (annexe A, lignes marquées 🇫🇷).

## Les gestes qui suffisent

| Geste | Ce qu'il fait |
|---|---|
| balayage droite / gauche (1 doigt) | élément suivant / précédent dans l'ordre de lecture |
| double tap | activer l'élément sous le curseur VoiceOver |
| **double tap maintenu** | équivalent d'un **appui long**. Le seul moyen d'atteindre un menu d'appui long sous VoiceOver, cf. 4.8 |
| toucher-déplacer | explorer par la **position** à l'écran (révèle l'ordre visuel réel) |
| balayage 2 doigts vers le haut | lire toute la page depuis le haut |
| balayage 3 doigts | faire défiler |
| rotor (2 doigts, rotation) puis balayage haut/bas | parcourir par **titres**, **liens**, **contrôles**, **champs de formulaire** |
| « Z » à 2 doigts (scrub) | revenir en arrière, fermer une couche |

## 🧪 Le témoin · à jouer en PREMIER, sinon rien ne compte

Le harnais clavier embarque un témoin ; cette check-list en a un aussi, pour la même raison : une
mesure dont on ne sait pas si l'instrument fonctionnait ne vaut rien.

Sur `https://thecosmo.app`, balayer jusqu'au bouton principal du hero.

- **Attendu, verbatim** : « **Essayer la démo sans inscription, bouton** ». Ce nom accessible vient
  de `landing:hero.demoAria` et **diffère volontairement du texte visible**, qui est « Essayer la
  démo gratuite » (`landing:hero.demoCta`).
- ✅ Tu entends « sans inscription » : VoiceOver lit bien l'arbre d'accessibilité, l'audit peut
  commencer.
- ❌ Tu entends « gratuite » : soit le nom accessible n'est pas appliqué, soit la verbosité a été
  modifiée. **Arrêter là.** Aucune ligne de la suite ne serait interprétable.

## Les 4 détecteurs d'une surface modale

Toutes les lignes de modale de cette check-list posent les **mêmes quatre questions**, dans cet
ordre. C'est le pendant VoiceOver des cinq détecteurs du harnais clavier.

| # | Question | Attendu |
|---|---|---|
| **M1** | à l'ouverture, qu'est-ce qui est annoncé ? | le **nom** de la surface (colonne « nom attendu » de l'annexe A), suivi de « boîte de dialogue » |
| **M2** | le curseur entre-t-il dedans ? | oui, sur un élément **de la surface**, jamais sur la page dessous |
| **M3** | balayer à droite **en boucle**, une dizaine de fois | on **ne ressort jamais** sur la page dessous. Un seul élément de l'arrière-plan annoncé est un ❌ |
| **M4** | « Z » à 2 doigts | la surface se ferme **et** le curseur revient sur le contrôle qui l'a ouverte |

⚠️ **M4 a une exception assumée, et trois surfaces la portent.** `ReassignManagerSheet`,
`TeamTaskModal` et `BugReportModal` refusent de se fermer pendant une opération en cours
(`pending` / `sending`) : le « Z » ne doit **rien** faire tant que l'opération tourne, exactement
comme la croix et le voile. Un « Z » qui ferme là où le clic ne peut pas est un ❌, pas un ✅.

⚠️ **Trois autres portent une fermeture À ÉTAGES.** Le premier « Z » annule un sous-état, le second
ferme. C'est voulu, et l'inverse perdrait une saisie sans le dire : `BulkAddToListModal` (annule
d'abord le sous-formulaire de création), `MobileAddToList` (même escalade), `OKRDeadlineReviewModal`
(ne se ferme qu'en phase d'édition). `AgendaSlotReviewModal` est encore à part : son « Z »
**reporte** le créneau, il ne l'annule pas.

## Comment consigner

Gabarit de finding, à recopier tel quel :

```
[V-01] /tasks · balayage droite depuis le titre de la liste
Entendu : « bouton »
Attendu : « Marquer Faire les courses comme faite, case à cocher, non cochée »
Appareil : iPhone 13, iOS 18.5, Safari 18.5
```

- **Écrire l'ENTENDU avant l'attendu.** Dans l'autre sens, on écrit ce qu'on espérait.
- Statuts : ✅ conforme · ❌ défaut · ⚠️ douteux · **⬜ non atteint**. Un ⚠️ non rejoué compte comme
  non mesuré, jamais comme conforme. Un ⬜ se justifie en une ligne.
- Un écran non atteint se note « non atteint », pas « rien à signaler ».

---

## 1. Landing `/` · 5 min · page publique, donc EAA sans réserve

| # | Geste | Attendu | Piège connu |
|---|---|---|---|
| 1.1 | rotor › Titres, balayer vers le bas | un seul `h1`, puis des niveaux qui descendent d'un cran à la fois | `heading-order` a été mesuré caduc sur `/okr`, jamais sur la landing |
| 1.2 | lire depuis le haut (2 doigts) | rien de décoratif n'est lu : illustrations et icônes sont muettes | une icône lucide sans `aria-hidden` se lit « image » |
| 1.3 | atteindre l'aiguillage perso / entreprise | deux liens distincts, compréhensibles hors contexte, et le parcours choisi dit « sélectionné » | c'est la structure de la page, cf. `CLAUDE.md` § Landing |
| 1.4 | atteindre la grille de tarifs | le montant est lu **avec** son unité et sa période, et un prix barré est annoncé comme barré | l'offre de lancement affiche « Gratuit » et garde l'ancien prix barré : lu sans le mot « barré », ce sont deux prix contradictoires |
| 1.5 | bandeau cookies, s'il apparaît | annoncé, atteignable au balayage, ses deux choix distincts | `CookieBanner` est un `aside` avec `aria-label` |
| 1.6 | atteindre les liens du pied de page (CGU, confidentialité, mentions légales) | chacun est un lien, et il **ouvre bien sa page** | ces liens tombaient sur une 404 en anglais avant le 2026-09-02 : à rejouer en anglais à l'étape 12 |
| 1.7 | hero du parcours **entreprise** (`/entreprise-presentation`) | le canvas de rayons est **muet** et n'est pas atteignable au balayage | il peint le viewport entier ; atteignable, il serait annoncé « image » au milieu du titre |

## 2. Entrée en démo et changement de route · 5 min

| # | Geste | Attendu | Piège connu |
|---|---|---|---|
| 2.1 | double tap sur « Essayer la démo » | l'application s'ouvre sur `/dashboard` | |
| 2.2 | juste après l'ouverture | **quelque chose est annoncé** : titre de page, ou premier élément du nouvel écran | 🔴 la classe de défaut la plus probable de tout cet audit : dans une SPA, changer d'URL n'annonce **rien** par défaut, et le curseur VoiceOver peut rester sur l'écran précédent |
| 2.3 | naviguer `/dashboard` → `/tasks` → `/habits` par la barre d'onglets | même question à chaque fois, et le curseur ne retombe pas tout en haut du document à chaque route | |
| 2.4 | si l'accueil de premier lancement s'ouvre | `FirstRunSetup` : M1 « **Bienvenue dans COSMO** », puis M2, M3, M4 | il ne s'ouvre que sur un compte **vide** (`taskCount === 0`) et une seule fois par appareil. En démo, les seeds le remplissent : si tu ne l'atteins pas, note ⬜, ne cherche pas à le forcer |

## 3. Navigation mobile · barre d'onglets et feuille « Plus » · 5 min

| # | Geste | Attendu | Piège connu |
|---|---|---|---|
| 3.1 | atteindre la barre d'onglets | annoncée « **Navigation mobile** », et l'onglet courant dit « page active » ou « sélectionné » | `aria-current="page"` n'est écrit nulle part dans notre JSX ici : il vient du `NavLink` de React Router, qui le pose par défaut sur le lien actif. Vérifié dans le code le 2026-09-08, jamais entendu |
| 3.2 | atteindre un badge | le nombre **avec son sens** : « 3 demandes en attente », « 2 notifications entreprise », « 5 tâches pour aujourd'hui ». Jamais « 3 » seul | les trois libellés existent (`common:nav.badge.*`, formes de pluriel comprises) ; la question est leur audibilité |
| 3.3 | ouvrir « Plus » | M1 « **Plus d'options** », puis M2 | `MobileMoreSheet` est le **seul** accès mobile à OKR, Statistiques, Réglages et à la déconnexion |
| 3.4 | balayer à droite en boucle dans la feuille | M3 : on ne ressort pas sur la page dessous | l'une des rares surfaces déjà mesurées au clavier en viewport 375 × 812 |
| 3.5 | « Z » à 2 doigts | M4 : elle se ferme, le curseur revient sur « Plus d'options » | |
| 3.6 | dans la feuille, atteindre l'entrée de la page où l'on se trouve | elle dit « page active » | `aria-current="page"` est posé à la main ici |

## 4. `/tasks` · 15 min · l'écran le plus retouché depuis la version précédente de cette page

🔴 **Section refaite le 2026-09-08.** La liste mobile a été redessinée entre-temps : les gestes
ci-dessous sont ceux du produit d'aujourd'hui, pas ceux du 2026-09-04.

| # | Geste | Attendu | Piège connu |
|---|---|---|---|
| 4.1 | atteindre une ligne de tâche | « case à cocher, non cochée », **avec le nom de la tâche** | `role="checkbox"` + `aria-checked` sont posés (`task-table/list.tsx`, `TodayTasks`) : ne jamais entendre « bouton » |
| 4.2 | double tap dessus | le **nouvel état** est annoncé (« cochée ») sans qu'il faille rebalayer | |
| 4.3 | juste après | le toast de confirmation est-il lu ? et **sans voler le curseur** ? | Sonner porte sa propre région live ; un toast qui déplace le curseur casse le parcours |
| 4.4 | atteindre le titre d'une tâche | annoncé comme un contrôle activable, pas comme du texte inerte | |
| 4.5 | atteindre le bouton « ⋯ » d'une carte | « **Actions pour \<nom de la tâche\>**, bouton » | c'est l'affordance **permanente**, celle qui existe pour que le balayage de carte ne soit pas le seul chemin. Inatteignable, tout le menu d'actions est perdu pour VoiceOver |
| 4.6 | double tap dessus | `TaskActionsSheet` : M1 « **Actions pour \<nom\>** », puis M2, M3, M4 | |
| 4.7 | dans la feuille, « Ajouter à une liste » | `MobileAddToList` : M1 annonce « **Listes** » | ⚠️ son nom accessible pointe sur un paragraphe qui ne contient que le mot « Listes », en dur. Un nom d'une syllabe pour une surface qui recouvre l'écran : à consigner tel quel |
| 4.8 | 🔴 **appui long sur une chip de liste** (double tap **maintenu**) | `ListActionsSheet` : M1 « **Actions pour la liste \<nom\>** » | 🔴 **le point le plus exposé de l'écran.** Sur mobile, renommer / partager / supprimer / épingler / recolorer une liste n'a **aucun autre chemin** : les boutons flottants sont conditionnés à `!isMobile`, et le menu contextuel natif est neutralisé. Si le double tap maintenu n'ouvre pas la feuille, ces actions sont **inatteignables** sous VoiceOver, et c'est un finding WCAG 2.5.1 |
| 4.9 | bouton « Nouvelle liste » de la barre de chips | `CreateListSheet` : M1 « **Nouvelle liste** », puis M2 à M4 | |
| 4.10 | partager une liste **manuelle** | `ShareListSheet` : M1 « **Partager la liste \<nom\>** » | le jeu de démo ne contient **que des listes intelligentes**, et « Partager » n'est monté que pour les autres : en créer une à la main d'abord, sinon le déclencheur n'existe pas. C'est exactement ce qui aurait fait expirer la garde clavier |
| 4.11 | supprimer une tâche depuis la feuille d'actions | `ConfirmDeleteSheet` : le **titre passé en prop** est le nom annoncé, et la conséquence est lue **avant** les boutons | une confirmation dont on n'entend que « Supprimer / Annuler » ne dit pas ce qu'on supprime |
| 4.12 | ouvrir la fiche d'une tâche | le curseur entre dans la modale, son titre est annoncé, le fond n'est plus atteignable | `TaskModal` est une surface **Radix** : son piège vient de la bibliothèque, pas de `useModalA11y`. C'est le point de comparaison de la séance, cf. § 11 |
| 4.13 | dans la fiche, le bouton de suppression | `DeleteTaskConfirm` : « **Supprimer la tâche** » si on est propriétaire, « **Quitter la tâche partagée** » sinon | deux noms pour le même bouton : c'est voulu, et ça doit s'entendre |
| 4.14 | dans la fiche mobile, une sous-tâche | « case à cocher », avec son libellé | `SubtaskChecklist` porte `role="checkbox"` |
| 4.15 | une tâche **en retard** | l'état « en retard » est annoncé, pas seulement montré en rouge | une couleur n'est pas une information pour un lecteur d'écran |
| 4.16 | sélection multiple, puis « Ajouter à une liste » | `BulkAddToListModal` : M1 « **Ajouter à une liste** ». ⚠️ fermeture à étages | si la sélection multiple n'est pas atteignable au doigt, le noter ⬜ et passer |

## 5. Le calendrier COSMO · 10 min · le composant le plus jeune du produit

Il a remplacé le sélecteur natif du navigateur et n'a **jamais** été entendu par un lecteur d'écran.
Onze fichiers le montent aujourd'hui
(`grep -rl "DatePicker\|DateCalendarPanel" src --include=*.tsx`), dont plusieurs sont hors d'atteinte
sur téléphone. Trois chemins suffisent, et ce sont trois **façons d'ouvrir** différentes :

1. depuis un **champ** : échéance dans la fiche de tâche ;
2. depuis un **menu** : report d'échéance d'une tâche en retard (`OverdueQuickActions`, dans la
   carte mobile). C'est la classe que les sondes clavier n'avaient jamais atteinte (C-55) ;
3. depuis une **fiche d'objectif** : `/okr`, échéance d'un OKR.

| # | Geste | Attendu | Piège connu |
|---|---|---|---|
| 5.1 | ouvrir le calendrier | le curseur entre dedans, et le **mois affiché est annoncé** | C-51 : le mois affiché était le mois courant, pas celui du champ |
| 5.2 | balayer dans la grille | chaque jour est annoncé avec sa date **complète et en français** | 🔴 C-52 : `react-day-picker` traduit ses dates, **pas** ses libellés ARIA. « Go to the Previous Month » a été corrigé, rien ne garantit qu'il n'en reste pas |
| 5.3 | atteindre le jour sélectionné | il dit « sélectionné » | |
| 5.4 | atteindre les flèches de mois et les presets | libellés en français, et rôle de bouton | |
| 5.5 | choisir un jour | le champ annonce la nouvelle valeur | |
| 5.6 | rouvrir depuis un **menu** (chemin 2) | même comportement, et **aucun jour passé n'est proposé** | C-55 ; et sans `minDate`, un report d'échéance permet de reporter vers hier |
| 5.7 | les deux champs de date d'`EventModal` | ce sont des `input[type=date]` **natifs** : c'est la roue iOS qui parle | arbitrage assumé, sur mobile la roue système vaut mieux qu'un calendrier maison. Noter ✅ « natif », pas ❌ |

## 6. `/agenda` · 10 min · le point le plus faible connu

| # | Geste | Attendu | Piège connu |
|---|---|---|---|
| 6.1 | explorer la grille au toucher-déplacer | jours et événements lisibles, avec heure et titre | C-54 : **0 cellule de jour focalisable sur 8** au clavier |
| 6.2 | balayage droite depuis le haut | **compter les balayages** avant d'atteindre le premier événement, et le noter | c'est l'équivalent VoiceOver des 38 tabulations de C-54 |
| 6.3 | changer de mois | l'action est atteignable et le nouveau mois est annoncé | |
| 6.4 | ouvrir un événement | `EventModal` : M1 annonce son titre d'en-tête, puis M2, M3 | C-53 : au clavier, le focus **restait derrière**, et Échap ne fermait pas |
| 6.5 | modifier le titre, puis « Z » | 🔴 la modale **ne se ferme pas** : `ConfirmDiscardDialog` s'ouvre par-dessus, « **Abandonner les modifications ?** », et la saisie est **intacte** si on refuse | c'est la garde mesurée au clavier le 2026-09-08 : un « Z » qui ferme directement jette une saisie que le même geste à la souris protège |
| 6.6 | dans `EventModal`, « Créer une catégorie » | `ColorSettingsModal` s'ouvre **par-dessus** : M1 « **Modifier les catégories** », et M3 piège sur **elle**, pas sur `EventModal` | trois modales sœurs sont rendues dans l'arbre d'`EventModal` : seule la dernière empilée doit réagir |
| 6.7 | dans `EventModal`, récurrence « Personnaliser » | `RecurrenceDaysModal` : M1 « **Répéter les jours** », et chaque jour est une « case à cocher » avec son état | `role="checkbox"` + `aria-checked` y sont posés |
| 6.8 | « Z » dans une des trois sœurs | elle seule se ferme, `EventModal` reste ouverte et **reprend** le piège | |
| 6.9 | créer un événement par appui long sur un créneau | `QuickEventCard` : M1 « **Création rapide d'un événement** » | même remarque qu'en 4.8 : si l'appui long ne passe pas sous VoiceOver, chercher l'autre chemin, et son absence est le finding |
| 6.10 | ouvrir la gestion des événements récurrents | M1 « **Événements récurrents** » | |
| 6.11 | déclencher la conversion d'un événement en tâche | `AgendaEventToTaskConfirm` : M1 « **Que faire de cet événement ?** » | si le déclencheur est un glisser-déposer, il n'a **probablement aucun équivalent VoiceOver** : le noter comme tel |
| 6.12 | fin d'un créneau planifié | `AgendaSlotReviewModal` : M1 « **Créneau terminé** ». ⚠️ le « Z » **reporte** le créneau | fermeture branchée sur `onSnooze` : si le report est silencieux, personne ne sait ce qui vient de se passer |
| 6.13 | le voile du panneau latéral mobile | il n'est **pas** une boîte de dialogue et ne doit pas être annoncé comme telle | déclaré non modal dans la garde, avec son motif |

## 7. `/habits` · 5 min

| # | Geste | Attendu | Piège connu |
|---|---|---|---|
| 7.1 | atteindre une case de jour | « case à cocher », avec **nom de l'habitude et date en toutes lettres** | les libellés existent (`table.dayCell`) ; le risque est une date lue en fragments |
| 7.2 | cocher | le nouvel état est annoncé | |
| 7.3 | atteindre la série | « série de 12 jours », pas « 12 » seul | la valeur affichée vient du serveur, ne jamais la recalculer depuis `completions` |
| 7.4 | balayer une ligne entière | l'ordre de lecture suit la **ligne**, pas la colonne | une grille lue en colonnes est illisible |
| 7.5 | créer une habitude | `HabitModal` : M1 « **Créer l'habitude** » (« **Modifier l'habitude** » en édition), puis M2 à M4 | c'est la surface qui a révélé le défaut de restitution du focus : après « Z », le curseur doit revenir **sur le bouton de création**, pas en haut de page |
| 7.6 | dans `HabitModal`, ouvrir les catégories | `ColorSettingsModal` s'empile : M1 « **Modifier les catégories** », M3 piège sur elle | |

## 8. `/okr` · 8 min

| # | Geste | Attendu | Piège connu |
|---|---|---|---|
| 8.1 | atteindre une barre d'avancement | « Avancement de X sur Y », avec des nombres, pas un pourcentage seul | |
| 8.2 | rotor › Titres | la hiérarchie tient (mesurée caduque à l'œil le 2026-08-24, jamais à l'oreille) | |
| 8.3 | supprimer une catégorie personnelle | `DeleteCategoryDialog` : M1 « **Supprimer « \<nom\> » ?** », et **l'impact est lu** (« n tâches, n objectifs ») **avant** la confirmation | R-02 : réaffecter avant de supprimer suppose d'avoir compris l'impact. Un impact affiché mais non annoncé revient à ne pas l'avoir |
| 8.4 | supprimer un objectif | `DeleteObjectiveConfirm` : M1 « **Supprimer l'objectif** » | |
| 8.5 | ouvrir « OKR terminés » | `CompletedOKRsModal` : M1 « **OKR terminés** » | |
| 8.6 | ouvrir le check-in hebdo | `WeeklyCheckinModal` : M1 « **Check-in hebdo** » | 🇫🇷 ce titre est écrit **en dur en français** dans le JSX : il restera français dans une interface anglaise (étape 12) |
| 8.7 | un OKR dont l'échéance est passée | `OKRDeadlineReviewModal` s'ouvre seul : M1 annonce **le titre de l'objectif**. ⚠️ le « Z » ne ferme **qu'en phase d'édition** | une modale qui s'ouvre toute seule et qu'un geste ne ferme pas est une impasse : mesurer dans quelle phase le « Z » répond, et le noter |
| 8.8 | créer ou éditer un OKR | `OKRModalSheet` est une surface **Radix** : jouer M1 à M4 quand même, comme point de comparaison | cf. § 11 |

## 9. `/entreprise` · 10 min · thème noir, et la zone la moins mesurée du produit

Les correctifs D4, D5 et E2 du 2026-08-27 ont été écrits **sans qu'un lecteur d'écran les
vérifie**. Et **quinze** des 53 surfaces câblées vivent ici.

| # | Geste | Attendu | Piège connu |
|---|---|---|---|
| 9.1 | frise, pastille de date | « 27 août 2026 », en un seul bloc | D4 : elle se lisait « 27août » |
| 9.2 | en-tête « Mes tâches (3) · 1 h 45 » | le séparateur s'entend | D5 : un `ml-2` n'existe pas pour un lecteur d'écran |
| 9.3 | pastille de priorité | elle est annoncée | E2 : elle n'était portée que par `title=`, muet au toucher |
| 9.4 | pyramide managériale | la structure se parcourt, et un membre est annoncé **avec son rôle** | jamais entendue |
| 9.5 | barre d'onglets de l'organisation | l'onglet actif dit « page active » | `aria-current="page"` posé à la main dans `OrgTabsBar` |
| 9.6 | annuaire › fiche d'un membre | `MemberSheet` : M1 « **Fiche de \<nom\>** » | |
| 9.7 | annuaire › « … » › modifier les permissions | `MemberPermissionsSheet` : M1 « **Modifier les permissions de \<nom\>** », et chaque droit est une « case à cocher » avec son état | dix droits plus une portée d'assignation : le formulaire le plus dense du produit |
| 9.8 | annuaire › « … » › réassigner le manager | `ReassignManagerSheet` : M1 « **Réassigner l'équipe de \<nom\>** ». ⚠️ **exception M4** pendant l'opération | |
| 9.9 | pyramide › ajouter sous quelqu'un | `AddUnderSheet` : M1 « **Ajouter sous \<nom\>** » | |
| 9.10 | pyramide › placer un membre | `MemberPlacementSheet` : M1 « **Placer \<nom\>** » | 🇫🇷 nom écrit en dur en français |
| 9.11 | créer une équipe | `CreateTeamModal` : M1 « **Nouvelle équipe** », et chaque pastille de couleur dit son état | `aria-checked` posé sur les couleurs |
| 9.12 | créer un projet d'équipe | `NewTeamProjectModal` : M1 « **Nouveau projet d'équipe** » | |
| 9.13 | ouvrir une tâche d'équipe | `TeamTaskModal` : M1 « **Modifier la tâche \<nom\>** », ou « **Nouvelle tâche d'équipe** ». ⚠️ **exception M4** | |
| 9.14 | assigner une tâche à un membre | `AssignTaskSheet` : M1 « **Attribuer une tâche à \<nom\>** », ou « **Ajouter une tâche non assignée** » | |
| 9.15 | planifier une tâche d'équipe | `AssignEventDialog` : M1 dit « **Assigner l'événement** », puis le nom de la tâche | le séparateur du nom accessible est un tiret cadratin : noter s'il s'entend, se tait, ou coupe la phrase |
| 9.16 | supprimer une catégorie d'OKR d'équipe | `DeleteCategoryConfirm` : M1 « **Supprimer « \<nom\> » ?** », **avec son impact** | corrigé le 2026-09-06 (C-02) : l'impact est annoncé et la réaffectation vient avant. Jamais entendu |
| 9.17 | revue de la semaine | `WeeklyReviewSheet` : M1 « **Revue de la semaine** » | |
| 9.18 | profil de l'entreprise | `OrgProfileSheet` : M1 « **Profil de l'entreprise** » | |
| 9.19 | créer ou rejoindre une entreprise | `InviteOrJoinModal` : M1 « **Créer ou rejoindre une entreprise** » | monté dans `Layout`, donc atteignable depuis toutes les pages protégées |
| 9.20 | supprimer l'organisation | `DeleteOrganizationDialog` : M1 « **Supprimer \<nom\> ?** » | **ne pas confirmer** : on mesure, on ne détruit pas le jeu de démo |
| 9.21 | cloche de notifications | c'est un **popover**, pas une boîte de dialogue : on doit pouvoir en sortir au balayage | déclaré non modal avec son motif ; piéger le focus dedans empêcherait de le fermer |

## 10. Formulaires, erreurs et signalement · 7 min

Se déconnecter (feuille « Plus »), puis `/login`.

| # | Geste | Attendu | Piège connu |
|---|---|---|---|
| 10.1 | atteindre chaque champ | le **libellé** est annoncé, pas « champ de texte » | |
| 10.2 | valider avec un e-mail mal formé | l'erreur est **annoncée toute seule** | `AuthForm` porte une région live ; reste à l'entendre |
| 10.3 | après l'erreur | le curseur n'a pas sauté ailleurs | une région live ne doit pas voler le curseur |
| 10.4 | rotor › Champs de formulaire | tous les champs y sont, dans l'ordre visuel | |
| 10.5 | depuis la landing, ouvrir la connexion en modale | `LoginModal` : M1 « **Connexion ou inscription** » | |
| 10.6 | reconnecté, ouvrir « Signaler un bug » | `BugReportModal` : M1 « **Signaler un bug** ». ⚠️ **exception M4** pendant l'envoi | sinon on perd une saisie sans savoir si le message est parti |

## 11. Cinq questions transverses, à se poser sur chaque écran

- **L'ordre de lecture au balayage suit-il l'ordre visuel ?** Comparer un balayage droite avec un
  toucher-déplacer. C'est la question que le clavier ne pose pas : l'ordre de tabulation ignore tout
  ce qui n'est pas focalisable, l'ordre de lecture non.
- **Quelque chose est-il lu deux fois ?** Un texte à la fois visible et en `sr-only` s'entend en
  double. C'est précisément le risque introduit par les correctifs D4 et D5.
- **Une surface maison se comporte-t-elle comme une surface Radix ?** `TaskModal` (4.12) et
  `OKRModalSheet` (8.8) viennent de la bibliothèque, les 53 autres de `useModalA11y`. Si les deux
  familles ne s'annoncent pas pareil, la différence est le finding.
  ⚠️ Ne pas en conclure que Radix est la référence : au clavier, le témoin Radix lui-même échoue sur
  la restitution du focus. On compare, on ne suppose pas.
- **Une action n'existe-t-elle que par un geste ?** Appui long (4.8, 6.9), balayage de carte (4.5),
  glisser-déposer (6.11). Chacun doit avoir un chemin de rechange atteignable au balayage. Quand il
  n'y en a pas, c'est un finding, même si le geste finit par marcher.
- **Le nom annoncé reste-t-il français quand l'interface est en anglais ?** Cinq surfaces portent un
  nom écrit en dur (annexe A, lignes 🇫🇷). Se garde pour l'étape 12.

## 12. Variantes système · 8 min

À jouer VoiceOver **éteint**, sauf la dernière :

- **Texte plus grand** au maximum (Accessibilité › Affichage et taille du texte) : la mise en page
  tient-elle sur `/dashboard`, `/tasks` et la feuille « Plus » ?
- **Réduire les animations** activé : les feuilles s'ouvrent-elles vraiment ? C'est la classe de
  bug du 2026-08-24, où `MobileMoreSheet` s'ouvrait à **0 px visible**, et le seul chemin mobile
  vers les réglages était sans issue.
- **Thème sombre** : l'icône des sélecteurs de date natifs est-elle visible sur `/agenda` ?
  Corrigée le 2026-09-03, jamais vue sur un écran iOS.
- **VoiceOver rallumé, iPhone en anglais** (Réglages › Général › Langue) : rouvrir
  `MobileMoreSheet`, `ListActionsSheet` (4.8), `MobileAddToList` (4.7), `WeeklyCheckinModal` (8.6)
  et `MemberPlacementSheet` (9.10), puis reparcourir les liens du pied de landing (1.6).
  **Attendu** : tout est annoncé en anglais, et les quatre liens contractuels ouvrent bien leur page.
  Les surfaces marquées 🇫🇷 en annexe A **diront leur nom en français** : c'est un finding attendu,
  à consigner quand même, avec le verbatim.

---

## Annexe A · les 53 surfaces câblées, et ce que chacune doit dire

Source : `grep -rl "useModalA11y" src --include=*.tsx`, croisée avec le nom accessible lu dans le
code et résolu dans `src/locales/fr/`. **Ce n'est pas une liste de cases à cocher de plus** : c'est
la référence des noms attendus, pour que « M1 » ait un contenu vérifiable à chaque ligne.

🇫🇷 = nom accessible écrit **en dur en français**, donc faux dans une interface anglaise.

| Surface | Où l'ouvrir | Nom attendu (M1) | § |
|---|---|---|---|
| `MobileMoreSheet` | barre d'onglets, « Plus » | Plus d'options | 3.3 |
| `FirstRunSetup` | premier lancement, compte vide | Bienvenue dans COSMO | 2.4 |
| `TaskActionsSheet` | carte de tâche, bouton « ⋯ » | Actions pour \<nom\> | 4.6 |
| `MobileAddToList` | feuille d'actions › Ajouter à une liste | Listes 🇫🇷 | 4.7 |
| `ListActionsSheet` | appui long sur une chip de liste | Actions pour la liste \<nom\> 🇫🇷 | 4.8 |
| `CreateListSheet` | barre de chips, nouvelle liste | Nouvelle liste | 4.9 |
| `ShareListSheet` | liste **manuelle**, partager | Partager la liste \<nom\> | 4.10 |
| `ConfirmDeleteSheet` | supprimer une tâche | le titre passé en prop | 4.11 |
| `DeleteTaskConfirm` | fiche de tâche, supprimer | Supprimer la tâche · Quitter la tâche partagée | 4.13 |
| `MobileActionSheet` | fiche de tâche mobile, actions | le titre passé en prop | 4.13 |
| `BulkAddToListModal` | sélection multiple › ajouter à une liste | Ajouter à une liste · ⚠️ à étages | 4.16 |
| `EventModal` | `/agenda`, événement | son titre d'en-tête | 6.4 |
| `ConfirmDiscardDialog` | « Z » sur un `EventModal` modifié | Abandonner les modifications ? | 6.5 |
| `ColorSettingsModal` | `EventModal` / `HabitModal` › catégories | Modifier les catégories | 6.6 · 7.6 |
| `RecurrenceDaysModal` | `EventModal` › récurrence personnalisée | Répéter les jours | 6.7 |
| `QuickEventCard` | appui long sur un créneau | Création rapide d'un événement | 6.9 |
| `RecurringEventsManager` | `/agenda`, événements récurrents | Événements récurrents | 6.10 |
| `AgendaEventToTaskConfirm` | conversion événement → tâche | Que faire de cet événement ? | 6.11 |
| `AgendaSlotReviewModal` | fin d'un créneau · ⚠️ « Z » = report | Créneau terminé | 6.12 |
| `HabitModal` | `/habits`, créer ou modifier | Créer l'habitude · Modifier l'habitude | 7.5 |
| `DeleteCategoryDialog` | supprimer une catégorie perso | Supprimer « \<nom\> » ? | 8.3 |
| `DeleteObjectiveConfirm` | `/okr`, supprimer un objectif | Supprimer l'objectif | 8.4 |
| `CompletedOKRsModal` | `/okr`, OKR terminés | OKR terminés | 8.5 |
| `WeeklyCheckinModal` | `/okr` ou `/dashboard`, check-in | Check-in hebdo 🇫🇷 | 8.6 |
| `OKRDeadlineReviewModal` | OKR échu · ⚠️ « Z » selon la phase | le titre de l'objectif | 8.7 |
| `MemberSheet` | `/entreprise` › annuaire | Fiche de \<nom\> | 9.6 |
| `MemberPermissionsSheet` | annuaire › « … » › permissions | Modifier les permissions de \<nom\> | 9.7 |
| `ReassignManagerSheet` | annuaire › « … » · ⚠️ exception M4 | Réassigner l'équipe de \<nom\> | 9.8 |
| `AddUnderSheet` | pyramide › ajouter sous | Ajouter sous \<nom\> | 9.9 |
| `MemberPlacementSheet` | pyramide › placer | Placer \<nom\> 🇫🇷 | 9.10 |
| `CreateTeamModal` | pyramide ou projets › nouvelle équipe | Nouvelle équipe | 9.11 |
| `NewTeamProjectModal` | projets › nouveau projet | Nouveau projet d'équipe | 9.12 |
| `TeamTaskModal` | tâche d'équipe · ⚠️ exception M4 | Nouvelle tâche d'équipe · Modifier la tâche \<nom\> | 9.13 |
| `AssignTaskSheet` | annuaire ou projets › assigner | Attribuer une tâche à \<nom\> | 9.14 |
| `AssignEventDialog` | onglet tâches › planifier | Assigner l'événement, puis le nom de la tâche | 9.15 |
| `DeleteCategoryConfirm` | OKR d'équipe › supprimer une catégorie | Supprimer « \<nom\> » ? | 9.16 |
| `WeeklyReviewSheet` | vue d'ensemble › revue | Revue de la semaine | 9.17 |
| `OrgProfileSheet` | `/entreprise` › profil | Profil de l'entreprise | 9.18 |
| `InviteOrJoinModal` | `Layout`, créer ou rejoindre | Créer ou rejoindre une entreprise | 9.19 |
| `DeleteOrganizationDialog` | `/entreprise` › supprimer | Supprimer \<nom\> ? | 9.20 |
| `LoginModal` | landing › se connecter | Connexion ou inscription | 10.5 |
| `BugReportModal` | `Layout` · ⚠️ exception M4 | Signaler un bug | 10.6 |
| `TodayTasks` (dialogue de suppression) | `/dashboard`, supprimer une tâche du jour | Supprimer la tâche | 4.11 |
| `CollaborativeTasks` (dialogue de suppression) | `/dashboard`, tâches partagées | Supprimer la tâche | 4.11 |
| `RemoveFriendConfirm` | boîte de réception › retirer un ami | Confirmer la suppression de l'ami | à jouer si tu passes par la boîte de réception |
| `ShareInviteClaimer` | ouvrir un lien `/invite/:token` | Tâche partagée avec vous | à jouer si tu as un lien sous la main |

**Sept surfaces câblées ne figurent pas dans ce tableau**, parce qu'aucune séance sur iPhone ne peut
les ouvrir : `DesktopAddToList`, `BottomSheet`, `PremiumGateModal`, `CommandPalette`,
`ShortcutsHelp`, `QuickAddBar` et `CategoryManager`. Leur motif est en annexe B. 46 + 7 = 53.

🔴 **`CategoryManager` n'est monté nulle part.** Vérifié le 2026-09-08 : seul son helper
`getColorHex` est importé (par `OKRPage` et `TeamOKRTab`), le composant modal ne l'est par personne.
Il est **câblé** sur `useModalA11y` et **inatteignable**. Ce n'est pas un finding d'accessibilité,
c'est un orphelin de la même famille que ceux supprimés par C-49 : à traiter ailleurs, à noter ⬜
ici.

## Annexe B · ce qu'un iPhone ne peut pas atteindre, et pourquoi

Écrit noir sur blanc pour qu'un écran non joué ne se lise jamais comme un écran conforme.

| Surface | Pourquoi elle est hors d'atteinte |
|---|---|
| `CommandPalette` | ouverte au clavier, aucun déclencheur tactile |
| `ShortcutsHelp` | ouverte par la touche `?`, ou par un événement émis par la palette. 🇫🇷 son nom, « Raccourcis clavier », est écrit en dur |
| `QuickAddBar` | ouverte par la touche `N` |
| `DesktopAddToList` | `AddToListModal` aiguille sur `useIsMobile()` : au-dessus du point de rupture seulement |
| `BottomSheet` | `WeeklyRecapSheet`, son unique consommateur produit, est derrière `WEEKLY_RECAP_ENABLED = false` |
| `PremiumGateModal` | `PREMIUM_ENFORCED = false` : `isPremium()` répond `true` pour tout le monde, le mur ne s'ouvre jamais |
| `CategoryManager` | jamais monté (cf. annexe A) |

⚠️ **Les trois premières se rouvrent avec un clavier Bluetooth.** Si tu en branches un, elles
rentrent dans le périmètre, et il faut le dire dans le compte-rendu : « joué avec clavier externe »
n'est pas la même mesure que « joué au doigt ».

---

## Hors périmètre, volontairement

Android TalkBack, VoiceOver macOS, le contraste (déjà mesuré, cf. `ACCESSIBILITY.md`) et la
performance (M-38). Cet audit répond à **une** question : ce que le produit **dit** à quelqu'un qui
ne le voit pas, sur l'appareil où il est le plus utilisé.

## Après la séance

1. Reporter chaque finding dans `a-faire-code.md`, en gardant le verbatim.
2. Refermer **C-24** : c'est le quatrième et dernier des quatre audits. 🔴 **Et seulement là.**
   Tant qu'aucune ligne de ce fichier n'a été jouée sur un appareil réel, C-24 reste ouvert :
   écrire le protocole ne mesure rien, et une check-list à jour n'est pas une check-list jouée.
3. Renoter l'accessibilité dans [`ACCESSIBILITY.md`](./ACCESSIBILITY.md) et dans le tableau de bord
   de [`README.md`](./README.md), en disant ce qui a été mesuré et sur quel appareil.
4. Si l'audit n'a pas pu aller au bout, l'écrire ainsi. Un audit partiel est « à refaire », pas
   « fait » : c'est déjà l'arbitrage rendu pour A-4.
