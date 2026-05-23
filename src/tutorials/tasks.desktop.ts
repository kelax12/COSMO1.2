import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel Tâches — DESKTOP (souris + grand écran).
 * 6 étapes : intro → listes → filtres → calendrier → création → tableau.
 */
export const tasksTutorialStepsDesktop: TutorialStep[] = [
  {
    title: 'Toutes vos tâches en un endroit',
    description:
      "Titre, priorité, catégorie, deadline, durée. Tout ce qu'il faut pour gérer vos tâches.",
  },
  {
    title: 'Organisez par listes',
    description:
      "Groupez vos tâches en listes (Travail, Maison, Projets...). Cliquez sur une liste pour la consulter seule.",
    target: '[data-tutorial-id="tasks-lists"]',
    cardPlacement: 'bottom',
    action: 'pulse',
    dimLevel: 'light',
  },
  {
    title: 'Trouvez ce que vous cherchez',
    description:
      "Recherche par mot-clé, filtre par catégorie, slider de priorité. En un instant.",
    target: '[data-tutorial-id="tasks-filter"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Visualisez vos deadlines',
    description:
      "Mini-calendrier des échéances. Identifiez les semaines surchargées en un coup d'œil.",
    target: '[data-tutorial-id="tasks-calendar-toggle"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Créer une tâche',
    description:
      "Organisez votre travail en tâches pour une meilleure efficacité.",
    target: '[data-tutorial-id="tasks-create-button"]',
    cardPlacement: 'bottom',
    action: 'click',
    actionDelay: 1800,
  },
  {
    title: 'Tableau des tâches',
    description:
      "visualisez en un coup d'œil toutes vos tâches",
    target: '[data-tutorial-id="tasks-list"]',
    cardPlacement: 'top',
    action: 'pulse',
    dimLevel: 'light',
  },
];
