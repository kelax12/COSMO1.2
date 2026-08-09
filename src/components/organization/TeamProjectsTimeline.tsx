import { useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { getDateLocale } from '@/i18n/format';
import { CalendarRange, CalendarOff, CalendarClock, UserRound } from 'lucide-react';
import type { TeamTask, TeamProject } from '@/modules/team-projects';
import type { OrgMember } from '@/modules/organizations';
import {
  timelineRange, timelineWindow, timelineWeeks, timelineMonths, timelineRows,
  timelineRowsByAssignee, todayOffsetPercent, inWindowOrUnscheduled, UNASSIGNED_ID,
  type TimelineZoom, type TimelineMarker,
} from './timeline.helpers';
import { projectColor, PRIORITY_META } from './team-projects.helpers';
import MemberAvatar from './MemberAvatar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useT } from '@/i18n/useT';

interface TeamProjectsTimelineProps {
  projects: TeamProject[];
  tasks: TeamTask[];
  members: OrgMember[];
  /** Axe des lignes : par projet (défaut) ou par personne — cf. ProjectsToolbar. */
  groupBy: 'project' | 'assignee';
  onOpenTask: (task: TeamTask) => void;
}

/** Largeur de colonne (label + éventuelle pastille « sans date »), alignée
 *  avec le `ml-[140px]` de l'en-tête et de la grille. */
const LABEL_COL_PX = 140;
const PX_PER_WEEK = 100;
const MIN_WIDTH_PX = 640;
/** Écart minimal (en % de la fenêtre) pour afficher le nom en clair à côté
 *  d'un jalon, plutôt que de compter uniquement sur la card de survol. */
const LABEL_GAP_PERCENT = 9;
/** Délai avant d'ouvrir la card de survol — laisse balayer plusieurs jalons
 *  rapprochés sans qu'une card clignote sous le curseur à chaque pixel. */
const HOVER_OPEN_DELAY_MS = 120;
/** Délai avant de la refermer — la card flotte à quelques pixels du point ;
 *  sans ce délai, traverser cet espace pour l'atteindre la referme en route. */
const HOVER_CLOSE_DELAY_MS = 150;

const zoomBtn = 'h-7 px-2 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60';
const zoomOn = 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))]';
const zoomOff = 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]';

/** Ligne affichée — même gabarit qu'elle vienne d'un projet ou d'une personne. */
interface RowDescriptor {
  key: string;
  label: string;
  dotClass?: string;
  avatar?: string | null;
  isUnassigned?: boolean;
  markers: TimelineMarker[];
  unscheduled: TeamTask[];
}

/**
 * Vue chronologique (« Planning ») : une ligne par projet — ou par personne —,
 * ses échéances en jalons, ses tâches sans date en pastille cliquable.
 *
 * Volontairement PAS un Gantt — cf. l'en-tête de `timeline.helpers.ts` : sans
 * date de début sur `TeamTask`, des barres seraient de la donnée inventée.
 */
