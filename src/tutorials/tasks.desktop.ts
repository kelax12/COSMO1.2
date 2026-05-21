import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel Tâches — DESKTOP (souris + grand écran).
 * 6 étapes : intro → listes → filtres → calendrier → création → tableau.
 */
export const tasksTutorialStepsDesktop: TutorialStep[] = [
  {
    title: 'Vos tâches en un endroit',
    description:
      "Ici vous gérez toutes vos tâches : titre, priorité (1 = urgent, 5 = peu urgent), catégorie, deadline et temps estimé. Le tour dure 30 secondes.",
  },
  {
    title: 'Listes personnelles',
    description:
      "Cette zone regroupe vos listes (ex : Travail, Maison, Voyage). Cliquez une liste pour ne voir que ses tâches. Le « + » à droite en crée une nouvelle.",
    target: '[data-tutorial-id="tasks-lists"]',
    cardPlacement: 'bottom',
    action: 'pulse',
    dimLevel: 'light',
  },
  {
    title: 'Recherche & filtres',
    description:
      "Tapez un mot-clé pour filtrer instantanément. Sélectionnez une ou plusieurs catégories. Ajustez la fourchette de priorité avec le slider.",
    target: '[data-tutorial-id="tasks-filter"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Vue calendrier',
    description:
      "Affiche vos échéances sous forme de mini-calendrier. Utile pour repérer d'un coup d'œil les semaines surchargées.",
    target: '[data-tutorial-id="tasks-calendar-toggle"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Créer une tâche — on clique pour vous',
    description:
      "Le formulaire de création s'ouvre. Un seul champ obligatoire : le titre. Tout le reste a des valeurs par défaut sensibles.",
    target: '[data-tutorial-id="tasks-create-button"]',
    cardPlacement: 'bottom',
    action: 'click',
    actionDelay: 1800,
  },
  {
    title: 'Le tableau des tâches',
    description:
      "Survolez une ligne avec la souris : les actions apparaissent à droite (favori, planifier dans l'agenda, partager, supprimer). Cliquez une colonne pour trier dessus.",
    target: '[data-tutorial-id="tasks-list"]',
    cardPlacement: 'top',
    action: 'pulse',
    dimLevel: 'light',
  },
];
