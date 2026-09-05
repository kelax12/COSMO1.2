// ═══════════════════════════════════════════════════════════════════
// Les nouvelles qui viennent de l'ORGANISATION
//
// FRONTIÈRE : trois sections de la boîte de réception — être retiré d'une
// entreprise, être invité dans une, et (côté admin) recevoir une demande
// d'adhésion. Elles n'ont rien à voir avec les amis, les tâches partagées ou
// les listes, qui occupent le reste du panneau : ce fichier ne connaît
// aucune de ces notions.
//
// Il ne déclenche rien lui-même : trois listes entrent, trois rappels
// sortent. Les mutations restent chez `InboxMenu`, seul à savoir ce qu'une
// réponse invalide comme cache.
//
// Extrait le 2026-09-05 (C-09).
// ═══════════════════════════════════════════════════════════════════
import { Check, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { getDateLocale } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import type { OrgInvitation, OrgRemovalNotice, OrgJoinRequest } from '@/modules/organizations';

interface InboxOrgSectionsProps {
  removalNotices: OrgRemovalNotice[];
  orgInvitations: OrgInvitation[];
  joinRequests: OrgJoinRequest[];
  onDismissRemoval: (noticeId: string) => void;
  isDismissPending: boolean;
  onRespondInvitation: (invitationId: string, accept: boolean) => void;
  isRespondInvitationPending: boolean;
  onRespondJoin: (requestId: string, accept: boolean) => void;
  isRespondJoinPending: boolean;
}

const HEADING_CLASS =
  'px-4 pt-3 pb-1 text-caption sm:text-xs font-semibold text-[rgb(var(--color-text-muted))] uppercase tracking-wide';
const ROW_CLASS = 'flex items-center gap-3 px-4 py-2.5';
const TITLE_CLASS = 'text-label sm:text-sm font-medium text-[rgb(var(--color-text-primary))] truncate';
const SUBTITLE_CLASS = 'text-caption sm:text-xs truncate text-[rgb(var(--color-text-muted))]';
const ICON_BUTTON_CLASS =
  'w-7 h-7 rounded-md flex items-center justify-center hover:bg-[rgb(var(--color-hover))] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]';

const ago = (iso?: string | null) =>
  iso ? formatDistanceToNow(new Date(iso), { locale: getDateLocale(), addSuffix: true }) : '';

const InboxOrgSections = ({
  removalNotices,
  orgInvitations,
  joinRequests,
  onDismissRemoval,
  isDismissPending,
  onRespondInvitation,
  isRespondInvitationPending,
  onRespondJoin,
  isRespondJoinPending,
}: InboxOrgSectionsProps) => {
  const ov = useT('overlays');
  const { t: tTasks } = useT('tasks');
  const { t: tOrg } = useT('org');

  return (
    <>
      {/* ── Retrait d'une entreprise (mig. 106) ── */}
      {removalNotices.length > 0 && (
        <div>
          <p className={HEADING_CLASS}>{tOrg('inviteJoin.removedHeading')}</p>
          <div className="divide-y divide-[rgb(var(--color-border))]">
            {removalNotices.map((notice) => {
              const timeAgo = ago(notice.createdAt);
              return (
                <div key={notice.id} className={ROW_CLASS}>
                  <div className="flex-1 min-w-0">
                    <p className={TITLE_CLASS}>{tOrg('inviteJoin.removedBody', { org: notice.orgName })}</p>
                    <p className={SUBTITLE_CLASS}>
                      {notice.actorName ? tOrg('inviteJoin.removedBy', { name: notice.actorName }) : ''}
                      {notice.actorName && timeAgo ? ' · ' : ''}{timeAgo}
                    </p>
                  </div>
                  <button
                    onClick={() => onDismissRemoval(notice.id)}
                    disabled={isDismissPending}
                    className="shrink-0 text-caption sm:text-xs font-semibold px-2.5 py-1.5 rounded-lg text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
                  >
                    {tOrg('inviteJoin.removedDismiss')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Invitations d'entreprise reçues (mig. 105) ── */}
      {orgInvitations.length > 0 && (
        <div>
          <p className={HEADING_CLASS}>{tOrg('inviteJoin.inboxHeading')}</p>
          <div className="divide-y divide-[rgb(var(--color-border))]">
            {orgInvitations.map((invitation) => {
              const timeAgo = ago(invitation.createdAt);
              return (
                <div key={invitation.id} className={ROW_CLASS}>
                  <div className="flex-1 min-w-0">
                    <p className={TITLE_CLASS}>{invitation.orgName}</p>
                    <p className={SUBTITLE_CLASS}>
                      {tOrg('inviteJoin.inboxFrom', { name: invitation.inviterName })}{timeAgo ? ` · ${timeAgo}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => onRespondInvitation(invitation.id, true)}
                      disabled={isRespondInvitationPending}
                      title={tTasks('inbox.accept')}
                      className={`${ICON_BUTTON_CLASS} text-[rgb(var(--color-accent))]`}
                      aria-label={tOrg('inviteJoin.inboxAccept', { org: invitation.orgName })}
                    >
                      <Check size={15} aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => onRespondInvitation(invitation.id, false)}
                      disabled={isRespondInvitationPending}
                      title={tTasks('inbox.refuse')}
                      className={`${ICON_BUTTON_CLASS} text-[rgb(var(--color-text-muted))]`}
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
      {joinRequests.length > 0 && (
        <div>
          <p className={HEADING_CLASS}>{ov.t('inbox.joinRequests', { count: joinRequests.length })}</p>
          <div className="divide-y divide-[rgb(var(--color-border))]">
            {joinRequests.map((req) => {
              const timeAgo = ago(req.requestedAt);
              const name = req.requesterName || ov.t('inbox.someone');
              return (
                <div key={req.id} className={ROW_CLASS}>
                  <div className="flex-1 min-w-0">
                    <p className={TITLE_CLASS}>{name}</p>
                    <p className={SUBTITLE_CLASS}>
                      {ov.t('inbox.wantsToJoin')}{timeAgo ? ` · ${timeAgo}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => onRespondJoin(req.id, true)}
                      disabled={isRespondJoinPending}
                      title={tTasks('inbox.accept')}
                      className={`${ICON_BUTTON_CLASS} text-[rgb(var(--color-accent))]`}
                      aria-label={ov.t('inbox.acceptJoin', { name })}
                    >
                      <Check size={15} aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => onRespondJoin(req.id, false)}
                      disabled={isRespondJoinPending}
                      title={tTasks('inbox.refuse')}
                      className={`${ICON_BUTTON_CLASS} text-[rgb(var(--color-text-muted))]`}
                      aria-label={ov.t('inbox.refuseJoin', { name })}
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
    </>
  );
};

export default InboxOrgSections;
