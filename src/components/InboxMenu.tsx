import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Inbox, UserPlus, Check, X, Send, Settings, Trash2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { getDateLocale } from '@/i18n/format';
import {
  useFriendRequests,
  useAcceptFriendRequest,
  useRejectFriendRequest,
  useSendFriendRequest,
  type PendingFriendRequest,
} from '@/modules/friends';
import { useTasks, usePendingSharedTasks, type Task, taskKeys } from '@/modules/tasks';
import {
  useFriends,
  useUnshareTask,
  useAcceptSharedTask,
  useRelatedTaskShares,
  useRemoveFriend,
  useIncomingSharedLists,
  useAcceptSharedList,
  useRefuseSharedList,
  type SharedListGrant,
} from '@/modules/friends';
import {
  useActiveOrganization,
  useOrgJoinRequests,
  useRespondJoinRequest,
  useMyOrgInvitations,
  useRespondOrgInvitation,
} from '@/modules/organizations';
import { useQueryClient } from '@tanstack/react-query';
import { useIsDemo } from '@/lib/app-mode.store';
import { useAuth } from '@/modules/auth/AuthContext';
import { getAcknowledgedShares, acknowledgeShare } from '@/lib/acknowledged-shares';
import RemoveFriendConfirm from './RemoveFriendConfirm';
import { useT } from '@/i18n/useT';

/**
 * Boîte de réception unifiée du Dashboard. Remplace l'ancien panneau
 * `SocialRequests` affiché dans le corps de la page : un bouton carré (icône
 * Inbox) en haut de page ouvre une bulle (popover en portal) regroupant :
 *   1. Les demandes d'amis en attente (accepter / refuser)
 *   2. Les tâches partagées à accepter (accepter / refuser)
 *
 * Une pastille de notification affiche le total d'éléments en attente
 * (demandes d'amis + tâches à accepter).
 *
 * Le partage de tâches est gratuit (canal d'acquisition) : accepter une tâche
 * partagée n'est plus gated par le Premium.
 */
