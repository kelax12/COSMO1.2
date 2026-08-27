import { Suspense, useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { markOrgSeen, useOrgBadges } from '@/lib/hooks/use-org-notifications';
import { LayoutDashboard, Users, FolderKanban, Target, LogOut, Building2, Pencil, Network, Trash2, BarChart3, X, ArrowRightLeft, ListTodo } from 'lucide-react';
import { useAuth } from '@/modules/auth/AuthContext';
import {
  useActiveOrganization,
  useOrgMembers,
  useLeaveOrganization,
  useDeleteOrganization,
  useTransferOwnership,
  useMyOrgPermissions,
  isManagerOf,
} from '@/modules/organizations';
import { ENTERPRISE_BILLING_ENFORCED } from '@/modules/billing/premium-config';
import { useOrgSubscription } from '@/modules/billing/org-billing.hooks';
import { isQuotaReached, effectiveQuota } from '@/modules/billing/org-billing.logic';
import { PageHeading } from '@/components/ui/typography';
import { MobileHeader } from '@/components/mobile';
import OrgNotificationsBell from '@/components/organization/OrgNotificationsBell';
import OrgTabBadge from '@/components/organization/OrgTabBadge';
import MyWorkTab from '@/components/organization/MyWorkTab';
import OrgPlanChip from '@/components/organization/OrgPlanChip';
import { MyWorkSkeleton, TeamTasksSkeleton, TeamOverviewSkeleton, OrgTabSkeleton } from '@/components/organization/OrgLoadingSkeletons';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';

// ── Onglets chargés à la demande ──────────────────────────────────
//
// Tout /entreprise tenait dans UN chunk de 280 ko bruts (64 ko gzip), le 4e du
// build, plus lourd que `vendor-react`. Ouvrir l'Aperçu téléchargeait donc
// aussi la pyramide, le kanban, la frise et les graphiques des statistiques,
// que la plupart des visites n'ouvrent jamais.
//
// `MyWorkTab` reste EAGER : c'est l'onglet par défaut, le rendre paresseux
// remplacerait l'écran d'arrivée par un squelette à chaque ouverture, pour
// n'économiser que ce qu'on va charger dans la seconde.
//
// ⚠️ Second argument à `lazyWithRetry` volontairement vide : les catalogues de
// cette page sont déclarés par sa ROUTE (`App.tsx`, ligne `OrganizationPage`),
// et `lazy-namespaces.guard.test.ts` ne lit que celles-là. Un catalogue demandé
// ici et absent là-bas ne serait garanti par rien.
const PyramidTab = lazyWithRetry(() => import('@/components/organization/PyramidTab'));
const TeamProjectsTab = lazyWithRetry(() => import('@/components/organization/TeamProjectsTab'));
const TeamTasksTab = lazyWithRetry(() => import('@/components/organization/TeamTasksTab'));
const TeamOKRTab = lazyWithRetry(() => import('@/components/organization/TeamOKRTab'));
const TeamOverviewTab = lazyWithRetry(() => import('@/components/organization/TeamOverviewTab'));
const OrgBillingTab = lazyWithRetry(() => import('@/components/organization/OrgBillingTab'));

// Onglet Membres : trois cartes d'invitation, l'annuaire et les équipes. Rendu
// seulement sur cet onglet, donc jamais téléchargé par qui ne l'ouvre pas.
const MemberDirectory = lazyWithRetry(() => import('@/components/organization/MemberDirectory'));
const TeamsSection = lazyWithRetry(() => import('@/components/organization/TeamsSection'));
const InviteFriendsToOrg = lazyWithRetry(() => import('@/components/organization/InviteFriendsToOrg'));
const OrgJoinCodeCard = lazyWithRetry(() => import('@/components/organization/OrgJoinCodeCard'));
const OrgInviteLinkCard = lazyWithRetry(() => import('@/components/organization/OrgInviteLinkCard'));

// Feuilles et dialogues : montés derrière un `&&`, donc déjà conditionnels au
// rendu. Ils ne l'étaient pas au TÉLÉCHARGEMENT.
const OrgProfileSheet = lazyWithRetry(() => import('@/components/organization/OrgProfileSheet'));
const DeleteOrganizationDialog = lazyWithRetry(() => import('@/components/organization/DeleteOrganizationDialog'));
const ConfirmLeaveOrgDialog = lazyWithRetry(() => import('@/components/organization/ConfirmLeaveOrgDialog'));
const TransferOwnershipDialog = lazyWithRetry(() => import('@/components/organization/TransferOwnershipDialog'));

type OrgTab = 'overview' | 'pyramid' | 'tasks' | 'projects' | 'okr' | 'stats' | 'members' | 'billing';

// Libellés = CLÉS : cette constante est évaluée au premier import, y écrire du
// texte figerait les onglets en français pour toute la session.
//
// ⚠️ `billing` n'est PAS un onglet : la facturation ne concerne qu'un seul
// compte sur toute l'organisation, elle ne mérite pas une place permanente dans
// une barre que tout le monde lit. Elle reste une vue (`?tab=billing`, URL de
// retour de Stripe) atteinte depuis la pastille de forfait de l'en-tête.
const TABS: {
  id: OrgTab;
  labelKey: KeyOf<'org'>;
  Icon: typeof Users;
  managerOnly?: boolean;
}[] = [
  { id: 'overview', labelKey: 'tabs.overview', Icon: LayoutDashboard },
  // Réservé à ceux qui encadrent au moins une personne : un membre sans
  // subordonné n'a rien à y arbitrer (même logique que `isManager` plus bas).
  { id: 'pyramid', labelKey: 'tabs.pyramid', Icon: Network, managerOnly: true },
  { id: 'tasks', labelKey: 'tabs.tasks', Icon: ListTodo },
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
// `billing` s'ajoute à la main : il est absent de TABS (aucun onglet) mais
// reste une valeur d'URL valide — les Edge Functions Stripe renvoient sur
// `/entreprise?tab=billing`, l'oublier ferait atterrir un paiement sur l'aperçu.
const TAB_IDS: readonly string[] = [...TABS.map((t) => t.id), 'billing'];

/**
 * Squelette d'attente d'un onglet dont le chunk est encore en vol.
 *
 * Trois onglets ont déjà un squelette dédié pour leur chargement de DONNÉES :
 * on réutilise le même ici, pour que l'attente du CODE et celle de la donnée
 * se ressemblent au lieu de s'enchaîner en deux formes différentes.
 */
const tabFallback = (tab: OrgTab, t: (key: KeyOf<'org'>) => string) => {
  if (tab === 'overview') return <MyWorkSkeleton label={t('myWork.loading')} />;
  if (tab === 'tasks') return <TeamTasksSkeleton label={t('projects.tasksTabLoading')} />;
  if (tab === 'stats') return <TeamOverviewSkeleton label={t('overview.loading')} />;
  return <OrgTabSkeleton label={t('page.tabLoading')} />;
};

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
  const urlTab: OrgTab = rawTab && TAB_IDS.includes(rawTab) ? (rawTab as OrgTab) : 'overview';
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
  // `live` : c'est LA page où l'on attend de voir un membre arriver.
  const { data: members = [], isLoading: membersLoading } = useOrgMembers(myOrg?.id, { live: true });
  // Droits explicites de l'utilisateur courant (mig. 115). Monté ici parce que
  // plusieurs onglets s'en servent — le hook ne déclenche qu'une requête,
  // partagée par React Query avec celles des composants enfants.
  const myPermissions = useMyOrgPermissions(myOrg?.id);
  // Appelé ICI, avant les early returns `isLoading` / `!myOrg` : un hook placé
  // plus bas ne serait pas monté sur tous les rendus.
  const { data: orgSubscription } = useOrgSubscription(myOrg?.id);
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

  const isOwner = user?.id === myOrg.ownerId;
  const isAdmin = myOrg.myRole === 'admin';
  // « Manager » est dérivé de la pyramide : a ≥ 1 subordonné direct (v2).
  const isManager = isAdmin || (user?.id ? isManagerOf(members, user.id) : false);
  // Droits explicites (mig. 115). `isManager` reste la clé des surfaces
  // HIÉRARCHIQUES (onglets Pyramide et Statistiques) : voir l'équipe qu'on
  // encadre n'est pas une permission réglable, c'est une position.
  const canInvite = myPermissions.can['member.invite'];
  // Un membre qui arrive sur `?tab=billing` (lien partagé, ancien favori) ou
  // `?tab=pyramid` (favori d'un ancien manager, ou lien copié) sans en avoir
  // le droit ne voit pas un écran vide : il retombe sur l'aperçu.
  const tab: OrgTab =
    (rawTab === 'billing' && !isOwner) || (urlTab === 'pyramid' && !isManager) ? 'overview' : urlTab;

  // Quota de sièges RÉELLEMENT bloquant : le gate serveur (`org_seats_allowed`,
  // mig. 067) ne refuse que si le drapeau `enterprise_seat_limit` est activé en
  // base. Tant que la facturation est dormante, les portes d'entrée restent
  // ouvertes — mais le jour où le drapeau passe à true, un clic sur « inviter »
  // partirait vers un `seat_limit_reached` sans que rien ne l'ait annoncé.
  //
  // ⚠️ Le seuil est celui de l'ABONNEMENT, jamais `ORG_FREE_SEATS` en dur : une
  // organisation qui a payé le palier « Département » a 20 sièges, et un gate
  // client resté bloqué à 5 rendrait le paiement sans effet visible — on
  // encaisserait sans rien débloquer. `isQuotaReached` porte exactement la même
  // règle que `org_seats_allowed()` (dont le repli sans abonnement actif EST
  // `ORG_FREE_SEATS`), pour que le client annonce ce que le serveur appliquera.
  const seatsQuota = effectiveQuota(orgSubscription ?? null);
  const seatsFull = ENTERPRISE_BILLING_ENFORCED && isQuotaReached(members.length, orgSubscription ?? null);

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
      {/* ── Mobile : en-tête canonique (cf. docs/MOBILE.md) ──
          L'avatar de l'organisation n'y est PAS repris : une vignette de 48 px
          dans une barre qui se compacte à 17 px ne tient pas, et la réduire
          la rendrait illisible. Elle reste dans le bloc desktop. La pastille
          de forfait non plus : elle a déjà sa logique de passage à la ligne
          sur mobile, juste en dessous. */}
      <MobileHeader
        title={myOrg.name}
        subtitle={`${tp('page.memberCount', members.length)}${myOrg.industry ? ` · ${myOrg.industry}` : ''}`}
        actions={
          <>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setEditProfile(true)}
                aria-label={t('page.editProfile')}
                className="min-w-11 min-h-11 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-hover))] transition-colors shrink-0"
              >
                <Pencil size={18} aria-hidden="true" />
              </button>
            )}
            <OrgNotificationsBell orgId={myOrg.id} members={members} />
          </>
        }
      />

      {/* En-tête desktop (rendu historique, inchangé) */}
      <header className="hidden md:flex flex-wrap items-center gap-3 mb-6">
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
        {/* Forfait : visible du seul propriétaire, à côté de la cloche. C'est
            un raccourci, pas un onglet — la facturation ne concerne qu'un
            compte sur toute l'organisation. */}
        {/* Mobile : la pastille passe à la ligne (`basis-full` + `order-last`)
            plutôt que de disputer 122 px au nom de l'organisation, qui tombait
            à 93 px de large sur un écran de 375 px — mesuré, pas supposé. */}
        {isOwner && (
          <div className="order-last basis-full sm:order-none sm:basis-auto">
            <OrgPlanChip
              orgId={myOrg.id}
              active={tab === 'billing'}
              onOpen={() => setTab('billing')}
            />
          </div>
        )}
        {/* Les triggers de la mig. 095 et le job pg_cron de la 096 ecrivaient
            dans `org_notifications` sans qu'aucun ecran ne les lise. */}
        <OrgNotificationsBell orgId={myOrg.id} members={members} />
      </header>

      {/* Forfait sur mobile : le header ci-dessus est masqué sous `md`, la
          pastille y serait donc devenue inatteignable — or c'est le SEUL
          point d'entrée vers la facturation, et seulement pour le
          propriétaire. Elle est reprise ici, en pleine largeur. */}
      {isOwner && (
        <div className="md:hidden mb-4">
          <OrgPlanChip
            orgId={myOrg.id}
            active={tab === 'billing'}
            onOpen={() => setTab('billing')}
          />
        </div>
      )}

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
            className="shrink-0 w-11 h-11 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-surface))] transition-colors"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Bannière freemium — informative tant que ENTERPRISE_BILLING_ENFORCED
          est false (gate dormant ; le vrai blocage sera côté serveur).
          #5 : dismissible (persistant par org) tant qu'elle est informative. */}
      {members.length >= (seatsQuota ?? Infinity) && (ENTERPRISE_BILLING_ENFORCED || !bannerDismissed) && (
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
              className="shrink-0 w-11 h-11 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-surface))] transition-colors"
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
              className={`inline-flex items-center gap-1.5 px-4 min-h-11 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                tab === id
                  ? 'border-[rgb(var(--color-accent))] text-[rgb(var(--color-text-primary))]'
                  : 'border-transparent text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]'
              }`}
            >
              <Icon size={16} aria-hidden="true" /> {t(labelKey)}
              {badge > 0 && (
                <OrgTabBadge
                  count={badge}
                  items={id === 'projects' ? badges.projectItems : badges.memberItems}
                  title={t(id === 'projects' ? 'page.badgePreviewProjects' : 'page.badgePreviewMembers')}
                  ariaLabel={tp('page.badgeCount', badge)}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Contenu */}
      {/* Une seule frontière Suspense pour tout le contenu : les onglets sont
          exclusifs, et le fallback est choisi d'après l'onglet demandé — celui
          de l'onglet Tâches ressemble à sa table, celui des Statistiques à ses
          tuiles. Un fallback générique pour tous aurait fait clignoter une
          forme qui n'est pas celle qui arrive. */}
      <Suspense fallback={tabFallback(tab, t)}>
      {tab === 'overview' && <MyWorkTab orgId={myOrg.id} members={members} currentUserId={user?.id} />}
      {tab === 'stats' && isManager && (
        <TeamOverviewTab orgId={myOrg.id} members={members} isAdmin={isAdmin} currentUserId={user?.id} />
      )}
      {tab === 'pyramid' && isManager && (
        <PyramidTab
          orgId={myOrg.id}
          ownerId={myOrg.ownerId}
          members={members}
          currentUserId={user?.id}
          isAdmin={isAdmin}
          loading={membersLoading}
        />
      )}
      {tab === 'tasks' && (
        <TeamTasksTab orgId={myOrg.id} members={members} currentUserId={user?.id} isManager={isManager} isAdmin={isAdmin} />
      )}
      {tab === 'projects' && (
        <TeamProjectsTab orgId={myOrg.id} members={members} currentUserId={user?.id} isManager={isManager} isAdmin={isAdmin} />
      )}
      {tab === 'okr' && <TeamOKRTab orgId={myOrg.id} />}
      {tab === 'billing' && (
        <OrgBillingTab
          orgId={myOrg.id}
          isOwner={isOwner}
          memberCount={members.length}
          onBack={() => setTab('overview')}
        />
      )}

      {tab === 'members' && (
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
            <OrgJoinCodeCard code={myOrg.joinCode ?? ''} orgId={myOrg.id} isAdmin={isAdmin} seatsFull={seatsFull} />
            {canInvite && <OrgInviteLinkCard orgId={myOrg.id} managerId={user?.id} seatsFull={seatsFull} />}
            {isAdmin && <InviteFriendsToOrg orgId={myOrg.id} variant="card" />}
          </div>

          <TeamsSection
            orgId={myOrg.id}
            members={members}
            currentUserId={user?.id}
            isAdmin={isAdmin}
            canCreateTeam={myPermissions.can['team.create']}
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
      </Suspense>

      {/* Feuilles et dialogues : leur propre frontière, avec un fallback nul.
          Ils s'ouvrent par-dessus l'écran ; y poser un squelette ferait
          clignoter une carte fantôme au milieu de la page pendant que le
          chunk arrive. */}
      <Suspense fallback={null}>
      {editProfile && <OrgProfileSheet org={myOrg} onClose={() => setEditProfile(false)} />}

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
      </Suspense>
    </div>
  );
};

export default OrganizationPage;
