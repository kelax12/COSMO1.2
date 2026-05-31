import React, { useState, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Inbox, UserPlus, Check, X, User, Users, Send, Bell } from 'lucide-react';
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
import { useTasks, useUpdateTask, type Task } from '@/modules/tasks';
import { useAuth } from '@/modules/auth/AuthContext';
import { useBilling } from '@/modules/billing/billing.context';

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
 * Accepter une tâche partagée est une fonctionnalité Premium : un utilisateur
 * non-premium est redirigé vers `/premium` avec un message explicatif.
 */
const InboxMenu: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPremium } = useBilling();

  const { data: requests = [] } = useFriendRequests();
  const { data: tasks = [] } = useTasks();
  const acceptFriendMutation = useAcceptFriendRequest();
  const rejectFriendMutation = useRejectFriendRequest();
  const sendFriendMutation = useSendFriendRequest();
  const updateTaskMutation = useUpdateTask();

  const [open, setOpen] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendEmail, setFriendEmail] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; right: number } | null>(null);

  const incomingRequests = useMemo(
    () => requests.filter((r: PendingFriendRequest) => r.status === 'pending' && r.senderEmail),
    [requests]
  );

  // Tâches reçues d'un ami et pas encore acceptées : `sharedBy` renseigné et
  // différent de l'utilisateur courant. (En mode démo `sharedBy` est stocké ;
  // en Supabase il est dérivé de la propriété de la tâche.)
  const tasksToAccept = useMemo(
    () => tasks.filter((t) => !!t.sharedBy && t.sharedBy !== user?.name && !t.completed),
    [tasks, user?.name]
  );

  const total = incomingRequests.length + tasksToAccept.length;

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

  useEffect(() => {
    if (showAddFriend) addInputRef.current?.focus();
  }, [showAddFriend]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleAcceptFriend = (id: string) => {
    acceptFriendMutation.mutate(id, { onSuccess: () => toast.success("Demande d'ami acceptée") });
  };
  const handleRejectFriend = (id: string) => {
    rejectFriendMutation.mutate(id, { onSuccess: () => toast.success('Demande refusée') });
  };

  const handleAcceptTask = (task: Task) => {
    // Le partage de tâches est réservé au Premium : on redirige sinon.
    if (!isPremium()) {
      setOpen(false);
      toast.info('Le partage de tâches est une fonctionnalité Premium.');
      navigate('/premium');
      return;
    }
    updateTaskMutation.mutate(
      { id: task.id, updates: { sharedBy: undefined, isCollaborative: true } },
      { onSuccess: () => toast.success('Tâche acceptée') }
    );
  };
  const handleRejectTask = (task: Task) => {
    updateTaskMutation.mutate(
      { id: task.id, updates: { sharedBy: undefined, isCollaborative: false } },
      { onSuccess: () => toast.success('Tâche refusée') }
    );
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
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
        <Inbox size={16} className="text-blue-600 dark:text-blue-400" aria-hidden="true" />
        <span className="font-bold text-sm text-slate-900 dark:text-white">Boîte de réception</span>
        {total > 0 && (
          <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            {total} en attente
          </span>
        )}
      </div>

      <div className="max-h-[60vh] overflow-y-auto">
        {total === 0 && (
          <div className="px-4 py-8 text-center">
            <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-2.5">
              <Bell size={18} className="text-slate-400" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Tout est à jour</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Aucune demande ni tâche en attente.
            </p>
          </div>
        )}

        {/* ── Demandes d'amis ── */}
        {incomingRequests.length > 0 && (
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
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                        <User size={15} className="text-slate-500 dark:text-slate-300" aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {prettyName(req.senderEmail)}
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
                          className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 text-slate-500 hover:text-red-500 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
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
        {tasksToAccept.length > 0 && (
          <div className="px-3 pt-3 pb-1">
            <p className="px-1 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
              <Users size={12} aria-hidden="true" /> Tâches partagées ({tasksToAccept.length})
            </p>
            <div className="space-y-2">
              {tasksToAccept.map((task) => (
                <div
                  key={task.id}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {task.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate inline-flex items-center gap-1">
                        <Users size={11} aria-hidden="true" /> Reçu de {task.sharedBy}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => handleAcceptTask(task)}
                        disabled={updateTaskMutation.isPending}
                        className="w-9 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 monochrome:bg-white monochrome:text-zinc-900"
                        aria-label={`Accepter la tâche partagée ${task.name}`}
                      >
                        <Check size={15} aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => handleRejectTask(task)}
                        disabled={updateTaskMutation.isPending}
                        className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 text-slate-500 hover:text-red-500 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                        aria-label={`Refuser la tâche partagée ${task.name}`}
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

      {/* ── Footer : ajouter un ami ── */}
      <div className="px-3 py-2.5 border-t border-slate-200 dark:border-slate-700">
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
              className="flex-1 h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
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
            className="w-full h-9 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
          className="w-[22rem] max-w-[calc(100vw-24px)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
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
    </>
  );
};

export default InboxMenu;
