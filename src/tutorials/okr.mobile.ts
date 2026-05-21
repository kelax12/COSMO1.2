import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel page OKR — MOBILE uniquement.
 * Sur mobile les cartes occupent toute la largeur, le FAB remplace le
 * bouton header de création, et certaines actions sont accessibles via
 * tap long ou menu contextuel.
 */
export const okrTutorialStepsMobile: TutorialStep[] = [
  {
    title: 'Vos OKR 🎯',
    description: "Objectives & Key Results : la méthode pour piloter ce qui compte vraiment. Un objectif = un cap. Des KR = des indicateurs de progression.",
  },
  {
    title: 'Filtres catégorie',
    description: "Scroll horizontal sur les chips de catégorie pour filtrer la liste. Très utile quand vous aurez plusieurs domaines.",
    target: '[data-tutorial-id="okr-category-filter"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Créer un objectif',
    description: "Le bouton flottant en bas à droite ouvre le formulaire de création. Définissez 3 à 5 KR mesurables — pas plus, sinon vous diluez.",
    // Pas de target — le FAB OKR n'a pas encore de data-tutorial-id dédié,
    // on garde la carte centrée pour ne pas pointer vers un élément absent.
  },
  {
    title: "Une carte = un objectif",
    description: "Chaque carte est cliquable. Catégorie en haut, titre, jauge de santé, et la liste des KR avec leur progression. Touchez un KR pour ajuster.",
    target: '[data-tutorial-id="okr-first-card"]',
    cardPlacement: 'top',
    action: 'pulse',
    dimLevel: 'light',
  },
  {
    title: 'Astuce : créez des tâches liées',
    description: "Une tâche peut faire avancer un KR. Construisez vos OKR d'abord, puis créez les tâches qui y mènent — votre dashboard reflétera la progression.",
  },
];
