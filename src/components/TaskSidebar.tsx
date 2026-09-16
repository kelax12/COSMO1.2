import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Filter, X, Info, ChevronDown, Lightbulb, Plus } from 'lucide-react';
import TaskModal from './TaskModal';
import PersonalTaskCard from './task-sidebar/PersonalTaskCard';
import TeamTaskCard from './task-sidebar/TeamTaskCard';
import TaskContextMenu, { type ContextMenuState } from './task-sidebar/TaskContextMenu';
import { showUndoToast } from '@/lib/undo-toast';

// ═══════════════════════════════════════════════════════════════════
// Module tasks - Hooks indépendants (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useTasks, useDeleteTask, useCreateTask, useRestoreTask, Task } from '@/modules/tasks';

// ═══════════════════════════════════════════════════════════════════
// Module events - Hooks indépendants (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useEvents, useDeleteEvent, useRestoreEvent } from '@/modules/events';

// ═══════════════════════════════════════════════════════════════════
// Module categories - (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useCategories, buildTree } from '@/modules/categories';
import type { Category, CategoryNode } from '@/modules/categories';

import { useColorSettings, usePriorityRange } from '@/modules/ui-states';
import { useFriends, useCollaboratorsByTask } from '@/modules/friends';
import { useAuth } from '@/modules/auth/AuthContext';
import { useT } from '@/i18n/useT';

// ═══════════════════════════════════════════════════════════════════
// Tâches d'équipe assignées — mode entreprise (item 4)
// ═══════════════════════════════════════════════════════════════════
import { useActiveOrganization } from '@/modules/organizations';
import { useTeamTasks, type TeamTask } from '@/modules/team-projects';
import { useTeamCategories } from '@/modules/team-categories';
import { myAssignedTasks } from './organization/team-projects.helpers';

type TaskSidebarProps = {
  onClose?: () => void;
  onDragStart?: () => void;
};

