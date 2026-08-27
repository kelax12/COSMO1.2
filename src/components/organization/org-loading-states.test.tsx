// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// Les onglets entreprise déstructuraient `const { data = [] }` sans jamais
// lire `isLoading`. Pendant le premier fetch ils rendaient donc leur état VIDE
// comme s'il s'agissait de la vérité : « Aucune tâche pour l'instant » sur
// l'Aperçu, et surtout un tableau de bord annonçant 0 tâche / 0 % à un manager
// avant d'afficher ses vrais chiffres.
//
// Ce test garde exactement ça : pendant le chargement, aucune affirmation.
// Il ne vérifie pas qu'un squelette est joli, il vérifie qu'une PHRASE FAUSSE
// n'est pas à l'écran. C'est pour ça que les assertions portent sur les
// libellés d'état vide, pas sur la présence du placeholder seul.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ensureNamespaces } from '@/i18n/catalog';

/** Pilote partagé : chaque test décide si les requêtes ont répondu. */
let loading = true;

const q = <T,>(data: T) => ({ data, isLoading: loading });

vi.mock('@/modules/team-projects', () => ({
  useTeamProjects: () => q([]),
  useTeamTasks: () => q([]),
  useUpdateTeamTask: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
}));
vi.mock('@/modules/team-okrs', () => ({ useTeamOKRs: () => q([]) }));
vi.mock('@/modules/org-teams', () => ({ useOrgTeams: () => q([]) }));
vi.mock('@/modules/events', () => ({ useUpcomingEvents: () => [] }));

// Importés APRÈS les mocks (hoistés par vitest, mais l'ordre reste lisible).
const { default: MyWorkTab } = await import('./MyWorkTab');
const { default: TeamOverviewTab } = await import('./TeamOverviewTab');

const MEMBERS = [
  { orgId: 'o1', userId: 'u1', role: 'admin' as const, managerId: null, joinedAt: '2026-01-01', displayName: 'Vous', email: 'a@b.c' },
];

const renderIn = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('onglets entreprise — aucune affirmation pendant le chargement', () => {
  // `org` n'est pas eager depuis le découpage des catalogues : sans ça, `t()`
  // rend les clés brutes et les assertions porteraient sur « myWork.emptyTitle ».
  beforeAll(async () => {
    await ensureNamespaces(['org'], 'fr');
  });

  beforeEach(() => {
    loading = true;
  });

  it('Aperçu : pas d’état vide tant que les requêtes n’ont pas répondu', () => {
    renderIn(<MyWorkTab orgId="o1" members={MEMBERS} currentUserId="u1" />);

    expect(screen.queryByText(/Aucune tâche/i)).toBeNull();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('Aperçu : l’état vide revient une fois le chargement terminé', () => {
    loading = false;
    renderIn(<MyWorkTab orgId="o1" members={MEMBERS} currentUserId="u1" />);

    // Données réellement vides : là, le message est VRAI, il doit s'afficher.
    // `getAllBy` : l'écran vide et la checklist de démarrage le disent tous deux.
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getAllByText(/Aucune tâche/i).length).toBeGreaterThan(0);
  });

  it('Statistiques : aucun chiffre affiché tant que les requêtes chargent', () => {
    renderIn(
      <TeamOverviewTab orgId="o1" members={MEMBERS} isAdmin currentUserId="u1" />,
    );

    // Le « 0 % » de la carte de synthèse est LE zéro faux qui a motivé ce test.
    expect(screen.queryByText(/0\s*%/)).toBeNull();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('Statistiques : le sélecteur de période reste utilisable pendant le chargement', () => {
    renderIn(
      <TeamOverviewTab orgId="o1" members={MEMBERS} isAdmin currentUserId="u1" />,
    );

    // Le chargement gèle les chiffres, pas la navigation : un garde posé trop
    // haut aurait fait disparaître la barre de période et fait sauter la page.
    expect(screen.getByRole('tablist')).toBeTruthy();
  });
});
