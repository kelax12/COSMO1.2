// Barrel du module today (item #29) — vue de lecture, aucune écriture propre.
export type { TodayItem, TodaySource } from './types';
export { mergeTodayItems, localYMD } from './today.helpers';
export { useTodayItems, type UseTodayItemsResult } from './hooks';
