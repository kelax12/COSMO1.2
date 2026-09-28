import { useOrgJoinRequests, useRespondJoinRequest } from '@/modules/organizations';
import { useT } from '@/i18n/useT';
import { INVITE_GHOST_BTN } from './invite-ui';

interface OrgJoinRequestsListProps {
  orgId: string;
}

/**
 * Demandes d'adhésion arrivées par le code (vue admin), à côté des
 * invitations en attente. Même source et même geste que la boîte de réception
 * (`InboxMenu`) : les deux se mettent à jour ensemble.
 */
const OrgJoinRequestsList = ({ orgId }: OrgJoinRequestsListProps) => {
  const { t } = useT('org');
  const { data: requests = [] } = useOrgJoinRequests(orgId);
  const respond = useRespondJoinRequest();
  if (requests.length === 0) return null;

  return (
    <div>
      <h3 className="text-caption font-semibold text-[rgb(var(--color-text-muted))] mb-1.5">
        {t('invite.requestsTitle')} ({requests.length})
      </h3>
      <ul className="divide-y divide-[rgb(var(--color-border))] rounded-2xl border border-[rgb(var(--color-border))]">
        {requests.map((r) => {
          const name = r.requesterName || r.requesterEmail || '?';
          return (
            <li key={r.id} className="flex items-center gap-2.5 px-3 py-2.5">
              <span className="w-8 h-8 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center text-xs font-semibold shrink-0 overflow-hidden">
                {r.requesterAvatar ? <img src={r.requesterAvatar} alt="" className="w-full h-full object-cover" /> : name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-[rgb(var(--color-text-primary))] truncate">{name}</span>
                <span className="block text-xs text-[rgb(var(--color-text-muted))]">{t('invite.requestVia')}</span>
              </span>
              <button
                type="button"
                onClick={() => respond.mutate({ requestId: r.id, accept: false })}
                disabled={respond.isPending}
                aria-label={t('invite.refuseFor', { name })}
                className={INVITE_GHOST_BTN}
              >
                {t('invite.refuse')}
              </button>
              <button
                type="button"
                onClick={() => respond.mutate({ requestId: r.id, accept: true })}
                disabled={respond.isPending}
                aria-label={t('invite.acceptFor', { name })}
                className="shrink-0 min-h-9 px-3 rounded-lg text-sm font-semibold bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] disabled:opacity-50"
              >
                {t('invite.accept')}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default OrgJoinRequestsList;
