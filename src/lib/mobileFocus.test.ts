// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
}));
vi.mock('./supabase', () => ({ supabase: { auth } }));

import { installMobileFocusRecovery } from './mobileFocus';

const session = { access_token: 'jwt', user: { id: 'u1' } };

// Un seul abonnement pour tout le fichier : `installMobileFocusRecovery` pose
// des écouteurs sur `document`, qu'on ne retire pas entre deux cas.
const qc = new QueryClient();
const refetch = vi.spyOn(qc, 'refetchQueries').mockResolvedValue(undefined);
installMobileFocusRecovery(qc);

const becomeVisible = async () => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
  await vi.waitFor(() => expect(auth.getSession).toHaveBeenCalled());
  await Promise.resolve();
};

beforeEach(() => {
  auth.getSession.mockReset();
  auth.refreshSession.mockReset();
  refetch.mockClear();
});

describe('installMobileFocusRecovery', () => {
  // Les 401 de `get_my_tasks` (journal du 2026-10-25) : la rotation forcée
  // s'ajoutait à celle qu'auth-js fait déjà au retour de visibilité.
  it('ne force JAMAIS de rotation du jeton au retour sur l onglet', async () => {
    auth.getSession.mockResolvedValue({ data: { session }, error: null });
    await becomeVisible();
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it('relance les requêtes actives quand une session est présente', async () => {
    auth.getSession.mockResolvedValue({ data: { session }, error: null });
    await becomeVisible();
    await vi.waitFor(() => expect(refetch).toHaveBeenCalledWith({ type: 'active', stale: true }));
  });

  it('ne relance RIEN sans session : la requête partirait en anonyme et rendrait 401', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await becomeVisible();
    await new Promise((r) => setTimeout(r, 0));
    expect(refetch).not.toHaveBeenCalled();
  });

  it('ne relance rien si la lecture de session échoue (hors ligne)', async () => {
    auth.getSession.mockRejectedValue(new Error('offline'));
    await becomeVisible();
    await new Promise((r) => setTimeout(r, 0));
    expect(refetch).not.toHaveBeenCalled();
  });
});