// Durée « 40 h » / « 1 h 30 min » / « 45 min » — cohérent avec la TaskCard
// (bug B10 : la sidebar affichait « 2400 min » au lieu de « 40 h »).
const formatDuration = (minutes: number | undefined): string => {
  if (!minutes || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, '0')} min`;
};

const TUTORIAL_KEY = 'cosmo_agenda_tutorial_open';

const TaskSidebar: React.FC<TaskSidebarProps> = ({ onClose, onDragStart }) => {
  const { t, tp } = useT('agenda');
  // ═══════════════════════════════════════════════════════════════════
  // TASKS - Depuis le module tasks (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: tasks = [] } = useTasks();

  // ═══════════════════════════════════════════════════════════════════
  // EVENTS - Depuis le module events (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: events = [] } = useEvents();
  const deleteEventMutation = useDeleteEvent();
  // « Annuler » de la suppression des evenements lies (C-43) : rend chaque
  // evenement sous SON identifiant, comme le fait deja `useAgendaEventActions`.
  const restoreEventMutation = useRestoreEvent();
  const deleteTaskMutation = useDeleteTask();
  const createTaskMutation = useCreateTask();
  // « Annuler » d'une suppression de tache : SON identifiant, pas un neuf (R-08).
  const restoreTaskMutation = useRestoreTask();

  // ═══════════════════════════════════════════════════════════════════
  // CATEGORIES - Depuis le module categories (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: categories = [] } = useCategories();
  // Ordre parent-puis-enfants pour l'indentation du <select> natif du filtre
  // (aucun repli possible dans un <option>, cf. le commentaire au rendu).
  const categoryOptionRows: Array<{ category: Category; depth: number }> = [];
  const flattenCategoryOptions = (nodes: CategoryNode[], depth: number) => {
    for (const node of nodes) {
      categoryOptionRows.push({ category: node.category, depth });
      flattenCategoryOptions(node.children, depth + 1);
    }
  };
  flattenCategoryOptions(buildTree(categories), 0);

  const { colorSettings } = useColorSettings();
  const { priorityRange } = usePriorityRange();
  const { data: friends = [] } = useFriends();
  const { user } = useAuth();
  // Collaborateurs (avatars) vus des deux côtés : destinataires si je suis
  // propriétaire, propriétaire si je suis destinataire d'une tâche partagée.
  const collaboratorsByTask = useCollaboratorsByTask(user?.id);

  // ═══════════════════════════════════════════════════════════════════
  // TÂCHES D'ÉQUIPE ASSIGNÉES (mode entreprise) — scope à l'organisation
  // ACTIVE, comme `useTodayItems` (src/modules/today/hooks.ts). `[]` sans
  // organisation active : le hook reste inerte (`enabled: !!orgId`).
  // ═══════════════════════════════════════════════════════════════════
  const { activeOrg } = useActiveOrganization();
  const orgId = activeOrg?.id;
  const { data: allTeamTasks = [] } = useTeamTasks(orgId);
  const { data: teamCategories = [] } = useTeamCategories(orgId);
  const myTeamTasks = useMemo(
    () => (user ? myAssignedTasks(allTeamTasks, user.id).filter((t) => !t.completed) : []),
    [allTeamTasks, user],
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  /** Chips « Tout / Perso / Pro » — origine des tâches affichées. */
  const [sourceFilter, setSourceFilter] = useState<'all' | 'perso' | 'pro'>('all');
  const [showTutorial, setShowTutorialState] = useState<boolean>(() => {
    try { return localStorage.getItem(TUTORIAL_KEY) === '1'; } catch { return false; }
  });
  const setShowTutorial = useCallback((next: boolean) => {
    setShowTutorialState(next);
    try { localStorage.setItem(TUTORIAL_KEY, next ? '1' : '0'); } catch { /* ignore */ }
  }, []);
  const [selectedTaskForModal, setSelectedTaskForModal] = useState<Task | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);

  // ── Menu contextuel (long-press mobile / maintien-clic desktop) ──────────
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const pressStart = useRef<{ x: number; y: number } | null>(null);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const startLongPress = useCallback((e: React.PointerEvent, task: Task) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    longPressFired.current = false;
    pressStart.current = { x: e.clientX, y: e.clientY };
    cancelLongPress();
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
      // Positionne le menu près du point d'appui, en restant dans le viewport.
      const x = Math.min(pressStart.current?.x ?? 0, window.innerWidth - 220);
      const y = Math.min(pressStart.current?.y ?? 0, window.innerHeight - 200);
      setContextMenu({ task, x: Math.max(8, x), y: Math.max(8, y) });
    }, 500);
  }, [cancelLongPress]);

  const onPressMove = useCallback((e: React.PointerEvent) => {
    if (!pressStart.current) return;
    if (Math.abs(e.clientX - pressStart.current.x) > 10 || Math.abs(e.clientY - pressStart.current.y) > 10) {
      cancelLongPress();
    }
  }, [cancelLongPress]);

  // Ouverture du menu contextuel depuis le clic droit ou le bouton "..." de
  // la carte (PersonalTaskCard) : marque `longPressFired` pour empêcher le
  // `onClick` du parent d'ouvrir la modale d'édition juste après.
  const openContextMenu = useCallback((task: Task, x: number, y: number) => {
    longPressFired.current = true;
    setContextMenu({ task, x, y });
  }, []);

  // Ferme le menu sur clic extérieur / Échap / scroll.
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [contextMenu]);

  const handleEditTask = (task: Task) => {
    setContextMenu(null);
    setSelectedTaskForModal(task);
  };

  const handleDeleteTask = (task: Task) => {
    setContextMenu(null);
    deleteTaskMutation.mutate(task.id, {
      onSuccess: () => {
        showUndoToast(t('sidebar.taskDeleted'), () => { restoreTaskMutation.mutate(task); });
      },
    });
  };

  const linkedEventCount = (taskId: string) => events.filter(ev => ev.taskId === taskId).length;

  // C-43 — une entree de menu supprimait N evenements sans rien demander, sans
  // rien dire et sans retour possible. On dit COMBIEN, et on offre « Annuler »,
  // qui les rend sous LEURS identifiants (meme contrat que useAgendaEventActions).
  const handleDeleteLinkedEvent = (task: Task) => {
    setContextMenu(null);
    const linked = events.filter(ev => ev.taskId === task.id);
    if (linked.length === 0) return;
    linked.forEach(ev => deleteEventMutation.mutate(ev.id));
    showUndoToast(tp('sidebar.linkedEventsDeleted', linked.length), () => {
      linked.forEach(ev => restoreEventMutation.mutate(ev));
    });
  };

  const handleDuplicateTask = (task: Task) => {
    setContextMenu(null);
    createTaskMutation.mutate({
      name: t('sidebar.copySuffix', { name: task.name }),
      priority: task.priority,
      category: task.category,
      deadline: task.deadline,
      estimatedTime: task.estimatedTime,
      bookmarked: task.bookmarked,
      completed: false,
    });
  };

  // Filter tasks (exclude completed ones and respect priority range)
  const availableTasks = tasks.filter(task =>
    !task.completed &&
    task.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (filterCategory === '' || task.category === filterCategory) &&
    (filterPriority === '' || task.priority.toString() === filterPriority) &&
    // Priorité facultative : tâche sans priorité (0) toujours visible.
    (task.priority === 0 || (task.priority >= priorityRange[0] && task.priority <= priorityRange[1]))
  );

  // Tâches d'équipe assignées — mêmes filtres de recherche/priorité que les
  // tâches perso ; `filterCategory` référence un id de catégorie PERSO, donc
  // il ne matche jamais une tâche d'équipe (sa catégorie vient d'une autre
  // table) — comportement voulu : filtrer par catégorie perso exclut le pro.
  const availableTeamTasks = filterCategory === '' ? myTeamTasks.filter(task =>
    task.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (filterPriority === '' || task.priority.toString() === filterPriority) &&
    (task.priority === 0 || (task.priority >= priorityRange[0] && task.priority <= priorityRange[1]))
  ) : [];

  type SidebarItem =
    | { source: 'perso'; id: string; task: Task }
    | { source: 'pro'; id: string; task: TeamTask };

  const sidebarItems: SidebarItem[] = [
    ...(sourceFilter !== 'pro' ? availableTasks.map((task): SidebarItem => ({ source: 'perso', id: task.id, task })) : []),
    ...(sourceFilter !== 'perso' ? availableTeamTasks.map((task): SidebarItem => ({ source: 'pro', id: task.id, task })) : []),
  ];

  const getCategoryColor = (category: string) => {
    return categories.find(cat => cat.id === category)?.color || '#6B7280';
  };

  const getTeamCategoryColor = (categoryId: string | null | undefined) =>
    teamCategories.find(cat => cat.id === categoryId)?.color || '#6B7280';

  const getTeamCategoryName = (categoryId: string | null | undefined) =>
    teamCategories.find(cat => cat.id === categoryId)?.name || t('sidebar.uncategorized');

  const getPriorityColor = (priority: number) => {
    const colors = {
      1: 'bg-red-200 text-red-900',
      2: 'bg-orange-100 text-orange-800',
      3: 'bg-yellow-100 text-yellow-800',
      4: 'bg-blue-100 text-blue-800',
      5: 'bg-purple-100 text-purple-800'
    };
    return colors[priority as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const isTaskPlacedInCalendar = (taskId: string) => {
    return events.some(event => event.taskId === taskId);
  };

    return (
      <div
        id="agenda-task-sidebar-dropzone"
        className="w-56 lg:w-72 lg:sm:w-80 border-r flex flex-col h-full relative"
        style={{ backgroundColor: 'rgb(var(--nav-bg))', borderColor: 'rgb(var(--nav-border))' }}
      >
        {/* Sidebar Header */}
      <div className="p-4 border-b" style={{ borderColor: 'rgb(var(--nav-border))' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>{t('sidebar.title')}</h2>
          <div className="flex items-center gap-1">
            {/* Le bouton d'ajout n'est plus ici : il vit maintenant en haut à
                droite de la section où les tâches s'affichent (juste au-dessus
                de la liste), à côté des chips Tout/Perso/Pro. */}
            {onClose && (
              <button
                onClick={onClose}
                aria-label={t('sidebar.close')}
                className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                style={{ color: 'rgb(var(--color-text-secondary))' }}
              >
                <X size={20} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        
        {/* Search */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2" style={{ color: 'rgb(var(--color-text-muted))' }} />
          <input
            type="text"
            placeholder={t('sidebar.search')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            style={{ 
              backgroundColor: 'rgb(var(--color-surface))',
              borderColor: 'rgb(var(--color-border))',
              color: 'rgb(var(--color-text-primary))'
            }}
          />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 gap-2">
          <div className="relative">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              aria-label={t('sidebar.filterCategory')}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors appearance-none cursor-pointer pr-8"
              style={{
                backgroundColor: 'rgb(var(--color-surface))',
                borderColor: 'rgb(var(--color-border))',
                color: 'rgb(var(--color-text-primary))'
              }}
            >
              <option value="">{t('sidebar.allCategories')}</option>
              {/* Un `<option>` natif ne peut porter ni icône ni bouton : un
                  chevron repliable est impossible ici, contrairement aux
                  autres sélecteurs de catégorie de l'app. Seule l'indentation
                  (espaces insécables, `depth * 2`) reste possible pour
                  signaler une sous-catégorie. */}
              {categoryOptionRows.map(({ category, depth }) => (
                <option key={category.id} value={category.id}>
                  {'  '.repeat(depth)}{category.name}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" style={{ color: 'rgb(var(--color-text-muted))' }} />
          </div>

          <div className="relative">
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              aria-label={t('sidebar.filterPriority')}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors appearance-none cursor-pointer pr-8"
              style={{
                backgroundColor: 'rgb(var(--color-surface))',
                borderColor: 'rgb(var(--color-border))',
                color: 'rgb(var(--color-text-primary))'
              }}
            >
              <option value="">{t('sidebar.allPriorities')}</option>
              <option value="1">{t('sidebar.priority', { level: 1 })}</option>
              <option value="2">{t('sidebar.priority', { level: 2 })}</option>
              <option value="3">{t('sidebar.priority', { level: 3 })}</option>
              <option value="4">{t('sidebar.priority', { level: 4 })}</option>
              <option value="5">{t('sidebar.priority', { level: 5 })}</option>
            </select>
            <ChevronDown size={16} className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" style={{ color: 'rgb(var(--color-text-muted))' }} />
          </div>
        </div>
      </div>

      {/* Barre « Tout / Perso / Pro » + ajout — au-dessus de la liste, pas
          dans l'en-tête (déplacement demandé : le + reste près de ce sur
          quoi il agit). */}
      <div className="px-4 pt-3 pb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1" role="group" aria-label={t('sidebar.sourceFilterAria')}>
          {([
            ['all', t('sidebar.sourceAll')],
            ['perso', t('sidebar.sourcePerso')],
            ['pro', t('sidebar.sourcePro')],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSourceFilter(value)}
              aria-pressed={sourceFilter === value}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                sourceFilter === value
                  ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]'
                  : 'hover:bg-[rgb(var(--color-hover))]'
              }`}
              style={sourceFilter === value ? undefined : { color: 'rgb(var(--color-text-secondary))' }}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowCreateTask(true)}
          aria-label={t('sidebar.addTask')}
          title={t('sidebar.addTask')}
          className="shrink-0 p-1.5 rounded-md hover:bg-[rgb(var(--color-hover))] transition-colors"
          style={{ color: 'rgb(var(--color-text-secondary))' }}
        >
          <Plus size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Tasks List Container for External Events */}
      <div id="external-events-container" className="flex-1 overflow-y-auto p-4 pt-2 space-y-3">
        {sidebarItems.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'rgb(var(--color-text-muted))' }}>
            <Filter size={48} className="mx-auto mb-2" style={{ color: 'rgb(var(--color-text-muted))' }} />
            <p>{t('sidebar.noResults')}</p>
          </div>
        ) : (
          sidebarItems.map((item, idx) => {
            if (item.source === 'pro') {
              const task = item.task;
              return (
                <TeamTaskCard
                  key={task.id}
                  task={task}
                  categoryColor={getTeamCategoryColor(task.categoryId)}
                  categoryName={getTeamCategoryName(task.categoryId)}
                  priorityClassName={getPriorityColor(task.priority)}
                  formatDuration={formatDuration}
                  onDragStart={onDragStart}
                  isFirst={idx === 0}
                />
              );
            }

            const task = item.task;
            const isPlaced = isTaskPlacedInCalendar(task.id);

            return (
              <PersonalTaskCard
                key={task.id}
                task={task}
                isPlaced={isPlaced}
                isFirst={idx === 0}
                categoryColor={getCategoryColor(task.category)}
                categoryLabel={colorSettings[task.category] || t('sidebar.uncategorized')}
                priorityClassName={getPriorityColor(task.priority)}
                collaboratorIds={collaboratorsByTask.get(task.id) ?? []}
                friends={friends}
                formatDuration={formatDuration}
                onOpen={() => {
                  // Un long-press vient d'ouvrir le menu : ne pas ouvrir la modale.
                  if (longPressFired.current) { longPressFired.current = false; return; }
                  setSelectedTaskForModal(task);
                }}
                onOpenContextMenu={(x, y) => openContextMenu(task, x, y)}
                onDragStart={onDragStart}
                onLongPressStart={(e) => startLongPress(e, task)}
                onPressMove={onPressMove}
                onPressEnd={cancelLongPress}
              />
            );
          })
        )}
      </div>
      {/* Instructions */}
      {showTutorial ? (
        <div className="p-4 border-t relative group/tuto" style={{ borderColor: 'rgb(var(--nav-border))', backgroundColor: 'rgb(var(--color-hover))' }}>
          <button
            onClick={() => setShowTutorial(false)}
            className="absolute top-2 right-2 p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors opacity-60 hover:opacity-100"
            style={{ color: 'rgb(var(--color-text-muted))' }}
            title={t('sidebar.help.closeTutorial')}
          >
            <X size={14} />
          </button>
          <div className="text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
            <p className="font-medium mb-1 flex items-center gap-1.5 md:block">
              <Lightbulb size={13} className="shrink-0 md:hidden" aria-hidden="true" />
              <span className="md:hidden">{t('sidebar.help.heading')}</span>
              <span className="hidden md:inline">💡 {t('sidebar.help.heading')}</span>
            </p>
            <p>{t('sidebar.help.step1')}</p>
            <p>{t('sidebar.help.step2')}</p>
            <p>{t('sidebar.help.step3')}</p>
          </div>
        </div>
      ) : (
        <div className="px-3 py-2 border-t flex justify-end" style={{ borderColor: 'rgb(var(--nav-border))' }}>
          <button
            onClick={() => setShowTutorial(true)}
            className="min-w-11 min-h-11 sm:min-w-0 sm:min-h-0 flex items-center justify-center rounded-full transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            title={t('sidebar.help.showGuide')}
            aria-label={t('sidebar.help.showGuideAria')}
          >
            <span
              className="w-7 h-7 flex items-center justify-center rounded-full border"
              style={{ borderColor: 'rgb(var(--color-border))', color: 'rgb(var(--color-text-muted))' }}
            >
              <Info size={16} />
            </span>
          </button>
        </div>
      )}

        {contextMenu && (
          <TaskContextMenu
            contextMenu={contextMenu}
            isLinkedToCalendar={isTaskPlacedInCalendar(contextMenu.task.id)}
            linkedEventCount={linkedEventCount(contextMenu.task.id)}
            onEdit={handleEditTask}
            onDuplicate={handleDuplicateTask}
            onDeleteLinkedEvents={handleDeleteLinkedEvent}
            onDelete={handleDeleteTask}
          />
        )}

        {selectedTaskForModal && (
          <TaskModal
            task={selectedTaskForModal}
            isOpen={!!selectedTaskForModal}
            onClose={() => setSelectedTaskForModal(null)}
          />
        )}

        <TaskModal
          isOpen={showCreateTask}
          onClose={() => setShowCreateTask(false)}
          isCreating={true}
        />
      </div>
    );
  };
  
  export default TaskSidebar;
