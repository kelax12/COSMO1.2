// ═══════════════════════════════════════════════════════════════════
// OKRS MODULE - Constants & Query Keys
// ═══════════════════════════════════════════════════════════════════

import { OKRFilters } from './types';

/**
 * LocalStorage key for persisting OKRs
 */
export const OKRS_STORAGE_KEY = 'cosmo-okrs-v3'; // v3 : completedAt forcé dans DEMO_OKRS

/**
 * React Query keys for OKRs
 * Centralized to prevent duplication and ensure consistent cache management
 */
export const okrsKeys = {
  all: ['okrs'] as const,
  lists: () => [...okrsKeys.all, 'list'] as const,
  list: (filters: OKRFilters) => [...okrsKeys.lists(), filters] as const,
  details: () => [...okrsKeys.all, 'detail'] as const,
  detail: (id: string) => [...okrsKeys.details(), id] as const,
  byCategory: (category: string) => [...okrsKeys.all, 'category', category] as const,
};
