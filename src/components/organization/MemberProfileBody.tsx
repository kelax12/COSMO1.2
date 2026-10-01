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

const CARD = 'rounded-2xl border border-[rgb(var(--color-border))] p-4';
const CARD_TITLE = 'text-caption font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))] mb-3';

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
  const { t } = useT('org');
  const { t: tOrgAdmin } = useT('orgAdmin');
  const { t: ta, tp: tpa } = useT('orgAdmin');
  const m = member;
  const managerMember = m.managerId ? members.find((x) => x.userId === m.managerId) : null;
  const directs = members.filter((x) => x.managerId === m.userId).length;
  const total = directs > 0 ? subtreeOf(members, m.userId).size : 0;

  return (
    <>
      {/* Grand format (maquette A, 2026-09-28) : coordonnées à gauche,
          rattachement et équipes à droite ; une seule colonne sur téléphone. */}
      <div className="grid gap-3 sm:grid-cols-2 mb-5">
        <section className={CARD}>
          <h3 className={CARD_TITLE}>{t('popups.member.coordinates')}</h3>
          <dl className="space-y-3">
            {m.email && (
              <div className="flex items-center gap-2.5 text-sm">
                <Mail size={15} className="text-[rgb(var(--color-text-muted))] shrink-0" aria-hidden="true" />
                <dd className="text-[rgb(var(--color-text-secondary))] truncate">{m.email}</dd>
              </div>
            )}
            {lastActivity && (
              <div className="flex items-center gap-2.5 text-sm">
                <Clock size={15} className="text-[rgb(var(--color-text-muted))] shrink-0" aria-hidden="true" />
                <dd className="text-[rgb(var(--color-text-secondary))]">
                  {lastActivity.lastActivityAt
                    ? ta('directory.activity.sheet', {
                        when: formatDistanceToNow(new Date(lastActivity.lastActivityAt), { addSuffix: true, locale: getDateLocale() }),
                        source: lastActivity.source ? tOrgAdmin(SOURCE_KEY[lastActivity.source]) : '',
                      })
                    : ta('directory.activity.none')}
                </dd>
              </div>
            )}
          </dl>
        </section>

        <section className={CARD}>
          <h3 className={CARD_TITLE}>{t('popups.member.attachment')}</h3>
          <dl className="space-y-3">
            <div className="flex items-center gap-2.5 text-sm">
              <Network size={15} className="text-[rgb(var(--color-text-muted))] shrink-0" aria-hidden="true" />
              <dd className="text-[rgb(var(--color-text-secondary))]">
                {managerMember
                  ? <>{ta('member.attachedTo')} <strong className="text-[rgb(var(--color-text-primary))]">{managerMember.userId === currentUserId ? ta('member.you') : managerMember.displayName}</strong></>
                  : ta('member.noManager')}
              </dd>
            </div>
            <div className="flex items-center gap-2.5 text-sm">
              <Users size={15} className="text-[rgb(var(--color-text-muted))] shrink-0" aria-hidden="true" />
              <dd className="text-[rgb(var(--color-text-secondary))]">
                {directs === 0
                  ? ta('member.noDirectReport')
                  : tpa('pyramid.directCount', directs) + (total > directs ? ta('pyramid.totalSuffix', { count: total }) : '')}
              </dd>
            </div>
          </dl>
          {teams.length > 0 && (
            <>
              <h3 className={`${CARD_TITLE} mt-4`}>{ta('member.crossTeams')}</h3>
              <div className="flex flex-wrap gap-1.5">
                {teams.map((team) => (
                  <span
                    key={team.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--color-border))] px-2 py-0.5 text-caption font-medium text-[rgb(var(--color-text-secondary))]"
                  >
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: team.color }} aria-hidden="true" />
                    {team.name}
                  </span>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

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
              <Move size={15} aria-hidden="true" /> {ta('member.move')}
            </button>
          )}
        </div>
      )}
    </>
  );
};
