// ═══════════════════════════════════════════════════════════════════
// PendingSharedTasks — bandeau « top priorité » affiché en haut de TaskTable.
// Liste les tâches collaboratives REÇUES en attente d'acceptation (fond orange)
// avec le partageur + les actions Accepter / Refuser. Logique d'acceptation
// identique à la boîte de réception (InboxMenu) : accepter persiste l'acception
// (la tâche reste dans la to-do, sort du bandeau) ; refuser retire la grant.
// ═══════════════════════════════════════════════════════════════════
import React, { useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTasks, type Task, taskKeys } from '@/modules/tasks';
import {
  useFriends,
  useRelatedTaskShares,
  useUnshareTask,
  useAcceptSharedTask,
} from '@/modules/friends';
import { useQueryClient } from '@tanstack/react-query';
import { useIsDemo } from '@/lib/app-mode.store';
import { useAuth } from '@/modules/auth/AuthContext';
import { getAcknowledgedShares, acknowledgeShare } from '@/lib/acknowledged-shares';

const PendingSharedTasks: React.FC = () => {
  const { user } = useAuth();
  const isDemo = useIsDemo();
  const queryClient = useQueryClient();
  const { data: tasks = [] } = useTasks();
  const { data: friends = [] } = useFriends();
  const { data: relatedShares = [] } = useRelatedTaskShares();
  const unshareTaskMutation = useUnshareTask();
  const acceptSharedTaskMutation = useAcceptSharedTask();
  const [ackVersion, setAckVersion] = useState(0);

  // Tâches reçues d'un ami et pas encore acceptées (même logique que la boîte
  // de réception). Démo : `sharedBy` + acquittement local ; prod : grant
  // shared_tasks reçue (friend_id = moi) avec accepted_at NULL.
  const pendingTasks = useMemo(() => {
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

  // Résout le partageur d'une tâche reçue (nom à afficher).
  const sharerName = (task: Task): string =>
    (task.userId ? friends.find((f) => f.userId === task.userId)?.name : undefined) ??
    task.sharedBy ??
    'un collaborateur';

  const handleAccept = (task: Task) => {
    if (isDemo) {
      acknowledgeShare(user?.id, task.id);
      setAckVersion((v) => v + 1);
      toast.success('Tâche acceptée');
    } else {
      acceptSharedTaskMutation.mutate(task.id, {
        onSuccess: () => toast.success('Tâche acceptée'),
      });
    }
  };

  const handleReject = (task: Task) => {
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
          toast.success('Tâche refusée');
        },
      }
    );
  };

  if (pendingTasks.length === 0) return null;

  return (
    <div className="mb-6 space-y-2">
      <p className="text-label sm:text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
        Tâches partagées en attente ({pendingTasks.length})
      </p>
      {pendingTasks.map((task) => (
        <div
          key={task.id}
          className="flex items-center gap-3 p-3 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20"
        >
          <div className="flex-1 min-w-0">
            <p className="text-body sm:text-sm font-bold truncate" style={{ color: 'rgb(var(--color-text-primary))' }} title={task.name}>
              {task.name}
            </p>
            <p className="text-caption sm:text-xs truncate text-amber-700 dark:text-amber-300">
              Partagé par {sharerName(task)}
            </p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleAccept(task)}
              disabled={acceptSharedTaskMutation.isPending}
              className="min-w-touch min-h-touch sm:w-9 sm:h-9 sm:min-w-0 sm:min-h-0 rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-50 text-white flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label={`Accepter la tâche partagée ${task.name}`}
            >
              <Check size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => handleReject(task)}
              disabled={unshareTaskMutation.isPending}
              className="min-w-touch min-h-touch sm:w-9 sm:h-9 sm:min-w-0 sm:min-h-0 rounded-lg border border-amber-300 dark:border-amber-700 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 text-slate-500 hover:text-red-500 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              aria-label={`Refuser la tâche partagée ${task.name}`}
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PendingSharedTasks;
