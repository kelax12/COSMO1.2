// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as Sentry from '@sentry/react';
import { AppErrorBoundary } from './AppErrorBoundary';
import { hardSignOut } from '@/lib/hard-sign-out';

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));
vi.mock('@/lib/hard-sign-out', () => ({ hardSignOut: vi.fn() }));

const Boom = () => {
  throw new Error('kaboom');
};

beforeEach(() => {
  // React logs the caught error to console.error — silence it for clean output.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('AppErrorBoundary', () => {
  it('renders a generic fallback (no raw error message) and reports to Sentry', () => {
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );
    // Generic, user-facing copy — never the raw error text (faille V7).
    expect(screen.getByText(/erreur inattendue/i)).toBeTruthy();
    expect(screen.queryByText(/kaboom/)).toBeNull();
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('renders children unchanged when there is no error', () => {
    render(
      <AppErrorBoundary>
        <p>contenu sain</p>
      </AppErrorBoundary>,
    );
    expect(screen.getByText('contenu sain')).toBeTruthy();
  });
});

// ── C-64 ──────────────────────────────────────────────────────────────
//
// Ce repli n'offrait QUE « Rafraichir la page ». Quand la cause est
// deterministe — une valeur de stockage, une reponse mise en cache, une
// preference — le rechargement ramene le MEME ecran : mesure le 2026-09-03
// sur C-61, trois entrees, trois fois la meme impasse, et `Layout` etant le
// parent de toutes les pages protegees, la deconnexion elle-meme etait hors
// d'atteinte. `RootErrorBoundary` porte une sortie de secours depuis son
// ecriture ; cette frontiere-ci est PLUS BAS dans l'arbre, donc elle attrape
// EN PREMIER, et c'est donc elle qu'on rencontre.
describe('AppErrorBoundary — sortie de secours (C-64)', () => {
  it('offre une DEUXIEME issue, en plus du rechargement', () => {
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('la deuxieme issue purge la session au lieu de relire le meme etat', () => {
    render(
      <AppErrorBoundary>
        <Boom />
      </AppErrorBoundary>,
    );
    fireEvent.click(screen.getByRole('button', { name: /d[ée]connecter|sign out/i }));
    expect(hardSignOut).toHaveBeenCalledTimes(1);
  });

  it('deux declenchements de suite laissent encore un geste possible', () => {
    // C'est la propriete qui manquait : un rechargement sur une cause
    // deterministe ramene le meme ecran, indefiniment.
    for (let attempt = 0; attempt < 2; attempt++) {
      const { unmount } = render(
        <AppErrorBoundary>
          <Boom />
        </AppErrorBoundary>,
      );
      expect(
        screen.queryByRole('button', { name: /d[ée]connecter|sign out/i }),
        `tentative ${attempt + 1}`,
      ).not.toBeNull();
      unmount();
    }
  });

  it('ne peint plus l ecran d erreur en couleurs ecrites en dur', () => {
    // Le theme EST pose a ce niveau de l'arbre (contrairement a la racine,
    // dont le couple noir/blanc est un choix explique). Cet ecran etait la
    // seule surface du produit a ignorer le theme choisi.
    const source = readFileSync(
      join(process.cwd(), 'src/components/AppErrorBoundary.tsx'),
      'utf-8',
    );
    expect(source).not.toContain('#666');
    expect(source).not.toContain('#3b82f6');
    expect(source).toContain('rgb(var(--color-text-secondary))');
  });

  it('respecte le repli `null` d un widget secondaire', () => {
    // ⚠️ Option VOLONTAIRE de l'API du composant : ne pas y toucher.
    const { container } = render(
      <AppErrorBoundary fallback={null}>
        <Boom />
      </AppErrorBoundary>,
    );
    expect(container.innerHTML).toBe('');
  });
});
