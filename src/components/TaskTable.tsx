import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { Bookmark, BookmarkCheck, CheckCircle2, CheckSquare, AlertTriangle, Users, X, Trash2, ListPlus, MoreHorizontal, Tag, CalendarClock, ArrowLeft, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useBilling } from '@/modules/billing/billing.context';
import TaskModal from './TaskModal';
import BulkAddToListModal from './add-to-list/BulkAddToListModal';
import ScheduleEventModal from './ScheduleEventModal';
import AddToListModal from './AddToListModal';
import { VirtualizedTaskList, TaskRow, type UnifiedTaskRow } from './task-table/list';
import { TeamTaskRowLite } from './task-table/TeamTaskRowLite';
import TeamTaskModal from './organization/TeamTaskModal';
import { myAssignedTasks } from './organization/team-projects.helpers';

// ═══════════════════════════════════════════════════════════════════
// Module tasks - Hooks indépendants (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { showUndoToast } from '@/lib/undo-toast';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  useTasks,
  useDeleteTask,
  useCreateTask,
  useUpdateTask,
  useToggleTaskComplete,
  useToggleTaskBookmark,
  taskKeys,
  Task
} from '@/modules/tasks';

import { usePriorityRange } from '@/modules/ui-states';
import { filterAndSortTasks } from '@/modules/tasks/task-filtering';
import { getSnoozeOptions } from '@/modules/tasks/snooze';
import { isTaskOverdue } from './task-table/helpers';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useLists, useAddTaskToList } from '@/modules/lists';
import { useCategories } from '@/modules/categories';
import { useFriends, useCollaboratorsByTask, usePendingCollaboratorTaskIds, useUnshareTask } from '@/modules/friends';
import { useAuth } from '@/modules/auth/AuthContext';
import { useIsDemo } from '@/lib/app-mode.store';
import { useT } from '@/i18n/useT';
import { useActiveOrganization, useOrgMembers } from '@/modules/organizations';
import { useTeamProjects, useTeamTasks, useUpdateTeamTask, type TeamTask, type UpdateTeamTaskInput } from '@/modules/team-projects';

type TaskTableProps = {
  tasks?: Task[];
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  onSortDirectionChange?: (direction: 'asc' | 'desc') => void;
  showCompleted?: boolean;
  selectedTaskId?: string | null;
  onTaskModalClose?: () => void;
  addToListMode?: boolean;
  selectedForListIds?: string[];
  onToggleTaskForList?: (taskId: string) => void;
  showQuickFilters?: boolean;
  /** Terme de recherche de la page — filtre aussi les tâches d'équipe fusionnées. */
  searchTerm?: string;
};


