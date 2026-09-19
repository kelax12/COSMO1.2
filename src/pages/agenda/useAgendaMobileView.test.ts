// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// Témoin de la bascule Mois → Jour du calendrier MOBILE.
//
// CE QUI EST PROTÉGÉ ICI : qu'un TAP sur une case de mois bascule bien en vue
// Jour sur la date touchée. La bascule existait depuis le 2026-09-05 mais
// n'écoutait que `select`, que `selectLongPressDelay={250}` rend inatteignable
// au tap court : au doigt, rien ne se passait, et à la souris tout marchait —
// un défaut qu'aucun essai au navigateur de bureau ne pouvait montrer.
// Le cas `dateClick` est donc le cœur de ce fichier.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type FullCalendar from '@fullcalendar/react';
import type { DateSelectArg } from '@fullcalendar/core';
import type { DateClickArg } from '@fullcalendar/interaction';
import { useAgendaMobileView } from './useAgendaMobileView';

/** Fausse instance FullCalendar : on n'observe que les ordres reçus. */
function fakeCalendar() {
  const api = {
    changeView: vi.fn(),
    gotoDate: vi.fn(),
    unselect: vi.fn(),
    prev: vi.fn(),
    next: vi.fn(),
  };
  return { api, instance: { getApi: () => api } as unknown as FullCalendar };
}

function setup() {
  const onDateSelect = vi.fn();
  const applyVisibleRange = vi.fn();
  const { api, instance } = fakeCalendar();
  const rendered = renderHook(() => useAgendaMobileView({ onDateSelect, applyVisibleRange }));
  // Le hook crée sa propre ref : on y branche la fausse instance.
  (rendered.result.current.mobileCalendarRef as { current: FullCalendar | null }).current = instance;
  return { ...rendered, api, onDateSelect, applyVisibleRange };
}

const DAY = new Date('2026-09-24T00:00:00');

describe('useAgendaMobileView — bascule Mois → Jour', () => {
  it('un TAP (dateClick) en vue Mois ouvre la vue Jour sur la date touchée', () => {
    const { result, api } = setup();
    act(() => { result.current.handleMobileSetView('dayGridMonth'); });
    api.changeView.mockClear();

    act(() => {
      result.current.handleMobileDateClick({ date: DAY, jsEvent: null } as unknown as DateClickArg);
    });

    expect(api.changeView).toHaveBeenCalledWith('timeGridDay');
    expect(api.gotoDate).toHaveBeenCalledWith(DAY);
    expect(result.current.mobileViewMode).toBe('timeGridDay');
    expect(result.current.mobileSelectedDate).toEqual(DAY);
  });

  it('émet un ordre de zoom portant le point touché, différent à chaque bascule', () => {
    const { result, api } = setup();
    act(() => { result.current.handleMobileSetView('dayGridMonth'); });

    act(() => {
      result.current.handleMobileDateClick({
        date: DAY,
        // Un tap au doigt : `clientX` est sur le Touch, pas sur l'événement.
        jsEvent: { changedTouches: [{ clientX: 120, clientY: 300 }] },
      } as unknown as DateClickArg);
    });
    const first = result.current.mobileZoom;
    expect(first).toMatchObject({ x: 120, y: 300 });

    act(() => { result.current.handleMobileSetView('dayGridMonth'); });
    api.changeView.mockClear();
    act(() => {
      result.current.handleMobileDateClick({
        date: DAY,
        jsEvent: { changedTouches: [{ clientX: 120, clientY: 300 }] },
      } as unknown as DateClickArg);
    });
    // Même case deux fois de suite : le token doit quand même changer, sinon
    // l'animation ne rejouerait pas.
    expect(result.current.mobileZoom?.token).not.toBe(first?.token);
  });

  it("un appui maintenu (select) en vue Mois bascule aussi, sans ouvrir la carte de création", () => {
    const { result, api, onDateSelect } = setup();
    act(() => { result.current.handleMobileSetView('dayGridMonth'); });
    api.changeView.mockClear();

    act(() => {
      result.current.handleMobileDateSelect({ start: DAY, jsEvent: null } as unknown as DateSelectArg);
    });

    expect(onDateSelect).not.toHaveBeenCalled();
    expect(api.changeView).toHaveBeenCalledWith('timeGridDay');
  });

  it('souris : select PUIS dateClick sur le même clic ne basculent qu\'une fois', () => {
    const { result, api } = setup();
    act(() => { result.current.handleMobileSetView('dayGridMonth'); });
    api.changeView.mockClear();

    act(() => {
      result.current.handleMobileDateSelect({ start: DAY, jsEvent: null } as unknown as DateSelectArg);
      result.current.handleMobileDateClick({ date: DAY, jsEvent: null } as unknown as DateClickArg);
    });

    expect(api.changeView).toHaveBeenCalledTimes(1);
  });

  it('hors vue Mois, un tap ne touche à rien et un select ouvre la création rapide', () => {
    const { result, api, onDateSelect } = setup();
    const select = { start: DAY, jsEvent: null } as unknown as DateSelectArg;

    act(() => {
      result.current.handleMobileDateClick({ date: DAY, jsEvent: null } as unknown as DateClickArg);
    });
    expect(api.changeView).not.toHaveBeenCalled();
    expect(result.current.mobileZoom).toBeNull();

    act(() => { result.current.handleMobileDateSelect(select); });
    expect(onDateSelect).toHaveBeenCalledWith(select);
  });
});
