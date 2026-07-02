import { useState, useEffect, useRef, useMemo } from 'react';
import { useInvalidShake } from '@/hooks/use-invalid-shake';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { toast } from 'sonner';
import { showUndoToast } from '@/lib/undo-toast';

// ═══════════════════════════════════════════════════════════════════
// Module tasks - Hooks indépendants (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import {
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  Task,
} from '@/modules/tasks';

// ═══════════════════════════════════════════════════════════════════
// Module categories - (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useCategories, useCreateCategory } from '@/modules/categories';

// ═══════════════════════════════════════════════════════════════════
// Module lists - (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useLists, useAddTaskToList, useRemoveTaskFromList, useCreateList } from '@/modules/lists';

import { useFriends, useSendFriendRequest, useRejectFriendRequest, useShareTask, useUnshareTask, useTaskShares, useSentFriendRequests } from '@/modules/friends';

// ═══════════════════════════════════════════════════════════════════
// BillingContext — vérification premium côté serveur
// ═══════════════════════════════════════════════════════════════════
import { useAuth } from '@/modules/auth/AuthContext';

// Logique de validation pure extraite (cf. task-modal/validation.ts).
import {
  computeValidationErrors as computeValidationErrorsFor,
  isFormValid as isFormValidFor,
  isStep1Valid as isStep1ValidFor,
  missingStep1Fields as missingStep1FieldsFor,
} from './validation';
// Helpers d'identité/affichage des collaborateurs (cf. task-modal/collaborators.ts).
import {
  collabIdOf,
  filterFriendsForCollab,
  resolveCollaboratorDisplay,
} from './collaborators';
import { runTaskSave, createTaskWithShares } from './save-task';

export interface TaskModalProps {
  task?: Task;
  isOpen: boolean;
  onClose: () => void;
  isCreating?: boolean;
  showCollaborators?: boolean;
  initialData?: Partial<Task> & { isFromOKR?: boolean };
}

