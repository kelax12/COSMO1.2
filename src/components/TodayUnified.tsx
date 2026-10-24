import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Pencil, Bookmark, ListPlus, Calendar, Hourglass, UserPlus, Trash2,
} from 'lucide-react';
import TaskRow from '@/components/TaskRow';
import { useTodayItems, useCompleteTodayItem } from '@/modules/today';
import type { TodayItem } from '@/modules/today/types';
import {
  useTasks, useUpdateTask, useDeleteTask, useToggleTaskBookmark, useRestoreTask,
} from '@/modules/tasks';
import type { Task } from '@/modules/tasks';
import { useUpdateTeamTask } from '@/modules/team-projects';
import { useActiveOrganization } from '@/modules/organizations';
import { useAuth } from '@/modules/auth/AuthContext';
import { useBilling } from '@/modules/billing/billing.context';
import { useIsDemo } from '@/lib/app-mode.store';
import { deadlineFromDayKey } from '@/lib/deadline';
import { addDaysToKey, getTimezonePref, todayKeyInTz } from '@/lib/timezone';
import { showUndoToast } from '@/lib/undo-toast';
import { toast } from '@/lib/toast';
import { useT } from '@/i18n/useT';
import TaskModal from '@/components/TaskModal';
import AddToListModal from '@/components/AddToListModal';
import { ScheduleEventModal } from '@/components/task-table/lazy-dialogs';

/**
 * Vue « Aujourd'hui » unifiée (item #29) — section du tableau de bord.
 *
 * Un collaborateur avait deux listes de tâches sans jonction : `tasks` (perso)
 * et `team_tasks` (équipe), sur deux écrans, avec deux modèles. Aucun endroit
 * ne répondait à « qu'est-ce que je dois faire aujourd'hui ? ».
 *
 * Maquette 376 (2026-10-21) : les retards ne sont plus listés un par un en
 * rouge (19 cartes bordées, dont 8 teintées, « en retard de 1 j » répété huit
 * fois). Ils tiennent dans UN bandeau qui porte la seule action utile, tout
 * replanifier à aujourd'hui ; la liste ne montre que ce qui est prévu. Au
 * survol, une ligne expose à plat les actions du menu de TaskTable.
 *
 * 🔴 Cette vue ne persiste rien qui lui soit propre : chaque écriture passe par
 * la mutation du MODULE D'ORIGINE (perso : `tasks`, équipe : `team_tasks`).
 * Récurrence serveur côté perso, triggers de statut côté équipe : un chemin
 * d'écriture unifié les casserait tous deux.
 *
 * Elle n'est rendue que pour les membres d'une organisation : sans deuxième
 * source, elle ferait doublon avec « Tâches prioritaires ».
 */
interface TodayUnifiedProps {
  /** Widget petit format : un seul bouton « Actions » par ligne, le titre prend la place. */
  compact?: boolean;
}

