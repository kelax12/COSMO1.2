import { format, parseISO } from 'date-fns';
import { getDateLocale } from '@/i18n/format';
import type { TeamTask } from '@/modules/team-projects';
import { isOverdue } from './my-work.helpers';


interface KpiStripProps {
  waiting: number;
  open: number;
  overdue: number;
  nextDeadline: TeamTask | null;
  labels: { waiting: string; open: string; overdue: string; next: string; upToDate: string };
}

const TILE = 'min-w-0 rounded-xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] px-4 py-3';
const LABEL = 'block text-xs text-[rgb(var(--color-text-secondary))] truncate';
const VALUE = 'block text-2xl font-bold tabular-nums leading-tight mt-0.5';

/**
 * Bandeau de chiffres en tête de l'Aperçu (maquette A, 2026-09-28) : les
 * quatre réponses qu'on vient chercher avant de lire une liste. Une tuile à 0
 * reste neutre, la couleur ne marque que ce qui demande un geste.
 */
export const KpiStrip = ({ waiting, open, overdue, nextDeadline, labels }: KpiStripProps) => {
  const late = !!nextDeadline && isOverdue(nextDeadline);
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div className={TILE}>
        <span className={LABEL}>{labels.waiting}</span>
        <span className={`${VALUE} ${waiting > 0 ? 'text-amber-500' : 'text-[rgb(var(--color-text-primary))]'}`}>{waiting}</span>
      </div>
      <div className={TILE}>
        <span className={LABEL}>{labels.open}</span>
        <span className={`${VALUE} text-[rgb(var(--color-text-primary))]`}>{open}</span>
      </div>
      <div className={TILE}>
        <span className={LABEL}>{labels.overdue}</span>
        <span className={`${VALUE} ${overdue > 0 ? 'text-red-500' : 'text-[rgb(var(--color-text-primary))]'}`}>{overdue}</span>
      </div>
      <div className={TILE}>
        <span className={LABEL}>{labels.next}</span>
        {nextDeadline?.deadline ? (
          <>
            <time
              dateTime={nextDeadline.deadline}
              className={`block text-base font-bold leading-tight mt-1 ${late ? 'text-red-500' : 'text-[rgb(var(--color-accent))]'}`}
            >
              {format(parseISO(nextDeadline.deadline), 'd MMMM', { locale: getDateLocale() })}
            </time>
            <span className="block text-xs text-[rgb(var(--color-text-primary))] truncate mt-0.5">{nextDeadline.name}</span>
          </>
        ) : (
          <span className="block text-base font-bold leading-tight mt-1 text-[rgb(var(--color-text-muted))]">{labels.upToDate}</span>
        )}
      </div>
    </div>
  );
};
