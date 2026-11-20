// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('@/i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}));
vi.mock('@/i18n/useLocalizedPath', () => ({
  useLocalizedPath: () => (key: string) => `/${key}`,
}));

import CookieBanner from './CookieBanner';
import { COOKIE_CONSENT_KEY, requestConsentReview } from '@/lib/cookie-consent';

const mount = (path = '/dashboard') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <CookieBanner />
    </MemoryRouter>,
  );

const firstGesture = () => act(() => { window.dispatchEvent(new Event('click')); });

describe('CookieBanner', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('n’apparaît pas au montage : il attend le premier geste, sans rien déposer', () => {
    mount();
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(window.localStorage.getItem(COOKIE_CONSENT_KEY)).toBeNull();
    firstGesture();
    expect(screen.getByRole('complementary', { name: 'cookies.banner' })).toBeTruthy();
    // Toujours rien d’enregistré : le silence n’est pas une acceptation.
    expect(window.localStorage.getItem(COOKIE_CONSENT_KEY)).toBeNull();
  });

  it('« Accepter » enregistre l’accord et ferme le bandeau', () => {
    mount();
    firstGesture();
    fireEvent.click(screen.getByRole('button', { name: 'cookies.accept' }));
    expect(window.localStorage.getItem(COOKIE_CONSENT_KEY)).toBe('accepted');
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('« Refuser » enregistre le refus et purge les traces posées avant la réponse', () => {
    window.localStorage.setItem('cosmo_first_touch', 'utm=x');
    mount();
    firstGesture();
    fireEvent.click(screen.getByRole('button', { name: 'cookies.decline' }));
    expect(window.localStorage.getItem(COOKIE_CONSENT_KEY)).toBe('refused');
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('la croix à la première question vaut refus, jamais accord', () => {
    mount();
    firstGesture();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(window.localStorage.getItem(COOKIE_CONSENT_KEY)).toBe('refused');
  });

  it('ne s’affiche pas du tout quand une réponse valide existe déjà', () => {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    window.localStorage.setItem('cosmo_cookie_consent_at', String(Date.now()));
    const { container } = mount();
    firstGesture();
    expect(container.firstChild).toBeNull();
  });

  it('« Gérer les cookies » rouvre le bandeau, et le fermer ne retire pas l’accord existant', () => {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    window.localStorage.setItem('cosmo_cookie_consent_at', String(Date.now()));
    mount();
    act(() => requestConsentReview());
    expect(screen.getByRole('complementary')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(window.localStorage.getItem(COOKIE_CONSENT_KEY)).toBe('accepted');
  });

  it('le lien vers la politique de confidentialité est localisé', () => {
    mount();
    firstGesture();
    expect(screen.getByRole('link', { name: 'cookies.learnMore' }).getAttribute('href')).toBe('/privacy');
  });

  it('sur la landing, le bandeau garde sa palette claire fixe', () => {
    mount('/');
    firstGesture();
    expect(screen.getByRole('complementary').innerHTML).toContain('bg-white');
  });
});