const TodayUnified = ({ compact = false }: TodayUnifiedProps) => {
  const { t, tp } = useT('dashboard');
  const { t: tt, tp: ttp } = useT('tasks');
  const navigate = useNavigate();
  const { items, isLoading, hasOrg } = useTodayItems();
  // Chaque source garde SON chemin d'écriture — porté par le hook depuis que
  // `TodayMoments` (mobile) le partage.
  const complete = useCompleteTodayItem();

  const { user } = useAuth();
  const isDemo = useIsDemo();
  const { isPremium } = useBilling();
  const { activeOrg } = useActiveOrganization();
  const { data: tasks = [] } = useTasks();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const restoreTask = useRestoreTask();
  const toggleBookmark = useToggleTaskBookmark();
  const updateTeamTask = useUpdateTeamTask(activeOrg?.id ?? '');

  const [editId, setEditId] = useState<string | null>(null);
  const [collabId, setCollabId] = useState<string | null>(null);
  const [listId, setListId] = useState<string | null>(null);
  const [scheduleTask, setScheduleTask] = useState<Task | null>(null);

  if (!hasOrg) return null;

  const overdue = items.filter((i) => i.overdue);
  const planned = items.filter((i) => !i.overdue);
  const taskOf = (id: string) => tasks.find((x) => x.id === id);

  // Chaque source par SON chemin : la tâche perso prend une échéance-instant
  // du fuseau choisi, la tâche d'équipe une clé de jour.
  const moveTo = (item: TodayItem, dayKey: string) => {
    if (item.source === 'personal') {
      updateTask.mutate({ id: item.id, updates: { deadline: deadlineFromDayKey(dayKey, getTimezonePref()) } });
    } else {
      updateTeamTask.mutate({ taskId: item.id, input: { deadline: dayKey } });
    }
  };

  const replanAll = () => {
    const today = todayKeyInTz(getTimezonePref());
    overdue.forEach((item) => moveTo(item, today));
    toast.success(ttp('toast.rescheduled', overdue.length));
  };

  const postponeTomorrow = (item: TodayItem) => {
    moveTo(item, addDaysToKey(todayKeyInTz(getTimezonePref()), 1));
    toast.success(tt('toast.postponed'));
  };

  // Même règle que TaskTable : suppression directe et réversible pour une
  // tâche à soi. Une tâche collaborative ou reçue touche d'autres personnes :
  // sa confirmation vit sur l'écran d'origine, on l'y ouvre.
  const remove = (item: TodayItem) => {
    const snap = taskOf(item.id);
    const received = !isDemo && !!snap?.userId && !!user?.id && snap.userId !== user.id;
    if (!snap || snap.isCollaborative || received) {
      navigate(item.href);
      return;
    }
    deleteTask.mutate(item.id, {
      onSuccess: () => showUndoToast(tt('toast.deleted'), () => restoreTask.mutate(snap)),
    });
  };

  const openCollaborators = (id: string) => {
    if (!isPremium()) {
      navigate('/premium');
      return;
    }
    setCollabId(id);
  };

  const actionsFor = (item: TodayItem) => {
    // Une tâche d'équipe n'a ni favori, ni liste, ni partage perso : ses
    // actions vivent dans `TeamTaskModal`, sur son écran.
    if (item.source === 'team') {
      return [{ key: 'edit', label: tt('rowMenu.edit'), icon: Pencil, run: () => navigate(item.href) }];
    }
    const task = taskOf(item.id);
    return [
      { key: 'edit', label: tt('rowMenu.edit'), icon: Pencil, run: () => setEditId(item.id) },
      {
        key: 'bookmark',
        label: task?.bookmarked ? tt('rowMenu.unbookmark') : tt('rowMenu.bookmark'),
        icon: Bookmark,
        active: !!task?.bookmarked,
        run: () => toggleBookmark.mutate(item.id),
      },
      { key: 'list', label: tt('card.addToList'), icon: ListPlus, run: () => setListId(item.id) },
      { key: 'schedule', label: t('today.schedule'), icon: Calendar, run: () => task && setScheduleTask(task) },
      { key: 'postpone', label: tt('card.postponeTomorrow'), icon: Hourglass, run: () => postponeTomorrow(item) },
      { key: 'collab', label: tt('rowMenu.collaborator'), icon: UserPlus, run: () => openCollaborators(item.id) },
      { key: 'delete', label: tt('rowMenu.delete'), icon: Trash2, danger: true, run: () => remove(item) },
    ];
  };

  const editTask = editId ? taskOf(editId) : undefined;
  const collabTask = collabId ? taskOf(collabId) : undefined;

  return (
    <div className="card-plain-mobile p-gutter md:p-6 rounded-2xl">
      <div className="mb-4">
        <h2 className="text-headline sm:text-lg font-bold text-[rgb(var(--color-text-primary))]">
          {t('sections.today')}
        </h2>
        <p className="text-[rgb(var(--color-text-secondary))] text-label sm:text-sm">
          {isLoading
            ? t('today.loading')
            : items.length === 0
              ? t('today.empty')
              : tp('today.plannedCount', planned.length)}
        </p>
      </div>

      {overdue.length > 0 && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-xl bg-[rgb(var(--color-error)/0.08)]">
          <span className="flex-1 min-w-0 text-sm font-medium text-[rgb(var(--color-danger-text))]">
            {tp('today.overdueBanner', overdue.length)}
          </span>
          <button
            type="button"
            onClick={replanAll}
            title={t('today.replanAll')}
            className="shrink-0 px-3 min-h-touch sm:min-h-0 sm:py-1.5 rounded-lg text-label sm:text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            {tt('table.rescheduleAllBtn')}
          </button>
        </div>
      )}

      {!isLoading && items.length > 0 && planned.length === 0 && (
        <p className="px-2 py-3 text-sm text-[rgb(var(--color-text-muted))]">{t('today.nothingPlanned')}</p>
      )}

      <ul className="divide-y divide-[rgb(var(--color-border))]">
        {planned.map((item) => (
          // Cle `(source, id)` : les deux tables ont leurs propres ids, et les
          // confondre cocherait la mauvaise ligne dans la mauvaise table.
          <TaskRow
            key={`${item.source}-${item.id}`}
            name={item.name}
            completeLabel={t('today.markDone', { name: item.name })}
            onComplete={() => complete(item)}
            onOpen={() => (item.source === 'personal' ? setEditId(item.id) : navigate(item.href))}
            actions={actionsFor(item)}
            compact={compact}
          />
        ))}
      </ul>

      {editTask && <TaskModal task={editTask} isOpen onClose={() => setEditId(null)} />}
      {collabTask && (
        <TaskModal task={collabTask} isOpen onClose={() => setCollabId(null)} showCollaborators />
      )}
      {listId && <AddToListModal isOpen onClose={() => setListId(null)} taskId={listId} />}
      {scheduleTask && (
        <React.Suspense fallback={null}>
          <ScheduleEventModal
            open
            onOpenChange={(o) => { if (!o) setScheduleTask(null); }}
            task={scheduleTask}
          />
        </React.Suspense>
      )}
    </div>
  );
};

export default TodayUnified;
