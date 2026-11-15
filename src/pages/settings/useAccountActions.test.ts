// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const h = vi.hoisted(() => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
  auth: { updateUser: vi.fn(), signInWithPassword: vi.fn(), signOut: vi.fn() },
  invoke: vi.fn(),
}));

vi.mock('@/lib/toast', () => ({ toast: h.toast }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth: h.auth, functions: { invoke: h.invoke } } }));

import { useAccountActions } from './useAccountActions';
import { MIN_PASSWORD_LENGTH } from '@/lib/password-policy';

const t = ((k: string) => k) as never;
const user = { id: 'u1', name: 'Ada', email: 'ada@example.com' };
const GOOD = 'x'.repeat(MIN_PASSWORD_LENGTH + 4);

function setup(over: Partial<Parameters<typeof useAccountActions>[0]> = {}) {
  const deps = {
    user,
    isDemo: false,
    isThirdParty: false,
    logout: vi.fn(),
    navigate: vi.fn(),
    updateDemoProfile: vi.fn(),
    removeAvatarEverywhere: vi.fn().mockResolvedValue(true),
    t,
    ...over,
  } as Parameters<typeof useAccountActions>[0];
  const { result } = renderHook(() => useAccountActions(deps));
  return { result, deps };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  h.auth.updateUser.mockResolvedValue({ error: null });
  h.auth.signInWithPassword.mockResolvedValue({ error: null });
  h.auth.signOut.mockResolvedValue({ error: null });
  h.invoke.mockResolvedValue({ error: null });
});

describe('saveProfile', () => {
  it('sans utilisateur : ne fait rien', async () => {
    const { result } = setup({ user: null });
    await act(() => result.current.saveProfile({ name: 'a', email: 'a@b.co' }));
    expect(h.toast.error).not.toHaveBeenCalled();
  });

  it('refuse un nom vide, un email vide, un email invalide', async () => {
    const { result } = setup();
    await act(() => result.current.saveProfile({ name: '  ', email: 'a@b.co' }));
    expect(h.toast.error).toHaveBeenLastCalledWith('profile.nameEmpty');
    await act(() => result.current.saveProfile({ name: 'Ada', email: '' }));
    expect(h.toast.error).toHaveBeenLastCalledWith('profile.emailEmpty');
    await act(() => result.current.saveProfile({ name: 'Ada', email: 'pas-un-email' }));
    expect(h.toast.error).toHaveBeenLastCalledWith('profile.invalidEmail');
    expect(h.auth.updateUser).not.toHaveBeenCalled();
  });

  it('demo : ecrit par updateDemoProfile, jamais par le backend', async () => {
    const { result, deps } = setup({ isDemo: true });
    await act(() => result.current.saveProfile({ name: 'Ada L', email: 'ada@example.com' }));
    expect(deps.updateDemoProfile).toHaveBeenCalledWith({ name: 'Ada L', email: 'ada@example.com' });
    expect(h.toast.success).toHaveBeenCalledWith('profile.updatedDemo');
    expect(h.auth.updateUser).not.toHaveBeenCalled();
  });

  it('nom seul : pas de changement d\'email envoye', async () => {
    const { result } = setup();
    await act(() => result.current.saveProfile({ name: 'Ada L', email: 'ada@example.com' }));
    expect(h.auth.updateUser).toHaveBeenCalledWith({ data: { name: 'Ada L' } });
    expect(h.toast.success).toHaveBeenCalledWith('profile.updated');
  });

  it('changement d\'email : envoye, message « verifiez votre boite »', async () => {
    const { result } = setup();
    await act(() => result.current.saveProfile({ name: 'Ada', email: 'new@example.com' }));
    expect(h.auth.updateUser).toHaveBeenCalledWith({ data: { name: 'Ada' }, email: 'new@example.com' });
    expect(h.toast.success).toHaveBeenCalledWith('profile.updatedCheckMail');
  });

  it('compte tiers : l\'email n\'est jamais envoye', async () => {
    const { result } = setup({ isThirdParty: true });
    await act(() => result.current.saveProfile({ name: 'Ada', email: 'new@example.com' }));
    expect(h.auth.updateUser).toHaveBeenCalledWith({ data: { name: 'Ada' } });
  });

  it.each([
    [{ code: 'email_exists' }, 'profile.emailTaken'],
    [{ status: 422 }, 'profile.emailTaken'],
    [{ code: 'email_address_invalid' }, 'profile.invalidEmail'],
    [{ code: 'over_email_send_rate_limit' }, 'profile.tooManyAttempts'],
    [{ status: 429 }, 'profile.tooManyAttempts'],
    [{}, 'profile.updateFailed'],
  ])('erreur serveur %j : message sur, jamais le texte brut', async (err, message) => {
    h.auth.updateUser.mockResolvedValue({ error: { message: 'RAW', ...err } });
    const { result } = setup();
    await act(() => result.current.saveProfile({ name: 'Ada', email: 'ada@example.com' }));
    expect(h.toast.error).toHaveBeenCalledWith(message);
    expect(result.current.savingProfile).toBe(false);
  });

  it('exception : message inattendu', async () => {
    h.auth.updateUser.mockRejectedValue(new Error('boom'));
    const { result } = setup();
    await act(() => result.current.saveProfile({ name: 'Ada', email: 'ada@example.com' }));
    expect(h.toast.error).toHaveBeenCalledWith('security.unexpectedError');
  });
});

