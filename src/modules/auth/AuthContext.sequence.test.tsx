// @vitest-environment jsdom
//
// ARC-03 : L'ORDRE DES EFFETS DE SESSION EST UN CONTRAT.
//
// `AuthContext` a été découpé (V12.4) : le cache hors ligne, les
// préchargements, `last_seen`, l'attribution et le chien de garde vivent
// chacun dans leur unité, abonnée aux événements de session. Ce fichier a été
// écrit AVANT la coupe, joué vert contre le fichier de 598 lignes, puis
// rejoué inchangé après : c'est lui qui prouve que l'ordre n'a pas bougé.
//
// Chaque effet observable écrit une ligne dans un JOURNAL unique, et chaque
// scénario compare le journal entier, dans l'ordre. Une assertion « a été
// appelé » ne verrait pas un préchargement passé avant le vidage du cache.
//
// ⚠️ Ce qui n'est PAS journalisé : `setUser` (asynchrone par nature, l'état
// rendu est vérifié à part) et `monitoring.setUser` (effet React, après rendu).
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const journal: string[] = [];
const note = (line: string) => journal.push(line);

interface FakeUser {
  id: string;
  email: string;
  user_metadata: Record<string, unknown>;
  app_metadata: Record<string, unknown>;
}
type AuthCallback = (event: string, session: { user: FakeUser } | null) => void;

const fake = vi.hoisted(() => ({
  session: null as { user: unknown } | null,
  authCallback: null as ((event: string, session: unknown) => void) | null,
  getSessionImpl: null as null | (() => Promise<unknown>),
  seedLocaleOk: true,
  firstTouch: null as null | { source: string; campaign?: string },
  affiliateSlug: null as null | string,
  signUpCalls: [] as unknown[],
}));

vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: () => {
        note('getSession');
        if (fake.getSessionImpl) return fake.getSessionImpl();
        return Promise.resolve({ data: { session: fake.session } });
      },
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        fake.authCallback = cb;
        return { data: { subscription: { unsubscribe: () => note('auth:unsubscribe') } } };
      },
      signInWithPassword: async () => {
        note('signInWithPassword');
        return { error: null };
      },
      signUp: async (args: unknown) => {
        note('signUp');
        fake.signUpCalls.push(args);
        return { data: { session: null }, error: null };
      },
      signInWithOAuth: async () => ({ error: null }),
      signOut: async () => {
        note('signOut');
        return { error: null };
      },
    },
    rpc: (name: string) => {
      note(`rpc:${name}`);
      return Promise.resolve({ error: null });
    },
  },
}));
vi.mock('@/lib/repository.factory', () => ({
  resetRepositories: () => note('resetRepositories'),
  clearDemoStorage: () => {
    note('clearDemoStorage');
    localStorage.removeItem('cosmo_demo_active');
  },
  getTasksRepository: () => ({ getAll: async () => [] }),
  getHabitsRepository: () => ({ fetchHabits: async () => [] }),
}));
vi.mock('./session-cache', () => ({
  readLocalCache: (userId: string, key: string) => {
    note(`cache:read:${userId}:${key}`);
    return null;
  },
  writeLocalCache: (userId: string, key: string) => note(`cache:write:${userId}:${key}`),
  clearLocalCache: (userId: string) => note(`cache:clear:${userId}`),
  purgeAllLocalCache: () => note('cache:purgeAll'),
}));
vi.mock('./oauth-url-probes', () => ({
  consumeOAuthErrorFromUrl: () => null,
  checkOAuthLanding: () => note('checkOAuthLanding'),
}));
vi.mock('./acquisition-claim', () => ({
  claimAcquisitionSource: (u: { id: string }) => note(`claimAcquisition:${u.id}`),
}));
vi.mock('./affiliate-claim', () => ({
  claimAffiliate: (u: { id: string }) => note(`claimAffiliate:${u.id}`),
}));
vi.mock('@/lib/attribution', () => ({ readFirstTouch: () => fake.firstTouch }));
vi.mock('@/lib/affiliation', () => ({ readAffiliateSlug: () => fake.affiliateSlug }));
vi.mock('@/lib/demo-metrics', () => ({
  recordDemoVisit: () => note('recordDemoVisit'),
  recordDemoConversionIfAny: () => note('recordDemoConversion'),
}));
vi.mock('@/lib/demo-engagement', () => ({
  resetDemoEngagementMemory: () => note('resetDemoEngagement'),
}));
vi.mock('@/lib/seed-i18n', () => ({
  recordSeedLocale: () => note('recordSeedLocale'),
  seedLocaleMatchesCurrent: () => fake.seedLocaleOk,
  isEnglishSeed: () => false,
}));
vi.mock('@/lib/monitoring', () => ({
  captureMessage: (msg: string) => note(`monitoring:message:${msg}`),
  captureException: () => note('monitoring:exception'),
  setUser: () => {},
}));

