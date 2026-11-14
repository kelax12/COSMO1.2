import { Suspense, useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { markOrgSeen, useOrgBadges } from '@/lib/hooks/use-org-notifications';
import { Building2, Pencil } from 'lucide-react';
import { useOrgShortcuts } from '@/components/organization/org-page.hooks';
import { useAuth } from '@/modules/auth/AuthContext';
import {
  useActiveOrganization,
  useOrgMembers,
  useMyOrgPermissions,
  useOrgNotifications,
  useOrgRoles,
} from '@/modules/organizations';
import { ENTERPRISE_BILLING_ENFORCED } from '@/modules/billing/premium-config';
import { useOrgSubscription } from '@/modules/billing/org-billing.hooks';
import { isQuotaReached, effectiveQuota, needsPaymentAttention, isOverQuota, membersOverQuota, sectionOpenWhileOverQuota } from '@/modules/billing/org-billing.logic';
import { PageHeading } from '@/components/ui/typography';
import { MobileHeader } from '@/components/mobile';
import OrgNotificationsBell from '@/components/organization/OrgNotificationsBell';
import OrgTabBadge from '@/components/organization/OrgTabBadge';
import OrgSideNav from '@/components/organization/OrgSideNav';
import { useOrgGuideDemoPhase } from '@/components/org-guide/guide-demo-signal';
import type { GuideViewer } from '@/components/org-guide/guide-types';
import { useOrgNavMode, type OrgNavMode } from '@/components/organization/use-org-nav-mode';
import OrgSectionSwitcher from '@/components/organization/OrgSectionSwitcher';
import { ORG_SECTIONS, type OrgSection, type OrgNavItem } from '@/components/organization/org-sections';
import { sectionNotificationBadges, type BadgeSection } from '@/components/organization/org-section-badges';
import {
  isOrgSectionSegment,
  legacyOrgTabRedirect,
  orgSectionPath,
  readTeamIdSegment,
} from '@/components/organization/deep-link.helpers';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { canSeeStats } from '@/components/organization/stats-scope.helpers';
import { canSeeReports, reportAccess } from '@/components/organization/report-access.helpers';
import { useOrgTeams, useOrgTeamMembers } from '@/modules/org-teams';
import MyWorkTab from '@/components/organization/MyWorkTab';
import { MyWorkSkeleton, TeamTasksSkeleton, TeamOverviewSkeleton, OrgTabSkeleton } from '@/components/organization/OrgLoadingSkeletons';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { useT } from '@/i18n/useT';
import { useIsDemo } from '@/lib/app-mode.store';
import { joinedSinceWelcome, markMemberWelcomeSeen, readMemberWelcomeSeen } from '@/components/onboarding/enterprise/ent-onboarding';
import type { KeyOf } from '@/i18n/catalog';

// ── Onglets chargés à la demande : un chunk par onglet. `MyWorkTab` reste EAGER (onglet par défaut, ses blocs sont préchargés : `MyWorkSections`).
// Second argument de `lazyWithRetry` VIDE : les catalogues sont déclarés par la ROUTE (`App.tsx`). Un onglet qui DÉCLARE sa liste devient une frontière contrôlée par `lazy-namespaces.guard.test.ts` (`TAB_GATE_HOSTS`, `scripts/i18n-shell-namespaces.mjs`) et doit couvrir TOUT son sous-arbre, `org` compris. `portfolio` n'est payé que par Projets.
const TeamProjectsTab = lazyWithRetry(() => import('@/components/organization/TeamProjectsTab'), ['org', 'orgAdmin', 'overlays', 'portfolio', 'tasks']);
const TeamTasksTab = lazyWithRetry(() => import('@/components/organization/TeamTasksTab'), ['csv', 'eventModal', 'org', 'orgAdmin', 'overlays', 'portfolio', 'tasks']);
const TeamOKRTab = lazyWithRetry(() => import('@/components/organization/TeamOKRTab'), ['okr', 'org', 'orgAdmin', 'overlays', 'portfolio']);
const TeamOverviewTab = lazyWithRetry(() => import('@/components/organization/TeamOverviewTab'));
const OrgBillingTab = lazyWithRetry(() => import('@/components/organization/OrgBillingTab'), ['org', 'orgAccount', 'orgAdmin', 'overlays']);
const OrgPastDueBanner = lazyWithRetry(() => import('@/components/organization/OrgPastDueBanner'));
const OrgOverQuotaLock = lazyWithRetry(() => import('@/components/organization/OrgOverQuotaLock'));
// Membres, Équipes (et la page de chaque équipe) et Paramètres ont chacune leur
// adresse et leur chunk : seul qui ouvre `/entreprise/members` paie la section.
const OrgMembersSection = lazyWithRetry(() => import('@/components/organization/OrgMembersSection'));
const TeamsSection = lazyWithRetry(() => import('@/components/organization/TeamsSection'));
const TeamPage = lazyWithRetry(() => import('@/components/organization/TeamPage'));
// Rapports d'activité (mig. 202) : un chunk à part, payé par qui l'ouvre.
const OrgSettingsSection = lazyWithRetry(() => import('@/components/organization/OrgSettingsSection'), ['csv', 'okr', 'org', 'orgAccount', 'orgAdmin', 'overlays', 'portfolio', 'settings', 'tasks']);

// Feuilles et dialogues : conditionnels au rendu ET au téléchargement. Glossaire et liens profonds (`?task=`) : UNE entrée paresseuse (`OrgPageOverlays`). Accueil membre et bouton flottant du guide : leur catalogue part avec eux.
const OrgGuideFab = lazyWithRetry(() => import('@/components/org-guide/OrgGuideFab'), ['org', 'orgGuide', 'overlays']);
const OrgWelcomeVideo = lazyWithRetry(() => import('@/components/onboarding/enterprise/OrgWelcomeVideo'), ['onboarding']);
const OrgPageOverlays = lazyWithRetry(() => import('@/components/organization/OrgPageOverlays'), ['eventModal', 'org', 'orgAccount', 'orgAdmin', 'overlays', 'tasks']);

type OrgTab = OrgSection;

/**
 * Espace entreprise. Chaque section est une ROUTE (`/entreprise/projects`) ; navigation à droite (`OrgSideNav`) sur desktop, sélecteur (`OrgSectionSwitcher`) sur mobile. Réservé aux membres : un non-membre est redirigé vers le dashboard.
 */
/** Squelette d'un onglet dont le chunk est en vol : le même que celui du chargement de DONNÉES des trois onglets qui en ont un. */
const tabFallback = (tab: OrgTab, tOrgAdmin: (key: KeyOf<'orgAdmin'>) => string) => {
  if (tab === 'overview') return <MyWorkSkeleton label={tOrgAdmin('myWork.loading')} />;
  if (tab === 'tasks') return <TeamTasksSkeleton label={tOrgAdmin('page.tasksTabLoading')} />;
  if (tab === 'stats') return <TeamOverviewSkeleton label={tOrgAdmin('overview.loading')} />;
  return <OrgTabSkeleton label={tOrgAdmin('page.tabLoading')} />;
};

/** Ouvre la palette Ctrl+K (écoutée dans `CommandPalette.tsx`). */
const openSearch = () => window.dispatchEvent(new CustomEvent('open-command-palette'));

const OrganizationPage = () => {
  const { t } = useT('org');
  const { t: tOrgAdmin, tp: tpOrgAdmin } = useT('orgAdmin');
  const { user } = useAuth();
  // Section active = segment de chemin (`billing` : route sans entrée de navigation, retour Stripe). `entityId` : second segment, page d'une équipe (`/entreprise/teams/<id>`).
  const { section, entityId } = useParams<{ section?: string; entityId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlTab: OrgTab = isOrgSectionSegment(section) ? section : 'overview';
  // Sans `replace` : chaque section est une page, le bouton précédent y revient.
  const setTab = (id: OrgTab) => navigate(orgSectionPath(id));
  // Glossaire (cohérence globale) : ouvert par le bouton d'en-tête. Les
  // info-bulles de rôle l'ouvrent elles-mêmes, sur leur terme (`RoleTerm`).
  const isDemo = useIsDemo();
  // Fermé pendant cette visite ; le drapeau, lui, est posé par entreprise.
  const [welcomeClosed, setWelcomeClosed] = useState(false);
  // Décidé À L'ARRIVÉE, une fois : l'accueil membre ne s'ouvre que si l'on ARRIVE sans paramètre d'adresse (relue à chaque rendu, elle s'ouvrirait par-dessus l'écran voulu). Même règle que `FirstRunSetup`.
  const [arrivedBare] = useState(() => searchParams.toString() === '');
  // `?guide=1` (fin de la constellation) : ouvre le guide une seule fois,
  // puis le paramètre quitte l'URL pour qu'un rechargement ne le rouvre pas.
  const [guideOpenSignal] = useState(() => (searchParams.get('guide') === '1' ? Date.now() : undefined));
  useEffect(() => {
    if (searchParams.get('guide') !== '1') return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('guide');
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams]);
  const { activeOrg: myOrg, isLoading } = useActiveOrganization();
  const badges = useOrgBadges();
  const { data: orgNotifications = [] } = useOrgNotifications(myOrg?.id);
  // Navigation de droite (ouverte à l'arrivée, repliée, ou ressortie au
  // survol). Porté ici : la page réserve la place de la carte ouverte à
  // l'arrivée, sinon elle recouvrirait la colonne de droite du contenu.
  const [navMode, setNavMode] = useOrgNavMode();
  // Démo du guide : visible pendant un changement de page (`peek` si elle
  // était repliée, sans réserver de place), masquée une fois la page atteinte
  // pour que le curseur ne clique jamais derrière elle (cf. guide-demo-signal).
  const guidePhase = useOrgGuideDemoPhase();
  const sideNavMode: OrgNavMode =
    guidePhase === 'hide' ? 'collapsed'
    : guidePhase === 'nav' && navMode === 'collapsed' ? 'peek'
    : navMode;

  // Badge nav (reco #7) : « vu » est marqué en QUITTANT la page ; au montage, `lastSeen` repasserait à `now` et les badges naîtraient à zéro.
  useEffect(() => {
    const orgId = myOrg?.id;
    if (!orgId) return;
    return () => markOrgSeen(orgId);
  }, [myOrg?.id]);
  // `live` : c'est LA page où l'on attend de voir un membre arriver.
  const { data: members = [], isPending: membersPending } = useOrgMembers(myOrg?.id, { live: true });
  // Appelés avant les early returns, comme tous les hooks de la page.
  const { shortcuts, togglePin } = useOrgShortcuts(myOrg?.id, user?.id, urlTab, searchParams);
  // Droits explicites de l'utilisateur courant (mig. 115). Monté ici parce que
  // plusieurs onglets s'en servent — le hook ne déclenche qu'une requête,
  // partagée par React Query avec celles des composants enfants.
  const myPermissions = useMyOrgPermissions(myOrg?.id);
  // Guide entreprise : les rôles personnalisés (mig. 219) n'existent que si
  // leur lecture réussit. Même requête que `useMyOrgPermissions`, partagée.
  const { isError: rolesUnavailable } = useOrgRoles(myOrg?.id);
  // Appelé ICI, avant les early returns `isLoading` / `!myOrg` : un hook placé
  // plus bas ne serait pas monté sur tous les rendus.
  const { data: orgSubscription, isPending: subscriptionPending } = useOrgSubscription(myOrg?.id);
  // Statistiques (M3) : ouvertes aussi aux responsables d'équipe, qui n'ont
  // pas forcément de subordonné dans la pyramide.
  const { data: teams = [], isLoading: teamsLoading } = useOrgTeams(myOrg?.id);
  const { data: teamMembers = [] } = useOrgTeamMembers(myOrg?.id);

  // `/entreprise?tab=X` → `/entreprise/X`, autres paramètres conservés. ⚠️ À GARDER POUR TOUJOURS : Stripe renvoie sur `?tab=billing&checkout=success`, les e-mails `renewal-notice` portent `?tab=billing`. Avant l'attente de l'organisation. Passe par `safeRedirectPath` (no-open-redirect.test.ts).
  const legacyTarget = safeRedirectPath(legacyOrgTabRedirect(searchParams));
  if (legacyTarget) return <Navigate to={legacyTarget} replace />;
  // Segment inconnu (`/entreprise/xyz`, `/entreprise/overview`) : l'aperçu,
  // à sa vraie adresse plutôt qu'un contenu d'aperçu sous une URL fausse.
  if (section !== undefined && !isOrgSectionSegment(section)) {
    return <Navigate to="/entreprise" replace />;
  }
  // Un second segment n'a de sens que sous `teams`, et seulement s'il a la
  // forme d'un id : sinon, la section elle-même.
  const teamId = section === 'teams' ? readTeamIdSegment(entityId) : null;
  if (entityId !== undefined && !teamId) {
    return <Navigate to={orgSectionPath(section)} replace />;
  }

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
  // Un seul grade, administrateur ; tout le reste passe par les rôles
  // personnalisés et la fiche (mig. 229). Encadrer quelqu'un n'ouvre plus rien.
  const canInvite = myPermissions.can['member.invite'];
  // Le graphe de dépendances d'une tâche suit le droit de modifier les tâches.
  const canEditDependencies = myPermissions.can['task.editAny'];
  const guideViewer: GuideViewer = {
    can: myPermissions.can,
    isAdmin,
    isOwner,
    customRolesAvailable: !rolesUnavailable,
  };
  // La pyramide dit qui encadre qui, l'équipe qui travaille ensemble (M3). Rapports : droit `report.org` / `report.allTeams`, ou responsable d'une équipe ; tant que les équipes chargent, pas de renvoi vers l'aperçu (droit inconnu).
  const canReports = teamsLoading || myPermissions.isLoading
    || canSeeReports(reportAccess(myPermissions.can, teams, teamMembers, user?.id));
  const canStats = teamsLoading || canSeeStats(teams, { members, teamMembers, currentUserId: user?.id, isAdmin });
  // Sans droit sur `billing` ou `stats`, retombée sur l'aperçu. L'organigramme est masqué pour tous (mig. 229) : `pyramid` y renvoie aussi.
  const tab: OrgTab =
    (urlTab === 'billing' && !isOwner) || urlTab === 'pyramid' || (urlTab === 'stats' && !canStats)
      ? 'overview'
      : urlTab === 'reports' ? 'settings' : urlTab;

  // Entrées de navigation (panneau desktop et sélecteur mobile). Projets et Membres ont un compteur dérivé ; les autres comptent les notifications non lues de la boîte de réception.
  const sectionBadges = sectionNotificationBadges(orgNotifications);
  const badgeOf = (id: OrgSection): { count: number; items: string[] } => {
    const extra = (id in sectionBadges) ? sectionBadges[id as BadgeSection] : null;
    const extraItems = extra ? extra.kinds.map((k) => tOrgAdmin(`notifSettings.kind.${k}` as KeyOf<'orgAdmin'>)) : [];
    if (id === 'projects') return { count: badges.projects + (extra?.count ?? 0), items: [...badges.projectItems, ...extraItems] };
    if (id === 'members') return { count: badges.members, items: badges.memberItems };
    return { count: extra?.count ?? 0, items: extraItems };
  };
  // Effectif au-dessus du quota (baisse de palier, abonnement tombé) : l'espace se verrouille, restent les sections qui permettent d'en sortir. Jamais avant d'avoir lu l'abonnement ET les membres (quota par défaut 5, le verrou clignoterait).
  // ⚠️ Verrou d'interface : la base sert toujours les données (pas une frontière).
  const overQuota = !isDemo && ENTERPRISE_BILLING_ENFORCED && !membersPending && !subscriptionPending
    && isOverQuota(members.length, orgSubscription ?? null);
  const overQuotaViewer = { isAdmin, isOwner };
  const sectionLocked = overQuota && !sectionOpenWhileOverQuota(tab, overQuotaViewer);
  const navItems: OrgNavItem[] = ORG_SECTIONS.filter((item) => !item.hidden).filter((item) => (item.id === 'stats' ? canStats : !item.managerOnly || isAdmin)).filter((item) => !overQuota || sectionOpenWhileOverQuota(item.id, overQuotaViewer)).map(
    ({ id, labelKey, Icon, group }) => {
      const { count: badgeCount, items } = badgeOf(id);
      const badgeAriaLabel = badgeCount > 0 ? tpOrgAdmin('page.badgeCount', badgeCount) : undefined;
      return {
        id,
        label: t(labelKey),
        Icon,
        group,
        badgeCount,
        badgeAriaLabel,
        badge: badgeCount > 0 ? (
          <OrgTabBadge
            count={badgeCount}
            items={items}
            title={tOrgAdmin(id === 'members' ? 'page.badgePreviewMembers' : id === 'projects' ? 'page.badgePreviewProjects' : 'page.badgePreviewSection')}
            ariaLabel={badgeAriaLabel ?? ''}
            side="left"
            onAccent={tab === id}
          />
        ) : undefined,
      };
    },
  );

  // Quota de sièges bloquant : le gate serveur (`org_seats_allowed`, mig. 067) ne refuse que si le drapeau `enterprise_seat_limit` est actif ; le client annonce d'avance ce que le serveur appliquera.
  // ⚠️ Le seuil est celui de l'ABONNEMENT, jamais `ORG_FREE_SEATS` en dur (palier « Département » = 20 sièges). `isQuotaReached` porte la règle de `org_seats_allowed()`.
  const seatsQuota = effectiveQuota(orgSubscription ?? null);
  // Démo : pas de facturation réelle, la bannière n'appelle aucune action.
  const seatsFull = !isDemo && ENTERPRISE_BILLING_ENFORCED && isQuotaReached(members.length, orgSubscription ?? null);

  const hasEntityParam = ['task', 'member', 'project', 'okr', 'team'].some((k) => searchParams.has(k));

  return (
    // `md:pr-[232px]` = carte (208) + ses deux marges (12 + 12). La transition
    // suit la même courbe que la carte, pour que les deux bougent ensemble.
    <div
      className={`max-w-[1600px] mx-auto px-4 sm:px-6 py-6 md:transition-[padding] md:duration-300 motion-reduce:transition-none ${
        sideNavMode === 'open' ? 'md:pr-[232px]' : ''
      }`}
      style={{ transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
    >
      {/* ── Mobile : en-tête canonique (cf. docs/MOBILE.md) ──
          L'avatar de l'organisation n'y est PAS repris : une vignette de 48 px
          dans une barre qui se compacte à 17 px ne tient pas, et la réduire
          la rendrait illisible. Elle reste dans le bloc desktop. La pastille
          de forfait non plus : elle a déjà sa logique de passage à la ligne
          sur mobile, juste en dessous. */}
      <MobileHeader
        title={myOrg.name}
        subtitle={`${tpOrgAdmin('page.memberCount', members.length)}${myOrg.industry ? ` · ${myOrg.industry}` : ''}`}
        // Maquette 236 : une seule icône, la cloche. Le crayon
        // menait à Paramètres, qui est une section ; le glossaire passe dans
        // la feuille des sections (`OrgSectionSwitcher`).
        actions={<OrgNotificationsBell orgId={myOrg.id} members={members} />}
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
                onClick={() => setTab('settings')}
                aria-label={tOrgAdmin('page.editProfile')}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-hover))] transition-colors shrink-0"
              >
                <Pencil size={14} aria-hidden="true" />
              </button>
            )}
          </div>
          <p className="text-sm text-[rgb(var(--color-text-muted))] truncate">
            {tpOrgAdmin('page.memberCount', members.length)}
            {myOrg.industry ? ` · ${myOrg.industry}` : ''}
          </p>
          {myOrg.description && (
            <p className="text-xs text-[rgb(var(--color-text-secondary))] mt-0.5 line-clamp-1">{myOrg.description}</p>
          )}
        </div>
        {/* Le forfait n'est pas dans l'en-tête : le propriétaire le trouve dans
            Paramètres (`OrgSettingsSection`, « Forfait et facturation »). */}
        {/* La cloche lit `org_notifications`, alimentée côté serveur. */}
        <OrgNotificationsBell orgId={myOrg.id} members={members} />
      </header>

      {/* Impayé : propriétaire seul, au-dessus de tout.
          Chunk chargé seulement quand l'abonnement est `past_due`. */}
      {isOwner && !isDemo && needsPaymentAttention(orgSubscription ?? null) && (
        <Suspense fallback={null}>
          <OrgPastDueBanner orgId={myOrg.id} memberCount={members.length} />
        </Suspense>
      )}

      {/* Bannière sièges : affichée UNIQUEMENT quand il faut changer de plan
          (facturation active ET quota atteint). Le simple constat « gratuit
          jusqu'à 5, rien ne change » n'appelait aucune action : retiré. */}
      {seatsFull && !overQuota && (
        <div className="mb-5 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))] px-4 py-3">
          <p className="text-xs text-[rgb(var(--color-text-secondary))]">
            <span className="font-semibold text-[rgb(var(--color-text-primary))]">{tpOrgAdmin('page.memberCountDot', members.length)}</span>{' '}
            {tOrgAdmin('page.freemiumOver')}
          </p>
        </div>
      )}

      {/* Mobile : la section courante devient un sélecteur (maquette M1).
          Desktop : la navigation vit à droite, dans `OrgSideNav`. */}
      <OrgSectionSwitcher
        fallbackActive={(() => { const s = ORG_SECTIONS.find((x) => x.id === tab); return s ? { label: t(s.labelKey), Icon: s.Icon } : undefined; })()}
        items={navItems} activeId={tab} shortcuts={shortcuts} onSearch={openSearch} />

      {/* Contenu */}
      {/* Une seule frontière Suspense pour tout le contenu : les onglets sont
          exclusifs, et le fallback est choisi d'après l'onglet demandé — celui
          de l'onglet Tâches ressemble à sa table, celui des Statistiques à ses
          tuiles. Un fallback générique pour tous aurait fait clignoter une
          forme qui n'est pas celle qui arrive. */}
      <Suspense fallback={tabFallback(tab, tOrgAdmin)}>
      {sectionLocked ? (
        <OrgOverQuotaLock
          memberCount={members.length}
          quota={effectiveQuota(orgSubscription ?? null) ?? members.length}
          excess={membersOverQuota(members.length, orgSubscription ?? null)}
          canManageMembers={isAdmin || isOwner}
          canChangePlan={isOwner}
          onManageMembers={() => setTab('members')}
          onChangePlan={() => setTab('billing')}
        />
      ) : (<>
      {tab === 'overview' && (
        <MyWorkTab orgId={myOrg.id} members={members} currentUserId={user?.id} canEditDependencies={canEditDependencies} />
      )}
      {tab === 'stats' && canStats && (
        <TeamOverviewTab orgId={myOrg.id} members={members} isAdmin={isAdmin} currentUserId={user?.id} />
      )}
      {tab === 'tasks' && (
        <TeamTasksTab orgId={myOrg.id} members={members} currentUserId={user?.id} canEditDependencies={canEditDependencies} isAdmin={isAdmin} />
      )}
      {tab === 'projects' && (
        <TeamProjectsTab orgId={myOrg.id} members={members} currentUserId={user?.id} canEditDependencies={canEditDependencies} isAdmin={isAdmin} />
      )}
      {tab === 'okr' && <TeamOKRTab orgId={myOrg.id} />}
      {tab === 'billing' && (
        <OrgBillingTab
          orgId={myOrg.id}
          isOwner={isOwner}
          onBack={() => setTab('overview')}
        />
      )}

      {tab === 'members' && (
        <OrgMembersSection
          org={myOrg}
          members={members}
          currentUserId={user?.id}
          isAdmin={isAdmin}
          canInvite={canInvite}
          seatsFull={seatsFull}
          seatsQuota={!isDemo && ENTERPRISE_BILLING_ENFORCED && !subscriptionPending ? seatsQuota : undefined}
          onChangePlan={isOwner && !isDemo && ENTERPRISE_BILLING_ENFORCED ? () => setTab('billing') : undefined}
        />
      )}
      {tab === 'teams' && (teamId ? (
        <TeamPage orgId={myOrg.id} teamId={teamId} members={members} currentUserId={user?.id} isAdmin={isAdmin} />
      ) : (
        <TeamsSection
          orgId={myOrg.id}
          members={members}
          currentUserId={user?.id}
          isAdmin={isAdmin}
          canCreateTeam={myPermissions.can['team.create']}
        />
      ))}
      {tab === 'settings' && (
        <OrgSettingsSection
          org={myOrg}
          members={members}
          currentUserId={user?.id}
          isOwner={isOwner}
          isAdmin={isAdmin}
          canInvite={canInvite}
          seatsFull={seatsFull}
          seatsQuota={seatsQuota}
          pastDue={needsPaymentAttention(orgSubscription ?? null)}
          canReports={canReports && !teamsLoading && !myPermissions.isLoading}
          initialPanel={urlTab === 'reports' ? 'reports' : undefined}
        />
      )}
      </>)}
      </Suspense>

      {/* Feuilles et dialogues : leur propre frontière, avec un fallback nul.
          Ils s'ouvrent par-dessus l'écran ; y poser un squelette ferait
          clignoter une carte fantôme au milieu de la page pendant que le
          chunk arrive. */}
      <Suspense fallback={null}>
      </Suspense>

      {/* Desktop : la navigation vit à DROITE, hors de la zone qui défile.
          Rendue par portail dans l'emplacement de `Layout`, donc sa place
          dans cet arbre ne dit rien de sa place à l'écran. */}
      {/* Guide entreprise : bouton flottant desktop, le reste arrive en lazy. */}
      <Suspense fallback={null}>
        <OrgGuideFab viewer={guideViewer} openSignal={guideOpenSignal} />
      </Suspense>

      <OrgSideNav
        items={navItems}
        activeId={tab}
        mode={sideNavMode}
        onModeChange={setNavMode}
        shortcuts={shortcuts}
        onTogglePin={togglePin}
        onSearch={openSearch}
      />

      {/* Premier passage dans CETTE entreprise (créateur comme membre) : la
          vidéo d'accueil, seulement à une arrivée sans paramètre : qui arrive
          par un lien (fiche, réglages, retour de paiement) vient pour cet
          écran, pas pour une visite. En démo aussi : le visiteur démo est un
          prospect, la vidéo lui fait le tour.
          La date d'arrivée n'y compte pas (membres seedés), le drapeau « vu »
          tombe avec le reste des clés `cosmo_*` à chaque nouvelle démo. */}
      {arrivedBare && !welcomeClosed && !hasEntityParam && user?.id && (isDemo || joinedSinceWelcome(members, user.id)) && !readMemberWelcomeSeen(myOrg.id, user.id) && (
        <Suspense fallback={null}>
          <OrgWelcomeVideo
            orgName={myOrg.name}
            onClose={() => {
              markMemberWelcomeSeen(myOrg.id, user.id);
              setWelcomeClosed(true);
            }}
          />
        </Suspense>
      )}

      {/* Liens profonds : `?task=`, `?member=`, `?project=`, `?okr=`, `?team=`
          ouvrent leur fiche quelle que soit la section affichée. */}
      {hasEntityParam && !overQuota && (
        <Suspense fallback={null}>
          <OrgPageOverlays
            deepLink={{ orgId: myOrg.id, section: teamId ? 'teams' : tab, members, currentUserId: user?.id, isAdmin, canEditDependencies }}
          />
        </Suspense>
      )}
    </div>
  );
};

export default OrganizationPage;
