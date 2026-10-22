import { Link } from 'react-router';
import { Mail, ChevronRight } from 'lucide-react';
import { useEmailInvitations } from '@/modules/organizations/governance.hooks';
import { orgSectionPath } from './deep-link.helpers';
import { useT } from '@/i18n/useT';

/**
 * Invitations en attente, visibles depuis l'annuaire (reco UI n° 24).
 *
 * Elles vivent dans Paramètres depuis l'audit Membres du 2026-09-24 : c'est
 * juste pour les GÉRER, mais un admin qui cherche « Paul, invité mardi » ouvre
 * l'annuaire, pas les réglages. Ce bandeau ne gère rien, il compte et renvoie.
 * Même lecture que la liste (RLS : créateur ou admin).
 */
const PendingInvitesStrip = ({ orgId }: { orgId: string }) => {
  const { tp, t } = useT('orgAdmin');
  const { data: invitations = [] } = useEmailInvitations(orgId);
  const now = Date.now();
  const pending = invitations.filter((i) => !i.claimedAt && Date.parse(i.expiresAt) > now);
  if (pending.length === 0) return null;

  const preview = pending.slice(0, 3).map((i) => i.email).join(', ');
  return (
    <Link
      to={orgSectionPath('settings')}
      className="flex items-center gap-3 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-2.5 hover:bg-[rgb(var(--color-hover))] transition-colors"
    >
      <Mail size={16} aria-hidden="true" className="shrink-0 text-amber-500" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-[rgb(var(--color-text-primary))]">
          {tp('ui.pendingInvites', pending.length)}
        </span>
        <span className="block text-xs text-[rgb(var(--color-text-muted))] truncate">
          {preview}{pending.length > 3 ? '…' : ''}
        </span>
      </span>
      <span className="text-xs font-medium text-[rgb(var(--color-text-secondary))] shrink-0">{t('ui.pendingInvitesManage')}</span>
      <ChevronRight size={14} aria-hidden="true" className="text-[rgb(var(--color-text-muted))]" />
    </Link>
  );
};

export default PendingInvitesStrip;
