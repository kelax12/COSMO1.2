import type { Organization, OrgMember } from '@/modules/organizations';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { useT } from '@/i18n/useT';

// Section Membres : trois cartes d'invitation, l'annuaire et les équipes. Rendu
// seulement sur cette section, donc jamais téléchargé par qui ne l'ouvre pas.
//
// Sortie d'`OrganizationPage` le 2026-09-24 : la page était passée à 615 lignes
// avec la navigation par routes, au-dessus du budget d'`architecture.guard`.
// La frontière est un DOMAINE, pas une coupe à la ligne : tout ce qui suit ne
// sert que `/entreprise/members`.
//
// ⚠️ Pas de catalogue demandé à `lazyWithRetry` : ceux de l'espace entreprise
// sont déclarés par la ROUTE (`App.tsx`), la seule que lit
// `lazy-namespaces.guard.test.ts`.
const MemberDirectory = lazyWithRetry(() => import('@/components/organization/MemberDirectory'));
const TeamsSection = lazyWithRetry(() => import('@/components/organization/TeamsSection'));
const InviteFriendsToOrg = lazyWithRetry(() => import('@/components/organization/InviteFriendsToOrg'));
const OrgJoinCodeCard = lazyWithRetry(() => import('@/components/organization/OrgJoinCodeCard'));
const OrgInviteLinkCard = lazyWithRetry(() => import('@/components/organization/OrgInviteLinkCard'));

interface OrgMembersSectionProps {
  org: Organization;
  members: OrgMember[];
  currentUserId?: string;
  isAdmin: boolean;
  canInvite: boolean;
  canCreateTeam: boolean;
  seatsFull: boolean;
}

const OrgMembersSection = ({
  org,
  members,
  currentUserId,
  isAdmin,
  canInvite,
  canCreateTeam,
  seatsFull,
}: OrgMembersSectionProps) => {
  const { t } = useT('org');

  return (
    <div className="space-y-6">
      {/* Inviter : par code (validation admin), par lien direct, ou en
          faisant venir ses contacts COSMO — trois moyens côte à côte
          plutôt qu'un troisième bloc qui redescendait toute la page.

          AUD-02 — le lien direct fait entrer quelqu'un SANS validation
          admin. Il n'est donc proposé qu'aux admins et aux managers
          (= au moins un subordonné), exactement comme la policy
          `org_invite_links_insert` de la mig. 084. Sans ce garde, la carte
          restait visible pour tout le monde et un simple membre recevrait
          désormais une erreur 403 au clic.

          Faire venir ses contacts reste réservé aux admins : c'est eux qui
          décident qui entre. `isAdmin` implique `isManager` (dérivé), donc
          3 colonnes ne s'affichent que pour un admin, jamais 2 colonnes +
          un member visible seul en dessous. */}
      <div
        className={`grid gap-4 items-start ${
          isAdmin ? 'md:grid-cols-3' : canInvite ? 'md:grid-cols-2' : ''
        }`}
      >
        <OrgJoinCodeCard code={org.joinCode ?? ''} orgId={org.id} isAdmin={isAdmin} seatsFull={seatsFull} />
        {canInvite && <OrgInviteLinkCard orgId={org.id} managerId={currentUserId} seatsFull={seatsFull} />}
        {isAdmin && <InviteFriendsToOrg orgId={org.id} variant="card" />}
      </div>

      <TeamsSection
        orgId={org.id}
        members={members}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        canCreateTeam={canCreateTeam}
      />

      <div>
        <h2 className="text-sm font-bold text-[rgb(var(--color-text-primary))] mb-3">
          {t('page.directoryTitle', { count: members.length })}
        </h2>
        <MemberDirectory
          orgId={org.id}
          ownerId={org.ownerId}
          members={members}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
        />
      </div>

      {/* Zone dangereuse (transférer, supprimer, quitter) : déplacée dans
          Paramètres le 2026-09-24 (M13), avec ses gardes C-39 intactes. */}
    </div>
  );
};

export default OrgMembersSection;
