import { TutorialStep } from '@/components/tutorial/types';

/**
 * Tutoriel OKR — DESKTOP.
 */
export const okrTutorialStepsDesktop: TutorialStep[] = [
  {
    title: 'Définissez votre cap.',
    description:
      "OKR = Objective (votre but) + Key Results (métrique). Clarté et alignement garantis.",
  },
  {
    title: 'Filtrer par catégorie',
    description:
      "Segmentez vos OKR / Travail, Personnel, Santé... Filtrez par domaine. Le « + » crée une catégorie.",
    target: '[data-tutorial-id="okr-category-filter"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Créer un objectif',
    description:
      "Définissez un objectif et décomposez le en métriques (KR).",
    target: '[data-tutorial-id="okr-create-button"]',
    cardPlacement: 'bottom',
    action: 'pulse',
  },
  {
    title: 'Transformez vos métriques.',
    description:
      "ajoutez des métriques dans votre to do liste ou dans votre agenda.",
    target: '[data-tutorial-id="okr-first-card"]',
    cardPlacement: 'top',
    action: 'custom',
    dimLevel: 'light',
    customAction: async (target) => {
      if (!target) return;

      // Attendre que les boutons soient visibles
      await new Promise(r => setTimeout(r, 300));

      // Trouver les boutons d'action CheckCircle et Calendar
      const krElements = target.querySelectorAll('[class*="gap-1"]');
      if (krElements.length === 0) return;

      // On cherche les deux premiers boutons d'action (CheckCircle et Calendar)
      const buttons = target.querySelectorAll('button[title]');
      const addTaskBtn = Array.from(buttons).find(btn => btn.getAttribute('title') === 'Créer une tâche') as HTMLElement;
      const addEventBtn = Array.from(buttons).find(btn => btn.getAttribute('title') === 'Planifier un événement') as HTMLElement;

      if (!addTaskBtn || !addEventBtn) return;

      // Créer un conteneur SVG pour les flèches
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.setAttribute('style', 'position: absolute; top: 0; left: 0; pointer-events: none; z-index: 40');

      // Animer les flèches
      const animateArrow = (btnElement: HTMLElement, index: number) => {
        const rect = btnElement.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();

        const startX = rect.left - targetRect.left + rect.width / 2;
        const startY = rect.top - targetRect.top + rect.height / 2;

        // Créer une flèche animée avec pulse
        const arrowGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        arrowGroup.setAttribute('style', `animation: pulse 1.5s ease-in-out infinite`);

        // Cercle autour du bouton - vert, plus gros
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', String(startX));
        circle.setAttribute('cy', String(startY));
        circle.setAttribute('r', '28');
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', '#10b981');
        circle.setAttribute('stroke-width', '3');

        arrowGroup.appendChild(circle);
        svg.appendChild(arrowGroup);
      };

      animateArrow(addTaskBtn, 0);
      animateArrow(addEventBtn, 1);

      // Ajouter le style pour l'animation pulse
      const style = document.createElement('style');
      style.textContent = `
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `;
      document.head.appendChild(style);

      target.style.position = 'relative';
      target.appendChild(svg);

      // Nettoyage à la fin
      return () => {
        svg.remove();
        style.remove();
      };
    },
  },
];
