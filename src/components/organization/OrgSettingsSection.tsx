import { Suspense, useState } from 'react';
import { LogOut, Trash2, ArrowRightLeft, Mail } from 'lucide-react';
import {
  useLeaveOrganization,
  useTransferOwnership,
  type MyOrganization,
  type OrgMember,
} from '@/modules/organizations';
import { useDeleteOrgFlow } from '@/pages/organization/useDeleteOrgFlow';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { useT } from '@/i18n/useT';

// Section Paramètres, `/entreprise/settings` (audit Membres du 2026-09-24 :
// « quatre pages en une »). Elle reprend à `/entreprise/members` les
// invitations et la zone de danger, qui n'avaient rien à faire au-dessus d'un
// annuaire de cent personnes.
//
// ⚠️ Pas de catalogue demandé à `lazyWithRetry` : ceux de l'espace entreprise
// sont déclarés par la ROUTE (`App.tsx`), la seule que lit
// `lazy-namespaces.guard.test.ts`.
const InviteFriendsToOrg = lazyWithRetry(() => import('@/components/organization/InviteFriendsToOrg'));
const OrgJoinCodeCard = lazyWithRetry(() => import('@/components/organization/OrgJoinCodeCard'));
const OrgInviteLinkCard = lazyWithRetry(() => import('@/components/organization/OrgInviteLinkCard'));
const EmailInvitationsList = lazyWithRetry(() => import('@/components/organization/EmailInvitationsList'));
const InviteByEmailDialog = lazyWithRetry(() => import('@/components/organization/InviteByEmailDialog'));
const DeleteOrganizationDialog = lazyWithRetry(() => import('@/components/organization/DeleteOrganizationDialog'));
const ConfirmLeaveOrgDialog = lazyWithRetry(() => import('@/components/organization/ConfirmLeaveOrgDialog'));
const TransferOwnershipDialog = lazyWithRetry(() => import('@/components/organization/TransferOwnershipDialog'));

interface OrgSettingsSectionProps {
  org: MyOrganization;
  members: OrgMember[];
  currentUserId?: string;
  isOwner: boolean;
  isAdmin: boolean;
  /** A au moins un subordonné (ou admin) : condition d'une invitation placée. */
  isManager: boolean;
  canInvite: boolean;
  seatsFull: boolean;
}

