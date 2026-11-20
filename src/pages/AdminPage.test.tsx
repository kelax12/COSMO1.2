// @vitest-environment jsdom
// Console admin : la garde reelle est la RPC serveur, ici on verifie ce que
// voit la personne (redirections silencieuses, squelette, tableaux, etats
// du support et de l'entonnoir) sans jamais afficher un message d'erreur brut.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import type { AdminStats } from '@/modules/admin';

const h = vi.hoisted(() => ({
  isDemo: false,
  stats: { data: undefined, isLoading: false, error: null } as { data?: unknown; isLoading: boolean; error: unknown },
  support: { data: null as unknown },
  funnel: { data: null as unknown },
  usage: { data: null as unknown },
}));

vi.mock('@/modules/auth/AuthContext', () => ({ useAuth: () => ({ isDemo: h.isDemo }) }));
vi.mock('@/components/admin/AdminMfaGate', () => ({ AdminMfaGate: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/modules/admin', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/admin')>()),
  useAdminStats: () => h.stats,
  useSupportStats: () => h.support,
  useOnboardingFunnel: () => h.funnel,
  useUsageByFeature: () => h.usage,
}));
vi.mock('./admin/AdminCharts', () => {
  const stub = (name: string) => () => <div data-testid={`chart-${name}`} />;
  return {
    SignupsChart: stub('signups'), DauChart: stub('dau'), PercentBars: stub('percent'), CountBars: stub('count'),
    Donut: stub('donut'), SourceStackChart: stub('stack'), GoalChart: stub('goal'),
  };
});

import { lazyT } from '@/test/tasks-ui-harness';
import AdminPage from './AdminPage';

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toLocaleDateString('en-CA');
};

const STATS = {
  generatedAt: new Date().toISOString(),
  totals: { users: 40, activeToday: 5, active7d: 12, inactive7dPlus: 20, inactive30dPlus: 8 },
  signupsByDay: [{ day: day(3), count: 2 }, { day: day(1), count: 1 }],
  dau: [{ day: day(1), count: 4 }],
  demo: { visitors: 100, converted: 10, conversionPct: 10 },
  usage: { tasks: 300, habits: 50, events: 40, okrs: 5, sharedTasks: 9 },
  signupsByProvider: { email: 30, google: 10 },
  adoption: { tasksUsers: 30, habitsUsers: 10, eventsUsers: 8, okrsUsers: 2 },
  activation24h: { activated: 6, total: 10 },
  tasksCompletion: { completed: 120, total: 300 },
  collaboration: { sharers: 4, usersWithFriends: 7, acceptedRequests: 9 },
  retentionJ7: [{ week: day(14), signups: 10, retained: 4 }],
  stickiness: { dau: 5, mau: 25 },
  signupsBySource: { linkedin: 12, reddit: 5 },
  signupsBySourceByDay: [{ day: day(2), linkedin: 2, reddit: 1 }],
  activation48h: { activated: 8, total: 20, bySource: { linkedin: { activated: 5, total: 10 } } },
  activation48hByDay: [],
  retentionD7BySource: { linkedin: { signups: 10, retained: 3 } },
  orgs: { total: 6, with3plusMembers: 2, created30d: 3, with3plusMembers30d: 1 },
  support: null,
} as unknown as AdminStats;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/dashboard" element={<div>PAGE-DASHBOARD</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  h.isDemo = false;
  h.stats = { data: STATS, isLoading: false, error: null };
  h.support = { data: null };
  h.funnel = { data: null };
  h.usage = { data: null };
  window.scrollTo = vi.fn() as never;
});

describe('AdminPage', () => {
  it('mode demo : redirige vers le tableau de bord', () => {
    h.isDemo = true;
    renderPage();
    expect(screen.getByText('PAGE-DASHBOARD')).toBeTruthy();
  });

  it('erreur (non admin, 42501) : redirection silencieuse, aucun message brut', () => {
    h.stats = { data: undefined, isLoading: false, error: new Error('42501 permission denied') };
    const { container } = renderPage();
    expect(screen.getByText('PAGE-DASHBOARD')).toBeTruthy();
    expect(container.textContent).not.toContain('42501');
  });

  it('chargement : squelette, ni redirection ni tableau', () => {
    h.stats = { data: undefined, isLoading: true, error: null };
    const { container } = renderPage();
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(4);
    expect(screen.queryByText('PAGE-DASHBOARD')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('donnees : objectifs, tableau des canaux trie par volume, remonte en haut de page', async () => {
    renderPage();
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
    expect(screen.getByText('40 / 1000')).toBeTruthy();
    expect(screen.getByText('2 / 10')).toBeTruthy();
    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0].textContent).toContain('linkedin');
    expect(rows[0].textContent).toContain('12');
    expect(rows[1].textContent).toContain('reddit');
    expect((await screen.findAllByTestId('chart-goal')).length).toBeGreaterThan(0);
  });

  it('support non installe (null) : le dit au lieu d\'afficher des zeros', async () => {
    renderPage();
    expect(await screen.findByText(lazyT('admin').t('supportNotInstalled'))).toBeTruthy();
  });

  it('support et entonnoir renseignes : les graphiques de comptage apparaissent', async () => {
    h.support = {
      data: { received: 5, received30d: 3, answered: 2, resolved: 1, awaiting: 3, oldestAwaitingDays: 6, medianResponseHours: 4, byCategory: {}, byDay: [] },
    };
    h.funnel = {
      data: {
        windowDays: 30,
        perso: { signups: 10, withTask: 8, withSlot: 5, withHabit: 4, withOkr: 1, mature: 6, cameBack: 3, matureWithTask: 4, cameBackWithTask: 3 },
        businessSignups: 2,
        orgs: { created: 3, withTeam: 2, withMember: 2, withProject: 1, withOkr: 0 },
      },
    };
    renderPage();
    expect((await screen.findAllByTestId('chart-count')).length).toBeGreaterThanOrEqual(2);
  });

  it('usage par fonctionnalite : tableau, valeurs masquees en point, ou mesure non installee', async () => {
    h.usage = {
      data: {
        minUsers: 3,
        features: [
          { feature: 'tasks', active7d: 5, active30d: 8, actions30d: 40 },
          { feature: 'friends', active7d: null, active30d: null, actions30d: null },
        ],
      },
    };
    const { unmount } = renderPage();
    const rows = (await screen.findByTestId('admin-usage-table')).querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('40');
    expect(rows[1].textContent).toContain('·');
    unmount();
    h.usage = { data: null };
    renderPage();
    expect(await screen.findByText(lazyT('admin').t('featureUsageNotInstalled'))).toBeTruthy();
  });
});
