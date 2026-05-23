import React, { useEffect, useState, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, X, ArrowDown, ArrowUp } from 'lucide-react';
import { TutorialStep, ArrowSide, CardPlacement } from './types';

interface PageTutorialProps {
  /** Liste ordonnée des étapes */
  steps: TutorialStep[];
  /** isOpen / close fournis par useTutorial */
  isOpen: boolean;
  onClose: () => void;
  /** Couleur d'accent (anneau spotlight, flèche, boutons). Défaut bleu. */
  accentColor?: string;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// État du « ghost persistant » multi-étapes (drag-place / resize-grow / select-create).
// Survit aux changements d'étape via une key stable + Framer Motion interpole entre
// les snapshots successifs.
interface GhostState {
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: number;
  label: string;
  isDashed?: boolean;
}

// ───────────────────────────────────────────────────────────────────
// Helpers : recherche d'élément + calcul du rect (en coordonnées viewport)
// ───────────────────────────────────────────────────────────────────
const findTarget = (selector: string | undefined): HTMLElement | null => {
  if (!selector) return null;
  try {
    return document.querySelector<HTMLElement>(selector);
  } catch {
    return null;
  }
};

const getRect = (el: HTMLElement | null): TargetRect | null => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
};

// Calcule où placer la carte : si la cible est dans la moitié haute → carte en bas, sinon en haut
const autoPlacement = (rect: TargetRect | null): CardPlacement => {
  if (!rect) return 'center';
  const vh = window.innerHeight;
  if (rect.top + rect.height / 2 < vh / 2) return 'bottom';
  return 'top';
};

