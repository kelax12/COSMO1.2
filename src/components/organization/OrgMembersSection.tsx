import { Suspense, useState } from 'react';
import { Link } from 'react-router';
import { Mail, UserPlus } from 'lucide-react';
import type { Organization, OrgMember } from '@/modules/organizations';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { orgSectionPath } from './deep-link.helpers';
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
  const [invitingByEmail, setInvitingByEmail] = useState(false);
  // Miroir de `create_org_email_invitations` (mig. 161).
  const canInviteByEmail = isAdmin || (canInvite && isManager);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-[rgb(var(--color-text-primary))]">
          {t('page.directoryTitle', { count: members.length })}
        </h2>
        <div className="flex items-center gap-2">
          {canInviteByEmail && (
            <button
              type="button"
              onClick={() => setInvitingByEmail(true)}
              disabled={seatsFull}
              className="inline-flex items-center gap-1.5 min-h-9 px-3 rounded-xl text-sm font-semibold bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] disabled:opacity-60"
            >
              <Mail size={14} aria-hidden="true" /> {t('settings.inviteByEmail')}
            </button>
          )}
          {/* Code, lien direct, contacts COSMO et invitations en attente :
              tout vit dans Paramètres. Un lien pour tous, puisque le code
              d'adhésion y est lisible par chaque membre. */}
          <Link
            to={orgSectionPath('settings')}
            className="inline-flex items-center gap-1.5 min-h-9 px-3 rounded-xl text-sm font-medium border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]"
          >
            <UserPlus size={14} aria-hidden="true" /> {t('settings.otherInvites')}
          </Link>
        </div>
      </div>

      <MemberDirectory
        orgId={org.id}
        ownerId={org.ownerId}
        members={members}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
      />

      <Suspense fallback={null}>
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
