import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel page Agenda — montre les gestes drag-and-drop.
 * Démo : un ghost se déplace de la sidebar de tâches vers le calendrier
 * pour illustrer le drop programmatique de planification.
 */
export const agendaTutorialSteps: TutorialStep[] = [
  {
    title: 'Votre agenda 📅',
    description: "Visualisez vos événements et tâches planifiées en jour / semaine / mois. Compatible drag-and-drop avec vos tâches.",
  },
  {
    title: 'Changez de vue',
    description: "Jour pour le détail, Semaine pour la vue d'ensemble (recommandé), Mois pour le contexte large. La vue se change ici.",
    target: '[data-tutorial-id="agenda-view-switcher"]',
    cardPlacement: 'bottom',
    action: 'pulse',
    visibility: 'desktop',
  },
  {
    title: 'Tâches glissables',
    description: "Ouvrez ce panneau pour voir vos tâches non planifiées. Glissez-en une sur le calendrier pour la transformer en événement.",
    target: '[data-tutorial-id="agenda-task-sidebar-toggle"]',
    cardPlacement: 'bottom',
    action: 'click',
    actionDelay: 1500,
    visibility: 'desktop',
  },
  {
    title: 'Glissez-déposez une tâche',
    description: "Démonstration : on glisse une tâche depuis le panneau gauche vers le calendrier. Vous pouvez le faire avec n'importe quelle tâche.",
    target: '[data-tutorial-id="agenda-task-sidebar-toggle"]',
    cardPlacement: 'right',
    action: 'drag-ghost',
    dragTo: '[data-tutorial-id="agenda-calendar-grid"]',
    actionDelay: 600,
    visibility: 'desktop',
  },
  {
    title: 'Cliquez un créneau libre',
    description: "Sur le calendrier, un clic sur un slot horaire vide ouvre directement le formulaire d'événement, pré-rempli à cette heure.",
    target: '[data-tutorial-id="agenda-calendar-grid"]',
    cardPlacement: 'left',
    action: 'pulse',
    visibility: 'desktop',
  },
  {
    title: 'Étirez pour rallonger',
    description: "Cliquez-glissez le bord d'un événement pour étirer ou raccourcir sa durée. Les modifications sont sauvegardées automatiquement.",
    target: '[data-tutorial-id="agenda-calendar-grid"]',
    cardPlacement: 'left',
    action: 'pulse',
    visibility: 'desktop',
  },
  {
    title: 'Vue agenda mobile',
    description: "Sur mobile, l'agenda est une liste verticale par jour. Tappez sur une date pour la centrer, ou utilisez le bouton + pour créer.",
    visibility: 'mobile',
  },
];