const autoArrow = (placement: CardPlacement): ArrowSide => {
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
const runAction = async (step: TutorialStep, target: HTMLElement | null) => {
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

// ───────────────────────────────────────────────────────────────────
// Flèche animée
// ───────────────────────────────────────────────────────────────────
const TutorialArrow: React.FC<{ side: ArrowSide; color: string }> = ({ side, color }) => {
  // Anim spring vers le centre de la cible (légère bobine)
  const variants = {
    top:    { initial: { y: -30 }, animate: { y: 0 } },
    bottom: { initial: { y:  30 }, animate: { y: 0 } },
    left:   { initial: { x: -30 }, animate: { x: 0 } },
    right:  { initial: { x:  30 }, animate: { x: 0 } },
  } as const;

  const Icon = side === 'top' ? ArrowDown
             : side === 'bottom' ? ArrowUp
             : side === 'left' ? ArrowRight
             : ArrowLeft;

  return (
    <motion.div
      initial={variants[side].initial}
      animate={[variants[side].animate, variants[side].initial, variants[side].animate]}
      transition={{ duration: 0.9, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
      style={{ color }}
      className="drop-shadow-[0_4px_8px_rgba(0,0,0,0.4)]"
    >
      <Icon size={44} strokeWidth={3} />
    </motion.div>
  );
};

// ───────────────────────────────────────────────────────────────────
// Composant principal
// ───────────────────────────────────────────────────────────────────
const PADDING = 8; // espace entre le rect de la cible et la carte/flèche

const PageTutorial: React.FC<PageTutorialProps> = ({ steps, isOpen, onClose, accentColor = '#3B82F6' }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [dragGhost, setDragGhost] = useState<{ from: TargetRect; to: TargetRect } | null>(null);
  const [ghost, setGhost] = useState<GhostState | null>(null);
  const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ghostTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Filtre les étapes selon viewport
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const visibleSteps = steps.filter(s =>
    !s.visibility || s.visibility === 'both' ||
    (s.visibility === 'mobile' && isMobile) ||
    (s.visibility === 'desktop' && !isMobile)
  );
  const step = visibleSteps[stepIndex];
  const totalSteps = visibleSteps.length;

  // Mesure la cible + relance lors d'un changement d'étape / resize / scroll
  useLayoutEffect(() => {
    if (!isOpen || !step) return;

    const measure = () => {
      const el = findTarget(step.target);
      setTargetRect(getRect(el));

      // Drag-ghost OU drag-and-resize : mesurer aussi la destination
      const needsGhost = step.action === 'drag-ghost' || step.action === 'drag-and-resize';
      if (needsGhost && step.dragTo) {
        const dst = findTarget(step.dragTo);
        const fromRect = getRect(el);
        const toRect = getRect(dst);
        if (fromRect && toRect) {
          setDragGhost({ from: fromRect, to: toRect });
        } else {
          setDragGhost(null);
        }
      } else {
        setDragGhost(null);
      }
    };

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [isOpen, step, stepIndex]);

  // Lance l'action auto après actionDelay
  useEffect(() => {
    if (!isOpen || !step) return;
    if (actionTimerRef.current) clearTimeout(actionTimerRef.current);

    const delay = step.actionDelay ?? 800;
    actionTimerRef.current = setTimeout(async () => {
      const el = findTarget(step.target);
      await runAction(step, el);
      // Re-mesure après l'action (couvre les customAction qui changent le DOM,
      // ex. ouverture du sidebar tâches avant un drag-and-resize)
      const newEl = findTarget(step.target);
      const newRect = getRect(newEl);
      if (newRect) {
        setTargetRect(newRect);
        const needsGhost = step.action === 'drag-ghost' || step.action === 'drag-and-resize';
        if (needsGhost && step.dragTo) {
          const dst = findTarget(step.dragTo);
          const toRect = getRect(dst);
          setDragGhost(newRect && toRect ? { from: newRect, to: toRect } : null);
        }
      }
    }, delay);

    return () => {
      if (actionTimerRef.current) clearTimeout(actionTimerRef.current);
    };
  }, [isOpen, step, stepIndex]);

  // ─────────────────────────────────────────────────────────────────
  // Ghost persistant — drive l'animation séquencée à chaque step change.
  // ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !step) return;
    // Cleanup des timers précédents
    ghostTimersRef.current.forEach(clearTimeout);
    ghostTimersRef.current = [];

    const queue = (ms: number, fn: () => void) => {
      ghostTimersRef.current.push(setTimeout(fn, ms));
    };
    const rectOf = (sel: string | undefined): TargetRect | null =>
      sel ? getRect(findTarget(sel)) : null;

    const anim = step.ghostAnimation;
    if (!anim) {
      // Pas de ghost pour cette étape — on l'efface si présent
      setGhost(null);
      return;
    }

    const placeRect = rectOf(step.placeTarget);
    const gridRect = rectOf(step.dragTo);
    // Y visible du calendrier (sous les en-têtes de colonnes ~40-60px)
    const visibleTopY = (gridRect?.top ?? placeRect?.top ?? 100) + 56;

    if (anim === 'drag-place') {
      const fromRect = rectOf(step.target);
      if (!fromRect || !placeRect) return;
      const label = step.ghostLabel || 'Tâche';
      // Apparition discrète sur la tâche source (sidebar)
      setGhost({
        x: fromRect.left + 4,
        y: fromRect.top + 4,
        w: Math.max(80, fromRect.width - 8),
        h: 36,
        opacity: 0,
        label,
      });
      queue(80, () => setGhost(g => g && { ...g, opacity: 1 }));
      // Voyage vers la colonne mercredi + adopte sa largeur
      queue(700, () =>
        setGhost({
          x: placeRect.left + 1,
          y: visibleTopY + 40,
          w: placeRect.width - 2,
          h: 72,
          opacity: 0.95,
          label,
        })
      );
    } else if (anim === 'resize-grow') {
      if (!placeRect) return;
      const label = step.ghostLabel || 'Tâche';
      // Force l'état "posé" (au cas où on arrive par back-navigation)
      setGhost({
        x: placeRect.left + 1,
        y: visibleTopY + 40,
        w: placeRect.width - 2,
        h: 72,
        opacity: 0.95,
        label,
      });
      // Étirement vers le bas
      queue(700, () => setGhost(g => g && { ...g, h: 168 }));
    } else if (anim === 'select-create') {
      if (!placeRect) return;
      const label = step.ghostLabel || 'Tâche';
      // 1. État initial : événement précédent (depuis step 5)
      setGhost({
        x: placeRect.left + 1,
        y: visibleTopY + 40,
        w: placeRect.width - 2,
        h: 168,
        opacity: 0.95,
        label,
      });
      // 2. L'événement précédent disparaît
      queue(350, () => setGhost(g => g && { ...g, opacity: 0 }));
      // 3. Rectangle de sélection apparaît plus bas, hauteur minimale
      queue(900, () =>
        setGhost({
          x: placeRect.left + 1,
          y: visibleTopY + 260,
          w: placeRect.width - 2,
          h: 6,
          opacity: 0.55,
          label: '',
          isDashed: true,
        })
      );
      // 4. La sélection grandit (simule le drag pour sélectionner une plage)
      queue(1200, () => setGhost(g => g && { ...g, h: 120 }));
      // 5. Solidification en événement créé
      queue(2050, () =>
        setGhost(g =>
          g && {
            ...g,
            opacity: 0.95,
            isDashed: false,
            label,
          }
        )
      );
      // 6. Fade out final à la fin de l'étape 6
      queue(3300, () => setGhost(g => g && { ...g, opacity: 0 }));
    }

    return () => {
      ghostTimersRef.current.forEach(clearTimeout);
      ghostTimersRef.current = [];
    };
  }, [isOpen, step, stepIndex]);

  // Cleanup ghost quand le tutoriel se ferme
  useEffect(() => {
    if (!isOpen) setGhost(null);
  }, [isOpen]);

  // Verrou body scroll quand ouvert
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  // Clavier ←→ ESC
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
      else if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, stepIndex]);

  // Réinitialise l'index si on rouvre le tuto
  useEffect(() => {
    if (isOpen) setStepIndex(0);
  }, [isOpen]);

  if (!isOpen || !step) return null;

  const handleClose = () => {
    onClose();
    setStepIndex(0);
  };
  const handleNext = () => {
    if (stepIndex >= totalSteps - 1) {
      handleClose();
    } else {
      setStepIndex(i => i + 1);
    }
  };
  const handlePrev = () => {
    if (stepIndex > 0) setStepIndex(i => i - 1);
  };

  const placement = step.cardPlacement ?? autoPlacement(targetRect);
  const arrowSide = step.arrowSide ?? autoArrow(placement);

  // ───────────── Calcul des positions ─────────────
  const CARD_W = 320;
  const CARD_H = 200; // estimé — le contenu est plutôt court

  let cardStyle: React.CSSProperties = {};
  let arrowStyle: React.CSSProperties = {};

  if (targetRect) {
    const cx = targetRect.left + targetRect.width / 2;
    const cy = targetRect.top + targetRect.height / 2;

    switch (placement) {
      case 'top':
        cardStyle = {
          top: targetRect.top - CARD_H - 56,
          left: Math.max(16, Math.min(window.innerWidth - CARD_W - 16, cx - CARD_W / 2)),
        };
        arrowStyle = { top: targetRect.top - 50, left: cx - 22 };
        break;
      case 'bottom':
        cardStyle = {
          top: targetRect.top + targetRect.height + 56,
          left: Math.max(16, Math.min(window.innerWidth - CARD_W - 16, cx - CARD_W / 2)),
        };
        arrowStyle = { top: targetRect.top + targetRect.height + 6, left: cx - 22 };
        break;
      case 'left':
        cardStyle = {
          top: Math.max(16, Math.min(window.innerHeight - CARD_H - 16, cy - CARD_H / 2)),
          left: targetRect.left - CARD_W - 56,
        };
        arrowStyle = { top: cy - 22, left: targetRect.left - 50 };
        break;
      case 'right':
        cardStyle = {
          top: Math.max(16, Math.min(window.innerHeight - CARD_H - 16, cy - CARD_H / 2)),
          left: targetRect.left + targetRect.width + 56,
        };
        arrowStyle = { top: cy - 22, left: targetRect.left + targetRect.width + 6 };
        break;
      case 'inside':
        // Carte à l'intérieur du rect cible, angle haut-droite (utile quand la
        // cible occupe tout l'écran et qu'aucune direction externe n'est visible)
        cardStyle = {
          top: Math.max(16, targetRect.top + 60),
          left: Math.max(16, Math.min(window.innerWidth - CARD_W - 16,
            targetRect.left + targetRect.width - CARD_W - 24)),
        };
        // Pas de flèche pour 'inside' (on est à l'intérieur de l'élément)
        break;
      default:
        cardStyle = {
          top: window.innerHeight / 2 - CARD_H / 2,
          left: window.innerWidth / 2 - CARD_W / 2,
        };
    }
  } else {
    // Sans target → centre écran (en pixels — pas de translate() car Framer Motion
    // applique son propre transform pour scale, qui écraserait translate(-50%,-50%))
    cardStyle = {
      top: Math.max(16, window.innerHeight / 2 - CARD_H / 2),
      left: Math.max(16, window.innerWidth / 2 - CARD_W / 2),
    };
  }

  // ───────────── Rendu (Portal pour échapper aux z-index parents) ─────────────
  return createPortal(
    <AnimatePresence>
      <motion.div
        key="tut-root"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[500] pointer-events-none"
        aria-live="polite"
      >
        {/* ── Voile assombrissant ──
            Sans target → voile plein écran (pour les étapes "welcome" centrées).
            Avec target → on ne pose PAS de fullscreen overlay (sinon backdrop-filter
            blur flouterait la cible visible à travers le trou). C'est la boxShadow
            massive du "hole" qui crée le voile autour de la cible — sans blur. */}
        {!targetRect && (
          <motion.div
            className="absolute inset-0 pointer-events-auto"
            style={{ background: 'rgba(8, 12, 24, 0.72)' }}
            onClick={handleNext}
          />
        )}

        {/* Hole : rectangle transparent par-dessus la cible.
            La boxShadow étend une couleur massive vers l'extérieur → dim ambiant.
            On NE met PAS de blur → la cible reste nette. */}
        {targetRect && (() => {
          const dim = step.dimLevel ?? 'normal';
          const dimRgba =
            dim === 'none'   ? 'rgba(8, 12, 24, 0)' :
            dim === 'light'  ? 'rgba(8, 12, 24, 0.35)' :
                               'rgba(8, 12, 24, 0.72)';
          return (
            <>
              {/* Layer de capture des clics (clic = next), même rect que le voile */}
              <div
                className="absolute inset-0 pointer-events-auto"
                onClick={handleNext}
                aria-hidden
              />
              <motion.div
                key={`hole-${stepIndex}`}
                initial={{ opacity: 0, scale: 1.08 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', damping: 22, stiffness: 320 }}
                className="absolute pointer-events-none"
                style={{
                  top: targetRect.top - PADDING,
                  left: targetRect.left - PADDING,
                  width: targetRect.width + PADDING * 2,
                  height: targetRect.height + PADDING * 2,
                  borderRadius: 14,
                  boxShadow: `0 0 0 9999px ${dimRgba}, 0 0 0 4px ${accentColor}, 0 0 24px 4px ${accentColor}55`,
                }}
              />
            </>
          );
        })()}

        {/* Pulse animation sur la cible quand action='pulse' ou par défaut */}
        {targetRect && (!step.action || step.action === 'pulse' || step.action === 'click') && (
          <motion.div
            key={`pulse-${stepIndex}`}
            className="absolute pointer-events-none rounded-2xl"
            style={{
              top: targetRect.top - PADDING,
              left: targetRect.left - PADDING,
              width: targetRect.width + PADDING * 2,
              height: targetRect.height + PADDING * 2,
              border: `3px solid ${accentColor}`,
            }}
            initial={{ opacity: 0.8, scale: 1 }}
            animate={{ opacity: [0.8, 0, 0.8], scale: [1, 1.18, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
          />
        )}

        {/* ── Ghost de drag scénarisé ────────────────────────────────────
            Deux variantes :
            - 'drag-ghost' : un fantôme glisse de target vers dragTo, puis fade.
            - 'drag-and-resize' : même drag, MAIS à l'arrivée le fantôme se
               transforme en bloc « événement calendrier » qui s'étire vers
               le bas (resize) pour démontrer la fonction de redimensionnement.
            ─────────────────────────────────────────────────────────────── */}
        {dragGhost && (() => {
          const GHOST_W = 110;
          const GHOST_H = 36;
          const RESIZE_TARGET_H = 96; // hauteur finale après resize (~3 slots horaires)
          const isResize = step.action === 'drag-and-resize';
          const fromX = dragGhost.from.left + dragGhost.from.width / 2 - GHOST_W / 2;
          const fromY = dragGhost.from.top + dragGhost.from.height / 2 - GHOST_H / 2;
          // FullCalendar affiche un axe horaire ~55 px à gauche du grid — on l'exclut
          // du calcul pour centrer le ghost dans la zone des colonnes de jours.
          const FC_TIME_AXIS = 55;
          const toX = dragGhost.to.left + FC_TIME_AXIS +
            (dragGhost.to.width - FC_TIME_AXIS) / 2 - GHOST_W / 2;
          const toY = dragGhost.to.top + 80; // un peu sous le haut du calendrier (pas au centre vertical)
          const label = step.ghostLabel || 'Tâche démo';

          // 4 phases : 0% appear at from, 30% arrived at to, 65% resized down, 100% fade
          // Pour drag-ghost simple : 3 phases (no resize)
          const keyframes = isResize
            ? { times: [0, 0.12, 0.45, 0.80, 1] }
            : { times: [0, 0.15, 0.85, 1] };

          return (
            <motion.div
              key={`ghost-${stepIndex}`}
              className="absolute pointer-events-none rounded-lg shadow-2xl flex items-center justify-start px-2.5 overflow-hidden"
              style={{
                width: GHOST_W,
                background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                border: `2px solid ${accentColor}`,
                color: 'white',
                fontWeight: 700,
                fontSize: 12,
              }}
              initial={{
                top: fromY,
                left: fromX,
                height: GHOST_H,
                opacity: 0,
                scale: 0.9,
                rotate: -2,
              }}
              animate={isResize ? {
                // Phase 1: appear at source (lifted/tilted)
                // Phase 2: travel to destination
                // Phase 3: drop and resize (height grows)
                // Phase 4: fade out
                top:    [fromY, fromY,           toY,           toY,                  toY],
                left:   [fromX, fromX,           toX,           toX,                  toX],
                height: [GHOST_H, GHOST_H,       GHOST_H,       RESIZE_TARGET_H,      RESIZE_TARGET_H],
                opacity:[0,     1,               1,             1,                    0],
                scale:  [0.9,   1.05,            1,             1,                    0.95],
                rotate: [-2,    -3,              0,             0,                    0],
                boxShadow: [
                  `0 0 0 ${accentColor}00`,
                  `0 12px 30px ${accentColor}66`,
                  `0 6px 16px ${accentColor}44`,
                  `0 6px 16px ${accentColor}44`,
                  `0 0 0 ${accentColor}00`,
                ],
              } : {
                top:    [fromY, fromY, toY,   toY],
                left:   [fromX, fromX, toX,   toX],
                opacity:[0,     1,     1,     0],
                scale:  [0.9,   1.05,  1,     0.9],
                rotate: [-2,    -3,    0,     0],
              }}
              transition={{
                duration: isResize ? 3.6 : 2.4,
                repeat: Infinity,
                repeatDelay: 0.4,
                ease: 'easeInOut',
                ...keyframes,
              }}
            >
              <span className="truncate">📌 {label}</span>
            </motion.div>
          );
        })()}

        {/* Indicateur de poignée resize (apparaît en bas du ghost pendant la phase resize) */}
        {dragGhost && step.action === 'drag-and-resize' && (
          <motion.div
            key={`resize-handle-${stepIndex}`}
            className="absolute pointer-events-none rounded-full"
            style={{
              width: 32,
              height: 4,
              background: 'white',
              border: `2px solid ${accentColor}`,
              left: dragGhost.to.left + dragGhost.to.width / 2 - 16,
            }}
            initial={{ opacity: 0, top: dragGhost.to.top + 80 + 36 - 4 }}
            animate={{
              opacity: [0, 0, 0, 1, 1, 0],
              top: [
                dragGhost.to.top + 80 + 36 - 4,
                dragGhost.to.top + 80 + 36 - 4,
                dragGhost.to.top + 80 + 36 - 4,
                dragGhost.to.top + 80 + 36 - 4,
                dragGhost.to.top + 80 + 96 - 4,
                dragGhost.to.top + 80 + 96 - 4,
              ],
            }}
            transition={{
              duration: 3.6,
              repeat: Infinity,
              repeatDelay: 0.4,
              ease: 'easeInOut',
              times: [0, 0.12, 0.45, 0.55, 0.80, 1],
            }}
          />
        )}

        {/* ── Ghost persistant (drag-place / resize-grow / select-create) ──
            Une seule motion.div avec key stable → Framer Motion interpole
            entre les snapshots successifs même au passage entre étapes. */}
        {ghost && (
          <motion.div
            key="persistent-ghost"
            className="absolute pointer-events-none rounded-md shadow-xl overflow-hidden flex items-start"
            initial={false}
            animate={{
              top: ghost.y,
              left: ghost.x,
              width: ghost.w,
              height: ghost.h,
              opacity: ghost.opacity,
            }}
            transition={{ duration: 0.55, ease: [0.2, 0.7, 0.2, 1] }}
            style={{
              background: ghost.isDashed
                ? `${accentColor}33`
                : `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
              border: ghost.isDashed
                ? `2px dashed ${accentColor}`
                : `2px solid ${accentColor}`,
              color: 'white',
              fontWeight: 700,
              fontSize: 11,
              padding: '4px 6px',
              zIndex: 10,
            }}
          >
            {ghost.label && <span className="truncate">{ghost.label}</span>}
          </motion.div>
        )}

        {/* Flèche pointant vers la cible (masquée pour 'inside') */}
        {targetRect && placement !== 'inside' && (
          <div className="absolute pointer-events-none" style={arrowStyle}>
            <TutorialArrow side={arrowSide} color={accentColor} />
          </div>
        )}

        {/* Carte info */}
        <motion.div
          key={`card-${stepIndex}`}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 24, stiffness: 320 }}
          className="absolute pointer-events-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-5 border-2"
          style={{
            ...cardStyle,
            width: CARD_W,
            borderColor: accentColor,
          }}
          role="dialog"
          aria-labelledby="tut-card-title"
        >
          {/* Skip button */}
          <button
            onClick={handleClose}
            aria-label="Passer le tutoriel"
            className="absolute top-2 right-2 min-w-9 min-h-9 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2"
            style={{ outlineColor: accentColor }}
          >
            <X size={16} />
          </button>

          <h3
            id="tut-card-title"
            className="text-base sm:text-lg font-bold mb-1 pr-8 text-slate-900 dark:text-white"
          >
            {step.title}
          </h3>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {step.description}
          </p>

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mt-4 mb-3">
            {visibleSteps.map((_, i) => (
              <span
                key={i}
                aria-hidden
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === stepIndex ? 22 : 7,
                  backgroundColor: i === stepIndex ? accentColor : 'rgb(203 213 225)',
                }}
              />
            ))}
            <span className="ml-auto text-xs font-semibold text-slate-400">
              {stepIndex + 1} / {totalSteps}
            </span>
          </div>

          {/* Boutons */}
          <div className="flex items-center justify-between gap-2 mt-3">
            <button
              type="button"
              onClick={handlePrev}
              disabled={stepIndex === 0}
              className="px-3 py-2 rounded-lg font-medium text-sm text-slate-600 dark:text-slate-300 disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:cursor-not-allowed"
            >
              ← Précédent
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-2 rounded-lg font-bold text-sm text-white shadow-lg hover:scale-[1.03] active:scale-[0.97] transition-transform flex items-center gap-1.5"
              style={{ backgroundColor: accentColor }}
            >
              {stepIndex === totalSteps - 1 ? 'Terminé' : 'Suivant'}
              {stepIndex < totalSteps - 1 && <ArrowRight size={14} />}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default PageTutorial;
