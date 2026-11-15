// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DemoConversionBanner from './DemoConversionBanner';

let demo = true;
const navigate = vi.fn();
vi.mock('@/modules/auth/AuthContext', () => ({ useAuth: () => ({ isDemo: demo }) }));
vi.mock('react-router', () => ({ useNavigate: () => navigate }));
vi.mock('@/i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}));

describe('DemoConversionBanner', () => {
  beforeEach(() => {
    demo = true;
    navigate.mockClear();
    localStorage.clear();
  });

  it('est invisible hors mode démo', () => {
    demo = false;
    const { container } = render(<DemoConversionBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('propose de créer un compte : navigue vers /signup', () => {
    render(<DemoConversionBanner />);
    fireEvent.click(screen.getAllByRole('button', { name: 'demoBanner.createAccount' })[0]);
    expect(navigate).toHaveBeenCalledWith('/signup');
  });

  it('se ferme et mémorise le choix ; une nouvelle session démo le revoit', () => {
    const { container, unmount } = render(<DemoConversionBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'demoBanner.hide' }));
    expect(container.firstChild).toBeNull();
    expect(localStorage.getItem('cosmo_demo_banner_dismissed')).toBe('1');
    unmount();

    const again = render(<DemoConversionBanner />);
    expect(again.container.firstChild).toBeNull();
    again.unmount();

    localStorage.clear();
    render(<DemoConversionBanner />);
    expect(screen.getByRole('region')).toBeTruthy();
  });
});
