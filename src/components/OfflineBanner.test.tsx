// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import OfflineBanner from './OfflineBanner';

let demo = false;
vi.mock('@/lib/app-mode.store', () => ({ useIsDemo: () => demo }));
vi.mock('@/i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key, tp: (key: string) => key }),
}));

/** `navigator.onLine` est en lecture seule : on le redéfinit le temps du test. */
const setOnline = (value: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', { value, configurable: true });
};

describe('OfflineBanner — maquette 48', () => {
  beforeEach(() => {
    demo = false;
    setOnline(true);
  });
  afterEach(() => setOnline(true));

  it('reste invisible tant que le réseau est là', () => {
    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("apparaît au montage si l'appareil est DÉJÀ hors ligne", () => {
    // Le cas réel : on ouvre l'application dans le métro. Un composant qui
    // n'écouterait que l'événement `offline` ne dirait jamais rien ici.
    setOnline(false);
    render(<OfflineBanner />);
    expect(screen.getByRole('status').textContent).toContain('offline.label');
  });

  it("apparaît quand le réseau tombe, disparaît quand il revient", () => {
    setOnline(false);
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).not.toBeNull();

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByRole('status')).toBeNull();

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.queryByRole('status')).not.toBeNull();
  });

  it("ne s'affiche pas en mode démo, où rien ne part au réseau", () => {
    demo = true;
    setOnline(false);
    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('annonce son texte aux lecteurs d’écran sans voler le focus', () => {
    setOnline(false);
    render(<OfflineBanner />);
    const banner = screen.getByRole('status');
    expect(banner.getAttribute('aria-live')).toBe('polite');
    expect(banner.querySelector('button')).toBeNull();
  });
});
