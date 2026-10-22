// @vitest-environment jsdom
//
// 🔴 Opposabilité des CGU (C. civ. art. 1119) et information au point de
// collecte (RGPD art. 13). Le bouton « Continuer avec Google » est rendu en
// mode CONNEXION aussi, et il crée un compte au premier passage. Jusqu'au
// 2026-10-13, la mention légale n'existait qu'en mode inscription : 6
// inscriptions sur 7 passent par Google, et la plupart se faisaient donc sans
// avoir vu les CGU ni la politique de confidentialité.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('@/modules/auth/AuthContext', () => ({
  useAuth: () => ({ register: vi.fn(), login: vi.fn(), loginDemo: vi.fn(), loginWithGoogle: vi.fn() }),
}));
vi.mock('@/lib/hooks/use-mobile', () => ({ useIsMobile: () => false }));

import AuthForm from './AuthForm';

function renderMode(mode: 'login' | 'register') {
  return render(
    <MemoryRouter>
      <AuthForm mode={mode} onSwitchMode={vi.fn()} onSuccess={vi.fn()} showDemo={false} />
    </MemoryRouter>,
  );
}

describe('AuthForm, mention légale', () => {
  it.each(['login', 'register'] as const)('en mode %s, le bouton Google et les liens CGU + politique coexistent', (mode) => {
    renderMode(mode);
    expect(screen.getByRole('button', { name: /google/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /conditions générales/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /politique de confidentialité/i })).toBeTruthy();
  });

  it("en mode connexion, la phrase dit que Google CRÉE un compte", () => {
    renderMode('login');
    expect(screen.getByText(/continuer avec google crée votre compte/i)).toBeTruthy();
  });
});
