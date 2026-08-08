// ═══════════════════════════════════════════════════════════════════
// TasksInboxMenu — bouton boîte de réception pour la page Tâches.
// Regroupe les tâches partagées + listes partagées en attente dans un
// popover, sur le même modèle que InboxMenu (Dashboard). Un seul composant,
// deux rendus de déclencheur : `variant="mobile"` (icône seule, TouchTarget,
// dans MobileHeader) et `variant="desktop"` (pastille avec libellé, à côté
// du bouton Calendrier) — la logique de données et le popover sont
// partagés, seul le bouton qui l'ouvre change.
// ═══════════════════════════════════════════════════════════════════
import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Inbox, Check, X, Bell, ListChecks } from 'lucide-react';
import { toast } from 'sonner';
import { useTasks, type Task, taskKeys } from '@/modules/tasks';
import {
  useFriends,
  useRelatedTaskShares,
  useUnshareTask,
  useAcceptSharedTask,
  useIncomingSharedLists,
  useAcceptSharedList,
  useRefuseSharedList,
  type SharedListGrant,
} from '@/modules/friends';
import { useQueryClient } from '@tanstack/react-query';
import { useIsDemo } from '@/lib/app-mode.store';
import { useAuth } from '@/modules/auth/AuthContext';
import { getAcknowledgedShares, acknowledgeShare } from '@/lib/acknowledged-shares';
import TouchTarget from '@/components/mobile/TouchTarget';
import { useT } from '@/i18n/useT';

interface TasksInboxMenuProps {
  variant?: 'mobile' | 'desktop';
}

