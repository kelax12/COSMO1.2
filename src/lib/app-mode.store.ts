// ═══════════════════════════════════════════════════════════════════
// App Mode Store — Source de vérité unique pour le mode démo/prod
// ═══════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from 'react';

type ModeChangeListener = (isDemo: boolean) => void;

// Persistance de la session démo : sans ce flag, un simple F5 déconnectait
// l'utilisateur démo (état mémoire seulement) et la ré-entrée via loginDemo()
// effaçait toutes ses données (clearDemoStorage). Le flag est posé/retiré par
// setDemo() ; loginDemo() le repose APRÈS son clearDemoStorage() (qui balaye
// cosmo_* — ordre garanti par la séquence documentée dans CLAUDE.md).
const DEMO_ACTIVE_KEY = 'cosmo_demo_active';

/** true si une session démo a été explicitement ouverte puis persistée. */
export const wasDemoPersisted = (): boolean => {
  try { return localStorage.getItem(DEMO_ACTIVE_KEY) === '1'; } catch { return false; }
};

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
    // Persistance idempotente AVANT le guard : loginDemo() appelle setDemo(true)
    // alors que _isDemo est déjà true après un reload restauré — sans écriture
    // ici, le flag balayé par clearDemoStorage() ne serait jamais reposé.
    try {
      if (value) localStorage.setItem(DEMO_ACTIVE_KEY, '1');
      else localStorage.removeItem(DEMO_ACTIVE_KEY);
    } catch { /* ignore (mode privé) */ }
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

// Restaure la session démo persistée (F5 pendant une démo) en plus du mode
// démo « forcé » quand les variables Supabase sont absentes.
export const appModeStore = new AppModeStore(!hasSupabaseConfig || wasDemoPersisted());

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
