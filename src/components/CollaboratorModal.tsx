import React, { useEffect, useMemo, useState } from 'react';
import { X, Users, UserPlus, Search } from 'lucide-react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import CollaboratorItem from './CollaboratorItem';
import { Button } from '@/components/ui/button';

import { useTasks, useUpdateTask } from '@/modules/tasks';
import { useFriends, useSendFriendRequest, useShareTask } from '@/modules/friends';
import { useBilling } from '@/modules/billing/billing.context';

type CollaboratorModalProps = {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CollaboratorModal: React.FC<CollaboratorModalProps> = ({ isOpen, onClose, taskId }) => {
  const dragControls = useDragControls();
  const { data: tasks = [] } = useTasks();
  const updateTaskMutation = useUpdateTask();

  const { data: friends = [] } = useFriends();
  const sendFriendRequestMutation = useSendFriendRequest();
  const shareTaskMutation = useShareTask();
  const { isPremium } = useBilling();

  const task = tasks.find((t) => t.id === taskId);

  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');

  const assignedCollaborators = task?.collaborators || [];

  // A friend's canonical "collaborator id" is their auth.users.id (userId),
  // required by Supabase RLS + shared_tasks FK. Falls back to friend.id in
  // demo mode where there's no auth.
  const collabIdOf = (f: { id: string; userId?: string }) => f.userId ?? f.id;

  const availableFriends = useMemo(
    () =>
      (friends || []).filter(
        (friend) => !assignedCollaborators.includes(collabIdOf(friend)) &&
          (search.trim() === '' ||
            friend.name.toLowerCase().includes(search.toLowerCase()) ||
            friend.email.toLowerCase().includes(search.toLowerCase()))
      ),
    [friends, assignedCollaborators, search]
  );

  // ESC to close + lock body scroll
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  if (!task) return null;

  const handleAdd = () => {
    if (!task) return;
    const value = input.trim().toLowerCase();
    if (!value) return;

    const friend = friends.find(f => f.email.toLowerCase() === value);

    if (friend) {
      // Store the friend's auth.uid (via userId) — required so RLS on
      // tasks.collaborators and the shared_tasks.friend_id FK accept it.
      // Falls back to friend.id in demo mode.
      const collabId = collabIdOf(friend);
      if (!assignedCollaborators.includes(collabId)) {
        updateTaskMutation.mutate({
          id: task.id,
          updates: {
            isCollaborative: true,
            collaborators: [...assignedCollaborators, collabId],
            collaboratorValidations: {
              ...task.collaboratorValidations,
              [collabId]: false
            }
          }
        });
        if (isPremium()) {
          shareTaskMutation.mutate({ taskId: task.id, friendId: collabId, friendEmail: friend.email, role: 'editor' });
        }
      }
    } else {
      // Non-friend invite: must be a valid email. Reject garbage input that
      // would otherwise pollute `pendingInvites` with non-resolvable values.
      if (!emailRegex.test(value)) {
        setInput('');
        return;
      }
      if (assignedCollaborators.includes(value)) {
        setInput('');
        return;
      }
      const pendingInvites = task.pendingInvites || [];
      if (!pendingInvites.includes(value)) {
        sendFriendRequestMutation.mutate({ email: value });
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

  const handleToggleFriend = (collabId: string) => {
    if (!task) return;
    // `collabId` = friend's auth.uid (or friend.id in demo).
    if (assignedCollaborators.includes(collabId)) {
      const newCollaborators = assignedCollaborators.filter((c) => c !== collabId);
      const newValidations = { ...task.collaboratorValidations };
      delete newValidations[collabId];
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
          collaborators: [...assignedCollaborators, collabId],
          collaboratorValidations: {
            ...task.collaboratorValidations,
            [collabId]: false
          }
        }
      });
      if (isPremium()) {
        shareTaskMutation.mutate({ taskId: task.id, friendId: collabId, role: 'editor' });
      }
    }
  };

  const handleRemove = (collaboratorId: string) => {
    if (!task) return;
    const newCollaborators = assignedCollaborators.filter((c) => c !== collaboratorId);
    const newValidations = { ...task.collaboratorValidations };
    delete newValidations[collaboratorId];
    const newPendingInvites = (task.pendingInvites || []).filter(e => e !== collaboratorId);

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
    const friend = friends?.find((f) => collabIdOf(f) === id || f.id === id || f.name === id);
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
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-md sm:p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="collab-modal-title"
        >
          <motion.div
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.5 }}
            onDragEnd={(_, info) => { if (info.offset.y > 100 || info.velocity.y > 600) onClose(); }}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 34, stiffness: 360, mass: 0.85 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-3xl sm:rounded-2xl rounded-t-[28px] shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:shadow-2xl flex flex-col max-h-[88vh] sm:max-h-[90vh] h-[88vh] sm:h-auto"
            style={{
              backgroundColor: 'rgb(var(--color-surface))',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            {/* Drag handle (mobile only) — déclenche le swipe-to-dismiss */}
            <div
              className="sm:hidden flex justify-center pt-4 pb-3 cursor-grab active:cursor-grabbing touch-none"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="w-9 h-[5px] rounded-full bg-slate-300/70 dark:bg-slate-500/60" />
            </div>

            {/* Header */}
            <div
              className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b shrink-0 sm:cursor-default cursor-grab active:cursor-grabbing touch-none sm:touch-auto"
              style={{ borderColor: 'rgb(var(--color-border))' }}
              onPointerDown={(e) => {
                if ((e.target as HTMLElement).closest('button,input,a,[contenteditable]')) return;
                dragControls.start(e);
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs uppercase tracking-wide font-semibold" style={{ color: 'rgb(var(--color-text-muted))' }}>
                  Collaborateurs
                </p>
                <h2 id="collab-modal-title" className="text-base sm:text-lg font-semibold truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  {task.name}
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Fermer"
                className="min-w-11 min-h-11 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
                style={{ color: 'rgb(var(--color-text-muted))' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* Content — scrollable */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-6 sm:space-y-8">
              {/* Assigned collaborators */}
              <section>
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                  <h3 className="text-sm font-semibold" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                    Collaborateurs assignés
                  </h3>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                    {assignedCollaborators.length}
                  </span>
                </div>
                {assignedCollaborators.length === 0 ? (
                  <div className="p-5 rounded-2xl border-2 border-dashed text-center transition-colors" style={{ borderColor: 'rgb(var(--color-border))' }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2" style={{ backgroundColor: 'rgb(var(--color-hover))' }}>
                      <Users className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>Aucun collaborateur pour l'instant.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
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
                <h3 className="text-sm font-semibold" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  Ajouter un collaborateur
                </h3>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <input
                      type="email"
                      inputMode="email"
                      autoCapitalize="off"
                      autoCorrect="off"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && input.trim()) handleAdd(); }}
                      placeholder="Email ou identifiant"
                      className="w-full px-4 py-3 pr-10 min-h-11 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                      style={{
                        backgroundColor: 'rgb(var(--color-surface))',
                        borderColor: 'rgb(var(--color-border))',
                        color: 'rgb(var(--color-text-primary))'
                      }}
                    />
                    {input && (
                      <button
                        onClick={() => setInput('')}
                        aria-label="Effacer l'entrée"
                        className="absolute inset-y-0 right-1 my-auto h-9 w-9 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <Button
                    variant="default"
                    onClick={handleAdd}
                    disabled={!input.trim() || (input.includes('@') && !emailRegex.test(input.trim()))}
                    className={`inline-flex items-center justify-center gap-2 min-h-11 ${input.trim() ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}`}
                  >
                    <UserPlus size={16} data-icon="inline-start" />
                    Ajouter
                  </Button>
                </div>
                {input && !emailRegex.test(input.trim()) && input.includes('@') && (
                  <p className="text-xs text-orange-500">Le format de l'adresse semble invalide.</p>
                )}
              </section>

              {/* Available friends */}
              <section className="space-y-3 sm:space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                  <h3 className="text-sm font-semibold" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                    Collaborateurs disponibles
                  </h3>
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Rechercher un contact"
                      className="w-full pl-9 pr-10 py-2.5 min-h-11 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      style={{
                        backgroundColor: 'rgb(var(--color-surface))',
                        borderColor: 'rgb(var(--color-border))',
                        color: 'rgb(var(--color-text-primary))'
                      }}
                    />
                    {search && (
                      <button
                        onClick={() => setSearch('')}
                        aria-label="Effacer la recherche"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {availableFriends.length === 0 ? (
                  <div className="p-6 rounded-2xl text-center transition-colors" style={{ backgroundColor: 'rgb(var(--color-hover))' }}>
                    <p className="text-sm" style={{ color: 'rgb(var(--color-text-muted))' }}>Aucun contact trouvé.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    {availableFriends.map((friend) => {
                      const collabId = collabIdOf(friend);
                      return (
                        <CollaboratorItem
                          key={friend.id}
                          id={collabId}
                          name={friend.name}
                          email={friend.email}
                          avatar={friend.avatar}
                          onAction={() => handleToggleFriend(collabId)}
                          variant="add"
                        />
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CollaboratorModal;
