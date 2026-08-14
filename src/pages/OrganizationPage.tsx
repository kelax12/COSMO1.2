import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { markOrgSeen, useOrgBadges } from '@/lib/hooks/use-org-notifications';
import { LayoutDashboard, Users, FolderKanban, Target, LogOut, Building2, Pencil, Network, Trash2, BarChart3, X, ArrowRightLeft } from 'lucide-react';
import { useAuth } from '@/modules/auth/AuthContext';
import {
  useActiveOrganization,
  useOrgMembers,
  useLeaveOrganization,
  useDeleteOrganization,
  useTransferOwnership,
  isManagerOf,
} from '@/modules/organizations';
import { ENTERPRISE_BILLING_ENFORCED, ORG_FREE_SEATS } from '@/modules/billing/premium-config';
import { PageHeading } from '@/components/ui/typography';
import MemberDirectory from '@/components/organization/MemberDirectory';
import OrgJoinCodeCard from '@/components/organization/OrgJoinCodeCard';
import OrgInviteLinkCard from '@/components/organization/OrgInviteLinkCard';
import OrgProfileSheet from '@/components/organization/OrgProfileSheet';
import DeleteOrganizationDialog from '@/components/organization/DeleteOrganizationDialog';
import PyramidTab from '@/components/organization/PyramidTab';
import TeamProjectsTab from '@/components/organization/TeamProjectsTab';
import TeamsSection from '@/components/organization/TeamsSection';
import TeamOKRTab from '@/components/organization/TeamOKRTab';
import TeamOverviewTab from '@/components/organization/TeamOverviewTab';
import OrgNotificationsBell from '@/components/organization/OrgNotificationsBell';
import MyWorkTab from '@/components/organization/MyWorkTab';
import ConfirmLeaveOrgDialog from '@/components/organization/ConfirmLeaveOrgDialog';
import TransferOwnershipDialog from '@/components/organization/TransferOwnershipDialog';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';

type OrgTab = 'overview' | 'pyramid' | 'projects' | 'okr' | 'stats' | 'members';

// Libellés = CLÉS : cette constante est évaluée au premier import, y écrire du
// texte figerait les onglets en français pour toute la session.
const TABS: { id: OrgTab; labelKey: KeyOf<'org'>; Icon: typeof Users; managerOnly?: boolean }[] = [
  { id: 'overview', labelKey: 'tabs.overview', Icon: LayoutDashboard },
  { id: 'pyramid', labelKey: 'tabs.pyramid', Icon: Network },
  { id: 'projects', labelKey: 'tabs.projects', Icon: FolderKanban },
  { id: 'okr', labelKey: 'tabs.okr', Icon: Target },
  // #13 : statistiques collectives — admin (toute l'org) / manager (son périmètre).
  { id: 'stats', labelKey: 'tabs.stats', Icon: BarChart3, managerOnly: true },
  { id: 'members', labelKey: 'tabs.members', Icon: Users },
];

/**
 * Espace entreprise — onglets Aperçu / Projets / OKR / Membres (state local,
 * routing plat cohérent avec l'app). Réservé aux membres d'une organisation :
 * un non-membre est redirigé vers le dashboard.
 */
const TAB_IDS: readonly string[] = TABS.map((t) => t.id);

/** Bannière sièges : dismiss persistant par org (informative, freemium dormant). */
const seatsBannerKey = (orgId: string) => `cosmo_org_seats_banner_dismissed_${orgId}`;

/** Bannière lancement « gratuit jusqu'au 1er août » : dismiss persistant par org. */
const launchBannerKey = (orgId: string) => `cosmo_org_launch_banner_dismissed_${orgId}`;
const LAUNCH_FREE_UNTIL = new Date('2026-08-01T00:00:00');

