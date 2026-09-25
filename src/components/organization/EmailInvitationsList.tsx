import { useState } from 'react';
import { Check, Copy, RotateCw, Trash2 } from 'lucide-react';
import { parseISO } from 'date-fns';
import {
  useEmailInvitations,
  useResendInvitation,
  useRevokeEmailInvitation,
} from '@/modules/organizations/governance.hooks';
import type { EmailInvitation } from '@/modules/organizations/governance.types';
import { formatDate } from '@/i18n/format';
import { useT } from '@/i18n/useT';

interface EmailInvitationsListProps {
  orgId: string;
}

type InvitationState = 'pending' | 'expired' | 'claimed';

const stateOf = (i: EmailInvitation, now = Date.now()): InvitationState =>
  i.claimedAt ? 'claimed' : Date.parse(i.expiresAt) <= now ? 'expired' : 'pending';

/** Une relance par heure au plus : au-delà, c'est du harcèlement, et le domaine d'envoi en pâtit. */
const canResend = (i: EmailInvitation, now = Date.now()): boolean =>
  !i.lastSentAt || now - Date.parse(i.lastSentAt) > 60 * 60 * 1000;

/**
 * Invitations nominatives (mig. 161, M11) : qui a été invité, quand, combien
 * de relances, et ce qu'il en est advenu. Lu par la policy `org_invite_links_select`
 * (créateur ou admin) : un manager ne voit que les siennes.
 */
const EmailInvitationsList = ({ orgId }: EmailInvitationsListProps) => {
  const { t: ta } = useT('orgAdmin');
  const { data: invitations = [], isLoading } = useEmailInvitations(orgId);
  const resend = useResendInvitation(orgId);
  const revoke = useRevokeEmailInvitation(orgId);
  const [copied, setCopied] = useState<string | null>(null);

  if (isLoading) return <p className="text-sm text-[rgb(var(--color-text-muted))] py-4">{ta('invites.listLoading')}</p>;
  if (invitations.length === 0) {
    return <p className="text-sm text-[rgb(var(--color-text-muted))] py-4">{ta('invites.listEmpty')}</p>;
  }

  const date = (iso: string) => formatDate(parseISO(iso), { day: 'numeric', month: 'short' });
  const copy = async (token: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/org-invite/${token}`);
      setCopied(token);
    } catch { /* presse-papiers refusé */ }
  };

  return (
    <ul className="divide-y divide-[rgb(var(--color-border))] rounded-2xl border border-[rgb(var(--color-border))]">
      {invitations.map((i) => {
        const state = stateOf(i);
        return (
          <li key={i.token} className="flex items-center gap-2 px-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-[rgb(var(--color-text-primary))] truncate">{i.email}</span>
              <span className="block text-xs text-[rgb(var(--color-text-muted))]">
                {state === 'claimed'
                  ? ta('invites.stateClaimed', { date: date(i.claimedAt as string) })
                  : state === 'expired'
                    ? ta('invites.stateExpired', { date: date(i.expiresAt) })
                    : ta('invites.statePending', { date: date(i.expiresAt), sent: i.sentCount })}
              </span>
            </span>
            {state !== 'claimed' && (
              <>
                {state === 'pending' && (
                  <button
                    type="button"
                    onClick={() => copy(i.token)}
                    aria-label={ta('invites.copyLinkFor', { email: i.email })}
                    className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]"
                  >
                    {copied === i.token ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => resend.mutate(i.token)}
                  disabled={!canResend(i) || resend.isPending}
                  aria-label={ta('invites.resendFor', { email: i.email })}
                  title={canResend(i) ? ta('invites.resend') : ta('invites.resendWait')}
                  className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-40"
                >
                  <RotateCw size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => revoke.mutate(i.token)}
                  disabled={revoke.isPending}
                  aria-label={ta('invites.revokeFor', { email: i.email })}
                  className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-500/10"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
};

export default EmailInvitationsList;
