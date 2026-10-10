import React, { Suspense, useMemo, useState } from 'react';
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
}

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
        };
      });
    return [...perso, ...team];
  }, [search, tasks, categories, teamTasks, teamCategories, user, priorityRange]);

  return (
    <>
      <BottomSheet open={open && !picked} onClose={onClose} ariaLabel={t('sidebar.scheduleTitle')}>
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
                  className="w-full flex items-center gap-3 min-h-touch py-2 text-left active:bg-[rgb(var(--color-hover))]"
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
