// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import HabitTrackerToolPage, { joursDuMois, lireEtat as lireHabit } from './HabitTrackerToolPage';
import WeeklyPlannerToolPage, { lireGrille } from './WeeklyPlannerToolPage';
import PomodoroToolPage, { DUREES, phaseSuivante, lireEtat as lirePomodoro } from './PomodoroToolPage';

vi.mock('@/lib/useSeoMeta', () => ({ useSeoMeta: () => {} }));

// Outils gratuits sans compte (plan SEO C7) : ce qui compte pour le visiteur,
// c'est une grille juste, un état qui survit au rechargement et un stockage
// abîmé qui ne casse rien.
const monter = (el: React.ReactElement) => render(<MemoryRouter>{el}</MemoryRouter>);

describe('habit tracker personnalisé', () => {
  beforeEach(() => { cleanup(); window.localStorage.clear(); });

  it('compte les jours réels du mois, années bissextiles comprises', () => {
    expect(joursDuMois(2027, 1)).toHaveLength(28);
    expect(joursDuMois(2028, 1)).toHaveLength(29);
    expect(joursDuMois(2027, 0)[0].semaine).toBe(5); // 1er janvier 2027 : vendredi
  });

  it('borne un stockage abîmé', () => {
    expect(lireHabit('{pas du json').habitudes).toHaveLength(3);
    const e = lireHabit(JSON.stringify({ annee: 1990, mois: 14, habitudes: ['a', 3, 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] }));
    expect(e.annee).toBe(2027);
    expect(e.mois).toBe(0);
    expect(e.habitudes).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  });

  it('affiche une ligne par habitude saisie et la retrouve après rechargement', () => {
    const { container, unmount } = monter(<HabitTrackerToolPage />);
    fireEvent.change(container.querySelector('#ht-h-0')!, { target: { value: 'Lire 10 minutes' } });
    expect(container.querySelector('tbody')!.textContent).toContain('Lire 10 minutes');
    unmount();
    expect(monter(<HabitTrackerToolPage />).container.querySelector('tbody')!.textContent).toContain('Lire 10 minutes');
  });
});

describe('planning de semaine', () => {
  beforeEach(() => { cleanup(); window.localStorage.clear(); });

  it('ne garde que des cases valides', () => {
    expect(lireGrille(JSON.stringify({ '0-9': 'Rapport', '7-9': 'x', '1-3': 'y', '2-10': '  ', '3-12': 42 }))).toEqual({ '0-9': 'Rapport' });
    expect(lireGrille('[1,2]')).toEqual({});
  });

  it('enregistre un bloc saisi', () => {
    const { container, unmount } = monter(<WeeklyPlannerToolPage />);
    fireEvent.change(container.querySelector('#pl-0-9')!, { target: { value: 'Travail profond' } });
    unmount();
    expect((monter(<WeeklyPlannerToolPage />).container.querySelector('#pl-0-9') as HTMLInputElement).value).toBe('Travail profond');
  });
});

describe('minuteur Pomodoro', () => {
  beforeEach(() => { cleanup(); window.localStorage.clear(); });
  afterEach(() => { vi.useRealTimers(); });

  it('enchaîne pause courte, puis pause longue toutes les quatre sessions', () => {
    expect(phaseSuivante('travail', 1)).toBe('pause');
    expect(phaseSuivante('travail', 4)).toBe('longue');
    expect(phaseSuivante('pause', 4)).toBe('travail');
    expect(phaseSuivante('longue', 8)).toBe('travail');
  });

  it('remet le compteur à zéro un autre jour', () => {
    expect(lirePomodoro(JSON.stringify({ tache: 't', jour: '2000-01-01', sessions: 7 })).sessions).toBe(0);
  });

  it('compte une session quand les 25 minutes sont écoulées, puis passe en pause', () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'Date'] });
    const { container, getByRole } = monter(<PomodoroToolPage />);
    const demarrer = Array.from(container.querySelectorAll('button')).find((b) => b.querySelector('svg') && !b.getAttribute('aria-label') && b.className.includes('bg-blue-600') && !b.dataset.cta)!;
    act(() => { fireEvent.click(demarrer); });
    act(() => { vi.advanceTimersByTime(DUREES.travail * 1000 + 1000); });
    expect(getByRole('timer').textContent).toBe('05:00');
    expect(JSON.parse(window.localStorage.getItem('cosmo_outil_pomodoro')!).sessions).toBe(1);
  });
});
