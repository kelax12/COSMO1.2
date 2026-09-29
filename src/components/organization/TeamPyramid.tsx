import { useMemo } from 'react';
import { Link } from 'react-router';
import { Network } from 'lucide-react';
import type { OrgMember } from '@/modules/organizations';
import type { OrgTeamMember } from '@/modules/org-teams';
import MemberAvatar from './MemberAvatar';
import { buildOrgLink } from './deep-link.helpers';
import { buildTeamPyramid, type TeamPyramidNode } from './team-pyramid.helpers';
import { useT } from '@/i18n/useT';

interface TeamPyramidProps {
  members: OrgMember[];
  memberships: OrgTeamMember[];
  color: string;
}

const Node = ({ node, color, leadLabel }: { node: TeamPyramidNode; color: string; leadLabel: string }) => (
  <li className="flex flex-col items-center">
    <Link
      to={buildOrgLink('members', { member: node.member.userId })}
      className="flex flex-col items-center gap-1 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-2 min-w-[6.5rem] max-w-[9rem] hover:bg-[rgb(var(--color-hover))] transition-colors"
      style={node.isLead ? { borderColor: color } : undefined}
    >
      <MemberAvatar avatar={node.member.avatar} name={node.member.displayName} size={28} />
      <span className="text-xs font-semibold text-[rgb(var(--color-text-primary))] truncate max-w-full">{node.member.displayName}</span>
      {node.isLead && <span className="text-caption font-medium" style={{ color }}>{leadLabel}</span>}
    </Link>
    {node.children.length > 0 && (
      <>
        <span aria-hidden="true" className="w-px h-4 bg-[rgb(var(--color-border))]" />
        <ul className="flex gap-3 justify-center border-t border-[rgb(var(--color-border))] pt-4">
          {node.children.map((c) => <Node key={c.member.userId} node={c} color={color} leadLabel={leadLabel} />)}
        </ul>
      </>
    )}
  </li>
);

/**
 * Pyramide d'une équipe (reco UI n° 22) : la hiérarchie de l'organisation
 * restreinte aux membres de l'équipe. Chaque carte ouvre la fiche du membre.
 */
const TeamPyramid = ({ members, memberships, color }: TeamPyramidProps) => {
  const { t } = useT('orgAdmin');
  const tree = useMemo(
    () => buildTeamPyramid(
      members,
      new Set(memberships.map((m) => m.userId)),
      new Set(memberships.filter((m) => m.isLead).map((m) => m.userId)),
    ),
    [members, memberships],
  );

  if (tree.length === 0) return null;
  return (
    <section
      aria-labelledby="team-pyramid-title"
      className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-5"
    >
      <h3 id="team-pyramid-title" className="flex items-center gap-2 text-base font-bold text-[rgb(var(--color-text-primary))]">
        <Network size={16} aria-hidden="true" /> {t('ui.pyramidTitle')}
      </h3>
      <p className="mt-0.5 mb-4 text-xs text-[rgb(var(--color-text-muted))]">{t('ui.pyramidHelp')}</p>
      <div className="overflow-x-auto pb-1">
        <ul className="flex gap-6 justify-center min-w-max mx-auto">
          {tree.map((n) => <Node key={n.member.userId} node={n} color={color} leadLabel={t('ui.pyramidLead')} />)}
        </ul>
      </div>
    </section>
  );
};

export default TeamPyramid;
