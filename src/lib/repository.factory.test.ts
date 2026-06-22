// ═══════════════════════════════════════════════════════════════════
// repository.factory — sélection démo/prod + invariants des singletons.
//
// Pourquoi ce test (audit dette §9.1) : la factory est la frontière qui
// route TOUT accès données vers LocalStorage (démo) ou Supabase (prod).
// Une régression silencieuse (ex. un getter qui ne relit pas le flag, ou
// un singleton stale après flip de mode — faille B20) ferait écrire les
// données démo dans la prod ou inversement. On verrouille donc :
//   1. demo  → impl LocalStorage pour chaque repo ;
//   2. prod  → impl Supabase pour chaque repo ;
//   3. flip de mode → auto-reset des singletons (subscribe) ;
//   4. resetRepositories() → ré-instanciation propre.
// ═══════════════════════════════════════════════════════════════════
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { appModeStore } from './app-mode.store';
import {
  getTasksRepository,
  getHabitsRepository,
  getEventsRepository,
  getCategoriesRepository,
  getListsRepository,
  getFriendsRepository,
  getOKRsRepository,
  getKRCompletionsRepository,
  isInDemoMode,
  resetRepositories,
} from './repository.factory';

import { LocalStorageTasksRepository } from '@/modules/tasks/local.repository';
import { SupabaseTasksRepository } from '@/modules/tasks/supabase.repository';
import { LocalStorageHabitsRepository } from '@/modules/habits/local.repository';
import { SupabaseHabitsRepository } from '@/modules/habits/supabase.repository';
import { SupabaseEventsRepository } from '@/modules/events/supabase.repository';
import { SupabaseOKRsRepository } from '@/modules/okrs/supabase.repository';

// Map getter → (classe attendue en démo, classe attendue en prod). Pour les
// repos dont l'impl LocalStorage vit dans repository.ts (pas un fichier
// dédié) on se contente d'asserter le nom de constructeur, suffisant pour
// détecter un mauvais aiguillage.
const GETTERS = [
  getTasksRepository,
  getHabitsRepository,
  getEventsRepository,
  getCategoriesRepository,
  getListsRepository,
  getFriendsRepository,
  getOKRsRepository,
  getKRCompletionsRepository,
] as const;

describe('repository.factory', () => {
  beforeEach(() => {
    resetRepositories();
  });

  afterEach(() => {
    // Remet le store dans son état initial (démo par défaut hors env Supabase)
    // pour ne pas faire fuiter de mode entre tests.
    appModeStore.setDemo(true);
    resetRepositories();
  });

  it('demo → toutes les impls sont des LocalStorage*', () => {
    appModeStore.setDemo(true);
    expect(isInDemoMode()).toBe(true);
    for (const get of GETTERS) {
      expect(get().constructor.name).toMatch(/^LocalStorage/);
    }
    // Vérifs nominales fortes sur les deux repos à fichier dédié.
    expect(getTasksRepository()).toBeInstanceOf(LocalStorageTasksRepository);
    expect(getHabitsRepository()).toBeInstanceOf(LocalStorageHabitsRepository);
  });

  it('prod → toutes les impls sont des Supabase*', () => {
    appModeStore.setDemo(false);
    expect(isInDemoMode()).toBe(false);
    for (const get of GETTERS) {
      expect(get().constructor.name).toMatch(/^Supabase/);
    }
    expect(getTasksRepository()).toBeInstanceOf(SupabaseTasksRepository);
    expect(getHabitsRepository()).toBeInstanceOf(SupabaseHabitsRepository);
    expect(getEventsRepository()).toBeInstanceOf(SupabaseEventsRepository);
    expect(getOKRsRepository()).toBeInstanceOf(SupabaseOKRsRepository);
  });

  it('renvoie le même singleton tant que le mode ne change pas', () => {
    appModeStore.setDemo(false);
    const a = getTasksRepository();
    const b = getTasksRepository();
    expect(a).toBe(b);
  });

  it('flip de mode → auto-reset des singletons (faille B20)', () => {
    appModeStore.setDemo(false);
    const prodRepo = getTasksRepository();
    expect(prodRepo).toBeInstanceOf(SupabaseTasksRepository);

    // Le subscribe interne de la factory doit avoir nullifié les singletons :
    // le prochain getter renvoie une impl démo, pas l'ancienne instance prod.
    appModeStore.setDemo(true);
    const demoRepo = getTasksRepository();
    expect(demoRepo).toBeInstanceOf(LocalStorageTasksRepository);
    expect(demoRepo).not.toBe(prodRepo);
  });

  it('resetRepositories() force une ré-instanciation', () => {
    appModeStore.setDemo(false);
    const first = getHabitsRepository();
    resetRepositories();
    const second = getHabitsRepository();
    expect(second).not.toBe(first);
    expect(second).toBeInstanceOf(SupabaseHabitsRepository);
  });
});
