import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel Habitudes — DESKTOP.
 */
export const habitsTutorialStepsDesktop: TutorialStep[] = [
  {
    titleKey: 'habitsDesktop.step1Title',
    descriptionKey: 'habitsDesktop.step1Desc',
  },
  {
    titleKey: 'habitsDesktop.step2Title',
    descriptionKey: 'habitsDesktop.step2Desc',
    target: '[data-tutorial-id="habits-view-switcher"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    titleKey: 'habitsDesktop.step3Title',
    descriptionKey: 'habitsDesktop.step3Desc',
    target: '[data-tutorial-id="habits-create-button"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    titleKey: 'habitsDesktop.step4Title',
    descriptionKey: 'habitsDesktop.step4Desc',
    target: '[data-tutorial-id="habits-list"]',
    cardPlacement: 'top',
    action: 'pulse',
    dimLevel: 'light',
  },
];
