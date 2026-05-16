import React from 'react';
import { Check, X, Share2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useTasks, useUpdateTask } from '@/modules/tasks';
import { useAuth } from '@/modules/auth/AuthContext';

const SharedTasksHistory: React.FC = () => {
  const { data: tasks = [] } = useTasks();
  const { user } = useAuth();
  const updateTaskMutation = useUpdateTask();

  // Tasks shared TO the current user = tasks with sharedBy set that don't belong to me
  const sharedTasks = tasks.filter(
    t => t.isCollaborative && t.sharedBy && t.sharedBy !== user?.name
  );

  const handleAccept = (taskId: string) => {
    updateTaskMutation.mutate(
      { id: taskId, updates: { sharedBy: undefined, isCollaborative: true } },
      { onSuccess: () => toast.success('Tâche acceptée — elle est maintenant dans votre liste') }
    );
  };

  const handleDecline = (taskId: string) => {
    updateTaskMutation.mutate(
      { id: taskId, updates: { sharedBy: undefined, isCollaborative: false, collaborators: [] } },
      { onSuccess: () => toast.info('Tâche refusée') }
    );
  };

  return (
    <div className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <Share2 size={16} className="text-blue-500" />
        </div>
        <div>
          <h3 className="text-base font-bold text-[rgb(var(--color-text-primary))]">
            Tâches partagées
          </h3>
          <p className="text-xs text-[rgb(var(--color-text-secondary))]">
            {sharedTasks.length > 0
              ? `${sharedTasks.length} tâche${sharedTasks.length > 1 ? 's' : ''} reçue${sharedTasks.length > 1 ? 's' : ''}`
              : 'Aucune tâche partagée'}
          </p>
        </div>
      </div>

      {sharedTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--color-hover))] flex items-center justify-center mb-3">
            <Share2 size={20} className="text-[rgb(var(--color-text-muted))]" />
          </div>
          <p className="text-sm font-medium text-[rgb(var(--color-text-secondary))]">
            Aucune tâche partagée
          </p>
          <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1">
            Vos collaborateurs peuvent partager des tâches ici
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sharedTasks.map(task => {
            const timeAgo = task.createdAt
              ? formatDistanceToNow(new Date(task.createdAt), { locale: fr, addSuffix: true })
              : '';
            return (
              <div
                key={task.id}
                className="p-4 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] transition-all"
              >
                <div className="mb-3">
                  <p className="text-sm font-bold text-[rgb(var(--color-text-primary))] leading-snug">
                    {task.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <p className="text-xs text-[rgb(var(--color-text-secondary))] flex items-center gap-1">
                      <Clock size={10} />
                      Partagée par <span className="font-semibold text-[rgb(var(--color-text-primary))]">&nbsp;{task.sharedBy}</span>
                    </p>
                    {timeAgo && (
                      <span className="text-xs text-[rgb(var(--color-text-muted))]">· {timeAgo}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[rgb(var(--color-accent)/0.1)] text-[rgb(var(--color-accent))]">
                      P{task.priority}
                    </span>
                    <span className="text-xs text-[rgb(var(--color-text-muted))]">
                      {task.estimatedTime} min
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(task.id)}
                    disabled={updateTaskMutation.isPending}
                    className="flex-1 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Check size={13} />
                    Accepter
                  </button>
                  <button
                    onClick={() => handleDecline(task.id)}
                    disabled={updateTaskMutation.isPending}
                    className="flex-1 h-8 rounded-xl border border-[rgb(var(--color-border))] hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 text-[rgb(var(--color-text-secondary))] hover:text-red-500 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <X size={13} />
                    Refuser
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SharedTasksHistory;
