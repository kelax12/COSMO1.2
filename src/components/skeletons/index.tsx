import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeletons — placeholders affichés pendant le chargement initial des données.
 * Préférer à un spinner : perçu plus rapide, donne une preview de la structure finale.
 */

export function TaskCardSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]">
      <Skeleton className="w-1 h-10 rounded-full shrink-0" />
      <Skeleton className="w-5 h-5 rounded-md shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="w-8 h-6 rounded-md shrink-0" />
    </div>
  );
}

export function TaskListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Chargement des tâches">
      {Array.from({ length: count }).map((_, i) => (
        <TaskCardSkeleton key={i} />
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
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3" role="status" aria-label="Chargement des habitudes">
      {Array.from({ length: count }).map((_, i) => (
        <HabitCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function DashboardCardSkeleton() {
  return (
    <div className="p-6 rounded-3xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] space-y-4">
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
