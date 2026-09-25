import { formatDistanceToNow } from 'date-fns';
import { Mail, Users, Move, UserRoundPlus, Network, Clock } from 'lucide-react';
import { subtreeOf, type MemberLastActivity, type OrgMember } from '@/modules/organizations';
import type { OrgTeam } from '@/modules/org-teams';
import { getDateLocale } from '@/i18n/format';
import { useT } from '@/i18n/useT';

const SOURCE_KEY = {
  activity: 'directory.activity.sourceActivity',
  comment: 'directory.activity.sourceComment',
  completion: 'directory.activity.sourceCompletion',
} as const;

interface MemberProfileBodyProps {
  member: OrgMember;
  members: OrgMember[];
  /** Équipes transverses du membre. */
  teams: OrgTeam[];
  currentUserId?: string;
  /**
   * Dernière activité d'équipe (mig. 170). `undefined` : hors périmètre ou pas
   * encore lue, la ligne n'est pas rendue du tout.
   */
  lastActivity?: MemberLastActivity;
  /** Le membre peut-il être déplacé par l'utilisateur courant ? */
  canMove: boolean;
  /** Peut-on ajouter un collaborateur sous ce membre ? */
  canAddUnder: boolean;
  onClose: () => void;
  onMove: (m: OrgMember) => void;
  onAddUnder: (m: OrgMember) => void;
}

/**
 * CORPS de la fiche profil — sans overlay ni en-tête (item #18).
 *
 * Le chrome appartient à `MemberSheet`, qui monte ce corps dans un onglet.
 * L'ancien sheet autonome ci-dessous le réutilise tel quel pour rester le
 * même écran tant que tous les appelants n'ont pas migré.
 */
export const MemberProfileBody = ({
  member, members, teams, currentUserId, lastActivity, canMove, canAddUnder, onClose, onMove, onAddUnder,
}: MemberProfileBodyProps) => {
  const { t, tp } = useT('org');
  const m = member;
  const managerMember = m.managerId ? members.find((x) => x.userId === m.managerId) : null;
  const directs = members.filter((x) => x.managerId === m.userId).length;
  const total = directs > 0 ? subtreeOf(members, m.userId).size : 0;

  return (
    <>
      <dl className="space-y-3 mb-5">
        {m.email && (
          <div className="flex items-center gap-2.5 text-sm">
            <Mail size={15} className="text-[rgb(var(--color-text-muted))] shrink-0" aria-hidden="true" />
            <dd className="text-[rgb(var(--color-text-secondary))] truncate">{m.email}</dd>
          </div>
        )}
        <div className="flex items-center gap-2.5 text-sm">
          <Network size={15} className="text-[rgb(var(--color-text-muted))] shrink-0" aria-hidden="true" />
          <dd className="text-[rgb(var(--color-text-secondary))]">
            {managerMember
              ? <>{t('member.attachedTo')} <strong className="text-[rgb(var(--color-text-primary))]">{managerMember.userId === currentUserId ? t('member.you') : managerMember.displayName}</strong></>
              : t('member.noManager')}
          </dd>
        </div>
        <div className="flex items-center gap-2.5 text-sm">
          <Users size={15} className="text-[rgb(var(--color-text-muted))] shrink-0" aria-hidden="true" />
          <dd className="text-[rgb(var(--color-text-secondary))]">
            {directs === 0
              ? t('member.noDirectReport')
              : tp('pyramid.directCount', directs) + (total > directs ? t('pyramid.totalSuffix', { count: total }) : '')}
          </dd>
        </div>
        {lastActivity && (
          <div className="flex items-center gap-2.5 text-sm">
            <Clock size={15} className="text-[rgb(var(--color-text-muted))] shrink-0" aria-hidden="true" />
            <dd className="text-[rgb(var(--color-text-secondary))]">
              {lastActivity.lastActivityAt
                ? t('directory.activity.sheet', {
                    when: formatDistanceToNow(new Date(lastActivity.lastActivityAt), { addSuffix: true, locale: getDateLocale() }),
                    source: lastActivity.source ? t(SOURCE_KEY[lastActivity.source]) : '',
                  })
                : t('directory.activity.none')}
            </dd>
          </div>
        )}
      </dl>

      {teams.length > 0 && (
        <div className="mb-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-[rgb(var(--color-text-muted))] mb-2">
            {t('member.crossTeams')}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {teams.map((team) => (
              <span
                key={team.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--color-border))] px-2.5 py-1 text-xs font-medium text-[rgb(var(--color-text-secondary))]"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: team.color }} aria-hidden="true" />
                {team.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {(canMove || canAddUnder) && (
        <div className="flex gap-2">
          {canAddUnder && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onAddUnder(m);
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
            >
              <UserRoundPlus size={15} aria-hidden="true" /> {t('common.add')}
            </button>
          )}
          {canMove && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onMove(m);
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
            >
              <Move size={15} aria-hidden="true" /> {t('member.move')}
            </button>
          )}
        </div>
      )}
    </>
  );
};