const OrgSettingsSection = ({
  org,
  members,
  currentUserId,
  isOwner,
  isAdmin,
  isManager,
  canInvite,
  seatsFull,
}: OrgSettingsSectionProps) => {
  const { t } = useT('org');
  const [invitingByEmail, setInvitingByEmail] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const leaveMutation = useLeaveOrganization();
  const transferMutation = useTransferOwnership();
  // C-39 — « la suppression resilie ET REMBOURSE » (arbitrage du 2026-09-03) :
  // un seul geste, aucun debit orphelin. L'enchainement et son ordre vivent
  // dans `useDeleteOrgFlow`, avec la raison de cet ordre.
  const deleteFlow = useDeleteOrgFlow(() => setConfirmingDelete(false));

  // Miroir de `create_org_email_invitations` (mig. 161) : un admin, ou un
  // manager qui a le droit `member.invite` (il place alors sous lui-même).
  const canInviteByEmail = isAdmin || (canInvite && isManager);

  return (
    <div className="space-y-8">
      <section aria-labelledby="org-invite-title" className="space-y-4">
        <div>
          <h2 id="org-invite-title" className="text-sm font-bold text-[rgb(var(--color-text-primary))]">
            {t('settings.inviteTitle')}
          </h2>
          <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">{t('settings.inviteHint')}</p>
        </div>

        {/* M11 : l'invitation par e-mail est le canal par défaut d'une
            entreprise. Le lien est NOMINATIF, déjà placé dans la pyramide et
            dans des équipes. */}
        {canInviteByEmail && (
          <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{t('invites.emailTitle')}</h3>
                <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">{t('invites.emailIntro')}</p>
              </div>
              <button
                type="button"
                onClick={() => setInvitingByEmail(true)}
                disabled={seatsFull}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] disabled:opacity-60 shrink-0"
              >
                <Mail size={15} aria-hidden="true" /> {t('settings.inviteByEmail')}
              </button>
            </div>
            <Suspense fallback={null}>
              <EmailInvitationsList orgId={org.id} />
            </Suspense>
          </div>
        )}

        {/* Par code (validation admin), par lien direct, ou en faisant venir
            ses contacts COSMO.

            AUD-02 — le lien direct fait entrer quelqu'un SANS validation
            admin. Il n'est donc proposé qu'à qui a le droit `member.invite`,
            exactement comme la policy `org_invite_links_insert` (mig. 084).

            Faire venir ses contacts reste réservé aux admins : c'est eux qui
            décident qui entre. */}
        <Suspense fallback={null}>
          <div
            className={`grid gap-4 items-start ${
              isAdmin ? 'md:grid-cols-3' : canInvite ? 'md:grid-cols-2' : ''
            }`}
          >
            <OrgJoinCodeCard code={org.joinCode ?? ''} orgId={org.id} isAdmin={isAdmin} seatsFull={seatsFull} />
            {canInvite && <OrgInviteLinkCard orgId={org.id} managerId={currentUserId} seatsFull={seatsFull} />}
            {isAdmin && <InviteFriendsToOrg orgId={org.id} variant="card" />}
          </div>
        </Suspense>
      </section>

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
      <section aria-labelledby="org-danger-title">
        {isOwner ? (
          <div className="rounded-2xl border border-red-300/60 dark:border-red-700/40 bg-red-50/40 dark:bg-red-900/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 id="org-danger-title" className="text-sm font-bold text-red-600 dark:text-red-400">{t('page.dangerZone')}</h2>
              <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">
                {t('page.dangerHint')}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              {members.length > 1 && (
                <button
                  type="button"
                  onClick={() => setTransferring(true)}
                  disabled={transferMutation.isPending}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-60 transition-colors"
                >
                  <ArrowRightLeft size={15} aria-hidden="true" /> {t('page.transferOwnership')}
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={deleteFlow.isPending}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                <Trash2 size={15} aria-hidden="true" /> {t('page.deleteOrg')}
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-[rgb(var(--color-border))] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 id="org-danger-title" className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{t('settings.leaveTitle')}</h2>
            <button
              type="button"
              onClick={() => setConfirmingLeave(true)}
              disabled={leaveMutation.isPending}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-600 transition-colors disabled:opacity-60"
            >
              <LogOut size={15} aria-hidden="true" /> {t('page.leaveOrg')}
            </button>
          </div>
        )}
      </section>

      {/* Dialogues : leur propre frontière, fallback nul (ils s'ouvrent par-dessus). */}
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

        {transferring && (
          <TransferOwnershipDialog
            orgName={org.name}
            candidates={members.filter((m) => m.userId !== org.ownerId)}
            pending={transferMutation.isPending}
            onConfirm={(newOwnerId) =>
              transferMutation.mutate(
                { orgId: org.id, newOwnerId },
                { onSuccess: () => setTransferring(false) },
              )
            }
            onCancel={() => setTransferring(false)}
          />
        )}

        {confirmingLeave && (
          <ConfirmLeaveOrgDialog
            orgName={org.name}
            pending={leaveMutation.isPending}
            onConfirm={() =>
              leaveMutation.mutate(org.id, { onSettled: () => setConfirmingLeave(false) })
            }
            onCancel={() => setConfirmingLeave(false)}
          />
        )}

        {confirmingDelete && (
          <DeleteOrganizationDialog
            org={org}
            memberCount={members.length}
            pending={deleteFlow.isPending}
            onConfirm={() => deleteFlow.run(org.id)}
            onCancel={() => setConfirmingDelete(false)}
          />
        )}
      </Suspense>
    </div>
  );
};

export default OrgSettingsSection;
