import { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { formatDate } from '@/i18n/format';
import type { OrgMember } from '@/modules/organizations';
import MemberAvatar from './MemberAvatar';

interface Props {
  members: OrgMember[];
  ownerId: string;
  /** `null` = palier sans plafond. */
  quota: number | null;
}

/** Au-delà, la liste se replie : une organisation peut compter deux cents membres. */
const PREVIEW = 8;

/**
 * « Qui compte » : la liste des sièges consommés.
 *
 * La règle affichée est celle du serveur, pas une approximation : un siège =
 * une ligne de `organization_members` (`org_seats_allowed`, mig. 101), admins
 * et propriétaire compris. Une invitation en attente n'en consomme aucun tant
 * qu'elle n'est pas acceptée. Dire « 7 sièges sur 10 » sans dire QUI les
 * occupe laissait le propriétaire deviner qui retirer avant de changer de
 * palier.
 */
export function OrgBillingSeats({ members, ownerId, quota }: Props) {
  const { t, tp } = useT('orgAccount');
  const { t: tOrg } = useT('org');
  const [expanded, setExpanded] = useState(false);

  // Ordre d'arrivée : c'est l'ordre dans lequel les sièges ont été pris.
  const sorted = useMemo(
    () => [...members].sort((a, b) => (a.joinedAt < b.joinedAt ? -1 : a.joinedAt > b.joinedAt ? 1 : 0)),
    [members],
  );
  const visible = expanded ? sorted : sorted.slice(0, PREVIEW);
  const roleLabel = (m: OrgMember) =>
    m.userId === ownerId ? t('seatsOwner') : m.role === 'admin' ? tOrg('roles.admin') : tOrg('roles.member');

  return (
    <section
      aria-labelledby="org-billing-seats"
      className="rounded-xl border border-[rgb(var(--color-border))] p-4 flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="org-billing-seats" className="flex items-center gap-2 text-sm font-semibold text-[rgb(var(--color-text-primary))]">
          <Users size={15} aria-hidden="true" />
          {t('seatsTitle')}
        </h3>
        <span className="text-xs text-[rgb(var(--color-text-secondary))]">
          {quota === null
            ? tp('seatsCountUnlimited', members.length)
            : tp('seatsCount', members.length, { quota })}
        </span>
      </div>
      <p className="text-xs text-[rgb(var(--color-text-secondary))]">{t('seatsRule')}</p>

      <ul className="divide-y divide-[rgb(var(--color-border))]">
        {visible.map((m) => (
          <li key={m.userId} className="flex items-center gap-3 py-2 min-w-0">
            <MemberAvatar avatar={m.avatar} name={m.displayName} size={28} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[rgb(var(--color-text-primary))] truncate">{m.displayName}</p>
              {m.email && (
                <p className="text-xs text-[rgb(var(--color-text-muted))] truncate">{m.email}</p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs font-medium text-[rgb(var(--color-text-secondary))]">{roleLabel(m)}</p>
              <p className="text-[11px] text-[rgb(var(--color-text-muted))]">
                {t('seatsSince', { date: formatDate(new Date(m.joinedAt)) })}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {sorted.length > PREVIEW && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="self-start text-sm font-medium text-[rgb(var(--color-accent))] hover:underline"
        >
          {expanded ? t('seatsShowLess') : tp('seatsShowAll', sorted.length)}
        </button>
      )}
    </section>
  );
}

export default OrgBillingSeats;
