// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// Boîte de réception (vague 15.2, TST-02)
//
// Le vrai composant, les vrais hooks, les dépôts de démo : demandes d'amis,
// listes partagées et demande d'adhésion à « Nova Studio » y sont déjà
// semées. Vérifie ce que voit la personne : la pastille, le contenu du
// panneau, les réponses (accepter, refuser), l'état « tout est à jour » et ce
// que seul un administrateur d'entreprise voit.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { screen, within, waitFor, fireEvent } from '@testing-library/react';
import { FRIEND_REQUESTS_STORAGE_KEY, SHARED_LISTS_STORAGE_KEY } from '@/modules/friends/constants';
import { ORG_JOIN_REQUESTS_STORAGE_KEY } from '@/modules/organizations/constants';
import {
  renderApp, setViewport, resetOrgWorld, warmDemoCaches, lazyT, session, fakeAuth, demoteDemoUserToMember,
} from '@/test/org-ui-harness';

vi.mock('@/modules/auth/AuthContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/auth/AuthContext')>()),
  useAuth: () => ({
    ...fakeAuth(),
    user: { id: session.userId, name: session.userId === 'demo-user' ? 'Demo' : session.userId, email: `${session.userId}@cosmo.app` },
  }),
}));

import InboxMenu from './InboxMenu';

const tasks = lazyT('tasks');
const ov = lazyT('overlays');

beforeAll(async () => {
  await warmDemoCaches();
});

beforeEach(() => {
  resetOrgWorld();
  setViewport('desktop');
});

/** Le bouton de la boîte : son nom accessible porte le compte quand il y a de l'attente. */
const trigger = () => screen.findByRole('button', { name: /^Boîte de réception/ });

async function openInbox() {
  renderApp(<InboxMenu />, { route: '/dashboard' });
  const button = await trigger();
  fireEvent.click(button);
  return screen.findByRole('dialog', { name: tasks.t('inbox.label') });
}

describe('InboxMenu, pastille et ouverture', () => {
  it('annonce dans son nom le nombre d’éléments en attente', async () => {
    renderApp(<InboxMenu />, { route: '/dashboard' });

    // Démo : demandes d'amis, listes et tâches partagées, demande d'adhésion (admin). Le compte
    // exact dépend des seeds : on exige la FORME « Boîte de réception, N en attente », N >= 4.
    const button = await screen.findByRole('button', { name: /^Boîte de réception, \d+ en attente$/ });
    expect(Number(button.getAttribute('aria-label')!.match(/(\d+) en attente$/)![1])).toBeGreaterThanOrEqual(4);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('ouvre le panneau au clic et le referme avec Échap', async () => {
    const dialog = await openInbox();
    expect(dialog).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Boîte de réception/ }).getAttribute('aria-expanded')).toBe('true');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog', { name: tasks.t('inbox.label') })).toBeNull());
  });

  it('se referme au clic en dehors du panneau', async () => {
    await openInbox();

    fireEvent.mouseDown(document.body);

    await waitFor(() => expect(screen.queryByRole('dialog', { name: tasks.t('inbox.label') })).toBeNull());
  });
});

describe('InboxMenu, contenu du panneau', () => {
  it('liste les demandes d’amis, les listes partagées et, pour un administrateur, les demandes d’adhésion', async () => {
    const dialog = await openInbox();

    expect(await within(dialog).findByText(ov.t('inbox.friendRequests', { count: 2 }))).toBeTruthy();
    expect(within(dialog).getByText('Lucas Moreau')).toBeTruthy();
    expect(within(dialog).getByText('Camille Richard')).toBeTruthy();
    expect(within(dialog).getByText(tasks.t('inbox.sharedLists', { count: 1 }))).toBeTruthy();
    expect(within(dialog).getByText('Courses du week-end')).toBeTruthy();
    expect(await within(dialog).findByText(ov.t('inbox.joinRequests', { count: 1 }))).toBeTruthy();
    expect(within(dialog).getByText('Hugo Lefèvre')).toBeTruthy();
  });

  it('ne montre pas les demandes d’adhésion à un membre qui n’administre pas l’entreprise', async () => {
    await demoteDemoUserToMember();
    const dialog = await openInbox();

    await within(dialog).findByText(ov.t('inbox.friendRequests', { count: 2 }));
    expect(within(dialog).queryByText('Hugo Lefèvre')).toBeNull();
    expect(within(dialog).queryByText(ov.t('inbox.joinRequests', { count: 1 }))).toBeNull();
  });
});

