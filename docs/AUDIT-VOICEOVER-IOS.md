<!-- echeance-lecteur-ecran: 2026-12-15 initiale=2026-12-15 -->

# Audit VoiceOver iOS : check-list à jouer d'une traite

**Quand lire** : pour jouer la séance VoiceOver sur iPhone réel, ou en touchant `scripts/check-lecteurs-ecran.mjs`. **Fait foi** : le registre ci-dessous et `npm run check:lecteurs-ecran`. Procédure NVDA et revue WCAG : [`AUDIT-NVDA-WINDOWS.md`](./AUDIT-NVDA-WINDOWS.md).

**Statut : à jouer, échéance 2026-12-15. Rien n'est coché.** Quatrième audit d'accessibilité de `C-24` (issue n° 183), le seul jamais passé ; les trois autres (clavier, modales, `/agenda`) l'ont été sur Chromium desktop.

- 🔴 `npm run check:lecteurs-ecran` (CI, `M-52`) échoue passé l'échéance sans ligne `✅ joué` au [registre](#registre-des-séances). ❌ Repousser l'échéance de plus de 30 jours après `initiale=` (marqueur d'en-tête) : c'est une reconduction. ❌ Cocher une ligne du registre sans séance réelle.
- 🔴 La garde exige aussi que CHAQUE étape numérotée porte son résultat attendu, et un plancher d'étapes : ❌ supprimer des étapes pour raccourcir. Elle prouve qu'une séance est CONSIGNÉE avec un appareil, pas qu'elle est bien faite.
- 🔴 Il ne se simule pas et ne se déduit pas : Playwright prouve le FOCUS, jamais l'ANNONCE ([`ACCESSIBILITY.md`](./ACCESSIBILITY.md) § « Ce que nos mesures prouvent, et ne prouvent pas »). `useModalA11y` rend les propriétés DOM mesurables ; ce que VoiceOver en fait reste non mesuré.
- ✅ Durée : environ 90 min (60 pour les sections 1 à 12, 30 pour l'annexe A en entier). Où : `https://thecosmo.app`, mode démo (aucune donnée réelle). Produit : des findings `V-xx`, une issue chacun (gabarit « Tâche de backlog »). Pas de correctif pendant la séance.
- ✅ Annexe A : une ligne par surface atteignable sur iPhone, avec le nom qu'elle DOIT dire ; recompter par `grep -rn "= useModalA11y" src --include=*.tsx` (hors `use-modal-a11y.guard.test.tsx`). Annexe B : ce qui n'est pas atteignable, motivé, pour qu'un écran non joué ne se lise jamais comme conforme.

## 0. Préparation (5 min)

1. **Un iPhone réel** (le simulateur n'a ni le même VoiceOver ni les gestes). Noter modèle, version d'iOS, version de Safari (Réglages › Général › Informations) : sans elles un finding n'est pas reproductible.
2. **Raccourci d'accessibilité** : Réglages › Accessibilité › Raccourci d'accessibilité › VoiceOver (triple-clic du bouton latéral).
3. **Débit de parole vers 40 %** (Réglages › Accessibilité › VoiceOver › Débit).
4. **Safari, portrait, thème clair, aucun zoom d'affichage** pour la première passe ; variantes à l'étape 12.
5. **Dictaphone en marche** : l'annonce se garde VERBATIM, reformuler perd le défaut.
6. **iPhone en français** pour la passe principale ; passe en anglais à l'étape 12 (cinq noms de surfaces sont écrits en dur en français, lignes 🇫🇷 de l'annexe A).

## Les gestes qui suffisent

| Geste | Ce qu'il fait |
|---|---|
| balayage droite / gauche (1 doigt) | élément suivant / précédent |
| double tap | activer l'élément sous le curseur |
| **double tap maintenu** | équivalent d'un appui long ; seul moyen d'atteindre un menu d'appui long (cf. 4.8) |
| toucher-déplacer | explorer par la POSITION (révèle l'ordre visuel réel) |
| balayage 2 doigts vers le haut | lire toute la page depuis le haut |
| balayage 3 doigts | faire défiler |
| rotor (2 doigts, rotation) puis balayage haut/bas | parcourir par titres, liens, contrôles, champs de formulaire |
| « Z » à 2 doigts (scrub) | revenir en arrière, fermer une couche |

## Le témoin : à jouer en PREMIER

Une mesure dont on ignore si l'instrument fonctionnait ne vaut rien. Sur `https://thecosmo.app`, balayer jusqu'au bouton principal du hero.

- **Attendu, verbatim** : « **Essayer la démo sans inscription, bouton** » (nom accessible `landing:hero.demoAria`, qui diffère volontairement du texte visible « Essayer la démo gratuite », `landing:hero.demoCta`).
- ✅ « sans inscription » entendu : l'audit peut commencer. ❌ « gratuite » entendu : nom accessible non appliqué ou verbosité modifiée. **Arrêter là** : rien de la suite ne serait interprétable.

## Les 4 détecteurs d'une surface modale

Toute ligne de modale pose ces quatre questions, dans cet ordre (pendant VoiceOver des détecteurs du harnais clavier).

| # | Question | Attendu |
|---|---|---|
| **M1** | à l'ouverture, qu'est-ce qui est annoncé ? | le NOM de la surface (colonne « nom attendu » de l'annexe A), suivi de « boîte de dialogue » |
| **M2** | le curseur entre-t-il dedans ? | oui, sur un élément DE la surface, jamais sur la page dessous |
| **M3** | balayer à droite en boucle, une dizaine de fois | on ne ressort jamais sur la page dessous ; un seul élément d'arrière-plan annoncé est un ❌ |
| **M4** | « Z » à 2 doigts | la surface se ferme ET le curseur revient sur le contrôle qui l'a ouverte |

- ⚠️ Exception M4 : `TeamTaskModal` et `BugReportModal` refusent de se fermer pendant `pending` / `sending` : le « Z » ne doit RIEN faire tant que l'opération tourne (comme la croix et le voile). Un « Z » qui ferme là où le clic ne peut pas est un ❌.
- ⚠️ Fermeture À ÉTAGES (le premier « Z » annule un sous-état, le second ferme ; l'inverse perdrait une saisie) : `BulkAddToListModal`, `MobileAddToList` (sous-formulaire de création), `OKRDeadlineReviewModal` (ne ferme qu'en phase d'édition). `AgendaSlotReviewModal` : son « Z » REPORTE le créneau.

## Comment consigner

Gabarit de finding, à recopier tel quel :

```
[V-01] /tasks · balayage droite depuis le titre de la liste
Entendu : « bouton »
Attendu : « Marquer Faire les courses comme faite, case à cocher, non cochée »
Appareil : iPhone 13, iOS 18.5, Safari 18.5
```

- ✅ Écrire l'ENTENDU avant l'attendu. Statuts : ✅ conforme · ❌ défaut · ⚠️ douteux · ⬜ non atteint. Un ⚠️ non rejoué compte comme non mesuré ; un ⬜ se justifie en une ligne ; un écran non atteint se note « non atteint », jamais « rien à signaler ».

---

## 1. Landing `/` · 5 min

| # | Geste | Attendu | Piège connu |
|---|---|---|---|
| 1.1 | rotor › Titres, balayer vers le bas | un seul `h1`, puis des niveaux qui descendent d'un cran à la fois | `heading-order` jamais mesuré sur la landing |
| 1.2 | lire depuis le haut (2 doigts) | rien de décoratif n'est lu : illustrations et icônes muettes | une icône lucide sans `aria-hidden` se lit « image » |
| 1.3 | atteindre l'aiguillage perso / entreprise | deux liens distincts, compréhensibles hors contexte, et le parcours choisi dit « sélectionné » | structure de la page ([`src/pages/landing/CLAUDE.md`](../src/pages/landing/CLAUDE.md)) |
| 1.4 | atteindre la grille de tarifs | le montant est lu AVEC son unité et sa période, et un prix barré est annoncé comme barré | l'offre de lancement affiche « Gratuit » et garde l'ancien prix barré : sans « barré », deux prix contradictoires |
| 1.5 | bandeau cookies, s'il apparaît | annoncé, atteignable au balayage, ses deux choix distincts | `CookieBanner` est un `aside` avec `aria-label` |
| 1.6 | atteindre les liens du pied de page (CGU, confidentialité, mentions légales) | chacun est un lien, et il OUVRE bien sa page | tombaient sur une 404 en anglais : à rejouer à l'étape 12 |
| 1.7 | hero du parcours entreprise (`/entreprise-presentation`) | le canvas de rayons est MUET et inatteignable au balayage | il peint le viewport entier ; atteignable, il serait annoncé « image » au milieu du titre |

## 2. Entrée en démo et changement de route · 5 min

| # | Geste | Attendu | Piège connu |
|---|---|---|---|
| 2.1 | double tap sur « Essayer la démo » | l'application s'ouvre sur `/dashboard` | |
| 2.2 | juste après l'ouverture | QUELQUE CHOSE est annoncé : titre de page, ou premier élément du nouvel écran | 🔴 classe de défaut la plus probable : dans une SPA changer d'URL n'annonce rien par défaut, le curseur peut rester sur l'écran précédent |
| 2.3 | naviguer `/dashboard` → `/tasks` → `/habits` par la barre d'onglets | même question à chaque fois, et le curseur ne retombe pas tout en haut du document à chaque route | |
| 2.4 | si l'accueil de premier lancement s'ouvre | `FirstRunSetup` : M1 « **Bienvenue dans COSMO** », puis M2, M3, M4 | il ne s'ouvre que sur un compte VIDE (`taskCount === 0`), une fois par appareil ; en démo les seeds le remplissent : noter ⬜, ne pas le forcer |

## 3. Navigation mobile : barre d'onglets et feuille « Plus » · 5 min

| # | Geste | Attendu | Piège connu |
|---|---|---|---|
| 3.1 | atteindre la barre d'onglets | annoncée « **Navigation mobile** », et l'onglet courant dit « page active » ou « sélectionné » | `aria-current="page"` vient du `NavLink` de React Router ; jamais entendu |
| 3.2 | atteindre un badge | le nombre AVEC son sens : « 3 demandes en attente », « 2 notifications entreprise », « 5 tâches pour aujourd'hui ». Jamais « 3 » seul | libellés `common:nav.badge.*` ; la question est leur audibilité |
| 3.3 | ouvrir « Plus » | M1 « **Plus d'options** », puis M2 | `MobileMoreSheet` est le SEUL accès mobile à OKR, Statistiques, Réglages et à la déconnexion |
| 3.4 | balayer à droite en boucle dans la feuille | M3 : on ne ressort pas sur la page dessous | |
| 3.5 | « Z » à 2 doigts | M4 : elle se ferme, le curseur revient sur « Plus d'options » | |
| 3.6 | dans la feuille, atteindre l'entrée de la page où l'on se trouve | elle dit « page active » | `aria-current="page"` posé à la main ici |

## 4. `/tasks` · 15 min

🔴 Le bouton « ⋯ » de la carte de tâche n'existe plus sur téléphone (maquette 86) : l'élément qui porte ce nom vit dans `div.hidden md:block`, à 0 × 0 px au format mobile. Les actions d'une tâche n'y sont atteignables que par appui long ou glissement (gestes de pointeur). Le chemin ouvert est l'évènement `contextmenu` (`Shift+F10`), annoncé par `aria-keyshortcuts`, NON vérifié sous VoiceOver iOS (pas de touche menu contextuel). C'est une QUESTION que cet audit doit trancher : noter ce que VoiceOver propose (rotor « Actions », actions personnalisées) ; « rien » est un finding de niveau A, pas une erreur de manipulation.

| # | Geste | Attendu | Piège connu |
|---|---|---|---|
| 4.1 | atteindre une ligne de tâche | « case à cocher, non cochée », AVEC le nom de la tâche | `role="checkbox"` + `aria-checked` (`task-table/list.tsx`, `TodayTasks`) : jamais « bouton » |
| 4.2 | double tap dessus | le NOUVEL état est annoncé (« cochée ») sans rebalayer | |
| 4.3 | juste après | le toast de confirmation est lu, et sans voler le curseur | Sonner porte sa région live ; un toast qui déplace le curseur casse le parcours |
| 4.4 | atteindre le titre d'une tâche | annoncé comme un contrôle activable, pas comme du texte inerte | |
| 4.5 | 🔴 atteindre les actions d'une tâche : balayer jusqu'à la ligne, puis chercher ce que VoiceOver propose (rotor « Actions », geste personnalisé). PAS de bouton « ⋯ » | la carte doit être atteignable et ses actions accessibles SANS geste de pointeur | ❌ Ne pas conclure « VoiceOver est cassé » si rien ne répond « Actions pour … » : attendu. L'étape mesure par quel geste, s'il en existe un, une personne aveugle ouvre `TaskActionsSheet` sur iPhone |
| 4.6 | une fois la feuille ouverte (par le chemin trouvé en 4.5) | `TaskActionsSheet` : M1 « **Actions pour \<nom\>** », puis M2, M3, M4 | le nom est juste, c'est le DÉCLENCHEUR qui a disparu ; si 4.5 échoue, ouvrir la feuille autrement pour ne pas perdre 4.6 et 4.7 |
| 4.7 | dans la feuille, « Ajouter à une liste » | `MobileAddToList` : M1 annonce « **Listes** » | nom d'une syllabe, en dur, pour une surface plein écran : à consigner tel quel |
| 4.8 | 🔴 appui long sur une chip de liste (double tap MAINTENU) | `ListActionsSheet` : M1 « **Actions pour la liste \<nom\>** » | point le plus exposé : renommer, partager, supprimer, épingler, recolorer une liste n'a AUCUN autre chemin sur mobile (boutons flottants conditionnés à `!isMobile`, menu contextuel natif neutralisé). Si le double tap maintenu n'ouvre rien : WCAG 2.5.1 |
| 4.9 | bouton « Nouvelle liste » de la barre de chips | `CreateListSheet` : M1 « **Nouvelle liste** », puis M2 à M4 | |
| 4.10 | partager une liste MANUELLE | `ShareListSheet` : M1 « **Partager la liste \<nom\>** » | la démo ne contient que des listes intelligentes et « Partager » n'est monté que pour les autres : en créer une d'abord |
| 4.11 | supprimer une tâche depuis la feuille d'actions | `ConfirmDeleteSheet` : le titre passé en prop est le nom annoncé, et la conséquence est lue AVANT les boutons | « Supprimer / Annuler » seul ne dit pas ce qu'on supprime |
| 4.12 | ouvrir la fiche d'une tâche | le curseur entre dans la modale, son titre est annoncé, le fond n'est plus atteignable | `TaskModal` est une surface RADIX (piège de la bibliothèque) : point de comparaison, cf. § 11 |
| 4.13 | dans la fiche, le bouton de suppression | `DeleteTaskConfirm` : « **Supprimer la tâche** » si propriétaire, « **Quitter la tâche partagée** » sinon | deux noms pour le même bouton, voulu : doit s'entendre |
| 4.14 | dans la fiche mobile, une sous-tâche | « case à cocher », avec son libellé | `SubtaskChecklist` porte `role="checkbox"` |
| 4.15 | une tâche EN RETARD | l'état « en retard » est annoncé, pas seulement montré en rouge | une couleur n'est pas une information pour un lecteur d'écran |
| 4.16 | sélection multiple, puis « Ajouter à une liste » | `BulkAddToListModal` : M1 « **Ajouter à une liste** ». ⚠️ fermeture à étages | sélection multiple inatteignable au doigt : noter ⬜ et passer |

## 5. Le calendrier COSMO · 10 min

Il a remplacé le sélecteur natif et n'a jamais été entendu. Montés par `DatePicker` / `DateCalendarPanel` (`grep -rl "DatePicker\|DateCalendarPanel" src --include=*.tsx`). Trois façons d'ouvrir : depuis un CHAMP (échéance de la fiche de tâche) ; depuis un MENU (report d'échéance, `OverdueQuickActions`, carte mobile, C-55) ; depuis une fiche d'objectif (`/okr`, échéance d'un OKR).

| # | Geste | Attendu | Piège connu |
|---|---|---|---|
| 5.1 | ouvrir le calendrier | le curseur entre dedans, et le MOIS affiché est annoncé | C-51 : le mois affiché était le mois courant, pas celui du champ |
| 5.2 | balayer dans la grille | chaque jour est annoncé avec sa date COMPLÈTE et en français | 🔴 C-52 : `react-day-picker` traduit ses dates, PAS ses libellés ARIA |
| 5.3 | atteindre le jour sélectionné | il dit « sélectionné » | |
| 5.4 | atteindre les flèches de mois et les presets | libellés en français, et rôle de bouton | |
| 5.5 | choisir un jour | le champ annonce la nouvelle valeur | |
| 5.6 | rouvrir depuis un MENU (chemin 2) | même comportement, et AUCUN jour passé n'est proposé | C-55 ; sans `minDate`, un report permet de reporter vers hier |
| 5.7 | les deux champs de date d'`EventModal` | `input[type=date]` NATIFS : la roue iOS parle | arbitrage assumé : noter ✅ « natif », pas ❌ |

## 6. `/agenda` · 10 min

| # | Geste | Attendu | Piège connu |
|---|---|---|---|
| 6.1 | explorer la grille au toucher-déplacer | jours et événements lisibles, avec heure et titre | C-54 : cellules de jour hors du parcours clavier (décision rendue) |
| 6.2 | balayage droite depuis le haut | COMPTER les balayages avant le premier événement, et le noter | équivalent VoiceOver des tabulations de C-54 |
| 6.3 | changer de mois | l'action est atteignable et le nouveau mois est annoncé | |
| 6.4 | ouvrir un événement | `EventModal` : M1 annonce son titre d'en-tête, puis M2, M3 | |
| 6.5 | modifier le titre, puis « Z » | 🔴 la modale NE SE FERME PAS : `ConfirmDiscardDialog` s'ouvre par-dessus, « **Abandonner les modifications ?** », et la saisie est INTACTE si on refuse | un « Z » qui ferme directement jette une saisie que la souris protège |
| 6.6 | dans `EventModal`, « Créer une catégorie » | `ColorSettingsModal` par-dessus : M1 « **Modifier les catégories** », M3 piège sur ELLE | trois modales sœurs dans l'arbre d'`EventModal` : seule la dernière empilée réagit |
| 6.7 | dans `EventModal`, récurrence « Personnaliser » | `RecurrenceDaysModal` : M1 « **Répéter les jours** », chaque jour « case à cocher » avec son état | `role="checkbox"` + `aria-checked` |
| 6.8 | « Z » dans une des trois sœurs | elle seule se ferme, `EventModal` reste ouverte et REPREND le piège | |
| 6.9 | créer un événement par appui long sur un créneau | `QuickEventCard` : M1 « **Création rapide d'un événement** » | comme 4.8 : si l'appui long ne passe pas, chercher l'autre chemin ; son absence est le finding |
| 6.10 | ouvrir la gestion des événements récurrents | M1 « **Événements récurrents** » | |
| 6.11 | déclencher la conversion d'un événement en tâche | `AgendaEventToTaskConfirm` : M1 « **Que faire de cet événement ?** » | un glisser-déposer n'a probablement aucun équivalent VoiceOver : le noter |
| 6.12 | fin d'un créneau planifié | `AgendaSlotReviewModal` : M1 « **Créneau terminé** ». ⚠️ « Z » REPORTE le créneau | fermeture sur `onSnooze` : un report silencieux laisse ignorer ce qui s'est passé |
| 6.13 | le voile du panneau latéral mobile | il n'est PAS une boîte de dialogue et ne doit pas être annoncé comme telle | déclaré non modal dans la garde |

## 7. `/habits` · 5 min

| # | Geste | Attendu | Piège connu |
|---|---|---|---|
| 7.1 | atteindre une case de jour | « case à cocher », avec nom de l'habitude et date en toutes lettres | libellés `table.dayCell` ; risque : date lue en fragments |
| 7.2 | cocher | le nouvel état est annoncé | |
| 7.3 | atteindre la série | « série de 12 jours », pas « 12 » seul | valeur serveur, jamais recalculée depuis `completions` |
| 7.4 | balayer une ligne entière | l'ordre de lecture suit la LIGNE, pas la colonne | une grille lue en colonnes est illisible |
| 7.5 | créer une habitude | `HabitModal` : M1 « **Créer l'habitude** » (« **Modifier l'habitude** » en édition), puis M2 à M4 | après « Z », le curseur revient SUR le bouton de création, pas en haut de page |
| 7.6 | dans `HabitModal`, ouvrir les catégories | `ColorSettingsModal` s'empile : M1 « **Modifier les catégories** », M3 piège sur elle | |

## 8. `/okr` · 8 min

| # | Geste | Attendu | Piège connu |
|---|---|---|---|
| 8.1 | atteindre une barre d'avancement | « Avancement de X sur Y », avec des nombres, pas un pourcentage seul | |
| 8.2 | rotor › Titres | la hiérarchie tient | mesurée à l'œil, jamais à l'oreille |
| 8.3 | supprimer une catégorie personnelle | `DeleteCategoryDialog` : M1 « **Supprimer « \<nom\> » ?** », et l'IMPACT est lu (« n tâches, n objectifs ») AVANT la confirmation | R-02 : un impact affiché mais non annoncé revient à ne pas l'avoir |
| 8.4 | supprimer un objectif | `DeleteObjectiveConfirm` : M1 « **Supprimer l'objectif** » | |
| 8.5 | ouvrir « OKR terminés » | `CompletedOKRsModal` : M1 « **OKR terminés** » | |
| 8.6 | ouvrir le check-in hebdo | `WeeklyCheckinModal` : M1 « **Check-in hebdo** » | 🇫🇷 titre en dur en français (étape 12) |
| 8.7 | un OKR dont l'échéance est passée | `OKRDeadlineReviewModal` s'ouvre seul : M1 annonce le TITRE de l'objectif. ⚠️ « Z » ne ferme qu'en phase d'édition | une modale qui s'ouvre seule et qu'un geste ne ferme pas est une impasse : noter dans quelle phase « Z » répond |
| 8.8 | créer ou éditer un OKR | `OKRModalSheet` est une surface RADIX : jouer M1 à M4 quand même | cf. § 11 |

## 9. `/entreprise` · 10 min · thème noir, zone la moins mesurée

Les correctifs D4, D5, E2 ont été écrits sans qu'un lecteur d'écran les vérifie.

| # | Geste | Attendu | Piège connu |
|---|---|---|---|
| 9.1 | frise, pastille de date | « 27 août 2026 », en un seul bloc | D4 : se lisait « 27août » |
| 9.2 | en-tête « Mes tâches (3) · 1 h 45 » | le séparateur s'entend | D5 : un `ml-2` n'existe pas pour un lecteur d'écran |
| 9.3 | pastille de priorité | elle est annoncée | E2 : portée par `title=` seul, muet au toucher |
| 9.4 | pyramide managériale | la structure se parcourt, et un membre est annoncé AVEC son rôle | jamais entendue |
| 9.5 | barre d'onglets de l'organisation | l'onglet actif dit « page active » | `aria-current="page"` à la main dans `OrgTabsBar` |
| 9.6 | annuaire › fiche d'un membre | `MemberSheet` : M1 « **Fiche de \<nom\>** » | |
| 9.7 | annuaire › « … » › modifier les permissions | `MemberPermissionsSheet` : M1 « **Modifier les permissions de \<nom\>** », chaque droit « case à cocher » avec son état | formulaire le plus dense du produit |
| 9.8 | annuaire › « … » › organiser le départ | le retrait passe par `OffboardMemberDialog` (assistant de départ) : mesurer son nom et son parcours | `ReassignManagerSheet` n'existe plus |
| 9.9 | pyramide › ajouter sous quelqu'un | `AddUnderSheet` : M1 « **Ajouter sous \<nom\>** » | |
| 9.10 | pyramide › placer un membre | `MemberPlacementSheet` : M1 « **Placer \<nom\>** » | 🇫🇷 nom en dur en français |
| 9.11 | créer une équipe | `CreateTeamModal` : M1 « **Nouvelle équipe** », chaque pastille de couleur dit son état | `aria-checked` sur les couleurs |
| 9.12 | créer un projet d'équipe | `NewTeamProjectModal` : M1 « **Nouveau projet d'équipe** » | |
| 9.13 | ouvrir une tâche d'équipe | `TeamTaskModal` : M1 « **Modifier la tâche \<nom\>** » ou « **Nouvelle tâche d'équipe** ». ⚠️ exception M4 | |
| 9.14 | assigner une tâche à un membre | `AssignTaskSheet` : M1 « **Attribuer une tâche à \<nom\>** » ou « **Ajouter une tâche non assignée** » | |
| 9.15 | planifier une tâche d'équipe | `AssignEventDialog` : M1 « **Assigner l'événement** », puis le nom de la tâche | séparateur du nom accessible : noter s'il s'entend, se tait, ou coupe la phrase |
| 9.16 | supprimer une catégorie d'OKR d'équipe | `DeleteCategoryConfirm` : M1 « **Supprimer « \<nom\> » ?** », AVEC son impact | C-02 : impact annoncé, réaffectation avant. Jamais entendu |
| 9.17 | revue de la semaine | `WeeklyReviewSheet` : M1 « **Revue de la semaine** » | |
| 9.18 | profil de l'entreprise | `OrgProfileSheet` : M1 « **Profil de l'entreprise** » | |
| 9.19 | créer ou rejoindre une entreprise | `InviteOrJoinModal` : M1 « **Créer ou rejoindre une entreprise** » | monté dans `Layout`, atteignable de toute page protégée |
| 9.20 | supprimer l'organisation | `DeleteOrganizationDialog` : M1 « **Supprimer \<nom\> ?** » | NE PAS confirmer : on mesure, on ne détruit pas le jeu de démo |
| 9.21 | cloche de notifications | un POPOVER, pas une boîte de dialogue : on doit pouvoir en sortir au balayage | non modal, motivé : piéger le focus empêcherait de le fermer |

## 10. Formulaires, erreurs et signalement · 7 min

Se déconnecter (feuille « Plus »), puis `/login`.

| # | Geste | Attendu | Piège connu |
|---|---|---|---|
| 10.1 | atteindre chaque champ | le LIBELLÉ est annoncé, pas « champ de texte » | |
| 10.2 | valider avec un e-mail mal formé | l'erreur est ANNONCÉE toute seule | `AuthForm` porte une région live ; reste à l'entendre |
| 10.3 | après l'erreur | le curseur n'a pas sauté ailleurs | une région live ne doit pas voler le curseur |
| 10.4 | rotor › Champs de formulaire | tous les champs y sont, dans l'ordre visuel | |
| 10.5 | depuis la landing, ouvrir la connexion en modale | `LoginModal` : M1 « **Connexion ou inscription** » | |
| 10.6 | reconnecté, ouvrir « Signaler un bug » | `BugReportModal` : M1 « **Signaler un bug** ». ⚠️ exception M4 pendant l'envoi | sinon une saisie se perd sans savoir si le message est parti |

## 11. Cinq questions transverses, sur chaque écran

- **L'ordre de lecture au balayage suit-il l'ordre visuel ?** Comparer un balayage droite et un toucher-déplacer (l'ordre de tabulation ignore ce qui n'est pas focalisable).
- **Quelque chose est-il lu deux fois ?** Un texte visible ET en `sr-only` s'entend en double (risque des correctifs D4, D5).
- **Une surface maison se comporte-t-elle comme une surface Radix ?** `TaskModal` (4.12) et `OKRModalSheet` (8.8) viennent de la bibliothèque, les autres de `useModalA11y`. La différence est le finding. ⚠️ Radix n'est pas la référence : le témoin Radix échoue lui-même sur la restitution du focus.
- **Une action n'existe-t-elle que par un geste ?** Appui long (4.8, 6.9), balayage de carte (4.5), glisser-déposer (6.11) : chacun doit avoir un chemin de rechange atteignable au balayage ; sinon c'est un finding.
- **Le nom annoncé reste-t-il français en interface anglaise ?** Cinq surfaces portent un nom en dur (annexe A, 🇫🇷) : étape 12.

## 12. Variantes système · 8 min

VoiceOver ÉTEINT, sauf la dernière :

- **Texte plus grand** au maximum (Accessibilité › Affichage et taille du texte) : la mise en page tient-elle sur `/dashboard`, `/tasks` et la feuille « Plus » ?
- **Réduire les animations** : les feuilles s'ouvrent-elles vraiment ? (`MobileMoreSheet` pouvait s'ouvrir à 0 px visible, sans issue vers les réglages.)
- **Thème sombre** : l'icône des sélecteurs de date natifs est-elle visible sur `/agenda` ?
- **VoiceOver rallumé, iPhone en anglais** (Réglages › Général › Langue) : rouvrir `MobileMoreSheet`, `ListActionsSheet` (4.8), `MobileAddToList` (4.7), `WeeklyCheckinModal` (8.6), `MemberPlacementSheet` (9.10), puis les liens du pied de landing (1.6). **Attendu** : tout en anglais, et les quatre liens contractuels ouvrent leur page. Les surfaces 🇫🇷 diront leur nom en français : finding attendu, à consigner avec le verbatim.

---

## Annexe A · les surfaces câblées et le nom que chacune doit dire

Référence des noms attendus, pour que « M1 » ait un contenu vérifiable (nom lu dans le code, résolu dans `src/locales/fr/`). 🇫🇷 = nom en dur en français, faux en interface anglaise. « à relire dans le code » = nom à relever dans le fichier avant la séance ; surface jamais auditée.

| Surface | Où l'ouvrir | Nom attendu (M1) | § |
|---|---|---|---|
| `AssignRoleDialog` | `/entreprise` › annuaire › attribuer un rôle personnalisé | à relire dans le code (affiche « aucun rôle » pendant le chargement, `loading-empty-state.guard`) | 9 |
| `RoleEditorSheet` | `/entreprise` › Paramètres › rôles (`OrgRolesSettings`) | à relire dans le code | 9 |
| `InviteModeDialog` | Personnes › inviter | à relire dans le code | 9 |
| `InviteByEmailDialog` | Personnes ou Paramètres › inviter par e-mail | à relire dans le code | 9 |
| `MemberBulkPicker` | annuaire › sélection multiple | à relire dans le code | 9 |
| `OrgSectionSwitcher` | `/entreprise`, changement de section sur téléphone | à relire dans le code | 9 |
| `OrgGlossarySheet` | un terme de rôle souligné (`RoleTerm`) | à relire dans le code | 9 |
| `ProjectEditDialog` | projets › nouveau projet, ou page projet › modifier | à relire dans le code | 9 |
| `PyramidPlacementSheet` | pyramide › placer une personne (sans point d'entrée depuis la mig. 229) | à relire dans le code | 9 |
| `OrgWelcomeVideo` | premier passage dans `/entreprise` : lecteur de la vidéo d'accueil | à relire dans le code | 9 |
| `MobileTaskSearch` | `/tasks` sur téléphone, recherche | à relire dans le code | 4 |
| `MoveCategoryDialog` | `ColorSettingsModal` › déplacer une catégorie | à relire dans le code | · |
| `DeleteTeamCategoryConfirm` | onglet OKR d'équipe › supprimer une catégorie | à relire dans le code | · |
| `MobileMoreSheet` | barre d'onglets, « Plus » | Plus d'options | 3.3 |
| `FirstRunSetup` | premier lancement, compte vide | Bienvenue dans COSMO | 2.4 |
| `TaskActionsSheet` | carte de tâche : appui long, glissement à gauche, ou `contextmenu` (aucun bouton « ⋯ » sur téléphone) | Actions pour \<nom\> | 4.5, 4.6 |
| `MobileAddToList` | feuille d'actions › Ajouter à une liste | Listes 🇫🇷 | 4.7 |
| `ListActionsSheet` | appui long sur une chip de liste | Actions pour la liste \<nom\> 🇫🇷 | 4.8 |
| `CreateListSheet` | barre de chips, nouvelle liste | Nouvelle liste | 4.9 |
| `ShareListSheet` | liste MANUELLE, partager | Partager la liste \<nom\> | 4.10 |
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
| `OffboardMemberDialog` | annuaire ou pyramide › retirer un membre | à relire dans le code | 9.8 |
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
| `TodayTasks`, `CollaborativeTasks` (dialogues de suppression) | `/dashboard`, supprimer une tâche | Supprimer la tâche | 4.11 |
| `RemoveFriendConfirm` | boîte de réception › retirer un ami | Confirmer la suppression de l'ami | à jouer si tu passes par la boîte de réception |
| `ShareInviteClaimer` | ouvrir un lien `/invite/:token` | Tâche partagée avec vous | à jouer si tu as un lien sous la main |

- ⚠️ Un composant mort mais CÂBLÉ compte comme une surface à auditer et coûte du temps à qui le prend pour vivant : supprimer le code mort (`CategoryManager` l'a été ; ce qui survit vit dans `src/lib/category-colors.ts`).

## Annexe B · ce qu'un iPhone ne peut pas atteindre, et pourquoi

| Surface | Pourquoi elle est hors d'atteinte |
|---|---|
| `CommandPalette` | ouverte au clavier, aucun déclencheur tactile |
| `ShortcutsHelp` | ouverte par la touche `?` ou par un événement de la palette. 🇫🇷 son nom, « Raccourcis clavier », est en dur |
| `QuickAddBar` | ouverte par la touche `N` |
| `DesktopAddToList` | `AddToListModal` aiguille sur `useIsMobile()` : au-dessus du point de rupture seulement |
| `BottomSheet` | `WeeklyRecapSheet`, son seul consommateur produit, est derrière `WEEKLY_RECAP_ENABLED = false` |
| `PremiumGateModal` | `PREMIUM_ENFORCED = false` : `isPremium()` répond `true` pour tous, le mur ne s'ouvre jamais |

⚠️ Les trois premières se rouvrent avec un clavier Bluetooth : le dire dans le compte-rendu (« joué avec clavier externe » n'est pas « joué au doigt »).

---

## Registre des séances

Une ligne par séance RÉELLEMENT jouée, jamais avant. Statuts : `✅ joué` (les 12 étapes, témoin compris), `⚠️ partiel` (à refaire : n'éteint PAS l'échéance). Détail des findings : issues (étiquette `zone:accessibilite`), avec le verbatim.

| Date | Appareil (modèle · iOS · Safari) | Statut | Findings |
|---|---|---|---|
| _(aucune séance à ce jour)_ | | | |

## Hors périmètre

Android TalkBack, VoiceOver macOS, le contraste ([`ACCESSIBILITY.md`](./ACCESSIBILITY.md)), la performance. Cet audit répond à UNE question : ce que le produit DIT à quelqu'un qui ne le voit pas, sur l'appareil où il est le plus utilisé.

## Après la séance

1. Une issue par finding (`zone:accessibilite`), verbatim gardé.
2. Refermer l'issue n° 183 (ex `C-24`) : ❌ avant qu'une ligne de ce fichier ait été jouée sur un appareil réel (écrire le protocole ne mesure rien).
3. Mettre à jour [`ACCESSIBILITY.md`](./ACCESSIBILITY.md) en disant ce qui a été mesuré et sur quel appareil.
4. Un audit qui n'a pas pu aller au bout s'écrit « à refaire », pas « fait ».
