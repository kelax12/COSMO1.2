// ═══════════════════════════════════════════════════════════════════
// Les nouvelles qui viennent des AMIS
//
// FRONTIÈRE : trois sections — une demande d'ami, une tâche partagée, une
// liste partagée. Elles forment le pendant de `InboxOrgSections`, et la
// séparation est la même : ce fichier ne connaît ni organisation, ni
// invitation d'entreprise, ni demande d'adhésion.
//
// Il ne déclenche rien : des listes entrent, des rappels sortent. Les
// mutations restent chez `InboxMenu`, seul à savoir ce qu'une réponse
// invalide comme cache — accepter une tâche partagée n'invalide pas les
// mêmes clés que refuser, et c'est une décision de cache, pas de rendu.
//
// Extrait le 2026-09-05 (C-09).
// ═══════════════════════════════════════════════════════════════════
import { Check, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getDateLocale } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import type { Task } from '@/modules/tasks';
import type { PendingFriendRequest, SharedListGrant } from '@/modules/friends';
import { prettyName } from './helpers';

interface InboxSocialSectionsProps {
  friendRequests: PendingFriendRequest[];
  onAcceptFriend: (id: string) => void;
  onRejectFriend: (id: string) => void;
  isAcceptFriendPending: boolean;
  isRejectFriendPending: boolean;

  sharedTasks: Task[];
  /** Qui a partagé la tâche — résolu par l'appelant, seul à connaître les amis. */
  sharerOfTask: (task: Task) => string | undefined;
  onAcceptTask: (task: Task) => void;
  onRejectTask: (task: Task) => void;
  isRejectTaskPending: boolean;

  sharedLists: SharedListGrant[];
  sharerOfList: (grant: SharedListGrant) => string;
  onAcceptList: (grant: SharedListGrant) => void;
  onRejectList: (grant: SharedListGrant) => void;
  isAcceptListPending: boolean;
  isRejectListPending: boolean;
}

const HEADING_CLASS =
  'px-4 pt-3 pb-1 text-caption sm:text-xs font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wide';
const ROW_CLASS = 'flex items-center gap-3 px-4 py-2.5';
const TITLE_CLASS = 'text-label sm:text-sm font-medium text-[rgb(var(--color-text-primary))] truncate';
const SUBTITLE_CLASS = 'text-caption sm:text-xs text-[rgb(var(--color-text-muted))] truncate';
const ICON_BUTTON_CLASS =
  'w-7 h-7 rounded-md flex items-center justify-center hover:bg-[rgb(var(--color-hover))] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]';

const InboxSocialSections = ({
  friendRequests,
  onAcceptFriend,
  onRejectFriend,
  isAcceptFriendPending,
  isRejectFriendPending,
  sharedTasks,
  sharerOfTask,
  onAcceptTask,
  onRejectTask,
  isRejectTaskPending,
  sharedLists,
  sharerOfList,
  onAcceptList,
  onRejectList,
  isAcceptListPending,
  isRejectListPending,
}: InboxSocialSectionsProps) => {
  const ov = useT('overlays');
  const { t: tTasks } = useT('tasks');

  return (
    <>
      {/* ── Demandes d'amis ── */}
      {friendRequests.length > 0 && (
        <div>
          <p className={HEADING_CLASS}>{ov.t('inbox.friendRequests', { count: friendRequests.length })}</p>
          <div className="divide-y divide-[rgb(var(--color-border))]">
            {friendRequests.map((req) => {
              const timeAgo = req.sentAt
                ? formatDistanceToNow(new Date(req.sentAt), { locale: getDateLocale(), addSuffix: true })
                : '';
              const name = prettyName(req.senderEmail) ?? '';
              return (
                <div key={req.id} className={ROW_CLASS}>
                  <div className="flex-1 min-w-0">
                    <p className={TITLE_CLASS}>{req.senderName || name}</p>
                    <p className={SUBTITLE_CLASS}>
                      {req.senderEmail}{timeAgo ? ` · ${timeAgo}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => onAcceptFriend(req.id)}
                      disabled={isAcceptFriendPending}
                      title={tTasks('inbox.accept')}
                      className={`${ICON_BUTTON_CLASS} text-[rgb(var(--color-accent))]`}
                      aria-label={tTasks('inbox.acceptNamed', { name })}
                    >
                      <Check size={15} aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => onRejectFriend(req.id)}
                      disabled={isRejectFriendPending}
                      title={tTasks('inbox.refuse')}
                      className={`${ICON_BUTTON_CLASS} text-[rgb(var(--color-text-muted))]`}
                      aria-label={tTasks('inbox.refuseNamed', { name })}
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
      {sharedTasks.length > 0 && (
        <div className="px-3 pt-3 pb-1">
          <p className={HEADING_CLASS}>{tTasks('inbox.sharedTasks', { count: sharedTasks.length })}</p>
          <div className="divide-y divide-[rgb(var(--color-border))]">
            {sharedTasks.map((task) => (
              <div key={task.id} className={ROW_CLASS}>
                <div className="flex-1 min-w-0">
                  <p className={TITLE_CLASS}>{task.name}</p>
                  <p className={SUBTITLE_CLASS}>{sharerOfTask(task)}</p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => onAcceptTask(task)}
                    title={tTasks('inbox.accept')}
                    className={`${ICON_BUTTON_CLASS} text-[rgb(var(--color-accent))]`}
                    aria-label={tTasks('inbox.acceptTask', { name: task.name })}
                  >
                    <Check size={15} aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => onRejectTask(task)}
                    disabled={isRejectTaskPending}
                    title={tTasks('inbox.refuse')}
                    className={`${ICON_BUTTON_CLASS} text-[rgb(var(--color-text-muted))]`}
                    aria-label={tTasks('inbox.refuseTask', { name: task.name })}
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Listes partagées à accepter ── */}
      {sharedLists.length > 0 && (
        <div>
          <p className={HEADING_CLASS}>{tTasks('inbox.sharedLists', { count: sharedLists.length })}</p>
          <div className="divide-y divide-[rgb(var(--color-border))]">
            {sharedLists.map((grant) => (
              <div key={grant.id} className={ROW_CLASS}>
                <div className="flex-1 min-w-0">
                  <p className={TITLE_CLASS}>{grant.name}</p>
                  <p className="text-caption sm:text-xs truncate text-[rgb(var(--color-text-muted))]">
                    {ov.tp('inbox.receivedFromWithCount', grant.tasks.length, { name: sharerOfList(grant) })}
                  </p>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => onAcceptList(grant)}
                    disabled={isAcceptListPending}
                    title={tTasks('inbox.accept')}
                    className={`${ICON_BUTTON_CLASS} text-[rgb(var(--color-accent))]`}
                    aria-label={tTasks('inbox.acceptList', { name: grant.name })}
                  >
                    <Check size={15} aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => onRejectList(grant)}
                    disabled={isRejectListPending}
                    title={tTasks('inbox.refuse')}
                    className={`${ICON_BUTTON_CLASS} text-[rgb(var(--color-text-muted))]`}
                    aria-label={tTasks('inbox.refuseList', { name: grant.name })}
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default InboxSocialSections;
