// ═══════════════════════════════════════════════════════════════════
// demo-engagement — mesure de l'engagement d'un visiteur en mode démo.
//
// Sert à choisir le MOMENT où proposer la création de compte. Le mode démo
// capte les visiteurs les plus motivés (100 tâches, 100 habitudes, 150
// événements pré-remplis) et ne les rend jamais : la table `demo_devices`
// montre 1 à 7 appareils/semaine pour une conversion quasi nulle.
//
// Le pari : proposer APRÈS que le visiteur se soit approprié l'outil convertit
// mieux qu'une sollicitation à l'ouverture, parce qu'il a alors quelque chose
// à perdre. D'où deux seuils, au premier atteint :
//   - 90 s d'usage démo, ou
//   - la 3ᵉ création (tâche / habitude / événement / OKR).
//
// Le compteur vit dans localStorage sous une clé `cosmo_*` VOLONTAIREMENT
// balayée par clearDemoStorage() : une nouvelle session démo est un nouveau
// visiteur, son engagement repart de zéro. C'est l'inverse du flag de rejet
// (cosmo_demo_bridge_snooze), lui préservé — voir PRESERVE_KEYS.
// ═══════════════════════════════════════════════════════════════════

import { appModeStore } from '@/lib/app-mode.store';

const CREATIONS_KEY = 'cosmo_demo_creations';
const STARTED_AT_KEY = 'cosmo_demo_started_at';

/** Seuils d'engagement — au premier atteint. */
export const CREATIONS_THRESHOLD = 3;
export const DURATION_THRESHOLD_MS = 90 * 1000;

function readInt(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

/**
 * Marque le début de la session démo. Idempotent : rappelé à chaque montage,
 * il ne réarme pas le chrono d'un visiteur déjà en cours de session.
 */
export function startDemoSession(): void {
  try {
    if (!localStorage.getItem(STARTED_AT_KEY)) {
      localStorage.setItem(STARTED_AT_KEY, String(Date.now()));
    }
  } catch {
    /* localStorage indisponible — on retombera sur le seuil de créations. */
  }
}

/** Millisecondes écoulées depuis le début de la session démo (0 si inconnue). */
export function demoElapsedMs(): number {
  const startedAt = readInt(STARTED_AT_KEY);
  if (!startedAt) return 0;
  const elapsed = Date.now() - startedAt;
  // Une horloge reculée (changement de fuseau, correction NTP) donnerait un
  // écart négatif : on ne veut pas d'un seuil qui ne se déclenche jamais.
  return elapsed > 0 ? elapsed : 0;
}

/** Nombre de créations faites pendant cette session démo. */
export function demoCreationCount(): number {
  return readInt(CREATIONS_KEY);
}

/**
 * Incrémente le compteur de créations. No-op hors mode démo — l'appelant
 * garde la responsabilité de ne l'appeler qu'en démo (cf. les hooks create).
 */
export function recordDemoCreation(): void {
  try {
    localStorage.setItem(CREATIONS_KEY, String(demoCreationCount() + 1));
  } catch {
    /* localStorage indisponible — le seuil de durée reste opérant. */
  }
}

/**
 * Variante gardée, destinée aux `onSuccess` des hooks de création.
 *
 * Le garde vit ICI et non chez l'appelant pour que les modules métier n'aient
 * qu'une ligne à porter, et pour qu'on ne puisse pas oublier le test de mode :
 * hors démo, le compteur ne doit jamais bouger. Source de vérité du mode démo
 * = `appModeStore` (jamais l'email — faille B0).
 */
export function recordDemoCreationIfDemo(): void {
  if (!appModeStore.isDemo) return;
  recordDemoCreation();
}

/** `true` dès qu'un des deux seuils est franchi. */
export function isDemoEngaged(): boolean {
  return demoCreationCount() >= CREATIONS_THRESHOLD || demoElapsedMs() >= DURATION_THRESHOLD_MS;
}
