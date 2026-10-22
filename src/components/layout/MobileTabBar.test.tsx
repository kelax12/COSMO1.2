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
let orgLoading = false;
let wasOrgMember = false;

vi.mock('@/modules/organizations', () => ({
  useActiveOrganization: () => ({
    activeOrg, organizations: [], setActiveOrgId: vi.fn(), isLoading: orgLoading, wasOrgMember,
  }),
}));
// Maquette 84 : la barre lit les compteurs VENTILÉS (`members` / `projects`),
// plus le total — le mock suit, sinon le composant lit `undefined.members`.
let orgBadges = { projects: 0, members: 0, total: 0, projectItems: [], memberItems: [] };
vi.mock('@/lib/hooks/use-org-notifications', () => ({
  useOrgBadges: () => orgBadges,
  useOrgNotificationCount: () => orgBadges.total,
}));
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
    orgLoading = false;
    wasOrgMember = false;
    orgBadges = { projects: 0, members: 0, total: 0, projectItems: [], memberItems: [] };
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

  // ── F3 : la barre ne change pas d'identité sous le doigt ────────────
  //
  // Ces deux cas sont l'ETAT TRANSITOIRE, celui qu'on ne voit pas en
  // regardant un écran fini : la requête d'organisations n'a pas encore
  // répondu. C'est là que « Habitudes » se transformait en « Entreprise ».

  it('chargement, membre connu de l’appareil : Entreprise est DÉJÀ là', () => {
    orgLoading = true;
    wasOrgMember = true;
    render(<MemoryRouter><MobileTabBar /></MemoryRouter>);
    const found = labels();
    expect(found.some((l) => /Entreprise/.test(l))).toBe(true);
    expect(found.some((l) => /Habitudes/.test(l))).toBe(false);
  });

  it('chargement, appareil qui n’a jamais vu d’organisation : pas d’onglet fantôme', () => {
    orgLoading = true;
    wasOrgMember = false;
    render(<MemoryRouter><MobileTabBar /></MemoryRouter>);
    const found = labels();
    expect(found.some((l) => /Entreprise/.test(l))).toBe(false);
    expect(found.some((l) => /Habitudes/.test(l))).toBe(true);
  });

  it('requête résolue SANS organisation : l’indice ne survit pas à la vérité', () => {
    orgLoading = false;
    wasOrgMember = true;
    activeOrg = null;
    render(<MemoryRouter><MobileTabBar /></MemoryRouter>);
    expect(labels().some((l) => /Entreprise/.test(l))).toBe(false);
  });

  it('/entreprise pointe bien vers la page, pas vers un menu', () => {
    activeOrg = { id: 'org-1' };
    render(<MemoryRouter><MobileTabBar /></MemoryRouter>);
    const link = screen.getAllByRole('link').find((a) => /Entreprise/.test(a.textContent ?? ''));
    expect(link?.getAttribute('href')).toBe('/entreprise');
  });
});

// ── Maquette 84 : deux niveaux de signal, jamais les deux ensemble ────────
//
// Ce qui est gardé ici n'est pas un style, c'est une DÉCISION : le rouge est
// réservé à ce qui attend une réponse. Sans ce test, « le point suffit » se
// reperdrait au premier ajout de compteur, et la barre redeviendrait rouge en
// permanence — l'état exact mesuré le 2026-09-19.
describe('MobileTabBar — badges de l’onglet Entreprise (maquette 84)', () => {
  beforeAll(async () => {
    await ensureNamespaces(['common'], 'fr');
  });

  beforeEach(() => {
    activeOrg = { id: 'org-1' };
    orgLoading = false;
    wasOrgMember = false;
    orgBadges = { projects: 0, members: 0, total: 0, projectItems: [], memberItems: [] };
  });

  it('demande d’adhésion en attente : un NOMBRE, parce qu’il faut trancher', () => {
    orgBadges = { ...orgBadges, members: 2, total: 2 };
    render(<MemoryRouter><MobileTabBar /></MemoryRouter>);
    expect(screen.getByLabelText(/2 demandes d’adhésion/i).textContent).toBe('2');
  });

  it('seulement du nouveau : un POINT, et aucun chiffre', () => {
    orgBadges = { ...orgBadges, projects: 4, total: 4 };
    render(<MemoryRouter><MobileTabBar /></MemoryRouter>);
    const dot = screen.getByLabelText(/nouveautés/i);
    expect(dot).toBeTruthy();
    expect(dot.textContent).toBe('');
  });

  it('les deux à la fois : la décision gagne, le point ne s’affiche pas', () => {
    orgBadges = { ...orgBadges, members: 1, projects: 9, total: 10 };
    render(<MemoryRouter><MobileTabBar /></MemoryRouter>);
    expect(screen.getByLabelText(/1 demande d’adhésion/i).textContent).toBe('1');
    expect(screen.queryByLabelText(/nouveautés/i)).toBeNull();
    // 🔴 Et surtout : le total (10) ne doit apparaître NULLE PART. C'est lui
    // qui s'affichait avant, et il additionnait deux choses de nature
    // différente pour produire un nombre que rien ne permettait d'expliquer.
    expect(screen.queryByText('10')).toBeNull();
  });

  it('rien en attente : aucune marque du tout', () => {
    render(<MemoryRouter><MobileTabBar /></MemoryRouter>);
    expect(screen.queryByLabelText(/demande d’adhésion/i)).toBeNull();
    expect(screen.queryByLabelText(/nouveautés/i)).toBeNull();
  });
});
