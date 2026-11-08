# ADR 0016 · FullCalendar 6, tant que l'agenda n'est pas réécrit

- **Statut** : acceptée
- **Date** : 2026-11-08 (vague 18.2 du plan de reprise, constat DEP-01)

## Contexte

L'audit externe du 2026-11-06 relève FullCalendar 6 avec une majeure de retard (`npm outdated` du
2026-11-08 : `@fullcalendar/core` et `@fullcalendar/react` en 7.1.4, les plugins `daygrid`,
`timegrid` et `interaction` restent en 6.1.22, leur dernière version publiée).

FullCalendar 7 n'est pas une montée de version, c'est un autre composant
([guide de l'éditeur](https://fullcalendar.io/docs/upgrading-from-v6)) :

- **plus aucune classe `fc-*`** dans le DOM, et **plus de thème par défaut** : il faut en choisir un
  et l'importer ;
- variables CSS renommées, barre d'outils réécrite (`customButtons` devient `buttons`,
  `buttonText` disparaît, `headerToolbar` est coupé par défaut) ;
- options renommées : `eventClassNames` → `eventClass`, `slotLabel*` → `slotHeader*`,
  `backgroundColor` / `borderColor` → `color`, `textColor` → `contrastColor` ;
- `updateSize()` supprimé ; plugins standard déplacés sous `@fullcalendar/react/*` ; nouvelle
  dépendance `temporal-polyfill`.

Mesuré dans le dépôt le même jour : **84 références à des classes `fc-*`** (dont 32 dans
`src/index.css`), réparties entre l'agenda (`src/pages/agenda/`), le glisser de tâches vers la
grille, les gestes tactiles, le défilement focalisable, deux tutoriels (`src/tutorials/agenda.desktop.ts`,
`src/components/tutorial/types.ts`) et trois specs E2E (`a11y-audit`, `a11y-keyboard-audit`,
`visual-regression`). S'y ajoutent 50 couleurs d'évènement en `backgroundColor` / `borderColor`,
7 `textColor`, 9 `slotLabel*`, 3 `eventClassNames`, 4 `headerToolbar` et 3 `updateSize`.

## Décision

**FullCalendar 7 est écarté.** Le dépôt reste en FullCalendar 6.1. La montée demanderait de
reconstruire le thème de l'agenda, ses sélecteurs, ses gestes et ses tutoriels, puis de
régénérer les références visuelles de l'agenda : c'est une réécriture de l'écran, pas une
mise à jour de dépendance. Elle n'a pas sa place dans une vague qui exige un rendu inchangé, et
l'agenda est en même temps l'objet d'une vague de l'autre chantier (vague 14, agenda par
fenêtre ; tests d'écran de `AgendaPage` en cours, vague 15.2).

## Conséquences

- **Positives.** L'agenda reste tel qu'il est ; aucune référence visuelle ne bouge.
- **Négatives.** Une majeure de retard, et une version 6 qui ne recevra plus que des correctifs.
  La proposition de Dependabot (`@fullcalendar/core` 7 seul) est à écarter : le cœur 7 casserait le
  connecteur React et les plugins, restés en 6.
- **Ce qui rouvre la décision.** Une réécriture de l'agenda décidée pour elle-même (vague 14 ou
  suivante). Alors : choisir le thème (le thème « Classic » garde l'aspect de la 6), remplacer
  chaque sélecteur `fc-*` par les réglages `*Class` et les points d'accroche de rendu, adapter le
  glisser, les gestes et les tutoriels, et faire régénérer les références visuelles par la
  procédure revue de la vague 15.4.
- **À ne pas faire.** Ne pas monter `@fullcalendar/core` seul, ni accepter la proposition de Dependabot :
  les plugins 6 et le connecteur 6 ne fonctionnent pas avec le cœur 7.
