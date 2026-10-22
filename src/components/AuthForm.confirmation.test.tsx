// @vitest-environment jsdom
//
// Le jour où les confirmations d'email seront activées sur le projet Supabase,
// `signUp` cessera de renvoyer une session. Sans le chemin testé ici, l'écran
// naviguerait quand même vers `/dashboard`, `ProtectedRoute` renverrait
// l'inscrit sur `/login`, et il n'aurait aucun moyen de comprendre pourquoi son
// compte « ne marche pas ». Le compte existe pourtant, il attend un clic dans
// un mail.
//
// ⚠️ Les deux cas comptent autant l'un que l'autre. Celui qui vérifie qu'AUCUN
// panneau ne s'affiche quand une session est ouverte est le TÉMOIN : sans lui,
// un composant qui afficherait le panneau en toutes circonstances passerait le
// premier test, et casserait le parcours d'inscription d'aujourd'hui.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const register = vi.fn();
const onSuccess = vi.fn();
const onSwitchMode = vi.fn();

vi.mock('@/modules/auth/AuthContext', () => ({
  useAuth: () => ({ register, login: vi.fn(), loginDemo: vi.fn(), loginWithGoogle: vi.fn() }),
}));
vi.mock('@/lib/hooks/use-mobile', () => ({ useIsMobile: () => false }));

import AuthForm from './AuthForm';

function renderForm() {
  return render(
    <MemoryRouter>
      <AuthForm mode="register" onSwitchMode={onSwitchMode} onSuccess={onSuccess} showDemo={false} />
    </MemoryRouter>,
  );
}

// Les champs sont ciblés par leur `id`, pas par leur libellé : « mot de passe »
// apparaît aussi dans l'`aria-label` du bouton œil, et un sélecteur ambigu
// casse pour une raison qui n'a rien à voir avec ce qu'on teste.
function fill(id: string, name: string, value: string) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`champ #${id} absent du formulaire`);
  fireEvent.change(el, { target: { name, value } });
}

async function submitSignup() {
  fill('auth-name', 'name', 'Alex');
  fill('auth-email', 'email', 'alex@exemple.fr');
  fill('auth-password', 'password', 'un-mot-de-passe-assez-long');
  fireEvent.click(screen.getByRole('button', { name: /créer mon compte/i }));
}

beforeEach(() => {
  register.mockReset();
  onSuccess.mockReset();
  onSwitchMode.mockReset();
});

describe("AuthForm — inscription sans session ouverte", () => {
  it("affiche « vérifiez votre boîte mail » et NE navigue pas quand la confirmation est exigée", async () => {
    register.mockResolvedValue({ success: true, needsEmailConfirmation: true });
    renderForm();
    await submitSignup();

    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    expect(screen.getByText(/vérifiez votre boîte mail/i)).toBeTruthy();
    // L'adresse est rappelée : sans elle, une faute de frappe est indétectable.
    expect(screen.getByText(/alex@exemple\.fr/)).toBeTruthy();
    // Le point décisif : on ne pousse PAS l'inscrit vers un écran protégé.
    expect(onSuccess).not.toHaveBeenCalled();
  });

  // TÉMOIN — cf. l'en-tête de fichier.
  it("navigue normalement, sans panneau, quand une session est ouverte (régime actuel)", async () => {
    register.mockResolvedValue({ success: true, needsEmailConfirmation: false });
    renderForm();
    await submitSignup();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('personal'));
    expect(screen.queryByText(/vérifiez votre boîte mail/i)).toBeNull();
  });

  it("laisse revenir à la connexion depuis le panneau", async () => {
    register.mockResolvedValue({ success: true, needsEmailConfirmation: true });
    renderForm();
    await submitSignup();

    await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /retour à la connexion/i }));
    expect(onSwitchMode).toHaveBeenCalledWith('login');
  });
});
