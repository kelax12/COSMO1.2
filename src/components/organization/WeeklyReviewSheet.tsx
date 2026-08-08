import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, TrendingUp, TrendingDown, Minus, CalendarClock, AlertTriangle, ArrowRight, Gauge } from 'lucide-react';
import { useOrgActivity, type TeamTask } from '@/modules/team-projects';
import type { OrgMember } from '@/modules/organizations';
import { formatDuration } from './team-projects.helpers';
import { buildWeeklyReview, reviewWindow } from './weekly-review.helpers';
import { useT } from '@/i18n/useT';

interface WeeklyReviewSheetProps {
  orgId: string;
  /** Tâches du périmètre du lecteur (admin : toute l'org ; manager : son sous-arbre). */
  tasks: TeamTask[];
  /** Membres du même périmètre. */
  members: OrgMember[];
  /** Ouvre une tâche dans l'onglet Projets — c'est ce qui fait la décision. */
  onOpenTask: (taskId: string) => void;
  onClose: () => void;
}

const Step = ({ index, title, children }: { index: number; title: string; children: React.ReactNode }) => (
  <section className="border-t border-[rgb(var(--color-border))] pt-4 first:border-t-0 first:pt-0">
    <h3 className="flex items-center gap-2 text-sm font-bold text-[rgb(var(--color-text-primary))] mb-3">
      <span className="w-5 h-5 rounded-full bg-[rgb(var(--color-hover))] text-caption font-bold flex items-center justify-center text-[rgb(var(--color-text-muted))] shrink-0">
        {index}
      </span>
      {title}
    </h3>
    {children}
  </section>
);

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs text-[rgb(var(--color-text-muted))] py-2">{children}</p>
);

/**
 * Revue hebdomadaire d'équipe (item #26).
 *
 * Un flux guidé en 4 étapes, pas un tableau de bord de plus : la 4ᵉ étape
 * produit des décisions cliquables. C'est la seule chose qui distingue une
 * revue d'une page de statistiques — sans elle, le manager repart avec des
 * chiffres et rien à faire de sa réunion.
 *
 * Tout le calcul est dans `weekly-review.helpers.ts`, testé.
 */
