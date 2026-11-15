// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { slotAtPoint, useTaskHoldDrag } from './use-task-hold-drag';

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;

/** Grille mobile : une colonne x 0..100, deux lignes de 30 min hautes de 40 px. */
function buildGrid() {
  document.body.innerHTML = `
    <div class="mobile-calendar">
      <table><tbody><tr>
        <td class="fc-timegrid-col" data-date="2026-11-16"></td>
      </tr></tbody></table>
      <table><tbody>
        <tr><td class="fc-timegrid-slot-lane" data-time="09:00:00"></td></tr>
        <tr><td class="fc-timegrid-slot-lane" data-time="09:30:00"></td></tr>
      </tbody></table>
    </div>`;
  const col = document.querySelector('td.fc-timegrid-col') as HTMLElement;
  col.getBoundingClientRect = () => rect(0, 0, 100, 80);
  const lanes = document.querySelectorAll<HTMLElement>('td.fc-timegrid-slot-lane');
  lanes[0].getBoundingClientRect = () => rect(0, 0, 100, 40);
  lanes[1].getBoundingClientRect = () => rect(0, 40, 100, 40);
}

describe('slotAtPoint', () => {
  beforeEach(buildGrid);

  it('hors calendrier mobile : null', () => {
    document.body.innerHTML = '';
    expect(slotAtPoint(10, 10)).toBeNull();
  });

  it('accroche au quart d\'heure dans la ligne touchee', () => {
    expect(slotAtPoint(50, 0)).toEqual({ date: '2026-11-16', time: '09:00' });
    expect(slotAtPoint(50, 20)).toEqual({ date: '2026-11-16', time: '09:15' });
    expect(slotAtPoint(50, 60)).toEqual({ date: '2026-11-16', time: '09:45' });
  });

  it('hors colonne ou hors ligne : null', () => {
    expect(slotAtPoint(500, 10)).toBeNull();
    expect(slotAtPoint(50, 500)).toBeNull();
  });
});

describe('useTaskHoldDrag', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    buildGrid();
  });
  afterEach(() => vi.useRealTimers());

  const press = (result: { current: ReturnType<typeof useTaskHoldDrag<string>> }, x = 50, y = 20) =>
    act(() => {
      result.current.bind('t1').onPointerDown({ pointerType: 'touch', button: 0, clientX: x, clientY: y } as never);
    });

  it('appui long : leve la tache, puis un relache sur un creneau la depose', () => {
    const onLift = vi.fn();
    const onDrop = vi.fn();
    const { result } = renderHook(() => useTaskHoldDrag<string>({ onLift, onDrop }));
    press(result);
    expect(onLift).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(400); });
    expect(onLift).toHaveBeenCalledWith('t1');
    expect(result.current.drag?.item).toBe('t1');

    act(() => { window.dispatchEvent(new MouseEvent('pointermove', { clientX: 50, clientY: 60 })); });
    expect(result.current.drag?.slot).toEqual({ date: '2026-11-16', time: '09:45' });

    act(() => { window.dispatchEvent(new MouseEvent('pointerup', { clientX: 50, clientY: 60 })); });
    expect(onDrop).toHaveBeenCalledWith('t1', { date: '2026-11-16', time: '09:45' });
    expect(result.current.drag).toBeNull();
  });

  it('un doigt qui bouge avant le delai annule l\'appui long (defilement)', () => {
    const onLift = vi.fn();
    const { result } = renderHook(() => useTaskHoldDrag<string>({ onLift, onDrop: vi.fn() }));
    press(result);
    act(() => { result.current.bind('t1').onPointerMove({ clientX: 50, clientY: 80 } as never); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(onLift).not.toHaveBeenCalled();
    expect(result.current.drag).toBeNull();
  });

  it('un relache avant le delai annule aussi, un clic droit souris est ignore', () => {
    const onLift = vi.fn();
    const { result } = renderHook(() => useTaskHoldDrag<string>({ onLift, onDrop: vi.fn() }));
    act(() => { result.current.bind('t1').onPointerDown({ pointerType: 'mouse', button: 2, clientX: 1, clientY: 1 } as never); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(onLift).not.toHaveBeenCalled();
    press(result);
    act(() => { result.current.bind('t1').onPointerUp(); });
    act(() => { vi.advanceTimersByTime(500); });
    expect(onLift).not.toHaveBeenCalled();
  });

  it('Echap abandonne le glisser : onDrop(item, null)', () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() => useTaskHoldDrag<string>({ onLift: vi.fn(), onDrop }));
    press(result);
    act(() => { vi.advanceTimersByTime(400); });
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(onDrop).toHaveBeenCalledWith('t1', null);
    expect(result.current.drag).toBeNull();
  });

  it('le clic qui suit un appui long est avale, le suivant passe', () => {
    const { result } = renderHook(() => useTaskHoldDrag<string>({ onLift: vi.fn(), onDrop: vi.fn() }));
    press(result);
    act(() => { vi.advanceTimersByTime(400); });
    const swallowed = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    result.current.bind('t1').onClickCapture(swallowed as never);
    expect(swallowed.preventDefault).toHaveBeenCalled();
    const next = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    result.current.bind('t1').onClickCapture(next as never);
    expect(next.preventDefault).not.toHaveBeenCalled();
  });

  it('fin tactile sans coordonnees : deposee a la derniere position connue', () => {
    const onDrop = vi.fn();
    const { result } = renderHook(() => useTaskHoldDrag<string>({ onLift: vi.fn(), onDrop }));
    press(result);
    act(() => { vi.advanceTimersByTime(400); });
    act(() => { window.dispatchEvent(new MouseEvent('pointermove', { clientX: 50, clientY: 20 })); });
    act(() => { window.dispatchEvent(new Event('touchcancel')); });
    expect(onDrop).toHaveBeenCalledWith('t1', { date: '2026-11-16', time: '09:15' });
  });
});
