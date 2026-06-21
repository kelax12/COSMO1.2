import { useEffect, useState } from 'react';

// ═══════════════════════════════════════════════════════════════════
// Module tasks - Hooks indépendants (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useCreateTask, CreateTaskInput } from '@/modules/tasks';

// ═══════════════════════════════════════════════════════════════════
// Module categories - (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useCategories } from '@/modules/categories';

// ═══════════════════════════════════════════════════════════════════
// Module lists - (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useLists, useAddTaskToList } from '@/modules/lists';

import { useFriends, useShareTask } from '@/modules/friends';

import { computeAddTaskErrors, isAddTaskFormValid } from '@/components/AddTaskForm.validation';

export type AddTaskFormProps = {
  onFormToggle?: (isOpen: boolean) => void;
  expanded?: boolean;
  initialData?: {
    name?: string;
    estimatedTime?: number;
    category?: string;
    priority?: number;
    isFromOKR?: boolean;
  };
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function useAddTaskForm({ onFormToggle, expanded = false, initialData }: AddTaskFormProps) {
  // ═══════════════════════════════════════════════════════════════════
  // TASKS - Depuis le module tasks (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const createTaskMutation = useCreateTask();

  // ═══════════════════════════════════════════════════════════════════
  // CATEGORIES - Depuis le module categories (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: categories = [] } = useCategories();

  // ═══════════════════════════════════════════════════════════════════
  // LISTS - Depuis le module lists (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: lists = [] } = useLists();
  const addTaskToListMutation = useAddTaskToList();

  const { data: friends = [] } = useFriends();
  const shareTaskMutation = useShareTask();

  const [isFormOpen, setIsFormOpen] = useState(expanded);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    priority: initialData?.priority || 0,
    category: initialData?.category || '',
    deadline: '',
    estimatedTime: initialData?.estimatedTime || 0,
    completed: false,
    bookmarked: false,
    isFromOKR: initialData?.isFromOKR || false
  });

  const [okrFields, setOkrFields] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setIsFormOpen(expanded);
  }, [expanded]);

  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        name: initialData.name || prev.name,
        estimatedTime: initialData.estimatedTime || prev.estimatedTime,
        category: initialData.category || prev.category,
        priority: initialData.priority || prev.priority,
        isFromOKR: initialData.isFromOKR ?? prev.isFromOKR
      }));
      setHasChanges(true);

      if (initialData.isFromOKR) {
        setOkrFields({
          name: !!initialData.name,
          category: !!initialData.category,
          estimatedTime: !!initialData.estimatedTime,
        });
      } else {
        setOkrFields({});
      }
    }
  }, [initialData]);

  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [showCollaboratorSection, setShowCollaboratorSection] = useState(false);
  const [errors, setErrors] = useState<{[key: string]: string;}>({});
  const [hasChanges, setHasChanges] = useState(false);

  const getCategoryColor = (id: string) => {
    return categories.find(cat => cat.id === id)?.color || '#9CA3AF';
  };

  // A friend's "collaborator id" = auth.users.id (userId) in Supabase mode,
  // friend.id in demo. Required for tasks.collaborators RLS + shared_tasks FK.
  const collabIdOf = (f: { id: string; userId?: string }) => f.userId ?? f.id;

  const filteredFriends = (friends || []).filter((friend) =>
    !collaborators.includes(collabIdOf(friend)) && (
      emailInput === '' ||
      friend.name.toLowerCase().includes(emailInput.toLowerCase()) ||
      friend.email.toLowerCase().includes(emailInput.toLowerCase())
    )
  );

  const displayInfo = (id: string) => {
    const friend = friends?.find((f) => collabIdOf(f) === id || f.id === id);
    if (friend) return { name: friend.name, email: friend.email, avatar: friend.avatar };
    if (emailRegex.test(id)) return { name: id.split('@')[0], email: id, avatar: undefined };
    return { name: id, email: undefined, avatar: undefined };
  };

  const handleAddEmail = () => {
    const value = emailInput.trim().toLowerCase();
    if (!value) return;
    // Check if it's a known friend first
    const friend = (friends || []).find(f => f.email.toLowerCase() === value);
    if (friend) {
      const collabId = collabIdOf(friend);
      if (!collaborators.includes(collabId)) {
        setCollaborators([...collaborators, collabId]);
        setHasChanges(true);
      }
      setEmailInput('');
      setInputError(null);
      return;
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(value)) {
      setInputError('Utilisateur introuvable');
      return;
    }
    if (collaborators.includes(value)) {
      setEmailInput('');
      return;
    }
    setCollaborators([...collaborators, value]);
    setEmailInput('');
    setInputError(null);
    setHasChanges(true);
  };

  // Règles extraites dans AddTaskForm.validation.ts (pur, testé) — ne pas
  // ré-inliner ; volontairement plus strictes que task-modal/validation.ts.
  const validateForm = () => {
    const newErrors = computeAddTaskErrors(formData);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isFormValid = () => isAddTaskFormValid(formData);

  const handleInputChange = (field: string, value: string | number | boolean | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
    if (okrFields[field]) setOkrFields(prev => ({ ...prev, [field]: false }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const handleFormToggle = (open: boolean) => {
    setIsFormOpen(open);
    onFormToggle?.(open);
    if (!open) resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '', priority: 0, category: '', deadline: '', estimatedTime: 0, completed: false, bookmarked: false, isFromOKR: false
    });
    setCollaborators([]);
    setSelectedListIds([]);
    setShowCollaboratorSection(false);
    setErrors({});
    setHasChanges(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const taskInput: CreateTaskInput = {
      name: formData.name,
      priority: formData.priority,
      category: formData.category,
      deadline: formData.deadline ? new Date(formData.deadline).toISOString() : '',
      estimatedTime: Number(formData.estimatedTime),
      bookmarked: formData.bookmarked,
      completed: formData.completed,
      isCollaborative: collaborators.length > 0,
      pendingInvites: [],
    };

    createTaskMutation.mutate(taskInput, {
      onSuccess: (newTask) => {
        // Ajouter aux listes sélectionnées
        selectedListIds.forEach(listId => {
          addTaskToListMutation.mutate({ taskId: newTask.id, listId });
        });

        // Partager avec les collaborateurs (gratuit). Passe l'email pour
        // que shareTask puisse résoudre le auth.uid canonique via profiles,
        // même si `userId` est en réalité le friend.id (pas le auth.uid).
        if (collaborators.length > 0) {
          collaborators.forEach((userId) => {
            const friend = friends?.find(f => (f.userId ?? f.id) === userId || f.id === userId);
            shareTaskMutation.mutate({
              taskId: newTask.id,
              friendId: userId,
              friendEmail: friend?.email,
              role: 'editor'
            });
          });
        }

        handleFormToggle(false);
      },
      onError: () => {
        setErrors({ general: 'Erreur lors de la création. Veuillez réessayer.' });
      }
    });
  };

  const toggleCollaborator = (userId: string) => {
    setCollaborators((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
    setHasChanges(true);
  };

  const isLoading = createTaskMutation.isPending;

  return {
    isFormOpen, handleFormToggle, handleSubmit,
    formData, handleInputChange, okrFields, errors, hasChanges, setHasChanges,
    categories, showCategoryModal, setShowCategoryModal, getCategoryColor,
    lists, selectedListIds, setSelectedListIds,
    collaborators, emailInput, setEmailInput, inputError, setInputError,
    showCollaboratorSection, setShowCollaboratorSection,
    filteredFriends, collabIdOf, displayInfo, handleAddEmail, toggleCollaborator,
    isLoading, isFormValid,
  };
}
