// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// L'espace entreprise était au TROISIÈME niveau de navigation sur mobile :
// « Plus » → feuille → Entreprise. C'est la seule zone collaborative du
// produit, et celle qui portera la facturation.
//
// Ce test garde les deux moitiés de la décision du 2026-08-27 :
//   • un membre d'une organisation a « Entreprise » dans la barre du bas ;
//   • elle REMPLACE « Habitudes » au lieu de s'ajouter en 6e position — à
//     375 px, six éléments passent sous la cible tactile.
// Sans la seconde, un futur ajout ferait grossir la barre sans que rien
// n'échoue, et la régression serait invisible en revue.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ensureNamespaces } from '@/i18n/catalog';

let activeOrg: { id: string } | null = null;

vi.mock('@/modules/organizations', () => ({
  useActiveOrganization: () => ({ activeOrg, organizations: [], setActiveOrgId: vi.fn(), isLoading: false }),
}));
vi.mock('@/lib/hooks/use-org-notifications', () => ({ useOrgNotificationCount: () => 0 }));
vi.mock('@/modules/friends', () => ({ usePendingRequestCount: () => 0 }));
vi.mock('@/modules/tasks', () => ({ useTasks: () => ({ data: [] }) }));
// La feuille « Plus » monte des providers dont ce test n'a pas besoin.
vi.mock('./MobileMoreSheet', () => ({ default: () => null }));

const { default: MobileTabBar } = await import('./MobileTabBar');

const labels = () =>
  screen.getAllByRole('link').map((a) => a.textContent?.trim() ?? '');

describe('MobileTabBar — place de l’espace entreprise', () => {
  beforeAll(async () => {
    await ensureNamespaces(['common'], 'fr');
  });

  beforeEach(() => {
    activeOrg = null;
  });

  it('sans organisation : les 4 onglets d’origine, pas d’Entreprise', () => {
    render(<MemoryRouter><MobileTabBar /></MemoryRouter>);
    const found = labels();
    expect(found).toHaveLength(4);
    expect(found.some((l) => /Habitudes/.test(l))).toBe(true);
    expect(found.some((l) => /Entreprise/.test(l))).toBe(false);
  });

  it('membre d’une organisation : Entreprise remplace Habitudes', () => {
    activeOrg = { id: 'org-1' };
    render(<MemoryRouter><MobileTabBar /></MemoryRouter>);
    const found = labels();
    expect(found.some((l) => /Entreprise/.test(l))).toBe(true);
    expect(found.some((l) => /Habitudes/.test(l))).toBe(false);
  });

  it('la barre ne dépasse jamais 5 éléments, Plus compris', () => {
    activeOrg = { id: 'org-1' };
    render(<MemoryRouter><MobileTabBar /></MemoryRouter>);
    // 4 liens + le bouton « Plus ». C'est la contrainte de largeur à 375 px,
    // pas une préférence : au-delà, les libellés se tronquent.
    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  it('/entreprise pointe bien vers la page, pas vers un menu', () => {
    activeOrg = { id: 'org-1' };
    render(<MemoryRouter><MobileTabBar /></MemoryRouter>);
    const link = screen.getAllByRole('link').find((a) => /Entreprise/.test(a.textContent ?? ''));
    expect(link?.getAttribute('href')).toBe('/entreprise');
  });
});
