import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel page Agenda — MOBILE uniquement.
 * Sur mobile, l'agenda est une vue agenda verticale (liste par jour),
 * pas une grille FullCalendar. Le drag-and-drop n'est PAS disponible
 * (le calendrier mobile force currentView='agenda' en lecture-tap).
 * Le tutoriel mobile explique donc :
 *   - sélecteur de jour en haut (carrousel)
 *   - création via le bouton + (header mobile)
 *   - tap sur une journée pour la centrer
 */
export const agendaTutorialStepsMobile: TutorialStep[] = [
  {
    title: 'Votre agenda 📅',
    description: "Vue agenda mobile : une liste verticale par jour, optimisée pour le scroll. Plus simple que la grille desktop.",
  },
  {
    title: 'Carrousel de dates',
    description: "En haut de l'écran, un carrousel horizontal vous laisse voir 7 jours à la fois. Touchez une date pour la centrer.",
    // Pas de target précis — la zone change selon le mois affiché.
  },
  {
    title: 'Bouton + pour créer',
    description: "Le bouton + dans le header mobile ouvre le formulaire d'événement, pré-rempli à l'heure courante.",
  },
  {
    title: 'Ouvrez le panneau Tâches',
    description: "L'icône Calendrier en haut à gauche ouvre votre liste de tâches non planifiées — utile pour piocher une tâche à planifier.",
    target: '[data-tutorial-id="agenda-task-sidebar-toggle"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Mois et navigation',
    description: "Sur la vue mois mobile, les flèches gauche/droite naviguent entre les mois. Touchez une date pour zoomer sur la journée.",
  },
  {
    title: 'Astuce : drag desktop only',
    description: "Le glisser-déposer d'une tâche sur la grille n'est disponible que sur desktop. Sur mobile, créez l'événement via le bouton + et liez la tâche manuellement.",
    dimLevel: 'normal',
  },
];
