import { useCallback, useEffect, useState } from 'react';
import { useIsDemo } from '@/lib/app-mode.store';
import { isDemoEngaged, startDemoSession, DURATION_THRESHOLD_MS } from '@/lib/demo-engagement';

/**
 * Report du pont démo → compte, en millisecondes epoch.
 *
 * ⚠️ Cette clé est dans PRESERVE_KEYS (repository.factory.ts) : elle DOIT
 * survivre à clearDemoStorage(). Sans ça, un visiteur qui ferme la carte puis
 * relance la démo la reverrait aussitôt — exactement le bug B05 déjà corrigé
 * pour le consentement cookies.
 */
export const DEMO_BRIDGE_SNOOZE_KEY = 'cosmo_demo_bridge_snooze';

const SNOOZE_MS = 24 * 60 * 60 * 1000;

/** Cadence de vérification du seuil de durée — assez fine pour 90 s, assez
 *  large pour ne rien coûter. */
const TICK_MS = 5000;

function isSnoozed(): boolean {
  try {
    const raw = localStorage.getItem(DEMO_BRIDGE_SNOOZE_KEY);
    if (!raw) return false;
    const until = Number.parseInt(raw, 10);
    if (!Number.isFinite(until)) return false;
    return Date.now() < until;
  } catch {
    // localStorage indisponible : on se tait plutôt que d'insister à chaque
    // page, faute de pouvoir mémoriser un refus.
    return true;
  }
}

/**
 * Pilote l'invitation à créer un compte depuis le mode démo.
 *
 * Ne s'affiche jamais pour un utilisateur authentifié réel : la seule source
 * de vérité du mode démo est `useIsDemo()` (jamais l'email — faille B0).
 */
export function useDemoBridge() {
  const isDemo = useIsDemo();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isDemo) {
      setVisible(false);
      return;
    }
    startDemoSession();

    const check = () => {
      if (isSnoozed()) return false;
      if (!isDemoEngaged()) return false;
      setVisible(true);
      return true;
    };

    // Le seuil « 3ᵉ création » peut déjà être franchi au montage (navigation
    // SPA entre deux pages) — on teste avant d'armer le minuteur.
    if (check()) return;

    const timer = window.setInterval(() => {
      if (check()) window.clearInterval(timer);
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [isDemo]);

  const snooze = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(DEMO_BRIDGE_SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    } catch {
      /* ignore — la carte ne réapparaîtra de toute façon pas dans cette vue */
    }
  }, []);

  return { visible, snooze, durationThresholdMs: DURATION_THRESHOLD_MS };
}