const TaskTable: React.FC<TaskTableProps> = ({
  tasks: propTasks,
  sortField: propSortField,
  sortDirection = 'asc',
  onSortDirectionChange,
  showCompleted = false,
  selectedTaskId: externalSelectedTaskId,
  onTaskModalClose,
  addToListMode = false,
  selectedForListIds = [],
  onToggleTaskForList,
  showQuickFilters = true,
  searchTerm = '',
}) => {
  const { t, tp } = useT('tasks');
  const { t: tCommon } = useT('common');
  // ═══════════════════════════════════════════════════════════════════
  // TASKS - Depuis le module tasks (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: moduleTasks = [], isLoading: isLoadingTasks } = useTasks();
  const deleteMutation = useDeleteTask();
  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();
  const toggleCompleteMutation = useToggleTaskComplete();
  const toggleBookmarkMutation = useToggleTaskBookmark();

  const { priorityRange } = usePriorityRange();
  const { isPremium } = useBilling();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDemo = useIsDemo();
  const queryClient = useQueryClient();
  const { data: friends = [] } = useFriends();
  const collaboratorsByTask = useCollaboratorsByTask(user?.id);
  const pendingCollaboratorTaskIds = usePendingCollaboratorTaskIds(user?.id);
  const unshareTaskMutation = useUnshareTask();

  // ═══════════════════════════════════════════════════════════════════
  // Fusion tâches d'équipe (mode entreprise) — assignées à moi, injectées
  // dans la même liste que les tâches perso avec une distinction visuelle
  // forte (fond indigo) et un jeu d'actions restreint (cf. TeamTaskRowLite).
  // ═══════════════════════════════════════════════════════════════════
  const { activeOrg } = useActiveOrganization();
  const orgId = activeOrg?.id;
  const { data: teamProjects = [] } = useTeamProjects(orgId);
  const { data: allTeamTasks = [] } = useTeamTasks(orgId);
  const { data: orgMembers = [] } = useOrgMembers(orgId);
  const updateTeamTaskMutation = useUpdateTeamTask(orgId ?? '');
  const [editingTeamTask, setEditingTeamTask] = useState<TeamTask | null>(null);
  const [scopeFilter, setScopeFilter] = useState<'all' | 'perso' | 'entreprise'>('all');

  const teamProjectsById = useMemo(
    () => new Map(teamProjects.map((p) => [p.id, p])),
    [teamProjects],
  );

  const handleToggleTeamComplete = useCallback((task: TeamTask) => {
    updateTeamTaskMutation.mutate({ taskId: task.id, input: { completed: !task.completed } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const modalUpdateTeamTask = (taskId: string, input: UpdateTeamTaskInput) =>
    updateTeamTaskMutation.mutateAsync({ taskId, input });

  // Utiliser propTasks si fourni, sinon les tasks du module
  const tasks = propTasks || moduleTasks;

  const [localSortField, setLocalSortField] = useState<string | undefined>(propSortField);

  useEffect(() => {
    if (propSortField) {
      setLocalSortField(propSortField);
    }
  }, [propSortField]);

  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [selectedTaskForCollaborators, setSelectedTaskForCollaborators] = useState<string | null>(null);
  const [addToListTask, setAddToListTask] = useState<string | null>(null);
  const [taskToEventModal, setTaskToEventModal] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [showCreateFromEmpty, setShowCreateFromEmpty] = useState(false);

  // Sélection multiple (#10) : réutilise le rendu checkbox du mode
  // « ajout à une liste » (addToListMode) pour un mode générique avec barre
  // d'actions groupées (compléter / ajouter à une liste / supprimer).
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Modal d'ajout groupé à une liste (#23) — remplace l'ancien DropdownMenu
  // (désactivé quand aucune liste manuelle → bouton « Liste » sans réaction).
  const [showBulkListModal, setShowBulkListModal] = useState(false);
  // Modal de confirmation bloquant pour la suppression groupée (#10).
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  // Nombre de tâches figé à l'ouverture du modal : bulkAddToList vide la
  // sélection, on évite un « 0 tâche » qui clignoterait pendant la fermeture.
  const [bulkModalCount, setBulkModalCount] = useState(0);
  const { data: allLists = [] } = useLists();
  const { data: categories = [] } = useCategories();
  const addTaskToListMutation = useAddTaskToList();

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }, []);

  // Menu « ⋯ » de la barre d'actions groupées : actions supplémentaires
  // (modifier la catégorie / la deadline des tâches sélectionnées).
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [bulkMenuView, setBulkMenuView] = useState<'root' | 'category'>('root');

  const exitSelectMode = () => { setSelectMode(false); setSelectedIds([]); setBulkMenuOpen(false); };
  const [activeQuickFilter, setActiveQuickFilter] = useState<'none' | 'bookmarked' | 'completed' | 'overdue' | 'collaboration'>('none');

  const toggleQuickFilter = (filter: 'bookmarked' | 'completed' | 'overdue' | 'collaboration') => {
    setActiveQuickFilter(prev => prev === filter ? 'none' : filter);
  };

  useEffect(() => {
    if (externalSelectedTaskId) {
      setSelectedTask(externalSelectedTaskId);
    }
  }, [externalSelectedTaskId]);

  const handleCloseTaskModal = () => {
    setSelectedTask(null);
    if (onTaskModalClose) {
      onTaskModalClose();
    }
  };

  const handleSort = (field: string) => {
    if (localSortField === field) {
      onSortDirectionChange?.(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setLocalSortField(field);
      onSortDirectionChange?.('asc');
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // Handlers avec mutations (MIGRÉ) - MÉMOÏSÉS pour performance
  // ═══════════════════════════════════════════════════════════════════
  const handleToggleComplete = useCallback((taskId: string) => {
    toggleCompleteMutation.mutate(taskId);
  }, [toggleCompleteMutation]);

  const handleToggleBookmark = useCallback((taskId: string) => {
    toggleBookmarkMutation.mutate(taskId);
  }, [toggleBookmarkMutation]);

  // Duplique une tâche : nouvelle tâche pré-remplie « (copie) », non complétée.
  const handleDuplicate = useCallback((taskId: string) => {
    const t = tasks.find(x => x.id === taskId);
    if (!t) return;
    createMutation.mutate({
      name: `${t.name} (copie)`,
      priority: t.priority,
      category: t.category,
      deadline: t.deadline,
      estimatedTime: t.estimatedTime,
      bookmarked: t.bookmarked,
      completed: false,
    });
  }, [tasks, createMutation]);

  // Hint de découvrabilité des gestes (mobile) — affiché une fois, dismissable.
  const [swipeHintDismissed, setSwipeHintDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem('cosmo_swipe_hint_dismissed') === '1'; } catch { return false; }
  });
  const dismissSwipeHint = () => {
    setSwipeHintDismissed(true);
    try { localStorage.setItem('cosmo_swipe_hint_dismissed', '1'); } catch { /* ignore */ }
  };

  // Filtrage et tri mémoïsés — logique pure extraite (task-filtering.ts, testée).
  const filteredAndSortedTasks = useMemo(
    () => filterAndSortTasks({
      tasks,
      quickFilter: activeQuickFilter,
      showCompleted,
      priorityRange,
      sortField: localSortField,
      sortDirection,
    }),
    [tasks, activeQuickFilter, showCompleted, priorityRange, localSortField, sortDirection],
  );

  const sortedTasks = filteredAndSortedTasks;

  // ── Tâches d'équipe assignées à moi, filtrées comme les tâches perso ──
  // Les filtres perso (favoris/retard/collaboration) n'ont pas d'équivalent
  // côté équipe : quand l'un d'eux est actif, on masque les tâches d'équipe
  // plutôt que d'afficher une liste qu'aucun de ces filtres ne décrit.
  const teamTasksVisibleForQuickFilter = activeQuickFilter === 'none' || activeQuickFilter === 'completed';
  const teamCompletedState = activeQuickFilter === 'completed' ? true : showCompleted;

  const myTeamTasks = useMemo(() => {
    if (!user || !teamTasksVisibleForQuickFilter) return [];
    let result = myAssignedTasks(allTeamTasks, user.id).filter((t) => t.completed === teamCompletedState);
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter((t) => t.name.toLowerCase().includes(lower));
    }
    result = result.filter((t) => t.priority >= priorityRange[0] && t.priority <= priorityRange[1]);
    return result;
  }, [allTeamTasks, user, teamTasksVisibleForQuickFilter, teamCompletedState, searchTerm, priorityRange]);

  const scopedPersoTasks = useMemo(
    () => (scopeFilter === 'entreprise' ? [] : sortedTasks),
    [scopeFilter, sortedTasks],
  );
  const scopedTeamTasks = useMemo(
    () => (scopeFilter === 'perso' ? [] : myTeamTasks),
    [scopeFilter, myTeamTasks],
  );

  // Fusion triée : mêmes clés de tri que compareTasks (task-filtering.ts),
  // adaptées aux deux formes (Task / TeamTask). Les champs sans équivalent
  // côté équipe (catégorie, date de création) laissent l'ordre d'insertion
  // (perso d'abord) — cas secondaire, non prioritaire ici.
  const unifiedRows: UnifiedTaskRow[] = useMemo(() => {
    const rows: UnifiedTaskRow[] = [
      ...scopedPersoTasks.map((task) => ({ kind: 'perso' as const, id: task.id, task })),
      ...scopedTeamTasks.map((task) => ({
        kind: 'entreprise' as const,
        id: task.id,
        task,
        project: teamProjectsById.get(task.projectId),
      })),
    ];

    if (!localSortField) return rows;

    const sortValue = (row: UnifiedTaskRow) => {
      const t = row.task;
      switch (localSortField) {
        case 'name': return t.name;
        case 'priority': return t.priority;
        case 'deadline': return t.deadline ? new Date(t.deadline).getTime() : Number.POSITIVE_INFINITY;
        case 'estimatedTime': return t.estimatedTime ?? 0;
        case 'completedAt': return showCompleted && t.completedAt ? new Date(t.completedAt).getTime() : 0;
        default: return 0;
      }
    };

    return [...rows].sort((a, b) => {
      const va = sortValue(a);
      const vb = sortValue(b);
      const comparison = typeof va === 'string' && typeof vb === 'string'
        ? va.localeCompare(vb)
        : (va as number) - (vb as number);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [scopedPersoTasks, scopedTeamTasks, teamProjectsById, localSortField, sortDirection, showCompleted]);

  const selectedTaskData = tasks.find(task => task.id === selectedTask);
  const selectedTaskForCollaboratorsData = tasks.find(task => task.id === selectedTaskForCollaborators);

  const handleOpenCollaborator = useCallback((taskId: string) => {
    if (!isPremium()) {
      navigate('/premium');
      return;
    }
    // Réutilise la vue « Collaborateurs » de TaskModal (étape 2 de création)
    // au lieu d'un second popup dédié — une seule UI de partage.
    setSelectedTaskForCollaborators(taskId);
  }, [isPremium, navigate]);

  const deleteTaskById = (taskId: string) => {
    // Snapshot la tâche AVANT suppression pour permettre l'undo
    const taskSnapshot = tasks.find(t => t.id === taskId);

    // Tâche collaborative REÇUE (prod) : on n'en est pas propriétaire, la RLS
    // bloque le DELETE (qui échouait en silence → la tâche réapparaissait). On
    // retire plutôt notre accès (quitter la tâche) en supprimant la grant.
    const isReceivedProd =
      !isDemo && !!taskSnapshot?.userId && !!user?.id && taskSnapshot.userId !== user.id;
    if (isReceivedProd && user?.id) {
      unshareTaskMutation.mutate(
        { taskId, friendId: user.id },
        {
          onSuccess: () => {
            setTaskToDelete(null);
            queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
            toast.success(t('toast.leftShared'));
          },
          onError: (err) => console.error('Leave shared task failed', err),
        }
      );
      return;
    }

    deleteMutation.mutate(taskId, {
      onSuccess: () => {
        setTaskToDelete(null);
        if (taskSnapshot) {
          showUndoToast(t('toast.deleted'), () => {
            // Recrée la tâche avec les mêmes champs (nouvel id généré côté repo)
            const { id: _id, createdAt: _ca, ...rest } = taskSnapshot;
            createMutation.mutate(rest);
          });
        }
      },
      onError: (err) => console.error('Delete failed', err),
    });
  };

  const confirmDelete = () => {
    if (taskToDelete) deleteTaskById(taskToDelete);
  };

  // Tâche perso : suppression directe, réversible via le toast « Annuler ».
  // La popup de confirmation n'est gardée que pour les tâches collaboratives
  // ou reçues (impact sur d'autres personnes, partages non restaurés).
  const handleDeleteRequest = useCallback((taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    const isReceivedProd =
      !isDemo && !!task?.userId && !!user?.id && task.userId !== user.id;
    if (task?.isCollaborative || isReceivedProd) {
      setTaskToDelete(taskId);
    } else {
      deleteTaskById(taskId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, isDemo, user?.id]);

  const handleSelectTask = useCallback((id: string) => {
    setSelectedTaskForCollaborators(null);
    setSelectedTask(id);
  }, []);

  // Snooze (#8) : reporte la deadline (mutation optimiste → effet immédiat).
  const handleSnooze = useCallback((taskId: string, deadline: string) => {
    updateMutation.mutate({ id: taskId, updates: { deadline } });
    toast.success(t('toast.postponed'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Section « En retard » (#9) : tâches non complétées à deadline dépassée.
  const overdueTasks = useMemo(
    () => tasks.filter(t => isTaskOverdue(t.deadline, t.completed)),
    [tasks]
  );

  const handleSnoozeAllOverdue = (deadline: string) => {
    overdueTasks.forEach(t => updateMutation.mutate({ id: t.id, updates: { deadline } }));
    toast.success(tp('toast.rescheduled', overdueTasks.length));
  };

  // « Choisir une date… » : input date natif hors du menu (le menu Radix se
  // ferme au clic, l'input doit donc survivre à la fermeture).
  const snoozeDateInputRef = useRef<HTMLInputElement>(null);
  const openSnoozeDatePicker = () => {
    const input = snoozeDateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      try { input.showPicker(); return; } catch { /* fallback below */ }
    }
    input.click();
  };

  // ── Actions groupées du mode sélection (#10) ──
  const bulkComplete = () => {
    const toComplete = tasks.filter(t => selectedIds.includes(t.id) && !t.completed);
    toComplete.forEach(t => toggleCompleteMutation.mutate(t.id));
    toast.success(tp('toast.completedCount', toComplete.length));
    exitSelectMode();
  };

  const bulkAddToList = (listId: string) => {
    selectedIds.forEach(taskId => addTaskToListMutation.mutate({ taskId, listId }));
    const listName = allLists.find(l => l.id === listId)?.name ?? 'la liste';
    toast.success(tp('toast.addedToList', selectedIds.length, { list: listName }));
    exitSelectMode();
  };

  const confirmBulkDelete = () => {
    const selected = tasks.filter(t => selectedIds.includes(t.id));

    // Tâches REÇUES (prod) : on n'en est pas propriétaire, la RLS bloque le
    // DELETE. On quitte plutôt le partage (unshare) — non restaurable via undo.
    const received = selected.filter(t =>
      !isDemo && !!t.userId && !!user?.id && t.userId !== user.id
    );
    // Tout le reste (perso + collaboratives dont on est propriétaire) : DELETE
    // classique, réversible via le toast « Annuler ».
    const ownedSnapshots = selected.filter(t => !received.includes(t));

    received.forEach(t => {
      if (user?.id) unshareTaskMutation.mutate({ taskId: t.id, friendId: user.id });
    });
    ownedSnapshots.forEach(t => deleteMutation.mutate(t.id));

    if (ownedSnapshots.length > 0) {
      showUndoToast(tp('toast.deletedCount', ownedSnapshots.length), () => {
        ownedSnapshots.forEach(s => {
          const { id: _id, createdAt: _ca, ...rest } = s;
          createMutation.mutate(rest);
        });
      });
    } else if (received.length > 0) {
      toast.success(tp('toast.leftSharedCount', received.length));
    }

    setShowBulkDeleteConfirm(false);
    exitSelectMode();
  };

  // Menu « ⋯ » : modification groupée de la catégorie / deadline.
  // `task.category` stocke l'ID de la catégorie (cf. seed démo `cat-1`..`cat-5`
  // + useCategoryLookup, qui indexe par id) — jamais le nom affiché.
  const bulkSetCategory = (categoryId: string, categoryName: string) => {
    selectedIds.forEach(id => updateMutation.mutate({ id, updates: { category: categoryId } }));
    toast.success(tp('toast.movedToCategory', selectedIds.length, { category: categoryName }));
    exitSelectMode();
  };

  const bulkSetDeadline = (deadline: string) => {
    selectedIds.forEach(id => updateMutation.mutate({ id, updates: { deadline } }));
    toast.success(tp('toast.deadlineUpdated', selectedIds.length));
    exitSelectMode();
  };

  // Input date natif hors du menu (même pattern que le snooze : le menu se
  // ferme au clic, l'input doit survivre à la fermeture pour showPicker()).
  const bulkDateInputRef = useRef<HTMLInputElement>(null);
  const openBulkDatePicker = () => {
    setBulkMenuOpen(false);
    const input = bulkDateInputRef.current;
    if (!input) return;
    if (typeof input.showPicker === 'function') {
      try { input.showPicker(); return; } catch { /* fallback below */ }
    }
    input.click();
  };



  // Le mode sélection (#10) réutilise le rendu checkbox du mode addToList.
  const effectiveAddToListMode = addToListMode || selectMode;
  const effectiveSelectedForListIds = selectMode ? selectedIds : selectedForListIds;
  const effectiveToggleForList = selectMode ? toggleSelected : onToggleTaskForList;

  return (
    <>
      {/* Tâches/listes partagées en attente : plus de bandeaux inline ici,
          regroupées dans TasksInboxMenu (en-tête, mobile ET desktop) — pour
          laisser toute la largeur au tableau. */}
      <div className={`${showQuickFilters ? 'flex' : 'hidden'} md:flex flex-col gap-4 mb-6`}>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => toggleQuickFilter('bookmarked')}
            className={`flex items-center gap-2 ${activeQuickFilter === 'bookmarked' ? '!bg-[rgb(var(--color-accent-solid))] hover:!bg-[rgb(var(--color-accent-solid-hover))] !text-[rgb(var(--color-accent-solid-foreground))] !border-[rgb(var(--color-accent-solid))]' : ''}`}
          >
            {activeQuickFilter === 'bookmarked' ? <BookmarkCheck size={20} data-icon="inline-start" /> : <Bookmark size={20} data-icon="inline-start" />}
            <span className="hidden sm:inline">{activeQuickFilter === 'bookmarked' ? tCommon('actions.all') : t('table.quickFilter.bookmarked')}</span>
            <span className="sm:hidden">{t('table.quickFilter.bookmarked')}</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => toggleQuickFilter('completed')}
            className={`flex items-center gap-2 ${activeQuickFilter === 'completed' ? '!bg-[rgb(var(--color-accent-solid))] hover:!bg-[rgb(var(--color-accent-solid-hover))] !text-[rgb(var(--color-accent-solid-foreground))] !border-[rgb(var(--color-accent-solid))]' : ''}`}
          >
            <CheckCircle2 size={20} data-icon="inline-start" />
            <span className="hidden sm:inline">{t('table.quickFilter.completed')}</span>
            <span className="sm:hidden">{t('table.quickFilter.completedShort')}</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => toggleQuickFilter('overdue')}
            className={`flex items-center gap-2 ${activeQuickFilter === 'overdue' ? '!bg-[rgb(var(--color-accent-solid))] hover:!bg-[rgb(var(--color-accent-solid-hover))] !text-[rgb(var(--color-accent-solid-foreground))] !border-[rgb(var(--color-accent-solid))]' : ''}`}
          >
            <AlertTriangle size={20} data-icon="inline-start" />
            <span className="hidden sm:inline">{t('table.quickFilter.overdue')}</span>
            <span className="sm:hidden">{t('table.quickFilter.overdue')}</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => toggleQuickFilter('collaboration')}
            className={`flex items-center gap-2 ${activeQuickFilter === 'collaboration' ? '!bg-[rgb(var(--color-accent-solid))] hover:!bg-[rgb(var(--color-accent-solid-hover))] !text-[rgb(var(--color-accent-solid-foreground))] !border-[rgb(var(--color-accent-solid))]' : ''}`}
          >
            <Users size={20} data-icon="inline-start" />
            <span className="hidden sm:inline">{t('table.quickFilter.collaboration')}</span>
            <span className="sm:hidden">{t('table.quickFilter.collaborationShort')}</span>
          </Button>

          {!addToListMode && (
            <Button
              variant="outline"
              onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
              className={`flex items-center gap-2 ${selectMode ? '!bg-[rgb(var(--color-accent-solid))] hover:!bg-[rgb(var(--color-accent-solid-hover))] !text-[rgb(var(--color-accent-solid-foreground))] !border-[rgb(var(--color-accent-solid))]' : ''}`}
            >
              <CheckSquare size={20} data-icon="inline-start" />
              <span>{selectMode ? t('table.cancelSelect') : t('table.select')}</span>
            </Button>
          )}

          {/* Tout / Perso / Entreprise — visible seulement avec une org active,
              sinon aucune tâche d'équipe ne peut jamais apparaître ici. */}
          {orgId && (
            <div
              role="group"
              aria-label={t('table.quickFilter.scopeAria')}
              className="inline-flex items-center rounded-lg border border-[rgb(var(--color-border))] p-0.5"
            >
              {(['all', 'perso', 'entreprise'] as const).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setScopeFilter(scope)}
                  aria-pressed={scopeFilter === scope}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    scopeFilter === scope
                      ? '!bg-[rgb(var(--color-accent-solid))] !text-[rgb(var(--color-accent-solid-foreground))]'
                      : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
                  }`}
                >
                  {t(`table.quickFilter.scope${scope === 'all' ? 'All' : scope === 'perso' ? 'Perso' : 'Entreprise'}`)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bandeau « En retard » (#9) : visible dès qu'une tâche a dépassé sa
          deadline — replanification groupée en un clic. */}
      {!addToListMode && !showCompleted && activeQuickFilter === 'none' && overdueTasks.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4 px-4 py-3 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10">
          <AlertTriangle size={18} className="text-red-500 shrink-0" aria-hidden="true" />
          <span className="flex-1 text-label sm:text-sm font-medium text-red-700 dark:text-red-300">
            {tp('table.overdueCount', overdueTasks.length)}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="px-3 min-h-touch sm:min-h-0 sm:py-1.5 rounded-lg text-label sm:text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                {t('table.rescheduleAllBtn')}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {getSnoozeOptions().map((opt) => (
                <DropdownMenuItem key={opt.id} onClick={() => handleSnoozeAllOverdue(opt.deadline)}>
                  {opt.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={openSnoozeDatePicker}>
                Choisir une date…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            ref={snoozeDateInputRef}
            type="date"
            min={new Date().toLocaleDateString('en-CA')}
            onChange={(e) => {
              if (!e.target.value) return;
              handleSnoozeAllOverdue(e.target.value);
              e.target.value = '';
            }}
            aria-label={t('table.rescheduleAll')}
            tabIndex={-1}
            className="absolute w-px h-px p-0 opacity-0 pointer-events-none"
          />
        </div>
      )}

      {/* Desktop View (Table) */}
      <div className="hidden md:block table-container shadow-sm overflow-x-auto">
        <table className="data-table w-full" style={{ minWidth: '1000px' }}>
          <thead>
            <tr className="">
              {/* A11y: empty <th> need a label for screen readers. */}
              <th className="px-2 py-3" style={{ width: '40px' }}><span className="sr-only">{t('table.colComplete')}</span></th>
              <th className="px-2 py-3" style={{ width: '48px' }}><span className="sr-only">{t('table.colCategoryColor')}</span></th>
              <th
                className="cursor-pointer px-2 py-3"
                onClick={() => handleSort('name')}
              >
                {t('table.colName')}
                {localSortField === 'name' && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th className="px-2 py-3" style={{ width: '150px' }}>{t('table.colCategory')}</th>
              <th 
                className="cursor-pointer text-center px-1 py-3"
                onClick={() => handleSort('priority')}
                style={{ width: '70px' }}
              >
                {t('table.colPriority')}
                {localSortField === 'priority' && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th
                className="cursor-pointer px-2 py-3"
                onClick={() => handleSort('deadline')}
                style={{ width: '100px' }}
              >
                {activeQuickFilter === 'completed' ? t('table.colValidationDate') : t('table.colDeadline')}
                {localSortField === 'deadline' && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
                <th 
                  className="cursor-pointer text-center px-1 py-3"
                  onClick={() => handleSort('estimatedTime')}
                  style={{ width: '70px' }}
                >
                  {t('table.colDuration')}
                  {localSortField === 'estimatedTime' && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              <th className="text-center px-1 py-3" style={{ width: '70px' }}>{t('table.colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {unifiedRows.map((row) => row.kind === 'perso' ? (
              <TaskRow
                key={row.id}
                task={row.task}
                addToListMode={effectiveAddToListMode}
                selectedForListIds={effectiveSelectedForListIds}
                activeQuickFilter={activeQuickFilter}
                showCompleted={showCompleted}
                onSelectTask={handleSelectTask}
                onToggleTaskForList={effectiveToggleForList}
                onToggleComplete={handleToggleComplete}
                onToggleBookmark={handleToggleBookmark}
                onScheduleTask={setTaskToEventModal}
                onAddToList={setAddToListTask}
                onOpenCollaborator={handleOpenCollaborator}
                onDuplicate={handleDuplicate}
                onDeleteTask={handleDeleteRequest}
                onSnooze={handleSnooze}
                collaboratorsByTask={collaboratorsByTask}
                pendingCollaboratorTaskIds={pendingCollaboratorTaskIds}
                friends={friends}
              />
            ) : (
              <TeamTaskRowLite
                key={row.id}
                task={row.task}
                project={row.project}
                onToggleComplete={handleToggleTeamComplete}
                onEdit={setEditingTeamTask}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile View (Cards) — virtualisé au-delà de 50 items */}
      <div className="md:hidden">
        {/* Hint de découvrabilité des gestes (affiché une fois) */}
        {!swipeHintDismissed && !addToListMode && unifiedRows.length > 0 && (
          <div
            className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg text-xs"
            style={{ backgroundColor: 'rgb(var(--color-hover))', color: 'rgb(var(--color-text-secondary))' }}
          >
            <span className="flex-1 flex items-center gap-1.5">
              <Lightbulb size={14} className="shrink-0" aria-hidden="true" />
              {t('table.gestureHint')}
            </span>
            <button
              type="button"
              onClick={dismissSwipeHint}
              aria-label="Masquer l'astuce"
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md hover:bg-[rgb(var(--color-surface))]"
              style={{ color: 'rgb(var(--color-text-muted))' }}
            >
              <X size={14} />
            </button>
          </div>
        )}
        <VirtualizedTaskList
          rows={unifiedRows}
          addToListMode={effectiveAddToListMode}
          selectedForListIds={effectiveSelectedForListIds}
          onToggleTaskForList={effectiveToggleForList}
          onToggleComplete={handleToggleComplete}
          onToggleBookmark={handleToggleBookmark}
          onOpenCollaborator={handleOpenCollaborator}
          onSelectTask={handleSelectTask}
          onAddToList={setAddToListTask}
          onDeleteTask={handleDeleteRequest}
          onScheduleTask={setTaskToEventModal}
          onDuplicate={handleDuplicate}
          onSnooze={handleSnooze}
          collaboratorsByTask={collaboratorsByTask}
          pendingCollaboratorTaskIds={pendingCollaboratorTaskIds}
          friends={friends}
          onToggleTeamComplete={handleToggleTeamComplete}
          onEditTeamTask={setEditingTeamTask}
        />
      </div>

      {unifiedRows.length === 0 && isLoadingTasks && (
        <div className="space-y-2 p-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-14 rounded-xl bg-[rgb(var(--color-hover))] animate-pulse" />
          ))}
        </div>
      )}

      {unifiedRows.length === 0 && !isLoadingTasks && (
        <div className="text-center py-12" style={{ color: 'rgb(var(--color-text-muted))' }}>
          <h3 className="text-xl font-semibold mb-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
            {showCompleted ? t('table.emptyCompleted') : t('table.empty')}
          </h3>
          <p className="text-sm">
            {showCompleted ? t('table.emptyCompletedHint') : t('table.emptyHint')}
          </p>
          {!showCompleted && !addToListMode && (
            <button
              type="button"
              onClick={() => setShowCreateFromEmpty(true)}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))] text-sm font-semibold transition-colors shadow-sm"
            >
              {t('table.createTask')}
            </button>
          )}
        </div>
      )}

      {/* Barre d'actions groupées du mode sélection (#10) */}
      <AnimatePresence>
        {selectMode && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-2xl border shadow-2xl"
            style={{
              bottom: 'calc(env(safe-area-inset-bottom) + 84px)',
              backgroundColor: 'rgb(var(--color-surface))',
              borderColor: 'rgb(var(--color-border))',
            }}
          >
            <span className="text-sm font-semibold whitespace-nowrap" style={{ color: 'rgb(var(--color-text-primary))' }}>
              {tp('table.selected', selectedIds.length)}
            </span>
            <Button size="sm" onClick={bulkComplete} disabled={selectedIds.length === 0} className="bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))]">
              <CheckCircle2 size={16} data-icon="inline-start" />
              <span className="hidden sm:inline">{t('table.complete')}</span>
            </Button>
            {/* Ouvre le modal d'ajout à une liste (#23) — toujours cliquable,
                même sans liste manuelle (le modal permet d'en créer une). */}
            <Button
              size="sm"
              variant="outline"
              disabled={selectedIds.length === 0}
              onClick={() => { setBulkModalCount(selectedIds.length); setShowBulkListModal(true); }}
            >
              <ListPlus size={16} data-icon="inline-start" />
              <span className="hidden sm:inline">{t('table.list')}</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowBulkDeleteConfirm(true)} disabled={selectedIds.length === 0} className="!text-red-500 hover:!bg-red-500/10">
              <Trash2 size={16} data-icon="inline-start" />
              <span className="hidden sm:inline">{t('table.delete')}</span>
            </Button>
            {/* « ⋯ » — actions supplémentaires : catégorie / deadline */}
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                disabled={selectedIds.length === 0}
                onClick={() => { setBulkMenuView('root'); setBulkMenuOpen(v => !v); }}
                aria-label="Plus d'actions"
                aria-haspopup="menu"
                aria-expanded={bulkMenuOpen}
              >
                <MoreHorizontal size={16} />
              </Button>
              <AnimatePresence>
                {bulkMenuOpen && (
                  <>
                    {/* Backdrop invisible : ferme le menu au clic en dehors */}
                    <div className="fixed inset-0 z-[60]" onClick={() => setBulkMenuOpen(false)} aria-hidden="true" />
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.97 }}
                      transition={{ duration: 0.12 }}
                      className="absolute bottom-full mb-2 right-0 z-[70] w-60 rounded-xl border shadow-2xl overflow-hidden"
                      style={{
                        backgroundColor: 'rgb(var(--color-surface))',
                        borderColor: 'rgb(var(--color-border))',
                      }}
                      role="menu"
                      aria-label={t('table.moreActions')}
                    >
                      {bulkMenuView === 'root' ? (
                        <>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => setBulkMenuView('category')}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left hover:bg-[rgb(var(--color-hover))] transition-colors"
                            style={{ color: 'rgb(var(--color-text-primary))' }}
                          >
                            <Tag size={15} style={{ color: 'rgb(var(--color-text-secondary))' }} aria-hidden="true" />
                            {t('table.editCategory')}
                          </button>
                          <div className="h-px" style={{ backgroundColor: 'rgb(var(--color-border))' }} />
                          <button
                            type="button"
                            role="menuitem"
                            onClick={openBulkDatePicker}
                            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left hover:bg-[rgb(var(--color-hover))] transition-colors"
                            style={{ color: 'rgb(var(--color-text-primary))' }}
                          >
                            <CalendarClock size={15} style={{ color: 'rgb(var(--color-text-secondary))' }} aria-hidden="true" />
                            Modifier la deadline
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setBulkMenuView('root')}
                            className="w-full flex items-center gap-2 px-3.5 py-2 text-xs font-semibold uppercase tracking-wide hover:bg-[rgb(var(--color-hover))] transition-colors"
                            style={{ color: 'rgb(var(--color-text-muted))' }}
                            aria-label="Retour aux actions"
                          >
                            <ArrowLeft size={13} aria-hidden="true" /> {t('table.categoryBack')}
                          </button>
                          <div className="h-px" style={{ backgroundColor: 'rgb(var(--color-border))' }} />
                          <div className="max-h-56 overflow-y-auto">
                            {categories.length === 0 ? (
                              <p className="px-3.5 py-3 text-sm" style={{ color: 'rgb(var(--color-text-muted))' }}>
                                {t('table.noCategory')}
                              </p>
                            ) : (
                              categories.map((cat) => (
                                <button
                                  key={cat.id}
                                  type="button"
                                  role="menuitem"
                                  onClick={() => bulkSetCategory(cat.id, cat.name)}
                                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left hover:bg-[rgb(var(--color-hover))] transition-colors"
                                  style={{ color: 'rgb(var(--color-text-primary))' }}
                                >
                                  <span
                                    className="w-3 h-3 rounded-full shrink-0"
                                    style={{ backgroundColor: cat.color }}
                                    aria-hidden="true"
                                  />
                                  <span className="truncate">{cat.name}</span>
                                </button>
                              ))
                            )}
                          </div>
                        </>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
              {/* Input date natif — survit à la fermeture du menu (showPicker) */}
              <input
                ref={bulkDateInputRef}
                type="date"
                onChange={(e) => {
                  if (!e.target.value) return;
                  bulkSetDeadline(e.target.value);
                  e.target.value = '';
                }}
                aria-label={t('table.newDeadline')}
                tabIndex={-1}
                className="absolute w-px h-px p-0 opacity-0 pointer-events-none"
              />
            </div>
            <button
              type="button"
              onClick={exitSelectMode}
              aria-label={t('table.exitSelection')}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[rgb(var(--color-hover))] transition-colors"
              style={{ color: 'rgb(var(--color-text-muted))' }}
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal d'ajout groupé à une liste (#23) */}
      <BulkAddToListModal
        isOpen={showBulkListModal}
        onClose={() => setShowBulkListModal(false)}
        count={bulkModalCount}
        onAddToList={bulkAddToList}
      />

      {/* Création directe depuis l'état vide (#45) */}
      <TaskModal
        isOpen={showCreateFromEmpty}
        onClose={() => setShowCreateFromEmpty(false)}
        isCreating={true}
      />

      {selectedTaskData && (
        <TaskModal
          task={selectedTaskData}
          isOpen={!!selectedTask}
          onClose={handleCloseTaskModal}
        />
      )}

      {selectedTaskForCollaboratorsData && (
        <TaskModal
          task={selectedTaskForCollaboratorsData}
          isOpen={!!selectedTaskForCollaborators}
          onClose={() => setSelectedTaskForCollaborators(null)}
          showCollaborators={true}
        />
      )}

      {taskToEventModal && (
        <ScheduleEventModal
          open={true}
          onOpenChange={(o) => { if (!o) setTaskToEventModal(null); }}
          task={taskToEventModal}
        />
      )}

        <AnimatePresence>
        {taskToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60] sm:p-4"
            onClick={() => setTaskToDelete(null)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '110%', opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
              transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[rgb(var(--color-surface))] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm overflow-hidden border-t sm:border border-[rgb(var(--color-border))]"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="sm:hidden flex justify-center pt-4 pb-3">
                <div className="w-9 h-[5px] rounded-full bg-slate-300/70 dark:bg-slate-500/60" />
              </div>
              <div className="p-5 sm:p-6">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                  <Trash2 className="text-red-600 dark:text-red-400" size={24} />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-2">{t('table.deleteTitle')}</h3>
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-5 sm:mb-6">
                  {t('table.deleteBody')}
                </p>
                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                  <button
                    onClick={() => setTaskToDelete(null)}
                    className="flex-1 min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 dark:text-white border border-[rgb(var(--color-border))] hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="flex-1 min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-all shadow-md shadow-red-500/20"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Confirmation bloquante de la suppression groupée (#10) */}
        <AnimatePresence>
        {showBulkDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60] sm:p-4"
            onClick={() => setShowBulkDeleteConfirm(false)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '110%', opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
              transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[rgb(var(--color-surface))] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm overflow-hidden border-t sm:border border-[rgb(var(--color-border))]"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="sm:hidden flex justify-center pt-4 pb-3">
                <div className="w-9 h-[5px] rounded-full bg-slate-300/70 dark:bg-slate-500/60" />
              </div>
              <div className="p-5 sm:p-6">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                  <Trash2 className="text-red-600 dark:text-red-400" size={24} />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-2">
                  Supprimer {selectedIds.length} tâche{selectedIds.length > 1 ? 's' : ''}
                </h3>
                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-5 sm:mb-6">
                  {tp('table.bulkDeleteBody', selectedIds.length)}
                </p>
                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                  <button
                    onClick={() => setShowBulkDeleteConfirm(false)}
                    className="flex-1 min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 dark:text-white border border-[rgb(var(--color-border))] hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={confirmBulkDelete}
                    className="flex-1 min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-all shadow-md shadow-red-500/20"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>

        {addToListTask && (
          <AddToListModal
            isOpen={true}
            onClose={() => setAddToListTask(null)}
            taskId={addToListTask}
          />
        )}

        {editingTeamTask && (
          <TeamTaskModal
            task={editingTeamTask}
            projects={teamProjects.filter((p) => !p.archivedAt)}
            members={orgMembers}
            onUpdate={modalUpdateTeamTask}
            onClose={() => setEditingTeamTask(null)}
          />
        )}
    </>
  );
};

export default TaskTable;
