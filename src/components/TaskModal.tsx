import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Users, AlertCircle, CheckCircle, Bookmark, BookmarkCheck, Trash2, Search, UserPlus, Mail, List, ChevronDown, ChevronRight, Plus, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import CollaboratorItem from '@/components/CollaboratorItem';
import { DatePicker } from '@/components/ui/date-picker';
import CollaboratorAvatars from './CollaboratorAvatars';
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

import { useFriends, useSendFriendRequest, useShareTask } from '@/modules/friends';

// ═══════════════════════════════════════════════════════════════════
// BillingContext — vérification premium côté serveur
// ═══════════════════════════════════════════════════════════════════
import { useBilling } from '@/modules/billing/billing.context';

interface TaskModalProps {
  task?: Task;
  isOpen: boolean;
  onClose: () => void;
  isCreating?: boolean;
  showCollaborators?: boolean;
  initialData?: Partial<Task> & { isFromOKR?: boolean };
}
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const shareTaskMutation = useShareTask();
  const sendFriendRequestMutation = useSendFriendRequest();

  // Premium — vérification côté serveur
  const { isPremium } = useBilling();
  const navigate = useNavigate();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
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
  const [searchUser, setSearchUser] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [showCollaboratorSection, setShowCollaboratorSection] = useState(showCollaborators);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [step, setStep] = useState(1);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('blue');
  const [showNewListInput, setShowNewListInput] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListColor, setNewListColor] = useState('blue');

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

  const getCategoryColor = (id: string) => {
    return categories.find((cat) => cat.id === id)?.color || '#9CA3AF';
  };

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

  // Initialize form data when task changes
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);

    if (isCreating) {
      setFormData({
        name: initialData?.name || '',
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
        priority: task.priority || 3,
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

      setCollaborators(task.collaborators || []);
        setPendingInvitesLocal(task.pendingInvites || []);
        
        const taskLists = lists.filter(l => l.taskIds.includes(task.id)).map(l => l.id);
      setSelectedListIds(taskLists);

      setHasChanges(false);
      setErrors({});
      setShowCollaboratorSection(showCollaborators || (task.collaborators && task.collaborators.length > 0) || false);
    }
  }, [isOpen, task, isCreating, showCollaborators, lists]);

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
      JSON.stringify(collaborators) !== JSON.stringify(task.collaborators || []);

    setHasChanges(hasFormChanges);
  }, [formData, collaborators, task]);

  // Validation rules
  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom de la tâche est obligatoire';
    } else if (formData.name.trim().length < 3) {
      newErrors.name = 'Le nom doit contenir au moins 3 caractères';
    } else if (formData.name.trim().length > 100) {
      newErrors.name = 'Le nom ne peut pas dépasser 100 caractères';
    }

    if (formData.estimatedTime === '' || formData.estimatedTime === null) {
        newErrors.estimatedTime = 'Le temps estimé est obligatoire';
    } else if (isNaN(Number(formData.estimatedTime))) {
        newErrors.estimatedTime = 'Veuillez entrer un nombre valide';
    } else if (Number(formData.estimatedTime) < 0) {
        newErrors.estimatedTime = 'Le temps estimé ne peut pas être négatif';
    }

    if (formData.priority === 0) {
      newErrors.priority = 'Veuillez choisir une priorité';
    }

    if (!formData.category) {
      newErrors.category = 'Veuillez choisir une catégorie';
    }

    if (formData.deadline) {
      const deadlineDate = new Date(formData.deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (deadlineDate < today) {
        newErrors.deadline = 'La date limite ne peut pas être dans le passé';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isFormValid = () => {
    const nameValid = formData.name.length >= 1 && formData.name.length <= 100;
    const timeValid = formData.estimatedTime !== '' && formData.estimatedTime !== null && !isNaN(Number(formData.estimatedTime)) && Number(formData.estimatedTime) >= 0;
    const priorityValid = formData.priority !== 0;
    const categoryValid = !!formData.category;
    
    let deadlineValid = true;
    if (formData.deadline) {
      const deadlineDate = new Date(formData.deadline);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      deadlineValid = deadlineDate >= today;
    }

    return nameValid && timeValid && priorityValid && categoryValid && deadlineValid;
  };

  const isStep1Valid = () => {
    const nameValid = formData.name.trim().length >= 1 && formData.name.trim().length <= 100;
    const priorityValid = formData.priority !== 0;
    const categoryValid = !!formData.category;
    let deadlineValid = true;
    if (formData.deadline) {
      const d = new Date(formData.deadline);
      const today = new Date(); today.setHours(0,0,0,0);
      deadlineValid = d >= today;
    }
    return nameValid && priorityValid && categoryValid && deadlineValid;
  };

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    
    if (okrFields[field]) {
      setOkrFields(prev => ({ ...prev, [field]: false }));
    }

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    if (!isCreating && !task) return;

    if (isCreating) {
      // Use createTaskMutation for new tasks
      const createData: CreateTaskInput = {
        name: formData.name,
        priority: formData.priority,
        category: formData.category,
        deadline: formData.deadline ? new Date(formData.deadline).toISOString() : new Date().toISOString(),
        estimatedTime: Number(formData.estimatedTime),
        completed: formData.completed,
        bookmarked: formData.bookmarked,
        isCollaborative: collaborators.length > 0,
        collaborators: collaborators,
        pendingInvites: pendingInvitesLocal,
      };

      createTaskMutation.mutate(createData, {
        onSuccess: () => {
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
        priority: formData.priority,
        category: formData.category,
        deadline: formData.deadline ? new Date(formData.deadline).toISOString() : task.deadline,
        estimatedTime: Number(formData.estimatedTime),
        completed: formData.completed,
        bookmarked: formData.bookmarked,
        isCollaborative: collaborators.length > 0,
        collaborators: collaborators,
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

            if (isPremium()) {
              collaborators.forEach(userId => {
                if (!task.collaborators?.includes(userId)) {
                  shareTaskMutation.mutate({ taskId: task.id, friendId: userId, role: 'editor' });
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
      deleteTaskMutation.mutate(task.id, {
        onSuccess: () => {
          setShowDeleteConfirm(false);
          onClose();
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

  const availableFriends = friends || [];
  const filteredFriends = availableFriends.filter((friend) =>
    !collaborators.includes(friend.id) && (
      friend.name.toLowerCase().includes(searchUser.toLowerCase()) ||
      friend.email.toLowerCase().includes(searchUser.toLowerCase())
    )
  );

  const displayInfo = (id: string) => {
    const friend = friends?.find((f) => f.id === id || f.name === id);
    if (friend) {
      return { name: friend.name, email: friend.email, avatar: friend.avatar, isPending: false };
    }
    const isPending = pendingInvitesLocal.includes(id);
    if (emailRegex.test(id)) {
      return { name: id, email: id, avatar: undefined, isPending };
    }
    return { name: id, email: undefined, avatar: undefined, isPending };
  };

  const handleAddEmail = () => {
    const value = emailInput.trim().toLowerCase();
    if (!value) return;
    
    const friend = friends.find(f => f.email.toLowerCase() === value);
    
    if (friend) {
      if (!collaborators.includes(friend.name)) {
        setCollaborators([...collaborators, friend.name]);
      }
    } else {
      if (collaborators.includes(value)) {
        setEmailInput('');
        return;
      }
      sendFriendRequestMutation.mutate({ email: value });
      setCollaborators([...collaborators, value]);
      setPendingInvitesLocal([...pendingInvitesLocal, value]);
      if (task) {
        updateTaskMutation.mutate({
          id: task.id,
          updates: {
            isCollaborative: true,
            pendingInvites: [...pendingInvitesLocal, value],
            collaboratorValidations: {
              ...task.collaboratorValidations,
              [value]: false
            }
          }
        });
      }
    }
    setEmailInput('');
  };

  const handleRemoveCollaborator = (collaboratorName: string) => {
    const newCollaborators = collaborators.filter((c) => c !== collaboratorName);
    setCollaborators(newCollaborators);
    const newPendingInvites = pendingInvitesLocal.filter(e => e !== collaboratorName);
    setPendingInvitesLocal(newPendingInvites);
    
    if (task) {
      const newValidations = { ...task.collaboratorValidations };
      delete newValidations[collaboratorName];
      
      updateTaskMutation.mutate({
        id: task.id,
        updates: {
          collaborators: newCollaborators,
          isCollaborative: newCollaborators.length > 0,
          collaboratorValidations: newValidations,
          pendingInvites: newPendingInvites
        }
      });
    }
  };

  const toggleCollaborator = (friendId: string) => {
    const friend = friends.find(f => f.id === friendId);
    const name = friend?.name || friendId;
    
    if (collaborators.includes(name)) {
      handleRemoveCollaborator(name);
    } else {
      setCollaborators((prev) => [...prev, name]);
      if (task) {
        updateTaskMutation.mutate({
          id: task.id,
          updates: {
            isCollaborative: true,
            collaborators: [...collaborators, name],
            collaboratorValidations: {
              ...task.collaboratorValidations,
              [name]: false
            }
          }
        });
      }
    }
  };

  // Loading state derived from mutations
  const isLoading = createTaskMutation.isPending || updateTaskMutation.isPending || deleteTaskMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent
        showCloseButton={false}
        fullScreenMobile={true}
        className="p-0 border-0 sm:bg-transparent sm:shadow-none sm:max-w-2xl xl:max-w-3xl 2xl:max-w-4xl 3xl:max-w-[1120px] w-full h-full md:h-auto md:min-h-[50vh] 3xl:min-h-[85vh] md:max-h-[90vh] overflow-y-auto"
      >
        <DialogTitle className="sr-only">
          {isCreating ? 'Créer une nouvelle tâche' : 'Modifier la tâche'}
        </DialogTitle>
        <div className="md:rounded-2xl md:shadow-2xl w-full transition-colors h-full min-h-inherit" style={{ backgroundColor: 'hsl(var(--background))' }}>
          {/* Header */}
          <div className="flex justify-between items-center px-6 py-4 border-b transition-colors" style={{ borderColor: 'rgb(var(--color-border))' }}>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                {isCreating ? 'Nouvelle tâche' : 'Modifier la tâche'}
              </h2>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full transition-colors ${step === 1 ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                <div className={`w-2 h-2 rounded-full transition-colors ${step === 2 ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
              </div>
              {hasChanges &&
                <div className="flex items-center gap-1 text-orange-500 text-xs font-medium bg-orange-500/10 px-2 py-1 rounded-md">
                  <AlertCircle size={12} aria-hidden="true" />
                  <span>Non sauvegardé</span>
                </div>
              }
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              aria-label="Fermer le formulaire"
            >
              <X size={18} aria-hidden="true" />
            </Button>
          </div>

          <div className="p-6 overflow-y-auto h-[calc(100%-72px)] md:h-auto">
            {/* Error display */}
            {errors.general &&
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg" role="alert">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                  <AlertCircle size={16} aria-hidden="true" />
                  <span className="font-medium">{errors.general}</span>
                </div>
              </div>
            }

              <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>

                {/* ── Step 1 : champs principaux ── */}
                {step === 1 && (
                <div className="space-y-5">

                  {/* Task Name */}
                  <div>
                    <label htmlFor="task-name" className="block text-sm font-semibold mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                      Nom de la tâche *
                    </label>
                    <input
                      id="task-name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      className={`w-full px-4 h-12 border rounded-lg focus:outline-none hover:border-blue-500 focus:border-blue-600 focus:border-2 transition-all text-base ${
                        errors.name ? 'border-red-300 dark:border-red-600' : 'border-slate-200 dark:border-slate-700'
                      } ${okrFields.name ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''}`}
                      style={{
                        backgroundColor: okrFields.name ? undefined : 'rgb(var(--color-surface))',
                        color: 'rgb(var(--color-text-primary))',
                        borderColor: errors.name ? 'rgb(var(--error))' : (okrFields.name ? undefined : undefined)
                      }}
                      placeholder="Entrez le nom de la tâche"
                      aria-describedby={errors.name ? 'name-error' : undefined}
                      aria-invalid={!!errors.name}
                    />

                    {errors.name &&
                      <div id="name-error" className="flex items-center gap-2 mt-1 text-red-600 dark:text-red-400 text-sm" role="alert">
                        <AlertCircle size={14} aria-hidden="true" />
                        {errors.name}
                      </div>
                    }
                  </div>

                  {/* Priority and Category */}
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="task-priority" className="block text-sm font-semibold mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                          Priorité
                        </label>
                        <div className="relative">
                          <select
                            id="task-priority"
                            value={formData.priority}
                            onChange={(e) => handleInputChange('priority', Number(e.target.value))}
                            className="w-full px-4 pr-12 h-12 border rounded-lg focus:outline-none hover:border-blue-500 focus:border-blue-600 focus:border-2 transition-all text-base border-slate-200 dark:border-slate-700 appearance-none cursor-pointer"
                            style={{
                              backgroundColor: 'rgb(var(--color-surface))',
                              color: formData.priority === 0 ? 'rgb(var(--color-text-muted))' : 'rgb(var(--color-text-primary))',
                            }}
                            aria-label="Sélectionner la priorité de la tâche"
                          >
                            <option value="0" disabled hidden>Choisir une priorité</option>
                            <option value="1" style={{ color: 'rgb(var(--color-text-primary))' }}>1 (Très haute)</option>
                            <option value="2" style={{ color: 'rgb(var(--color-text-primary))' }}>2 (Haute)</option>
                            <option value="3" style={{ color: 'rgb(var(--color-text-primary))' }}>3 (Moyenne)</option>
                            <option value="4" style={{ color: 'rgb(var(--color-text-primary))' }}>4 (Basse)</option>
                            <option value="5" style={{ color: 'rgb(var(--color-text-primary))' }}>5 (Très basse)</option>
                          </select>
                          <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" />
                        </div>
                        {errors.priority &&
                          <div className="flex items-center gap-2 mt-1 text-red-600 dark:text-red-400 text-sm" role="alert">
                            <AlertCircle size={14} aria-hidden="true" />
                            {errors.priority}
                          </div>
                        }
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                        Catégorie
                      </label>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className={`w-full flex items-center justify-between px-4 h-12 border rounded-lg focus:outline-none hover:border-blue-500 focus:border-blue-600 focus:border-2 data-[state=open]:border-blue-600 data-[state=open]:border-2 transition-all text-base ${
                                    errors.category ? 'border-red-500' : (okrFields.category ? 'border-blue-500 dark:border-blue-400' : 'border-slate-200 dark:border-slate-700')
                                  } ${okrFields.category ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}
                                  style={{
                                  backgroundColor: okrFields.category ? undefined : 'rgb(var(--color-surface))',
                                  color: formData.category ? 'rgb(var(--color-text-primary))' : 'rgb(var(--color-text-muted))',
                                  borderColor: errors.category ? 'rgb(var(--color-error))' : (okrFields.category ? undefined : undefined)
                                }}
                              >
                              <span>{categories.find(c => c.id === formData.category)?.name || (formData.category === 'okr' ? 'OKR' : 'Choisir...')}</span>
                              <ChevronDown size={18} className="text-blue-500" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent 
                            align="start" 
                            className="w-[var(--radix-dropdown-menu-trigger-width)] bg-[#f8fafc] dark:bg-[#1e293b] border-slate-200 dark:border-slate-700 p-1 shadow-xl"
                          >
                            {categories.length === 0 && (
                              <DropdownMenuItem asChild>
                                <button
                                  type="button"
                                  onClick={() => setShowCategoryModal(true)}
                                  className="w-full text-left px-4 py-3 text-base rounded-md transition-colors flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                >
                                  <Plus size={18} />
                                  Ajouter une catégorie
                                </button>
                              </DropdownMenuItem>
                            )}
                            {formData.category === 'okr' && !categories.find(c => c.id === 'okr') && (
                            <DropdownMenuItem asChild>
                              <button
                                type="button"
                                onClick={() => handleInputChange('category', 'okr')}
                                className="w-full text-left px-4 py-3 text-base rounded-md transition-colors flex items-center gap-2 bg-blue-600 text-white shadow-sm"
                              >
                                <div className="w-2 h-2 rounded-full bg-blue-400" />
                                OKR
                              </button>
                            </DropdownMenuItem>
                          )}
                          {categories.map((cat) => (
                            <DropdownMenuItem key={cat.id} asChild>
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => handleInputChange('category', cat.id)}
                                className={`w-full text-left px-4 py-3 text-base rounded-md transition-colors flex items-center gap-2 ${
                                  formData.category === cat.id
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-slate-700 dark:text-slate-200 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600'
                                }`}
                              >
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                                {cat.name}
                              </button>
                            </DropdownMenuItem>
                          ))}
                          {categories.length > 0 && <DropdownMenuSeparator className="bg-slate-200 dark:bg-slate-700 my-1" />}
                          <DropdownMenuItem asChild>
                            <button
                              type="button"
                              className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm font-medium text-blue-600 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                              onClick={() => { setShowNewCategoryInput(true); setNewCategoryName(''); }}
                            >
                              <Plus size={15} />
                              Créer une catégorie
                            </button>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {showNewCategoryInput && (
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => {
                              const idx = listColorOptions.findIndex(c => c.value === newCategoryColor);
                              setNewCategoryColor(listColorOptions[(idx + 1) % listColorOptions.length].value);
                            }}
                            className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-700 shadow-sm shrink-0 transition-transform hover:scale-110"
                            style={{ backgroundColor: listColorOptions.find(c => c.value === newCategoryColor)?.color || '#3B82F6' }}
                            title="Changer la couleur"
                          />
                          <input
                            type="text"
                            autoFocus
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const name = newCategoryName.trim();
                                if (name.length < 2) {
                                  toast.error('Le nom de la catégorie doit contenir au moins 2 caractères');
                                  return;
                                }
                                createCategoryMutation.mutate(
                                  { name, color: listColorOptions.find(c => c.value === newCategoryColor)?.color || '#3B82F6' },
                                  {
                                    onSuccess: (created) => {
                                      handleInputChange('category', created.id);
                                      setShowNewCategoryInput(false);
                                      setNewCategoryName('');
                                      setNewCategoryColor('blue');
                                    }
                                  }
                                );
                              } else if (e.key === 'Escape') {
                                setShowNewCategoryInput(false);
                                setNewCategoryName('');
                                setNewCategoryColor('blue');
                              }
                            }}
                            placeholder="Nom de la catégorie..."
                            className="flex-1 px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:border-blue-500 border-slate-200 dark:border-slate-700"
                            style={{ backgroundColor: 'rgb(var(--color-surface))', color: 'rgb(var(--color-text-primary))' }}
                          />
                          <button
                            type="button"
                            disabled={newCategoryName.trim().length < 2 || createCategoryMutation.isPending}
                            onClick={() => {
                              const name = newCategoryName.trim();
                              if (name.length < 2) {
                                toast.error('Le nom de la catégorie doit contenir au moins 2 caractères');
                                return;
                              }
                              createCategoryMutation.mutate(
                                { name, color: listColorOptions.find(c => c.value === newCategoryColor)?.color || '#3B82F6' },
                                {
                                  onSuccess: (created) => {
                                    handleInputChange('category', created.id);
                                    setShowNewCategoryInput(false);
                                    setNewCategoryName('');
                                    setNewCategoryColor('blue');
                                  }
                                }
                              );
                            }}
                            className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-40 transition-all"
                          >
                            {createCategoryMutation.isPending ? 'Création...' : 'Créer'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShowNewCategoryInput(false); setNewCategoryName(''); setNewCategoryColor('blue'); }}
                            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            style={{ color: 'rgb(var(--color-text-secondary))' }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}

                        {errors.category &&
                          <div className="flex items-center gap-2 mt-1 text-red-600 dark:text-red-400 text-sm" role="alert">
                            <AlertCircle size={14} aria-hidden="true" />
                            {errors.category}
                          </div>
                        }
                      </div>
                  </div>

                  {/* Deadline and Estimated Time */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="task-deadline" className="block text-sm font-semibold mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                          Échéance
                        </label>
                        <DatePicker
                          value={formData.deadline}
                          onChange={(date) => handleInputChange('deadline', date)}
                          placeholder="Sélectionner une date"
                          className={`h-12 w-full ${errors.deadline ? 'border-red-300 dark:border-red-600' : ''}`}
                        />

                        {errors.deadline &&
                          <div id="deadline-error" className="flex items-center gap-2 mt-1 text-red-600 dark:text-red-400 text-sm" role="alert">
                            <AlertCircle size={14} aria-hidden="true" />
                            {errors.deadline}
                          </div>
                        }
                      </div>

                      <div>
                        <label htmlFor="task-time" className="block text-sm font-semibold mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                          Temps estimé (min)
                        </label>
                          <input
                            id="task-time"
                            type="number"
                            value={formData.estimatedTime === 0 ? '' : formData.estimatedTime}
                            onChange={(e) => handleInputChange('estimatedTime', e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="Estimation en minute"
                            className={`w-full px-4 h-12 border rounded-lg focus:outline-none hover:border-blue-500 focus:border-blue-600 focus:border-2 transition-all text-base ${
                              errors.estimatedTime ? 'border-red-300 dark:border-red-600' : 'border-slate-200 dark:border-slate-700'
                            } ${okrFields.estimatedTime ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''}`}
                            style={{
                              backgroundColor: okrFields.estimatedTime ? undefined : 'rgb(var(--color-surface))',
                              color: 'rgb(var(--color-text-primary))',
                              borderColor: errors.estimatedTime ? 'rgb(var(--color-error))' : (okrFields.estimatedTime ? undefined : undefined)
                            }}
                            aria-describedby={errors.estimatedTime ? 'time-error' : undefined}
                            aria-invalid={!!errors.estimatedTime}
                          />

                      {errors.estimatedTime &&
                        <div id="time-error" className="flex items-center gap-2 mt-1 text-red-600 dark:text-red-400 text-sm" role="alert">
                          <AlertCircle size={14} aria-hidden="true" />
                          {errors.estimatedTime}
                        </div>
                      }
                    </div>
                  </div>

                  {/* Status toggles */}
                  <div className="flex flex-wrap gap-4 items-center">
                      {!isCreating && (
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, completed: !prev.completed }))}
                          className={`flex items-center justify-between p-4 rounded-lg border transition-colors min-w-[140px] ${formData.completed ? 'bg-green-500 text-white border-green-600' : ''}`}
                          style={!formData.completed ? { backgroundColor: 'rgb(var(--color-hover))', borderColor: 'rgb(var(--color-border))' } : {}}
                        >
                          <div className="flex items-center gap-3">
                            <CheckCircle size={20} className={formData.completed ? 'text-white' : 'text-green-500'} aria-hidden="true" />
                            <span className="font-semibold text-sm">
                              {formData.completed ? '✓ Complétée — Annuler' : 'Marquer complétée'}
                            </span>
                          </div>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleInputChange('bookmarked', !formData.bookmarked)}
                        aria-label={formData.bookmarked ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                        className={`p-2.5 rounded-lg border transition-all ${
                          formData.bookmarked
                            ? 'bg-yellow-500/15 border-yellow-500/40'
                            : 'border-slate-200 dark:border-slate-700 hover:border-yellow-400/50 hover:bg-yellow-500/10'
                        }`}
                        style={!formData.bookmarked ? { backgroundColor: 'rgb(var(--color-hover))' } : {}}
                      >
                        <Bookmark
                          size={20}
                          className={formData.bookmarked ? 'text-yellow-500' : 'text-yellow-500/60'}
                          fill={formData.bookmarked ? 'currentColor' : 'none'}
                        />
                      </button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm font-medium border-slate-200 dark:border-slate-700 hover:border-blue-400/50 hover:bg-blue-500/10"
                            style={{
                              backgroundColor: 'rgb(var(--color-hover))',
                              color: 'rgb(var(--color-text-primary))',
                            }}
                          >
                            <List size={16} className="text-blue-500" />
                            Ajouter à une liste
                            <ChevronDown size={14} className="text-blue-500" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56 bg-[#1e293b] border-slate-700 text-white shadow-xl">
                          {lists.map(list => (
                            <DropdownMenuCheckboxItem
                              key={list.id}
                              checked={selectedListIds.includes(list.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedListIds([...selectedListIds, list.id]);
                                } else {
                                  setSelectedListIds(selectedListIds.filter(id => id !== list.id));
                                }
                                setHasChanges(true);
                              }}
                              className="focus:bg-slate-700 focus:text-white"
                            >
                              {list.name}
                            </DropdownMenuCheckboxItem>
                          ))}
                          {lists.length > 0 && <DropdownMenuSeparator className="bg-slate-700" />}
                          <DropdownMenuItem asChild>
                            <button
                              type="button"
                              className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-sm font-medium text-blue-300 bg-blue-500/15 hover:bg-blue-500/25 transition-colors"
                              onClick={() => { setShowNewListInput(true); setNewListName(''); }}
                            >
                              <Plus size={15} />
                              Créer une liste
                            </button>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {showNewListInput && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const idx = listColorOptions.findIndex(c => c.value === newListColor);
                              setNewListColor(listColorOptions[(idx + 1) % listColorOptions.length].value);
                            }}
                            className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-700 shadow-sm shrink-0 transition-transform hover:scale-110"
                            style={{ backgroundColor: listColorOptions.find(c => c.value === newListColor)?.color || '#3B82F6' }}
                            title="Changer la couleur"
                          />
                          <input
                            type="text"
                            autoFocus
                            value={newListName}
                            onChange={(e) => setNewListName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (!newListName.trim()) return;
                                createListMutation.mutate(
                                  { name: newListName.trim(), color: listColorOptions.find(c => c.value === newListColor)?.color || '#3B82F6' },
                                  {
                                    onSuccess: (created) => {
                                      setSelectedListIds(prev => [...prev, created.id]);
                                      setHasChanges(true);
                                      setShowNewListInput(false);
                                      setNewListName('');
                                      setNewListColor('blue');
                                    }
                                  }
                                );
                              } else if (e.key === 'Escape') {
                                setShowNewListInput(false);
                                setNewListName('');
                                setNewListColor('blue');
                              }
                            }}
                            placeholder="Nom de la liste..."
                            className="flex-1 px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:border-blue-500 border-slate-200 dark:border-slate-700"
                            style={{ backgroundColor: 'rgb(var(--color-surface))', color: 'rgb(var(--color-text-primary))' }}
                          />
                          <button
                            type="button"
                            disabled={!newListName.trim() || createListMutation.isPending}
                            onClick={() => {
                              if (!newListName.trim()) return;
                              createListMutation.mutate(
                                { name: newListName.trim(), color: listColorOptions.find(c => c.value === newListColor)?.color || '#3B82F6' },
                                {
                                  onSuccess: (created) => {
                                    setSelectedListIds(prev => [...prev, created.id]);
                                    setHasChanges(true);
                                    setShowNewListInput(false);
                                    setNewListName('');
                                    setNewListColor('blue');
                                  }
                                }
                              );
                            }}
                            className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-40 transition-all"
                          >
                            {createListMutation.isPending ? 'Création...' : 'Créer'}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShowNewListInput(false); setNewListName(''); setNewListColor('blue'); }}
                            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            style={{ color: 'rgb(var(--color-text-secondary))' }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}



                      <div className="flex flex-wrap gap-2 items-center">
                                {selectedListIds.map(id => {
                                  const list = lists.find(l => l.id === id);
                                  if (!list) return null;
                                  return (
                                    <div 
                                      key={id} 
                                      className="flex items-center gap-1.5 text-xs font-medium bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-lg border border-blue-500/20"
                                    >
                                      {list.name}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedListIds(selectedListIds.filter(lid => lid !== id));
                                          setHasChanges(true);
                                        }}
                                        className="text-blue-500 hover:text-blue-400 transition-colors"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                  </div>
                </div>
                )} {/* end step 1 */}

                {/* ── Step 2 : collaborateurs + aperçu ── */}
                {step === 2 && (
                <div className="space-y-5">

                    {/* Collaborators Section */}
                    <div>
                      <div className="flex items-center mb-3">
                        <label className="block text-sm font-semibold" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                          Collaborateurs
                        </label>
                      </div>

                      <div ref={collaboratorRef}>
                        {!isPremium() ? (
                          <div className="text-center py-6">
                            <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl flex items-center justify-center mx-auto mb-3">
                              <Users size={24} className="text-yellow-600 dark:text-yellow-400" />
                            </div>
                            <p className="text-sm mb-3" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                              Fonctionnalité Premium requise
                            </p>
                                            <Button type="button" size="sm" onClick={() => navigate('/premium')} className="bg-yellow-500 hover:bg-yellow-600 text-white border-0">
                              Débloquer Premium
                            </Button>
                          </div>
                        ) : (
                          <>
                            {/* Add collaborator by email/id */}
                            <div className="flex gap-2 mb-4">
                              <div className="relative flex-1">
                                <Mail
                                  size={16}
                                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500"
                                />
                                <input
                                  type="text"
                                  value={emailInput}
                                  onChange={(e) => setEmailInput(e.target.value)}
                                  placeholder="Email ou identifiant"
                                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none hover:border-blue-500 focus:border-blue-600 focus:border-2 text-sm transition-colors border-slate-200 dark:border-slate-700"
                                  style={{
                                    backgroundColor: 'rgb(var(--color-surface))',
                                    color: 'rgb(var(--color-text-primary))',
                                  }}
                                />
                              </div>
                              <Button
                                type="button"
                                size="icon"
                                onClick={handleAddEmail}
                                disabled={!emailInput.trim()}
                                className={emailInput.trim() ? 'bg-blue-600 hover:bg-blue-700 text-white border-0' : 'bg-blue-300 dark:bg-blue-900/50 text-white border-0 !opacity-100'}
                              >
                                <UserPlus size={16} />
                              </Button>
                            </div>

                            {/* Search users */}
                            <div className="relative mb-4">
                              <Search
                                size={16}
                                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500"
                              />
                              <input
                                type="text"
                                value={searchUser}
                                onChange={(e) => setSearchUser(e.target.value)}
                                placeholder="Rechercher parmi vos amis..."
                                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none hover:border-blue-500 focus:border-blue-600 focus:border-2 text-sm transition-colors border-slate-200 dark:border-slate-700"
                                  style={{
                                    backgroundColor: 'rgb(var(--color-surface))',
                                    color: 'rgb(var(--color-text-primary))',
                                  }}
                              />
                            </div>

                            {/* Friends list */}
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                              {filteredFriends.map((friend) => (
                                <CollaboratorItem
                                  key={friend.id}
                                  id={friend.id}
                                  name={friend.name}
                                  email={friend.email}
                                  avatar={friend.avatar}
                                  isSelected={collaborators.includes(friend.id)}
                                  onAction={() => toggleCollaborator(friend.id)}
                                  variant="toggle"
                                />
                              ))}
                              {filteredFriends.length === 0 && searchUser && (
                                <p className="text-center py-4 text-sm text-slate-500">Aucun contact trouvé</p>
                              )}
                            </div>

                            {/* Selected collaborators */}
                            {collaborators.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Sélectionnés ({collaborators.length})
                                  </h4>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  {collaborators.map((userId) => {
                                    const info = displayInfo(userId);
                                    return (
                                      <CollaboratorItem
                                        key={userId}
                                        id={userId}
                                        name={info.name}
                                        email={info.email}
                                        avatar={info.avatar}
                                        isPending={info.isPending}
                                        onAction={() => handleRemoveCollaborator(userId)}
                                        variant="remove"
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                  {/* Task Preview */}
                  <div>
                    <div className="flex items-center mb-3">
                      <label className="block text-sm font-semibold" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                        Aperçu de la tâche
                      </label>
                    </div>
                    <div className="p-4 rounded-lg border transition-colors flex items-center justify-between" style={{
                      backgroundColor: 'rgb(var(--color-surface))',
                      borderColor: 'rgb(var(--color-border))'
                    }}>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 rounded" style={{ backgroundColor: getCategoryColor(formData.category) }} />
                          <span className="font-medium" style={{ color: 'rgb(var(--color-text-primary))' }}>
                            {formData.name || 'Nom de la tâche'}
                          </span>
                          {formData.bookmarked && <BookmarkCheck size={16} className="text-yellow-500" fill="#EAB308" />}
                        </div>
                        <div className="flex items-center gap-4 text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                          <span>Priorité {formData.priority}</span>
                          <span>{formData.estimatedTime} min</span>
                          {formData.completed && <span className="text-blue-600 dark:text-blue-400">✓ Complétée</span>}
                        </div>
                      </div>
                      {collaborators.length > 0 && (
                        <CollaboratorAvatars collaborators={collaborators} friends={friends} size="md" />
                      )}
                    </div>
                  </div>
                </div>
                )} {/* end step 2 */}

                {/* ── Action Buttons ── */}
                <div className="flex justify-between items-center pt-6 border-t mt-6" style={{ borderColor: 'rgb(var(--color-border))' }}>
                  {step === 1 ? (
                    <>
                      {!isCreating ? (
                        <Button type="button" variant="destructive" onClick={handleDelete} disabled={isLoading}>
                          <Trash2 size={14} data-icon="inline-start" />
                          <span className="hidden sm:inline">Supprimer</span>
                        </Button>
                      ) : <div />}
                      <div className="flex gap-2 sm:gap-3">
                        <Button type="button" variant="outline" size="lg" onClick={handleClose} disabled={isLoading}>
                          Annuler
                        </Button>
                        <Button
                          type="button"
                          size="lg"
                          onClick={(e) => { e.preventDefault(); if (validateForm()) setStep(2); }}
                          disabled={!isStep1Valid()}
                          className={!isStep1Valid() ? '!bg-blue-300 dark:!bg-blue-900/60 !text-white !border-0 !opacity-100 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 !text-white !border-0'}
                        >
                          Suivant
                          <ChevronRight size={16} data-icon="inline-end" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <Button type="button" variant="outline" size="lg" onClick={() => setStep(1)} disabled={isLoading}>
                        ← Retour
                      </Button>
                      <div className="flex gap-2 sm:gap-3">
                        {!isCreating && (
                          <Button type="button" variant="destructive" onClick={handleDelete} disabled={isLoading}>
                            <Trash2 size={14} data-icon="inline-start" />
                            <span className="hidden sm:inline">Supprimer</span>
                          </Button>
                        )}
                        <Button
                          type="submit"
                          size="lg"
                          disabled={isLoading || !isFormValid() || (!hasChanges && !isCreating)}
                          className={
                            isLoading || !isFormValid() || (!hasChanges && !isCreating)
                              ? '!bg-blue-300 dark:!bg-blue-900/60 !text-white !border-0 !opacity-100 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700 !text-white !border-0'
                          }
                        >
                          {isLoading ? (
                            <>
                              <Loader2 size={16} className="animate-spin" data-icon="inline-start" />
                              <span>{isCreating ? 'Création...' : 'Sauvegarde...'}</span>
                            </>
                          ) : (
                            isCreating ? 'Créer la tâche' : 'Sauvegarder'
                          )}
                        </Button>
                      </div>
                    </>
                  )}
              </div>
            </form>
          </div>
        </div>
        
        <AnimatePresence>
          {showDeleteConfirm && (
            <div className="absolute inset-0 bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4 sm:rounded-2xl">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700"
              >
                <div className="p-6">
                  <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                    <Trash2 className="text-red-600 dark:text-red-400" size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Supprimer la tâche</h3>
                  <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6">
                    Êtes-vous sûr de vouloir supprimer cette tâche ? Cette action est irréversible.
                  </p>
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowDeleteConfirm(false)}
                    >
                      Annuler
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="flex-1"
                      onClick={confirmDelete}
                      disabled={isLoading}
                    >
                      {isLoading
                        ? <><Loader2 size={14} className="animate-spin" data-icon="inline-start" />Suppression...</>
                        : <><Trash2 size={14} data-icon="inline-start" />Supprimer</>
                      }
                    </Button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
            </AnimatePresence>
            
            <ColorSettingsModal 
              isOpen={showCategoryModal} 
              onClose={() => setShowCategoryModal(false)} 
              isNested={true}
            />
          </DialogContent>
        </Dialog>

    );
  };

export default TaskModal;

