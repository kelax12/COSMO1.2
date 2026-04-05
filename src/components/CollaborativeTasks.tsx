import React, { useState, useMemo } from 'react';
import { Users, Lock, Plus, X, UserPlus, Check, Search, AlertTriangle, Mail } from 'lucide-react';
import CollaboratorAvatars from './CollaboratorAvatars';
import CollaboratorItem from './CollaboratorItem';

// ═══════════════════════════════════════════════════════════════════
// Module tasks - Hooks indépendants (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useTasks, useUpdateTask, Task } from '@/modules/tasks';

// ═══════════════════════════════════════════════════════════════════
// Module categories - (MIGRÉ)
// ═══════════════════════════════════════════════════════════════════
import { useCategories } from '@/modules/categories';

// ═══════════════════════════════════════════════════════════════════
// TaskContext - uniquement pour domaines NON MIGRÉS
// ═══════════════════════════════════════════════════════════════════
import { useTasks as useTaskContext } from '../context/TaskContext';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CollaborativeTasks: React.FC = () => {
  // ═══════════════════════════════════════════════════════════════════
  // TASKS - Depuis le module tasks (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: tasks = [], isLoading } = useTasks();
  const updateTaskMutation = useUpdateTask();

  // ═══════════════════════════════════════════════════════════════════
  // CATEGORIES - Depuis le module categories (MIGRÉ)
  // ═══════════════════════════════════════════════════════════════════
  const { data: categories = [] } = useCategories();

  // ═══════════════════════════════════════════════════════════════════
  // Domaines NON MIGRÉS (depuis TaskContext)
  // ═══════════════════════════════════════════════════════════════════
  const { user, isPremium, friends, priorityRange, sendFriendRequest } = useTaskContext();
  
  const getCategoryColor = (categoryId: string) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category?.color || '#6b7280';
  };
  
  const getCategoryName = (categoryId: string) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category?.name || 'Sans catégorie';
  };
  
  const [showPopup, setShowPopup] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [collaboratorSearchQuery, setCollaboratorSearchQuery] = useState('');
  const [emailInput, setEmailInput] = useState('');
  
  const selectedTask = selectedTaskId ? tasks.find(t => t.id === selectedTaskId) || null : null;
  
  const premium = isPremium();
  const collaborativeTasks = tasks.filter(task => task.isCollaborative);
  
  const isOwner = (task: Task) => {
    return !task.sharedBy || task.sharedBy === user?.name;
  };

  const filteredTasks = useMemo(() => {
    let filtered = tasks
      .filter(task => !task.completed)
      .filter(task => task.priority >= priorityRange[0] && task.priority <= priorityRange[1]);
    
    if (searchQuery.trim()) {
      filtered = filtered.filter(task => 
        task.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (showOverdueOnly) {
      const now = new Date();
      filtered = filtered.filter(task => new Date(task.deadline) < now);
    }
    
    return filtered;
  }, [tasks, priorityRange, searchQuery, showOverdueOnly]);

  const handleOpenPopup = () => {
    setShowPopup(true);
    setSelectedTaskId(null);
  };

  const handleSelectTask = (task: Task) => {
    setSelectedTaskId(task.id);
  };

  const handleAddCollaborator = (collaboratorName: string) => {
    if (!selectedTask) return;
    const currentCollaborators = selectedTask.collaborators || [];
    if (!currentCollaborators.includes(collaboratorName)) {
      updateTaskMutation.mutate({
        id: selectedTask.id,
        updates: {
          isCollaborative: true,
          collaborators: [...currentCollaborators, collaboratorName],
          collaboratorValidations: {
            ...selectedTask.collaboratorValidations,
            [collaboratorName]: false
          }
        }
      });
    }
  };

  const handleRemoveCollaborator = (collaboratorName: string) => {
    if (!selectedTask) return;
    const currentCollaborators = selectedTask.collaborators || [];
    const newCollaborators = currentCollaborators.filter(c => c !== collaboratorName);
    const newValidations = { ...selectedTask.collaboratorValidations };
    delete newValidations[collaboratorName];
    const newPendingInvites = (selectedTask.pendingInvites || []).filter(e => e !== collaboratorName);
    
    updateTaskMutation.mutate({
      id: selectedTask.id,
      updates: {
        collaborators: newCollaborators,
        isCollaborative: newCollaborators.length > 0,
        collaboratorValidations: newValidations,
        pendingInvites: newPendingInvites
      }
    });
  };

  const handleAddCollaboratorByEmail = () => {
    if (!selectedTask || !emailInput.trim()) return;
    
    const email = emailInput.trim().toLowerCase();
    const friend = friends.find(f => f.email.toLowerCase() === email);
    
    if (friend) {
      handleAddCollaborator(friend.name);
    } else {
      const currentCollaborators = selectedTask.collaborators || [];
      const pendingInvites = selectedTask.pendingInvites || [];
      
      if (!currentCollaborators.includes(email) && !pendingInvites.includes(email)) {
        sendFriendRequest(email);
        updateTaskMutation.mutate({
          id: selectedTask.id,
          updates: {
            isCollaborative: true,
            collaborators: [...currentCollaborators, email],
            pendingInvites: [...pendingInvites, email],
            collaboratorValidations: {
              ...selectedTask.collaboratorValidations,
              [email]: false
            }
          }
        });
      }
    }
    setEmailInput('');
  };

  const displayInfo = (id: string) => {
    const friend = friends?.find((f) => f.id === id || f.name === id);
    if (friend) {
      return { name: friend.name, email: friend.email, avatar: friend.avatar, isPending: false };
    }
    const isPending = (selectedTask?.pendingInvites || []).includes(id);
    if (emailRegex.test(id)) {
      return { name: id, email: id, avatar: undefined, isPending };
    }
    return { name: id, email: undefined, avatar: undefined, isPending };
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

  if (!premium) {
    return (
      <div className="p-8 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl">
        <div className="text-center">
          <div className="p-4 bg-yellow-100 dark:bg-yellow-900/20 rounded-2xl inline-block mb-4">
            <Lock size={32} className="text-yellow-600 dark:text-yellow-400" />
          </div>
          <h2 className="text-2xl font-bold text-[rgb(var(--color-text-primary))] mb-2">Tâches collaboratives</h2>
          <p className="text-[rgb(var(--color-text-secondary))] mb-6">
            Débloquez Premium pour accéder aux tâches collaboratives et travailler en équipe
          </p>
          <button className="btn-primary">
            <Plus size={20} />
            <span>Débloquer Premium</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-8 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800/30">
                <Users size={24} className="text-blue-500 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[rgb(var(--color-text-primary))]">Tâches collaboratives</h2>
                <p className="text-[rgb(var(--color-text-secondary))] text-sm">{collaborativeTasks.length} tâches partagées</p>
              </div>
            </div>
          
          <button 
            onClick={handleOpenPopup}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
          >
            <UserPlus size={20} />
            <span className="hidden sm:inline">Gérer collaborateurs</span>
          </button>
        </div>

        <div className="space-y-4">
            {collaborativeTasks.map(task => {
              const categoryColor = getCategoryColor(task.category);
              const owner = isOwner(task);
              const ownerFriend = friends.find(f => f.name === task.sharedBy);

                return (
                  <div 
                    key={task.id} 
                    className="collaborative-task p-4 rounded-2xl border transition-all duration-300 hover:shadow-lg hover:scale-[1.01] cursor-pointer group"
                    style={{ 
                      backgroundColor: `${categoryColor}25`,
                      borderColor: `${categoryColor}60`
                    }}
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
                        <span className="capitalize">{task.permissions}</span>
                        <span>{task.collaborators?.length} collaborateurs</span>
                      </div>
                    </div>

                
                  <div className="flex items-center gap-2">
                    {task.collaborators?.map((collaborator, index) => {
                      const hasValidated = task.collaboratorValidations?.[collaborator] ?? false;
                      const friend = friends.find(f => f.name === collaborator || f.id === collaborator);
                      const initials = collaborator.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                      
                      return (
                        <div 
                          key={index}
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold relative transition-all overflow-hidden ${
                            hasValidated 
                              ? 'bg-gradient-to-br from-green-400 to-emerald-500 text-white shadow-lg shadow-green-500/30' 
                              : 'bg-[rgb(var(--color-active))] text-[rgb(var(--color-text-secondary))]'
                          }`}
                          title={`${collaborator} - ${hasValidated ? 'Validé' : 'Non validé'}`}
                        >
                          {friend?.avatar ? (
                            friend.avatar.startsWith('http') ? (
                              <img src={friend.avatar} alt={collaborator} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xl">{friend.avatar}</span>
                            )
                          ) : (
                            <span>{initials}</span>
                          )}
                          {hasValidated && (
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[rgb(var(--color-surface))] rounded-full flex items-center justify-center shadow-md z-10">
                              <Check size={12} className="text-green-500" />
                            </div>
                          )}
                        </div>
                      );
                    })}
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

      {showPopup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[rgb(var(--color-surface))] rounded-3xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden border border-[rgb(var(--color-border))]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgb(var(--color-border))]">
              <h2 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">
                Gérer les collaborateurs
              </h2>
              <button 
                onClick={() => setShowPopup(false)}
                className="p-1.5 hover:bg-[rgb(var(--color-hover))] rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex h-[60vh]">
              <div className="w-1/2 border-r border-[rgb(var(--color-border))] overflow-y-auto p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]" />
                    <input
                      type="text"
                      placeholder="Rechercher une tâche..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={() => setShowOverdueOnly(!showOverdueOnly)}
                    className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg transition-all ${
                      showOverdueOnly
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700'
                        : 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))] border border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-active))]'
                    }`}
                    title="Afficher uniquement les tâches en retard"
                  >
                    <AlertTriangle size={16} />
                    <span>Retard</span>
                  </button>
                </div>
                <h3 className="text-sm font-semibold mb-3 text-[rgb(var(--color-text-muted))] uppercase tracking-wider">
                  Sélectionner une tâche ({filteredTasks.length})
                </h3>
                <div className="space-y-2">
                  {filteredTasks.map(task => {
                    const isOverdue = new Date(task.deadline) < new Date();
                    return (
                      <button
                        key={task.id}
                        onClick={() => handleSelectTask(task)}
                        className={`w-full text-left p-4 rounded-xl transition-all ${
                          selectedTask?.id === task.id
                            ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500'
                            : showOverdueOnly && isOverdue
                              ? 'bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/40 border-2 border-red-300 dark:border-red-700'
                              : 'bg-[rgb(var(--color-hover))] hover:bg-[rgb(var(--color-active))] border-2 border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: getCategoryColor(task.category) }}
                            title={getCategoryName(task.category)}
                          />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-[rgb(var(--color-text-primary))] block truncate">
                              {task.name}
                            </span>
                            <span className="text-xs text-[rgb(var(--color-text-secondary))]">
                              {getCategoryName(task.category)}
                            </span>
                          </div>
                          {task.isCollaborative && (
                            <span className="px-2 py-1 bg-blue-500 text-white text-xs rounded-full flex-shrink-0">
                              {task.collaborators?.length || 0} collab.
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="w-1/2 overflow-y-auto p-4">
                {selectedTask ? (
                  <>
                    <h3 className="text-lg font-semibold mb-4 text-[rgb(var(--color-text-primary))]">
                      Collaborateurs pour "{selectedTask.name}"
                    </h3>
                    
{selectedTask.collaborators && selectedTask.collaborators.length > 0 && (
                        <div className="mb-6">
                          <h4 className="text-sm font-medium text-[rgb(var(--color-text-secondary))] mb-3">
                            Collaborateurs actuels
                          </h4>
                          <div className="space-y-2">
                            {selectedTask.collaborators.map((collaborator, index) => {
                              const info = displayInfo(collaborator);
                              return (
                                <CollaboratorItem
                                  key={index}
                                  id={collaborator}
                                  name={info.name}
                                  email={info.email}
                                  avatar={info.avatar}
                                  isPending={info.isPending}
                                  onAction={() => handleRemoveCollaborator(collaborator)}
                                  variant="remove"
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}

                    <div>
                      <h4 className="text-sm font-medium text-[rgb(var(--color-text-secondary))] mb-3">
                        Ajouter un collaborateur
                      </h4>
                      
<div className="space-y-3 mb-4">
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
                                  className="w-full pl-10 pr-4 h-10 border rounded-lg focus:outline-none hover:border-blue-500 focus:border-blue-600 focus:border-2 text-sm transition-colors border-slate-200 dark:border-slate-700"
                                  style={{
                                    backgroundColor: 'rgb(var(--color-surface))',
                                    color: 'rgb(var(--color-text-primary))',
                                  }}
                                />
                              </div>
<button
                                  onClick={handleAddCollaboratorByEmail}
                                  className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center justify-center h-10"
                                >
                                  <UserPlus size={16} />
                                </button>
                            </div>
                          <div className="relative">
                              <input
                                type="text"
                                placeholder="Rechercher un contact..."
                                value={collaboratorSearchQuery}
                                onChange={(e) => setCollaboratorSearchQuery(e.target.value)}
                                className="w-full px-4 h-10 pl-10 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-muted))] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]" />
                            </div>
                        
                        </div>
                      
                      <div className="space-y-2">
                          {friends
                            .filter(friend => !selectedTask.collaborators?.includes(friend.name))
                            .filter(friend => 
                              collaboratorSearchQuery.trim() === '' || 
                              friend.name.toLowerCase().includes(collaboratorSearchQuery.toLowerCase())
                            )
                            .map(friend => (
                              <CollaboratorItem
                                key={friend.id}
                                id={friend.id}
                                name={friend.name}
                                email={friend.email}
                                avatar={friend.avatar}
                                onAction={() => handleAddCollaborator(friend.name)}
                                variant="add"
                              />
                          ))}
                          {friends.filter(f => !selectedTask.collaborators?.includes(f.name)).filter(f => collaboratorSearchQuery.trim() === '' || f.name.toLowerCase().includes(collaboratorSearchQuery.toLowerCase())).length === 0 && (
                            <p className="text-center py-4 text-[rgb(var(--color-text-muted))]">
                              {collaboratorSearchQuery.trim() ? 'Aucun contact trouvé' : 'Tous vos amis sont déjà collaborateurs'}
                            </p>
                          )}
                        </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-[rgb(var(--color-text-muted))]">
                    <Users size={48} className="mb-4 opacity-30" />
                    <p>Sélectionnez une tâche pour gérer ses collaborateurs</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CollaborativeTasks;
