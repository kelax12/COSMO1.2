import { Suspense, useState } from 'react';
import { UserPlus } from 'lucide-react';
import type { Organization, OrgMember } from '@/modules/organizations';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { useT } from '@/i18n/useT';
import PendingInvitesStrip from './PendingInvitesStrip';

// Section Membres, `/entreprise/members`. Rendue seulement sur cette
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
  const [quickEmails, setQuickEmails] = useState('');
  // Miroir de `create_org_email_invitations` (mig. 161).
  const canInviteByEmail = isAdmin || (canInvite && isManager);

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold text-[rgb(var(--color-text-primary))]">
        {t('page.directoryTitle', { count: members.length })}
      </h2>

      {canInviteByEmail && <PendingInvitesStrip orgId={org.id} />}

      <MemberDirectory
        orgId={org.id}
        ownerId={org.ownerId}
        members={members}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
        inviteAction={
          // Un seul bouton : la modale montre les quatre canaux en onglets.
          <button
            type="button"
            onClick={() => setChoosingMode(true)}
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl text-sm font-semibold whitespace-nowrap bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] hover:bg-[rgb(var(--color-accent-solid-hover))]"
          >
            <UserPlus size={14} aria-hidden="true" /> {t('settings.inviteTitle')}
          </button>
        }
      />

      <Suspense fallback={null}>
        {choosingMode && (
          <InviteModeDialog
            org={org}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            canInvite={canInvite}
            seatsFull={seatsFull}
            onChooseEmail={canInviteByEmail ? (emails) => { setQuickEmails(emails); setChoosingMode(false); setInvitingByEmail(true); } : undefined}
            onClose={() => setChoosingMode(false)}
          />
        )}
        {invitingByEmail && (
          <InviteByEmailDialog
            orgId={org.id}
            members={members}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            initialEmails={quickEmails}
            onClose={() => setInvitingByEmail(false)}
          />
        )}
      </Suspense>
    </div>
  );
};

export default OrgMembersSection;
