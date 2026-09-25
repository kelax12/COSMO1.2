import { lazyWithRetry } from '@/lib/lazy-with-retry';

/** Barre d'actions groupées, avec le catalogue `portfolio` qu'elle lit. */
export const TeamTasksBulkLayer = lazyWithRetry(() => import('./TeamTasksBulkLayer'), ['org', 'portfolio']);
