import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useInvalidShake } from '@/hooks/use-invalid-shake';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { toast } from 'sonner';
import { showUndoToast } from '@/lib/undo-toast';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import ColorSettingsModal from './ColorSettingsModal';

// ═══════════════════════════════════════════════════════════════════
// Module tasks - Hooks indépendants (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { 
  useCreateTask,
  useUpdateTask, 
  useDeleteTask, 
  Task,
  CreateTaskInput,
  UpdateTaskInput 
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

// Corps mobile full-screen extrait (cf. task-modal/TaskModalMobileBody.tsx).
import TaskModalMobileBody from './task-modal/TaskModalMobileBody';
// Corps desktop (wizard 2 étapes) extrait (cf. task-modal/TaskModalDesktopBody.tsx).
import TaskModalDesktopBody from './task-modal/TaskModalDesktopBody';
// Feuille de confirmation de suppression extraite (cf. task-modal/DeleteTaskConfirm.tsx).
import DeleteTaskConfirm from './task-modal/DeleteTaskConfirm';
// Logique de validation pure extraite (cf. task-modal/validation.ts).
import {
  computeValidationErrors as computeValidationErrorsFor,
  isFormValid as isFormValidFor,
  isStep1Valid as isStep1ValidFor,
  missingStep1Fields as missingStep1FieldsFor,
} from './task-modal/validation';
// Helpers d'identité/affichage des collaborateurs (cf. task-modal/collaborators.ts).
import {
  collabIdOf,
  filterFriendsForCollab,
  resolveCollaboratorDisplay,
} from './task-modal/collaborators';

// ─────────────────────────────────────────────────────────────────────────────

interface TaskModalProps {
  task?: Task;
  isOpen: boolean;
  onClose: () => void;
  isCreating?: boolean;
  showCollaborators?: boolean;
  initialData?: Partial<Task> & { isFromOKR?: boolean };
}

