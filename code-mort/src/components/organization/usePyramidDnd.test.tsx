// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { OrgMember } from '@/modules/organizations';
import { UNPLACED_DROP_ID } from './pyramid.helpers';
import { usePyramidDnd } from './usePyramidDnd';

const mutate = vi.fn();
const mutateAsync = vi.fn();
const toastSuccess = vi.fn();
const showUndoToast = vi.fn();
let mobile = false;

vi.mock('@/lib/toast', () => ({ toast: { success: (m: string) => toastSuccess(m), error: vi.fn() } }));
vi.mock('@/lib/undo-toast', () => ({ showUndoToast: (...a: unknown[]) => showUndoToast(...a) }));
vi.mock('@/lib/hooks/use-mobile', () => ({ useIsMobile: () => mobile }));
vi.mock('@/i18n/useT', () => ({ useT: () => ({ t: (k: string) => k }) }));
vi.mock('@/modules/organizations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/organizations')>()),
  useSetMemberManager: () => ({ mutate, mutateAsync }),
}));

const member = (userId: string, managerId: string | null, displayName = userId): OrgMember =>
  ({ userId, managerId, displayName }) as unknown as OrgMember;

// boss -> mgr -> (ann, bob) ; solo n'a pas de manager
const members = [
  member('boss', null),
  member('mgr', 'boss'),
  member('ann', 'mgr'),
  member('bob', 'mgr'),
  member('solo', null),
];

const setup = (over: { isAdmin?: boolean; currentUserId?: string } = {}) =>
  renderHook(() =>
    usePyramidDnd({ orgId: 'o1', members, currentUserId: over.currentUserId ?? 'boss', isAdmin: over.isAdmin ?? true }),
  );

/** Simule un `mutate` serveur qui réussit aussitôt. */
const succeed = () =>
  mutate.mockImplementation((_vars: unknown, opts?: { onSuccess?: () => void; onSettled?: () => void }) => {
    opts?.onSuccess?.();
    opts?.onSettled?.();
  });

