import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel Tâches — MOBILE (gestes tactiles).
 * 7 étapes : intro → listes → filtres → calendrier → FAB → swipes → bouton "…"
 */
export const tasksTutorialStepsMobile: TutorialStep[] = [
  {
    title: 'Vos tâches en un endroit',
    description:
      "Ici vous gérez toutes vos tâches. 7 étapes pour découvrir les gestes mobiles — swipe, tap long, bouton « … ».",
  },
  {
    title: 'Listes personnelles',
    description:
      "Vos listes (Travail, Courses, Voyage…) se trouvent ici. Touchez une liste pour filtrer. Faites glisser le carrousel pour voir toutes vos listes.",
    target: '[data-tutorial-id="tasks-lists"]',
    cardPlacement: 'bottom',
    action: 'pulse',
    dimLevel: 'light',
  },
  {
    title: 'Recherche & filtres',
    description:
      "Tapez pour chercher. Touchez « + d'options » pour révéler les filtres rapides : Favoris, Terminées, En retard, Collaboration.",
    target: '[data-tutorial-id="tasks-filter"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Mini-calendrier',
    description:
      "Affiche vos échéances sur une semaine. Touchez ce bouton pour l'afficher ou le masquer.",
    target: '[data-tutorial-id="tasks-calendar-toggle"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Créer une tâche',
    description:
      "Ce bouton flottant est accessible depuis toutes les pages. Il ouvre la création rapide : tapez « Appeler le dentiste jeudi 10h » et la date est comprise automatiquement.",
    target: '[data-tutorial-id="global-quick-add-fab"]',
    cardPlacement: 'top',
    action: 'pulse',
  },
  {
    title: 'Geste : glisser à droite pour valider',
    description:
      "Sur une tâche, glissez votre doigt vers la droite. Une zone verte « Valider » apparaît. Lâchez : la tâche est cochée (avec une légère vibration).",
    target: '[data-tutorial-id="tasks-list"]',
    cardPlacement: 'top',
    action: 'pulse',
    dimLevel: 'light',
  },
  {
    title: 'Plus simple : le bouton « … »',
    description:
      "Pas envie de glisser ? Le bouton « … » à droite de chaque tâche ouvre le panneau d'actions : favori, partage, planifier, supprimer.",
    target: '[data-tutorial-id="tasks-list"]',
    cardPlacement: 'top',
    action: 'pulse',
    dimLevel: 'light',
  },
];
