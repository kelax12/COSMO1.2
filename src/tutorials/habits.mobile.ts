import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel Habitudes — MOBILE (cards verticales, validation au tap).
 */
export const habitsTutorialStepsMobile: TutorialStep[] = [
  {
    titleKey: 'habitsMobile.step1Title',
    descriptionKey: 'habitsMobile.step1Desc',
  },
  {
    titleKey: 'habitsMobile.step2Title',
    descriptionKey: 'habitsMobile.step2Desc',
    target: '[data-tutorial-id="habits-view-switcher"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    titleKey: 'habitsMobile.step3Title',
    descriptionKey: 'habitsMobile.step3Desc',
    target: '[data-tutorial-id="habits-fab"]',
    cardPlacement: 'top',
    action: 'pulse',
  },
  {
    titleKey: 'habitsMobile.step4Title',
    descriptionKey: 'habitsMobile.step4Desc',
    target: '[data-tutorial-id="habits-list"]',
    cardPlacement: 'top',
    action: 'pulse',
    dimLevel: 'light',
  },
  {
    titleKey: 'habitsMobile.step5Title',
    descriptionKey: 'habitsMobile.step5Desc',
    target: '[data-tutorial-id="habits-list"]',
    cardPlacement: 'top',
    action: 'pulse',
    dimLevel: 'light',
  },
];
