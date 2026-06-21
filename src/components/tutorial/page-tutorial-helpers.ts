import { TutorialStep, ArrowSide, CardPlacement } from './types';

export interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// État du « ghost persistant » multi-étapes (drag-place / resize-grow / select-create).
// Survit aux changements d'étape via une key stable + Framer Motion interpole entre
// les snapshots successifs.
export interface GhostState {
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: number;
  label: string;
  isDashed?: boolean;
}

// espace entre le rect de la cible et la carte/flèche
export const PADDING = 8;

// ───────────────────────────────────────────────────────────────────
// Helpers : recherche d'élément + calcul du rect (en coordonnées viewport)
// ───────────────────────────────────────────────────────────────────
export const findTarget = (selector: string | undefined): HTMLElement | null => {
  if (!selector) return null;
  try {
    return document.querySelector<HTMLElement>(selector);
  } catch {
    return null;
  }
};

export const getRect = (el: HTMLElement | null): TargetRect | null => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
};

// Calcule où placer la carte : si la cible est dans la moitié haute → carte en bas, sinon en haut
export const autoPlacement = (rect: TargetRect | null): CardPlacement => {
  if (!rect) return 'center';
  const vh = window.innerHeight;
  if (rect.top + rect.height / 2 < vh / 2) return 'bottom';
  return 'top';
};

export const autoArrow = (placement: CardPlacement): ArrowSide => {
  switch (placement) {
    case 'top': return 'bottom';
    case 'bottom': return 'top';
    case 'left': return 'right';
    case 'right': return 'left';
    default: return 'bottom';
  }
};

// ───────────────────────────────────────────────────────────────────
// Actions automatiques (démo)
// ───────────────────────────────────────────────────────────────────
export const runAction = async (step: TutorialStep, target: HTMLElement | null) => {
  if (!step.action || step.action === 'pulse') return; // pulse = effet visuel CSS seulement
  if (!target) return;

  switch (step.action) {
    case 'click':
      target.click();
      break;
    case 'type':
      if (step.typeText && target instanceof HTMLInputElement) {
        target.focus();
        // Tape caractère par caractère (visuellement plus parlant)
        for (const ch of step.typeText) {
          target.value += ch;
          target.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 60));
        }
      }
      break;
    case 'drag-ghost':
      // Démo visuelle : un fantôme glisse du target vers dragTo.
      // C'est purement visuel — pas de manipulation DOM réelle (FullCalendar
      // par exemple ne supporte pas le drag programmatique fiable).
      // Le ghost est créé/déplacé/supprimé par TutorialOverlay.
      break;
    case 'custom':
      if (step.customAction) await step.customAction(target);
      break;
  }
};