const TasksInboxMenu: React.FC<TasksInboxMenuProps> = ({ variant = 'mobile' }) => {
  const { t, tp } = useT('tasks');
  const { user } = useAuth();
  const isDemo = useIsDemo();
  const queryClient = useQueryClient();
  const { data: tasks = [] } = useTasks();
  const { data: friends = [] } = useFriends();
  const { data: relatedShares = [] } = useRelatedTaskShares();
  const unshareTaskMutation = useUnshareTask();
  const acceptSharedTaskMutation = useAcceptSharedTask();
  const { data: incomingLists = [] } = useIncomingSharedLists();
  const acceptSharedListMutation = useAcceptSharedList();
  const refuseSharedListMutation = useRefuseSharedList();
  const [ackVersion, setAckVersion] = useState(0);

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);

  // Même logique que PendingSharedTasks : tâches reçues non acceptées.
  const pendingTasks = React.useMemo(() => {
    if (isDemo) {
      const ack = getAcknowledgedShares(user?.id);
      return tasks.filter(
        (t) => !!t.sharedBy && t.sharedBy !== user?.name && !t.completed && !ack.has(t.id)
      );
    }
    const pendingReceived = new Set(
      relatedShares.filter((s) => s.friendId === user?.id && !s.accepted).map((s) => s.taskId)
    );
    return tasks.filter((t) => pendingReceived.has(t.id) && !t.completed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, relatedShares, isDemo, user?.name, user?.id, ackVersion]);

  const sharerName = (task: Task): string =>
    (task.userId ? friends.find((f) => f.userId === task.userId)?.name : undefined) ??
    task.sharedBy ??
    'un collaborateur';

  const total = pendingTasks.length + incomingLists.length;

  const handleAcceptTask = (task: Task) => {
    if (isDemo) {
      acknowledgeShare(user?.id, task.id);
      setAckVersion((v) => v + 1);
      toast.success(t('toast.accepted'));
    } else {
      acceptSharedTaskMutation.mutate(task.id, {
        onSuccess: () => toast.success(t('toast.accepted')),
      });
    }
  };

  const handleRejectTask = (task: Task) => {
    if (!user?.id) return;
    if (isDemo) {
      acknowledgeShare(user.id, task.id);
      setAckVersion((v) => v + 1);
    }
    unshareTaskMutation.mutate(
      { taskId: task.id, friendId: user.id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
          toast.success(t('toast.refused'));
        },
      }
    );
  };

  const handleAcceptList = (grant: SharedListGrant) => acceptSharedListMutation.mutate(grant);
  const handleRejectList = (grant: SharedListGrant) =>
    refuseSharedListMutation.mutate(grant.id, { onSuccess: () => toast.success(t('toast.listRefused')) });

  // Mesure la position viewport du trigger → popover en position:fixed.
  useLayoutEffect(() => {
    if (!open) { setPopoverPos(null); return; }
    const measure = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPopoverPos({ top: r.bottom + 8, left: Math.max(8, r.right - 320) });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !popoverRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const popoverContent = (
    <AnimatePresence>
      {open && popoverPos && (
        <motion.div
          ref={popoverRef}
          initial={{ opacity: 0, scale: 0.95, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -8 }}
          transition={{ duration: 0.12 }}
          style={{ position: 'fixed', top: popoverPos.top, left: popoverPos.left, zIndex: 9999 }}
          className="w-80 max-w-[calc(100vw-16px)] bg-[rgb(var(--color-background))] rounded-2xl shadow-md border border-[rgb(var(--color-border))] overflow-hidden"
          role="dialog"
          aria-label={t('inbox.label')}
        >
          <div className="px-4 py-3 border-b border-[rgb(var(--color-border))] flex items-center gap-2">
            <Inbox size={16} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span className="font-bold text-label sm:text-sm text-[rgb(var(--color-text-primary))]">{t('inbox.label')}</span>
            {total > 0 && (
              <span className="ml-auto text-caption font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                {total} en attente
              </span>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {total === 0 && (
              <div className="px-4 py-8 text-center">
                <div className="w-11 h-11 rounded-full bg-[rgb(var(--color-hover))] flex items-center justify-center mx-auto mb-2.5">
                  <Bell size={18} className="text-slate-400" aria-hidden="true" />
                </div>
                <p className="text-label sm:text-sm font-semibold text-slate-700 dark:text-slate-200">{t('inbox.allClear')}</p>
                <p className="text-caption sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t('inbox.allClearHint')}
                </p>
              </div>
            )}

            {pendingTasks.length > 0 && (
              <div className="px-3 pt-3 pb-1">
                <p className="px-1 text-caption sm:text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-2">
                  {t('inbox.sharedTasks', { count: pendingTasks.length })}
                </p>
                <div className="space-y-2">
                  {pendingTasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-3 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-label sm:text-sm font-bold text-[rgb(var(--color-text-primary))] truncate">
                            {task.name}
                          </p>
                          <p className="text-caption sm:text-xs truncate text-amber-700 dark:text-amber-300">
                            {t('inbox.sharedBy', { name: sharerName(task) })}
                          </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleAcceptTask(task)}
                            disabled={acceptSharedTaskMutation.isPending}
                            className="w-11 h-11 rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-50 text-[rgb(var(--color-accent-solid-foreground))] flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                            aria-label={t('inbox.acceptTask', { name: task.name })}
                          >
                            <Check size={15} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectTask(task)}
                            disabled={unshareTaskMutation.isPending}
                            className="w-11 h-11 rounded-lg border border-amber-300 dark:border-amber-700 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 text-slate-500 hover:text-red-500 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                            aria-label={t('inbox.refuseTask', { name: task.name })}
                          >
                            <X size={15} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {incomingLists.length > 0 && (
              <div className="px-3 pt-3 pb-3">
                <p className="px-1 text-caption sm:text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wide mb-2">
                  {t('inbox.sharedLists', { count: incomingLists.length })}
                </p>
                <div className="space-y-2">
                  {incomingLists.map((grant) => (
                    <div
                      key={grant.id}
                      className="p-3 rounded-xl border border-teal-300 dark:border-teal-700/60 bg-teal-50 dark:bg-teal-900/20"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center shrink-0">
                          <ListChecks size={15} className="text-teal-600 dark:text-teal-300" aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-label sm:text-sm font-bold text-[rgb(var(--color-text-primary))] truncate">
                            {grant.name}
                          </p>
                          <p className="text-caption sm:text-xs truncate text-teal-700 dark:text-teal-300">
                            {tp('inbox.sharedListBy', grant.tasks.length, { name: grant.sharedByName ?? t('inbox.anonymousSharer') })}
                          </p>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleAcceptList(grant)}
                            disabled={acceptSharedListMutation.isPending}
                            className="w-11 h-11 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                            aria-label={t('inbox.acceptList', { name: grant.name })}
                          >
                            <Check size={15} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectList(grant)}
                            disabled={refuseSharedListMutation.isPending}
                            className="w-11 h-11 rounded-lg border border-teal-300 dark:border-teal-700 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 text-slate-500 hover:text-red-500 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                            aria-label={t('inbox.refuseList', { name: grant.name })}
                          >
                            <X size={15} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const ariaLabel = total > 0 ? t('inbox.withCount', { count: total }) : t('inbox.label');

  // Le badge est identique dans les deux variantes : seul le bouton qui le
  // porte change de forme.
  const badge = total > 0 && (
    <span
      // Taille via `text-caption` (11px), le plancher de l'échelle mobile —
      // pas une valeur arbitraire plus petite. Un badge de notification est
      // précisément ce qu'on ne doit pas rendre illisible pour gagner un
      // pixel (cf. design-system.guard.test.ts).
      className="absolute top-1.5 right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-red-600 text-white text-caption font-bold flex items-center justify-center shadow-sm ring-2 ring-[rgb(var(--color-background))]"
      aria-hidden="true"
    >
      {total > 9 ? '9+' : total}
    </span>
  );

  return (
    <>
      {variant === 'desktop' ? (
        // Même gabarit que le bouton Calendrier voisin (TasksHeader) : pastille
        // bordée, icône + libellé masqué sous `sm`, hauteur 44px identique.
        <motion.button
          ref={triggerRef}
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setOpen((v) => !v)}
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          data-tutorial-id="tasks-inbox-toggle"
          className={`relative flex items-center justify-center gap-2 rounded-lg min-w-11 min-h-11 px-3 sm:px-4 py-2 transition-all shadow-sm border font-medium text-sm ${
            open
              ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] border-[rgb(var(--color-accent-solid))] shadow-md'
              : 'bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-secondary))] border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-hover))] hover:border-[rgb(var(--color-border-strong))]'
          }`}
        >
          <Inbox size={18} className={open ? 'text-white' : 'text-blue-600'} aria-hidden="true" />
          <span className="hidden sm:inline">{t('inbox.label')}</span>
          {badge}
        </motion.button>
      ) : (
        <TouchTarget
          ref={triggerRef}
          onClick={() => setOpen((v) => !v)}
          className="relative"
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          data-tutorial-id="tasks-inbox-toggle"
        >
          <Inbox size={20} aria-hidden="true" />
          {badge}
        </TouchTarget>
      )}
      {typeof document !== 'undefined' && createPortal(popoverContent, document.body)}
    </>
  );
};

export default TasksInboxMenu;
