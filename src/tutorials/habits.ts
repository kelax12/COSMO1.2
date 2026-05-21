import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel page Habitudes — 5 étapes.
 */
export const habitsTutorialSteps: TutorialStep[] = [
  {
    title: 'Vos habitudes 🔁',
    description: "Les habitudes sont le moteur du progrès quotidien. Cosmo suit votre régularité, votre série de jours consécutifs, et votre taux de complétion.",
  },
  {
    title: 'Changez de vue',
    description: "Liste pour le détail jour, Tableau pour la grille des 30 derniers jours, Suivi global pour les stats agrégées.",
    target: '[data-tutorial-id="habits-view-switcher"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Créer une habitude',
    description: "Ce bouton ouvre le formulaire. Définissez un nom, une couleur et une cadence (quotidienne, hebdo, X fois par semaine).",
    target: '[data-tutorial-id="habits-create-button"]',
    cardPlacement: 'bottom',
    action: 'pulse',
    visibility: 'desktop',
  },
  {
    title: 'Créer une habitude (mobile)',
    description: "Bouton flottant en bas à droite : tappez pour ouvrir le formulaire de création.",
    target: '[data-tutorial-id="habits-fab"]',
    cardPlacement: 'top',
    action: 'pulse',
    visibility: 'mobile',
  },
  {
    title: 'Cochez chaque jour',
    description: "Sur chaque habit, le bouton ✓ valide la journée. Votre série s'allonge. Si vous oubliez un jour, la série repart à zéro — c'est la règle.",
    target: '[data-tutorial-id="habits-list"]',
    cardPlacement: 'top',
    action: 'pulse',
  },
];
