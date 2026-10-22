import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel Tâches — MOBILE (gestes tactiles).
 * 7 étapes : intro → listes → filtres → calendrier → FAB → swipes → bouton "…"
 */
export const tasksTutorialStepsMobile: TutorialStep[] = [
  {
    titleKey: 'tasksMobile.step1Title',
    descriptionKey: 'tasksMobile.step1Desc',
  },
  {
    titleKey: 'tasksMobile.step2Title',
    descriptionKey: 'tasksMobile.step2Desc',
    target: '[data-tutorial-id="tasks-lists"]',
    cardPlacement: 'bottom',
    action: 'pulse',
    dimLevel: 'light',
  },
  {
    // 🔴 Visait `tasks-filter` (rangée du haut) et enseignait « + d'options »,
    // retiré le 2026-09-20 avec la descente de la recherche en bas d'écran.
    // Même erreur que l'étape 7 : un tutoriel qui apprend à chercher une
    // commande absente. Retirer une commande, c'est relire ce qui en parle.
    titleKey: 'tasksMobile.step3Title',
    descriptionKey: 'tasksMobile.step3Desc',
    target: '[data-tutorial-id="tasks-search"]',
    cardPlacement: 'top',
    action: 'pulse',
  },
  {
    // Maquette 140 : le mini-calendrier est rangé dans « Affichage ».
    titleKey: 'tasksMobile.step4Title',
    descriptionKey: 'tasksMobile.step4Desc',
    target: '[data-tutorial-id="tasks-display"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    // Maquette 150 (2026-10-10) : le « + » de /tasks a quitté le FAB global
    // pour la barre du bas. Viser l'ancien FAB aurait enseigné un bouton
    // absent, l'erreur déjà commise deux fois sur ce tutoriel.
    titleKey: 'tasksMobile.step5Title',
    descriptionKey: 'tasksMobile.step5Desc',
    target: '[data-tutorial-id="tasks-create"]',
    cardPlacement: 'top',
    action: 'pulse',
  },
  {
    titleKey: 'tasksMobile.step6Title',
    descriptionKey: 'tasksMobile.step6Desc',
    target: '[data-tutorial-id="tasks-list"]',
    cardPlacement: 'top',
    action: 'pulse',
    dimLevel: 'light',
  },
  // 🔴 L'étape 7 (« Plus simple : le bouton « … » ») a été RETIREE le
  // 2026-09-20. Elle enseignait le bouton « ⋯ » de chaque ligne, que la
  // maquette 86 avait supprimé la veille : le tutoriel apprenait à chercher
  // une commande absente, et c'était la première chose qu'un nouvel arrivant
  // lisait. Défaut introduit par mon propre correctif — retirer une commande,
  // c'est aussi relire ce qui en parle.
  // Les deux clés `tasksMobile.step7*` ont été retirées des catalogues le
  // 2026-09-21 : une clé qu'aucun code ne lit finit par être retraduite,
  // relue en revue, et par faire croire que l'étape existe encore.
];
