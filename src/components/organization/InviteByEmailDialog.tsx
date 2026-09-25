import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, X } from 'lucide-react';
import { subtreeOf, type OrgMember } from '@/modules/organizations';
import { useOrgTeams } from '@/modules/org-teams';
import { useInviteByEmail } from '@/modules/organizations/governance.hooks';
import type { EmailInvitationResult, SendInvitationsResult } from '@/modules/organizations/governance.types';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import MemberSelectField from './MemberSelectField';
import { splitEmails } from './invite-email.helpers';
import { useT } from '@/i18n/useT';

interface InviteByEmailDialogProps {
  orgId: string;
  members: OrgMember[];
  currentUserId?: string;
  isAdmin: boolean;
  onClose: () => void;
}

const ACCESS_CHOICES = [null, 7, 30, 90, 180] as const;

/**
 * Inviter par e-mail (mig. 161, M11).
 *
 * Le canal par défaut d'une entreprise. Chaque adresse reçoit un lien
 * NOMINATIF (seul le compte de cette adresse peut l'accepter), déjà placé dans
 * la pyramide et dans des équipes, et éventuellement borné dans le temps (un
 * prestataire, un stagiaire). Le résultat dit adresse par adresse ce qui s'est
 * passé : un lien créé dont l'e-mail n'est pas parti reste copiable.
 */
const InviteByEmailDialog = ({ orgId, members, currentUserId, isAdmin, onClose }: InviteByEmailDialogProps) => {
  const { t } = useT('org');
  const { t: ta } = useT('orgAdmin');
  const invite = useInviteByEmail(orgId);
  const { data: teams = [] } = useOrgTeams(orgId);
  const [raw, setRaw] = useState('');
  // Un manager ne place que sous lui ou son sous-arbre (même règle que la
  // policy `org_invite_links_insert`) : il part donc placé sous lui-même.
  const [managerId, setManagerId] = useState(isAdmin ? '' : currentUserId ?? '');
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [accessDays, setAccessDays] = useState<number | null>(null);
  const [done, setDone] = useState<{ results: EmailInvitationResult[]; sending: SendInvitationsResult } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const { ref, dialogProps } = useModalA11y<HTMLDivElement>({
    open: true,
    onClose: () => { if (!invite.isPending) onClose(); },
    label: ta('invites.emailTitle'),
  });

  const emails = useMemo(() => splitEmails(raw), [raw]);
  const placeable = useMemo(() => {
    if (isAdmin || !currentUserId) return members;
    const mine = subtreeOf(members, currentUserId);
    return members.filter((m) => m.userId === currentUserId || mine.has(m.userId));
  }, [members, isAdmin, currentUserId]);

  const submit = () =>
    invite.mutate(
      { emails, managerId: managerId || null, teamIds, accessDays },
      { onSuccess: setDone },
    );

  const copyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/org-invite/${token}`);
      setCopied(token);
    } catch { /* presse-papiers refusé : le lien reste lisible dans la liste */ }
  };

  const statusLabel = (r: EmailInvitationResult): string => {
    if (r.status === 'created') {
      if (done?.sending.unavailable) return ta('invites.statusCreatedNotSent');
      return done && done.sending.failed > 0 ? ta('invites.statusCreatedMaybe') : ta('invites.statusSent');
    }
    if (r.status === 'already_member') return ta('invites.statusAlreadyMember');
    if (r.status === 'already_invited') return ta('invites.statusAlreadyInvited');
    return ta('invites.statusInvalid');
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={() => { if (!invite.isPending) onClose(); }}
    >
      <div
        ref={ref}
        {...dialogProps}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-[28px] sm:rounded-2xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] shadow-2xl p-5 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">{ta('invites.emailTitle')}</h2>
            <p className="text-sm text-[rgb(var(--color-text-secondary))] mt-1">{ta('invites.emailIntro')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={invite.isPending}
            aria-label={t('common.close')}
            className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {done ? (
          <>
            {done.sending.unavailable && (
              <p role="status" className="rounded-xl bg-amber-500/10 text-amber-800 dark:text-amber-200 text-sm p-3">
                {ta('invites.mailUnavailable')}
              </p>
            )}
            <ul className="space-y-1.5">
              {done.results.map((r) => (
                <li key={r.email} className="flex items-center gap-2 rounded-xl border border-[rgb(var(--color-border))] px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-[rgb(var(--color-text-primary))] truncate">{r.email}</span>
                    <span className="block text-xs text-[rgb(var(--color-text-muted))]">{statusLabel(r)}</span>
                  </span>
                  {r.token && (
                    <button
                      type="button"
                      onClick={() => copyLink(r.token as string)}
                      aria-label={ta('invites.copyLinkFor', { email: r.email })}
                      className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]"
                    >
                      {copied === r.token ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 px-4 rounded-xl text-sm font-semibold bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]"
              >
                {ta('invites.done')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <label htmlFor="invite-emails" className="block text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1">
                {ta('invites.emailsLabel')}
              </label>
              <textarea
                id="invite-emails"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                rows={4}
                placeholder={ta('invites.emailsPlaceholder')}
                className="w-full rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-2 text-sm text-[rgb(var(--color-text-primary))]"
              />
              <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))]">
                {ta('invites.emailsCount', { count: emails.length, max: 50 })}
              </p>
            </div>

            <MemberSelectField
              label={ta('invites.placement')}
              members={placeable}
              value={managerId}
              onChange={setManagerId}
              emptyLabel={isAdmin ? ta('invites.unplaced') : ta('invites.underMe')}
              hint={ta('invites.placementHint')}
            />

            {teams.length > 0 && (
              <fieldset>
                <legend className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1">{ta('invites.teams')}</legend>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {teams.map((team) => {
                    const on = teamIds.includes(team.id);
                    return (
                      <button
                        key={team.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setTeamIds((ids) => (on ? ids.filter((x) => x !== team.id) : [...ids, team.id]))}
                        className={`min-h-9 px-3 rounded-full text-xs font-semibold border transition-colors ${
                          on
                            ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] border-[rgb(var(--color-accent-solid))]'
                            : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
                        }`}
                      >
                        {team.name}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <div>
              <label htmlFor="invite-access" className="block text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1">
                {ta('invites.access')}
              </label>
              <select
                id="invite-access"
                value={accessDays ?? ''}
                onChange={(e) => setAccessDays(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-2.5 text-sm text-[rgb(var(--color-text-primary))]"
              >
                {ACCESS_CHOICES.map((d) => (
                  <option key={d ?? 'none'} value={d ?? ''}>
                    {d === null ? ta('invites.accessPermanent') : ta('invites.accessDays', { count: d })}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 px-4 rounded-xl border border-[rgb(var(--color-border))] text-sm font-semibold text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))]"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={invite.isPending || emails.length === 0 || emails.length > 50 || (!isAdmin && !managerId)}
                className="min-h-11 px-4 rounded-xl text-sm font-semibold bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] disabled:opacity-50"
              >
                {invite.isPending ? ta('invites.sending') : ta('invites.send', { count: emails.length })}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default InviteByEmailDialog;
