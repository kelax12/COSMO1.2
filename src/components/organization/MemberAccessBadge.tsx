import { Clock, PauseCircle } from 'lucide-react';
import { parseISO } from 'date-fns';
import type { OrgMember } from '@/modules/organizations';
import { formatDate } from '@/i18n/format';
import { useT } from '@/i18n/useT';

interface MemberAccessBadgeProps {
  member: Pick<OrgMember, 'suspendedAt' | 'accessExpiresAt'>;
}

/**
 * Pastille d'état d'accès d'un membre (mig. 161) : « Suspendu », ou
 * « Accès jusqu'au … » pour un invité temporaire. Ne rend rien pour un membre
 * ordinaire : l'annuaire ne doit pas se couvrir d'étiquettes qui ne disent rien.
 */
const MemberAccessBadge = ({ member }: MemberAccessBadgeProps) => {
  const { t: ta } = useT('orgAdmin');
  if (member.suspendedAt) {
    return (
      <span className="inline-flex items-center gap-1 shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300">
        <PauseCircle size={11} aria-hidden="true" /> {ta('lifecycle.badgeSuspended')}
      </span>
    );
  }
  if (member.accessExpiresAt) {
    const expired = Date.parse(member.accessExpiresAt) <= Date.now();
    const date = formatDate(parseISO(member.accessExpiresAt), { day: 'numeric', month: 'short', year: 'numeric' });
    return (
      <span
        className={`inline-flex items-center gap-1 shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold ${
          expired
            ? 'bg-red-500/10 text-red-600 dark:text-red-400'
            : 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))]'
        }`}
      >
        <Clock size={11} aria-hidden="true" />
        {expired ? ta('lifecycle.badgeExpired', { date }) : ta('lifecycle.badgeUntil', { date })}
      </span>
    );
  }
  return null;
};

export default MemberAccessBadge;
