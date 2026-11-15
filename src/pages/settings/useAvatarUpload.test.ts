// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const h = vi.hoisted(() => ({
  toast: { error: vi.fn(), success: vi.fn() },
  updateUser: vi.fn(),
  getCurrentUser: vi.fn(),
  mirror: vi.fn(),
  removeAvatar: vi.fn(),
  validate: vi.fn(),
}));

vi.mock('@/lib/toast', () => ({ toast: h.toast }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { updateUser: h.updateUser } } }));
vi.mock('@/lib/auth-user', () => ({ getCurrentUser: h.getCurrentUser }));
vi.mock('@/modules/user/profile.repository', () => ({ mirrorAvatarToProfile: h.mirror }));
vi.mock('@/lib/avatar-upload', () => ({
  validateAvatarFile: h.validate,
  computeAvatarDimensions: vi.fn(),
  canvasToAvatarBlob: vi.fn(),
  uploadAvatar: vi.fn(),
  removeAvatar: h.removeAvatar,
}));

import { useAvatarActions } from './useAvatarUpload';

const t = ((k: string) => k) as never;
const setup = (isDemo: boolean) => {
  const updateDemoProfile = vi.fn();
  const { result } = renderHook(() => useAvatarActions({ isDemo, updateDemoProfile, t }));
  return { result, updateDemoProfile };
};
const changeEvent = (file?: File) =>
  ({ target: { files: file ? [file] : [], value: 'x' } }) as unknown as React.ChangeEvent<HTMLInputElement>;

beforeEach(() => vi.clearAllMocks());

describe('useAvatarActions', () => {
  describe('removeAvatarEverywhere', () => {
    it("demo : vide l'avatar local sans toucher au backend", async () => {
      const { result, updateDemoProfile } = setup(true);
      await expect(result.current.removeAvatarEverywhere()).resolves.toBe(true);
      expect(updateDemoProfile).toHaveBeenCalledWith({ avatar: undefined });
      expect(h.updateUser).not.toHaveBeenCalled();
    });

    it('prod : retire la reference, le miroir ET le fichier (R-03)', async () => {
      h.updateUser.mockResolvedValue({ error: null });
      h.getCurrentUser.mockResolvedValue({ id: 'u1' });
      const { result } = setup(false);
      await expect(result.current.removeAvatarEverywhere()).resolves.toBe(true);
      expect(h.updateUser).toHaveBeenCalledWith({ data: { avatar_url: null } });
      expect(h.mirror).toHaveBeenCalledWith('u1', null);
      expect(h.removeAvatar).toHaveBeenCalledWith(expect.anything(), 'u1');
    });

    it("prod : une erreur d'auth affiche un toast et n'efface pas le fichier", async () => {
      h.updateUser.mockResolvedValue({ error: new Error('boom') });
      const { result } = setup(false);
      await expect(result.current.removeAvatarEverywhere()).resolves.toBe(false);
      expect(h.toast.error).toHaveBeenCalledWith('profile.photoDeleteFailed');
      expect(h.removeAvatar).not.toHaveBeenCalled();
    });

    it("prod : sans utilisateur courant, aucun fichier n'est supprime", async () => {
      h.updateUser.mockResolvedValue({ error: null });
      h.getCurrentUser.mockResolvedValue(null);
      const { result } = setup(false);
      await expect(result.current.removeAvatarEverywhere()).resolves.toBe(true);
      expect(h.removeAvatar).not.toHaveBeenCalled();
    });
  });

  describe('handleAvatarUpload', () => {
    it('ignore un evenement sans fichier', () => {
      const { result } = setup(true);
      act(() => result.current.handleAvatarUpload(changeEvent()));
      expect(h.validate).not.toHaveBeenCalled();
    });

    it('refuse un mauvais format et vide le champ', () => {
      h.validate.mockReturnValue({ ok: false, reason: 'type' });
      const { result } = setup(true);
      const e = changeEvent(new File(['x'], 'a.gif'));
      act(() => result.current.handleAvatarUpload(e));
      expect(h.toast.error).toHaveBeenCalledWith('profile.unsupportedFormat', { description: 'profile.unsupportedFormatHint' });
      expect(e.target.value).toBe('');
    });

    it('refuse un fichier trop lourd', () => {
      h.validate.mockReturnValue({ ok: false, reason: 'size' });
      const { result } = setup(true);
      act(() => result.current.handleAvatarUpload(changeEvent(new File(['x'], 'a.png'))));
      expect(h.toast.error).toHaveBeenCalledWith('profile.tooLarge', { description: 'profile.tooLargeHint' });
    });

    it("refuse un contenu qui n'est pas une data URL image", async () => {
      h.validate.mockReturnValue({ ok: true });
      const { result } = setup(true);
      act(() => result.current.handleAvatarUpload(changeEvent(new File(['plain'], 'a.png'))));
      await vi.waitFor(() => expect(h.toast.error).toHaveBeenCalledWith('profile.invalidFile'));
    });
  });
});
