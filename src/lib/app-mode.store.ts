// ═══════════════════════════════════════════════════════════════════
// App Mode Store — Source de vérité unique pour le mode démo/prod
// ═══════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from 'react';

type ModeChangeListener = (isDemo: boolean) => void;

class AppModeStore {
  private _isDemo: boolean;
  private listeners: Set<ModeChangeListener> = new Set();

  constructor(initialDemo: boolean) {
    this._isDemo = initialDemo;
  }

  get isDemo(): boolean {
    return this._isDemo;
  }

  setDemo(value: boolean): void {
    if (this._isDemo === value) return; // Pas de changement → pas de notification
    this._isDemo = value;
    this.listeners.forEach(fn => fn(value));
  }

  subscribe(listener: ModeChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener); // Retourne un unsubscribe
  }
}

// Singleton — initialisé selon la présence des variables d'env
const hasSupabaseConfig = !!(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_ANON_KEY &&
  import.meta.env.VITE_SUPABASE_URL !== 'undefined'
);

export const appModeStore = new AppModeStore(!hasSupabaseConfig);

/**
 * Hook React — retourne true si l'app est en mode démo
 * Se synchronise automatiquement avec les changements de mode
 */
export const useIsDemo = (): boolean => {
  return useSyncExternalStore(
    (callback) => appModeStore.subscribe(callback),
    () => appModeStore.isDemo,
    () => true // Snapshot serveur : démo par défaut
  );
};
