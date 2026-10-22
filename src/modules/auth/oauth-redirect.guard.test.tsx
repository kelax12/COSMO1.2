// @vitest-environment jsdom
//
// C-45 — LA SONDE DOIT MESURER CE QUI PART, PAS UNE COPIE.
//
// `oauth-landing.test.ts` prouve que le comparateur compare. Il ne prouve
// PAS que la valeur mémorisée est bien celle envoyée à GoTrue : deux
// constructions parallèles du même chemin (le piège de ce dépôt, cf. les
// trois écritures divergentes d'échéance) rendraient la sonde muette pile
// dans le cas qu'elle surveille, ou bavarde tout le temps.
//
// Ce test attrape `redirectTo` à la sortie de `signInWithOAuth` et le
// confronte à l'intention écrite. Le témoin est la deuxième assertion : la
// destination attendue est ÉCRITE ICI en toutes lettres, donc un
// `redirectTo` qui retomberait sur `/dashboard` échoue même si les deux
// valeurs restent égales entre elles.
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

type OAuthArgs = { options: { redirectTo: string } };
const signInWithOAuth = vi.fn(async (_options: OAuthArgs) => ({ data: {}, error: null as null | { message: string } }));

/** Le `redirectTo` REELLEMENT envoye a GoTrue, lu sur l'appel capture. */
const sentRedirectTo = (): string | undefined => signInWithOAuth.mock.calls[0]?.[0]?.options?.redirectTo;
vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithOAuth: (options: OAuthArgs) => signInWithOAuth(options),
      signOut: async () => ({ error: null }),
    },
    rpc: async () => ({ error: null }),
  },
}));
vi.mock('@/lib/monitoring', () => ({
  captureMessage: () => {},
  captureException: () => {},
  setUser: () => {},
}));

import { AuthProvider, useAuth } from './AuthContext';
import { readOAuthRedirectIntent } from './oauth-landing';

let loginWithGoogle: ((redirectPath?: string) => Promise<{ success: boolean }>) | null = null;
const Probe: React.FC = () => {
  loginWithGoogle = useAuth().loginWithGoogle;
  return null;
};

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  signInWithOAuth.mockClear();
  loginWithGoogle = null;
});

describe('loginWithGoogle — l’intention mémorisée est le redirectTo envoyé', () => {
  it('mémorise exactement la destination d’invitation demandée', async () => {
    mount();
    await act(async () => {
      await loginWithGoogle!('/org-invite/A1b2C3d4E5f6G7h8I9j0');
    });

    const sent = sentRedirectTo();
    // Témoin : la destination attendue est écrite ici, pas dérivée du code testé.
    expect(sent).toBe('http://localhost:3000/org-invite/A1b2C3d4E5f6G7h8I9j0');
    expect(readOAuthRedirectIntent()?.url).toBe(sent);
  });

  it('retombe sur /dashboard quand le retour demandé est forgé, et le mémorise aussi', async () => {
    mount();
    await act(async () => {
      await loginWithGoogle!('https://evil.example/phish');
    });

    const sent = sentRedirectTo();
    expect(sent).toBe('http://localhost:3000/dashboard');
    expect(readOAuthRedirectIntent()?.url).toBe(sent);
  });

  it('oublie l’intention quand le départ OAuth échoue', async () => {
    signInWithOAuth.mockResolvedValueOnce({ data: {}, error: { message: 'boom' } });
    mount();
    await act(async () => {
      await loginWithGoogle!('/org-invite/A1b2C3d4E5f6G7h8I9j0');
    });
    expect(readOAuthRedirectIntent()).toBeNull();
  });
});
