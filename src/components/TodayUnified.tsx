import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Circle, CheckCircle2, Clock, Pencil, Bookmark, ListPlus, Calendar, Hourglass, UserPlus, Copy, Trash2,
} from 'lucide-react';
import { useTodayItems, useCompleteTodayItem } from '@/modules/today';
import type { TodayItem } from '@/modules/today/types';
import {
  useTasks, useUpdateTask, useCreateTask, useDeleteTask, useToggleTaskBookmark, useRestoreTask,
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
import TouchTarget from '@/components/mobile/TouchTarget';
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
const TodayUnified = () => {
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
  const createTask = useCreateTask();
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

  const duplicate = (id: string) => {
    const src = taskOf(id);
    if (!src) return;
    createTask.mutate({
      name: `${src.name} (copie)`,
      priority: src.priority,
      category: src.category,
      deadline: src.deadline,
      estimatedTime: src.estimatedTime,
      bookmarked: src.bookmarked,
      completed: false,
    });
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
      { key: 'duplicate', label: tt('rowMenu.duplicate'), icon: Copy, run: () => duplicate(item.id) },
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
          <Clock size={18} aria-hidden="true" className="shrink-0 text-[rgb(var(--color-error))]" />
          <span className="flex-1 min-w-0 text-sm font-medium text-[rgb(var(--color-error))]">
            {tp('today.overdueBanner', overdue.length)}
          </span>
          <button
            type="button"
            onClick={replanAll}
            className="shrink-0 min-h-touch px-3 rounded-lg text-sm font-medium border border-[rgb(var(--color-error)/0.35)] text-[rgb(var(--color-error))] transition-colors hover:bg-[rgb(var(--color-error)/0.1)]"
          >
            {t('today.replanAll')}
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
          <li key={`${item.source}-${item.id}`}>
            <div className="group flex items-center gap-2 px-2 rounded-xl transition-colors hover:bg-[rgb(var(--color-hover))] focus-within:bg-[rgb(var(--color-hover))]">
              {/* 🔴 C-57 — cible 44 x 44 portee par `TouchTarget`, l'icone reste
                  petite : c'est le geste PRINCIPAL du produit sur son ecran
                  d'accueil. Marges negatives : la rangee ne grandit pas. */}
              <TouchTarget
                onClick={() => complete(item)}
                aria-label={t('today.markDone', { name: item.name })}
                className="-my-1 -ml-1 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-success))]"
              >
                <Circle size={18} strokeWidth={1.75} aria-hidden="true" className="group-hover:hidden" />
                <CheckCircle2 size={18} strokeWidth={1.75} aria-hidden="true" className="hidden group-hover:block" />
              </TouchTarget>

              {/* C-57 — la rangee ouvre l'element : 44 px dans les deux
                  dimensions (WCAG 2.5.5). */}
              <button
                type="button"
                onClick={() => (item.source === 'personal' ? setEditId(item.id) : navigate(item.href))}
                className="flex-1 min-w-0 min-h-touch flex items-center text-left"
              >
                <span className="truncate text-sm font-medium text-[rgb(var(--color-text-primary))]">
                  {item.name}
                </span>
              </button>

              {/* Les actions du menu de TaskTable, a plat. Visibles au survol ET
                  au focus : au clavier, Tab les atteint et les revele (2.1.1). */}
              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                {actionsFor(item).map(({ key, label, icon: Icon, run, danger, active }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={run}
                    aria-label={`${label} : ${item.name}`}
                    title={label}
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors hover:bg-[rgb(var(--color-surface))] ${
                      danger
                        ? 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-error))]'
                        : active
                          ? 'text-[rgb(var(--color-accent))]'
                          : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))]'
                    }`}
                  >
                    <Icon size={16} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          </li>
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
