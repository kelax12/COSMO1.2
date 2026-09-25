// Fiche membre ouverte par `?member=` hors Pyramide et Membres (`OrgDeepLinkHost`).
// Chargée à la demande : seul qui suit un lien de membre la paie.

import { useEffect, useMemo } from 'react';
import { subtreeOf, type OrgMember } from '@/modules/organizations';
import { useOrgTeamMembers, useOrgTeams } from '@/modules/org-teams';
import MemberSheet from './MemberSheet';

interface DeepMemberSheetProps {
  orgId: string;
  memberId: string;
  tab: string | null;
  members: OrgMember[];
  currentUserId?: string;
  isAdmin: boolean;
  onClose: () => void;
}

/**
 * La fiche membre nommée par `?member=`, hors Pyramide et Membres. Mêmes
 * droits que l'annuaire : insights et agenda pour un supérieur, jamais de
 * déplacement (la hiérarchie ne se modifie que dans la pyramide).
 */
const DeepMemberSheet = ({ orgId, memberId, tab, members, currentUserId, isAdmin, onClose }: DeepMemberSheetProps) => {
  const { data: teams = [] } = useOrgTeams(orgId);
  const { data: memberships = [] } = useOrgTeamMembers(orgId);
  const member = members.find((m) => m.userId === memberId);
  const mySubtree = useMemo(
    () => (currentUserId ? subtreeOf(members, currentUserId) : new Set<string>()),
    [members, currentUserId],
  );
  const memberTeams = useMemo(() => {
    const ids = new Set(memberships.filter((tm) => tm.userId === memberId).map((tm) => tm.teamId));
    return teams.filter((team) => ids.has(team.id));
  }, [teams, memberships, memberId]);

  const missing = members.length > 0 && !member;
  useEffect(() => {
    if (missing) onClose();
  }, [missing, onClose]);

  if (!member) return null;
  const above = member.userId !== currentUserId && (isAdmin || mySubtree.has(member.userId));

  return (
    <MemberSheet
      orgId={orgId}
      member={member}
      members={members}
      teams={memberTeams}
      currentUserId={currentUserId}
      canMove={false}
      canAddUnder={false}
      canSeeInsights={above}
      canSeeAgenda={above}
      initialTab={tab}
      onClose={onClose}
      onMove={() => {}}
      onAddUnder={() => {}}
    />
  );
};

export default DeepMemberSheet;