const TaskModal: React.FC<TaskModalProps> = ({ task, isOpen, onClose, isCreating = false, showCollaborators = false, initialData }) => {
  // ═══════════════════════════════════════════════════════════════════
  // TASKS - Depuis le module tasks (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const createTaskMutation = useCreateTask();
  const updateTaskMutation = useUpdateTask();
  const deleteTaskMutation = useDeleteTask();

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
  const isTaskOwner = !task?.userId || task.userId === user?.id;

  // shared_tasks est la source de vérité du partage (colonne `tasks.collaborators`
  // supprimée — migration 028). On dérive l'état « assignés » des grants.
  const { data: shares = [] } = useTaskShares(task?.id);
  const existingShareIds = useMemo(() => shares.map((s) => s.friendId), [shares]);
  // friend_ids des collaborateurs n'ayant pas encore accepté → badge « Envoyé ».
  const pendingShareIds = useMemo(
    () => new Set(shares.filter((s) => !s.accepted).map((s) => s.friendId)),
    [shares]
  );
  const existingCollaboratorIds = useMemo(
    () => [...existingShareIds, ...(task?.pendingInvites || [])],
    [existingShareIds, task?.pendingInvites]
  );

  // Liste des collaborateurs à afficher selon le point de vue :
  //  - propriétaire → les destinataires (existingCollaboratorIds)
  //  - destinataire → le propriétaire (task.userId) + co-destinataires lisibles,
  //    en s'excluant soi-même (lecture seule).
  const seedCollaboratorIds = useMemo(() => {
    if (isTaskOwner) return existingCollaboratorIds;
    const ids = new Set<string>();
    if (task?.userId && task.userId !== user?.id) ids.add(task.userId);
    existingShareIds.forEach((id) => { if (id !== user?.id) ids.add(id); });
    return [...ids];
  }, [isTaskOwner, existingCollaboratorIds, existingShareIds, task?.userId, user?.id]);


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
        estimatedTime: task.estimatedTime || 30,
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
    if (!isOpen || !task || isCreating || hasChanges) return;
    setCollaborators(seedCollaboratorIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, task?.id, isCreating, seedCollaboratorIds.join(',')]);

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
    const validationErrors = computeValidationErrors();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      // Affiche le premier message d'erreur en toast — sinon l'utilisateur
      // peut ne pas voir l'erreur inline cachée plus haut dans le modal.
      toast.error(Object.values(validationErrors)[0]);
      return;
    }
    if (!isCreating && !task) return;

    if (isCreating) {
      // Use createTaskMutation for new tasks
      const createData: CreateTaskInput = {
        name: formData.name,
        description: formData.description.trim() || undefined,
        priority: formData.priority,
        category: formData.category,
        deadline: formData.deadline ? new Date(formData.deadline).toISOString() : '',
        estimatedTime: Number(formData.estimatedTime),
        completed: formData.completed,
        bookmarked: formData.bookmarked,
        isCollaborative: collaborators.length > 0,
        pendingInvites: pendingInvitesLocal,
      };

      createTaskMutation.mutate(createData, {
        onSuccess: (newTask) => {
          // Le partage réel passe par shared_tasks (plus de colonne
          // `collaborators`). On ignore les invitations email en attente —
          // elles vivent dans pendingInvites jusqu'à acceptation.
          if (newTask) {
            collaborators.forEach((userId) => {
              if (pendingInvitesLocal.includes(userId)) return;
              const friend = friends.find(
                f => (f.userId ?? f.id) === userId || f.id === userId
              );
              shareTaskMutation.mutate({
                taskId: newTask.id,
                friendId: userId,
                friendEmail: friend?.email,
                role: 'editor'
              });
            });
          }
          onClose();
        },
        onError: (err) => {
          console.error('Error creating task:', err);
          setErrors({ general: 'Erreur lors de la création. Veuillez réessayer.' });
        }
      });
    } else if (task) {
      const taskData: UpdateTaskInput = {
        name: formData.name,
        description: formData.description.trim() || undefined,
        priority: formData.priority,
        category: formData.category,
        deadline: formData.deadline ? new Date(formData.deadline).toISOString() : '',
        estimatedTime: Number(formData.estimatedTime),
        completed: formData.completed,
        bookmarked: formData.bookmarked,
        isCollaborative: collaborators.length > 0,
        pendingInvites: pendingInvitesLocal,
      };

      updateTaskMutation.mutate(
        { id: task.id, updates: taskData },
        {
          onSuccess: () => {
            // Sync lists
            const currentListIds = lists.filter(l => l.taskIds.includes(task.id)).map(l => l.id);
            
            // Add to new lists
            selectedListIds.forEach(listId => {
              if (!currentListIds.includes(listId)) {
                addTaskToListMutation.mutate({ taskId: task.id, listId });
              }
            });
            
            // Remove from deselected lists
            currentListIds.forEach(listId => {
              if (!selectedListIds.includes(listId)) {
                removeTaskFromListMutation.mutate({ taskId: task.id, listId });
              }
            });

            // Seul le propriétaire gère les partages (RLS le rejetterait pour un
            // destinataire de toute façon). On saute toute écriture shared_tasks
            // quand l'utilisateur n'est pas propriétaire.
            if (isTaskOwner) {
              // Additions: nouveaux collaborateurs sélectionnés non encore
              // partagés (et qui ne sont pas des invitations email en attente).
              collaborators.forEach(userId => {
                if (pendingInvitesLocal.includes(userId)) return;
                if (!existingShareIds.includes(userId)) {
                  // Find the friend's email so shareTask can resolve the
                  // canonical auth.uid via profiles, even when userId is
                  // actually a friends-table row id (no profile lookup yet).
                  const friend = friends.find(
                    f => (f.userId ?? f.id) === userId || f.id === userId
                  );
                  shareTaskMutation.mutate({
                    taskId: task.id,
                    friendId: userId,
                    friendEmail: friend?.email,
                    role: 'editor'
                  });
                }
              });

              // Removals: grants shared_tasks dé-sélectionnés → on retire le
              // partage (pas de gate premium pour retirer).
              existingShareIds.forEach(shareId => {
                if (!collaborators.includes(shareId)) {
                  unshareTaskMutation.mutate({ taskId: task.id, friendId: shareId });
                }
              });
            }

            onClose();
          },
          onError: (err) => {
            console.error('Error saving task:', err);
            setErrors({ general: 'Erreur lors de la sauvegarde. Veuillez réessayer.' });
          }
        }
      );
    }
  };

  const handleDelete = () => {
    if (task) {
      setShowDeleteConfirm(true);
    }
  };

  const confirmDelete = () => {
    if (task) {
      const taskSnapshot = task;
      deleteTaskMutation.mutate(task.id, {
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
    }
  };

  // Loading state derived from mutations
  const isLoading = createTaskMutation.isPending || updateTaskMutation.isPending || deleteTaskMutation.isPending;

  const isMobile = useIsMobile();

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        showCloseButton={false}
        variant={isMobile ? 'bottom-sheet' : 'default'}
        className="p-0 border-0 bg-transparent shadow-none top-auto bottom-0 left-0 translate-x-0 translate-y-0 max-w-none w-full h-[94dvh] max-h-[94dvh] sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:bottom-auto sm:max-w-xl sm:h-auto sm:max-h-[calc(100vh-2rem)] lg:max-h-[85vh] overflow-visible sm:overflow-hidden flex flex-col"
      >
        <DialogTitle className="sr-only">
          {isCreating ? 'Créer une nouvelle tâche' : 'Modifier la tâche'}
        </DialogTitle>
        {isMobile ? (
          <TaskModalMobileBody
            formData={formData}
            handleInputChange={handleInputChange}
            categories={categories}
            lists={lists}
            selectedListIds={selectedListIds}
            listColorOptions={listColorOptions}
            collaborators={collaborators}
            pendingInvitesLocal={pendingInvitesLocal}
            emailInput={emailInput}
            setEmailInput={setEmailInput}
            inputError={inputError}
            friends={friends}
            filteredFriends={filteredFriends}
            sentRequests={sentRequests}
            collabIdOf={collabIdOf}
            displayInfo={displayInfo}
            handleAddEmail={handleAddEmail}
            handleRemoveCollaborator={handleRemoveCollaborator}
            toggleCollaborator={toggleCollaborator}
            createCategoryMutation={createCategoryMutation}
            handleSave={handleSave}
            handleClose={handleClose}
            handleDelete={handleDelete}
            isCreating={isCreating}
            isLoading={isLoading}
            isFormValid={isFormValid}
            taskId={task?.id}
            autoOpenCollaborators={showCollaborators}
            isTaskOwner={isTaskOwner}
            ownerId={task?.userId}
            pendingShareIds={pendingShareIds}
          />
        ) : (
          <TaskModalDesktopBody
            formData={formData}
            setFormData={setFormData}
            handleInputChange={handleInputChange}
            errors={errors}
            setErrors={setErrors}
            okrFields={okrFields}
            hasChanges={hasChanges}
            setHasChanges={setHasChanges}
            step={step}
            setStep={setStep}
            dRegister={dRegister}
            dTrigger={dTrigger}
            dClear={dClear}
            dInvalid={dInvalid}
            collaboratorRef={collaboratorRef}
            validateForm={validateForm}
            isStep1Valid={isStep1Valid}
            isFormValid={isFormValid}
            missingStep1Fields={missingStep1Fields}
            categories={categories}
            createCategoryMutation={createCategoryMutation}
            listColorOptions={listColorOptions}
            lists={lists}
            selectedListIds={selectedListIds}
            setSelectedListIds={setSelectedListIds}
            createListMutation={createListMutation}
            isLoading={isLoading}
            isCreating={isCreating}
            handleClose={handleClose}
            handleSave={handleSave}
            handleDelete={handleDelete}
            isTaskOwner={isTaskOwner}
            task={task}
            collaborators={collaborators}
            displayInfo={displayInfo}
            pendingShareIds={pendingShareIds}
            handleRemoveCollaborator={handleRemoveCollaborator}
            emailInput={emailInput}
            setEmailInput={setEmailInput}
            inputError={inputError}
            setInputError={setInputError}
            handleAddEmail={handleAddEmail}
            filteredFriends={filteredFriends}
            collabIdOf={collabIdOf}
            toggleCollaborator={toggleCollaborator}
            sentRequests={sentRequests}
            pendingInvitesLocal={pendingInvitesLocal}
            friends={friends}
            cancelFriendRequestMutation={cancelFriendRequestMutation}
          />
        )} {/* end desktop else */}

        <DeleteTaskConfirm
          isOpen={showDeleteConfirm}
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={confirmDelete}
          isLoading={isLoading}
        />

            <ColorSettingsModal
              isOpen={showCategoryModal}
              onClose={() => setShowCategoryModal(false)}
              isNested={true}
            />
          </DialogContent>
        </Dialog>
    </>
    );
  };

export default TaskModal;

