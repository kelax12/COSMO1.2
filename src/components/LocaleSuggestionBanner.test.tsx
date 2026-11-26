// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import LocaleSuggestionBanner from './LocaleSuggestionBanner';

// Le bandeau REMPLACE la redirection par langue du navigateur (src/i18n/bootstrap.ts) :
// il doit proposer sans jamais imposer, et se taire dès qu'un choix existe.
const langues = (l: string[]) => vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(l);

describe('bandeau de suggestion de langue', () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('propose l’anglais, en anglais, à un navigateur anglophone sur la page française', () => {
    langues(['en-US', 'en']);
    render(<LocaleSuggestionBanner />);
    expect(screen.getByText('This page is also available in English.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Switch to English' })).toBeTruthy();
  });

  it('ne propose rien à un navigateur francophone', () => {
    langues(['fr-FR']);
    const { container } = render(<LocaleSuggestionBanner />);
    expect(container.textContent).toBe('');
  });

  it('se tait quand une préférence de langue a déjà été choisie', () => {
    langues(['en-US']);
    window.localStorage.setItem('cosmo_locale', 'fr');
    const { container } = render(<LocaleSuggestionBanner />);
    expect(container.textContent).toBe('');
  });

  it('se ferme et ne revient pas pendant la session', () => {
    langues(['en-US']);
    const { unmount } = render(<LocaleSuggestionBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('This page is also available in English.')).toBeNull();
    unmount();
    const { container } = render(<LocaleSuggestionBanner />);
    expect(container.textContent).toBe('');
  });
});
