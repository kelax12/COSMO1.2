import React from 'react';
import { UserPlus, Share2, Check, X, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import {
  useFriendRequests,
  useAcceptFriendRequest,
  useRejectFriendRequest,
  type PendingFriendRequest,
} from '@/modules/friends';
import { useTasks } from '@/modules/tasks';
import { useAuth } from '@/modules/auth/AuthContext';

const SocialRequests: React.FC = () => {
  const { data: requests = [] } = useFriendRequests();
  const { data: tasks = [] } = useTasks();
  const { user } = useAuth();
  const acceptMutation = useAcceptFriendRequest();
  const rejectMutation = useRejectFriendRequest();

  // Incoming requests only (senderEmail means someone else sent it to me)
  const incomingRequests = requests.filter(
    (r: PendingFriendRequest) => r.status === 'pending' && r.senderEmail
  );

  // Tasks assigned to me by someone else
  const assignedTasks = tasks.filter(
    t => t.isCollaborative && t.sharedBy && t.sharedBy !== user?.name
  );

  const total = incomingRequests.length + assignedTasks.length;

  if (total === 0) return null;

  const handleAccept = (id: string) => {
    acceptMutation.mutate(id, {
      onSuccess: () => toast.success('Demande d\'ami acceptée'),
    });
  };

  const handleReject = (id: string) => {
    rejectMutation.mutate(id, {
      onSuccess: () => toast.success('Demande refusée'),
    });
  };

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">Demandes</h2>
        <span className="ml-auto flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-blue-600 text-white text-xs font-bold monochrome:bg-white monochrome:text-zinc-900">
          {total}
        </span>
      </div>

      {/* Friend requests */}
      {incomingRequests.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] uppercase tracking-wide flex items-center gap-1.5 mb-2">
            <UserPlus size={12} />
            Amis ({incomingRequests.length})
          </p>
          <div className="space-y-2">
            {incomingRequests.map((req: PendingFriendRequest) => {
              const displayName = req.senderEmail
                ?.split('@')[0]
                .split('.')
                .map(s => s.charAt(0).toUpperCase() + s.slice(1))
                .join(' ') ?? req.senderEmail;

              return (
                <div
                  key={req.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))]"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 monochrome:bg-zinc-700 flex items-center justify-center text-sm shrink-0 select-none">
                    👤
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))] truncate">
                      {displayName}
                    </p>
                    <p className="text-xs text-[rgb(var(--color-text-secondary))] truncate">
                      {req.senderEmail}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => handleAccept(req.id)}
                      disabled={acceptMutation.isPending}
                      className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white flex items-center justify-center transition-colors monochrome:bg-white monochrome:text-zinc-900 monochrome:hover:bg-zinc-200"
                      title="Accepter"
                    >
                      <Check size={13} />
                    </button>
                    <button
                      onClick={() => handleReject(req.id)}
                      disabled={rejectMutation.isPending}
                      className="w-7 h-7 rounded-lg border border-[rgb(var(--color-border))] hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 text-[rgb(var(--color-text-secondary))] hover:text-red-500 flex items-center justify-center transition-colors"
                      title="Refuser"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Assigned tasks */}
      {assignedTasks.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] uppercase tracking-wide flex items-center gap-1.5 mb-2">
            <Share2 size={12} />
            Tâches assignées ({assignedTasks.length})
          </p>
          <div className="space-y-2">
            {assignedTasks.map(task => (
              <div
                key={task.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))]"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))] truncate">
                    {task.name}
                  </p>
                  <p className="text-xs text-[rgb(var(--color-text-secondary))] truncate">
                    Par {task.sharedBy}
                  </p>
                </div>
                <ChevronRight size={15} className="text-[rgb(var(--color-text-secondary))] shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SocialRequests;
