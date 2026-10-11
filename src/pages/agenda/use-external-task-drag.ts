import { useEffect, useRef, type RefObject } from 'react';
import { Draggable } from '@fullcalendar/interaction';
import { resolveDraggedTaskEventData, type DraggedTaskData } from './calendar-events';

/**
 * Glisser une tâche de la barre latérale vers le calendrier : le `Draggable`
 * de FullCalendar, sa destruction, et la barre qui se replie sur mobile dès
 * que le doigt la quitte. Sorti d'`AgendaPage` (2026-10-11) : c'est un geste
 * entier, et la page dépassait le budget de 600 lignes.
 */
export function useExternalTaskDrag({ showTaskSidebar, setShowTaskSidebar, isDraggingTask, setIsDraggingTask, sidebarRef, categories, events, t }: {
  showTaskSidebar: boolean;
  setShowTaskSidebar: (v: boolean) => void;
  isDraggingTask: boolean;
  setIsDraggingTask: (v: boolean) => void;
  sidebarRef: RefObject<HTMLDivElement>;
  categories: Parameters<typeof resolveDraggedTaskEventData>[1];
  events: unknown;
  t: (key: 'event.uncategorized') => string;
}) {
  const draggableRef = useRef<Draggable | null>(null);
  const categoriesRef = useRef(categories);
  // Même raison que `categoriesRef` : le callback `eventData` du `Draggable`
  // est créé UNE fois et vit aussi longtemps que lui. Le mettre en dépendance
  // de l'effet reconstruirait le Draggable à chaque changement de `t`, alors
  // qu'un ref lui donne simplement la valeur fraîche au moment de l'appel.
  const tRef = useRef(t);
  useEffect(() => { categoriesRef.current = categories; }, [categories]);
  useEffect(() => { tRef.current = t; }, [t]);

  // Draggable init (desktop + mobile sidebar)
  useEffect(() => {
    if (!showTaskSidebar) return;
    const timer = setTimeout(() => {
      const container = document.getElementById('external-events-container');
      if (container && !draggableRef.current) {
        draggableRef.current = new Draggable(container, {
          itemSelector: '.external-event',
          // 250ms (au lieu de 50) : un swipe vertical rapide scrolle la liste
          // au lieu de démarrer un drag → permet de scroller sans sélectionner
          // une tâche sur mobile (combiné à touch-action: pan-y sur les cartes).
          longPressDelay: 250,
          // Tâche d'équipe (TaskSidebar, item 4) : couleur/nom de catégorie
          // déjà résolus par l'appelant dans le payload — voir
          // `resolveDraggedTaskEventData` (agenda/calendar-events.ts).
          eventData: function (eventEl) {
            const taskData: DraggedTaskData = JSON.parse(eventEl.getAttribute('data-task') || '{}');
            return resolveDraggedTaskEventData(taskData, categoriesRef.current, tRef.current('event.uncategorized'));
          },
        });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [showTaskSidebar, categories, events]);

  useEffect(() => {
    if (!showTaskSidebar && !isDraggingTask && draggableRef.current) {
      try { draggableRef.current.destroy(); } catch { /* ignore */ }
      draggableRef.current = null;
    }
  }, [showTaskSidebar, isDraggingTask]);

  useEffect(() => {
    if (!isDraggingTask) return;
    const handleMove = (x: number) => {
      const sidebarWidth = sidebarRef.current?.offsetWidth || 224;
      if (x > sidebarWidth && window.innerWidth < 768) setShowTaskSidebar(false);
    };
    const handlePointerMove = (e: PointerEvent) => { if (isDraggingTask) handleMove(e.clientX); };
    // `handlePointerUp` doit être une CONSTANTE : passer deux fonctions fléchées
    // distinctes à add/removeEventListener ne retirait rien, et un écouteur
    // s'accumulait à chaque glisser pour la durée de vie de la page (R-16).
    const handlePointerUp = () => setIsDraggingTask(false);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDraggingTask, setIsDraggingTask, setShowTaskSidebar, sidebarRef]);
}
