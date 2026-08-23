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
import { Inbox, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTasks, usePendingSharedTasks, type Task, taskKeys } from '@/modules/tasks';
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
  const { data: pendingShared = [] } = usePendingSharedTasks();
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
    // Prod : la RPC dediee (mig. 103). `useTasks()` ne contient PLUS les
    // partages non acceptes — les filtrer depuis cette liste ne renverrait
    // jamais rien. Le filtre `relatedShares` reste en garde-fou pour une
    // instance ou la migration n'est pas encore appliquee : la RPC et le
    // filtre disent alors la meme chose, et l'union ne double aucune ligne.
    const pendingIds = new Set(
      relatedShares.filter((s) => s.friendId === user?.id && !s.accepted).map((s) => s.taskId)
    );
    const byId = new Map<string, Task>();
    for (const t of pendingShared) if (!t.completed) byId.set(t.id, t);
    for (const t of tasks) if (pendingIds.has(t.id) && !t.completed) byId.set(t.id, t);
    return [...byId.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, pendingShared, relatedShares, isDemo, user?.name, user?.id, ackVersion]);

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
          className="w-80 max-w-[calc(100vw-16px)] bg-[rgb(var(--color-background))] rounded-xl shadow-md border border-[rgb(var(--color-border))] overflow-hidden"
          role="dialog"
          aria-label={t('inbox.label')}
        >
          {/* Sobre : pas d'icône dans l'en-tête (déjà sur le déclencheur, la
              répéter ici est décoratif), pas de badge coloré — le compte reste
              lisible en chiffre neutre. */}
          <div className="px-4 py-3 border-b border-[rgb(var(--color-border))] flex items-center justify-between">
            <span className="font-semibold text-label sm:text-sm text-[rgb(var(--color-text-primary))]">{t('inbox.label')}</span>
            {total > 0 && (
              <span className="text-caption sm:text-xs text-[rgb(var(--color-text-muted))] tabular-nums">{total}</span>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {total === 0 && (
              <div className="px-4 py-9 text-center">
                <p className="text-label sm:text-sm font-medium text-[rgb(var(--color-text-secondary))]">{t('inbox.allClear')}</p>
                <p className="text-caption sm:text-xs text-[rgb(var(--color-text-muted))] mt-0.5">
                  {t('inbox.allClearHint')}
                </p>
              </div>
            )}

            {pendingTasks.length > 0 && (
              <div>
                <p className="px-4 pt-3 pb-1 text-caption sm:text-xs font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wide">
                  {t('inbox.sharedTasks', { count: pendingTasks.length })}
                </p>
                <div className="divide-y divide-[rgb(var(--color-border))]">
                  {pendingTasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-label sm:text-sm font-medium text-[rgb(var(--color-text-primary))] truncate">
                          {task.name}
                        </p>
                        <p className="text-caption sm:text-xs truncate text-[rgb(var(--color-text-muted))]">
                          {sharerName(task)}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleAcceptTask(task)}
                          disabled={acceptSharedTaskMutation.isPending}
                          title={t('inbox.accept')}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
                          aria-label={t('inbox.acceptTask', { name: task.name })}
                        >
                          <Check size={15} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectTask(task)}
                          disabled={unshareTaskMutation.isPending}
                          title={t('inbox.refuse')}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
                          aria-label={t('inbox.refuseTask', { name: task.name })}
                        >
                          <X size={15} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {incomingLists.length > 0 && (
              <div>
                <p className="px-4 pt-3 pb-1 text-caption sm:text-xs font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wide">
                  {t('inbox.sharedLists', { count: incomingLists.length })}
                </p>
                <div className="divide-y divide-[rgb(var(--color-border))]">
                  {incomingLists.map((grant) => (
                    <div key={grant.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-label sm:text-sm font-medium text-[rgb(var(--color-text-primary))] truncate">
                          {grant.name}
                        </p>
                        <p className="text-caption sm:text-xs truncate text-[rgb(var(--color-text-muted))]">
                          {tp('inbox.sharedListBy', grant.tasks.length, { name: grant.sharedByName ?? t('inbox.anonymousSharer') })}
                        </p>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleAcceptList(grant)}
                          disabled={acceptSharedListMutation.isPending}
                          title={t('inbox.accept')}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
                          aria-label={t('inbox.acceptList', { name: grant.name })}
                        >
                          <Check size={15} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectList(grant)}
                          disabled={refuseSharedListMutation.isPending}
                          title={t('inbox.refuse')}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
                          aria-label={t('inbox.refuseList', { name: grant.name })}
                        >
                          <X size={15} aria-hidden="true" />
                        </button>
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
          {/* Ouvert, le fond du bouton est --color-accent-solid : quasi-blanc
              en thème Noir. Un `text-white` en dur y rendait l'icône invisible. */}
          <Inbox
            size={18}
            className={open ? 'text-[rgb(var(--color-accent-solid-foreground))]' : 'text-blue-600'}
            aria-hidden="true"
          />
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
