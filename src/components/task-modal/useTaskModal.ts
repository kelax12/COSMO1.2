import { useState, useEffect, useRef } from 'react';
import { useInvalidShake } from '@/hooks/use-invalid-shake';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { useFormDraft } from '@/lib/hooks/use-form-draft';
import { toast } from 'sonner';
import { showUndoToast } from '@/lib/undo-toast';

// ═══════════════════════════════════════════════════════════════════
// Module tasks - Hooks indépendants (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import {
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useRestoreTask,
  useTask,
  Task,
  Subtask,
  TaskRecurrence,
} from '@/modules/tasks';

// ═══════════════════════════════════════════════════════════════════
// Module categories - (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useCategories, useCreateCategory } from '@/modules/categories';

// ═══════════════════════════════════════════════════════════════════
// Module lists - (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useLists, useAddTaskToList, useRemoveTaskFromList, useCreateList } from '@/modules/lists';


// ═══════════════════════════════════════════════════════════════════
// BillingContext — vérification premium côté serveur
// ═══════════════════════════════════════════════════════════════════
import { useAuth } from '@/modules/auth/AuthContext';
import { useIsDemo } from '@/lib/app-mode.store';

// Logique de validation pure extraite (cf. task-modal/validation.ts).
import {
  computeValidationErrors as computeValidationErrorsFor,
  isFormValid as isFormValidFor,
  isStep1Valid as isStep1ValidFor,
  missingStep1Fields as missingStep1FieldsFor,
} from './validation';
// « Qui travaille sur cette tâche » vit dans son propre hook : amis, partages
// déjà accordés, invitations par email, et les gestes qui les modifient.
import { useTaskCollaborators } from './useTaskCollaborators';
import { runTaskSave, createTaskWithShares } from './save-task';
import { translator } from '@/i18n/useT';
import { deadlineDayKey } from '@/lib/deadline';

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
  // « Annuler » : rend la tache sous SON identifiant (R-08, C-37).
  const restoreTaskMutation = useRestoreTask();

  // Tâche créée à la volée pendant la création (clic « Générer le lien ») : une
  // fois persistée, la popup bascule en mode édition sur cette tâche (le lien a
  // besoin d'un task.id existant — FK share_links.task_id).
  const [createdTask, setCreatedTask] = useState<Task | null>(null);
  const effectiveTask: Task | undefined = task ?? createdTask ?? undefined;
  const effectiveIsCreating = isCreating && !createdTask;

  // `task` arrive toujours via TASK_LIST_COLUMNS (liste allégée — cf.
  // supabase.repository.ts), qui exclut volontairement `description` pour la
  // perf. Sans ce fetch complémentaire (getById, select('*')), une tâche qui a
  // pourtant une description ne l'affiche jamais : la section reste repliée
  // avec « + Ajouter une description » comme si elle était vide.
  const { data: fullTask } = useTask(effectiveTask?.id ?? '', {
    enabled: !effectiveIsCreating && !!effectiveTask?.id,
  });

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

  const { user } = useAuth();
  const isDemo = useIsDemo();

  const {
    friends,
    sentRequests,
    isTaskOwner,
    existingShareIds,
    pendingShareIds,
    seedCollaboratorIds,
    collaborators,
    collaboratorsDirty,
    pendingInvitesLocal,
    emailInput,
    setEmailInput,
    inputError,
    setInputError,
    showCollaboratorSection,
    setShowCollaboratorSection,
    filteredFriends,
    displayInfo,
    handleAddEmail,
    handleRemoveCollaborator,
    toggleCollaborator,
    resetCollaborators,
    seedCollaboratorsForTask,
    shareTaskMutation,
    unshareTaskMutation,
    cancelFriendRequestMutation,
  } = useTaskCollaborators({
    effectiveTask,
    task,
    isOpen,
    isCreating,
    showCollaborators,
    updateTask: (id, updates) => updateTaskMutation.mutate({ id, updates }),
  });


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
    isFromOKR: false,
    krId: '',
    recurrence: 'none' as TaskRecurrence,
    // Sous-tâches saisies en création (#12) — en édition la checklist vit
    // dans SubtaskChecklist (persistance immédiate), ce champ reste [].
    subtasks: [] as Subtask[],
  });

  // Brouillon de création (#47) : la saisie survit à une fermeture accidentelle.
  const { readDraft, saveDraft, clearDraft } = useFormDraft<typeof formData>('task-create');

  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [okrFields, setOkrFields] = useState<Record<string, boolean>>({});

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  // Section Description masquée par défaut (même système que le formulaire
  // événement, cf. EventModal.tsx) — visible seulement si la tâche a déjà une
  // description (édition), sinon bouton « + Ajouter une description ».
  const [showDescription, setShowDescription] = useState(false);
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
    // `setShowCollaboratorSection` vient de `useTaskCollaborators` : c'est un
    // setter de `useState`, donc une identité stable. ESLint ne peut plus le
    // prouver depuis qu'il traverse une frontière de hook.
  }, [showCollaboratorSection, setShowCollaboratorSection]);

  // Sauvegarde du brouillon (#47) : pendant la saisie en création libre
  // uniquement (pas le flux OKR pré-rempli). Un nom non vide suffit —
  // `hasChanges` n'est pas fiable ici (handleInputChange ne le pose pas).
  useEffect(() => {
    if (isOpen && isCreating && !initialData && formData.name.trim() !== '') {
      saveDraft(formData);
    }
  }, [formData, isOpen, isCreating, initialData, saveDraft]);

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
      // Brouillon (#47) : si le modal a été fermé par erreur en cours de
      // saisie (sans initialData — le flux OKR garde ses champs pré-remplis),
      // on restaure le brouillon au lieu de repartir de zéro.
      const draft = !initialData ? readDraft() : null;
      const draftOrInitialDescription = draft ? (draft.description ?? '') : (initialData?.description || '');
      setShowDescription(Boolean(draftOrInitialDescription.length > 0));
      // Les brouillons antérieurs n'ont pas de champ subtasks → fallback [].
      setFormData(draft ? { ...draft, subtasks: draft.subtasks ?? [] } : {
        name: initialData?.name || '',
        description: initialData?.description || '',
        priority: initialData?.priority || 0,
        category: initialData?.category || '',
        // `.split('T')[0]` rendait le jour UTC de l'instant, donc la veille à
        // l'ouest de Greenwich : le champ se pré-remplissait avec la mauvaise
        // date (risque R-01).
        deadline: deadlineDayKey(initialData?.deadline),
        estimatedTime: initialData?.estimatedTime || 0,
        completed: initialData?.completed || false,
        bookmarked: initialData?.bookmarked || false,
        isFromOKR: initialData?.isFromOKR || false,
        krId: initialData?.krId || '',
        recurrence: initialData?.recurrence || 'none',
        subtasks: [],
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

      resetCollaborators();
      setSelectedListIds([]);
      setHasChanges(false);
      setErrors({});
    } else if (task) {
      setShowDescription(Boolean(task.description && task.description.length > 0));
      setFormData({
        name: task.name || '',
        description: task.description || '',
        priority: task.priority ?? 0,
        category: task.category || '',
        deadline: deadlineDayKey(task.deadline),
        // Préserver 0 (= pas de durée) au lieu d'injecter un 30 min fantôme
        // qui se persistait silencieusement à la sauvegarde.
        estimatedTime: task.estimatedTime || 0,
        completed: task.completed || false,
        bookmarked: task.bookmarked || false,
        isFromOKR: (task as Task & { isFromOKR?: boolean }).isFromOKR || false,
        krId: task.krId || '',
        recurrence: task.recurrence || 'none',
        subtasks: [],
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

      seedCollaboratorsForTask(task);

      const taskLists = lists.filter(l => l.taskIds.includes(task.id)).map(l => l.id);
      setSelectedListIds(taskLists);

      setHasChanges(false);
      setErrors({});
    }
    // Use `task?.id` and `lists.length` instead of full-object/full-array
    // references — those churn on every React Query refetch and would
    // wipe in-flight form edits. Also de-tied from `setStep` (see effect
    // above) so a friend-request mutation no longer kicks the user back
    // to step 1 mid-flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, task?.id, isCreating, showCollaborators, lists.length]);

  // Complète `formData.description` une fois le détail complet chargé
  // (`fullTask`, cf. plus haut). Gardé sur `!hasChanges` : si l'utilisateur a
  // déjà commencé à éditer avant que la requête ne résolve, on ne doit pas
  // écraser sa frappe en cours.
  useEffect(() => {
    if (!isOpen || effectiveIsCreating || hasChanges) return;
    if (fullTask?.description === undefined) return;
    setFormData(prev => ({ ...prev, description: fullTask.description ?? '' }));
    setShowDescription(prev => prev || Boolean(fullTask.description && fullTask.description.length > 0));
  }, [isOpen, effectiveTask?.id, effectiveIsCreating, fullTask?.description, hasChanges]);

  // Track changes — la comparaison doit couvrir TOUS les champs éditables de
  // l'étape 1 (y compris les listes) : le bouton « Sauvegarder » de l'étape 2
  // en dépend, et un champ oublié ici rend la modification insauvegardable.
  useEffect(() => {
    if (!task) return;

    const taskListIds = lists.filter(l => l.taskIds.includes(task.id)).map(l => l.id).sort();
    const selectedSorted = [...selectedListIds].sort();

    // `task.description` vaut toujours undefined (TASK_LIST_COLUMNS, cf. plus
    // haut) : comparer formData.description à `task.description ?? ''` la
    // faisait paraître "modifiée" dès que `fullTask` arrivait et remplissait
    // formData — hasChanges passait à true sans qu'aucune édition n'ait eu
    // lieu, déclenchant à tort la confirmation "changements non sauvegardés"
    // à la simple ouverture d'une tâche qui a déjà une description.
    const baselineDescription = (fullTask?.id === task.id ? fullTask.description : task.description) ?? '';

    const hasFormChanges =
      formData.name !== task.name ||
      formData.description !== baselineDescription ||
      formData.priority !== task.priority ||
      formData.category !== task.category ||
      formData.deadline !== deadlineDayKey(task.deadline) ||
      formData.estimatedTime !== task.estimatedTime ||
      formData.completed !== task.completed ||
      formData.bookmarked !== task.bookmarked ||
      formData.krId !== (task.krId ?? '') ||
      formData.recurrence !== (task.recurrence ?? 'none') ||
      JSON.stringify(selectedSorted) !== JSON.stringify(taskListIds) ||
      JSON.stringify(collaborators) !== JSON.stringify(seedCollaboratorIds);

    setHasChanges(hasFormChanges);
  }, [formData, collaborators, task, fullTask?.id, fullTask?.description, seedCollaboratorIds, selectedListIds, lists]);

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

  // Après une création réussie : au lieu de fermer la popup, on la remet à
  // zéro pour permettre la saisie enchaînée de plusieurs tâches sans
  // réouvrir le modal à chaque fois.
  const resetCreateForm = (createdTaskName: string) => {
    clearDraft();
    setFormData({
      name: '',
      description: '',
      priority: 0,
      category: '',
      deadline: '',
      estimatedTime: 0,
      completed: false,
      bookmarked: false,
      isFromOKR: false,
      krId: '',
      recurrence: 'none',
      subtasks: [],
    });
    setOkrFields({});
    resetCollaborators();
    setSelectedListIds([]);
    setHasChanges(false);
    setErrors({});
    setStep(1);
    toast.success(translator('tasks').t('modal.created', { name: createdTaskName }));
  };

  const handleSave = async () => {
    await runTaskSave({
      isCreating: effectiveIsCreating, task: effectiveTask, formData, collaborators, collaboratorsDirty, pendingInvitesLocal, friends,
      lists, selectedListIds, isTaskOwner, existingShareIds,
      createTaskMutation, updateTaskMutation, addTaskToListMutation,
      removeTaskFromListMutation, shareTaskMutation, unshareTaskMutation,
      // onClose n'est appelé par runTaskSave qu'en cas de succès de MISE À
      // JOUR → on peut purger le brouillon (#47) ici sans risquer de perdre
      // une saisie. La CRÉATION passe par onCreated (reset, pas de fermeture).
      computeValidationErrors, setErrors, onClose: () => { clearDraft(); onClose(); },
      onCreated: (task) => resetCreateForm(task.name),
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
      setErrors({ general: translator('tasks').t('modal.createError') });
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

      // Tâche reçue (prod, non-propriétaire) : un collaborateur en rôle
      // "editor" peut légitimement DELETE la ligne côté RLS — ce qui
      // supprimerait la tâche pour TOUT LE MONDE (propriétaire + autres
      // collaborateurs), alors qu'un non-propriétaire ne devrait retirer
      // que son propre accès. On quitte le partage au lieu de supprimer.
      if (!isDemo && !isTaskOwner && user?.id) {
        unshareTaskMutation.mutate(
          { taskId: taskSnapshot.id, friendId: user.id },
          {
            onSuccess: () => {
              setShowDeleteConfirm(false);
              onClose();
              toast.success(translator('tasks').t('modal.leftShared'));
            },
            onError: (err) => {
              console.error('Leave shared task failed', err);
              setErrors({ general: translator('tasks').t('modal.deleteError') });
              setShowDeleteConfirm(false);
            },
          }
        );
        return;
      }

      deleteTaskMutation.mutate(effectiveTask.id, {
        onSuccess: () => {
          setShowDeleteConfirm(false);
          onClose();
          // Raccourci d'annulation (barre de progression 5 s, haut à droite).
          showUndoToast(translator('tasks').t('modal.deleted'), () => {
            restoreTaskMutation.mutate(taskSnapshot);
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
    // #40 — en édition, une fermeture avec changements non sauvés demande
    // confirmation. En création, le brouillon (useFormDraft) protège déjà la
    // saisie : fermer est sans perte, pas de friction inutile.
    if (!effectiveIsCreating && hasChanges) { setShowDiscardConfirm(true); return; }
    onClose();
  };
  const confirmDiscardClose = () => {
    setShowDiscardConfirm(false);
    onClose();
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
    showDiscardConfirm, setShowDiscardConfirm, confirmDiscardClose,
    showDescription, setShowDescription,
    showCategoryModal, setShowCategoryModal,
    isLoading, isMobile,
  };
}
