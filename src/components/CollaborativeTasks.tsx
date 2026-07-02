import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, UserPlus, Check, Bookmark, Calendar, MoreHorizontal, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage, AvatarGroup } from './ui/avatar';
import { isImageAvatar, isEmojiAvatar } from '@/lib/avatar';
import TaskModal from './TaskModal';
import EventModal from './EventModal';
import AddToListModal from './AddToListModal';

// ═══════════════════════════════════════════════════════════════════
// Module tasks - Hooks indépendants (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useTasks, useDeleteTask, useToggleTaskBookmark, Task } from '@/modules/tasks';
import { useCreateEvent, CreateEventInput } from '@/modules/events';

// ═══════════════════════════════════════════════════════════════════
// Module categories - (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useCategories } from '@/modules/categories';

import { useAuth } from '@/modules/auth/AuthContext';
import { useFriends, useSharesByTask } from '@/modules/friends';

// « il y a 2 h » / « à l'instant » — fraîcheur d'une tâche partagée (#40).
const formatRelativeTime = (iso: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days} j`;
  return `le ${new Date(iso).toLocaleDateString('fr-FR')}`;
};

const CollaborativeTasks: React.FC = () => {
  // ═══════════════════════════════════════════════════════════════════
  // TASKS - Depuis le module tasks (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: tasks = [], isLoading } = useTasks();
  const deleteMutation         = useDeleteTask();
  const toggleBookmarkMutation = useToggleTaskBookmark();
  const createEventMutation    = useCreateEvent();

  // ═══════════════════════════════════════════════════════════════════
  // CATEGORIES - Depuis le module categories (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: categories = [] } = useCategories();

  const { user } = useAuth();
  const { data: friends = [] } = useFriends();

  // shared_tasks = source de vérité du partage (colonne `tasks.collaborators`
  // supprimée — migration 028). Map taskId -> friendIds pour compteurs/avatars.
  const sharesByTask = useSharesByTask();

  const getCategoryColor = (categoryId: string) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category?.color || '#6b7280';
  };

  // Action modals
  const [taskModalTask, setTaskModalTask]               = useState<Task | null>(null);
  const [taskToEventModal, setTaskToEventModal]         = useState<Task | null>(null);
  const [addToListTask, setAddToListTask]               = useState<string | null>(null);
  const [collaboratorModalTaskId, setCollaboratorModalTaskId] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete]                 = useState<string | null>(null);

  const handleCreateEventFromTask = (eventData: CreateEventInput) => {
    if (taskToEventModal) {
      createEventMutation.mutate({ ...eventData, taskId: taskToEventModal.id });
    }
    setTaskToEventModal(null);
  };

  const confirmDelete = () => {
    if (!taskToDelete) return;
    deleteMutation.mutate(taskToDelete, { onSuccess: () => setTaskToDelete(null) });
  };

  // Exclude tasks assigned by others that haven't been accepted yet (still pending in SocialRequests)
  const collaborativeTasks = tasks.filter(task =>
    task.isCollaborative && (!task.sharedBy || task.sharedBy === user?.name)
  );

  const isOwner = (task: Task) => {
    return !task.sharedBy || task.sharedBy === user?.name;
  };

  if (isLoading) {
    return (
      <div className="p-8 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl animate-pulse">
        <div className="h-8 w-48 bg-[rgb(var(--color-border))] rounded mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-[rgb(var(--color-border))] rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-8 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div>
                <h2 className="text-xl font-bold text-[rgb(var(--color-text-primary))]">Tâches collaboratives</h2>
                <p className="text-[rgb(var(--color-text-secondary))] text-sm">{collaborativeTasks.length} tâches partagées</p>
              </div>
            </div>
        </div>

        <div className="space-y-4">
            {collaborativeTasks.map(task => {
              const categoryColor = getCategoryColor(task.category);
              const owner = isOwner(task);
              const ownerFriend = friends.find(f => f.name === task.sharedBy);

                return (
                  <div
                    key={task.id}
                    className="collaborative-task group p-4 rounded-2xl border transition-all duration-300 hover:shadow-lg hover:scale-[1.01] cursor-pointer"
                    style={{
                      backgroundColor: `${categoryColor}25`,
                      borderColor: `${categoryColor}60`
                    }}
                    onClick={() => setTaskModalTask(task)}
                  >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-bold text-[rgb(var(--color-text-primary))]">{task.name}</h3>
                      <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-[rgb(var(--color-text-secondary))]">
                        <div className="flex items-center gap-1.5">
                          <Users size={14} />
                          <span>Partagé par {task.sharedBy || 'Moi'}</span>
                        </div>
                        {!owner && (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium">
                            <span>Contact : {ownerFriend?.email || `${task.sharedBy?.toLowerCase().replace(' ', '.')}@example.com`}</span>
                          </div>
                        )}
                        <span>{sharesByTask.get(task.id)?.length ?? 0} collaborateurs</span>
                        {/* Fraîcheur (#40) : dernière modification de la tâche partagée */}
                        {task.updatedAt && (
                          <span className="text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
                            modifiée {formatRelativeTime(task.updatedAt)}
                          </span>
                        )}
                      </div>
                    </div>

                
                  <div className="flex items-center gap-2">
                    {/* Action icons */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleBookmarkMutation.mutate(task.id); }}
                        className="p-1.5 rounded-lg hover:bg-[rgb(var(--color-hover))] transition-colors"
                        title="Favori"
                      >
                        <Bookmark size={15} className={task.bookmarked ? 'text-amber-500 fill-amber-500' : 'text-[rgb(var(--color-text-muted))]'} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setTaskToEventModal(task); }}
                        className="p-1.5 rounded-lg hover:bg-[rgb(var(--color-hover))] transition-colors"
                        title="Ajouter à l'agenda"
                      >
                        <Calendar size={15} className="text-[rgb(var(--color-text-muted))]" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setAddToListTask(task.id); }}
                        className="p-1.5 rounded-lg hover:bg-[rgb(var(--color-hover))] transition-colors"
                        title="Ajouter à une liste"
                      >
                        <MoreHorizontal size={15} className="text-[rgb(var(--color-text-muted))]" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setCollaboratorModalTaskId(task.id); }}
                        className="p-1.5 rounded-lg hover:bg-[rgb(var(--color-hover))] transition-colors"
                        title="Collaborateurs"
                      >
                        <UserPlus size={15} className="text-[rgb(var(--color-text-muted))]" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setTaskToDelete(task.id); }}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={15} className="text-[rgb(var(--color-text-muted))] hover:text-red-500 transition-colors" />
                      </button>
                    </div>

                    <AvatarGroup>
                    {(sharesByTask.get(task.id) ?? []).map((collaborator, index) => {
                      const hasValidated = task.collaboratorValidations?.[collaborator] ?? false;
                      const friend = friends.find(f => f.userId === collaborator || f.id === collaborator || f.name === collaborator);
                      const initials = collaborator.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                      const isEmoji = isEmojiAvatar(friend?.avatar);

                      return (
                        <div key={index} className="relative" title={`${collaborator} - ${hasValidated ? 'Validé' : 'Non validé'}`}>
                          <Avatar className="size-9">
                            {isImageAvatar(friend?.avatar) && (
                              <AvatarImage src={friend?.avatar} alt={collaborator} />
                            )}
                            <AvatarFallback className={
                              hasValidated
                                ? 'bg-gradient-to-br from-green-400 to-emerald-500 text-white text-xs font-bold shadow-lg shadow-green-500/30'
                                : 'bg-[rgb(var(--color-active))] text-[rgb(var(--color-text-secondary))] text-xs font-bold'
                            }>
                              {isEmoji ? <span className="text-base">{friend?.avatar}</span> : initials}
                            </AvatarFallback>
                          </Avatar>
                          {hasValidated && (
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[rgb(var(--color-surface))] rounded-full flex items-center justify-center shadow-md z-10">
                              <Check size={10} className="text-green-500" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    </AvatarGroup>
                  </div>

              </div>
            </div>
          );
        })}

          {collaborativeTasks.length === 0 && (
            <div className="text-center py-8 text-[rgb(var(--color-text-muted))]">
              <Users size={48} className="mx-auto mb-4 opacity-30" />
              <p>Aucune tâche collaborative</p>
              <p className="text-sm">Commencez à partager des tâches avec votre équipe</p>
            </div>
          )}
        </div>
      </div>

      {/* Action modals */}
      {taskModalTask && (
        <TaskModal task={taskModalTask} isOpen={!!taskModalTask} onClose={() => setTaskModalTask(null)} />
      )}
      {taskToEventModal && (
        <EventModal
          mode="convert"
          isOpen={true}
          onClose={() => setTaskToEventModal(null)}
          task={taskToEventModal}
          onConvert={handleCreateEventFromTask}
        />
      )}
      {addToListTask && (
        <AddToListModal isOpen={true} onClose={() => setAddToListTask(null)} taskId={addToListTask} />
      )}
      {/* Collaborateurs — réutilise la vue Collaborateurs de TaskModal (étape 2). */}
      {collaboratorModalTaskId && (() => {
        const collabTask = tasks.find(t => t.id === collaboratorModalTaskId);
        return collabTask ? (
          <TaskModal task={collabTask} isOpen onClose={() => setCollaboratorModalTaskId(null)} showCollaborators />
        ) : null;
      })()}
      {taskToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
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
                <button
                  onClick={() => setTaskToDelete(null)}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-all shadow-md shadow-red-500/20"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

export default CollaborativeTasks;
