import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { getDateLocale } from '@/i18n/format';
import { CalendarRange } from 'lucide-react';
import type { TeamTask, TeamProject } from '@/modules/team-projects';
import {
  timelineRange, timelineWeeks, timelineRows, todayOffsetPercent,
} from './timeline.helpers';
import { projectColor } from './team-projects.helpers';
import { useT } from '@/i18n/useT';

interface TeamProjectsTimelineProps {
  projects: TeamProject[];
  tasks: TeamTask[];
  onOpenTask: (task: TeamTask) => void;
}

/**
 * Vue chronologique : une ligne par projet, ses échéances en jalons.
 *
 * Volontairement PAS un Gantt — cf. l'en-tête de `timeline.helpers.ts` : sans
 * date de début sur `TeamTask`, des barres seraient de la donnée inventée.
 */
const TeamProjectsTimeline = ({ projects, tasks, onOpenTask }: TeamProjectsTimelineProps) => {
  const { t } = useT('org');

  const range = useMemo(() => timelineRange(tasks), [tasks]);
  const weeks = useMemo(() => timelineWeeks(range), [range]);
  const rows = useMemo(() => timelineRows(tasks, projects, range), [tasks, projects, range]);
  const todayOffset = useMemo(() => todayOffsetPercent(range), [range]);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--color-hover))] flex items-center justify-center mb-3">
          <CalendarRange size={22} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">
          {t('projects.timelineEmpty')}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
      <p className="text-xs text-[rgb(var(--color-text-muted))] mb-3">
        {t('projects.timelineNotGantt')}
      </p>

      {/* La grille scrolle horizontalement sur mobile sans faire déborder la
          page (garde-fou : le body ne doit jamais scroller latéralement). */}
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          {/* En-tête des semaines */}
          <div className="relative h-6 mb-2 ml-[140px]">
            {weeks.map((week) => (
              <span
                key={week.start.toISOString()}
                className="absolute top-0 text-caption text-[rgb(var(--color-text-muted))] whitespace-nowrap"
                style={{ left: `${week.offsetPercent}%` }}
              >
                {week.label}
              </span>
            ))}
          </div>

          {/* Lignes projet */}
          <ul className="space-y-2">
            {rows.map(({ project, markers }) => {
              const color = projectColor(project.color);
              return (
                <li key={project.id} className="flex items-center gap-3">
                  <span className="w-[128px] shrink-0 flex items-center gap-1.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${color.dot}`} aria-hidden="true" />
                    <span className="text-xs text-[rgb(var(--color-text-primary))] truncate">
                      {project.name}
                    </span>
                  </span>

                  <span className="relative flex-1 h-8 rounded-lg bg-[rgb(var(--color-hover))]/60">
                    {/* Repère « aujourd'hui » */}
                    {todayOffset !== null && (
                      <span
                        className="absolute top-0 bottom-0 w-px bg-[rgb(var(--color-accent))]/60"
                        style={{ left: `${todayOffset}%` }}
                        title={t('projects.timelineToday')}
                        aria-hidden="true"
                      />
                    )}

                    {markers.map((marker) => {
                      const deadline = parseISO(marker.task.deadline!);
                      const label = t('projects.timelineMarker', {
                        name: marker.task.name,
                        date: format(deadline, 'd MMMM', { locale: getDateLocale() }),
                      });
                      return (
                        <button
                          key={marker.task.id}
                          type="button"
                          onClick={() => onOpenTask(marker.task)}
                          title={label}
                          aria-label={label}
                          // -translate-x-1/2 : le jalon est centré sur sa date,
                          // sinon il se lit systématiquement en retard d'un jour.
                          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 border-[rgb(var(--color-surface))] transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))] ${
                            marker.overdue ? 'bg-red-500' : color.dot
                          }`}
                          style={{ left: `${marker.offsetPercent}%` }}
                        />
                      );
                    })}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TeamProjectsTimeline;