const TeamProjectsTimeline = ({ projects, tasks, members, groupBy, onOpenTask }: TeamProjectsTimelineProps) => {
  const { t, tp } = useT('org');
  const [zoom, setZoom] = useState<TimelineZoom>('default');
  const [openUnscheduled, setOpenUnscheduled] = useState<string | null>(null);
  const [hoverTaskId, setHoverTaskId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); }, []);

  // Souris uniquement (`hover: hover`) : sur tactile, mouseenter est absent ou
  // synthétique juste avant le tap — la card de survol n'y a pas sa place, le
  // clic ouvre directement la tâche.
  const canHover = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;

  const scheduleHoverOpen = (taskId: string) => {
    if (!canHover()) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setHoverTaskId(taskId), HOVER_OPEN_DELAY_MS);
  };
  // Fermeture différée : quitter le point pour rejoindre la card (quelques
  // pixels plus haut) traverse un blanc — sans délai, ce blanc referme la
  // card avant que la souris n'y arrive.
  const scheduleHoverClose = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setHoverTaskId(null), HOVER_CLOSE_DELAY_MS);
  };
  const cancelHoverTimer = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
  };
  const closeHoverNow = () => {
    cancelHoverTimer();
    setHoverTaskId(null);
  };

  const fullRange = useMemo(() => timelineRange(tasks), [tasks]);
  const range = useMemo(() => timelineWindow(fullRange, zoom), [fullRange, zoom]);
  const weeks = useMemo(() => timelineWeeks(range), [range]);
  const months = useMemo(() => timelineMonths(range), [range]);
  const todayOffset = useMemo(() => todayOffsetPercent(range), [range]);

  // Fenêtre bornée (tout sauf « Tout ») : une tâche hors champ ne produit pas
  // de jalon fantôme collé à un bord — elle réapparaît au zoom « Tout ».
  const windowedTasks = useMemo(
    () => (zoom === 'all' ? tasks : tasks.filter((task) => inWindowOrUnscheduled(task, range))),
    [tasks, zoom, range],
  );

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members]);

  /** Avatars + libellé pour la card de survol — jusqu'à 2 avatars, `+N` au-delà. */
  const assigneeSummary = (assigneeIds: string[]) => {
    const resolved = assigneeIds.map((id) => memberById.get(id)).filter((m): m is OrgMember => !!m);
    if (resolved.length === 0) return { avatars: [] as OrgMember[], overflow: 0, label: t('projects.timelineUnassignedTask') };
    return {
      avatars: resolved.slice(0, 2),
      overflow: Math.max(0, resolved.length - 2),
      label: resolved.map((m) => m.displayName).join(', '),
    };
  };

  const rows: RowDescriptor[] = useMemo(() => {
    if (groupBy === 'assignee') {
      const activeIds = new Set(projects.map((p) => p.id));
      return timelineRowsByAssignee(windowedTasks, activeIds, range)
        .map((row) => {
          const member = row.assigneeId === UNASSIGNED_ID ? null : memberById.get(row.assigneeId);
          return {
            key: row.assigneeId,
            label: member ? member.displayName : t('kanban.unassigned'),
            avatar: member?.avatar ?? null,
            isUnassigned: !member,
            markers: row.markers,
            unscheduled: row.unscheduled,
          };
        })
        // Charge décroissante : la personne la plus chargée se lit en premier.
        .sort((a, b) => (b.markers.length + b.unscheduled.length) - (a.markers.length + a.unscheduled.length));
    }
    return timelineRows(windowedTasks, projects, range).map((row) => ({
      key: row.project.id,
      label: row.project.name,
      dotClass: projectColor(row.project.color).dot,
      markers: row.markers,
      unscheduled: row.unscheduled,
    }));
  }, [groupBy, windowedTasks, projects, range, memberById, t]);

  const minWidthPx = Math.max(MIN_WIDTH_PX, weeks.length * PX_PER_WEEK);

  // Cadrage initial sur aujourd'hui : au zoom « Tout », une échéance lointaine
  // ne doit pas laisser la fenêtre ouverte loin d'aujourd'hui sans defiler.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || todayOffset === null) return;
    const target = (todayOffset / 100) * el.scrollWidth - 96;
    el.scrollLeft = Math.max(0, target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, range.start.getTime()]);

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
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <p className="text-xs text-[rgb(var(--color-text-muted))]">
          {t('projects.timelineNotGantt')}
        </p>

        {/* Zoom : la fenêtre par défaut est bornée à 8 semaines autour
            d'aujourd'hui (cf. timeline.helpers.ts) — ces boutons l'élargissent.
            Aucun n'est actif tant que rien n'a été choisi : le défaut n'est
            littéralement aucun des trois. */}
        <div
          className="inline-flex rounded-lg border border-[rgb(var(--color-border))] p-0.5 gap-0.5 shrink-0"
          role="group"
          aria-label={t('projects.timelineZoomLabel')}
        >
          <button type="button" onClick={() => setZoom('month')} aria-pressed={zoom === 'month'} className={`${zoomBtn} ${zoom === 'month' ? zoomOn : zoomOff}`}>
            {t('projects.timelineZoomMonth')}
          </button>
          <button type="button" onClick={() => setZoom('quarter')} aria-pressed={zoom === 'quarter'} className={`${zoomBtn} ${zoom === 'quarter' ? zoomOn : zoomOff}`}>
            {t('projects.timelineZoomQuarter')}
          </button>
          <button type="button" onClick={() => setZoom('all')} aria-pressed={zoom === 'all'} className={`${zoomBtn} ${zoom === 'all' ? zoomOn : zoomOff}`}>
            {t('projects.timelineZoomAll')}
          </button>
        </div>
      </div>

      {/* La grille scrolle horizontalement sans faire déborder la page
          (garde-fou : le body ne doit jamais scroller latéralement). La
          largeur minimale suit le nombre de semaines affichées : zoomer sur
          « Tout » défile au lieu de tasser des mois dans le même espace. */}
      <div ref={scrollRef} className="overflow-x-auto">
        <div className="relative" style={{ minWidth: `${minWidthPx}px` }}>
          {/* Bandeau mensuel — seulement au-delà de ~6 semaines de fenêtre. */}
          {months.length > 0 && (
            <div className="relative h-4 mb-1" style={{ marginLeft: LABEL_COL_PX }}>
              {months.map((month) => (
                <span
                  key={month.label}
                  className="absolute top-0 text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))] whitespace-nowrap"
                  style={{ left: `${month.offsetPercent}%` }}
                >
                  {month.label}
                </span>
              ))}
            </div>
          )}

          {/* En-tête des semaines */}
          <div className="relative h-6 mb-2" style={{ marginLeft: LABEL_COL_PX }}>
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

          {/* Grille + lignes. Les séparateurs de semaine et le repère
              « aujourd'hui » sont posés UNE fois, en superposition de toutes
              les lignes — un trait par ligne se serait décalé des autres au
              moindre écart d'arrondi. */}
          <div className="relative">
            <div className="pointer-events-none absolute inset-0" style={{ marginLeft: LABEL_COL_PX }} aria-hidden="true">
              {weeks.map((week) => (
                <span
                  key={week.start.toISOString()}
                  className="absolute top-0 bottom-0 w-px bg-[rgb(var(--color-border))]/50"
                  style={{ left: `${week.offsetPercent}%` }}
                />
              ))}
              {todayOffset !== null && (
                <span
                  className="absolute top-0 bottom-0 w-0.5 bg-[rgb(var(--color-accent))]"
                  style={{ left: `${todayOffset}%` }}
                  title={t('projects.timelineToday')}
                />
              )}
            </div>

            <ul className="space-y-2 relative">
              {rows.map((row) => (
                <li key={row.key} className="flex items-center gap-0" style={{ minHeight: '2rem' }}>
                  <span className="shrink-0 flex flex-col gap-1 min-w-0 pr-3" style={{ width: LABEL_COL_PX }}>
                    <span className="flex items-center gap-1.5 min-w-0">
                      {row.dotClass && <span className={`w-2 h-2 rounded-full shrink-0 ${row.dotClass}`} aria-hidden="true" />}
                      {groupBy === 'assignee' && (
                        row.isUnassigned ? (
                          <span className="w-[18px] h-[18px] rounded-full border border-dashed border-[rgb(var(--color-border))] flex items-center justify-center shrink-0">
                            <UserRound size={10} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
                          </span>
                        ) : (
                          <MemberAvatar avatar={row.avatar ?? undefined} name={row.label} size={18} />
                        )
                      )}
                      <span className="text-xs text-[rgb(var(--color-text-primary))] truncate">
                        {row.label}
                      </span>
                    </span>

                    {/* Pastille « N sans date » : la vue s'appelle Planning,
                        cacher le travail non daté cacherait exactement ce
                        qu'elle doit faire remonter. */}
                    {row.unscheduled.length > 0 && (
                      <Popover
                        open={openUnscheduled === row.key}
                        onOpenChange={(open) => setOpenUnscheduled(open ? row.key : null)}
                      >
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            aria-label={t('projects.timelineUnscheduledAria', { count: row.unscheduled.length })}
                            className="self-start inline-flex items-center gap-1 pl-1.5 pr-2 h-[18px] rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-semibold whitespace-nowrap hover:bg-amber-500/25 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
                          >
                            <CalendarOff size={10} aria-hidden="true" />
                            {tp('projects.timelineUnscheduled', row.unscheduled.length)}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-64 p-2">
                          <p className="text-xs font-semibold text-[rgb(var(--color-text-muted))] px-1 pb-1">
                            {t('projects.timelineUnscheduledTitle')}
                          </p>
                          <ul className="max-h-56 overflow-y-auto space-y-0.5">
                            {row.unscheduled.map((task) => {
                              const taskProject = projectById.get(task.projectId);
                              return (
                                <li key={task.id}>
                                  <button
                                    type="button"
                                    onClick={() => { setOpenUnscheduled(null); onOpenTask(task); }}
                                    className="w-full text-left px-2 py-1.5 rounded-md hover:bg-[rgb(var(--color-hover))]"
                                  >
                                    <span className="block text-xs text-[rgb(var(--color-text-primary))] truncate">{task.name}</span>
                                    {groupBy === 'assignee' && taskProject && (
                                      <span className="block text-[10px] text-[rgb(var(--color-text-muted))] truncate">{taskProject.name}</span>
                                    )}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </PopoverContent>
                      </Popover>
                    )}
                  </span>

                  <span className="relative flex-1 h-8 rounded-lg bg-[rgb(var(--color-hover))]/60">
                    {row.markers.map((marker, i) => {
                      const deadline = parseISO(marker.task.deadline!);
                      const markerProject = projectById.get(marker.task.projectId);
                      const dotClass = marker.overdue
                        ? 'bg-red-500'
                        : (markerProject ? projectColor(markerProject.color).dot : 'bg-slate-400');
                      const prev = row.markers[i - 1];
                      const next = row.markers[i + 1];
                      const gapBefore = prev ? marker.offsetPercent - prev.offsetPercent : Infinity;
                      const gapAfter = next ? next.offsetPercent - marker.offsetPercent : Infinity;
                      const showLabel = Math.min(gapBefore, gapAfter) >= LABEL_GAP_PERCENT;
                      const flipLeft = marker.offsetPercent > 80;
                      // Alignement de la card de survol : centrée par défaut,
                      // ancrée au bord près des extrémités pour ne pas déborder
                      // de la piste (même logique que le libellé inline).
                      const cardAlign = marker.offsetPercent < 15 ? 'left' : marker.offsetPercent > 85 ? 'right' : 'center';
                      const priority = PRIORITY_META[marker.task.priority] ?? PRIORITY_META[3];
                      const assignees = assigneeSummary(marker.task.assigneeIds);

                      return (
                        <span
                          key={marker.task.id}
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                          style={{ left: `${marker.offsetPercent}%` }}
                        >
                          <button
                            type="button"
                            onClick={() => onOpenTask(marker.task)}
                            onMouseEnter={() => scheduleHoverOpen(marker.task.id)}
                            onMouseLeave={scheduleHoverClose}
                            onFocus={() => { cancelHoverTimer(); setHoverTaskId(marker.task.id); }}
                            onBlur={closeHoverNow}
                            aria-label={t('projects.timelineMarker', {
                              name: marker.task.name,
                              date: format(deadline, 'd MMMM', { locale: getDateLocale() }),
                            })}
                            className={`relative block w-3.5 h-3.5 rounded-full border-2 border-[rgb(var(--color-surface))] transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))] ${dotClass}`}
                          >
                            {/* Nom en clair quand la place le permet (point 2) —
                                sinon la card de survol / l'aria-label restent le
                                seul recours. */}
                            {showLabel && (
                              <span
                                className={`absolute top-1/2 -translate-y-1/2 text-[10px] font-medium text-[rgb(var(--color-text-secondary))] whitespace-nowrap max-w-[140px] truncate ${
                                  flipLeft ? 'right-[calc(100%+6px)] text-right' : 'left-[calc(100%+6px)]'
                                }`}
                                aria-hidden="true"
                              >
                                {marker.task.name}
                              </span>
                            )}
                          </button>

                          {/* Card de survol — desktop uniquement (souris), purement
                              informative : cliquer le point ouvre directement la
                              tâche, cette card ne porte aucune action. */}
                          {hoverTaskId === marker.task.id && (
                            <div
                              aria-hidden="true"
                              onMouseEnter={cancelHoverTimer}
                              onMouseLeave={scheduleHoverClose}
                              className={`absolute bottom-[calc(100%+10px)] w-56 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] shadow-lg p-3 z-20 ${
                                cardAlign === 'center' ? 'left-1/2 -translate-x-1/2'
                                  : cardAlign === 'left' ? 'left-0'
                                    : 'right-0'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[rgb(var(--color-text-secondary))] whitespace-nowrap">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priority.dot}`} aria-hidden="true" />
                                  {priority.label}
                                </span>
                                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold whitespace-nowrap ${marker.overdue ? 'text-red-500' : 'text-[rgb(var(--color-text-muted))]'}`}>
                                  <CalendarClock size={11} aria-hidden="true" />
                                  {format(deadline, 'd MMM', { locale: getDateLocale() })}
                                </span>
                              </div>
                              <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))] line-clamp-2 mb-2.5">
                                {marker.task.name}
                              </p>
                              <div className="flex items-center gap-1.5 pt-2 border-t border-[rgb(var(--color-border-muted))] min-w-0">
                                {assignees.avatars.length > 0 ? (
                                  <span className="flex -space-x-1.5 shrink-0">
                                    {assignees.avatars.map((m) => (
                                      <span key={m.userId} className="rounded-full ring-1 ring-[rgb(var(--color-surface))]">
                                        <MemberAvatar avatar={m.avatar} name={m.displayName} size={20} />
                                      </span>
                                    ))}
                                    {assignees.overflow > 0 && (
                                      <span className="w-5 h-5 rounded-full ring-1 ring-[rgb(var(--color-surface))] bg-[rgb(var(--color-hover))] flex items-center justify-center text-[9px] font-bold text-[rgb(var(--color-text-muted))]">
                                        +{assignees.overflow}
                                      </span>
                                    )}
                                  </span>
                                ) : null}
                                <span className={`text-[11px] truncate ${assignees.avatars.length === 0 ? 'italic text-[rgb(var(--color-text-muted))]' : 'text-[rgb(var(--color-text-secondary))] font-medium'}`}>
                                  {assignees.label}
                                </span>
                              </div>
                            </div>
                          )}
                        </span>
                      );
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamProjectsTimeline;
