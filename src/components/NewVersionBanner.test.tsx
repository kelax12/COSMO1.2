// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import NewVersionBanner from './NewVersionBanner';

vi.mock('@/i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}));
vi.mock('@/lib/app-version', () => ({
  currentRelease: () => 'v1',
  shouldCheckNow: () => true,
  shouldOfferReload: (current: string, served: unknown) => typeof served === 'string' && served !== current,
}));

const serve = (body: unknown, ok = true) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok, json: async () => body } as Response);

const refocus = () => window.dispatchEvent(new Event('focus'));

describe('NewVersionBanner', () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('reste muet quand le serveur sert la même version', async () => {
    const f = serve({ release: 'v1' });
    const { container } = render(<NewVersionBanner />);
    refocus();
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });

  it('propose le rechargement pour un build plus récent, et se ferme sur demande', async () => {
    serve({ release: 'v2' });
    render(<NewVersionBanner />);
    refocus();
    const status = await screen.findByRole('status');
    expect(status.textContent).toContain('appVersion.available');
    fireEvent.click(screen.getByRole('button', { name: 'appVersion.dismiss' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('ne propose rien si la réponse est en erreur', async () => {
    const f = serve({ release: 'v2' }, false);
    const { container } = render(<NewVersionBanner />);
    refocus();
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(container.firstChild).toBeNull();
  });
});