describe('updatePassword', () => {
  const pw = (over: Partial<{ current: string; new: string; confirm: string }> = {}) => ({
    current: 'ancien-mot-de-passe', new: GOOD, confirm: GOOD, ...over,
  });

  it.each([
    [{ current: '' }, 'security.fillAllFields'],
    [{ confirm: GOOD + 'z' }, 'security.passwordsDiffer'],
    [{ new: 'abc', confirm: 'abc' }, 'security.tooShort'],
    [{ current: GOOD }, 'security.mustDiffer'],
  ])('validation locale %j', async (over, message) => {
    const { result } = setup();
    let ok = true;
    await act(async () => { ok = await result.current.updatePassword(pw(over)); });
    expect(ok).toBe(false);
    expect(h.toast.error).toHaveBeenCalledWith(message);
    expect(h.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('demo : refuse sans toucher au backend', async () => {
    const { result } = setup({ isDemo: true });
    await act(() => result.current.updatePassword(pw()));
    expect(h.toast.info).toHaveBeenCalledWith('security.demoDisabled');
    expect(h.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('verifie l\'ancien mot de passe (B8) et refuse s\'il est faux', async () => {
    h.auth.signInWithPassword.mockResolvedValue({ error: new Error('bad') });
    const { result } = setup();
    let ok = true;
    await act(async () => { ok = await result.current.updatePassword(pw()); });
    expect(ok).toBe(false);
    expect(h.auth.signInWithPassword).toHaveBeenCalledWith({ email: user.email, password: 'ancien-mot-de-passe' });
    expect(h.auth.updateUser).not.toHaveBeenCalled();
    expect(h.toast.error).toHaveBeenCalledWith('security.wrongCurrentPassword');
  });

  it('echec de mise a jour : message, aucune revocation', async () => {
    h.auth.updateUser.mockResolvedValue({ error: new Error('x') });
    const { result } = setup();
    let ok = true;
    await act(async () => { ok = await result.current.updatePassword(pw()); });
    expect(ok).toBe(false);
    expect(h.toast.error).toHaveBeenCalledWith('security.updateError');
    expect(h.auth.signOut).not.toHaveBeenCalled();
  });

  it('succes : change puis revoque les autres sessions (R-17)', async () => {
    const { result } = setup();
    let ok = false;
    await act(async () => { ok = await result.current.updatePassword(pw()); });
    expect(ok).toBe(true);
    expect(h.auth.updateUser).toHaveBeenCalledWith({ password: GOOD });
    expect(h.auth.signOut).toHaveBeenCalledWith({ scope: 'others' });
    expect(h.toast.success).toHaveBeenCalledWith('security.updated');
    expect(result.current.savingPassword).toBe(false);
  });

  it('exception : message inattendu', async () => {
    h.auth.signInWithPassword.mockRejectedValue(new Error('net'));
    const { result } = setup();
    await act(() => result.current.updatePassword(pw()));
    expect(h.toast.error).toHaveBeenCalledWith('security.unexpectedError');
  });
});

describe('boites de confirmation', () => {
  it('deleteAccount (demo) : vide, deconnecte, retourne a l\'accueil', async () => {
    const { result, deps } = setup({ isDemo: true });
    act(() => result.current.deleteAccount());
    expect(result.current.confirmConfig).toMatchObject({ isOpen: true, variant: 'destructive', showInput: true, confirmationText: 'DELETE' });
    await act(async () => { await result.current.confirmConfig.onConfirm(); });
    expect(deps.logout).toHaveBeenCalled();
    expect(deps.navigate).toHaveBeenCalledWith('/');
    expect(h.invoke).not.toHaveBeenCalled();
  });

  it('deleteAccount (prod) : appelle l\'Edge Function puis deconnecte', async () => {
    const { result, deps } = setup();
    act(() => result.current.deleteAccount());
    await act(async () => { await result.current.confirmConfig.onConfirm(); });
    expect(h.invoke).toHaveBeenCalledWith('delete-account');
    expect(h.toast.success).toHaveBeenCalledWith('security.accountDeleted');
    expect(deps.navigate).toHaveBeenCalledWith('/');
    expect(result.current.deletingAccount).toBe(false);
  });

  it('deleteAccount : echec serveur ou reseau, on ne deconnecte pas', async () => {
    const { result, deps } = setup();
    h.invoke.mockResolvedValueOnce({ error: new Error('x') });
    act(() => result.current.deleteAccount());
    await act(async () => { await result.current.confirmConfig.onConfirm(); });
    expect(h.toast.error).toHaveBeenCalledWith('security.deleteFailed', { description: 'security.deleteFailedHint' });
    h.invoke.mockRejectedValueOnce(new Error('net'));
    act(() => result.current.deleteAccount());
    await act(async () => { await result.current.confirmConfig.onConfirm(); });
    expect(h.toast.error).toHaveBeenCalledWith('security.networkError', { description: 'security.networkErrorHint' });
    expect(deps.logout).not.toHaveBeenCalled();
  });

  it('removeAvatar : toast seulement si le retrait a abouti', async () => {
    const { result, deps } = setup();
    act(() => result.current.removeAvatar());
    await act(async () => { await result.current.confirmConfig.onConfirm(); });
    expect(h.toast.success).toHaveBeenCalledWith('profile.photoDeleted');
    h.toast.success.mockClear();
    (deps.removeAvatarEverywhere as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    act(() => result.current.removeAvatar());
    await act(async () => { await result.current.confirmConfig.onConfirm(); });
    expect(h.toast.success).not.toHaveBeenCalled();
  });

  it('confirmLogout puis closeConfirm', () => {
    const { result, deps } = setup();
    act(() => result.current.confirmLogout());
    expect(result.current.confirmConfig.isOpen).toBe(true);
    act(() => result.current.confirmConfig.onConfirm());
    expect(deps.logout).toHaveBeenCalled();
    expect(deps.navigate).toHaveBeenCalledWith('/');
    act(() => result.current.closeConfirm());
    expect(result.current.confirmConfig.isOpen).toBe(false);
  });

  it('confirmInput se pilote et se remet a zero a l\'ouverture de la suppression', () => {
    const { result } = setup();
    act(() => result.current.setConfirmInput('DEL'));
    expect(result.current.confirmInput).toBe('DEL');
    act(() => result.current.deleteAccount());
    expect(result.current.confirmInput).toBe('');
  });
});