export function useTaskModal({ task, isOpen, onClose, isCreating = false, showCollaborators = false, initialData }: TaskModalProps) {
  // ═══════════════════════════════════════════════════════════════════
  // TASKS - Depuis le module tasks (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const createTaskMutation = useCreateTask();
  const updateTaskMutation = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();

  // Tâche créée à la volée pendant la création (clic « Générer le lien ») : une
  // fois persistée, la popup bascule en mode édition sur cette tâche (le lien a
  // besoin d'un task.id existant — FK share_links.task_id).
  const [createdTask, setCreatedTask] = useState<Task | null>(null);
  const effectiveTask: Task | undefined = task ?? createdTask ?? undefined;
  const effectiveIsCreating = isCreating && !createdTask;

  // ═══════════════════════════════════════════════════════════════════
  // CATEGORIES - Depuis le module categories (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: categories = [] } = useCategories();
  const createCategoryMutation = useCreateCategory();

  // ═══════════════════════════════════════════════════════════════════
  // LISTS - Depuis le module lists (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: lists = [] } = useLists();
  const addTaskToListMutation = useAddTaskToList();
  const removeTaskFromListMutation = useRemoveTaskFromList();
  const createListMutation = useCreateList();

  const { data: friends = [] } = useFriends();
  const { data: sentRequests = [] } = useSentFriendRequests();
  const shareTaskMutation = useShareTask();
  const unshareTaskMutation = useUnshareTask();
  const sendFriendRequestMutation = useSendFriendRequest();
  const cancelFriendRequestMutation = useRejectFriendRequest();

  const { user } = useAuth();

  // Propriétaire de la tâche : seul lui peut gérer les collaborateurs (la policy
  // RLS shared_tasks_insert exige auth.uid() = shared_by + propriété de la tâche).
  // Pour une nouvelle tâche, l'utilisateur courant est forcément propriétaire.
  // Pour une tâche reçue, `task.userId` = auth.uid du partageur ≠ moi.
  const isTaskOwner = !effectiveTask?.userId || effectiveTask.userId === user?.id;

  // shared_tasks est la source de vérité du partage (colonne `tasks.collaborators`
  // supprimée — migration 028). On dérive l'état « assignés » des grants.
  const { data: shares = [] } = useTaskShares(effectiveTask?.id);
  const existingShareIds = useMemo(() => shares.map((s) => s.friendId), [shares]);
  // friend_ids des collaborateurs n'ayant pas encore accepté → badge « Envoyé ».
  const pendingShareIds = useMemo(
    () => new Set(shares.filter((s) => !s.accepted).map((s) => s.friendId)),
    [shares]
  );
  const existingCollaboratorIds = useMemo(
    () => [...existingShareIds, ...(effectiveTask?.pendingInvites || [])],
    [existingShareIds, effectiveTask?.pendingInvites]
  );

  // Liste des collaborateurs à afficher selon le point de vue :
  //  - propriétaire → les destinataires (existingCollaboratorIds)
  //  - destinataire → le propriétaire (task.userId) + co-destinataires lisibles,
  //    en s'excluant soi-même (lecture seule).
  const seedCollaboratorIds = useMemo(() => {
    if (isTaskOwner) return existingCollaboratorIds;
    const ids = new Set<string>();
    if (effectiveTask?.userId && effectiveTask.userId !== user?.id) ids.add(effectiveTask.userId);
    existingShareIds.forEach((id) => { if (id !== user?.id) ids.add(id); });
    return [...ids];
  }, [isTaskOwner, existingCollaboratorIds, existingShareIds, effectiveTask?.userId, user?.id]);


  // Marqueur visuel (shake + bordure rouge) des champs requis non remplis
  // au clic sur un bouton de validation non validable (desktop).
  const { register: dRegister, trigger: dTrigger, clear: dClear, isInvalid: dInvalid } = useInvalidShake();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    priority: 0,
    category: '',
    deadline: '',
    estimatedTime: 0,
    completed: false,
    bookmarked: false,
    isFromOKR: false
  });

  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [okrFields, setOkrFields] = useState<Record<string, boolean>>({});

  // Collaborator state (integrated from AddTaskForm)
  const [collaborators, setCollaborators] = useState<string[]>([]);
  // L'utilisateur a-t-il explicitement modifié les collaborateurs ? Tant que
  // false, on re-synchronise `collaborators` depuis les grants shared_tasks
  // (même en cours d'édition d'autres champs) et on NE touche PAS aux partages
  // à la sauvegarde — évite de désassigner des collaborateurs à cause d'une
  // course entre le chargement async des grants et une édition (faille).
  const [collaboratorsDirty, setCollaboratorsDirty] = useState(false);
  const [pendingInvitesLocal, setPendingInvitesLocal] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [showCollaboratorSection, setShowCollaboratorSection] = useState(showCollaborators);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [step, setStep] = useState(1);
  // Les états inline de création catégorie/liste vivent dans TaskModalDesktopBody.

  const listColorOptions = [
    { value: 'blue', color: '#3B82F6' },
    { value: 'red', color: '#EF4444' },
    { value: 'green', color: '#10B981' },
    { value: 'purple', color: '#8B5CF6' },
    { value: 'orange', color: '#F97316' },
    { value: 'yellow', color: '#F59E0B' },
    { value: 'pink', color: '#EC4899' },
    { value: 'indigo', color: '#6366F1' },
  ];

  const collaboratorRef = useRef<HTMLDivElement>(null);
  const autoPromoteDoneRef = useRef<Set<string>>(new Set());

  // Close collaborator section on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      const isToggleButton = target.closest('[data-collaborator-toggle="true"]');
      if (showCollaboratorSection && collaboratorRef.current && !collaboratorRef.current.contains(target) && !isToggleButton) {
        setShowCollaboratorSection(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCollaboratorSection]);

  // Reset to step 1 ONLY when the modal opens. Putting `setStep(1)` inside
  // the form-init effect (with `lists`/`task` in its deps) caused the modal
  // to bounce back to step 1 every time a mutation invalidated the React
  // Query cache — typically when sending a friend request from step 2.
  useEffect(() => {
    // showCollaborators → ouvre directement l'étape 2 (Collaborateurs) sur
    // desktop, pour réutiliser cette vue comme popup de partage unique.
    if (isOpen) setStep(showCollaborators ? 2 : 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Initialize form data when task changes
  useEffect(() => {
    if (!isOpen) return;

    if (isCreating) {
      setFormData({
        name: initialData?.name || '',
        description: initialData?.description || '',
        priority: initialData?.priority || 0,
        category: initialData?.category || '',
        deadline: initialData?.deadline ? initialData.deadline.split('T')[0] : '',
        estimatedTime: initialData?.estimatedTime || 0,
        completed: initialData?.completed || false,
        bookmarked: initialData?.bookmarked || false,
        isFromOKR: initialData?.isFromOKR || false
      });

      if (initialData?.isFromOKR) {
        setOkrFields({
          name: !!initialData.name,
          category: !!initialData.category,
          estimatedTime: !!initialData.estimatedTime,
        });
      } else {
        setOkrFields({});
      }

        setCollaborators([]);
        setCollaboratorsDirty(false);
        setPendingInvitesLocal([]);
        setSelectedListIds([]);
      setHasChanges(false);
      setErrors({});
      setShowCollaboratorSection(showCollaborators);
    } else if (task) {
      setFormData({
        name: task.name || '',
        description: task.description || '',
        priority: task.priority ?? 0,
        category: task.category || '',
        deadline: task.deadline ? task.deadline.split('T')[0] : '',
        // Préserver 0 (= pas de durée) au lieu d'injecter un 30 min fantôme
        // qui se persistait silencieusement à la sauvegarde.
        estimatedTime: task.estimatedTime || 0,
        completed: task.completed || false,
        bookmarked: task.bookmarked || false,
        isFromOKR: (task as Task & { isFromOKR?: boolean }).isFromOKR || false
      });

      const isFromOKR = (task as Task & { isFromOKR?: boolean }).isFromOKR || false;
      if (isFromOKR) {
        setOkrFields({
          name: true,
          category: true,
          estimatedTime: true,
        });
      } else {
        setOkrFields({});
      }

      setCollaborators(existingCollaboratorIds);
        setCollaboratorsDirty(false);
        setPendingInvitesLocal(task.pendingInvites || []);

        const taskLists = lists.filter(l => l.taskIds.includes(task.id)).map(l => l.id);
      setSelectedListIds(taskLists);

      setHasChanges(false);
      setErrors({});
      setShowCollaboratorSection(showCollaborators || existingCollaboratorIds.length > 0 || false);
    }
    // Use `task?.id` and `lists.length` instead of full-object/full-array
    // references — those churn on every React Query refetch and would
    // wipe in-flight form edits. Also de-tied from `setStep` (see effect
    // above) so a friend-request mutation no longer kicks the user back
    // to step 1 mid-flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, task?.id, isCreating, showCollaborators, lists.length]);

  // Re-seed selected collaborators once shared_tasks grants load (the query
  // resolves async after open). Guarded on !hasChanges so it never clobbers
  // in-flight edits — shares are stale-stable during editing (no refetch on
  // focus), so this only fires for the initial load.
  useEffect(() => {
    if (!isOpen || !task || isCreating || collaboratorsDirty) return;
    setCollaborators(seedCollaboratorIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, task?.id, isCreating, collaboratorsDirty, seedCollaboratorIds.join(',')]);

  // Auto-promote pending invites that have since become friends
  useEffect(() => {
    if (!isOpen || !task || isCreating || !friends.length) return;
    const pending = task.pendingInvites ?? [];
    if (!pending.length) return;

    const toPromote = pending.filter(email => {
      const key = `${task.id}:${email}`;
      if (autoPromoteDoneRef.current.has(key)) return false;
      return friends.some(f => f.email.toLowerCase() === email.toLowerCase());
    });
    if (!toPromote.length) return;

    toPromote.forEach(email => autoPromoteDoneRef.current.add(`${task.id}:${email}`));

    const promotedNames: string[] = [];
    toPromote.forEach(email => {
      const friend = friends.find(f => f.email.toLowerCase() === email.toLowerCase());
      if (!friend) return;
      promotedNames.push(friend.name);
      // Le partage réel = ligne shared_tasks. Plus de colonne `collaborators`.
      shareTaskMutation.mutate({
        taskId: task.id,
        friendId: friend.userId ?? friend.id,
        friendEmail: friend.email,
        role: 'editor'
      });
    });

    const newPendingEmails = new Set(toPromote.map(e => e.toLowerCase()));
    const newPendingInvites = pending.filter(e => !newPendingEmails.has(e.toLowerCase()));

    updateTaskMutation.mutate({
      id: task.id,
      updates: {
        pendingInvites: newPendingInvites,
      }
    });
    toast.success(`🎉 ${promotedNames.join(', ')} ${promotedNames.length > 1 ? 'ont rejoint' : 'a rejoint'} la tâche !`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, task?.id, friends.length]);

  // Track changes
  useEffect(() => {
    if (!task) return;

    const hasFormChanges =
      formData.name !== task.name ||
      formData.priority !== task.priority ||
      formData.category !== task.category ||
      formData.deadline !== (task.deadline ? task.deadline.split('T')[0] : '') ||
      formData.estimatedTime !== task.estimatedTime ||
      formData.completed !== task.completed ||
      formData.bookmarked !== task.bookmarked ||
      JSON.stringify(collaborators) !== JSON.stringify(seedCollaboratorIds);

    setHasChanges(hasFormChanges);
  }, [formData, collaborators, task, seedCollaboratorIds]);

  // Validation rules — déléguées au module pur task-modal/validation.ts.
  const computeValidationErrors = (): { [key: string]: string } =>
    computeValidationErrorsFor(formData);

  const validateForm = () => {
    const newErrors = computeValidationErrors();
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Temps estimé et échéance sont facultatifs → ne bloquent jamais.
  const isFormValid = () => isFormValidFor(formData);

  const isStep1Valid = () => isStep1ValidFor(formData);

  // Liste des champs step 1 manquants — alimente le shake desktop.
  const missingStep1Fields = (): string[] => missingStep1FieldsFor(formData);

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (okrFields[field]) {
      setOkrFields(prev => ({ ...prev, [field]: false }));
    }

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }

    dClear(field);
  };

  const handleSave = async () => {
    await runTaskSave({
      isCreating: effectiveIsCreating, task: effectiveTask, formData, collaborators, collaboratorsDirty, pendingInvitesLocal, friends,
      lists, selectedListIds, isTaskOwner, existingShareIds,
      createTaskMutation, updateTaskMutation, addTaskToListMutation,
      removeTaskFromListMutation, shareTaskMutation, unshareTaskMutation,
      computeValidationErrors, setErrors, onClose,
    });
  };

  // Génère le lien d'invitation pendant la création : persiste la tâche (avec
  // ses collaborateurs déjà sélectionnés) puis bascule la popup en édition →
  // ShareLinkField reçoit alors un task.id et affiche le vrai lien.
  const onGenerateShareLink = async (): Promise<string | null> => {
    if (effectiveTask) return effectiveTask.id;
    const validationErrors = computeValidationErrors();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error(Object.values(validationErrors)[0]);
      setStep(1); // desktop : ramène à l'étape 1 pour voir l'erreur
      return null;
    }
    try {
      const t = await createTaskWithShares({
        formData, collaborators, pendingInvitesLocal, friends,
        createTaskMutation, shareTaskMutation,
      });
      setCreatedTask(t);
      setHasChanges(false);
      return t.id;
    } catch (err) {
      console.error('Error creating task for share link:', err);
      setErrors({ general: 'Erreur lors de la création. Veuillez réessayer.' });
      return null;
    }
  };

  const handleDelete = () => {
    if (!effectiveTask) return;
    // Tâche perso : suppression directe, réversible via le toast « Annuler »
    // (confirmDelete). La popup de confirmation n'est gardée que pour les
    // tâches collaboratives — la suppression impacte d'autres personnes et
    // l'annulation ne restaurerait pas les partages.
    if (effectiveTask.isCollaborative) {
      setShowDeleteConfirm(true);
    } else {
      confirmDelete();
    }
  };

  const confirmDelete = () => {
    if (effectiveTask) {
      const taskSnapshot = effectiveTask;
      deleteTaskMutation.mutate(effectiveTask.id, {
        onSuccess: () => {
          setShowDeleteConfirm(false);
          onClose();
          // Raccourci d'annulation (barre de progression 5 s, haut à droite).
          const { id: _id, createdAt: _ca, ...rest } = taskSnapshot;
          showUndoToast('Tâche supprimée', () => {
            createTaskMutation.mutate(rest);
          });
        },
        onError: (err) => {
          console.error('Error deleting task:', err);
          setErrors({ general: 'Erreur lors de la suppression. Veuillez réessayer.' });
          setShowDeleteConfirm(false);
        }
      });
    }
  };

  const handleClose = () => {
    onClose();
  };

  // Helpers d'identité/affichage des collaborateurs — logique pure extraite
  // dans task-modal/collaborators.ts (testée). On lie ici les dépendances d'état.
  const filteredFriends = filterFriendsForCollab(friends, collaborators, emailInput);
  const displayInfo = (id: string) =>
    resolveCollaboratorDisplay(id, { friends, sentRequests, pendingInvitesLocal });

  const handleAddEmail = () => {
    const value = emailInput.trim().toLowerCase();
    if (!value) return;

    const friend = friends.find(f => f.email.toLowerCase() === value);

    if (friend) {
      // Store the friend's auth.uid (via userId) so RLS / shared_tasks FK
      // accept it. Falls back to friend.id in demo mode.
      const collabId = collabIdOf(friend);
      if (!collaborators.includes(collabId)) {
        setCollaborators([...collaborators, collabId]);
        setCollaboratorsDirty(true);
      }
    } else {
      // Reject input that doesn't look like an email — prevents garbage
      // entries in `pendingInvites`. Faille D2.
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(value)) {
        setInputError('Utilisateur introuvable');
        return;
      }
      if (collaborators.includes(value)) {
        setEmailInput('');
        return;
      }
      sendFriendRequestMutation.mutate({ email: value });
      setCollaborators([...collaborators, value]);
      setCollaboratorsDirty(true);
      setPendingInvitesLocal([...pendingInvitesLocal, value]);
      // No immediate updateTaskMutation — deferred to handleSave() to avoid
      // cache invalidation that would set hasChanges=false.
    }
    setEmailInput('');
    setInputError(null);
  };

  const handleRemoveCollaborator = (collaboratorName: string) => {
    const newCollaborators = collaborators.filter((c) => c !== collaboratorName);
    setCollaborators(newCollaborators);
    setCollaboratorsDirty(true);
    const newPendingInvites = pendingInvitesLocal.filter(e => e !== collaboratorName);
    setPendingInvitesLocal(newPendingInvites);
    // NOTE: no immediate updateTaskMutation here — changes are batched into
    // handleSave() when the user clicks "Sauvegarder", which already includes
    // collaborators and pendingInvites in the payload. Calling the mutation
    // here would invalidate the React Query cache, cause the `task` prop to
    // update, set hasChanges=false, and disable the save button.
  };

  const toggleCollaborator = (collabId: string) => {
    // `collabId` is the friend's auth.users.id (or friend.id in demo).
    if (collaborators.includes(collabId)) {
      handleRemoveCollaborator(collabId);
    } else {
      // Defer to handleSave(), no immediate mutation.
      setCollaborators((prev) => [...prev, collabId]);
      setCollaboratorsDirty(true);
    }
  };

  // Loading state derived from mutations
  const isLoading = createTaskMutation.isPending || updateTaskMutation.isPending || deleteTaskMutation.isPending;

  const isMobile = useIsMobile();

  return {
    // tâche effective (prop édition OU tâche créée à la volée) + mode
    task: effectiveTask, isCreating: effectiveIsCreating,
    // form state
    formData, setFormData, handleInputChange,
    errors, setErrors, okrFields, hasChanges, setHasChanges, step, setStep,
    // categories / lists
    categories, createCategoryMutation,
    lists, selectedListIds, setSelectedListIds, createListMutation, listColorOptions,
    // collaborators
    collaborators, pendingInvitesLocal, emailInput, setEmailInput, inputError, setInputError,
    friends, filteredFriends, sentRequests, displayInfo,
    handleAddEmail, handleRemoveCollaborator, toggleCollaborator,
    cancelFriendRequestMutation,
    isTaskOwner, pendingShareIds,
    // validation
    validateForm, isFormValid, isStep1Valid, missingStep1Fields,
    // shake markers
    dRegister, dTrigger, dClear, dInvalid, collaboratorRef,
    // actions
    handleSave, handleDelete, confirmDelete, handleClose, onGenerateShareLink,
    showDeleteConfirm, setShowDeleteConfirm,
    showCategoryModal, setShowCategoryModal,
    isLoading, isMobile,
  };
}
