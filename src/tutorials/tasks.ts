import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel page Tâches — 6 étapes.
 * Couvre : filtres, calendrier, création, et le geste swipe sur mobile.
 */
export const tasksTutorialSteps: TutorialStep[] = [
  {
    title: 'Bienvenue sur vos tâches 📋',
    description: "Voici votre espace de gestion. Centralisez toutes vos tâches avec priorité, catégorie et deadline. Suivez le tour, on vous montre tout.",
    // Pas de target → carte centrée
  },
  {
    title: 'Filtrez et recherchez',
    description: "Cette zone vous permet de chercher par mot-clé, filtrer par catégorie et ajuster la plage de priorité. Pratique quand votre liste s'allonge.",
    target: '[data-tutorial-id="tasks-filter"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Vue calendrier',
    description: "Ce bouton bascule un mini-calendrier qui montre vos échéances. Idéal pour voir d'un coup d'œil les semaines chargées.",
    target: '[data-tutorial-id="tasks-calendar-toggle"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Créer une tâche',
    description: "Ce bouton ouvre le formulaire de création. Nom, priorité, catégorie, date — le minimum. On le montre maintenant en cliquant pour vous.",
    target: '[data-tutorial-id="tasks-create-button"]',
    cardPlacement: 'bottom',
    action: 'click',
    actionDelay: 1800,
    visibility: 'desktop',
  },
  {
    title: 'Créer une tâche (mobile)',
    description: "Sur mobile, ce bouton flottant en bas à droite ouvre le formulaire de création.",
    target: '[data-tutorial-id="tasks-fab"]',
    cardPlacement: 'top',
    action: 'pulse',
    visibility: 'mobile',
  },
  {
    title: 'Vos tâches',
    description: "Tap pour ouvrir, swipe droite pour valider, swipe gauche ou bouton « … » pour les options (favoris, partage, suppression). En desktop, hover sur une ligne révèle les actions.",
    target: '[data-tutorial-id="tasks-list"]',
    cardPlacement: 'top',
    action: 'pulse',
  },
];
