import { AlertTriangle } from 'lucide-react';
import { workloadTone, type MemberWorkload } from './team-stats.helpers';
import { formatDuration } from './team-projects.helpers';
import MemberAvatar from './MemberAvatar';
import type { OrgMember } from '@/modules/organizations';
import { useT } from '@/i18n/useT';

interface TeamWorkloadCardProps {
  rows: MemberWorkload[];
  members: OrgMember[];
}

/** Largeur de barre : plafonnée à 100 % pour que la surcharge ne déborde pas. */
const barWidth = (minutes: number, max: number): string =>
  max > 0 ? `${Math.min(100, Math.round((minutes / max) * 100))}%` : '0%';

/**
 * « Qui est en surcharge ? » — la question du lundi matin d'un manager, à
 * laquelle aucun écran ne répondait.
 *
 * On affiche le temps estimé restant plutôt que le nombre de tâches : trois
 * tâches d'une journée ne sont pas une charge plus légère que dix tâches de
 * dix minutes, et c'est précisément l'erreur de lecture qu'un compteur de
 * tâches induit.
 */
const TeamWorkloadCard = ({ rows, members }: TeamWorkloadCardProps) => {
  const { t, tp } = useT('org');
  const memberById = new Map(members.map((m) => [m.userId, m]));

  // Personnes réellement concernées : sans tâche ouverte, on n'occupe pas une
  // ligne pour rien.
  const active = rows.filter((r) => r.open > 0);
  const maxMinutes = Math.max(0, ...active.map((r) => r.estimatedMinutes));
  const anyEstimate = active.some((r) => r.estimatedMinutes > 0);

  return (
    <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
      <div className="mb-1">
        <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))]">
          {t('overview.workloadTitle')}
        </h3>
        <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">
          {t('overview.workloadHint')}
        </p>
      </div>

      {active.length === 0 || !anyEstimate ? (
        <p className="text-xs text-[rgb(var(--color-text-muted))] py-6 text-center max-w-sm mx-auto">
          {t('overview.workloadEmpty')}
        </p>
      ) : (
        <ul className="space-y-2.5 mt-3">
          {active.map((row) => {
            const member = memberById.get(row.userId);
            const tone = workloadTone(row.loadRatio);
            const barClass =
              tone === 'over'
                ? 'bg-red-500'
                : tone === 'under'
                  ? 'bg-[rgb(var(--color-text-muted))]'
                  : 'bg-[rgb(var(--color-accent))]';
            const toneLabel =
              tone === 'over'
                ? t('overview.workloadOver')
                : tone === 'under'
                  ? t('overview.workloadUnder')
                  : t('overview.workloadNormal');
            return (
              <li key={row.userId} className="flex items-center gap-3">
                {member && (
                  <MemberAvatar avatar={member.avatar} name={member.displayName} size={26} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[rgb(var(--color-text-primary))] truncate">
                      {row.name}
                    </span>
                    {tone === 'over' && (
                      <span className="inline-flex items-center gap-1 text-caption font-semibold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 shrink-0">
                        <AlertTriangle size={10} aria-hidden="true" /> {toneLabel}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-[rgb(var(--color-text-muted))] shrink-0 tabular-nums">
                      {row.estimatedMinutes > 0
                        ? formatDuration(row.estimatedMinutes)
                        : t('overview.workloadNoEstimate')}
                    </span>
                  </div>
                  <div
                    className="mt-1 h-1.5 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden"
                    role="img"
                    aria-label={`${row.name} : ${toneLabel}, ${tp('overview.workloadOpen', row.open)}`}
                  >
                    <div
                      className={`h-full rounded-full ${barClass} transition-all`}
                      style={{ width: barWidth(row.estimatedMinutes, maxMinutes) }}
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-caption text-[rgb(var(--color-text-muted))]">
                      {tp('overview.workloadOpen', row.open)}
                    </span>
                    {row.overdue > 0 && (
                      <span className="text-caption font-semibold text-red-500">
                        {t('overview.workloadOverdue', { count: row.overdue })}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default TeamWorkloadCard;
