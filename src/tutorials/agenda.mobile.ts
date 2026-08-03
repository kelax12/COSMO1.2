import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel Agenda — MOBILE.
 *
 * UX mobile spécifique :
 *  - Pas de drag-and-drop tâche → grille (réservé au desktop)
 *  - Vue en colonne verticale par jour (FullCalendar timeGridDay)
 *  - Bandeau de dates horizontal en haut + tab bar fixe en bas
 *  - Modales en bottom-sheet
 *
 * Toutes les cartes utilisent `cardPlacement: 'bottom'` (ou 'inside' pour
 * la grille calendrier) — le code de PageTutorial clampe automatiquement
 * la position horizontale dans la viewport, donc aucune carte ne sort de
 * l'écran sur les tailles iPhone SE (375) → iPhone 14 Pro Max (430).
 */
export const agendaTutorialStepsMobile: TutorialStep[] = [
  {
    titleKey: 'agendaMobile.step1Title',
    descriptionKey: 'agendaMobile.step1Desc',
  },
  {
    titleKey: 'agendaMobile.step2Title',
    descriptionKey: 'agendaMobile.step2Desc',
    target: '[data-tutorial-id="agenda-mobile-day-strip"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    titleKey: 'agendaMobile.step3Title',
    descriptionKey: 'agendaMobile.step3Desc',
    target: '[data-tutorial-id="agenda-mobile-view-switcher"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    titleKey: 'agendaMobile.step4Title',
    descriptionKey: 'agendaMobile.step4Desc',
    target: '[data-tutorial-id="agenda-mobile-tasks-toggle"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    titleKey: 'agendaMobile.step5Title',
    descriptionKey: 'agendaMobile.step5Desc',
    target: '[data-tutorial-id="global-quick-add-fab"]',
    cardPlacement: 'top',
    action: 'pulse',
  },
  {
    titleKey: 'agendaMobile.step6Title',
    descriptionKey: 'agendaMobile.step6Desc',
    target: '[data-tutorial-id="agenda-mobile-calendar"]',
    cardPlacement: 'inside',
    // 'custom' avec un no-op évite le gros pulse autour de toute la grille
    action: 'custom',
    customAction: () => { /* spotlight uniquement */ },
    dimLevel: 'light',
  },
];
