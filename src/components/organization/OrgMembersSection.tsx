import { Suspense, useState } from 'react';
import { UserPlus } from 'lucide-react';
import type { Organization, OrgMember } from '@/modules/organizations';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { useT } from '@/i18n/useT';

// Section Personnes, `/entreprise/members`. Rendue seulement sur cette
// section, donc jamais téléchargée par qui ne l'ouvre pas.
//
// Audit Membres du 2026-09-24 : elle tenait « quatre pages en une »
// (invitations, équipes, annuaire, zone de danger), et à vingt équipes
// l'annuaire était enterré. Elle ne garde que l'annuaire ; les équipes vivent
// sur `/entreprise/teams`, invitations et zone de danger sur
// `/entreprise/settings`. L'adresse `members` est conservée : des liens
// (`?member=`) et des e-mails déjà envoyés y pointent.
//
// ⚠️ Pas de catalogue demandé à `lazyWithRetry` : ceux de l'espace entreprise
// sont déclarés par la ROUTE (`App.tsx`), la seule que lit
// `lazy-namespaces.guard.test.ts`.
const MemberDirectory = lazyWithRetry(() => import('@/components/organization/MemberDirectory'));
const InviteByEmailDialog = lazyWithRetry(() => import('@/components/organization/InviteByEmailDialog'));
const InviteModeDialog = lazyWithRetry(() => import('@/components/organization/InviteModeDialog'));

interface OrgMembersSectionProps {
  org: Organization;
  members: OrgMember[];
  currentUserId?: string;
  isAdmin: boolean;
  /** A au moins un subordonné (ou admin). */
  isManager: boolean;
  canInvite: boolean;
  seatsFull: boolean;
}

const OrgMembersSection = ({ org, members, currentUserId, isAdmin, isManager, canInvite, seatsFull }: OrgMembersSectionProps) => {
  const { t } = useT('org');
  const [choosingMode, setChoosingMode] = useState(false);
  const [invitingByEmail, setInvitingByEmail] = useState(false);
  // Miroir de `create_org_email_invitations` (mig. 161).
  const canInviteByEmail = isAdmin || (canInvite && isManager);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-[rgb(var(--color-text-primary))]">
          {t('page.directoryTitle', { count: members.length })}
        </h2>
        {/* Un seul bouton : la modale demande le canal (e-mail, ou code,
            lien direct et contacts COSMO qui vivent dans Paramètres). */}
        <button
          type="button"
          onClick={() => setChoosingMode(true)}
          className="inline-flex items-center gap-1.5 min-h-9 px-3 rounded-xl text-sm font-semibold bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] hover:bg-[rgb(var(--color-accent-solid-hover))]"
        >
          <UserPlus size={14} aria-hidden="true" /> {t('settings.inviteTitle')}
        </button>
      </div>

      <MemberDirectory
        orgId={org.id}
        ownerId={org.ownerId}
        members={members}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
      />

      <Suspense fallback={null}>
        {choosingMode && (
          <InviteModeDialog
            onChooseEmail={canInviteByEmail ? () => { setChoosingMode(false); setInvitingByEmail(true); } : undefined}
            emailDisabled={seatsFull}
            onClose={() => setChoosingMode(false)}
          />
        )}
        {invitingByEmail && (
          <InviteByEmailDialog
            orgId={org.id}
            members={members}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            onClose={() => setInvitingByEmail(false)}
          />
        )}
      </Suspense>
    </div>
  );
};

export default OrgMembersSection;
