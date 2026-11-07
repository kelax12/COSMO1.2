// ═══════════════════════════════════════════════════════════════════
// ORG-CONFIG : sélection du dépôt (démo / Supabase).
//
// ⚠️ Volontairement HORS de `repository.factory.ts` : ce fichier est dans le
// chunk d'ENTRÉE, payé par tout visiteur, landing comprise. Ces écrans
// d'administration ne se chargent qu'à la demande : leur sélecteur aussi.
// Même mécanisme que le factory (`defineRepository`, V12.3) : un changement de
// mode oublie le dépôt choisi (faille B20), et les deux côtés arrivent par
// `import()`.
// ═══════════════════════════════════════════════════════════════════
import { defineRepository, lazy } from '@/lib/define-repository';
import type { IOrgConfigRepository } from './repository';

export const getOrgConfigRepository = defineRepository<IOrgConfigRepository>(
  lazy(() => import('./local.repository').then((m) => new m.LocalStorageOrgConfigRepository())),
  lazy(() => import('./supabase.repository').then((m) => new m.SupabaseOrgConfigRepository())),
);
