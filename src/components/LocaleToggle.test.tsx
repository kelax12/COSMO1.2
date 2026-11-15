// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LocaleToggle from './LocaleToggle';

const persistLocale = vi.fn();
const assign = vi.fn();
vi.mock('@/i18n/bootstrap', () => ({ localeSwitchTarget: (l: string) => `/${l}/cible` }));
vi.mock('@/i18n/locale', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/locale')>()),
  SUPPORTED_LOCALES: ['fr', 'en'],
  LOCALE_LABEL: { fr: 'Français', en: 'English' },
  persistLocale: (l: string) => persistLocale(l),
}));
vi.mock('@/i18n/useT', () => ({
  useT: () => ({ t: (key: string) => key }),
}));

describe('LocaleToggle', () => {
  beforeEach(() => {
    persistLocale.mockClear();
    assign.mockClear();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, assign },
      configurable: true,
    });
  });

  it('expose un radiogroup avec la langue courante cochée', () => {
    render(<LocaleToggle />);
    expect(screen.getByRole('radiogroup')).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Français/ }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: /English/ }).getAttribute('aria-checked')).toBe('false');
  });

  it('choisir une autre langue la mémorise puis recharge vers le chemin localisé', () => {
    render(<LocaleToggle />);
    fireEvent.click(screen.getByRole('radio', { name: /English/ }));
    expect(persistLocale).toHaveBeenCalledWith('en');
    expect(assign).toHaveBeenCalledWith('/en/cible');
  });

  it('recliquer la langue courante ne fait rien', () => {
    render(<LocaleToggle />);
    fireEvent.click(screen.getByRole('radio', { name: /Français/ }));
    expect(persistLocale).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });
});
