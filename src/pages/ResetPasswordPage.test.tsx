// @vitest-environment jsdom
// Page de choix du nouveau mot de passe : session de recuperation, validations
// locales, echec serveur, revocation des autres sessions (R-17), navigation.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderApp, lazyT, fakeAuth, fakeBilling } from '@/test/tasks-ui-harness';

const h = vi.hoisted(() => ({
  getSession: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: h.getSession, updateUser: h.updateUser, signOut: h.signOut } },
}));
vi.mock('@/lib/useSeoMeta', () => ({ useSeoMeta: () => undefined }));
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-router')>()),
  useNavigate: () => h.navigate,
}));

vi.mock('@/modules/auth/AuthContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/auth/AuthContext')>()),
  useAuth: () => fakeAuth(),
}));
vi.mock('@/modules/billing/billing.context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/billing/billing.context')>()),
  useBilling: () => fakeBilling(),
}));
import { MIN_PASSWORD_LENGTH } from '@/lib/password-policy';
import ResetPasswordPage from './ResetPasswordPage';

const c = lazyT('common');
const GOOD = 'un-mot-de-passe-solide-42';

function fill(password: string, confirm: string) {
  fireEvent.change(document.getElementById('reset-password') as HTMLInputElement, { target: { value: password } });
  fireEvent.change(document.getElementById('reset-confirm') as HTMLInputElement, { target: { value: confirm } });
}
const submit = () => fireEvent.click(screen.getByRole('button', { name: c.t('auth.savePassword') }));

beforeEach(() => {
  vi.clearAllMocks();
  h.getSession.mockResolvedValue({ data: { session: { user: {} } } });
  h.updateUser.mockResolvedValue({ error: null });
  h.signOut.mockResolvedValue({ error: null });
});
afterEach(() => vi.useRealTimers());

describe('ResetPasswordPage', () => {
  it('affiche le formulaire, sans alerte quand la session de recuperation existe', async () => {
    renderApp(<ResetPasswordPage />, { route: '/reset-password' });
    expect(await screen.findByRole('heading', { name: c.t('auth.resetTitle') })).toBeTruthy();
    await waitFor(() => expect(h.getSession).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
    expect((screen.getByRole('button', { name: c.t('auth.savePassword') }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('sans session apres le delai de tolerance : lien invalide, envoi bloque, lien pour redemander', async () => {
    h.getSession.mockResolvedValue({ data: { session: null } });
    renderApp(<ResetPasswordPage />, { route: '/reset-password' });
    const alert = await screen.findByRole('alert', {}, { timeout: 4000 });
    expect(alert.textContent).toContain(c.t('auth.resetLinkInvalid'));
    expect(screen.getByRole('link', { name: c.t('auth.requestAgain') }).getAttribute('href')).toBe('/forgot-password');
    expect((screen.getByRole('button', { name: c.t('auth.savePassword') }) as HTMLButtonElement).disabled).toBe(true);
    expect(h.getSession).toHaveBeenCalledTimes(2);
  });

  it('refuse un mot de passe trop court sans appeler le serveur', async () => {
    renderApp(<ResetPasswordPage />, { route: '/reset-password' });
    await screen.findByRole('heading', { name: c.t('auth.resetTitle') });
    fill('abc', 'abc');
    submit();
    expect((await screen.findByRole('alert')).textContent).toContain(c.t('auth.passwordTooShort', { count: MIN_PASSWORD_LENGTH }));
    expect(h.updateUser).not.toHaveBeenCalled();
  });

  it('refuse deux saisies differentes', async () => {
    renderApp(<ResetPasswordPage />, { route: '/reset-password' });
    await screen.findByRole('heading', { name: c.t('auth.resetTitle') });
    fill(GOOD, GOOD + 'x');
    submit();
    expect((await screen.findByRole('alert')).textContent).toContain(c.t('auth.passwordMismatch'));
    expect(h.updateUser).not.toHaveBeenCalled();
  });

  it('echec serveur : message, pas de navigation', async () => {
    h.updateUser.mockResolvedValue({ error: new Error('nope') });
    renderApp(<ResetPasswordPage />, { route: '/reset-password' });
    await screen.findByRole('heading', { name: c.t('auth.resetTitle') });
    fill(GOOD, GOOD);
    submit();
    expect((await screen.findByRole('alert')).textContent).toContain(c.t('auth.resetFailed'));
    expect(h.navigate).not.toHaveBeenCalled();
    expect(h.signOut).not.toHaveBeenCalled();
  });

  it('exception reseau : message generique', async () => {
    h.updateUser.mockRejectedValue(new Error('offline'));
    renderApp(<ResetPasswordPage />, { route: '/reset-password' });
    await screen.findByRole('heading', { name: c.t('auth.resetTitle') });
    fill(GOOD, GOOD);
    submit();
    expect((await screen.findByRole('alert')).textContent).toContain(c.t('auth.genericError'));
  });

  it('succes : revoque les AUTRES sessions puis va au tableau de bord', async () => {
    renderApp(<ResetPasswordPage />, { route: '/reset-password' });
    await screen.findByRole('heading', { name: c.t('auth.resetTitle') });
    fill(GOOD, GOOD);
    submit();
    await waitFor(() => expect(h.navigate).toHaveBeenCalledWith('/dashboard'));
    expect(h.updateUser).toHaveBeenCalledWith({ password: GOOD });
    expect(h.signOut).toHaveBeenCalledWith({ scope: 'others' });
  });

  it('le bouton oeil bascule la visibilite des deux champs', async () => {
    renderApp(<ResetPasswordPage />, { route: '/reset-password' });
    await screen.findByRole('heading', { name: c.t('auth.resetTitle') });
    const pwd = document.getElementById('reset-password') as HTMLInputElement;
    const conf = document.getElementById('reset-confirm') as HTMLInputElement;
    expect([pwd.type, conf.type]).toEqual(['password', 'password']);
    fireEvent.click(screen.getByRole('button', { name: c.t('auth.showPassword') }));
    expect([pwd.type, conf.type]).toEqual(['text', 'text']);
    expect(screen.getByRole('button', { name: c.t('auth.hidePassword') })).toBeTruthy();
  });
});