const InboxMenu: React.FC = () => {
  const { t, tp } = useT('common');
  const { t: tTasks } = useT('tasks');
  const { t: tOrg } = useT('org');
  const { user } = useAuth();

  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  const { data: requests = [] } = useFriendRequests();
  const { data: tasks = [] } = useTasks();
  const { data: pendingShared = [] } = usePendingSharedTasks();
  const { data: friends = [] } = useFriends();
  const { data: relatedShares = [] } = useRelatedTaskShares();
  const acceptFriendMutation = useAcceptFriendRequest();
  const rejectFriendMutation = useRejectFriendRequest();
  const sendFriendMutation = useSendFriendRequest();
  const unshareTaskMutation = useUnshareTask();
  const acceptSharedTaskMutation = useAcceptSharedTask();
  const removeFriendMutation = useRemoveFriend();
  const { data: incomingLists = [] } = useIncomingSharedLists();
  const acceptSharedListMutation = useAcceptSharedList();
  const refuseSharedListMutation = useRefuseSharedList();

  // Mode entreprise : demandes d'adhésion à valider (admins uniquement,
  // sur l'organisation ACTIVE — multi-org v2).
  const { activeOrg: myOrg } = useActiveOrganization();
  const isOrgAdmin = myOrg?.myRole === 'admin';
  const { data: joinRequests = [] } = useOrgJoinRequests(isOrgAdmin ? myOrg?.id : undefined);
  const respondJoinRequestMutation = useRespondJoinRequest();

  // Invitations NOMINATIVES recues d'un ami (mig. 105). A ne pas confondre
  // avec `joinRequests` juste au-dessus, qui va dans l'autre sens : la que
  // des inconnus demandent a entrer et qu'un admin tranche. Ici c'est MOI
  // qu'on invite, et c'est moi qui reponds.
  const { data: orgInvitations = [] } = useMyOrgInvitations();
  const respondOrgInvitationMutation = useRespondOrgInvitation();

  // Acquittements locaux des tâches partagées en mode démo (cf.
  // lib/acknowledged-shares). En Supabase, l'état d'acceptation est porté par
  // shared_tasks.accepted_at. `ackVersion` force un recalcul après accept/reject.
  const [ackVersion, setAckVersion] = useState(0);

  const [open, setOpen] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showManageFriends, setShowManageFriends] = useState(false);
  const [friendToRemove, setFriendToRemove] = useState<{ id: string; name: string } | null>(null);
  const [friendEmail, setFriendEmail] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; right: number } | null>(null);

  const incomingRequests = useMemo(() => {
    // Dédoublonnage par expéditeur : friend_requests peut contenir plusieurs
    // lignes pending pour le même couple (sender, receiver) après des
    // double-clics / retries. On ne montre qu'une demande par expéditeur.
    const seen = new Set<string>();
    return requests.filter((r: PendingFriendRequest) => {
      if (r.status !== 'pending' || !r.senderEmail) return false;
      const key = (r.senderId || r.senderEmail).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [requests]);

  // Tâches reçues d'un ami et pas encore acquittées : `sharedBy` renseigné et
  // différent de l'utilisateur courant. (En mode démo `sharedBy` est stocké ;
  // en Supabase il est dérivé de la propriété de la tâche → on persiste
  // l'acquittement localement pour les sortir de la boîte de réception.)
  const tasksToAccept = useMemo(() => {
    if (isDemo) {
      // Démo : `sharedBy` est un vrai champ + acquittement local.
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
    // ackVersion en dep : recalcul apres accept/reject (demo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, pendingShared, relatedShares, isDemo, user?.name, user?.id, ackVersion]);

  const pendingJoinRequests = isOrgAdmin ? joinRequests : [];
  const total =
    incomingRequests.length +
    tasksToAccept.length +
    incomingLists.length +
    pendingJoinRequests.length +
    orgInvitations.length;

  // Aperçu de l'impact d'une suppression d'ami : tâches dont je suis
  // propriétaire et que j'ai partagées avec lui (il perdra l'accès) + tâches
  // qu'il m'a partagées (je perdrai l'accès). Alimente le dialog de confirmation.
  const removalPreview = useMemo(() => {
    if (!friendToRemove) return { ownedShared: [] as string[], received: [] as string[] };
    const friend = friends.find((f) => f.id === friendToRemove.id);
    const friendIds = new Set<string>([friendToRemove.id]);
    if (friend?.userId) friendIds.add(friend.userId);
    if (friend?.id) friendIds.add(friend.id);
    const me = user?.id;
    const nameOf = (taskId: string) => tasks.find((t) => t.id === taskId)?.name;

    const ownedIds = new Set<string>();
    const receivedIds = new Set<string>();
    relatedShares.forEach((s) => {
      if (s.sharedBy === me && friendIds.has(s.friendId)) ownedIds.add(s.taskId);
      if (friendIds.has(s.sharedBy) && s.friendId === me) receivedIds.add(s.taskId);
    });
    // Démo : la tâche reçue porte le nom du partageur dans `sharedBy`.
    tasks.forEach((t) => {
      if (t.sharedBy && friend && t.sharedBy === friend.name) receivedIds.add(t.id);
    });

    const ownedShared = [...ownedIds].map(nameOf).filter((n): n is string => !!n);
    const received = [...receivedIds].map(nameOf).filter((n): n is string => !!n);
    return { ownedShared, received };
  }, [friendToRemove, friends, relatedShares, tasks, user?.id]);

  // Résout l'ami partageur d'une tâche reçue (pour son avatar/nom).
  // Prod : la tâche appartient au partageur → `task.userId` = son auth.uid.
  // Démo : on retombe sur le nom stocké (`task.sharedBy`).
  const sharerOf = (task: Task): { name: string; avatar?: string } | undefined =>
    (task.userId ? friends.find((f) => f.userId === task.userId) : undefined) ??
    (task.sharedBy ? friends.find((f) => f.name === task.sharedBy) : undefined);

  // Résout l'ami partageur d'une LISTE reçue. Prod : grant.sharedBy = auth.uid
  // du partageur (match friend.userId) ; démo : id de ligne friends.
  const listSharerOf = (grant: SharedListGrant): { name: string; avatar?: string } | undefined =>
    friends.find((f) => f.userId === grant.sharedBy || f.id === grant.sharedBy);

  // Mesure la position viewport du trigger → popover en position:fixed.
  useLayoutEffect(() => {
    if (!open) { setPopoverPos(null); return; }
    const measure = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPopoverPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open]);

  // Ferme au clic en dehors + ESC.
  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      // Le dialog de confirmation (portal séparé) gère ses propres clics : ne pas
      // fermer la boîte de réception tant qu'il est ouvert.
      if (friendToRemove) return;
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !popoverRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // ESC ferme d'abord le dialog de confirmation, sinon la boîte de réception.
      if (friendToRemove) setFriendToRemove(null);
      else setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, friendToRemove]);

  useEffect(() => {
    if (showAddFriend) addInputRef.current?.focus();
  }, [showAddFriend]);

  // Réinitialise les sous-vues à la fermeture du popover.
  useEffect(() => {
    if (!open) {
      setShowAddFriend(false);
      setShowManageFriends(false);
      setFriendToRemove(null);
    }
  }, [open]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleAcceptFriend = (id: string) => {
    acceptFriendMutation.mutate(id, { onSuccess: () => toast.success(t('inbox.friendAccepted')) });
  };
  const handleRejectFriend = (id: string) => {
    rejectFriendMutation.mutate(id, { onSuccess: () => toast.success(t('inbox.requestRefused')) });
  };

  const handleAcceptTask = (task: Task) => {
    // Accepter : l'accès est déjà accordé via shared_tasks ; on persiste
    // l'acceptation (accepted_at) pour que le PROPRIÉTAIRE voie « accepté » au
    // lieu de « Envoyé ». La tâche reste dans la to-do, sort de la boîte.
    if (isDemo) {
      acknowledgeShare(user?.id, task.id);
      setAckVersion((v) => v + 1);
      toast.success(tTasks('toast.accepted'));
    } else {
      acceptSharedTaskMutation.mutate(task.id, {
        onSuccess: () => toast.success(tTasks('toast.accepted')),
      });
    }
  };
  const handleRejectTask = (task: Task) => {
    if (!user?.id) return;
    // Refuser = supprimer la grant shared_tasks (l'utilisateur perd l'accès →
    // la tâche disparaît de sa to-do).
    if (isDemo) {
      acknowledgeShare(user.id, task.id);
      setAckVersion((v) => v + 1);
    }
    unshareTaskMutation.mutate(
      { taskId: task.id, friendId: user.id },
      {
        onSuccess: () => {
          // Invalide la liste de tâches : sans la grant, la RLS ne renvoie plus
          // cette tâche au destinataire.
          queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
          toast.success(tTasks('toast.refused'));
        },
      }
    );
  };

  // Accepter une liste : la mutation matérialise la liste + ses tâches chez le
  // destinataire (copy-on-accept) puis marque la grant acceptée. Refuser :
  // supprime la grant.
  const handleAcceptList = (grant: SharedListGrant) => {
    acceptSharedListMutation.mutate(grant);
  };
  const handleRejectList = (grant: SharedListGrant) => {
    refuseSharedListMutation.mutate(grant.id, {
      onSuccess: () => toast.success(tTasks('toast.listRefused')),
    });
  };

  const handleRespondJoin = (requestId: string, accept: boolean) => {
    respondJoinRequestMutation.mutate({ requestId, accept });
  };

  const confirmRemoveFriend = () => {
    if (!friendToRemove) return;
    const { id, name } = friendToRemove;
    removeFriendMutation.mutate(id, {
      onSuccess: () => toast.success(t('inbox.removedFriend', { name })),
    });
    setFriendToRemove(null);
  };

  const handleSendFriendRequest = () => {
    const email = friendEmail.trim();
    if (!email) return;
    sendFriendMutation.mutate({ email }, {
      onSuccess: () => {
        toast.success(t('inbox.friendRequestSent'));
        setFriendEmail('');
        setShowAddFriend(false);
      },
    });
  };

  const prettyName = (email?: string) =>
    email
      ?.split('@')[0]
      .split('.')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ') ?? email;

  // ── Popover ────────────────────────────────────────────────────────────
  const popoverInner = (
    <>
      {/* Sobre : pas d'icône décorative dans l'en-tête (Inbox/Users) — la
          navigation (retour, réglages) reste, elle est fonctionnelle. Le
          compte est un chiffre neutre, pas une pastille colorée. */}
      <div className="px-4 py-3 border-b border-[rgb(var(--color-border))] flex items-center gap-2">
        {showManageFriends ? (
          <>
            <button
              onClick={() => setShowManageFriends(false)}
              className="-ml-1 w-7 h-7 rounded-md flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
              aria-label={t('inbox.backToInbox')}
            >
              <ArrowLeft size={16} aria-hidden="true" />
            </button>
            <span className="font-semibold text-label sm:text-sm text-[rgb(var(--color-text-primary))]">{t('inbox.myFriends')}</span>
            {friends.length > 0 && (
              <span className="ml-auto text-caption sm:text-xs text-[rgb(var(--color-text-muted))] tabular-nums">
                {friends.length}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="font-semibold text-label sm:text-sm text-[rgb(var(--color-text-primary))]">{tTasks('inbox.label')}</span>
            <div className="ml-auto flex items-center gap-2">
              {total > 0 && (
                <span className="text-caption sm:text-xs text-[rgb(var(--color-text-muted))] tabular-nums">{total}</span>
              )}
              <button
                onClick={() => setShowManageFriends(true)}
                className="w-7 h-7 rounded-md flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
                aria-label={t('inbox.manageFriends')}
                title={t('inbox.manageFriends')}
              >
                <Settings size={15} aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </div>

      <div className="max-h-[60vh] overflow-y-auto">
        {/* ── Gérer mes amis ── */}
        {showManageFriends && (
          friends.length === 0 ? (
            <div className="px-4 py-9 text-center">
              <p className="text-label sm:text-sm font-medium text-[rgb(var(--color-text-secondary))]">{t('inbox.noFriend')}</p>
              <p className="text-caption sm:text-xs text-[rgb(var(--color-text-muted))] mt-0.5">
                {t('inbox.noFriendHint')}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[rgb(var(--color-border))]">
              {friends.map((friend) => (
                <div key={friend.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-label sm:text-sm font-medium text-[rgb(var(--color-text-primary))] truncate">{friend.name}</p>
                    <p className="text-caption sm:text-xs text-[rgb(var(--color-text-muted))] truncate">{friend.email}</p>
                  </div>
                  <button
                    onClick={() => setFriendToRemove({ id: friend.id, name: friend.name })}
                    disabled={removeFriendMutation.isPending}
                    title={t('inbox.removeFriendShort')}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] hover:text-red-500 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 shrink-0"
                    aria-label={`Retirer ${friend.name} de vos amis`}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {!showManageFriends && total === 0 && (
          <div className="px-4 py-9 text-center">
            <p className="text-label sm:text-sm font-medium text-[rgb(var(--color-text-secondary))]">{tTasks('inbox.allClear')}</p>
            <p className="text-caption sm:text-xs text-[rgb(var(--color-text-muted))] mt-0.5">
              {t('inbox.allClearHint')}
            </p>
          </div>
        )}

        {/* ── Demandes d'amis ── */}
        {!showManageFriends && incomingRequests.length > 0 && (
          <div>
            <p className="px-4 pt-3 pb-1 text-caption sm:text-xs font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wide">
              {t('inbox.friendRequests', { count: incomingRequests.length })}
            </p>
            <div className="divide-y divide-[rgb(var(--color-border))]">
              {incomingRequests.map((req: PendingFriendRequest) => {
                const timeAgo = req.sentAt
                  ? formatDistanceToNow(new Date(req.sentAt), { locale: getDateLocale(), addSuffix: true })
                  : '';
                return (
                  <div key={req.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-label sm:text-sm font-medium text-[rgb(var(--color-text-primary))] truncate">
                        {req.senderName || prettyName(req.senderEmail)}
                      </p>
                      <p className="text-caption sm:text-xs text-[rgb(var(--color-text-muted))] truncate">
                        {req.senderEmail}{timeAgo ? ` · ${timeAgo}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => handleAcceptFriend(req.id)}
                        disabled={acceptFriendMutation.isPending}
                        title={tTasks('inbox.accept')}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
                        aria-label={`Accepter la demande d'ami de ${prettyName(req.senderEmail)}`}
                      >
                        <Check size={15} aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => handleRejectFriend(req.id)}
                        disabled={rejectFriendMutation.isPending}
                        title={tTasks('inbox.refuse')}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
                        aria-label={`Refuser la demande d'ami de ${prettyName(req.senderEmail)}`}
                      >
                        <X size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Tâches à accepter ── */}
        {!showManageFriends && tasksToAccept.length > 0 && (
          <div className="px-3 pt-3 pb-1">
            <p className="px-4 pt-3 pb-1 text-caption sm:text-xs font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wide">
              {tTasks('inbox.sharedTasks', { count: tasksToAccept.length })}
            </p>
            <div className="divide-y divide-[rgb(var(--color-border))]">
              {tasksToAccept.map((task) => {
                const sharer = sharerOf(task);
                const sharerName = sharer?.name ?? task.sharedBy;
                return (
                <div key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-label sm:text-sm font-medium text-[rgb(var(--color-text-primary))] truncate">
                      {task.name}
                    </p>
                    <p className="text-caption sm:text-xs text-[rgb(var(--color-text-muted))] truncate">
                      {sharerName}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => handleAcceptTask(task)}
                      title={tTasks('inbox.accept')}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
                      aria-label={tTasks('inbox.acceptTask', { name: task.name })}
                    >
                      <Check size={15} aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => handleRejectTask(task)}
                      disabled={unshareTaskMutation.isPending}
                      title={tTasks('inbox.refuse')}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
                      aria-label={tTasks('inbox.refuseTask', { name: task.name })}
                    >
                      <X size={15} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Listes partagées à accepter ── */}
        {!showManageFriends && incomingLists.length > 0 && (
          <div>
            <p className="px-4 pt-3 pb-1 text-caption sm:text-xs font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wide">
              {tTasks('inbox.sharedLists', { count: incomingLists.length })}
            </p>
            <div className="divide-y divide-[rgb(var(--color-border))]">
              {incomingLists.map((grant) => {
                const sharer = listSharerOf(grant);
                const sharerName = sharer?.name ?? grant.sharedByName ?? tTasks('inbox.anonymousSharer');
                return (
                <div key={grant.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-label sm:text-sm font-medium text-[rgb(var(--color-text-primary))] truncate">
                      {grant.name}
                    </p>
                    <p className="text-caption sm:text-xs truncate text-[rgb(var(--color-text-muted))]">
                      {tp('inbox.receivedFromWithCount', grant.tasks.length, { name: sharerName })}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => handleAcceptList(grant)}
                      disabled={acceptSharedListMutation.isPending}
                      title={tTasks('inbox.accept')}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
                      aria-label={tTasks('inbox.acceptList', { name: grant.name })}
                    >
                      <Check size={15} aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => handleRejectList(grant)}
                      disabled={refuseSharedListMutation.isPending}
                      title={tTasks('inbox.refuse')}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
                      aria-label={tTasks('inbox.refuseList', { name: grant.name })}
                    >
                      <X size={15} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Invitations d'entreprise reçues (mig. 105) ── */}
        {!showManageFriends && orgInvitations.length > 0 && (
          <div>
            <p className="px-4 pt-3 pb-1 text-caption sm:text-xs font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wide">
              {tOrg('inviteJoin.inboxHeading')}
            </p>
            <div className="divide-y divide-[rgb(var(--color-border))]">
              {orgInvitations.map((invitation) => {
                const timeAgo = invitation.createdAt
                  ? formatDistanceToNow(new Date(invitation.createdAt), { locale: getDateLocale(), addSuffix: true })
                  : '';
                return (
                  <div key={invitation.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-label sm:text-sm font-medium text-[rgb(var(--color-text-primary))] truncate">
                        {invitation.orgName}
                      </p>
                      <p className="text-caption sm:text-xs truncate text-[rgb(var(--color-text-muted))]">
                        {tOrg('inviteJoin.inboxFrom', { name: invitation.inviterName })}{timeAgo ? ` · ${timeAgo}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() =>
                          respondOrgInvitationMutation.mutate({ invitationId: invitation.id, accept: true })
                        }
                        disabled={respondOrgInvitationMutation.isPending}
                        title={tTasks('inbox.accept')}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
                        aria-label={tOrg('inviteJoin.inboxAccept', { org: invitation.orgName })}
                      >
                        <Check size={15} aria-hidden="true" />
                      </button>
                      <button
                        onClick={() =>
                          respondOrgInvitationMutation.mutate({ invitationId: invitation.id, accept: false })
                        }
                        disabled={respondOrgInvitationMutation.isPending}
                        title={tTasks('inbox.refuse')}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
                        aria-label={tOrg('inviteJoin.inboxRefuse', { org: invitation.orgName })}
                      >
                        <X size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Demandes d'adhésion entreprise (admin) ── */}
        {!showManageFriends && pendingJoinRequests.length > 0 && (
          <div>
            <p className="px-4 pt-3 pb-1 text-caption sm:text-xs font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wide">
              {t('inbox.joinRequests', { count: pendingJoinRequests.length })}
            </p>
            <div className="divide-y divide-[rgb(var(--color-border))]">
              {pendingJoinRequests.map((req) => {
                const timeAgo = req.requestedAt
                  ? formatDistanceToNow(new Date(req.requestedAt), { locale: getDateLocale(), addSuffix: true })
                  : '';
                return (
                  <div key={req.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-label sm:text-sm font-medium text-[rgb(var(--color-text-primary))] truncate">
                        {req.requesterName || t('inbox.someone')}
                      </p>
                      <p className="text-caption sm:text-xs truncate text-[rgb(var(--color-text-muted))]">
                        {t('inbox.wantsToJoin')}{timeAgo ? ` · ${timeAgo}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => handleRespondJoin(req.id, true)}
                        disabled={respondJoinRequestMutation.isPending}
                        title={tTasks('inbox.accept')}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
                        aria-label={t('inbox.acceptJoin', { name: req.requesterName || t('inbox.someone') })}
                      >
                        <Check size={15} aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => handleRespondJoin(req.id, false)}
                        disabled={respondJoinRequestMutation.isPending}
                        title={tTasks('inbox.refuse')}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
                        aria-label={t('inbox.refuseJoin', { name: req.requesterName || t('inbox.someone') })}
                      >
                        <X size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Footer : ajouter un ami ── */}
      <div className="px-3 py-2.5 border-t border-[rgb(var(--color-border))]">
        {showAddFriend ? (
          <div className="flex gap-2">
            <input
              ref={addInputRef}
              type="email"
              value={friendEmail}
              onChange={(e) => setFriendEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendFriendRequest()}
              placeholder="email@exemple.com"
              aria-label={t('inbox.friendEmailAria')}
              className="flex-1 h-9 px-3 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-label sm:text-sm text-[rgb(var(--color-text-primary))] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-[rgb(var(--color-accent-solid))] transition-all"
            />
            <button
              onClick={handleSendFriendRequest}
              disabled={!friendEmail.trim() || sendFriendMutation.isPending}
              className="h-11 md:h-9 px-3 rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-40 text-[rgb(var(--color-accent-solid-foreground))] text-label sm:text-sm font-semibold flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Send size={13} aria-hidden="true" /> Envoyer
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddFriend(true)}
            className="w-full h-11 md:h-9 rounded-lg border border-dashed border-[rgb(var(--color-chip-border))] text-slate-600 dark:text-slate-300 hover:border-[rgb(var(--color-accent-solid-hover))] hover:text-blue-600 dark:hover:text-blue-400 text-label sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <UserPlus size={14} aria-hidden="true" /> Ajouter un ami
          </button>
        )}
      </div>
    </>
  );

  const popoverContent = (
    <AnimatePresence>
      {open && popoverPos && (
        <motion.div
          ref={popoverRef}
          initial={{ opacity: 0, scale: 0.95, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -8 }}
          transition={{ duration: 0.12 }}
          style={{ position: 'fixed', top: popoverPos.top, right: popoverPos.right, zIndex: 9999 }}
          className="w-[22rem] max-w-[calc(100vw-24px)] bg-[rgb(var(--color-background))] rounded-2xl shadow-md border border-[rgb(var(--color-border))] overflow-hidden"
          role="dialog"
          aria-label={tTasks('inbox.label')}
        >
          {popoverInner}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:border-[rgb(var(--color-accent)/0.5)] hover:bg-[rgb(var(--color-hover))] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label={total > 0 ? tTasks('inbox.withCount', { count: total }) : tTasks('inbox.label')}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Inbox size={20} aria-hidden="true" />
        {total > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-caption md:text-[10px] font-bold flex items-center justify-center shadow-sm ring-2 ring-[rgb(var(--color-background))]"
            aria-hidden="true"
          >
            {total > 9 ? '9+' : total}
          </span>
        )}
      </button>
      {typeof document !== 'undefined' && createPortal(popoverContent, document.body)}
      {typeof document !== 'undefined' &&
        createPortal(
          <RemoveFriendConfirm
            open={friendToRemove !== null}
            friendName={friendToRemove?.name}
            ownedSharedTasks={removalPreview.ownedShared}
            receivedSharedTasks={removalPreview.received}
            onCancel={() => setFriendToRemove(null)}
            onConfirm={confirmRemoveFriend}
          />,
          document.body
        )}
    </>
  );
};

export default InboxMenu;
