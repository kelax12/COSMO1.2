// ═══════════════════════════════════════════════════════════════════
// Suite de l'archive « Terminées » (V14.1, PER-01)
//
// Défilement infini ET bouton : la sentinelle charge la page suivante dès
// qu'elle approche de l'écran, le bouton reste là pour le clavier, un lecteur
// d'écran, ou un navigateur sans IntersectionObserver. Le compte affiché vient
// du SERVEUR (`useTaskCount`) : « 50 sur 1 240 » dit qu'il en reste, là où
// l'ancienne liste plafonnée se taisait.
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useRef } from 'react';
import { useT } from '@/i18n/useT';
import { useTaskCount, type TaskQuery } from '@/modules/tasks';

export interface ArchiveFeedState {
  hasMore: boolean;
  isFetchingMore: boolean;
  loadMore: () => void;
  /** Nombre de lignes perso affichées. */
  shown: number;
  /** Requête de l'archive filtrée : son total est compté ICI, côté serveur. */
  totalQuery?: TaskQuery;
}

export function ArchiveLoadMore({ hasMore, isFetchingMore, loadMore, shown, totalQuery }: ArchiveFeedState) {
  const { t, tp } = useT('tasks');
  // Compté ici et non dans la page : sa réponse ne redessine que ce bloc.
  const { data: total } = useTaskCount(totalQuery ?? { ids: [] }, { enabled: hasMore && !!totalQuery });
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingMore) loadMore();
      },
      { rootMargin: '400px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isFetchingMore, loadMore]);

  if (!hasMore) return null;

  return (
    <div ref={sentinel} className="pt-4 pb-2 flex flex-col items-center gap-1" data-testid="archive-load-more">
      {total !== undefined && (
        <p className="text-caption text-[rgb(var(--color-text-muted))]" aria-live="polite">
          {tp('table.archiveShown', shown, { total })}
        </p>
      )}
      <button
        type="button"
        onClick={loadMore}
        disabled={isFetchingMore}
        className="min-h-touch px-4 text-label font-semibold text-[rgb(var(--color-accent))] disabled:opacity-60"
      >
        {isFetchingMore ? t('table.archiveLoading') : t('table.archiveLoadMore')}
      </button>
    </div>
  );
}
