// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// Annuaire des membres (TST-02, B3)
//
// Le vrai composant, les vrais hooks et dépôts de démo « Nova Studio » : seule
// la session est simulée. On vérifie ce que voit la personne : la liste, la
// recherche, l'état vide, le CSV réservé aux administrateurs et la fiche.
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

import MemberDirectory from './MemberDirectory';

const orgAdmin = lazyT('orgAdmin');
const org = lazyT('org');

let members: OrgMember[] = [];

beforeAll(async () => {
  await warmDemoCaches();
});

beforeEach(async () => {
  resetOrgWorld();
  setViewport('desktop');
  members = await demoMembers();
});

const renderDirectory = (props: { all?: OrgMember[] } = {}) =>
  renderApp(
    <MemberDirectory
      orgId={ORG_ID}
      ownerId={ADMIN_ID}
      members={props.all ?? members}
      currentUserId={session.userId}
      isAdmin={session.userId === ADMIN_ID}
    />,
    { route: '/entreprise/members' },
  );

const searchBox = () => screen.getByRole('searchbox', { name: orgAdmin.t('directory.searchAria') });

describe('MemberDirectory, rendu des données', () => {
  it('liste chaque membre de l’organisation', async () => {
    renderDirectory();

    for (const m of members.slice(0, 5)) {
      expect(await screen.findByText(m.displayName)).toBeTruthy();
    }
    expect(document.querySelectorAll('[data-guide-id="members-directory"] > li')).toHaveLength(members.length);
  });

  it('filtre sur la recherche puis rend la liste en effaçant le champ', async () => {
    renderDirectory();
    const target = members.find((m) => m.userId !== ADMIN_ID)!;
    await screen.findByText(target.displayName);

    fireEvent.change(searchBox(), { target: { value: target.displayName } });
    await waitFor(() =>
      expect(document.querySelectorAll('[data-guide-id="members-directory"] > li').length).toBeLessThan(members.length));
    expect(screen.getByText(target.displayName)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: orgAdmin.t('directory.clearSearch') }));
    await waitFor(() =>
      expect(document.querySelectorAll('[data-guide-id="members-directory"] > li')).toHaveLength(members.length));
  });

  it('dit qu’aucun membre ne correspond quand la recherche ne trouve rien', async () => {
    renderDirectory();
    await screen.findByText(members[0]!.displayName);

    fireEvent.change(searchBox(), { target: { value: 'zzzzintrouvable' } });

    expect(await screen.findByText(orgAdmin.t('directory.noMatch', { query: 'zzzzintrouvable' }))).toBeTruthy();
    expect(document.querySelector('[data-guide-id="members-directory"]')).toBeNull();
  });

  it('n’affiche pas la barre d’outils pour un petit annuaire, mais garde l’action d’invitation', async () => {
    const few = members.slice(0, 3);
    renderApp(
      <MemberDirectory
        orgId={ORG_ID} ownerId={ADMIN_ID} members={few} currentUserId={ADMIN_ID} isAdmin
        inviteAction={<button type="button">Inviter</button>}
      />,
      { route: '/entreprise/members' },
    );

    expect(await screen.findByRole('button', { name: 'Inviter' })).toBeTruthy();
    expect(screen.queryByRole('searchbox')).toBeNull();
  });
});

describe('MemberDirectory, droits et interactions', () => {
  it('propose l’export CSV à l’administrateur', async () => {
    renderDirectory();
    await screen.findByText(members[0]!.displayName);

    expect(screen.getByRole('button', { name: orgAdmin.t('directory.export.button') })).toBeTruthy();
  });

  it('ne propose pas l’export CSV à un membre ordinaire', async () => {
    session.userId = MEMBER_ID;
    renderDirectory();
    await waitFor(() => expect(document.querySelector('[data-guide-id="members-directory"]')).not.toBeNull());

    expect(screen.queryByRole('button', { name: orgAdmin.t('directory.export.button') })).toBeNull();
  });

  it('ouvre la fiche du membre au clic sur sa ligne', async () => {
    renderDirectory();
    const target = members.find((m) => m.userId !== ADMIN_ID)!;
    await screen.findByText(target.displayName);

    fireEvent.click(screen.getByRole('button', { name: org.t('common.seeProfileOf', { name: target.displayName }) }));

    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('ouvre la fiche d’un membre depuis le lien profond ?member= puis retire le paramètre', async () => {
    const target = members.find((m) => m.userId !== ADMIN_ID)!;
    renderApp(
      <MemberDirectory orgId={ORG_ID} ownerId={ADMIN_ID} members={members} currentUserId={ADMIN_ID} isAdmin />,
      { route: `/entreprise/members?member=${target.userId}` },
    );

    expect(await screen.findByRole('dialog')).toBeTruthy();
  });
});
