// @vitest-environment jsdom
// ═══════════════════════════════════════════════════════════════════
// Régression : un WebSocket bloqué ne doit JAMAIS empêcher COSMO de démarrer
//
// Bug réel (2026-08-23, thecosmo.app sur mobile) :
//
//   WebSocket not available: The operation is insecure.
//
// Le constructeur `WebSocket` lève de façon SYNCHRONE dans les navigateurs
// qui les bloquent — navigation privée, blocage total des données de site,
// protection anti-pistage stricte. Comme ce hook est monté dans `App.tsx`,
// au-dessus de tout boundary de page, l'exception démontait l'application
// ENTIÈRE : écran noir en thème sombre, page blanche en clair, à chaque
// visite depuis ce navigateur, sans même un bouton de déconnexion.
//
// Le temps réel est un CONFORT : `useTasks` garde un sondage de secours à
// 5 min. Une connexion impossible doit dégrader la synchronisation, jamais
// tuer l'app.
// ═══════════════════════════════════════════════════════════════════
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const channel = vi.fn();
const removeChannel = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    channel: (...args: unknown[]) => channel(...args),
    removeChannel: (...args: unknown[]) => removeChannel(...args),
  },
  isSupabaseConfigured: true,
}));

vi.mock('@/lib/app-mode.store', () => ({ useIsDemo: () => false }));

const captureException = vi.fn();
vi.mock('@sentry/react', () => ({ captureException: (...a: unknown[]) => captureException(...a) }));

import { useSharedTasksRealtime } from './useSharedTasksRealtime';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

beforeEach(() => {
  channel.mockReset();
  removeChannel.mockReset();
  captureException.mockReset();
});

/** Canal nominal : chaînable, `subscribe()` rend un objet opaque. */
const workingChannel = () => {
  const c: Record<string, unknown> = {};
  c.on = vi.fn(() => c);
  c.subscribe = vi.fn(() => c);
  return c;
};

describe('useSharedTasksRealtime — WebSocket indisponible', () => {
  it("ne propage PAS l'exception du constructeur WebSocket", () => {
    channel.mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });

    // Le rendu doit aboutir. S'il levait, React démonterait tout l'arbre —
    // c'est très exactement le bug qu'on empêche ici de revenir.
    expect(() =>
      renderHook(() => useSharedTasksRealtime('user-1'), { wrapper }),
    ).not.toThrow();
  });

  it('signale la dégradation à Sentry en `warning`, pas en erreur', () => {
    channel.mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });

    renderHook(() => useSharedTasksRealtime('user-1'), { wrapper });

    expect(captureException).toHaveBeenCalledTimes(1);
    const [, options] = captureException.mock.calls[0] as [unknown, { level: string }];
    // `warning` et non `error` : l'app marche, elle est juste moins réactive.
    expect(options.level).toBe('warning');
  });

  it('ne tente pas de fermer un canal qui n\'a jamais existé', () => {
    channel.mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });

    const { unmount } = renderHook(() => useSharedTasksRealtime('user-1'), { wrapper });
    expect(() => unmount()).not.toThrow();
    expect(removeChannel).not.toHaveBeenCalled();
  });

  it('reste nominal quand le WebSocket fonctionne', () => {
    const c = workingChannel();
    channel.mockImplementation(() => c);

    const { unmount } = renderHook(() => useSharedTasksRealtime('user-1'), { wrapper });

    expect(channel).toHaveBeenCalledWith('shared-tasks:user-1');
    // Les deux sens de la collaboration : reçu (friend_id) et émis (shared_by).
    expect(c.on).toHaveBeenCalledTimes(2);
    expect(c.subscribe).toHaveBeenCalledTimes(1);

    unmount();
    // Le socket doit être libéré, sinon il fuit à chaque changement de compte.
    expect(removeChannel).toHaveBeenCalledWith(c);
  });
});
