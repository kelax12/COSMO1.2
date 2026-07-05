// ═══════════════════════════════════════════════════════════════════
// demo-metrics — comptage anonyme des visiteurs du mode démo et de leur
// conversion en compte réel (migration 055).
//
// Un UUID d'appareil est généré au premier loginDemo() et persiste dans
// localStorage sous une clé PRÉSERVÉE par clearDemoStorage (PRESERVE_KEYS
// dans repository.factory.ts) : chaque appareil ne compte qu'une fois,
// même s'il relance la démo. Quand ce même appareil ouvre ensuite une
// session authentifiée, la conversion est marquée côté serveur
// (auth.uid(), non forgeable) puis la clé est supprimée.
//
// Tout est fire-and-forget : l'analytics ne doit jamais bloquer ni faire
// échouer l'auth.
// ═══════════════════════════════════════════════════════════════════
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export const DEMO_DEVICE_ID_KEY = 'cosmo_demo_device_id';

function getOrCreateDeviceId(): string | null {
  try {
    let id = localStorage.getItem(DEMO_DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEMO_DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return null; // localStorage indisponible (Safari private…) — on ne compte pas
  }
}

/** À appeler à chaque loginDemo(). Idempotent par appareil (PK côté serveur). */
export function recordDemoVisit(): void {
  if (!isSupabaseConfigured) return;
  const id = getOrCreateDeviceId();
  if (!id) return;
  void supabase.rpc('record_demo_visit', { p_device_id: id }).then(({ error }) => {
    if (error) {
      // Silencieux : réessayera au prochain loginDemo (la clé reste en place).
    }
  });
}

/**
 * À appeler quand une session authentifiée s'ouvre. No-op si l'appareil n'a
 * jamais fait la démo. La clé est retirée après succès pour ne pas re-pinger
 * à chaque SIGNED_IN (la RPC est de toute façon idempotente).
 */
export function recordDemoConversionIfAny(): void {
  if (!isSupabaseConfigured) return;
  let id: string | null = null;
  try {
    id = localStorage.getItem(DEMO_DEVICE_ID_KEY);
  } catch {
    return;
  }
  if (!id) return;
  void supabase.rpc('record_demo_conversion', { p_device_id: id }).then(({ error }) => {
    if (!error) {
      try {
        localStorage.removeItem(DEMO_DEVICE_ID_KEY);
      } catch { /* ignore */ }
    }
  });
}
