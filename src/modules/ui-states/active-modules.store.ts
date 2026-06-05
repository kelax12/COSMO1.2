// ═══════════════════════════════════════════════════════════════════
// Active Modules Store — AM10 (onboarding progressif / simple vs avancé)
// ═══════════════════════════════════════════════════════════════════
//
// Source de vérité pour les modules optionnels visibles dans la navigation.
// Dashboard + Tâches sont TOUJOURS actifs (socle non désactivable, dépendances
// tâches↔agenda↔dashboard). Seuls Agenda / Habitudes / OKR / Statistiques
// sont optionnels.
//
// Persistance : localStorage (clé `cosmo_active_modules`). Défaut = tout actif
// (rétro-compatibilité : un utilisateur existant ne perd aucun onglet).
//
// En mode démo, on force TOUS les modules actifs (la démo reste full — voir
// AM10 : « Garder le mode démo full (tout activé) inchangé »).

import { useSyncExternalStore } from 'react';
import { appModeStore } from '@/lib/app-mode.store';

export type ModuleKey = 'agenda' | 'habits' | 'okr' | 'statistics';

/** Modules optionnels, dans l'ordre d'affichage de l'onboarding. */
export const OPTIONAL_MODULES: ModuleKey[] = ['agenda', 'habits', 'okr', 'statistics'];

const STORAGE_KEY = 'cosmo_active_modules';

/** Flag de complétion de l'onboarding « choix des modules » (1er login réel). */
export const MODULE_ONBOARDING_DONE_KEY = 'cosmo_onboarding_modules_done';

const ALL_ACTIVE: Record<ModuleKey, boolean> = {
  agenda: true,
  habits: true,
  okr: true,
  statistics: true,
};

type ActiveModulesListener = () => void;

class ActiveModulesStore {
  private listeners: Set<ActiveModulesListener> = new Set();
  // Snapshot stable pour useSyncExternalStore (évite les boucles de re-render).
  private snapshot: Record<ModuleKey, boolean> = this.read();

  private read(): Record<ModuleKey, boolean> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...ALL_ACTIVE };
      const parsed = JSON.parse(raw) as Partial<Record<ModuleKey, boolean>>;
      return {
        agenda: parsed.agenda ?? true,
        habits: parsed.habits ?? true,
        okr: parsed.okr ?? true,
        statistics: parsed.statistics ?? true,
      };
    } catch {
      return { ...ALL_ACTIVE };
    }
  }

  /**
   * Snapshot courant. En démo → tout actif (référence stable `ALL_ACTIVE`
   * pour ne pas déclencher de re-render en boucle).
   */
  getSnapshot = (): Record<ModuleKey, boolean> => {
    if (appModeStore.isDemo) return ALL_ACTIVE;
    return this.snapshot;
  };

  isActive(key: ModuleKey): boolean {
    return this.getSnapshot()[key];
  }

  setActiveModules(value: Record<ModuleKey, boolean>): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // localStorage plein — ignore
    }
    this.snapshot = { ...value };
    this.listeners.forEach((fn) => fn());
  }

  setModule(key: ModuleKey, active: boolean): void {
    this.setActiveModules({ ...this.read(), [key]: active });
  }

  subscribe = (listener: ActiveModulesListener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
}

export const activeModulesStore = new ActiveModulesStore();

/** Helpers impératifs (hors React). */
export const getActiveModules = (): Record<ModuleKey, boolean> => activeModulesStore.getSnapshot();
export const setActiveModules = (value: Record<ModuleKey, boolean>): void =>
  activeModulesStore.setActiveModules(value);
export const isModuleActive = (key: ModuleKey): boolean => activeModulesStore.isActive(key);

export const isModuleOnboardingDone = (): boolean => {
  try {
    return localStorage.getItem(MODULE_ONBOARDING_DONE_KEY) === '1';
  } catch {
    return true; // En cas d'erreur, ne pas bloquer l'utilisateur avec l'onboarding.
  }
};

export const markModuleOnboardingDone = (): void => {
  try {
    localStorage.setItem(MODULE_ONBOARDING_DONE_KEY, '1');
  } catch {
    /* ignore */
  }
};

/**
 * Hook React réactif — record des modules optionnels actifs.
 * Se met à jour sur changement de préférence ET sur changement de mode démo.
 */
export const useActiveModules = (): Record<ModuleKey, boolean> => {
  return useSyncExternalStore(
    (callback) => {
      const unsubStore = activeModulesStore.subscribe(callback);
      const unsubMode = appModeStore.subscribe(callback);
      return () => {
        unsubStore();
        unsubMode();
      };
    },
    activeModulesStore.getSnapshot,
    () => ALL_ACTIVE,
  );
};
