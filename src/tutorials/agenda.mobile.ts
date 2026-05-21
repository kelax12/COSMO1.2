import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel Agenda — MOBILE (vue agenda verticale, pas de drag).
 * Sur mobile, FullCalendar est forcé en vue agenda (liste). Le drag-and-drop
 * n'est PAS supporté — on l'indique clairement à l'utilisateur.
 */
export const agendaTutorialStepsMobile: TutorialStep[] = [
  {
    title: 'Votre agenda',
    description:
      "Sur mobile, l'agenda s'affiche en liste verticale par jour — pensé pour le scroll au pouce.",
  },
  {
    title: 'Bandeau de dates',
    description:
      "En haut, un carrousel horizontal affiche les 7 jours suivants. Touchez une date pour la centrer.",
  },
  {
    title: 'Créer un événement',
    description:
      "Le bouton « + » dans le header mobile ouvre le formulaire. L'heure est pré-remplie à l'heure courante.",
  },
  {
    title: 'Panneau Tâches',
    description:
      "Cette icône ouvre vos tâches non planifiées. Touchez une tâche puis « Planifier dans l'agenda » pour la transformer en événement.",
    target: '[data-tutorial-id="agenda-task-sidebar-toggle"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Naviguer entre les mois',
    description:
      "En vue Mois, les flèches gauche/droite changent de mois. Touchez une date pour zoomer sur la journée.",
  },
  {
    title: 'Astuce : drag réservé au desktop',
    description:
      "Le glisser-déposer d'une tâche sur la grille n'existe que sur ordinateur. Sur mobile, créez l'événement via le bouton + et choisissez la tâche associée.",
  },
];
