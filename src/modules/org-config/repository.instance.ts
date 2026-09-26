// ═══════════════════════════════════════════════════════════════════
// ORG-CONFIG : sélection du dépôt (démo / Supabase).
//
// ⚠️ Volontairement HORS de `repository.factory.ts` : ce fichier est dans le
// chunk d'ENTRÉE, payé par tout visiteur, landing comprise. Ces écrans
// d'administration ne se chargent qu'à la demande : leur sélecteur aussi.
// Même règle que la factory (faille B20) : un changement de mode oublie le
// dépôt choisi, pour ne jamais écrire dans le mauvais backend.
// ═══════════════════════════════════════════════════════════════════
import { appModeStore } from '@/lib/app-mode.store';
import type { IOrgConfigRepository } from './repository';

let instance: IOrgConfigRepository | null = null;
let pending: Promise<IOrgConfigRepository> | null = null;
let pendingForDemo: boolean | null = null;

appModeStore.subscribe(() => {
  instance = null;
  pending = null;
});

const load = (): Promise<IOrgConfigRepository> => {
  const demo = appModeStore.isDemo;
  if (instance && pendingForDemo === demo) return Promise.resolve(instance);
  if (!pending || pendingForDemo !== demo) {
    pendingForDemo = demo;
    pending = (demo
      ? import('./local.repository').then((m) => new m.LocalStorageOrgConfigRepository())
      : import('./supabase.repository').then((m) => new m.SupabaseOrgConfigRepository())
    ).then((repo) => {
      instance = repo;
      return repo;
    });
  }
  return pending;
};

/** Mandataire 100 % asynchrone : chaque méthode attend le dépôt du mode courant. */
const proxy = new Proxy({} as IOrgConfigRepository, {
  get: (_t, prop) => {
    if (prop === 'then') return undefined;
    return (...args: unknown[]) =>
      load().then((repo) => (repo[prop as keyof IOrgConfigRepository] as (...a: unknown[]) => unknown).apply(repo, args));
  },
});

export const getOrgConfigRepository = (): IOrgConfigRepository => proxy;