describe('usePyramidDnd', () => {
  beforeEach(() => {
    mutate.mockReset();
    mutateAsync.mockReset();
    toastSuccess.mockClear();
    showUndoToast.mockClear();
    mobile = false;
    document.elementFromPoint = () => null;
  });

  it("canEdit : un admin ou un manager peut éditer, un membre sans équipe non", () => {
    expect(setup({ isAdmin: true }).result.current.canEdit).toBe(true);
    expect(setup({ isAdmin: false, currentUserId: 'mgr' }).result.current.canEdit).toBe(true);
    expect(setup({ isAdmin: false, currentUserId: 'ann' }).result.current.canEdit).toBe(false);
  });

  it('saisir un membre expose les destinations valides (ni lui, ni son sous-arbre, ni son manager)', () => {
    const { result } = setup();
    act(() => result.current.grabMember(members[1], { clientX: 5, clientY: 5 }));
    expect(result.current.dragging?.userId).toBe('mgr');
    const valid = [...(result.current.drag?.validDropIds ?? [])].sort();
    expect(valid).toEqual(['solo']);
    expect(result.current.ghost).toEqual({ x: 5, y: 5 });
    expect(result.current.drag?.pointerActive).toBe(true);
  });

  it('un non-admin ne peut déposer que dans son propre sous-arbre', () => {
    const { result } = setup({ isAdmin: false, currentUserId: 'mgr' });
    act(() => result.current.grabMember(members[2], { clientX: 0, clientY: 0 }));
    expect([...(result.current.drag?.validDropIds ?? [])].sort()).toEqual(['bob']);
  });

  it('Échap annule la saisie en cours', () => {
    const { result } = setup();
    act(() => result.current.grabMember(members[4], { clientX: 0, clientY: 0 }));
    expect(result.current.dragging).not.toBeNull();
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    expect(result.current.dragging).toBeNull();
  });

  it('déposer sans changer de rôle appelle la mutation, annonce, et propose « annuler » hors édition', () => {
    succeed();
    const { result } = setup();
    act(() => result.current.grabMember(members[3], { clientX: 0, clientY: 0 }));
    act(() => result.current.drop('boss'));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toEqual({ orgId: 'o1', userId: 'bob', managerId: 'boss', silent: true });
    expect(result.current.dragging).toBeNull();
    expect(result.current.flashId).toBe('bob');
    expect(result.current.announcement).toBe('pyramid.nowUnder');
    expect(showUndoToast).toHaveBeenCalledTimes(1);
    // « Annuler » du toast : remet l'ancien manager.
    act(() => (showUndoToast.mock.calls[0][1] as () => void)());
    expect(mutate).toHaveBeenLastCalledWith({ orgId: 'o1', userId: 'bob', managerId: 'mgr' });
  });

  it('déposer sur la zone « non placé » détache le membre', () => {
    succeed();
    const { result } = setup();
    act(() => result.current.grabMember(members[3], { clientX: 0, clientY: 0 }));
    act(() => result.current.drop(UNPLACED_DROP_ID));
    expect(mutate.mock.calls[0][0]).toMatchObject({ userId: 'bob', managerId: null });
    expect(result.current.announcement).toBe('pyramid.detached');
  });

  it("déplacer le dernier subordonné d'un manager demande confirmation, puis applique", () => {
    succeed();
    const { result } = setup();
    // mgr n'a que ann et bob : en retirer un seul ne change rien ; deplacer 'solo' sous 'ann' fait de ann un manager.
    act(() => result.current.grabMember(members[4], { clientX: 0, clientY: 0 }));
    act(() => result.current.drop('ann'));
    expect(mutate).not.toHaveBeenCalled();
    expect(result.current.pendingConfirm).toMatchObject({ kind: 'position', dropId: 'ann' });
    act(() => result.current.confirmPending());
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toMatchObject({ userId: 'solo', managerId: 'ann' });
    expect(result.current.pendingConfirm).toBeNull();
  });

  it('refuser la confirmation abandonne la saisie sans rien écrire', () => {
    const { result } = setup();
    act(() => result.current.grabMember(members[4], { clientX: 0, clientY: 0 }));
    act(() => result.current.drop('ann'));
    act(() => result.current.dismissPending());
    expect(mutate).not.toHaveBeenCalled();
    expect(result.current.dragging).toBeNull();
    expect(result.current.pendingConfirm).toBeNull();
  });

  it("mode édition : les déplacements sont comptés, « terminer » confirme par un toast", () => {
    succeed();
    const { result } = setup();
    act(() => result.current.startEdit());
    expect(result.current.editMode).toBe(true);
    act(() => result.current.grabMember(members[3], { clientX: 0, clientY: 0 }));
    act(() => result.current.drop('boss'));
    expect(result.current.moveCount).toBe(1);
    expect(showUndoToast).not.toHaveBeenCalled();
    act(() => result.current.finishEdit());
    expect(toastSuccess).toHaveBeenCalledWith('pyramid.reorgSaved');
    expect(result.current.editMode).toBe(false);
    expect(result.current.moveCount).toBe(0);
  });

  it('annuler l\'édition sans déplacement quitte directement ; avec déplacements, demande puis rejoue à l\'envers', async () => {
    succeed();
    mutateAsync.mockResolvedValue(undefined);
    const { result } = setup();
    act(() => result.current.startEdit());
    act(() => result.current.cancelEdit());
    expect(result.current.editMode).toBe(false);

    act(() => result.current.startEdit());
    act(() => result.current.grabMember(members[3], { clientX: 0, clientY: 0 }));
    act(() => result.current.drop('boss'));
    act(() => result.current.cancelEdit());
    expect(result.current.pendingConfirm).toEqual({ kind: 'undo', count: 1 });
    await act(async () => { result.current.confirmPending(); });
    expect(mutateAsync).toHaveBeenCalledWith({ orgId: 'o1', userId: 'bob', managerId: 'mgr', silent: true });
    expect(toastSuccess).toHaveBeenCalledWith('pyramid.undone');
    expect(result.current.editMode).toBe(false);
  });

  it("un échec pendant l'annulation arrête la restauration sans planter", async () => {
    succeed();
    mutateAsync.mockRejectedValue(new Error('refus'));
    const { result } = setup();
    act(() => result.current.startEdit());
    act(() => result.current.grabMember(members[3], { clientX: 0, clientY: 0 }));
    act(() => result.current.drop('boss'));
    act(() => result.current.cancelEdit());
    await act(async () => { result.current.confirmPending(); });
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(result.current.editMode).toBe(false);
  });

  it('un second dépôt pendant que le premier est en vol est ignoré (garde anti double-écriture)', () => {
    mutate.mockImplementation(() => {});
    const { result } = setup();
    act(() => result.current.grabMember(members[3], { clientX: 0, clientY: 0 }));
    act(() => result.current.drop('boss'));
    act(() => result.current.drop('boss'));
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('le glissement du fond fait défiler le conteneur, sauf sur mobile ou sur une carte', () => {
    const { result } = setup();
    const container = document.createElement('div');
    result.current.scrollContainerRef.current = container;
    window.scrollTo = vi.fn();
    const down = (target: HTMLElement) =>
      ({ target, clientX: 100, clientY: 100 }) as unknown as React.PointerEvent<HTMLDivElement>;

    act(() => result.current.onBackgroundPointerDown(down(document.createElement('div'))));
    act(() => { window.dispatchEvent(new MouseEvent('pointermove', { clientX: 60, clientY: 100 })); });
    // jsdom : MouseEvent sert de PointerEvent, clientX est lu tel quel.
    expect(container.scrollLeft).toBe(40);
    act(() => { window.dispatchEvent(new MouseEvent('pointerup')); });

    const card = document.createElement('div');
    card.setAttribute('data-card', '');
    const inner = document.createElement('span');
    card.appendChild(inner);
    container.scrollLeft = 0;
    act(() => result.current.onBackgroundPointerDown(down(inner)));
    act(() => { window.dispatchEvent(new MouseEvent('pointermove', { clientX: 10, clientY: 100 })); });
    expect(container.scrollLeft).toBe(0);
  });
});
