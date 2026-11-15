// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ShareLinkField from './ShareLinkField';

let demo = false;
let linkState: { data: string | undefined; isLoading: boolean } = { data: 'tok123', isLoading: false };
const toastSuccess = vi.fn();
const toastError = vi.fn();
const useShareLink = vi.fn();

vi.mock('@/lib/app-mode.store', () => ({ useIsDemo: () => demo }));
vi.mock('@/lib/toast', () => ({
  toast: { success: (m: string) => toastSuccess(m), error: (m: string) => toastError(m) },
}));
vi.mock('@/modules/friends', () => ({
  useShareLink: (...args: unknown[]) => {
    useShareLink(...args);
    return linkState;
  },
  buildInviteUrl: (t: string) => `https://app.test/invite/${t}`,
}));
vi.mock('@/i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}));

describe('ShareLinkField', () => {
  beforeEach(() => {
    demo = false;
    linkState = { data: 'tok123', isLoading: false };
    toastSuccess.mockClear();
    toastError.mockClear();
    useShareLink.mockClear();
  });

  it('ne rend rien en démo ni pour un non-propriétaire', () => {
    demo = true;
    const a = render(<ShareLinkField taskId="t1" ownerCanShare />);
    expect(a.container.firstChild).toBeNull();
    a.unmount();
    demo = false;
    const b = render(<ShareLinkField taskId="t1" ownerCanShare={false} />);
    expect(b.container.firstChild).toBeNull();
  });

  it("ne demande le lien que pour une tâche existante", () => {
    render(<ShareLinkField taskId="t1" ownerCanShare />);
    expect(useShareLink).toHaveBeenLastCalledWith('t1', true);
  });

  it('affiche le lien et le copie dans le presse-papiers', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<ShareLinkField taskId="t1" ownerCanShare />);
    expect((screen.getByLabelText('shareLink.aria') as HTMLInputElement).value).toBe('https://app.test/invite/tok123');
    fireEvent.click(screen.getByRole('button', { name: /shareLink.copy/ }));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('shareLink.copied'));
    expect(writeText).toHaveBeenCalledWith('https://app.test/invite/tok123');
  });

  it('signale un échec de copie', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('refus')) },
      configurable: true,
    });
    render(<ShareLinkField taskId="t1" ownerCanShare />);
    fireEvent.click(screen.getByRole('button', { name: /shareLink.copy/ }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('shareLink.copyFailed'));
  });

  it('en création : le bouton Générer persiste la tâche via onGenerate', async () => {
    linkState = { data: undefined, isLoading: false };
    const onGenerate = vi.fn().mockResolvedValue('new-id');
    render(<ShareLinkField ownerCanShare onGenerate={onGenerate} />);
    expect(useShareLink).toHaveBeenLastCalledWith('', false);
    fireEvent.click(screen.getByRole('button', { name: /shareLink.generate/ }));
    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(1));
  });

  it('en création sans onGenerate : champ et bouton Copier désactivés', () => {
    linkState = { data: undefined, isLoading: false };
    render(<ShareLinkField ownerCanShare />);
    expect((screen.getByLabelText('shareLink.aria') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /shareLink.copy/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('shareLink.saveFirst')).toBeTruthy();
  });
});