describe('InboxMenu, réponses', () => {
  it('accepte une demande d’ami : elle sort de la boîte', async () => {
    const dialog = await openInbox();
    await within(dialog).findByText('Lucas Moreau');

    fireEvent.click(within(dialog).getByRole('button', { name: tasks.t('inbox.acceptNamed', { name: 'Lucas Moreau' }) }));

    await waitFor(() => expect(within(dialog).queryByText('Lucas Moreau')).toBeNull());
    expect(within(dialog).getByText('Camille Richard')).toBeTruthy();
    expect(within(dialog).getByText(ov.t('inbox.friendRequests', { count: 1 }))).toBeTruthy();
  });

  it('refuse une demande d’ami : elle sort de la boîte', async () => {
    const dialog = await openInbox();
    await within(dialog).findByText('Camille Richard');

    fireEvent.click(within(dialog).getByRole('button', { name: tasks.t('inbox.refuseNamed', { name: 'Camille Richard' }) }));

    await waitFor(() => expect(within(dialog).queryByText('Camille Richard')).toBeNull());
    expect(within(dialog).getByText('Lucas Moreau')).toBeTruthy();
  });

  it('refuse une liste partagée : elle sort de la boîte', async () => {
    const dialog = await openInbox();
    await within(dialog).findByText('Courses du week-end');

    fireEvent.click(within(dialog).getByRole('button', { name: tasks.t('inbox.refuseList', { name: 'Courses du week-end' }) }));

    await waitFor(() => expect(within(dialog).queryByText('Courses du week-end')).toBeNull());
  });

  it('répond à une demande d’adhésion : elle sort de la boîte de l’administrateur', async () => {
    const dialog = await openInbox();
    await within(dialog).findByText('Hugo Lefèvre');

    fireEvent.click(within(dialog).getByRole('button', { name: ov.t('inbox.refuseJoin', { name: 'Hugo Lefèvre' }) }));

    await waitFor(() => expect(within(dialog).queryByText('Hugo Lefèvre')).toBeNull());
  });
});

describe('InboxMenu, amis', () => {
  it('liste les amis dans « Gérer mes amis » et revient à la boîte', async () => {
    const dialog = await openInbox();

    fireEvent.click(within(dialog).getAllByRole('button', { name: ov.t('inbox.manageFriends') })[0]);

    expect(await within(dialog).findByText('Marie Dupont')).toBeTruthy();
    expect(within(dialog).getByText(ov.t('inbox.myFriends'))).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: ov.t('inbox.backToInbox') }));
    expect(await within(dialog).findByText(tasks.t('inbox.label'))).toBeTruthy();
  });

  it('demande confirmation avant de retirer un ami', async () => {
    const dialog = await openInbox();
    fireEvent.click(within(dialog).getAllByRole('button', { name: ov.t('inbox.manageFriends') })[0]);
    await within(dialog).findByText('Marie Dupont');

    fireEvent.click(within(dialog).getByRole('button', { name: /Marie Dupont/ }));

    expect(await screen.findByRole('alertdialog')).toBeTruthy();
    // Rien n'est retiré tant que la confirmation n'est pas donnée.
    expect(within(dialog).getByText('Marie Dupont')).toBeTruthy();
  });

  it('envoie une demande d’ami par email et referme le champ', async () => {
    const dialog = await openInbox();

    fireEvent.click(within(dialog).getAllByRole('button', { name: ov.t('inbox.addFriend') })[0]);
    const input = within(dialog).getByLabelText(ov.t('inbox.friendEmailAria'));
    const send = within(dialog).getByRole('button', { name: /Envoyer/ }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);

    fireEvent.change(input, { target: { value: 'nouvel.ami@example.com' } });
    expect(send.disabled).toBe(false);
    fireEvent.click(send);

    await waitFor(() => expect(within(dialog).queryByLabelText(ov.t('inbox.friendEmailAria'))).toBeNull());
  });
});

describe('InboxMenu, boîte vide', () => {
  it('dit « tout est à jour » quand plus rien n’attend', async () => {
    localStorage.setItem(FRIEND_REQUESTS_STORAGE_KEY, '[]');
    localStorage.setItem(ORG_JOIN_REQUESTS_STORAGE_KEY, '[]');
    localStorage.setItem(SHARED_LISTS_STORAGE_KEY, '[]');
    localStorage.setItem('cosmo_demo_tasks', '[]');
    const dialog = await openInbox();

    expect(await within(dialog).findByText(tasks.t('inbox.allClear'))).toBeTruthy();
    expect(within(dialog).queryByText(ov.t('inbox.friendRequests', { count: 2 }))).toBeNull();
  });
});
