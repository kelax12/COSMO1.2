import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel Agenda — DESKTOP (FullCalendar + drag + resize).
 * La démo drag-and-resize lance une animation complète : un fantôme glisse
 * du panneau Tâches vers la grille, se transforme en bloc événement, puis
 * s'étire vers le bas pour montrer le redimensionnement.
 */
export const agendaTutorialStepsDesktop: TutorialStep[] = [
  {
    title: 'Votre agenda',
    description:
      "Visualisez événements et tâches planifiées. Le drag-and-drop relie vos tâches non planifiées au calendrier en un geste.",
  },
  {
    title: 'Changer de vue',
    description:
      "Jour pour le détail heure par heure. Semaine pour la vue d'ensemble (recommandée). Mois pour le contexte large.",
    target: '[data-tutorial-id="agenda-view-switcher"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Panneau Tâches',
    description:
      "Ce bouton ouvre la barre latérale listant toutes vos tâches non planifiées, prêtes à glisser dans le calendrier.",
    target: '[data-tutorial-id="agenda-task-sidebar-toggle"]',
    cardPlacement: 'bottom',
    action: 'custom',
    actionDelay: 1200,
    customAction: async (target) => {
      if (!target) return;
      // Garantit que le sidebar est ouvert à la fin (nécessaire pour l'étape suivante)
      const isOpen = !!document.getElementById('external-events-container');
      if (isOpen) {
        // Ferme puis rouvre pour montrer l'animation
        target.click();
        await new Promise(r => setTimeout(r, 700));
      }
      target.click();
      await new Promise(r => setTimeout(r, 650));
    },
  },
  {
    title: 'Glisser une tâche vers le calendrier',
    description:
      "Saisissez une tâche dans le panneau, glissez-la sur un créneau horaire et lâchez — elle devient un événement planifié.",
    target: '[data-tutorial-id="agenda-first-task"]',
    cardPlacement: 'right',
    action: 'drag-and-resize',
    dragTo: '[data-tutorial-id="agenda-calendar-grid"]',
    ghostLabel: 'Réviser maths',
    actionDelay: 600,
    dimLevel: 'light',
  },
  {
    title: 'Étirer pour rallonger',
    description:
      "Une fois lâchée, attrapez le bord inférieur de l'événement et glissez vers le bas pour allonger sa durée. La démo le fait pour vous.",
    target: '[data-tutorial-id="agenda-calendar-grid"]',
    cardPlacement: 'inside',
    action: 'pulse',
    dimLevel: 'light',
  },
  {
    title: 'Créer depuis un créneau vide',
    description:
      "Pas envie de drag ? Un simple clic sur un créneau libre ouvre directement le formulaire d'événement, pré-rempli à cette heure.",
    target: '[data-tutorial-id="agenda-calendar-grid"]',
    cardPlacement: 'inside',
    action: 'pulse',
    dimLevel: 'light',
  },
];
