// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAgendaEventDrag } from './useAgendaEventDrag';
import type { CalendarEvent } from '@/modules/events';

const ev = (id: string, taskId?: string) => ({ id, title: id, start: '', end: '', taskId }) as unknown as CalendarEvent;
const info = (id: string, x?: number, y?: number, taskId?: string) =>
  ({
    event: { id, extendedProps: { taskId } },
    jsEvent: x === undefined ? null : { clientX: x, clientY: y },
  }) as never;

function setup(events: CalendarEvent[]) {
  const deps = {
    events,
    deleteEvent: vi.fn(),
    setSelectedEvent: vi.fn(),
    setShowEditEventModal: vi.fn(),
    setCalendarKey: vi.fn(),
    setMobileCalendarKey: vi.fn(),
  };
  const { result } = renderHook(() => useAgendaEventDrag(deps));
  return { result, deps };
}

function addSidebar() {
  const el = document.createElement('div');
  el.id = 'agenda-task-sidebar-dropzone';
  el.getBoundingClientRect = () => ({ left: 0, top: 0, right: 100, bottom: 100 }) as DOMRect;
  document.body.appendChild(el);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('useAgendaEventDrag', () => {
  it('depot sur la sidebar d\'un creneau de tache : suppression differee et remontage du calendrier', () => {
    addSidebar();
    const { result, deps } = setup([ev('e1', 't1')]);
    act(() => result.current.handleEventDragStart(info('e1', 300, 300, 't1')));
    act(() => result.current.handleEventDragStop(info('e1', 50, 50)));
    expect(deps.deleteEvent).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(deps.deleteEvent).toHaveBeenCalledWith('e1');
    expect(deps.setCalendarKey).toHaveBeenCalled();
    expect(deps.setMobileCalendarKey).toHaveBeenCalled();
  });

  it('depot d\'un evenement SANS tache sur la sidebar : refuse, rien n\'est supprime', () => {
    addSidebar();
    const { result, deps } = setup([ev('e1')]);
    act(() => result.current.handleEventDragStart(info('e1', 300, 300)));
    act(() => result.current.handleEventDragStop(info('e1', 50, 50)));
    act(() => { vi.advanceTimersByTime(10); });
    expect(deps.deleteEvent).not.toHaveBeenCalled();
    expect(deps.setSelectedEvent).not.toHaveBeenCalled();
  });

  it('appui long sans mouvement : ouvre la fiche de l\'evenement', () => {
    const { result, deps } = setup([ev('e1')]);
    act(() => result.current.handleEventDragStart(info('e1', 200, 200)));
    act(() => result.current.handleEventDragStop(info('e1', 202, 201)));
    expect(deps.setSelectedEvent).toHaveBeenCalledWith(expect.objectContaining({ id: 'e1' }));
    expect(deps.setShowEditEventModal).toHaveBeenCalledWith(true);
  });

  it('vrai deplacement dans le calendrier : laisse FullCalendar faire', () => {
    const { result, deps } = setup([ev('e1')]);
    act(() => result.current.handleEventDragStart(info('e1', 200, 200)));
    act(() => result.current.handleEventDragStop(info('e1', 400, 380)));
    expect(deps.setSelectedEvent).not.toHaveBeenCalled();
    expect(deps.deleteEvent).not.toHaveBeenCalled();
  });

  it('marque la fin du glisser pour supprimer le clic residuel', () => {
    const { result } = setup([ev('e1')]);
    expect(result.current.lastDragEndAtRef.current).toBe(0);
    act(() => result.current.handleEventDragStart(info('e1', 200, 200)));
    act(() => result.current.handleEventDragStop(info('e1', 400, 400)));
    expect(result.current.lastDragEndAtRef.current).toBeGreaterThan(0);
  });

  it('la fin par pointerup fenetre fonctionne et une seule fois', () => {
    const { result, deps } = setup([ev('e1')]);
    act(() => result.current.handleEventDragStart(info('e1', 200, 200)));
    act(() => { window.dispatchEvent(new MouseEvent('pointerup', { clientX: 201, clientY: 200 })); });
    act(() => result.current.handleEventDragStop(info('e1', 201, 200)));
    expect(deps.setSelectedEvent).toHaveBeenCalledTimes(1);
  });

  it('annulation sans coordonnees : retombe sur la derniere position connue', () => {
    const { result, deps } = setup([ev('e1')]);
    act(() => result.current.handleEventDragStart(info('e1', 200, 200)));
    act(() => { window.dispatchEvent(new MouseEvent('pointermove', { clientX: 203, clientY: 203 })); });
    act(() => { window.dispatchEvent(new Event('pointercancel')); });
    expect(deps.setSelectedEvent).toHaveBeenCalledTimes(1);
  });
});
