// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// Onglet Pyramide de l'espace entreprise (TST-02, B3)
//
// Le vrai onglet, les vraies cartes (`PyramidNodeCard`), les dépôts de démo
// « Nova Studio » : squelette de chargement, cartes de l'organigramme, repli
// d'une branche, recherche, fiche membre, droits d'édition de la hiérarchie.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import {
  renderApp, setViewport, resetOrgWorld, warmDemoCaches, demoMembers, lazyT,
  session, fakeAuth, ORG_ID, ADMIN_ID, MEMBER_ID,
} from '@/test/org-ui-harness';
import type { OrgMember } from '@/modules/organizations';

vi.mock('@/modules/auth/AuthContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/auth/AuthContext')>()),
  useAuth: () => ({
    ...fakeAuth(),
    user: { id: session.userId, name: session.userId, email: `${session.userId}@cosmo.app` },
  }),
}));

import PyramidTab from './PyramidTab';

const ta = lazyT('orgAdmin');

let members: OrgMember[] = [];

beforeAll(async () => {
  await warmDemoCaches();
});

beforeEach(async () => {
  resetOrgWorld();
  setViewport('desktop');
  members = await demoMembers();
});

const renderPyramid = (over: { loading?: boolean; all?: OrgMember[]; route?: string } = {}) =>
  renderApp(
    <PyramidTab
      orgId={ORG_ID}
      ownerId={ADMIN_ID}
      members={over.all ?? members}
      currentUserId={session.userId}
      isAdmin={session.userId === ADMIN_ID}
      loading={over.loading}
    />,
    { route: over.route ?? '/entreprise/pyramid' },
  );

const cards = () => screen.queryAllByRole('button').filter((b) => (b.getAttribute('aria-label') ?? '').length > 0);

describe('PyramidTab, rendu', () => {
  it('affiche un squelette pendant le chargement des membres', () => {
    renderPyramid({ loading: true, all: [] });

    expect(screen.queryByPlaceholderText(ta.t('pyramid.searchPlaceholder'))).toBeNull();
    expect(cards()).toHaveLength(0);
  });

  it('dessine une carte par membre placé, l’utilisateur courant en « Vous »', async () => {
    renderPyramid();

    expect((await screen.findAllByText(ta.t('pyramid.you'))).length).toBeGreaterThan(0);
    const root = members.find((m) => !m.managerId && m.userId !== ADMIN_ID) ?? members.find((m) => m.userId !== ADMIN_ID)!;
    expect(cards().length).toBeGreaterThan(1);
    expect(document.body.textContent).toContain(root.displayName.split(' ')[0]);
  });

  it('replie puis déplie une branche', async () => {
    renderPyramid();
    await screen.findAllByText(ta.t('pyramid.you'));

    const collapse = screen.getAllByRole('button', { name: /^Replier/ });
    const expandedBefore = screen.queryAllByRole('button', { name: /^Déplier/ }).length;
    fireEvent.click(collapse[0]!);

    await waitFor(() => expect(screen.queryAllByRole('button', { name: /^Déplier/ }).length).toBe(expandedBefore + 1));
    fireEvent.click(screen.getAllByRole('button', { name: /^Déplier/ })[0]!);
    await waitFor(() => expect(screen.queryAllByRole('button', { name: /^Déplier/ }).length).toBe(expandedBefore));
  });
});

describe('PyramidTab, recherche et fiche', () => {
  it('efface la recherche avec la croix', async () => {
    renderPyramid();
    const box = await screen.findByRole('searchbox', { name: ta.t('pyramid.searchAria') }).catch(() => screen.getByLabelText(ta.t('pyramid.searchAria')));

    fireEvent.change(box, { target: { value: 'zzz' } });
    fireEvent.click(await screen.findByRole('button', { name: ta.t('pyramid.clearSearch') }));

    expect((screen.getByLabelText(ta.t('pyramid.searchAria')) as HTMLInputElement).value).toBe('');
  });

  it('ouvre la fiche d’un membre au clic sur sa carte', async () => {
    renderPyramid();
    await screen.findAllByText(ta.t('pyramid.you'));
    const target = members.find((m) => m.userId !== ADMIN_ID)!;

    fireEvent.click(screen.getAllByRole('button').find((b) => (b.getAttribute('aria-label') ?? '').includes(target.displayName))!);

    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('ouvre la fiche depuis le lien profond ?member=', async () => {
    const target = members.find((m) => m.userId !== ADMIN_ID)!;
    renderPyramid({ route: `/entreprise/pyramid?member=${target.userId}` });

    expect(await screen.findByRole('dialog')).toBeTruthy();
  });
});

describe('PyramidTab, droits d’édition de la hiérarchie', () => {
  it('propose « Modifier » à l’administrateur et passe en mode édition', async () => {
    renderPyramid();

    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^${ta.t('pyramid.edit')}`) }));

    expect(await screen.findByRole('button', { name: new RegExp(ta.t('pyramid.done')) })).toBeTruthy();
  });

  it('ne propose pas « Modifier » à un membre ordinaire', async () => {
    session.userId = MEMBER_ID;
    renderPyramid();
    await screen.findAllByText(ta.t('pyramid.you'));

    expect(screen.queryByRole('button', { name: new RegExp(`^${ta.t('pyramid.edit')}`) })).toBeNull();
  });
});
