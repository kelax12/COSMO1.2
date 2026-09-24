import { LogOut, Trash2, ArrowRightLeft } from 'lucide-react';
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
  isOwner: boolean;
  isAdmin: boolean;
  canInvite: boolean;
  canCreateTeam: boolean;
  seatsFull: boolean;
  transferPending: boolean;
  deletePending: boolean;
  leavePending: boolean;
  onTransfer: () => void;
  onDelete: () => void;
  onLeave: () => void;
}

const OrgMembersSection = ({
  org,
  members,
  currentUserId,
  isOwner,
  isAdmin,
  canInvite,
  canCreateTeam,
  seatsFull,
  transferPending,
  deletePending,
  leavePending,
  onTransfer,
  onDelete,
  onLeave,
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

      {/* #5 : le PROPRIETAIRE ne « quitte » pas — il peut supprimer
          l'entreprise (confirmation extrême, façon GitHub). Tous les
          autres, admins compris, quittent.

          🔴 C-39 — cette zone etait montee sur `isAdmin`, alors que le
          bouton « Transferer la propriete » juste a cote etait deja
          reserve au proprietaire : la restriction existait, elle n'avait
          pas ete portee sur le geste DESTRUCTEUR. Une entreprise a deux
          admins ; le second, qui ne paie rien, supprimait l'organisation,
          et le proprietaire continuait d'etre debite d'un abonnement
          Stripe qui, lui, court toujours.

          ⚠️ Ce n'est que l'affichage. La regle vit dans
          `delete_organization` (mig. 138), seule porte vers un DELETE sur
          `organizations`. */}
      {isOwner ? (
        <div className="mt-2 rounded-2xl border border-red-300/60 dark:border-red-700/40 bg-red-50/40 dark:bg-red-900/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-red-600 dark:text-red-400">{t('page.dangerZone')}</h3>
            <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">
              {t('page.dangerHint')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            {members.length > 1 && (
              <button
                type="button"
                onClick={onTransfer}
                disabled={transferPending}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-60 transition-colors"
              >
                <ArrowRightLeft size={15} aria-hidden="true" /> {t('page.transferOwnership')}
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              disabled={deletePending}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors"
            >
              <Trash2 size={15} aria-hidden="true" /> {t('page.deleteOrg')}
            </button>
          </div>
        </div>
      ) : (
        <div className="pt-2">
          <button
            type="button"
            onClick={onLeave}
            disabled={leavePending}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-600 transition-colors disabled:opacity-60"
          >
            <LogOut size={15} aria-hidden="true" /> {t('page.leaveOrg')}
          </button>
        </div>
      )}
    </div>
  );
};

export default OrgMembersSection;
