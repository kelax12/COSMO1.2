import { Skeleton } from '@/components/ui/skeleton';
import { useT } from '@/i18n/useT';

/**
 * Skeletons — placeholders affichés pendant le chargement initial des données.
 * Préférer à un spinner : perçu plus rapide, donne une preview de la structure finale.
 */

/**
 * Maquette 47 — « Le chargement a la forme du résultat ».
 *
 * ⚠️ Ce squelette a cessé d'avoir la forme du résultat le 2026-09-05, quand les
 * lignes de tâches ont perdu leur carte : il continuait à dessiner un cadre
 * arrondi sur fond `surface` là où la liste rend des lignes à plat séparées par
 * un filet. Un squelette qui annonce une autre mise en page fait sauter l'écran
 * au moment où les données arrivent — c'est précisément ce qu'il existe pour
 * éviter. Il reprend donc, sur mobile, les mesures EXACTES de `TaskCard` :
 * `px-3 py-2.5`, hauteur minimale 60 px, barre de catégorie de 4 px, pastille
 * de 24 px, deux lignes de texte, filet en bas.
 *
 * Desktop (`md:`) garde son rendu en carte, inchangé.
 */
export function TaskCardSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 min-h-[60px] border-b border-[rgb(var(--color-border))] md:min-h-0 md:p-3 md:rounded-xl md:border md:bg-[rgb(var(--color-surface))]">
      <Skeleton className="w-1 self-stretch rounded-full shrink-0 md:h-10 md:self-auto" />
      <Skeleton className="w-6 h-6 rounded-full shrink-0 md:w-5 md:h-5 md:rounded-md" />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="w-8 h-6 rounded-md shrink-0" />
    </div>
  );
}

export function TaskListSkeleton({ count = 6 }: { count?: number }) {
  const { t } = useT('common');
  return (
    <div className="space-y-0 md:space-y-2" role="status" aria-label={t('loadingLabel.tasks')}>
      {Array.from({ length: count }).map((_, i) => (
        // « … et s'estompe vers le bas » : l'opacité décroît ligne à ligne, ce
        // qui dit que la liste continue au-delà du dernier placeholder au lieu
        // de promettre exactement six éléments. Plancher à 0,15 pour que la
        // dernière ligne reste perceptible.
        <div key={i} style={{ opacity: Math.max(0.15, 1 - i * 0.15) }}>
          <TaskCardSkeleton />
        </div>
      ))}
    </div>
  );
}

export function HabitCardSkeleton() {
  return (
    <div className="p-4 rounded-2xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <Skeleton className="w-12 h-6 rounded-full shrink-0" />
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="flex-1 h-6 rounded-md" />
        ))}
      </div>
    </div>
  );
}

export function HabitListSkeleton({ count = 4 }: { count?: number }) {
  const { t } = useT('common');
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3" role="status" aria-label={t('loadingLabel.habits')}>
      {Array.from({ length: count }).map((_, i) => (
        <HabitCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function OKRCardSkeleton() {
  return (
    <div className="p-5 rounded-2xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <Skeleton className="w-14 h-14 rounded-full shrink-0" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="w-5 h-5 rounded-md shrink-0" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="w-12 h-4 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function OKRListSkeleton({ count = 4 }: { count?: number }) {
  const { t } = useT('common');
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" role="status" aria-label={t('loadingLabel.okrs')}>
      {Array.from({ length: count }).map((_, i) => (
        <OKRCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function DashboardCardSkeleton() {
  return (
    <div className="card-plain-mobile p-gutter md:p-6 rounded-3xl space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="flex gap-2">
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-4 flex-1" />
        <Skeleton className="h-4 flex-1" />
      </div>
    </div>
  );
}
