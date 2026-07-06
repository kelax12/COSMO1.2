// ═══════════════════════════════════════════════════════════════════
// ShareListSheet — bottom-sheet de partage d'une liste avec un ami.
// Construit un snapshot (nom + couleur + tâches de la liste) et crée une grant
// via useShareList. Le destinataire l'accepte/refuse depuis PendingSharedLists.
// ═══════════════════════════════════════════════════════════════════
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Share2, UserPlus } from 'lucide-react';
import type { TaskList } from '@/modules/lists';
import type { Task } from '@/modules/tasks';
import { useFriends, useShareList, type TaskSnapshot } from '@/modules/friends';
import { collabIdOf, filterFriendsForCollab } from './task-modal/collaborators';

interface ShareListSheetProps {
  /** Liste à partager (null = fermé). */
  list: TaskList | null;
  /** Toutes les tâches (filtrées par list.taskIds pour le snapshot). */
  tasks: Task[];
  onClose: () => void;
}

const ShareListSheet: React.FC<ShareListSheetProps> = ({ list, tasks, onClose }) => {
  const { data: friends = [] } = useFriends();
  const shareListMutation = useShareList();
  const [search, setSearch] = useState('');

  const isOpen = !!list;

  // Snapshot des tâches de la liste (figé au moment du partage).
  const snapshot: TaskSnapshot[] = useMemo(() => {
    if (!list) return [];
    const ids = new Set(list.taskIds);
    return tasks
      .filter((t) => ids.has(t.id))
      .map((t) => ({
        name: t.name,
        description: t.description,
        priority: t.priority,
        category: t.category,
        deadline: t.deadline,
        estimatedTime: t.estimatedTime,
        bookmarked: t.bookmarked,
        completed: t.completed,
        subtasks: t.subtasks,
        recurrence: t.recurrence,
      }));
  }, [list, tasks]);

  const selectableFriends = useMemo(
    () => filterFriendsForCollab(friends, [], search),
    [friends, search]
  );

  const handleShare = (friend: { id: string; userId?: string; email?: string }) => {
    if (!list) return;
    shareListMutation.mutate(
      {
        listId: list.id,
        name: list.name,
        color: list.color,
        tasks: snapshot,
        friendId: collabIdOf(friend),
        friendEmail: friend.email,
      },
      { onSuccess: onClose }
    );
  };

  const content = (
    <AnimatePresence>
      {list && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-[2px] sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
            transition={{ type: 'spring', damping: 32, stiffness: 340, mass: 0.65 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md flex flex-col overflow-hidden rounded-t-[20px] sm:rounded-[20px] border-t sm:border"
            style={{
              backgroundColor: 'rgb(var(--color-surface))',
              borderColor: 'rgb(var(--color-border))',
              paddingBottom: 'env(safe-area-inset-bottom)',
              maxHeight: '80vh',
            }}
            role="dialog"
            aria-label={`Partager la liste ${list.name}`}
          >
            {/* Drag handle (mobile) */}
            <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-9 h-[4px] rounded-full" style={{ backgroundColor: 'rgb(var(--color-border))' }} />
            </div>

            {/* Header teal — identité « listes partagées » */}
            <div className="flex items-center gap-3 px-5 py-4 shrink-0">
              <div className="min-w-0">
                <h2 className="text-base font-bold truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  Partager « {list.name} »
                </h2>
                <p className="text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
                  {snapshot.length} tâche{snapshot.length > 1 ? 's' : ''} · choisis un ami
                </p>
              </div>
            </div>

            <div className="h-px mx-5" style={{ backgroundColor: 'rgb(var(--color-border))' }} />

            {/* Recherche */}
            <div className="px-5 pt-3 pb-2 shrink-0">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un ami…"
                  className="w-full bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl pl-9 pr-4 py-2 text-sm text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus:border-teal-500 transition-all"
                />
              </div>
            </div>

            {/* Liste des amis */}
            <div className="px-3 pb-3 overflow-y-auto">
              {selectableFriends.length === 0 ? (
                <div className="px-2 py-8 text-center">
                  <UserPlus size={22} className="mx-auto mb-2 text-slate-400" aria-hidden="true" />
                  <p className="text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                    {friends.length === 0
                      ? 'Ajoute d’abord un ami pour partager une liste.'
                      : 'Aucun ami ne correspond à ta recherche.'}
                  </p>
                </div>
              ) : (
                selectableFriends.map((friend) => (
                  <button
                    key={friend.id}
                    type="button"
                    onClick={() => handleShare(friend)}
                    disabled={shareListMutation.isPending}
                    className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-[rgb(var(--color-hover))] disabled:opacity-50 transition-colors text-left"
                  >
                    <span className="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 bg-teal-100 dark:bg-teal-900/40">
                      {friend.avatar || '🙂'}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>
                        {friend.name}
                      </span>
                      {friend.email && (
                        <span className="block text-xs truncate" style={{ color: 'rgb(var(--color-text-muted))' }}>
                          {friend.email}
                        </span>
                      )}
                    </span>
                    <Share2 size={16} className="shrink-0 text-teal-500" aria-hidden="true" />
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!isOpen) return null;
  return createPortal(content, document.body);
};

export default ShareListSheet;
