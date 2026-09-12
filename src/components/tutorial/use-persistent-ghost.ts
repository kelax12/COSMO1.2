// ═══════════════════════════════════════════════════════════════════
// use-persistent-ghost — la CHORÉGRAPHIE du fantôme de démonstration
//
// Extrait de `PageTutorial` le 2026-09-12 (C-09 / `architecture.guard`). La
// frontière n'est pas une coupe à la ligne près : d'un côté le composant, qui
// sait POSITIONNER une carte, une flèche et un projecteur autour d'une cible ;
// de l'autre ce hook, qui sait comment un rectangle fantôme se DÉPLACE dans le
// temps pour raconter un geste (glisser une tâche dans l'agenda, étirer un
// événement, sélectionner un créneau vide). Les deux n'ont en commun qu'un
// `GhostState` à rendre.
//
// ⚠️ Le hook possède l'état ET ses minuteries. C'est ce qui rend la frontière
// réelle : `PageTutorial` ne peut plus laisser filer un `setTimeout` de
// chorégraphie, parce qu'il n'en tient plus aucun.
//
// 🔴 Les durées sont écrites en dur, et volontairement : ce sont des temps de
// LECTURE (le temps qu'il faut pour comprendre qu'un bloc s'est déplacé), pas
// des constantes de configuration. Les sortir dans un objet donnerait envie de
// les régler ; elles se règlent à l'œil, sur l'écran, une fois.
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import { TutorialStep } from './types';
import { TargetRect, GhostState, findTarget, getRect } from './page-tutorial-helpers';
import { translator } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';

/**
 * Libellé du fantôme de drag : la clé portée par l'étape, sinon celle par
 * défaut. Les quatre appels affichaient une chaîne FRANÇAISE en dur
 * (« Tâche », « Tâche démo »), invisible à `i18n:scan` jusqu'au motif (9).
 *
 * `translator` et non `useT` : ce helper est appelé DANS un effet dont les
 * dépendances pilotent l'animation — y faire entrer un `t` le ferait rejouer,
 * et la locale est de toute façon figée au montage (basename).
 */
const ghostLabelOf = (step: TutorialStep, fallbackKey: KeyOf<'tutorials'>): string =>
  translator('tutorials').t(step.ghostLabelKey ?? fallbackKey);

/**
 * Anime le fantôme persistant de l'étape courante.
 *
 * Rend l'état à peindre, ou `null` quand l'étape ne demande aucun fantôme —
 * et quand le tutoriel se ferme.
 */
export function usePersistentGhost(
  isOpen: boolean,
  step: TutorialStep | undefined,
  stepIndex: number,
): GhostState | null {
  const [ghost, setGhost] = useState<GhostState | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!isOpen || !step) return;
    // Cleanup des timers précédents
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    const queue = (ms: number, fn: () => void) => {
      timersRef.current.push(setTimeout(fn, ms));
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
      const label = ghostLabelOf(step, 'agendaDesktop.ghostTask');
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
      const label = ghostLabelOf(step, 'agendaDesktop.ghostTask');
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
      const label = ghostLabelOf(step, 'agendaDesktop.ghostTask');
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
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps --
       `ghostLabelOf` est une fonction de MODULE, donc stable, et `step` porte
       déjà tout ce que la chorégraphie lit. `stepIndex` reste dans la liste
       parce qu'un retour en arrière peut ramener la MÊME étape : sans lui,
       l'animation ne rejouerait pas. */
  }, [isOpen, step, stepIndex]);

  // Le tutoriel se ferme : le fantôme part avec lui, minuteries comprises.
  useEffect(() => {
    if (isOpen) return;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setGhost(null);
  }, [isOpen]);

  return ghost;
}

export { ghostLabelOf };