const WeeklyReviewSheet = ({ orgId, tasks, members, onOpenTask, onClose }: WeeklyReviewSheetProps) => {
  const { t, tp } = useT('org');

  // Borne STABLE d'un rendu à l'autre : elle entre dans la clé de cache de
  // `useOrgActivity`. Un `new Date()` recalculé à chaque rendu produirait une
  // requête par rendu.
  const since = useMemo(() => reviewWindow().lastWeekStart.toISOString(), []);
  const { data: activity = [] } = useOrgActivity(orgId, since);

  const review = useMemo(
    () => buildWeeklyReview(tasks, members, activity),
    [tasks, members, activity],
  );

  const { velocityChange } = review;
  const VelocityIcon = velocityChange === null || velocityChange === 0
    ? Minus
    : velocityChange > 0 ? TrendingUp : TrendingDown;
  const velocityTone = velocityChange === null || velocityChange === 0
    ? 'text-[rgb(var(--color-text-muted))]'
    : velocityChange > 0 ? 'text-emerald-500' : 'text-red-500';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-t-[24px] sm:rounded-2xl w-full sm:max-w-lg max-h-[88vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('weeklyReview.title')}
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-3 border-b border-[rgb(var(--color-border))] shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[rgb(var(--color-text-primary))]">
              {t('weeklyReview.title')}
            </h2>
            <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('weeklyReview.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] shrink-0"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {/* 1. Ce qui a avancé */}
          <Step index={1} title={t('weeklyReview.progressTitle')}>
            <div className="flex items-center gap-4">
              <p className="text-3xl font-bold text-[rgb(var(--color-text-primary))] tabular-nums">
                {review.completedThisWeek}
              </p>
              <div className="min-w-0">
                <p className={`text-sm font-semibold inline-flex items-center gap-1 ${velocityTone}`}>
                  <VelocityIcon size={15} aria-hidden="true" />
                  {/* `null` n'est pas 0 % : une équipe qui passe de 0 à 5 n'a
                      pas fait « +∞ % », il n'y a simplement rien à comparer. */}
                  {velocityChange === null
                    ? t('weeklyReview.noComparison')
                    : t('weeklyReview.vsLastWeek', { change: velocityChange > 0 ? `+${velocityChange}` : String(velocityChange) })}
                </p>
                <p className="text-xs text-[rgb(var(--color-text-muted))]">
                  {tp('weeklyReview.lastWeekCount', review.completedLastWeek)}
                </p>
              </div>
            </div>
          </Step>

          {/* 2. Ce qui a dérapé */}
          <Step index={2} title={t('weeklyReview.slippedTitle')}>
            {review.slipped.length === 0 ? (
              <Empty>{t('weeklyReview.slippedEmpty')}</Empty>
            ) : (
              <ul className="space-y-1.5">
                {review.slipped.map((s) => (
                  <li key={s.taskId}>
                    <button
                      type="button"
                      onClick={() => onOpenTask(s.taskId)}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-[rgb(var(--color-border))] hover:border-indigo-400 hover:bg-[rgb(var(--color-hover))] transition-colors text-left"
                    >
                      <CalendarClock size={15} className="text-amber-500 shrink-0" aria-hidden="true" />
                      <span className="text-sm text-[rgb(var(--color-text-primary))] flex-1 truncate">{s.name}</span>
                      <span className="text-caption text-[rgb(var(--color-text-muted))] tabular-nums shrink-0">
                        {s.from} → {s.to}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Step>

          {/* 3. Qui est en tension */}
          <Step index={3} title={t('weeklyReview.tensionTitle')}>
            {review.overloaded.length === 0 ? (
              <Empty>{t('weeklyReview.tensionEmpty')}</Empty>
            ) : (
              <ul className="space-y-1.5">
                {review.overloaded.map((m) => (
                  <li
                    key={m.userId}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl border border-red-300/60 bg-red-50/40 dark:bg-red-900/10"
                  >
                    <Gauge size={15} className="text-red-500 shrink-0" aria-hidden="true" />
                    <span className="text-sm font-semibold text-[rgb(var(--color-text-primary))] flex-1 truncate">
                      {m.name}
                    </span>
                    <span className="text-caption text-[rgb(var(--color-text-muted))] tabular-nums shrink-0">
                      {t('weeklyReview.workload', {
                        duration: formatDuration(m.estimatedMinutes),
                        open: m.open,
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Step>

          {/* 4. Arbitrages — la seule section qui produit des décisions. */}
          <Step index={4} title={t('weeklyReview.arbitrageTitle')}>
            {review.needsArbitration.length === 0 ? (
              <Empty>{t('weeklyReview.arbitrageEmpty')}</Empty>
            ) : (
              <>
                <p className="text-xs text-[rgb(var(--color-text-muted))] mb-2">
                  {t('weeklyReview.arbitrageHint')}
                </p>
                <ul className="space-y-1.5">
                  {review.needsArbitration.map((task) => (
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={() => onOpenTask(task.id)}
                        className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-[rgb(var(--color-border))] hover:border-indigo-400 hover:bg-[rgb(var(--color-hover))] transition-colors text-left"
                      >
                        <AlertTriangle size={15} className="text-red-500 shrink-0" aria-hidden="true" />
                        <span className="text-sm text-[rgb(var(--color-text-primary))] flex-1 truncate">{task.name}</span>
                        <span className="text-caption font-semibold text-red-500 tabular-nums shrink-0">
                          {task.deadline}
                        </span>
                        <ArrowRight size={14} className="text-[rgb(var(--color-text-muted))] shrink-0" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Step>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default WeeklyReviewSheet;
