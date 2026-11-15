// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// Rapports d'activité de l'espace entreprise (TST-02, B3)
//
// Le vrai composant et les vrais hooks ; le dépôt des rapports est piloté pour
// atteindre les états chargement, erreur, vide et données. Le droit de lire un
// rapport vient des vrais dépôts de démo (« Nova Studio »).
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import {
  renderApp, setViewport, resetOrgWorld, warmDemoCaches, demoMembers, denyPermissions, lazyT,
  session, fakeAuth, ORG_ID, MEMBER_ID,
} from '@/test/org-ui-harness';
import type { OrgMember } from '@/modules/organizations';

vi.mock('@/modules/auth/AuthContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/auth/AuthContext')>()),
  useAuth: () => ({
    ...fakeAuth(),
    user: { id: session.userId, name: session.userId, email: `${session.userId}@cosmo.app` },
  }),
}));

const reports = vi.hoisted(() => ({ getReports: vi.fn() }));
vi.mock('@/modules/org-reports/local.repository', () => ({
  LocalOrgReportsRepository: class {
    getReports = (...args: unknown[]) => reports.getReports(...args);
  },
}));

import OrgReportsSection from './OrgReportsSection';

const t = lazyT('orgAdmin');

let members: OrgMember[] = [];

beforeAll(async () => {
  await warmDemoCaches();
});

beforeEach(async () => {
  resetOrgWorld();
  setViewport('desktop');
  members = await demoMembers();
  reports.getReports.mockReset();
  reports.getReports.mockResolvedValue([]);
});

const renderReports = () =>
  renderApp(
    <OrgReportsSection orgId={ORG_ID} members={members} currentUserId={session.userId} />,
    { route: '/entreprise/reports' },
  );

describe('OrgReportsSection, états de la période', () => {
  it('annonce le chargement avant les premières données', async () => {
    reports.getReports.mockReturnValue(new Promise(() => {}));
    renderReports();

    expect((await screen.findAllByText(t.t('reports.loading'))).length).toBeGreaterThan(0);
  });

  it('dit « pas encore de rapport » quand aucune journée n’est figée', async () => {
    renderReports();

    expect(await screen.findByText(t.t('reports.noReportYet'), {}, { timeout: 8000 })).toBeTruthy();
    expect(screen.getByText(t.t('reports.kpiTasks'))).toBeTruthy();
  });

  it('propose de réessayer après une erreur, et recharge au clic', async () => {
    reports.getReports.mockRejectedValue(new Error('boom'));
    renderReports();

    const retry = await screen.findByRole('button', { name: t.t('reports.retry') }, { timeout: 8000 });
    expect(screen.getByText(t.t('reports.error'))).toBeTruthy();
    expect((screen.getByRole('button', { name: t.t('reports.exportPdf') }) as HTMLButtonElement).disabled).toBe(true);

    const calls = reports.getReports.mock.calls.length;
    fireEvent.click(retry);
    await waitFor(() => expect(reports.getReports.mock.calls.length).toBeGreaterThan(calls));
  });

  it('chiffre une journée figée : tâches, projets, OKR, événements et fiche par personne', async () => {
    const day = new Date();
    day.setDate(day.getDate() - 1);
    day.setHours(10, 0, 0, 0);
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    const who = members.find((m) => m.userId !== session.userId)!;
    const end = new Date(day.getTime() + 90 * 60000);
    reports.getReports.mockResolvedValue([{
      day: key,
      generatedAt: day.toISOString(),
      payload: {
        version: 1,
        tasks: [{
          id: 't1', name: 'Tâche livrée', projectId: 'p1', projectName: 'Projet Alpha', projectColor: 'blue',
          byId: who.userId, byName: who.displayName, at: day.toISOString(),
        }],
        projects: [{ id: 'p1', name: 'Projet Alpha', color: 'blue', done: 3, total: 4, completedToday: 1, before: 50, after: 75 }],
        krs: [{ id: 'k1', title: 'Résultat clé Beta', okrTitle: 'Objectif Gamma', unit: null, value: 5, target: 10, before: 2, after: 5, completed: false }],
        events: [{ userId: who.userId, userName: who.displayName, title: 'Réunion Delta', start: day.toISOString(), end: end.toISOString() }],
        teams: [{ id: 'tm1', name: 'Équipe Epsilon', color: 'blue', tasksDone: 2 }],
        truncated: false,
      },
    }]);
    renderReports();

    expect((await screen.findAllByText('Tâche livrée', {}, { timeout: 8000 })).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Projet Alpha').length).toBeGreaterThan(0);
    expect(screen.getByText('Résultat clé Beta')).toBeTruthy();
    expect(screen.getAllByText('Réunion Delta').length).toBeGreaterThan(0);
    expect(screen.queryByText(t.t('reports.noReportYet'))).toBeNull();
  });
});

describe('OrgReportsSection, période et périmètre', () => {
  it('change de période et marque le choix actif', async () => {
    renderReports();
    await screen.findByText(t.t('reports.noReportYet'), {}, { timeout: 8000 });

    fireEvent.click(screen.getByRole('button', { name: t.t('reports.periodMonth') }));
    expect(screen.getByRole('button', { name: t.t('reports.periodMonth') }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: t.t('reports.periodWeek') }).getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: t.t('reports.periodCustom') }));
    expect(await screen.findByText(t.t('reports.from'))).toBeTruthy();
    expect(screen.queryByRole('button', { name: t.t('reports.prev') })).toBeNull();
  });

  it('recule d’une période puis ré-avance : « suivante » est grisée sur la dernière période', async () => {
    renderReports();
    await screen.findByText(t.t('reports.noReportYet'), {}, { timeout: 8000 });

    const next = screen.getByRole('button', { name: t.t('reports.next') }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: t.t('reports.prev') }));
    await waitFor(() => expect((screen.getByRole('button', { name: t.t('reports.next') }) as HTMLButtonElement).disabled).toBe(false));
  });

  it('refuse l’accès à un membre sans droit de rapport', async () => {
    session.userId = MEMBER_ID;
    denyPermissions(MEMBER_ID, ['report.org', 'report.allTeams']);
    renderReports();

    expect(await screen.findByText(t.t('reports.noAccess'), {}, { timeout: 8000 })).toBeTruthy();
    expect(screen.queryByRole('group', { name: t.t('reports.periodLabel') })).toBeNull();
  });
});
