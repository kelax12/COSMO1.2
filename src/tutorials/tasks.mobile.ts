import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel page Tâches — MOBILE uniquement.
 * Focalisé sur les gestes tactiles : FAB, swipe gauche/droite, long-press,
 * bouton "…" sur la TaskCard.
 */
export const tasksTutorialStepsMobile: TutorialStep[] = [
  {
    title: 'Bienvenue sur vos tâches 📋',
    description: "Centralisez toutes vos tâches avec priorité, catégorie et deadline. Le tour mobile dure 30 secondes.",
  },
  {
    title: 'Recherche et tri',
    description: "Touchez la zone filtres pour ouvrir/fermer les options. Sur mobile, « + d'options » révèle les filtres rapides Favoris/Terminées/Retard.",
    target: '[data-tutorial-id="tasks-filter"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Mini-calendrier',
    description: "Touchez ce bouton pour afficher un mini-calendrier de vos échéances.",
    target: '[data-tutorial-id="tasks-calendar-toggle"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Créer une tâche',
    description: "Ce bouton flottant en bas à droite ouvre le formulaire de création. Toujours accessible quand vous scrollez.",
    target: '[data-tutorial-id="tasks-fab"]',
    cardPlacement: 'top',
    action: 'pulse',
  },
  {
    title: 'Geste 1 : swipe droite = valider',
    description: "Sur n'importe quelle tâche, glissez le doigt vers la droite. La tâche se valide automatiquement (avec vibration légère).",
    target: '[data-tutorial-id="tasks-list"]',
    cardPlacement: 'top',
    action: 'pulse',
    dimLevel: 'light',
  },
  {
    title: 'Geste 2 : swipe gauche = options',
    description: "Glissez vers la gauche pour révéler les actions : favori, partage, planifier, supprimer.",
    target: '[data-tutorial-id="tasks-list"]',
    cardPlacement: 'top',
    action: 'pulse',
    dimLevel: 'light',
  },
  {
    title: 'Bouton « … »',
    description: "Pas envie de glisser ? Sur chaque tâche, le bouton « … » à droite ouvre le même panneau d'actions. Plus simple.",
    target: '[data-tutorial-id="tasks-list"]',
    cardPlacement: 'top',
    action: 'pulse',
    dimLevel: 'light',
  },
];
