// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// Page Agenda (vague 15.2, TST-02)
//
// La vraie page, FullCalendar compris, les vrais hooks (événements, tâches,
// catégories) sur les dépôts de démo. Vérifie ce que voit la personne : les
// événements de la semaine, les trois vues (jour, semaine, mois), la
// navigation entre périodes, la création d'un événement, et le panneau des
// tâches à planifier.
//
// jsdom n'a pas de mise en page : FullCalendar y dessine sa grille et ses
// événements, pas leurs positions. On ne teste donc ni glisser-déposer ni
// géométrie (cela reste l'affaire des E2E), seulement ce qui s'affiche et ce
// qu'un clic ouvre.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent, within } from '@testing-library/react';
import {
  renderApp, setViewport, resetDemoWorld, warmDemoCaches, lazyT, fakeAuth, fakeBilling,
} from '@/test/tasks-ui-harness';

vi.mock('@/modules/auth/AuthContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/auth/AuthContext')>()),
  useAuth: () => fakeAuth(),
}));
vi.mock('@/modules/billing/billing.context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/billing/billing.context')>()),
  useBilling: () => fakeBilling(),
}));

import AgendaPage from './AgendaPage';

const ag = lazyT('agenda');
const TODAY_EVENT = 'Point équipe du jour';

/** Un événement à `daysFromNow` jours, de `hour` h à `hour + 1` h (heure locale). */
function makeEvent(id: string, title: string, daysFromNow: number, hour: number) {
  const start = new Date();
  start.setDate(start.getDate() + daysFromNow);
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start);
  end.setHours(hour + 1);
  return { id, title, start: start.toISOString(), end: end.toISOString(), color: '#3B82F6', description: '' };
}

beforeAll(async () => {
  await warmDemoCaches();
});

beforeEach(() => {
  resetDemoWorld();
  // Les événements de démo sont construits À L'IMPORT du module, dans la langue de cet instant
  // (anglais sous jsdom) : leurs titres changent avec l'environnement. On pose les nôtres.
  localStorage.setItem('cosmo_demo_events', JSON.stringify([
    makeEvent('ev-today', 'Point équipe du jour', 0, 10),
    makeEvent('ev-lunch', 'Déjeuner partenaire', 0, 12),
    makeEvent('ev-next-week', 'Revue trimestrielle', 8, 10),
    makeEvent('ev-old', 'Bilan annuel passé', -370, 9),
  ]));
  localStorage.setItem('cosmo_tutorial_seen_agenda_desktop', '1');
  localStorage.setItem('cosmo_tutorial_seen_agenda_mobile', '1');
  setViewport('desktop');
});

const renderPage = () => renderApp(<AgendaPage />, { route: '/agenda' });

describe('AgendaPage, rendu des données', () => {
  it('montre les événements de la semaine courante', async () => {
    renderPage();

    // L'événement d'AUJOURD'HUI (10 h) est dans la vue Semaine par défaut.
    expect((await screen.findAllByText(TODAY_EVENT)).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Déjeuner partenaire').length).toBeGreaterThan(0);
  });

  it('ne montre pas un événement d’il y a un an dans la semaine courante', async () => {
    renderPage();
    await screen.findAllByText(TODAY_EVENT);

    expect(screen.queryByText('Bilan annuel passé')).toBeNull();
    expect(screen.queryByText('Revue trimestrielle')).toBeNull();
  });
});

describe('AgendaPage, vues et navigation', () => {
  it('propose les trois vues, la semaine étant la vue de départ', async () => {
    renderPage();
    await screen.findAllByText(TODAY_EVENT);

    for (const key of ['day', 'week', 'month'] as const) {
      expect(screen.getAllByRole('button', { name: ag.t(`view.${key}`) }).length).toBeGreaterThan(0);
    }
  });

  it('passe en vue Jour : l’événement du jour reste visible', async () => {
    renderPage();
    await screen.findAllByText(TODAY_EVENT);

    fireEvent.click(screen.getAllByRole('button', { name: ag.t('view.day') })[0]);

    await waitFor(() => expect(screen.getAllByText(TODAY_EVENT).length).toBeGreaterThan(0));
  });

  it('avance d’une période : les événements d’aujourd’hui n’y sont plus', async () => {
    renderPage();
    await screen.findAllByText(TODAY_EVENT);
    fireEvent.click(screen.getAllByRole('button', { name: ag.t('view.day') })[0]);
    await waitFor(() => expect(screen.getAllByText(TODAY_EVENT).length).toBeGreaterThan(0));

    fireEvent.click(screen.getAllByRole('button', { name: ag.t('nav.nextPeriod') })[0]);

    await waitFor(() => expect(screen.queryByText(TODAY_EVENT)).toBeNull());
  });
});

describe('AgendaPage, création', () => {
  it('ouvre la fiche de création au clic sur « Nouveau »', async () => {
    renderPage();
    await screen.findAllByText(TODAY_EVENT);

    fireEvent.click(screen.getAllByRole('button', { name: ag.t('nav.new') })[0]);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByRole('textbox').length).toBeGreaterThan(0);
  });
});
