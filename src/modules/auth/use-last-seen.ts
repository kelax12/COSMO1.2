// ═══════════════════════════════════════════════════════════════════
// Dernière connexion : `touch_last_seen` à l'ouverture d'une session réelle
// ═══════════════════════════════════════════════════════════════════
//
// Ping fire-and-forget de la RPC `touch_last_seen()` (migration 054,
// timestamp pris côté serveur). Dédupliqué par utilisateur et par chargement
// de page : Supabase refire SIGNED_IN à chaque refresh de token, on ne veut
// écrire qu'à l'ouverture de session, pas toutes les heures.
//
// Extrait d'`AuthContext.tsx` (ARC-03), sans changement de
// condition ni de moment : abonné à `sessionOpened` et `signedOut`.

import { useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { appModeStore } from '@/lib/app-mode.store';
import { recordDemoConversionIfAny } from '@/lib/demo-metrics';
import { dlog } from './auth-debug';
import type { AuthEvents } from './auth-events';

const lastSeenTouched = new Set<string>();

export function touchLastSeen(userId: string): void {
  if (!isSupabaseConfigured || appModeStore.isDemo || lastSeenTouched.has(userId)) return;
  lastSeenTouched.add(userId);
  supabase.rpc('touch_last_seen').then(({ error }) => {
    if (error) dlog(`touchLastSeen: ${error.message}`);
  });
  // Même moment « session réelle ouverte » : si cet appareil a testé la démo,
  // on marque la conversion démo → compte (no-op sinon, cf. demo-metrics.ts).
  recordDemoConversionIfAny();
}

/** Un re-login dans le même chargement de page doit re-pinger last_seen_at. */
export function resetLastSeen(): void {
  lastSeenTouched.clear();
}

export function useLastSeen(events: AuthEvents): void {
  useEffect(
    () =>
      events.subscribe({
        sessionOpened: (sessionUser) => touchLastSeen(sessionUser.id),
        signedOut: resetLastSeen,
      }),
    [events],
  );
}
