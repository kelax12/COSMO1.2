// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// `wasOrgMember` réserve la place de l'entrée « Entreprise » dans les barres
// de navigation pendant que la requête d'organisations vole (finding F3).
//
// Il repose entièrement sur une écriture qui n'existait PAS avant : jusqu'ici,
// seul un changement manuel d'organisation persistait quoi que ce soit, donc
// l'indice manquait exactement chez les comptes qui n'ont qu'une organisation,
// c'est-à-dire presque tous. Ce test garde les trois moments qui comptent :
// l'indice se pose, il s'efface quand la vérité dit « aucune organisation »,
// et il ne traverse jamais un changement de compte.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ACTIVE_ORG_STORAGE_KEY } from './constants';

let orgs: { id: string; name: string; myRole: string }[] = [];
let loading = false;
let currentUser: { id: string } | null = { id: 'user-1' };

vi.mock('@/modules/auth/AuthContext', () => ({
  useAuth: () => ({ user: currentUser, isAuthenticated: !!currentUser }),
}));
vi.mock('./hooks', () => ({
  useMyOrganizations: () => ({ data: orgs, isLoading: loading }),
}));

const { ActiveOrgProvider, useActiveOrganization } = await import('./ActiveOrgContext');

const Probe = () => {
  const { activeOrg, isLoading, wasOrgMember } = useActiveOrganization();
  return (
    <div data-testid="probe">
      {`org=${activeOrg?.id ?? 'null'} loading=${isLoading} hint=${wasOrgMember}`}
    </div>
  );
};

const mount = () =>
  render(<ActiveOrgProvider><Probe /></ActiveOrgProvider>);

const probe = () => screen.getByTestId('probe').textContent ?? '';
const stored = () => localStorage.getItem(ACTIVE_ORG_STORAGE_KEY);

describe('ActiveOrgContext — indice « déjà membre » (F3)', () => {
  beforeEach(() => {
    localStorage.clear();
    orgs = [];
    loading = false;
    currentUser = { id: 'user-1' };
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('pose l’indice dès qu’une organisation est résolue, sans changement manuel', async () => {
    orgs = [{ id: 'org-1', name: 'Nova', myRole: 'admin' }];
    mount();
    await waitFor(() => expect(stored()).not.toBeNull());
    expect(JSON.parse(stored()!)).toEqual({ userId: 'user-1', orgId: 'org-1' });
  });

  it('au montage suivant, l’indice est vrai AVANT que la requête réponde', async () => {
    localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, JSON.stringify({ userId: 'user-1', orgId: 'org-1' }));
    loading = true;
    orgs = [];
    mount();
    // C'est tout l'objet du finding : à cet instant précis, `activeOrg` est nul
    // et la barre de navigation doit malgré tout réserver la place.
    expect(probe()).toContain('org=null');
    expect(probe()).toContain('loading=true');
    expect(probe()).toContain('hint=true');
  });

  it('efface l’indice quand la requête a répondu « aucune organisation »', async () => {
    localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, JSON.stringify({ userId: 'user-1', orgId: 'org-1' }));
    loading = false;
    orgs = [];
    mount();
    // Sans cet effacement, un ancien membre verrait l'entreprise clignoter
    // dans sa nav à chaque chargement, pour toujours.
    await waitFor(() => expect(stored()).toBeNull());
  });

  it('ne garde PAS l’indice pendant le chargement : on n’efface pas ce qu’on ne sait pas encore', async () => {
    localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, JSON.stringify({ userId: 'user-1', orgId: 'org-1' }));
    loading = true;
    orgs = [];
    mount();
    await waitFor(() => expect(probe()).toContain('hint=true'));
    expect(stored()).not.toBeNull();
  });

  it('l’indice d’un AUTRE compte ne vaut pas pour celui-ci (appareil partagé)', () => {
    localStorage.setItem(ACTIVE_ORG_STORAGE_KEY, JSON.stringify({ userId: 'quelqu-un-dautre', orgId: 'org-9' }));
    loading = true;
    orgs = [];
    mount();
    expect(probe()).toContain('hint=false');
  });
});
