import { useLayoutEffect, useRef, useState } from 'react';
import type { PanInfo } from 'framer-motion';
import { moveWidget, type PlacedOf } from './apercu-widgets';

/** Délai minimal entre deux permutations pendant un glisser, contre l'oscillation. */
const SWAP_COOLDOWN_MS = 90;
/** Part de chaque bord du bloc survolé qui ne déclenche pas d'échange. */
const SWAP_MARGIN = 0.25;
/** Durée du glissement des voisins sous mouvement réduit (FLIP natif). */
const FLIP_MS = 240;
const FLIP_ID = 'apercu-flip';
/** Temps de trajet d'un bloc qui cède sa place : il ne repermute pas avant. */
const SWAP_SETTLE_MS = 450;

/**
 * Glisser pour réordonner les widgets de l'Aperçu (sorti d'`ApercuWidgetGrid`,
 * 2026-10-30) : permutation au survol du cœur d'un voisin, hauteur du bloc
 * tenu figée, et FLIP natif des voisins sous mouvement réduit.
 */
export function useWidgetDragReorder<Id extends string>(
  layout: PlacedOf<Id>[],
  onChange: (next: PlacedOf<Id>[]) => void,
  reduce: boolean,
) {
  const [dragged, setDragged] = useState<Id | null>(null);
  /** Hauteur du bloc à la prise : il la garde pendant tout le glisser. */
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const lastSwap = useRef(0);
  const lastSwapped = useRef<string | null>(null);

  /** Pendant le glisser : le bloc survolé cède sa place, les autres glissent. */
  const dragTo = (id: Id, info: PanInfo) => {
    const now = performance.now();
    if (now - lastSwap.current < SWAP_COOLDOWN_MS) return;
    // Le CENTRE du bloc tenu, pas le pointeur : saisi par un bord, le bloc
    // couvrait déjà son voisin sans que l'échange parte (vidéo du 2026-10-26 :
    // dix secondes au-dessus de « tete » sans rien déclencher).
    const held = gridRef.current?.querySelector<HTMLElement>(`[data-widget="${CSS.escape(id)}"]`)?.getBoundingClientRect();
    const x = held ? held.left + held.width / 2 : info.point.x - window.scrollX;
    const y = held ? held.top + held.height / 2 : info.point.y - window.scrollY;
    const over = document.elementsFromPoint(x, y)
      .map((el) => el.closest<HTMLElement>('[data-widget]'))
      .find((el) => el && el.dataset.widget !== id);
    // Le bloc qui vient de céder sa place glisse SOUS le bloc tenu pendant
    // tout son trajet : il ne peut pas repermuter avec lui avant d'être
    // arrivé. La garde levée dès qu'il quittait le centre UNE image rendait
    // l'échange aussitôt défait (mesuré le 2026-10-29, ordre final inchangé).
    if (!over) return;
    if (over.dataset.widget === lastSwapped.current && now - lastSwap.current < SWAP_SETTLE_MS) return;
    // Seul le CŒUR du bloc survolé déclenche l'échange : en traversant la
    // grille, le bloc tenu frôlait chaque voisin et les faisait tous
    // permuter en cascade (mesuré : zigzags et sauts de 100 px par image).
    const r = over.getBoundingClientRect();
    const mx = r.width * SWAP_MARGIN, my = r.height * SWAP_MARGIN;
    if (x < r.left + mx || x > r.right - mx || y < r.top + my || y > r.bottom - my) return;
    const current = layoutRef.current;
    const to = current.findIndex((w) => w.id === over.dataset.widget);
    const from = current.findIndex((w) => w.id === id);
    if (to < 0 || to === from) return;
    lastSwap.current = now;
    lastSwapped.current = over.dataset.widget ?? null;
    if (reduce) snapshotForFlip(id);
    onChange(moveWidget(current, id, to));
  };

  /**
   * Glissement des voisins SOUS MOUVEMENT RÉDUIT, pendant un glisser
   * seulement (décision d'Axel, 2026-10-29) : le geste de la personne
   * déclenche le mouvement, et sans lui les blocs se téléportaient
   * (vidéo du 2026-10-26, Windows « Effets d'animation » coupés).
   * Framer ne peut pas le faire ici (cf. `layout` retiré, plus haut) : FLIP
   * en WAAPI, qui finit à `transform: none`. La position finale reste celle
   * de la grille CSS. Les flèches du clavier restent instantanées.
   */
  const gridRef = useRef<HTMLUListElement>(null);
  const flipFrom = useRef<{ heldId: string; rects: Map<string, DOMRect> } | null>(null);
  /**
   * Le bloc TENU, lui, change de case sans que Framer le recale (il ne le
   * fait qu'avec `layout`) : il sautait de la hauteur d'une ligne (+244 px
   * mesurés). On compense le déplacement de sa case par la propriété CSS
   * `translate`, qui s'ajoute au `transform` écrit par le glisser sans le toucher.
   */
  const heldShift = useRef({ x: 0, y: 0 });
  const clearHeldShift = (li: HTMLElement | null) => {
    heldShift.current = { x: 0, y: 0 };
    if (li) li.style.translate = '';
  };
  const snapshotForFlip = (heldId: string) => {
    const rects = new Map<string, DOMRect>();
    gridRef.current?.querySelectorAll<HTMLElement>(':scope > li[data-widget]').forEach((li) => {
      rects.set(li.dataset.widget ?? '', li.getBoundingClientRect());
    });
    flipFrom.current = { heldId, rects };
  };
  useLayoutEffect(() => {
    const flip = flipFrom.current;
    if (!flip) return;
    flipFrom.current = null;
    gridRef.current?.querySelectorAll<HTMLElement>(':scope > li[data-widget]').forEach((li) => {
      const before = flip.rects.get(li.dataset.widget ?? '');
      if (!before) return;
      if (li.dataset.widget === flip.heldId) {
        const after = li.getBoundingClientRect();
        heldShift.current = {
          x: heldShift.current.x - (after.left - before.left),
          y: heldShift.current.y - (after.top - before.top),
        };
        li.style.translate = `${heldShift.current.x}px ${heldShift.current.y}px`;
        return;
      }
      // Repartir de la position VISIBLE si un glissement précédent court encore.
      li.getAnimations().filter((a) => a.id === FLIP_ID).forEach((a) => a.cancel());
      const after = li.getBoundingClientRect();
      const dx = before.left - after.left, dy = before.top - after.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      li.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
        { id: FLIP_ID, duration: FLIP_MS, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      );
    });
  }, [layout]);

  const startDrag = (id: Id, li: HTMLElement | null) => {
    lastSwapped.current = null;
    clearHeldShift(li);
    setDragHeight(li?.getBoundingClientRect().height ?? null);
    setDragged(id);
  };

  const endDrag = (li: HTMLElement | null) => {
    lastSwapped.current = null;
    clearHeldShift(li);
    setDragged(null);
  };

  return { gridRef, dragged, dragHeight, startDrag, dragTo, endDrag };
}
