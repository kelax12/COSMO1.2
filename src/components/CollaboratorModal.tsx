import React, { useMemo, useState } from 'react';
import { X, Users, UserPlus, Search } from 'lucide-react';
import CollaboratorItem from './CollaboratorItem';

// ═══════════════════════════════════════════════════════════════════
// Module tasks - Hooks indépendants (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useTasks, useUpdateTask, Task } from '@/modules/tasks';

// ═══════════════════════════════════════════════════════════════════
// TaskContext - uniquement pour domaines NON MIGRÉS
// ═══════════════════════════════════════════════════════════════════
import { useTasks as useTaskContext } from '../context/TaskContext';

type CollaboratorModalProps = {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CollaboratorModal: React.FC<CollaboratorModalProps> = ({ isOpen, onClose, taskId }) => {
  // ═══════════════════════════════════════════════════════════════════
  // TASKS - Depuis le module tasks (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: tasks = [] } = useTasks();
  const updateTaskMutation = useUpdateTask();

  // ═══════════════════════════════════════════════════════════════════
  // Domaines NON MIGRÉS (depuis TaskContext)
  // ═══════════════════════════════════════════════════════════════════
  const { friends, sendFriendRequest } = useTaskContext();

  const task = tasks.find((t) => t.id === taskId);

  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');

  const assignedCollaborators = task?.collaborators || [];

  const availableFriends = useMemo(
    () =>
      (friends || []).filter(
        (friend) => !assignedCollaborators.includes(friend.id) &&
          (search.trim() === '' ||
            friend.name.toLowerCase().includes(search.toLowerCase()) ||
            friend.email.toLowerCase().includes(search.toLowerCase()))
      ),
    [friends, assignedCollaborators, search]
  );

  if (!isOpen) return null;
  if (!task) return null;

  const handleAdd = () => {
    if (!task) return;
    const value = input.trim().toLowerCase();
    if (!value) return;
    
    const friend = friends.find(f => f.email.toLowerCase() === value);
    
    if (friend) {
      if (!assignedCollaborators.includes(friend.name)) {
        updateTaskMutation.mutate({
          id: task.id,
          updates: {
            isCollaborative: true,
            collaborators: [...assignedCollaborators, friend.name],
            collaboratorValidations: {
              ...task.collaboratorValidations,
              [friend.name]: false
            }
          }
        });
      }
    } else {
      if (assignedCollaborators.includes(value)) {
        setInput('');
        return;
      }
      const pendingInvites = task.pendingInvites || [];
      if (!pendingInvites.includes(value)) {
        sendFriendRequest(value);
        updateTaskMutation.mutate({
          id: task.id,
          updates: {
            isCollaborative: true,
            collaborators: [...assignedCollaborators, value],
            pendingInvites: [...pendingInvites, value],
            collaboratorValidations: {
              ...task.collaboratorValidations,
              [value]: false
            }
          }
        });
      }
    }
    setInput('');
  };

  const handleToggleFriend = (friendId: string) => {
    if (!task) return;
    const friend = friends.find(f => f.id === friendId);
    const name = friend?.name || friendId;
    
    if (assignedCollaborators.includes(name)) {
      const newCollaborators = assignedCollaborators.filter((c) => c !== name);
      const newValidations = { ...task.collaboratorValidations };
      delete newValidations[name];
      updateTaskMutation.mutate({
        id: task.id,
        updates: {
          collaborators: newCollaborators,
          isCollaborative: newCollaborators.length > 0,
          collaboratorValidations: newValidations
        }
      });
    } else {
      updateTaskMutation.mutate({
        id: task.id,
        updates: {
          isCollaborative: true,
          collaborators: [...assignedCollaborators, name],
          collaboratorValidations: {
            ...task.collaboratorValidations,
            [name]: false
          }
        }
      });
    }
  };

  const handleRemove = (collaboratorName: string) => {
    if (!task) return;
    const newCollaborators = assignedCollaborators.filter((c) => c !== collaboratorName);
    const newValidations = { ...task.collaboratorValidations };
    delete newValidations[collaboratorName];
    const newPendingInvites = (task.pendingInvites || []).filter(e => e !== collaboratorName);
    
    updateTaskMutation.mutate({
      id: task.id,
      updates: {
        collaborators: newCollaborators,
        isCollaborative: newCollaborators.length > 0,
        collaboratorValidations: newValidations,
        pendingInvites: newPendingInvites
      }
    });
  };

  const displayInfo = (id: string) => {
    const friend = friends?.find((f) => f.id === id || f.name === id);
    if (friend) {
      return { name: friend.name, email: friend.email, avatar: friend.avatar, isPending: false };
    }
    const isPending = (task?.pendingInvites || []).includes(id);
    if (emailRegex.test(id)) {
      return { name: id, email: id, avatar: undefined, isPending };
    }
    return { name: id, email: undefined, avatar: undefined, isPending };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 opacity-0 animate-modal-backdrop">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl shadow-2xl transition-colors opacity-0 scale-95 animate-modal-content" style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b transition-colors" style={{ borderColor: 'rgb(var(--color-border))' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide" style={{ color: 'rgb(var(--color-text-muted))' }}>Collaborateurs</p>
              <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                {task.name}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'rgb(var(--color-text-muted))' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'rgb(var(--color-text-primary))';
              e.currentTarget.style.backgroundColor = 'rgb(var(--color-hover))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgb(var(--color-text-muted))';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            aria-label="Fermer la fenêtre des collaborateurs"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8 overflow-y-auto max-h-[70vh]">
            {/* Assigned collaborators */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold" style={{ color: 'rgb(var(--color-text-secondary))' }}>Collaborateurs assignés</h3>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  {assignedCollaborators.length}
                </span>
              </div>
              {assignedCollaborators.length === 0 ? (
                <div className="p-8 rounded-2xl border-2 border-dashed text-center transition-colors" style={{ borderColor: 'rgb(var(--color-border))' }}>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: 'rgb(var(--color-hover))' }}>
                    <Users className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-sm" style={{ color: 'rgb(var(--color-text-muted))' }}>Aucun collaborateur pour l'instant.</p>
                </div>
              ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {assignedCollaborators.map((collaboratorId) => {
                      const info = displayInfo(collaboratorId);
                      return (
                        <CollaboratorItem
                          key={collaboratorId}
                          id={collaboratorId}
                          name={info.name}
                          email={info.email}
                          avatar={info.avatar}
                          isPending={info.isPending}
                          onAction={() => handleRemove(collaboratorId)}
                          variant="remove"
                        />
                      );
                    })}
                  </div>
              )}
            </section>


          {/* Add collaborator by email/id */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold" style={{ color: 'rgb(var(--color-text-secondary))' }}>Ajouter un collaborateur</h3>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Email ou identifiant"
                  className="w-full px-4 py-3 pr-10 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  style={{ 
                    backgroundColor: 'rgb(var(--color-surface))', 
                    borderColor: 'rgb(var(--color-border))',
                    color: 'rgb(var(--color-text-primary))'
                  }}
                />
                {input && (
                  <button
                    onClick={() => setInput('')}
                    className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-600"
                    aria-label="Effacer l'entrée"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                onClick={handleAdd}
                disabled={!input.trim()}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <UserPlus size={16} />
                Ajouter
              </button>
            </div>
            {input && !emailRegex.test(input.trim()) && input.includes('@') && (
              <p className="text-xs text-orange-500">Le format de l'adresse semble invalide.</p>
            )}
          </section>

            {/* Available friends */}
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="text-sm font-semibold" style={{ color: 'rgb(var(--color-text-secondary))' }}>Collaborateurs disponibles</h3>
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher un contact"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    style={{ 
                      backgroundColor: 'rgb(var(--color-surface))', 
                      borderColor: 'rgb(var(--color-border))',
                      color: 'rgb(var(--color-text-primary))'
                    }}
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {availableFriends.length === 0 ? (
                <div className="p-8 rounded-2xl text-center transition-colors" style={{ backgroundColor: 'rgb(var(--color-hover))' }}>
                  <p className="text-sm" style={{ color: 'rgb(var(--color-text-muted))' }}>Aucun contact trouvé.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availableFriends.map((friend) => (
                    <CollaboratorItem
                      key={friend.id}
                      id={friend.id}
                      name={friend.name}
                      email={friend.email}
                      avatar={friend.avatar}
                      onAction={() => handleToggleFriend(friend.id)}
                      variant="add"
                    />
                  ))}
                </div>
              )}
            </section>

        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t transition-colors" style={{ backgroundColor: 'rgb(var(--color-hover))', borderColor: 'rgb(var(--color-border))' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg transition-colors"
            style={{ color: 'rgb(var(--color-text-primary))', backgroundColor: 'rgb(var(--color-active))' }}
            onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(0.95)'}
            onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default CollaboratorModal;
