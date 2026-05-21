import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel page Tâches — DESKTOP uniquement.
 * Focalisé sur les actions hover/click et le tableau desktop.
 */
export const tasksTutorialStepsDesktop: TutorialStep[] = [
  {
    title: 'Bienvenue sur vos tâches 📋',
    description: "Centralisez toutes vos tâches avec priorité, catégorie et deadline. Suivez le tour, on vous montre tout en 5 étapes.",
  },
  {
    title: 'Recherche et filtres',
    description: "Cherchez par mot-clé, filtrez par catégorie, ajustez la plage de priorité. Pratique quand la liste s'allonge.",
    target: '[data-tutorial-id="tasks-filter"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Vue calendrier',
    description: "Ce bouton bascule un mini-calendrier qui montre vos échéances par semaine. Idéal pour visualiser les périodes chargées.",
    target: '[data-tutorial-id="tasks-calendar-toggle"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Créer une tâche',
    description: "On clique pour vous : ce bouton ouvre le formulaire de création. Nom, priorité, catégorie, date — le minimum.",
    target: '[data-tutorial-id="tasks-create-button"]',
    cardPlacement: 'bottom',
    action: 'click',
    actionDelay: 1800,
  },
  {
    title: 'Tableau de tâches',
    description: "Cliquez une ligne pour ouvrir. Survolez avec la souris pour révéler les actions à droite : favori, planifier, partager, supprimer. Triez en cliquant sur les en-têtes de colonne.",
    target: '[data-tutorial-id="tasks-list"]',
    cardPlacement: 'top',
    action: 'pulse',
    dimLevel: 'light',
  },
];