const OrganizationPage = () => {
  const { t, tp } = useT('org');
  const { user } = useAuth();
  // #1 — onglet actif dans l'URL (?tab=okr) : survit au refresh et se partage.
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const tab: OrgTab = rawTab && TAB_IDS.includes(rawTab) ? (rawTab as OrgTab) : 'overview';
  const setTab = (id: OrgTab) =>
    setSearchParams(id === 'overview' ? {} : { tab: id }, { replace: true });
  const [editProfile, setEditProfile] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [seatsBannerDismissed, setSeatsBannerDismissed] = useState(false);
  const [launchBannerDismissed, setLaunchBannerDismissed] = useState(false);
  const { activeOrg: myOrg, isLoading } = useActiveOrganization();
  const badges = useOrgBadges();

  // Badge nav (reco #7) : on marque « vu » en QUITTANT la page, pas en y
  // arrivant. Marquer au montage remettait `lastSeen` à `now` avant le premier
  // rendu, donc les badges d'onglet (Projets / Membres) naissaient toujours à
  // zéro et la fonctionnalité était morte sans jamais échouer.
  useEffect(() => {
    const orgId = myOrg?.id;
    if (!orgId) return;
    return () => markOrgSeen(orgId);
  }, [myOrg?.id]);
  const { data: members = [], isLoading: membersLoading } = useOrgMembers(myOrg?.id);
  const leaveMutation = useLeaveOrganization();
  const deleteMutation = useDeleteOrganization();
  const transferMutation = useTransferOwnership();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[rgb(var(--color-accent))]" />
      </div>
    );
  }

  // Non-membre : pas d'espace entreprise → dashboard.
  if (!myOrg) return <Navigate to="/dashboard" replace />;

  const isAdmin = myOrg.myRole === 'admin';
  // « Manager » est dérivé de la pyramide : a ≥ 1 subordonné direct (v2).
  const isManager = isAdmin || (user?.id ? isManagerOf(members, user.id) : false);

  // Quota de sièges RÉELLEMENT bloquant : le gate serveur (`org_seats_allowed`,
  // mig. 067) ne refuse que si le drapeau `enterprise_seat_limit` est activé en
  // base. Tant que la facturation est dormante, les portes d'entrée restent
  // ouvertes — mais le jour où le drapeau passe à true, un clic sur « inviter »
  // partirait vers un `seat_limit_reached` sans que rien ne l'ait annoncé.
  const seatsFull = ENTERPRISE_BILLING_ENFORCED && members.length >= ORG_FREE_SEATS;

  let bannerDismissed = seatsBannerDismissed;
  try {
    bannerDismissed = bannerDismissed || !!localStorage.getItem(seatsBannerKey(myOrg.id));
  } catch { /* localStorage indisponible : bannière visible */ }

  const dismissSeatsBanner = () => {
    setSeatsBannerDismissed(true);
    try { localStorage.setItem(seatsBannerKey(myOrg.id), '1'); } catch { /* no-op */ }
  };

  let launchDismissed = launchBannerDismissed;
  try {
    launchDismissed = launchDismissed || !!localStorage.getItem(launchBannerKey(myOrg.id));
  } catch { /* localStorage indisponible : bannière visible */ }

  const dismissLaunchBanner = () => {
    setLaunchBannerDismissed(true);
    try { localStorage.setItem(launchBannerKey(myOrg.id), '1'); } catch { /* no-op */ }
  };

  const showLaunchBanner = !launchDismissed && Date.now() < LAUNCH_FREE_UNTIL.getTime();

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
      {/* En-tête */}
      <header className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--color-hover))] border border-[rgb(var(--color-border))] flex items-center justify-center text-[rgb(var(--color-text-primary))] shrink-0 overflow-hidden">
          {myOrg.avatarUrl ? (
            <img src={myOrg.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Building2 size={24} aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <PageHeading variant="compact" className="truncate">{myOrg.name}</PageHeading>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setEditProfile(true)}
                aria-label={t('page.editProfile')}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-hover))] transition-colors shrink-0"
              >
                <Pencil size={14} aria-hidden="true" />
              </button>
            )}
          </div>
          <p className="text-sm text-[rgb(var(--color-text-muted))] truncate">
            {tp('page.memberCount', members.length)}
            {myOrg.industry ? ` · ${myOrg.industry}` : ''}
          </p>
          {myOrg.description && (
            <p className="text-xs text-[rgb(var(--color-text-secondary))] mt-0.5 line-clamp-1">{myOrg.description}</p>
          )}
        </div>
        {/* Les triggers de la mig. 095 et le job pg_cron de la 096 ecrivaient
            dans `org_notifications` sans qu'aucun ecran ne les lise. */}
        <OrgNotificationsBell orgId={myOrg.id} members={members} />
      </header>

      {editProfile && <OrgProfileSheet org={myOrg} onClose={() => setEditProfile(false)} />}

      {/* Bannière lancement — gratuit pour tout le monde jusqu'au 1er août,
          quel que soit le nombre de membres. Se masque d'elle-même après
          cette date (et reste dismissible avant). */}
      {showLaunchBanner && (
        <div className="mb-5 rounded-2xl border border-[rgb(var(--color-accent)/0.3)] bg-[rgb(var(--color-accent)/0.08)] px-4 py-3 flex items-start justify-between gap-3">
          <p className="text-xs text-[rgb(var(--color-text-secondary))]">
            <span className="font-semibold text-[rgb(var(--color-text-primary))]">{t('page.launchFree')}</span>
            {t('page.launchFreeRest')}
          </p>
          <button
            type="button"
            onClick={dismissLaunchBanner}
            aria-label={t('page.hideInfo')}
            className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-surface))] transition-colors"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Bannière freemium — informative tant que ENTERPRISE_BILLING_ENFORCED
          est false (gate dormant ; le vrai blocage sera côté serveur).
          #5 : dismissible (persistant par org) tant qu'elle est informative. */}
      {members.length >= ORG_FREE_SEATS && (ENTERPRISE_BILLING_ENFORCED || !bannerDismissed) && (
        <div className="mb-5 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))] px-4 py-3 flex items-start justify-between gap-3">
          <p className="text-xs text-[rgb(var(--color-text-secondary))]">
            <span className="font-semibold text-[rgb(var(--color-text-primary))]">{tp('page.memberCountDot', members.length)}</span>{' '}
            {ENTERPRISE_BILLING_ENFORCED
              ? t('page.freemiumOver')
              : t('page.freemiumInfo')}
          </p>
          {!ENTERPRISE_BILLING_ENFORCED && (
            <button
              type="button"
              onClick={dismissSeatsBanner}
              aria-label={t('page.hideInfo')}
              className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-surface))] transition-colors"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {/* Onglets */}
      <div className="flex gap-1 border-b border-[rgb(var(--color-border))] mb-6 pb-0.5 overflow-x-auto hide-scrollbar">
        {TABS.filter((tab) => !tab.managerOnly || isManager).map(({ id, labelKey, Icon }) => {
          // Seuls Projets (tâches nouvellement assignées) et Membres (demandes
          // d'adhésion en attente) portent un compteur.
          const badge = id === 'projects' ? badges.projects : id === 'members' ? badges.members : 0;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={tab === id ? 'page' : undefined}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                tab === id
                  ? 'border-[rgb(var(--color-accent))] text-[rgb(var(--color-text-primary))]'
                  : 'border-transparent text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]'
              }`}
            >
              <Icon size={16} aria-hidden="true" /> {t(labelKey)}
              {badge > 0 && (
                <span
                  className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] text-caption font-bold inline-flex items-center justify-center"
                  aria-label={tp('page.badgeCount', badge)}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Contenu */}
      {tab === 'overview' && <MyWorkTab orgId={myOrg.id} members={members} currentUserId={user?.id} />}
      {tab === 'stats' && isManager && (
        <TeamOverviewTab orgId={myOrg.id} members={members} isAdmin={isAdmin} currentUserId={user?.id} />
      )}
      {tab === 'pyramid' && (
        <PyramidTab
          orgId={myOrg.id}
          ownerId={myOrg.ownerId}
          members={members}
          currentUserId={user?.id}
          isAdmin={isAdmin}
          loading={membersLoading}
        />
      )}
      {tab === 'projects' && (
        <TeamProjectsTab orgId={myOrg.id} members={members} currentUserId={user?.id} isManager={isManager} isAdmin={isAdmin} />
      )}
      {tab === 'okr' && <TeamOKRTab orgId={myOrg.id} isManager={isManager} />}

      {tab === 'members' && (
        <div className="space-y-6">
          {/* Inviter : par code (validation admin) ou par lien direct — deux
              moyens côte à côte pour ne plus occuper toute la largeur.

              AUD-02 — le lien direct fait entrer quelqu'un SANS validation
              admin. Il n'est donc proposé qu'aux admins et aux managers
              (= au moins un subordonné), exactement comme la policy
              `org_invite_links_insert` de la mig. 084. Sans ce garde, la carte
              restait visible pour tout le monde et un simple membre recevrait
              désormais une erreur 403 au clic. */}
          <div className={`grid gap-4 items-start ${isManager ? 'md:grid-cols-2' : ''}`}>
            <OrgJoinCodeCard code={myOrg.joinCode ?? ''} orgId={myOrg.id} isAdmin={isAdmin} seatsFull={seatsFull} />
            {isManager && <OrgInviteLinkCard orgId={myOrg.id} managerId={user?.id} seatsFull={seatsFull} />}
          </div>

          <TeamsSection
            orgId={myOrg.id}
            members={members}
            currentUserId={user?.id}
            isAdmin={isAdmin}
            isManager={isManager}
          />

          <div>
            <h2 className="text-sm font-bold text-[rgb(var(--color-text-primary))] mb-3">
              {t('page.directoryTitle', { count: members.length })}
            </h2>
            <MemberDirectory
              orgId={myOrg.id}
              ownerId={myOrg.ownerId}
              members={members}
              currentUserId={user?.id}
              isAdmin={isAdmin}
            />
          </div>

          {/* #5 : un admin ne « quitte » pas — il peut supprimer l'entreprise
              (confirmation extrême, façon GitHub). Les autres membres quittent. */}
          {isAdmin ? (
            <div className="mt-2 rounded-2xl border border-red-300/60 dark:border-red-700/40 bg-red-50/40 dark:bg-red-900/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-red-600 dark:text-red-400">{t('page.dangerZone')}</h3>
                <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">
                  {t('page.dangerHint')}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                {user?.id === myOrg.ownerId && members.length > 1 && (
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
                  disabled={deleteMutation.isPending}
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
                onClick={() => setConfirmingLeave(true)}
                disabled={leaveMutation.isPending}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-600 transition-colors disabled:opacity-60"
              >
                <LogOut size={15} aria-hidden="true" /> {t('page.leaveOrg')}
              </button>
            </div>
          )}
        </div>
      )}

      {transferring && (
        <TransferOwnershipDialog
          orgName={myOrg.name}
          candidates={members.filter((m) => m.userId !== myOrg.ownerId)}
          pending={transferMutation.isPending}
          onConfirm={(newOwnerId) =>
            transferMutation.mutate(
              { orgId: myOrg.id, newOwnerId },
              { onSuccess: () => setTransferring(false) },
            )
          }
          onCancel={() => setTransferring(false)}
        />
      )}

      {confirmingLeave && (
        <ConfirmLeaveOrgDialog
          orgName={myOrg.name}
          pending={leaveMutation.isPending}
          onConfirm={() =>
            leaveMutation.mutate(myOrg.id, { onSettled: () => setConfirmingLeave(false) })
          }
          onCancel={() => setConfirmingLeave(false)}
        />
      )}

      {confirmingDelete && (
        <DeleteOrganizationDialog
          org={myOrg}
          memberCount={members.length}
          pending={deleteMutation.isPending}
          onConfirm={() =>
            deleteMutation.mutate(myOrg.id, { onSuccess: () => setConfirmingDelete(false) })
          }
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
};

export default OrganizationPage;
