// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// Page Statistiques (vague 15.2, TST-02)
//
// La vraie page, les vrais hooks (tâches, événements, OKR, habitudes, temps
// travaillé) sur les dépôts de démo : seules la session et la facturation sont
// simulées. Vérifie ce que voit la personne : les cinq familles à la suite, la
// période, le total de temps investi, la bascule vers le détail, l'objectif du
// graphique, et la porte « Premium » quand l'analyse détaillée est fermée.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import {
  renderApp, setViewport, resetDemoWorld, warmDemoCaches, lazyT, fakeAuth, fakeBilling,
  makeTask, dayKeyFromToday,
} from '@/test/tasks-ui-harness';

const billing = vi.hoisted(() => ({ premium: true }));

vi.mock('@/modules/auth/AuthContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/auth/AuthContext')>()),
  useAuth: () => fakeAuth(),
}));
vi.mock('@/modules/billing/billing.context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/billing/billing.context')>()),
  useBilling: () => ({ ...fakeBilling(), isPremium: () => billing.premium }),
}));

import StatisticsPage from './StatisticsPage';

const st = lazyT('statistics');

beforeAll(async () => {
  await warmDemoCaches();
});

beforeEach(() => {
  resetDemoWorld();
  localStorage.setItem('cosmo_tutorial_seen_statistics_desktop', '1');
  setViewport('desktop');
  billing.premium = true;
});

const renderPage = () => renderApp(<StatisticsPage />, { route: '/statistics' });

describe('StatisticsPage, structure', () => {
  it('empile les cinq familles de statistiques sous leur titre', async () => {
    renderPage();

    for (const key of ['all', 'tasks', 'agenda', 'okr', 'habits'] as const) {
      expect(await screen.findByRole('heading', { level: 2, name: new RegExp(st.t(`sections.${key}`)) })).toBeTruthy();
    }
  });

  it('qualifie la vue globale par la période, « 7 derniers jours » au départ', async () => {
    renderPage();

    const heading = await screen.findByRole('heading', { level: 2, name: /Vue globale/ });
    expect(heading.textContent).toContain(st.t('periodDescription.week'));
  });

  it('change la période et le qualificatif de la vue globale', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 2, name: /Vue globale/ });

    fireEvent.click(screen.getByRole('button', { name: st.t('periods.month') }));

    await waitFor(() => {
      const heading = screen.getByRole('heading', { level: 2, name: /Vue globale/ });
      expect(heading.textContent).toContain(st.t('periodDescription.month'));
    });
    fireEvent.click(screen.getByRole('button', { name: st.t('periods.day') }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /Vue globale/ }).textContent).toContain(st.t('periodDescription.day'));
    });
  });
});

describe('StatisticsPage, graphique du temps investi', () => {
  it('annonce la moyenne et le total de temps investi', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { level: 2, name: st.t('chart.timeInvested') })).toBeTruthy();
    expect(screen.getByText(/Moyenne\s*:/)).toBeTruthy();
  });

  it('masque le champ de l’objectif quand la case « Objectif » est décochée', async () => {
    renderPage();
    const goal = await screen.findByRole('spinbutton', { name: st.t('chart.goalValueAria') });
    expect((goal as HTMLInputElement).value).toBe('60');

    fireEvent.click(screen.getByRole('checkbox', { name: st.t('chart.goal') }));

    expect(screen.queryByRole('spinbutton', { name: st.t('chart.goalValueAria') })).toBeNull();
  });

  it('suit la valeur d’objectif saisie', async () => {
    renderPage();
    const goal = await screen.findByRole('spinbutton', { name: st.t('chart.goalValueAria') });

    fireEvent.change(goal, { target: { value: '90' } });

    expect((screen.getByRole('spinbutton', { name: st.t('chart.goalValueAria') }) as HTMLInputElement).value).toBe('90');
  });

  it('bascule vers le détail par catégorie puis revient à « Tout »', async () => {
    renderPage();
    const toDetail = await screen.findByRole('button', { name: new RegExp(st.t('page.seeDetail')) });
    expect(toDetail.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(toDetail);

    const back = await screen.findByRole('button', { name: new RegExp(st.t('overview.showAll')) });
    expect(back.getAttribute('aria-pressed')).toBe('true');
    // Le graphique de l'ensemble cède la place au détail.
    expect(screen.queryByRole('heading', { level: 2, name: st.t('chart.timeInvested') })).toBeNull();
  });
});

describe('StatisticsPage, données', () => {
  it('compte une tâche terminée aujourd’hui dans la section Tâches', async () => {
    const today = new Date();
    resetDemoWorld([
      makeTask({
        id: 't-stat-1', name: 'Tâche terminée du jour', completed: true, estimatedTime: 45, dueDay: dayKeyFromToday(0),
        completedAt: today.toISOString(),
      }),
    ]);
    localStorage.setItem('cosmo_tutorial_seen_statistics_desktop', '1');
    renderPage();

    await screen.findByRole('heading', { level: 2, name: new RegExp(st.t('sections.tasks')) });
    await waitFor(() => expect(screen.getAllByText(/45\s*min|0?h\s*45|45m/i).length).toBeGreaterThan(0));
  });
});

describe('StatisticsPage, porte Premium', () => {
  it('remplace le graphique par la porte quand l’analyse détaillée est fermée', async () => {
    billing.premium = false;
    renderPage();

    expect(await screen.findByText(st.t('gate.title'))).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2, name: st.t('chart.timeInvested') })).toBeNull();
    expect(screen.queryByRole('heading', { level: 2, name: /Vue globale/ })).toBeNull();
  });

  it('ouvre la fenêtre de déblocage au clic sur le bouton de la porte', async () => {
    billing.premium = false;
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: st.t('gate.cta') }));

    expect(await screen.findByRole('dialog')).toBeTruthy();
  });
});
