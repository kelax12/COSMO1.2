import { useEffect, useState } from 'react';
import { differenceInCalendarDays, parseISO } from 'date-fns';

/** Teintes et pagination partagées par les formats compacts de l'Aperçu. */

export type WidgetTone = 'neutral' | 'danger' | 'warning' | 'success' | 'accent';

export const TONE_BADGE: Record<WidgetTone, string> = {
  neutral: 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))]',
  danger: 'bg-red-500/15 text-red-700 dark:text-red-300',
  warning: 'bg-amber-500/15 text-amber-800 dark:text-amber-300', // AM-5 : amber-700 rendait 4,46:1 sur sa teinte
  success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  accent: 'bg-[rgb(var(--color-accent)/0.12)] text-[rgb(var(--color-accent-text))]',
};

export const TONE_TEXT: Record<WidgetTone, string> = {
  neutral: 'text-[rgb(var(--color-text-primary))]',
  danger: 'text-red-600 dark:text-red-400',
  warning: 'text-amber-600 dark:text-amber-400',
  success: 'text-emerald-600 dark:text-emerald-400',
  accent: 'text-[rgb(var(--color-accent))]',
};

/** Pagination locale : `perPage` éléments par page, recalée si la liste rétrécit. */
export function usePager<T>(items: readonly T[], perPage: number) {
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const [page, setPage] = useState(0);
  useEffect(() => { if (page > pages - 1) setPage(pages - 1); }, [page, pages]);
  const current = Math.min(page, pages - 1);
  return {
    page: current,
    pages,
    slice: items.slice(current * perPage, current * perPage + perPage),
    prev: () => setPage((p) => Math.max(0, p - 1)),
    next: () => setPage((p) => Math.min(pages - 1, p + 1)),
  };
}

export type Pager = ReturnType<typeof usePager>;

/** Retard en jours d'une échéance 'YYYY-MM-DD' ; 0 si à jour ou sans date. */
export const lateDays = (deadline?: string | null, now: Date = new Date()): number => {
  if (!deadline) return 0;
  return Math.max(0, differenceInCalendarDays(now, parseISO(deadline)));
};
