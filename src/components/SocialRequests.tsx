import React, { useState, useRef, useEffect } from 'react';
import { UserPlus, Check, X, User, Send } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  useFriendRequests,
  useAcceptFriendRequest,
  useRejectFriendRequest,
  useSendFriendRequest,
  type PendingFriendRequest,
} from '@/modules/friends';

const SocialRequests: React.FC = () => {
  const { data: requests = [] } = useFriendRequests();
  const acceptFriendMutation = useAcceptFriendRequest();
  const rejectFriendMutation = useRejectFriendRequest();
  const sendFriendMutation = useSendFriendRequest();

  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendEmail, setFriendEmail] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showAddFriend) inputRef.current?.focus();
  }, [showAddFriend]);

  const incomingRequests = requests.filter(
    (r: PendingFriendRequest) => r.status === 'pending' && r.senderEmail
  );

  // Les tâches partagées s'affichent désormais directement dans la liste du
  // destinataire (marquées « Reçu de … » via `sharedBy`, résolu côté
  // repository). Plus d'étape accepter/refuser ici — SocialRequests ne gère
  // que les demandes d'amis.
  const total = incomingRequests.length;

  const handleSendFriendRequest = () => {
    const email = friendEmail.trim();
    if (!email) return;
    sendFriendMutation.mutate({ email }, {
      onSuccess: () => {
        toast.success('Demande d\'ami envoyée');
        setFriendEmail('');
        setShowAddFriend(false);
      },
    });
  };

  const handleAcceptFriend = (id: string) => {
    acceptFriendMutation.mutate(id, {
      onSuccess: () => toast.success('Demande d\'ami acceptée'),
    });
  };

  const handleRejectFriend = (id: string) => {
    rejectFriendMutation.mutate(id, {
      onSuccess: () => toast.success('Demande refusée'),
    });
  };

  if (total === 0 && !showAddFriend) return null;

  return (
    <div className="card p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-[rgb(var(--color-text-primary))]">Demandes</h2>
          <p className="text-[rgb(var(--color-text-secondary))] text-sm">
            {total > 0
              ? `${total} demande${total > 1 ? 's' : ''} en attente`
              : 'Aucune demande en attente'}
          </p>
        </div>
        <button
          onClick={() => setShowAddFriend(v => !v)}
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm monochrome:bg-white monochrome:text-zinc-900 monochrome:hover:bg-zinc-200"
          title="Envoyer une demande d'ami"
        >
          <UserPlus size={17} />
        </button>
      </div>

      {/* Inline send friend request form */}
      {showAddFriend && (
        <div className="flex gap-2 mb-5">
          <input
            ref={inputRef}
            type="email"
            value={friendEmail}
            onChange={e => setFriendEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendFriendRequest()}
            placeholder="email@exemple.com"
            className="flex-1 h-9 px-3 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-secondary))] focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
          />
          <button
            onClick={handleSendFriendRequest}
            disabled={!friendEmail.trim() || sendFriendMutation.isPending}
            className="h-9 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Send size={13} />
            Envoyer
          </button>
        </div>
      )}

      <div className="space-y-6">
        {/* Demandes d'amis reçues */}
        {incomingRequests.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] uppercase tracking-wide flex items-center gap-1.5 mb-3">
              <UserPlus size={12} />
              Amis ({incomingRequests.length})
            </p>
            <div className="space-y-3">
              {incomingRequests.map((req: PendingFriendRequest) => {
                const displayName = req.senderEmail
                  ?.split('@')[0]
                  .split('.')
                  .map(s => s.charAt(0).toUpperCase() + s.slice(1))
                  .join(' ') ?? req.senderEmail;
                const timeAgo = req.sentAt
                  ? formatDistanceToNow(new Date(req.sentAt), { locale: fr, addSuffix: true })
                  : '';

                return (
                  <div
                    key={req.id}
                    className="p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition-all duration-300"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                        <User size={16} className="text-[rgb(var(--color-text-secondary))]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[rgb(var(--color-text-primary))] truncate">
                          {displayName}
                        </p>
                        <p className="text-xs text-[rgb(var(--color-text-secondary))] truncate">
                          {req.senderEmail} · {timeAgo}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleAcceptFriend(req.id)}
                          disabled={acceptFriendMutation.isPending}
                          className="w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white flex items-center justify-center transition-colors monochrome:bg-white monochrome:text-zinc-900"
                          title="Accepter"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => handleRejectFriend(req.id)}
                          disabled={rejectFriendMutation.isPending}
                          className="w-8 h-8 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 text-[rgb(var(--color-text-secondary))] hover:text-red-500 flex items-center justify-center transition-colors"
                          title="Refuser"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default SocialRequests;
