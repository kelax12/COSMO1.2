// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act, waitFor } from '@testing-library/react';
import type { OKR } from '@/modules/okrs';

const mutate = vi.fn();
let activeOkrs: OKR[] = [];

vi.mock('@/modules/okrs', () => ({
  useActiveOkrs: () => ({ data: activeOkrs }),
  useUpdateKeyResult: () => ({ mutate }),
}));
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/i18n/useT', () => ({
  useT: () => ({
    t: (key: string) => key,
    tp: (key: string, n: number) => `${key}:${n}`,
  }),
}));

if (typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

import WeeklyCheckinModal, { useWeeklyCheckin } from './WeeklyCheckinModal';
import { toast } from '@/lib/toast';

const makeOkrs = (): OKR[] =>
  [
    {
      id: 'okr-1',
      title: 'Croissance',
      keyResults: [
        { id: 'kr-1', title: 'Inscrits', currentValue: 10, targetValue: 100, unit: 'users', completed: false },
        { id: 'kr-done', title: 'Déjà fini', currentValue: 5, targetValue: 5, unit: '', completed: true },
        { id: 'kr-2', title: 'Articles', currentValue: 1, targetValue: 4, unit: 'art.', completed: false },
      ],
    },
  ] as unknown as OKR[];

const STORAGE_KEY = 'cosmo:last-checkin-week';

describe('useWeeklyCheckin', () => {
  beforeEach(() => {
    window.localStorage.clear();
    activeOkrs = makeOkrs();
  });
  afterEach(() => vi.useRealTimers());

  const at = (iso: string) => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(iso));
  };

  it('s’affiche le lundi quand un OKR est actif et que la semaine n’a pas été vue', () => {
    at('2026-11-16T09:00:00'); // lundi
    const { result } = renderHook(() => useWeeklyCheckin());
    expect(result.current.shouldShow).toBe(true);
  });

  it('s’affiche aussi le mardi mais pas les autres jours', () => {
    at('2026-11-17T09:00:00');
    expect(renderHook(() => useWeeklyCheckin()).result.current.shouldShow).toBe(true);
    at('2026-11-18T09:00:00');
    expect(renderHook(() => useWeeklyCheckin()).result.current.shouldShow).toBe(false);
  });

  it('ne s’affiche pas sans OKR actif', () => {
    at('2026-11-16T09:00:00');
    activeOkrs = [];
    expect(renderHook(() => useWeeklyCheckin()).result.current.shouldShow).toBe(false);
  });

  it('se tait une fois la semaine marquée comme vue, et le retient pour le rechargement', () => {
    at('2026-11-16T09:00:00');
    const { result } = renderHook(() => useWeeklyCheckin());
    act(() => result.current.dismiss());
    expect(result.current.shouldShow).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toMatch(/^2026-W47$/);
    expect(renderHook(() => useWeeklyCheckin()).result.current.shouldShow).toBe(false);
  });

  it('revient la semaine suivante', () => {
    window.localStorage.setItem(STORAGE_KEY, '2026-W47');
    at('2026-11-23T09:00:00'); // lundi suivant
    expect(renderHook(() => useWeeklyCheckin()).result.current.shouldShow).toBe(true);
  });
});

describe('WeeklyCheckinModal', () => {
  beforeEach(() => {
    mutate.mockReset();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
    activeOkrs = makeOkrs();
  });

  it('ne rend rien fermé, ni quand il n’y a aucun résultat clé à pointer', () => {
    const { container, rerender } = render(<WeeklyCheckinModal isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    activeOkrs = [];
    rerender(<WeeklyCheckinModal isOpen onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('présente un résultat clé non terminé à la fois, nommé par le titre affiché', () => {
    render(<WeeklyCheckinModal isOpen onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Check-in hebdo' })).toBeTruthy();
    expect(screen.getByText('Inscrits')).toBeTruthy();
    expect(screen.queryByText('Déjà fini')).toBeNull();
    expect(screen.getByText('checkin.krProgress')).toBeTruthy();
  });

  it('suit l’avancement saisi en direct, une saisie invalide valant zéro', () => {
    render(<WeeklyCheckinModal isOpen onClose={vi.fn()} />);
    const input = screen.getByRole('spinbutton', { name: /Inscrits/ }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '50' } });
    expect(screen.getByText('50%')).toBeTruthy();
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('0');
  });

  it('navigue entre les résultats clés sans perdre la saisie', () => {
    render(<WeeklyCheckinModal isOpen onClose={vi.fn()} />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: /checkin\.next/ }));
    expect(screen.getByText('Articles')).toBeTruthy();
    expect(screen.getByRole('button', { name: /checkin\.finish/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'checkin.previous' }));
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('40');
  });

  it('à la fin, n’enregistre que les valeurs modifiées, marque terminé au-delà de la cible, puis ferme', async () => {
    mutate.mockImplementation((_p, cb: { onSuccess: () => void }) => cb.onSuccess());
    const onClose = vi.fn();
    render(<WeeklyCheckinModal isOpen onClose={onClose} />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: /checkin\.next/ }));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: /checkin\.finish/ }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mutate).toHaveBeenCalledTimes(2);
    expect(mutate.mock.calls[0][0]).toEqual({
      okrId: 'okr-1',
      keyResultId: 'kr-1',
      updates: { currentValue: 30, completed: false },
    });
    expect(mutate.mock.calls[1][0]).toEqual({
      okrId: 'okr-1',
      keyResultId: 'kr-2',
      updates: { currentValue: 4, completed: true },
    });
    expect(toast.success).toHaveBeenCalledWith('checkin.saved', { description: 'checkin.savedCount:2' });
  });

  it('terminer sans rien changer n’écrit rien', async () => {
    const onClose = vi.fn();
    render(<WeeklyCheckinModal isOpen onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /checkin\.next/ }));
    fireEvent.click(screen.getByRole('button', { name: /checkin\.finish/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mutate).not.toHaveBeenCalled();
  });

  it('signale l’échec et garde la fenêtre ouverte', async () => {
    mutate.mockImplementation((_p, cb: { onError: (e: Error) => void }) => cb.onError(new Error('boom')));
    const onClose = vi.fn();
    render(<WeeklyCheckinModal isOpen onClose={onClose} />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: /checkin\.next/ }));
    fireEvent.click(screen.getByRole('button', { name: /checkin\.finish/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('checkin.error'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('se ferme par la croix, le voile et Échap', () => {
    const onClose = vi.fn();
    render(<WeeklyCheckinModal isOpen onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'checkin.close' }));
    fireEvent.click(screen.getByRole('dialog'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
