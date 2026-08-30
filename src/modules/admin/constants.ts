// Clés React Query du module admin.
export const adminKeys = {
  all: ['admin'] as const,
  stats: () => [...adminKeys.all, 'stats'] as const,
  isAdmin: () => [...adminKeys.all, 'is-admin'] as const,
  mfa: () => [...adminKeys.all, 'mfa'] as const,
};

/**
 * Objectifs du plan d'acquisition 30 jours (2026-08-13). Servent de cadre de
 * lecture aux courbes cumulées : sans eux, un axe auto-scalé donne l'illusion
 * d'être arrivé. `orgs` se compte en organisations de ≥ 3 membres.
 */
export const ACQUISITION_GOALS = {
  users: 1000,
  orgs: 10,
} as const;
