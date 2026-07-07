import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Inbox, UserPlus, Check, X, User, Users, Send, Bell, Settings, Trash2, ArrowLeft, ListChecks } from 'lucide-react';
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
import { useTasks, type Task, taskKeys } from '@/modules/tasks';
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
import { useQueryClient } from '@tanstack/react-query';
import { useIsDemo } from '@/lib/app-mode.store';
import { useAuth } from '@/modules/auth/AuthContext';
import { isImageAvatar, isEmojiAvatar } from '@/lib/avatar';
import { getAcknowledgedShares, acknowledgeShare } from '@/lib/acknowledged-shares';
import RemoveFriendConfirm from './RemoveFriendConfirm';

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
  const { user } = useAuth();

  const queryClient = useQueryClient();
  const isDemo = useIsDemo();
  const { data: requests = [] } = useFriendRequests();
  const { data: tasks = [] } = useTasks();
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
    // Supabase : tâches reçues (friend_id = moi) dont la grant n'est pas encore
    // acceptée (accepted_at NULL).
    const pendingReceived = new Set(
      relatedShares.filter((s) => s.friendId === user?.id && !s.accepted).map((s) => s.taskId)
    );
    return tasks.filter((t) => pendingReceived.has(t.id) && !t.completed);
    // ackVersion en dép : recalcul après accept/reject (démo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, relatedShares, isDemo, user?.name, user?.id, ackVersion]);

  const total = incomingRequests.length + tasksToAccept.length + incomingLists.length;

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
    acceptFriendMutation.mutate(id, { onSuccess: () => toast.success("Demande d'ami acceptée") });
  };
  const handleRejectFriend = (id: string) => {
    rejectFriendMutation.mutate(id, { onSuccess: () => toast.success('Demande refusée') });
  };

  const handleAcceptTask = (task: Task) => {
    // Accepter : l'accès est déjà accordé via shared_tasks ; on persiste
    // l'acceptation (accepted_at) pour que le PROPRIÉTAIRE voie « accepté » au
    // lieu de « Envoyé ». La tâche reste dans la to-do, sort de la boîte.
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
          toast.success('Tâche refusée');
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
      onSuccess: () => toast.success('Liste refusée'),
    });
  };

  const confirmRemoveFriend = () => {
    if (!friendToRemove) return;
    const { id, name } = friendToRemove;
    removeFriendMutation.mutate(id, {
      onSuccess: () => toast.success(`${name} retiré de vos amis`),
    });
    setFriendToRemove(null);
  };

  const handleSendFriendRequest = () => {
    const email = friendEmail.trim();
    if (!email) return;
    sendFriendMutation.mutate({ email }, {
      onSuccess: () => {
        toast.success("Demande d'ami envoyée");
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
      <div className="px-4 py-3 border-b border-[rgb(var(--color-border))] flex items-center gap-2">
        {showManageFriends ? (
          <>
            <button
              onClick={() => setShowManageFriends(false)}
              className="-ml-1 w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Retour à la boîte de réception"
            >
              <ArrowLeft size={16} aria-hidden="true" />
            </button>
            <Users size={16} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span className="font-bold text-sm text-[rgb(var(--color-text-primary))]">Mes amis</span>
            {friends.length > 0 && (
              <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[rgb(var(--color-chip-bg))] text-[rgb(var(--color-text-secondary))]">
                {friends.length}
              </span>
            )}
          </>
        ) : (
          <>
            <Inbox size={16} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span className="font-bold text-sm text-[rgb(var(--color-text-primary))]">Boîte de réception</span>
            <div className="ml-auto flex items-center gap-2">
              {total > 0 && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  {total} en attente
                </span>
              )}
              <button
                onClick={() => setShowManageFriends(true)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-[rgb(var(--color-hover))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label="Gérer mes amis"
                title="Gérer mes amis"
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
            <div className="px-4 py-8 text-center">
              <div className="w-11 h-11 rounded-full bg-[rgb(var(--color-hover))] flex items-center justify-center mx-auto mb-2.5">
                <Users size={18} className="text-slate-400" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Aucun ami</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Ajoutez un ami pour commencer à collaborer.
              </p>
            </div>
          ) : (
            <div className="px-3 py-3 space-y-2">
              {friends.map((friend) => (
                <div
                  key={friend.id}
                  className="p-3 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-[rgb(var(--color-hover))] flex items-center justify-center shrink-0 overflow-hidden">
                      {isImageAvatar(friend.avatar) ? (
                        <img src={friend.avatar} alt="" className="w-full h-full object-cover" />
                      ) : isEmojiAvatar(friend.avatar) ? (
                        <span className="text-lg leading-none" aria-hidden="true">{friend.avatar}</span>
                      ) : (
                        <User size={15} className="text-slate-500 dark:text-slate-300" aria-hidden="true" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[rgb(var(--color-text-primary))] truncate">{friend.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{friend.email}</p>
                    </div>
                    <button
                      onClick={() => setFriendToRemove({ id: friend.id, name: friend.name })}
                      disabled={removeFriendMutation.isPending}
                      className="w-9 h-9 rounded-lg border border-[rgb(var(--color-border))] hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 text-slate-500 hover:text-red-500 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 shrink-0"
                      aria-label={`Retirer ${friend.name} de vos amis`}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {!showManageFriends && total === 0 && (
          <div className="px-4 py-8 text-center">
            <div className="w-11 h-11 rounded-full bg-[rgb(var(--color-hover))] flex items-center justify-center mx-auto mb-2.5">
              <Bell size={18} className="text-slate-400" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tout est à jour</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Aucune demande, tâche ou liste en attente.
            </p>
          </div>
        )}

        {/* ── Demandes d'amis ── */}
        {!showManageFriends && incomingRequests.length > 0 && (
          <div className="px-3 pt-3">
            <p className="px-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
              <UserPlus size={12} aria-hidden="true" /> Demandes d'amis ({incomingRequests.length})
            </p>
            <div className="space-y-2">
              {incomingRequests.map((req: PendingFriendRequest) => {
                const timeAgo = req.sentAt
                  ? formatDistanceToNow(new Date(req.sentAt), { locale: fr, addSuffix: true })
                  : '';
                return (
                  <div
                    key={req.id}
                    className="p-3 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-[rgb(var(--color-hover))] flex items-center justify-center shrink-0 overflow-hidden">
                        {isImageAvatar(req.senderAvatar) ? (
                          <img src={req.senderAvatar} alt="" className="w-full h-full object-cover" />
                        ) : isEmojiAvatar(req.senderAvatar) ? (
                          <span className="text-lg leading-none" aria-hidden="true">{req.senderAvatar}</span>
                        ) : (
                          <User size={15} className="text-slate-500 dark:text-slate-300" aria-hidden="true" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[rgb(var(--color-text-primary))] truncate">
                          {req.senderName || prettyName(req.senderEmail)}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {req.senderEmail}{timeAgo ? ` · ${timeAgo}` : ''}
                        </p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => handleAcceptFriend(req.id)}
                          disabled={acceptFriendMutation.isPending}
                          className="w-9 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 monochrome:bg-white monochrome:text-zinc-900"
                          aria-label={`Accepter la demande d'ami de ${prettyName(req.senderEmail)}`}
                        >
                          <Check size={15} aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => handleRejectFriend(req.id)}
                          disabled={rejectFriendMutation.isPending}
                          className="w-9 h-9 rounded-lg border border-[rgb(var(--color-border))] hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 text-slate-500 hover:text-red-500 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                          aria-label={`Refuser la demande d'ami de ${prettyName(req.senderEmail)}`}
                        >
                          <X size={15} aria-hidden="true" />
                        </button>
                      </div>
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
            <p className="px-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
              <Users size={12} aria-hidden="true" /> Tâches partagées ({tasksToAccept.length})
            </p>
            <div className="space-y-2">
              {tasksToAccept.map((task) => {
                const sharer = sharerOf(task);
                const sharerAvatar = sharer?.avatar;
                const sharerName = sharer?.name ?? task.sharedBy;
                return (
                <div
                  key={task.id}
                  className="p-3 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-[rgb(var(--color-hover))] flex items-center justify-center shrink-0 overflow-hidden">
                      {isImageAvatar(sharerAvatar) ? (
                        <img src={sharerAvatar} alt="" className="w-full h-full object-cover" />
                      ) : isEmojiAvatar(sharerAvatar) ? (
                        <span className="text-lg leading-none" aria-hidden="true">{sharerAvatar}</span>
                      ) : (
                        <User size={15} className="text-slate-500 dark:text-slate-300" aria-hidden="true" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[rgb(var(--color-text-primary))] truncate">
                        {task.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate inline-flex items-center gap-1">
                        <Users size={11} aria-hidden="true" /> Reçu de {sharerName}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => handleAcceptTask(task)}
                        className="w-9 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 monochrome:bg-white monochrome:text-zinc-900"
                        aria-label={`Accepter la tâche partagée ${task.name}`}
                      >
                        <Check size={15} aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => handleRejectTask(task)}
                        disabled={unshareTaskMutation.isPending}
                        className="w-9 h-9 rounded-lg border border-[rgb(var(--color-border))] hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 text-slate-500 hover:text-red-500 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                        aria-label={`Refuser la tâche partagée ${task.name}`}
                      >
                        <X size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Listes partagées à accepter — identité teal (vs ambre tâches) ── */}
        {!showManageFriends && incomingLists.length > 0 && (
          <div className="px-3 pt-3 pb-1">
            <p className="px-1 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5 mb-2 text-teal-600 dark:text-teal-400">
              <ListChecks size={12} aria-hidden="true" /> Listes partagées ({incomingLists.length})
            </p>
            <div className="space-y-2">
              {incomingLists.map((grant) => {
                const sharer = listSharerOf(grant);
                const sharerAvatar = sharer?.avatar;
                const sharerName = sharer?.name ?? grant.sharedByName ?? 'un collaborateur';
                return (
                <div
                  key={grant.id}
                  className="p-3 rounded-xl border border-teal-300 dark:border-teal-700/60 bg-teal-50 dark:bg-teal-900/20"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center shrink-0 overflow-hidden">
                      {isImageAvatar(sharerAvatar) ? (
                        <img src={sharerAvatar} alt="" className="w-full h-full object-cover" />
                      ) : isEmojiAvatar(sharerAvatar) ? (
                        <span className="text-lg leading-none" aria-hidden="true">{sharerAvatar}</span>
                      ) : (
                        <ListChecks size={15} className="text-teal-600 dark:text-teal-300" aria-hidden="true" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[rgb(var(--color-text-primary))] truncate">
                        {grant.name}
                      </p>
                      <p className="text-xs truncate inline-flex items-center gap-1 text-teal-700 dark:text-teal-300">
                        <ListChecks size={11} aria-hidden="true" /> Reçu de {sharerName} · {grant.tasks.length} tâche{grant.tasks.length > 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => handleAcceptList(grant)}
                        disabled={acceptSharedListMutation.isPending}
                        className="w-9 h-9 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 monochrome:bg-white monochrome:text-zinc-900"
                        aria-label={`Accepter la liste partagée ${grant.name}`}
                      >
                        <Check size={15} aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => handleRejectList(grant)}
                        disabled={refuseSharedListMutation.isPending}
                        className="w-9 h-9 rounded-lg border border-teal-300 dark:border-teal-700 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 text-slate-500 hover:text-red-500 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                        aria-label={`Refuser la liste partagée ${grant.name}`}
                      >
                        <X size={15} aria-hidden="true" />
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
              aria-label="Email de l'ami à inviter"
              className="flex-1 h-9 px-3 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-sm text-[rgb(var(--color-text-primary))] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
            />
            <button
              onClick={handleSendFriendRequest}
              disabled={!friendEmail.trim() || sendFriendMutation.isPending}
              className="h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Send size={13} aria-hidden="true" /> Envoyer
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAddFriend(true)}
            className="w-full h-9 rounded-lg border border-dashed border-[rgb(var(--color-chip-border))] text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
          className="w-[22rem] max-w-[calc(100vw-24px)] bg-[rgb(var(--color-background))] rounded-2xl shadow-2xl border border-[rgb(var(--color-border))] overflow-hidden"
          role="dialog"
          aria-label="Boîte de réception"
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
        className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:border-[rgb(var(--color-accent)/0.5)] hover:bg-[rgb(var(--color-hover))] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 monochrome:hover:border-white/30"
        aria-label={total > 0 ? `Boîte de réception, ${total} en attente` : 'Boîte de réception'}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Inbox size={20} aria-hidden="true" />
        {total > 0 && (
          <span
            className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm ring-2 ring-[rgb(var(--color-background))] monochrome:bg-white monochrome:text-black"
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
