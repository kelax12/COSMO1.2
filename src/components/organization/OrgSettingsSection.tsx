import { Suspense, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRightLeft, Building2, Check, ChevronRight, LogOut, Mail, Pencil, Plus, Trash2, Users } from 'lucide-react';
import {
  useActiveOrganization,
  useLeaveOrganization,
  useTransferOwnership,
  type MyOrganization,
  type OrgMember,
} from '@/modules/organizations';
import { useDeleteOrgFlow } from '@/pages/organization/useDeleteOrgFlow';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { buildOrgLink } from './deep-link.helpers';
import OrgPlanChip from './OrgPlanChip';
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
  /** Ouvre la fiche de profil, montée par la page (`OrgProfileSheet`). */
  onEditProfile: () => void;
}

const CARD = 'rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4';
const TITLE = 'text-sm font-bold text-[rgb(var(--color-text-primary))]';
const HINT = 'text-xs text-[rgb(var(--color-text-muted))] mt-0.5';

/**
 * Paramètres de l'organisation, `/entreprise/settings`. Réunit deux audits du
 * 2026-09-24 menés en parallèle : M13 (profil, organisations, forfait et zone
 * de danger au même endroit) et l'audit Membres (« quatre pages en une » :
 * les invitations quittent le haut de l'annuaire).
 *
 * ⚠️ Chaque bloc garde la garde d'affichage qu'il avait à son ancienne place
 * (C-39 : la zone dangereuse est au seul propriétaire). Ce n'est que
 * l'affichage : les règles vivent côté serveur (`delete_organization`, mig. 138).
 */
const OrgSettingsSection = ({
  org,
  members,
  currentUserId,
  isOwner,
  isAdmin,
  isManager,
  canInvite,
  seatsFull,
  onEditProfile,
}: OrgSettingsSectionProps) => {
  const { t } = useT('org');
  const navigate = useNavigate();
  const { organizations, setActiveOrgId } = useActiveOrganization();
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
    <div className="space-y-5 max-w-4xl">
      {/* Profil */}
      <section className={CARD}>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--color-hover))] border border-[rgb(var(--color-border))] flex items-center justify-center shrink-0 overflow-hidden">
            {org.avatarUrl ? (
              <img src={org.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <Building2 size={22} aria-hidden="true" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className={TITLE}>{t('orgSettings.profileTitle')}</h2>
            <p className="text-sm text-[rgb(var(--color-text-primary))] mt-1 truncate">
              {org.name}
              {org.industry ? <span className="text-[rgb(var(--color-text-muted))]"> · {org.industry}</span> : null}
            </p>
            <p className="text-xs text-[rgb(var(--color-text-secondary))] mt-0.5">
              {org.description || t('orgSettings.noDescription')}
            </p>
            {!isAdmin && <p className={HINT}>{t('orgSettings.profileReadOnly')}</p>}
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={onEditProfile}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 min-h-11 rounded-xl text-sm font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
            >
              <Pencil size={14} aria-hidden="true" /> {t('page.editProfile')}
            </button>
          )}
        </div>
      </section>

      {/* Mes organisations : le changement vivait dans la barre latérale de
          l'application, et seulement quand on en avait plusieurs. */}
      <section className={CARD}>
        <h2 className={TITLE}>{t('orgSettings.orgsTitle')}</h2>
        <p className={HINT}>{t('orgSettings.orgsHint')}</p>
        <ul className="mt-3 space-y-1">
          {organizations.map((o) => {
            const current = o.id === org.id;
            return (
              <li key={o.id}>
                <button
                  type="button"
                  disabled={current}
                  onClick={() => { setActiveOrgId(o.id); navigate('/entreprise'); }}
                  className="w-full min-h-11 flex items-center gap-2.5 px-2 rounded-xl text-left hover:bg-[rgb(var(--color-hover))] disabled:hover:bg-transparent transition-colors"
                >
                  <Building2 size={15} aria-hidden="true" className="text-[rgb(var(--color-text-muted))] shrink-0" />
                  <span className="flex-1 min-w-0 truncate text-sm text-[rgb(var(--color-text-primary))]">{o.name}</span>
                  {o.myRole === 'admin' && (
                    <span className="text-caption font-semibold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      {t('common.adminBadge')}
                    </span>
                  )}
                  {current ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <Check size={13} aria-hidden="true" /> {t('orgSettings.current')}
                    </span>
                  ) : (
                    <span className="text-xs text-[rgb(var(--color-accent))]">{t('orgSettings.open')}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <Link
          to="/entreprise/onboarding"
          className="mt-2 inline-flex items-center gap-1.5 px-2 min-h-11 text-sm font-medium text-[rgb(var(--color-accent))] hover:underline"
        >
          <Plus size={14} aria-hidden="true" /> {t('switcher.createOrJoin')}
        </Link>
      </section>

      {/* Forfait : au seul propriétaire, comme la pastille de l'en-tête. */}
      {isOwner && (
        <section className={CARD}>
          <h2 className={TITLE}>{t('orgSettings.planTitle')}</h2>
          <p className={`${HINT} mb-3`}>{t('orgSettings.planHint')}</p>
          <OrgPlanChip orgId={org.id} active={false} onOpen={() => navigate(buildOrgLink('billing'))} />
        </section>
      )}

      {/* Ce qui règle une PERSONNE (droits, place, départ) vit dans
          Personnes, les équipes dans Équipes : on y renvoie. */}
      <section className={CARD}>
        <Link to={buildOrgLink('members')} className="flex items-center gap-3 -m-1 p-1 rounded-xl hover:bg-[rgb(var(--color-hover))] transition-colors">
          <Users size={18} aria-hidden="true" className="text-[rgb(var(--color-text-muted))] shrink-0" />
          <span className="flex-1 min-w-0">
            <span className={`block ${TITLE}`}>{t('orgSettings.membersTitle')}</span>
            <span className={`block ${HINT}`}>{t('orgSettings.membersHint')}</span>
          </span>
          <span className="sr-only">{t('orgSettings.membersLink')}</span>
          <ChevronRight size={16} aria-hidden="true" className="text-[rgb(var(--color-text-muted))] shrink-0" />
        </Link>
      </section>

      <section aria-labelledby="org-invite-title" className="space-y-4 pt-3">
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
