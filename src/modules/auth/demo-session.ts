// ═══════════════════════════════════════════════════════════════════
// Démo comme backend : entrer, sortir, restaurer après un F5
// ═══════════════════════════════════════════════════════════════════
//
// Les trois transitions du backend démo, sans React : `AuthProvider` les
// appelle puis pose lui-même l'utilisateur (`buildDemoUser`). La démo reste
// une responsabilité de l'authentification ; ce fichier n'en sort que les
// séquences, pour qu'elles s'écrivent une fois (la sortie était écrite deux
// fois, dans `login`/`register`/Google et dans `logout`).
//
// 🔴 L'ORDRE DE CHAQUE SÉQUENCE EST UN CONTRAT (src/modules/CLAUDE.md
// § loginDemo, `AuthContext.sequence.test.tsx`) : `clearDemoStorage` efface
// `cosmo_demo_active`, que `setDemo(true)` réécrit aussitôt ; vider React
// Query avant de réinitialiser les dépôts laisserait une requête repartir
// sur l'ancien backend.
//
// Extrait d'`AuthContext.tsx` le 2026-11-07 (ARC-03).

import type { QueryClient } from '@tanstack/react-query';
import { resetRepositories, clearDemoStorage } from '@/lib/repository.factory';
import { appModeStore, wasDemoPersisted } from '@/lib/app-mode.store';
import { recordDemoVisit } from '@/lib/demo-metrics';
import { resetDemoEngagementMemory } from '@/lib/demo-engagement';
import { recordSeedLocale, seedLocaleMatchesCurrent } from '@/lib/seed-i18n';
import { dlog } from './auth-debug';

/**
 * Session démo persistée (flag cosmo_demo_active) : un F5 pendant une démo
 * restaure l'utilisateur démo avec SES données (pas de clearDemoStorage ici,
 * seul un loginDemo() explicite réinitialise).
 * @returns vrai si une démo a été restaurée ; l'appelant pose l'utilisateur.
 */
export function restorePersistedDemoBackend(queryClient: QueryClient): boolean {
  if (!wasDemoPersisted()) return false;
  dlog('initializeAuth: restoring persisted demo session');
  // Langue changée depuis le seed (bascule FR↔EN, ou arrivée sur `/en`
  // après avoir lancé la démo depuis `/`) : les données en place sont
  // dans l'ancienne langue et ne se retraduisent pas (elles sont
  // modifiables, donc relues telles quelles). On les régénère, sinon
  // l'interface et le contenu parlent deux langues différentes.
  if (!seedLocaleMatchesCurrent()) {
    dlog('initializeAuth: demo seed locale stale, reseeding');
    clearDemoStorage(); // efface aussi cosmo_demo_active…
    appModeStore.setDemo(true); // …que ce setter réécrit aussitôt.
    resetRepositories();
    queryClient.clear();
    recordSeedLocale();
  }
  appModeStore.setDemo(true);
  return true;
}

/** `loginDemo()` : repart d'une démo neuve, seeds et profil compris. */
export function enterDemoBackend(queryClient: QueryClient): void {
  clearDemoStorage();
  // Repli EN MÉMOIRE des compteurs de démo (sans consentement) : remis à zéro
  // comme les clés que `clearDemoStorage()` vient d'effacer.
  resetDemoEngagementMemory();
  appModeStore.setDemo(true);
  resetRepositories();
  queryClient.clear();
  // Langue du seed qu'on vient d'invalider, relue au prochain démarrage
  // pour détecter un changement de langue (cf. restorePersistedDemoBackend).
  recordSeedLocale();
  // Compteur d'appareils distincts ayant testé la démo (fire-and-forget).
  recordDemoVisit();
}

/**
 * Quitte le backend démo. Sans ça, le flag démo persistant
 * (cosmo_demo_active) rendrait la démo « collante » : onAuthStateChange
 * ignore les événements tant que isDemo est vrai, et un reload restaurerait
 * la démo par-dessus la vraie session.
 */
export function exitDemoBackend(queryClient: QueryClient): void {
  clearDemoStorage();
  appModeStore.setDemo(false);
  resetRepositories();
  queryClient.clear();
}
