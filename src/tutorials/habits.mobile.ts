import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel Habitudes — MOBILE (cards verticales, validation au tap).
 */
export const habitsTutorialStepsMobile: TutorialStep[] = [
  {
    title: 'Construire vos habitudes',
    description:
      "Une habitude = un comportement à répéter chaque jour ou plusieurs fois par semaine. Un tap suffit pour valider la journée.",
  },
  {
    title: 'Trois vues',
    description:
      "Liste (recommandée mobile) : une carte par habitude. Tableau : grille 30 jours scrollable horizontalement. Suivi global : stats.",
    target: '[data-tutorial-id="habits-view-switcher"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Créer une habitude',
    description:
      "Le bouton flottant en bas à droite ouvre le formulaire. Nom, couleur, cadence : 30 secondes pour configurer.",
    target: '[data-tutorial-id="habits-fab"]',
    cardPlacement: 'top',
    action: 'pulse',
  },
  {
    title: 'Valider d\'un tap',
    description:
      "Touchez le bouton ✓ sur une habitude pour marquer aujourd'hui comme fait. La carte change de couleur. Re-tapez pour défaire en cas d'erreur.",
    target: '[data-tutorial-id="habits-list"]',
    cardPlacement: 'top',
    action: 'pulse',
    dimLevel: 'light',
  },
  {
    title: 'Mini heatmap',
    description:
      "Sous chaque habitude, une bande montre vos 30 derniers jours : plus c'est rempli, plus votre constance est élevée. Coup d'œil rapide sur votre régularité.",
    target: '[data-tutorial-id="habits-list"]',
    cardPlacement: 'top',
    action: 'pulse',
    dimLevel: 'light',
  },
];
