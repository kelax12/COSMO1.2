// ═══════════════════════════════════════════════════════════════════
// Événements de session : ce que `AuthProvider` annonce, et à qui
// ═══════════════════════════════════════════════════════════════════
//
// ARC-03 (V12.4) : `AuthContext` portait huit responsabilités dans un seul
// effet. Il ne garde que l'authentification, et ANNONCE les moments de la
// session ; le cache hors ligne, les préchargements, `last_seen` et
// l'attribution s'y abonnent, chacun dans son fichier.
//
// 🔴 L'ÉMISSION EST SYNCHRONE ET SUIT L'ORDRE D'ABONNEMENT. C'est voulu :
// l'ordre des effets de session est un contrat (le cache doit être réchauffé
// AVANT le préchargement, effacé AVANT le vidage de React Query). L'ordre
// d'abonnement est celui des appels de hooks dans `AuthProvider`, et
// `AuthContext.sequence.test.tsx` le vérifie de bout en bout.
//
// ⚠️ Pas de `try/catch` autour des écouteurs : avant la coupe, une exception
// dans `touchLastSeen` interrompait la suite de la séquence et remontait au
// `catch` de `initializeAuth`. Ce comportement est conservé tel quel.
//
// ❌ Ce n'est PAS un contexte React : l'émetteur appartient à une instance
// d'`AuthProvider` et se passe en argument. Aucun module ne peut s'y brancher
// de l'extérieur (garde-fou « pas de façade globale » du CLAUDE.md racine).

import type { User as SupabaseUser } from '@supabase/supabase-js';

export interface AuthEventMap {
  /**
   * Une session réelle est connue pour cet utilisateur : `getSession`,
   * `INITIAL_SESSION`, puis chaque événement porteur d'une session
   * (`SIGNED_IN`, rafraîchissement de jeton…). Émis APRÈS `setUser`.
   */
  sessionOpened: SupabaseUser;
  /**
   * Les données de cet utilisateur deviennent la portée courante.
   * `initial` : ouverture au démarrage (getSession / INITIAL_SESSION), où
   * le cache n'a pas été vidé ; sinon changement d'identité, juste après le
   * vidage de React Query.
   */
  dataScopeOpened: { userId: string; initial: boolean };
  /** Cet utilisateur quitte la session (déconnexion ou changement de compte). */
  userLeaving: string;
  /** `SIGNED_OUT` reçu de Supabase. */
  signedOut: undefined;
}

export type AuthEventName = keyof AuthEventMap;
export type AuthListeners = { [K in AuthEventName]?: (payload: AuthEventMap[K]) => void };

export interface AuthEvents {
  /** Abonne un jeu d'écouteurs ; rend la fonction de désabonnement. */
  subscribe(listeners: AuthListeners): () => void;
  emit<K extends AuthEventName>(name: K, payload: AuthEventMap[K]): void;
}

export function createAuthEvents(): AuthEvents {
  // Un `Set` itère dans l'ordre d'insertion, et un jeu retiré PENDANT une
  // émission n'est plus visité sans décaler les suivants.
  const subscribers = new Set<AuthListeners>();
  return {
    subscribe(listeners) {
      subscribers.add(listeners);
      return () => {
        subscribers.delete(listeners);
      };
    },
    emit(name, payload) {
      for (const listeners of subscribers) {
        const listener = listeners[name] as ((value: typeof payload) => void) | undefined;
        listener?.(payload);
      }
    },
  };
}
