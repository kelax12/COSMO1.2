// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// T-06 (b) — `/admin` derrière un second facteur (mig. 131).
//
// Ce que ce test garde, et qui n'est pas évident : la garde ne doit JAMAIS
// laisser voir le tableau de bord avant que la session soit en `aal2`. Un
// écran d'attente, un écran d'enrôlement, un défi : tout sauf les chiffres.
//
// Il ne teste pas la sécurité — celle-ci est côté serveur, `get_admin_stats()`
// refuse une session `aal1`. Il teste que le CLIENT ne montre rien qu'il ne
// devrait, et surtout qu'un admin sans facteur trouve un chemin de retour au
// lieu d'une redirection silencieuse.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ensureNamespaces } from '@/i18n/catalog';
import type { AdminGateState } from '@/modules/auth/mfa';

let gateState: AdminGateState = 'loading';
const refresh = vi.fn();

vi.mock('@/modules/admin', () => ({
  useAdminGate: () => ({ state: gateState, refresh }),
}));

const startTotpEnrolment = vi.fn();
const verifyTotp = vi.fn();

vi.mock('@/modules/auth/mfa', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/auth/mfa')>()),
  startTotpEnrolment,
  verifyTotp,
  listFactors: vi.fn(async () => []),
  cancelEnrolment: vi.fn(async () => undefined),
}));

const { AdminMfaGate } = await import('./AdminMfaGate');

const DASHBOARD = 'volumétrie confidentielle';

const renderGate = () =>
  render(
    <MemoryRouter>
      <AdminMfaGate>
        <p>{DASHBOARD}</p>
      </AdminMfaGate>
    </MemoryRouter>
  );

beforeAll(async () => {
  await ensureNamespaces(['admin'], 'fr');
});

beforeEach(() => {
  vi.clearAllMocks();
  gateState = 'loading';
});

describe('AdminMfaGate', () => {
  it('ne montre rien tant que le niveau de la session est inconnu', () => {
    gateState = 'loading';
    renderGate();
    expect(screen.queryByText(DASHBOARD)).toBeNull();
  });

  it('ne montre rien à un compte hors allowlist', () => {
    gateState = 'not-admin';
    renderGate();
    expect(screen.queryByText(DASHBOARD)).toBeNull();
  });

  it("propose l'enrôlement, et surtout ne redirige pas, un admin sans facteur", () => {
    gateState = 'enrol';
    renderGate();
    expect(screen.queryByText(DASHBOARD)).toBeNull();
    // Le chemin de retour existe : un bouton, pas un écran vide.
    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('demande un code à un admin enrôlé dont la session est encore aal1', () => {
    gateState = 'challenge';
    renderGate();
    expect(screen.queryByText(DASHBOARD)).toBeNull();
    const input = screen.getByLabelText(/six chiffres/i) as HTMLInputElement;
    expect(input.inputMode).toBe('numeric');
  });

  it('rend le tableau de bord quand la session est aal2', () => {
    gateState = 'ready';
    renderGate();
    expect(screen.getByText(DASHBOARD)).toBeTruthy();
  });

  it("n'appelle aucune API MFA tant que l'admin n'a rien demandé", () => {
    gateState = 'enrol';
    renderGate();
    expect(startTotpEnrolment).not.toHaveBeenCalled();
    expect(verifyTotp).not.toHaveBeenCalled();
  });
});