import { AuthProvider, useAuth } from './AuthContext';
import { appModeStore } from '@/lib/app-mode.store';

let auth: ReturnType<typeof useAuth> | null = null;
const Probe: React.FC = () => {
  auth = useAuth();
  return null;
};
const current = () => {
  if (!auth) throw new Error('Probe non montée');
  return auth;
};

const KEY_NAMES: Record<string, string> = {
  '["tasks","list"]': 'tasks',
  '["habits","list"]': 'habits',
};
const keyName = (key: unknown) => KEY_NAMES[JSON.stringify(key)] ?? JSON.stringify(key);

const userFor = (id: string): FakeUser => ({
  id,
  email: `${id}@exemple.fr`,
  user_metadata: {},
  app_metadata: { provider: 'email' },
});

/** Laisse filer les promesses (getSession, préchargements, écritures du cache). */
async function flush() {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function emitAuth(event: string, user: FakeUser | null) {
  const cb = fake.authCallback as AuthCallback | null;
  if (!cb) throw new Error('onAuthStateChange non abonné');
  await act(async () => {
    cb(event, user ? { user } : null);
  });
  await flush();
}

let qc: QueryClient;

function mount() {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const originalClear = qc.clear.bind(qc);
  vi.spyOn(qc, 'clear').mockImplementation(() => {
    note('queryClient.clear');
    originalClear();
  });
  const originalSet = qc.setQueryData.bind(qc);
  vi.spyOn(qc, 'setQueryData').mockImplementation(((key: unknown, data: unknown) => {
    note(`setQueryData:${keyName(key)}`);
    return originalSet(key as never, data as never);
  }) as typeof qc.setQueryData);
  const originalPrefetch = qc.prefetchQuery.bind(qc);
  vi.spyOn(qc, 'prefetchQuery').mockImplementation(((options: { queryKey: unknown }) => {
    note(`prefetch:${keyName(options.queryKey)}`);
    return originalPrefetch(options as never);
  }) as typeof qc.prefetchQuery);
  const cache = qc.getQueryCache();
  const originalSubscribe = cache.subscribe.bind(cache);
  vi.spyOn(cache, 'subscribe').mockImplementation((listener) => {
    note('cacheWriter:subscribe');
    const unsub = originalSubscribe(listener);
    return () => {
      note('cacheWriter:unsubscribe');
      unsub();
    };
  });
  return render(
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

/** Ce que fait l'ouverture d'une session réelle déjà connue (getSession / INITIAL_SESSION). */
const restoreFor = (id: string, { subscribe }: { subscribe: boolean }) => [
  `cache:read:${id}:tasks`,
  `cache:read:${id}:habits`,
  ...(subscribe ? ['cacheWriter:subscribe'] : []),
  'prefetch:tasks',
  'prefetch:habits',
];
const writesFor = (id: string) => [`cache:write:${id}:tasks`, `cache:write:${id}:habits`];

let seq = 0;
let originalSetDemo: (value: boolean) => void;

beforeEach(() => {
  seq += 1;
  journal.length = 0;
  auth = null;
  fake.session = null;
  fake.authCallback = null;
  fake.getSessionImpl = null;
  fake.seedLocaleOk = true;
  fake.firstTouch = null;
  fake.affiliateSlug = null;
  fake.signUpCalls = [];
  localStorage.clear();
  // Point de départ d'un vrai déploiement : Supabase configuré, pas de démo.
  appModeStore.setDemo(false);
  originalSetDemo = appModeStore.setDemo.bind(appModeStore);
  vi.spyOn(appModeStore, 'setDemo').mockImplementation((value: boolean) => {
    note(`setDemo:${value}`);
    originalSetDemo(value);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('séquence : connexion', () => {
  it('session restaurée : getSession puis INITIAL_SESSION, le second est idempotent', async () => {
    const a = userFor(`a${seq}`);
    fake.session = { user: a };
    mount();
    await flush();

    expect(journal).toEqual([
      'getSession',
      'checkOAuthLanding',
      'rpc:touch_last_seen',
      'recordDemoConversion',
      `claimAcquisition:${a.id}`,
      `claimAffiliate:${a.id}`,
      ...restoreFor(a.id, { subscribe: true }),
      ...writesFor(a.id),
    ]);
    expect(current().user?.id).toBe(a.id);
    expect(current().isLoading).toBe(false);

    journal.length = 0;
    await emitAuth('INITIAL_SESSION', a);
    // last_seen dédupliqué, l'écrivain du cache n'est pas réabonné.
    expect(journal).toEqual([
      'checkOAuthLanding',
      `claimAcquisition:${a.id}`,
      `claimAffiliate:${a.id}`,
      ...restoreFor(a.id, { subscribe: false }),
      ...writesFor(a.id),
    ]);

    journal.length = 0;
    await emitAuth('TOKEN_REFRESHED', a);
    // Même identité : ni vidage, ni réchauffage.
    expect(journal).toEqual(['checkOAuthLanding', `claimAcquisition:${a.id}`, `claimAffiliate:${a.id}`]);
  });

  it('connexion fraîche : SIGNED_IN après une INITIAL_SESSION vide', async () => {
    const a = userFor(`a${seq}`);
    mount();
    await flush();
    await emitAuth('INITIAL_SESSION', null);
    expect(journal).toEqual(['getSession']);
    expect(current().isLoading).toBe(false);

    journal.length = 0;
    await emitAuth('SIGNED_IN', a);
    expect(journal).toEqual([
      'setDemo:false',
      'resetRepositories',
      'queryClient.clear',
      ...restoreFor(a.id, { subscribe: true }),
      'checkOAuthLanding',
      'rpc:touch_last_seen',
      'recordDemoConversion',
      `claimAcquisition:${a.id}`,
      `claimAffiliate:${a.id}`,
      ...writesFor(a.id),
    ]);
    expect(current().user?.id).toBe(a.id);
  });
});

describe('séquence : changement de compte', () => {
  it('B remplace A : cache de A effacé AVANT le vidage, écrivain réabonné pour B', async () => {
    const a = userFor(`a${seq}`);
    const b = userFor(`b${seq}`);
    fake.session = { user: a };
    mount();
    await flush();
    await emitAuth('INITIAL_SESSION', a);

    journal.length = 0;
    await emitAuth('SIGNED_IN', b);
    expect(journal).toEqual([
      `cache:clear:${a.id}`,
      'setDemo:false',
      'resetRepositories',
      'queryClient.clear',
      `cache:read:${b.id}:tasks`,
      `cache:read:${b.id}:habits`,
      'cacheWriter:unsubscribe',
      'cacheWriter:subscribe',
      'prefetch:tasks',
      'prefetch:habits',
      'checkOAuthLanding',
      'rpc:touch_last_seen',
      'recordDemoConversion',
      `claimAcquisition:${b.id}`,
      `claimAffiliate:${b.id}`,
      ...writesFor(b.id),
    ]);
    expect(current().user?.id).toBe(b.id);
  });
});

describe('séquence : déconnexion', () => {
  it('logout puis SIGNED_OUT, et un re-login dans la même page re-pinge last_seen', async () => {
    const a = userFor(`a${seq}`);
    fake.session = { user: a };
    mount();
    await flush();
    await emitAuth('INITIAL_SESSION', a);

    journal.length = 0;
    await act(async () => {
      await current().logout();
    });
    expect(journal).toEqual([`cache:clear:${a.id}`, 'signOut']);
    expect(current().user).toBeNull();

    journal.length = 0;
    await emitAuth('SIGNED_OUT', null);
    expect(journal).toEqual([
      `cache:clear:${a.id}`,
      'setDemo:false',
      'resetRepositories',
      'queryClient.clear',
      'cache:purgeAll',
    ]);

    journal.length = 0;
    await emitAuth('SIGNED_IN', a);
    expect(journal).toContain('rpc:touch_last_seen');
    expect(journal.indexOf('rpc:touch_last_seen')).toBeGreaterThan(journal.indexOf('prefetch:habits'));
  });

  it('démontage : abonnement auth et écrivain du cache libérés', async () => {
    const a = userFor(`a${seq}`);
    fake.session = { user: a };
    const view = mount();
    await flush();
    journal.length = 0;
    view.unmount();
    expect(journal).toEqual(expect.arrayContaining(['auth:unsubscribe', 'cacheWriter:unsubscribe']));
    expect(journal).toHaveLength(2);
  });
});

describe('séquence : démo', () => {
  it('démo vers réel : loginDemo, événements ignorés, login, SIGNED_IN', async () => {
    const a = userFor(`a${seq}`);
    mount();
    await flush();
    await emitAuth('INITIAL_SESSION', null);

    journal.length = 0;
    act(() => current().loginDemo());
    await flush();
    expect(journal).toEqual([
      'clearDemoStorage',
      'resetDemoEngagement',
      'setDemo:true',
      'resetRepositories',
      'queryClient.clear',
      'recordSeedLocale',
      'recordDemoVisit',
      'signOut',
    ]);
    expect(current().isDemo).toBe(true);
    expect(current().user?.id).toBe('demo-user');

    journal.length = 0;
    await emitAuth('SIGNED_OUT', null);
    await emitAuth('SIGNED_IN', a);
    expect(journal).toEqual([]);
    expect(current().user?.id).toBe('demo-user');

    await act(async () => {
      await current().login('a@exemple.fr', 'motdepasse');
    });
    expect(journal).toEqual([
      'clearDemoStorage',
      'setDemo:false',
      'resetRepositories',
      'queryClient.clear',
      'signInWithPassword',
    ]);

    journal.length = 0;
    await emitAuth('SIGNED_IN', a);
    expect(journal).toEqual([
      'setDemo:false',
      'resetRepositories',
      'queryClient.clear',
      ...restoreFor(a.id, { subscribe: true }),
      'checkOAuthLanding',
      'rpc:touch_last_seen',
      'recordDemoConversion',
      `claimAcquisition:${a.id}`,
      `claimAffiliate:${a.id}`,
      ...writesFor(a.id),
    ]);
    expect(current().isDemo).toBe(false);
    expect(current().user?.id).toBe(a.id);
  });

  it('déconnexion démo : signOut puis sortie du backend démo, sans cache réel touché', async () => {
    mount();
    await flush();
    act(() => current().loginDemo());
    journal.length = 0;
    await act(async () => {
      await current().logout();
    });
    expect(journal).toEqual(['signOut', 'clearDemoStorage', 'setDemo:false', 'resetRepositories', 'queryClient.clear']);
    expect(current().user).toBeNull();
  });

  it('démo persistée (F5) : restaurée sans getSession', async () => {
    localStorage.setItem('cosmo_demo_active', '1');
    mount();
    await flush();
    expect(journal).toEqual(['setDemo:true']);
    expect(current().user?.id).toBe('demo-user');
    expect(current().isLoading).toBe(false);
  });

  it('démo persistée dans une autre langue : régénérée avant restauration', async () => {
    localStorage.setItem('cosmo_demo_active', '1');
    fake.seedLocaleOk = false;
    mount();
    await flush();
    expect(journal).toEqual([
      'clearDemoStorage',
      'setDemo:true',
      'resetRepositories',
      'queryClient.clear',
      'recordSeedLocale',
      'setDemo:true',
    ]);
  });
});

describe('séquence : inscription et chien de garde', () => {
  it("register transmet l'attribution first-touch et l'affiliation en metadata", async () => {
    fake.firstTouch = { source: 'tiktok', campaign: 'rentree' };
    fake.affiliateSlug = 'bde-lyon';
    mount();
    await flush();
    journal.length = 0;
    await act(async () => {
      await current().register('Ana', 'ana@exemple.fr', 'motdepasse', 'business');
    });
    expect(journal).toEqual(['signUp']);
    expect(fake.signUpCalls[0]).toMatchObject({
      email: 'ana@exemple.fr',
      options: {
        data: {
          name: 'Ana',
          account_type: 'business',
          affiliate_slug: 'bde-lyon',
          acquisition_source: 'tiktok',
          acquisition_campaign: 'rentree',
        },
      },
    });
  });

  it('session jamais résolue : le chien de garde débloque à 12 s et le signale une fois', async () => {
    vi.useFakeTimers();
    fake.getSessionImpl = () => new Promise(() => {});
    mount();
    expect(current().isLoading).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(11_999);
    });
    expect(current().isLoading).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(current().isLoading).toBe(false);
    expect(journal).toEqual(['getSession', 'monitoring:message:auth: isLoading watchdog fired']);
  });

  it('session résolue à temps : le chien de garde se tait', async () => {
    vi.useFakeTimers();
    mount();
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(12_000);
    });
    expect(current().isLoading).toBe(false);
    expect(journal).toEqual(['getSession']);
  });
});
