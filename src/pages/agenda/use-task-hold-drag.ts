import { useCallback, useEffect, useRef, useState } from 'react';

/** Délai d'appui avant que la tâche « colle » au doigt. */
const HOLD_MS = 350;
/** Au-delà, le doigt défile la liste : ce n'est pas un appui long. */
const MOVE_TOLERANCE = 8;
/** Pas d'accroche des horaires, en minutes. */
const SNAP_MINUTES = 15;

export interface DropSlot {
  /** `yyyy-MM-dd` de la colonne sous le doigt. */
  date: string;
  /** `HH:mm`, accroché au quart d'heure. */
  time: string;
}

const toMinutes = (hhmmss: string) => {
  const [h, m] = hhmmss.split(':').map(Number);
  return h * 60 + (m || 0);
};
const toHHMM = (minutes: number) =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/**
 * Créneau du calendrier MOBILE sous un point de l'écran.
 *
 * `elementFromPoint` ne suffit pas : la colonne d'événements recouvre les
 * lignes horaires. On lit donc la géométrie : la colonne dont le rectangle
 * contient x (`td.fc-timegrid-col[data-date]`), la ligne horaire dont le
 * rectangle contient y (`td.fc-timegrid-slot-lane[data-time]`), puis la
 * position dans la ligne, accrochée au quart d'heure. Hors grille horaire
 * (vue Mois, en-tête, barre d'onglets) : `null`, et rien n'est créé.
 */
export function slotAtPoint(x: number, y: number): DropSlot | null {
  const root = document.querySelector('.mobile-calendar');
  if (!root) return null;
  const inside = (r: DOMRect, v: number, axis: 'x' | 'y') =>
    axis === 'x' ? v >= r.left && v < r.right : v >= r.top && v < r.bottom;
  const col = [...root.querySelectorAll<HTMLElement>('td.fc-timegrid-col[data-date]')]
    .find((el) => inside(el.getBoundingClientRect(), x, 'x') && inside(el.getBoundingClientRect(), y, 'y'));
  if (!col) return null;
  const lanes = [...root.querySelectorAll<HTMLElement>('td.fc-timegrid-slot-lane[data-time]')];
  const i = lanes.findIndex((el) => inside(el.getBoundingClientRect(), y, 'y'));
  if (i < 0) return null;
  const lane = lanes[i];
  const start = toMinutes(lane.dataset.time ?? '00:00');
  const next = lanes[i + 1]?.dataset.time;
  const step = next ? toMinutes(next) - start : 30;
  const rect = lane.getBoundingClientRect();
  const raw = start + ((y - rect.top) / rect.height) * step;
  const snapped = Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES;
  return { date: col.dataset.date ?? '', time: toHHMM(Math.max(0, Math.min(snapped, 23 * 60 + 45))) };
}

/**
 * Appui long → la tâche suit le doigt → on la lâche sur un créneau
 * (demande d'Axel, 2026-10-11). Le TOUCHER simple reste le chemin principal
 * (ouvre le formulaire de créneau) : un geste n'est jamais le seul chemin
 * vers une action (C-111).
 *
 * `onLift` est appelé quand l'appui devient un glisser (la feuille se ferme),
 * `onDrop` quand le doigt se lève au-dessus d'un créneau.
 */
export function useTaskHoldDrag<T>({ onLift, onDrop }: {
  onLift: (item: T) => void;
  /** Appelé à CHAQUE fin de glisser ; `slot` vaut `null` hors grille horaire ou sur Échap. */
  onDrop: (item: T, slot: DropSlot | null) => void;
}) {
  const [drag, setDrag] = useState<{ item: T; x: number; y: number; slot: DropSlot | null } | null>(null);
  const pending = useRef<{ timer: number; x: number; y: number } | null>(null);
  // Un appui long déclenche aussi un `click` au relâcher : on l'avale.
  const swallowClick = useRef(false);
  // Refs : les rappels et l'élément porté sont lus au moment du geste, sans
  // réabonner les écouteurs à chaque rendu ni à chaque déplacement du doigt.
  const onLiftRef = useRef(onLift);
  const onDropRef = useRef(onDrop);
  const itemRef = useRef<T | null>(null);
  useEffect(() => { onLiftRef.current = onLift; onDropRef.current = onDrop; }, [onLift, onDrop]);
  const active = drag !== null;

  const cancelPending = () => {
    if (pending.current) window.clearTimeout(pending.current.timer);
    pending.current = null;
  };

  const bind = useCallback((item: T) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const { clientX: x, clientY: y } = e;
      cancelPending();
      pending.current = {
        x, y,
        timer: window.setTimeout(() => {
          pending.current = null;
          swallowClick.current = true;
          navigator.vibrate?.(10);
          itemRef.current = item;
          setDrag({ item, x, y, slot: null });
          onLiftRef.current(item);
        }, HOLD_MS),
      };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const p = pending.current;
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_TOLERANCE) cancelPending();
    },
    onPointerUp: cancelPending,
    onPointerCancel: cancelPending,
    onContextMenu: (e: React.MouseEvent) => { if (pending.current || itemRef.current) e.preventDefault(); },
    onClickCapture: (e: React.MouseEvent) => {
      if (swallowClick.current) { swallowClick.current = false; e.preventDefault(); e.stopPropagation(); }
    },
  }), []);

  useEffect(() => {
    if (!active) return;
    // Dernière position connue : la ligne touchée est démontée avec la feuille,
    // et la fin du geste peut arriver sans coordonnées (annulation, cible détachée).
    let last = { x: 0, y: 0 };
    const move = (x: number, y: number) => { last = { x, y }; setDrag((d) => (d ? { ...d, x, y, slot: slotAtPoint(x, y) } : d)); };
    const onPointerMove = (e: PointerEvent) => move(e.clientX, e.clientY);
    // Le doigt ne doit pas faire défiler la page pendant qu'il porte la tâche.
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      if (t) move(t.clientX, t.clientY);
    };
    // Toucher et pointeur émettent tous deux une fin de geste : une seule compte.
    let done = false;
    const finish = (x: number, y: number) => {
      if (done) return;
      done = true;
      const slot = slotAtPoint(x, y);
      const item = itemRef.current;
      itemRef.current = null;
      setDrag(null);
      window.setTimeout(() => { swallowClick.current = false; }, 0);
      if (item !== null) onDropRef.current(item, slot);
    };
    const onPointerUp = (e: PointerEvent) => finish(e.clientX, e.clientY);
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      finish(t ? t.clientX : last.x, t ? t.clientY : last.y);
    };
    const onCancel = () => finish(last.x, last.y);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { done = true; const item = itemRef.current; itemRef.current = null; setDrag(null); if (item !== null) onDropRef.current(item, null); } };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('touchcancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('touchcancel', onCancel);
    };
  }, [active]);

  useEffect(() => () => cancelPending(), []);

  return { drag, bind };
}
