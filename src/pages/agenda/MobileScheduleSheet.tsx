import React, { Suspense, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import { BottomSheet } from '@/components/mobile';
import { ScheduleEventModal } from '@/components/task-table/lazy-dialogs';
import type { SchedulableTask } from '@/components/ScheduleEventModal';
import { formatDeadlineSmart } from '@/components/task-table/helpers';
import { myAssignedTasks } from '@/components/organization/team-projects.helpers';
import { useTasks } from '@/modules/tasks';
import { useCategories } from '@/modules/categories';
import { useActiveOrganization } from '@/modules/organizations';
import { useTeamTasks } from '@/modules/team-projects';
import { useTeamCategories } from '@/modules/team-categories';
import { useAuth } from '@/modules/auth/AuthContext';
import { usePriorityRange } from '@/modules/ui-states';
import { formatDurationMinutes } from '@/lib/duration';
import { useT } from '@/i18n/useT';
import { useCreateEvent } from '@/modules/events';
import { localInputToIso } from '@/components/ScheduleEventModal';
import { useTaskHoldDrag, type DropSlot } from './use-task-hold-drag';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Row {
  key: string;
  name: string;
  meta: string;
  color: string;
  schedulable: SchedulableTask;
  /** Tâche d'équipe : l'événement n'est pas lié (cf. `ScheduleEventModal`). */
  team: boolean;
  /** Couleur ÉCRITE dans l'événement créé par glisser : toujours un hex. */
  eventColor: string;
}

/** Durée par défaut d'un créneau posé au doigt, quand la tâche n'en a pas. */
const DEFAULT_DROP_MINUTES = 60;

/**
 * « Planifier une tâche » — agenda MOBILE (maquette 170, 2026-10-10).
 *
 * Remplace le tiroir latéral de 220 px qui tronquait tout (« Préparer pr… »,
 * sélecteurs « Toute: », dates « 13/10/2026 ») et ne s'utilisait qu'en
 * glissant une carte au-dessus d'un calendrier qu'il recouvrait. Ici : des
 * lignes comme sur Tâches, on touche une tâche, on choisit son créneau dans
 * `ScheduleEventModal` (le même que « Planifier » depuis la liste des tâches).
 *
 * Mêmes tâches que le panneau desktop (`TaskSidebar`) : perso non terminées
 * dans la plage de priorité, plus les tâches d'équipe qui me sont assignées.
 */
const MobileScheduleSheet: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useT('agenda');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Row | null>(null);
  const { data: tasks = [] } = useTasks();
  const { data: categories = [] } = useCategories();
  const { priorityRange } = usePriorityRange();
  const { user } = useAuth();
  const { activeOrg } = useActiveOrganization();
  const { data: teamTasks = [] } = useTeamTasks(activeOrg?.id);
  const { data: teamCategories = [] } = useTeamCategories(activeOrg?.id);

  const rows = useMemo<Row[]>(() => {
    const term = search.trim().toLowerCase();
    const inRange = (p: number) => p === 0 || (p >= priorityRange[0] && p <= priorityRange[1]);
    const metaOf = (categoryName: string | undefined, deadline: string | undefined, minutes: number | undefined) =>
      [
        categoryName,
        deadline ? formatDeadlineSmart(deadline) : undefined,
        minutes && minutes > 0 ? formatDurationMinutes(minutes) : undefined,
      ].filter(Boolean).join(' · ');

    const perso: Row[] = tasks
      .filter((task) => !task.completed && inRange(task.priority) && task.name.toLowerCase().includes(term))
      .map((task) => {
        const cat = categories.find((c) => c.id === task.category);
        return {
          key: `perso-${task.id}`,
          name: task.name,
          meta: metaOf(cat?.name, task.deadline, task.estimatedTime),
          color: cat?.color ?? 'rgb(var(--color-text-muted))',
          schedulable: task,
          team: false,
          eventColor: cat?.color ?? '#CBD5E1',
        };
      });
    const team: Row[] = (user ? myAssignedTasks(teamTasks, user.id) : [])
      .filter((task) => !task.completed && inRange(task.priority) && task.name.toLowerCase().includes(term))
      .map((task) => {
        const cat = teamCategories.find((c) => c.id === task.categoryId);
        return {
          key: `team-${task.id}`,
          name: task.name,
          meta: metaOf(cat?.name, task.deadline, task.estimatedTime),
          // Couleur ÉCRITE dans l'événement : un hex, jamais une variable CSS.
          color: cat?.color ?? '#6B7280',
          schedulable: { id: task.id, name: task.name, category: '', deadline: task.deadline ?? '', estimatedTime: task.estimatedTime ?? 0 },
          team: true,
          eventColor: cat?.color ?? '#6B7280',
        };
      });
    return [...perso, ...team];
  }, [search, tasks, categories, teamTasks, teamCategories, user, priorityRange]);

  // Appui long → la feuille se ferme, la tâche suit le doigt → on la lâche sur
  // un créneau (demande d'Axel, 2026-10-11). Le toucher simple garde le
  // formulaire de créneau : jamais un geste comme seul chemin (C-111).
  const createEvent = useCreateEvent();
  // La feuille reste montée mais invisible pendant le glisser (cf. `concealed`).
  const [lifted, setLifted] = useState(false);
  const dropOn = (row: Row, slot: DropSlot | null) => {
    setLifted(false);
    onClose();
    if (!slot) return;
    const minutes = row.schedulable.estimatedTime && row.schedulable.estimatedTime > 0 ? row.schedulable.estimatedTime : DEFAULT_DROP_MINUTES;
    const start = new Date(localInputToIso(`${slot.date}T${slot.time}`));
    createEvent.mutate({
      title: row.name,
      start: start.toISOString(),
      end: new Date(start.getTime() + minutes * 60_000).toISOString(),
      taskId: row.team ? undefined : row.schedulable.id,
      color: row.eventColor,
      isPrivate: true,
    });
  };
  const { drag, bind } = useTaskHoldDrag<Row>({ onLift: () => setLifted(true), onDrop: dropOn });

  return (
    <>
      {drag && typeof document !== 'undefined' && createPortal(
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[10000] max-w-[70vw] -translate-x-1/2 -translate-y-[130%] rounded-xl px-3 py-2 text-label font-semibold text-white shadow-xl"
          style={{ left: drag.x, top: drag.y, backgroundColor: drag.item.eventColor }}
        >
          <span className="block truncate">{drag.item.name}</span>
          <span className="block text-caption font-medium opacity-90">{drag.slot ? drag.slot.time : t('sidebar.dropHere')}</span>
        </div>,
        document.body,
      )}
      <BottomSheet open={open && !picked} concealed={lifted} onClose={onClose} ariaLabel={t('sidebar.scheduleTitle')}>
        <div className="px-gutter pb-4">
          <h2 className="text-title font-bold pt-3 text-[rgb(var(--color-text-primary))]">{t('sidebar.scheduleTitle')}</h2>
          <p className="text-label pb-3 text-[rgb(var(--color-text-secondary))]">{t('sidebar.scheduleHint')}</p>
          <label className="flex items-center gap-2 h-11 rounded-full bg-[rgb(var(--color-surface))] px-4">
            <Search size={17} aria-hidden="true" className="shrink-0 text-[rgb(var(--color-text-muted))]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('sidebar.search')}
              aria-label={t('sidebar.search')}
              className="no-input-chrome flex-1 min-w-0 bg-transparent text-body focus:outline-none text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-muted))]"
            />
          </label>
          <ul className="mt-2 max-h-[55vh] overflow-y-auto overscroll-contain">
            {rows.map((row) => (
              <li key={row.key} className="border-b border-[rgb(var(--color-border))] last:border-b-0">
                <button
                  type="button"
                  onClick={() => setPicked(row)}
                  {...bind(row)}
                  className="w-full flex items-center gap-3 min-h-touch py-2 text-left select-none [-webkit-touch-callout:none] active:bg-[rgb(var(--color-hover))]"
                >
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} aria-hidden="true" />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-body text-[rgb(var(--color-text-primary))]">{row.name}</span>
                    {row.meta && <span className="block truncate text-caption text-[rgb(var(--color-text-muted))]">{row.meta}</span>}
                  </span>
                </button>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="py-6 text-center text-label text-[rgb(var(--color-text-muted))]">{t('sidebar.noResults')}</li>
            )}
          </ul>
        </div>
      </BottomSheet>

      {picked && (
        <Suspense fallback={null}>
          <ScheduleEventModal
            open
            onOpenChange={(next) => {
              if (next) return;
              setPicked(null);
              onClose();
            }}
            task={picked.schedulable}
            linkTask={!picked.team}
            colorOverride={picked.team ? picked.color : undefined}
          />
        </Suspense>
      )}
    </>
  );
};

export default MobileScheduleSheet;
