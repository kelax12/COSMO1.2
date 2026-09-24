import { Suspense, useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { markOrgSeen, useOrgBadges } from '@/lib/hooks/use-org-notifications';
import { Building2, Pencil, X } from 'lucide-react';
import { useManagerSectionsToast, useOrgShortcuts } from '@/components/organization/org-page.hooks';
import { useAuth } from '@/modules/auth/AuthContext';
import {
  useActiveOrganization,
  useOrgMembers,
  useLeaveOrganization,
  useTransferOwnership,
  useMyOrgPermissions,
  isManagerOf,
} from '@/modules/organizations';
import { ENTERPRISE_BILLING_ENFORCED } from '@/modules/billing/premium-config';
import { useDeleteOrgFlow } from './organization/useDeleteOrgFlow';
import { useOrgSubscription } from '@/modules/billing/org-billing.hooks';
import { isQuotaReached, effectiveQuota } from '@/modules/billing/org-billing.logic';
import { PageHeading } from '@/components/ui/typography';
import { MobileHeader } from '@/components/mobile';
import OrgNotificationsBell from '@/components/organization/OrgNotificationsBell';
import OrgTabBadge from '@/components/organization/OrgTabBadge';
import OrgSideNav from '@/components/organization/OrgSideNav';
import { useOrgNavMode } from '@/components/organization/use-org-nav-mode';
import OrgSectionSwitcher from '@/components/organization/OrgSectionSwitcher';
import { ORG_SECTIONS, type OrgSection, type OrgNavItem } from '@/components/organization/org-sections';
import {
  isOrgSectionSegment,
  legacyOrgTabRedirect,
  orgSectionPath,
} from '@/components/organization/deep-link.helpers';
import { safeRedirectPath } from '@/lib/safe-redirect';
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
// n'économiser que ce qu'on va charger dans la seconde. Ses blocs peints, eux,
// sont chargés à part et préchargés (`MyWorkSections`, 2026-09-24).
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
// Section Membres : sortie de la page le 2026-09-24, et LAZY pour la même
// raison que les onglets ci-dessus. Importée en dur, elle restait dans ce
// chunk, qui dépassait son cliquet (18,3 ko pour 18,0) : seul qui ouvre
// `/entreprise/members` doit la payer.
const OrgMembersSection = lazyWithRetry(() => import('@/components/organization/OrgMembersSection'));
// Paramètres (M13) : même raison, seul qui ouvre `/entreprise/settings` la paie.
const OrgSettingsSection = lazyWithRetry(() => import('@/components/organization/OrgSettingsSection'));

// Feuilles et dialogues : montés derrière un `&&`, donc déjà conditionnels au
// rendu. Ils ne l'étaient pas au TÉLÉCHARGEMENT.
const OrgProfileSheet = lazyWithRetry(() => import('@/components/organization/OrgProfileSheet'));
const DeleteOrganizationDialog = lazyWithRetry(() => import('@/components/organization/DeleteOrganizationDialog'));
const ConfirmLeaveOrgDialog = lazyWithRetry(() => import('@/components/organization/ConfirmLeaveOrgDialog'));
const TransferOwnershipDialog = lazyWithRetry(() => import('@/components/organization/TransferOwnershipDialog'));

type OrgTab = OrgSection;

/**
 * Espace entreprise. Chaque section est une ROUTE depuis le 2026-09-23
 * (`/entreprise/projects`) : le bouton précédent passe d'une section à
 * l'autre et l'onglet du navigateur porte son nom. La navigation vit à
 * droite (`OrgSideNav`) sur desktop, dans un sélecteur (`OrgSectionSwitcher`)
 * sur mobile. Réservé aux membres d'une organisation : un non-membre est
 * redirigé vers le dashboard.
 */
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

// 🗑️ Bannière « gratuit jusqu'au 1er août » retirée le 2026-09-24 : elle ne
// s'affichait plus depuis le 2026-08-01, son code et ses libellés restaient.

/** Ouvre la palette Ctrl+K (écoutée dans `CommandPalette.tsx`). */
const openSearch = () => window.dispatchEvent(new CustomEvent('open-command-palette'));

const OrganizationPage = () => {
  const { t, tp } = useT('org');
  const { user } = useAuth();
  // Section active = segment de chemin. `billing` en fait partie : c'est une
  // route sans entrée de navigation, où Stripe renvoie après un paiement.
  const { section } = useParams<{ section?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlTab: OrgTab = isOrgSectionSegment(section) ? section : 'overview';
  // Sans `replace` : chaque section est une page, le bouton précédent y revient.
  const setTab = (id: OrgTab) => navigate(orgSectionPath(id));
  const [editProfile, setEditProfile] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [seatsBannerDismissed, setSeatsBannerDismissed] = useState(false);
  const { activeOrg: myOrg, isLoading } = useActiveOrganization();
  const badges = useOrgBadges();
  // Navigation de droite (ouverte à l'arrivée, repliée, ou ressortie au
  // survol). Porté ici : la page réserve la place de la carte ouverte à
  // l'arrivée, sinon elle recouvrirait la colonne de droite du contenu.
  const [navMode, setNavMode] = useOrgNavMode();

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
  // Appelés avant les early returns, comme tous les hooks de la page.
  useManagerSectionsToast(myOrg?.id, user?.id, members, !membersLoading && members.length > 0, myOrg?.myRole === 'admin');
  const { shortcuts, togglePin } = useOrgShortcuts(myOrg?.id, user?.id, urlTab, searchParams);
  // Droits explicites de l'utilisateur courant (mig. 115). Monté ici parce que
  // plusieurs onglets s'en servent — le hook ne déclenche qu'une requête,
  // partagée par React Query avec celles des composants enfants.
  const myPermissions = useMyOrgPermissions(myOrg?.id);
  // Appelé ICI, avant les early returns `isLoading` / `!myOrg` : un hook placé
  // plus bas ne serait pas monté sur tous les rendus.
  const { data: orgSubscription } = useOrgSubscription(myOrg?.id);
  const leaveMutation = useLeaveOrganization();
  // C-39 — « la suppression resilie ET REMBOURSE » (arbitrage du 2026-09-03) :
  // un seul geste, aucun debit orphelin. L'enchainement et son ordre vivent
  // dans `useDeleteOrgFlow`, avec la raison de cet ordre.
  const deleteFlow = useDeleteOrgFlow(() => setConfirmingDelete(false));
  const transferMutation = useTransferOwnership();

  // Ancienne forme `/entreprise?tab=X` → `/entreprise/X`, les autres
  // paramètres conservés. ⚠️ À GARDER POUR TOUJOURS : Stripe renvoie sur
  // `/entreprise?tab=billing&checkout=success`, et les e-mails de
  // `renewal-notice` déjà envoyés portent `?tab=billing`. Placé avant l'attente
  // de l'organisation : rien à charger pour réécrire une URL.
  // Passe par `safeRedirectPath` comme toute destination lue dans l'URL,
  // même si le chemin vient ici d'une liste fermée (cf. no-open-redirect.test.ts).
  const legacyTarget = safeRedirectPath(legacyOrgTabRedirect(searchParams));
  if (legacyTarget) return <Navigate to={legacyTarget} replace />;
  // Segment inconnu (`/entreprise/xyz`, `/entreprise/overview`) : l'aperçu,
  // à sa vraie adresse plutôt qu'un contenu d'aperçu sous une URL fausse.
  if (section !== undefined && !isOrgSectionSegment(section)) {
    return <Navigate to="/entreprise" replace />;
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
  // « Manager » est dérivé de la pyramide : a ≥ 1 subordonné direct (v2).
  const isManager = isAdmin || (user?.id ? isManagerOf(members, user.id) : false);
  // Droits explicites (mig. 115). `isManager` reste la clé des surfaces
  // HIÉRARCHIQUES (onglets Pyramide et Statistiques) : voir l'équipe qu'on
  // encadre n'est pas une permission réglable, c'est une position.
  const canInvite = myPermissions.can['member.invite'];
  // Un membre qui arrive sur `/entreprise/billing` (lien partagé, ancien
  // favori) ou sur `pyramid` / `stats` (favori d'un ancien manager, lien
  // copié) sans en avoir le droit ne voit pas un écran vide : il retombe sur
  // l'aperçu.
  const tab: OrgTab =
    (urlTab === 'billing' && !isOwner) || ((urlTab === 'pyramid' || urlTab === 'stats') && !isManager)
      ? 'overview'
      : urlTab;

  // Entrées de navigation, partagées par le panneau desktop et le sélecteur
  // mobile. Seuls Projets (tâches nouvellement assignées) et Membres (demandes
  // d'adhésion en attente) portent un compteur.
  const navItems: OrgNavItem[] = ORG_SECTIONS.filter((item) => !item.managerOnly || isManager).map(
    ({ id, labelKey, Icon, group }) => {
      const badgeCount = id === 'projects' ? badges.projects : id === 'members' ? badges.members : 0;
      const badgeAriaLabel = badgeCount > 0 ? tp('page.badgeCount', badgeCount) : undefined;
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
            items={id === 'projects' ? badges.projectItems : badges.memberItems}
            title={t(id === 'projects' ? 'page.badgePreviewProjects' : 'page.badgePreviewMembers')}
            ariaLabel={badgeAriaLabel ?? ''}
            side="left"
            onAccent={tab === id}
          />
        ) : undefined,
      };
    },
  );

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

  return (
    // `md:pr-[232px]` = carte (208) + ses deux marges (12 + 12). La transition
    // suit la même courbe que la carte, pour que les deux bougent ensemble.
    <div
      className={`max-w-[1600px] mx-auto px-4 sm:px-6 py-6 md:transition-[padding] md:duration-300 motion-reduce:transition-none ${
        navMode === 'open' ? 'md:pr-[232px]' : ''
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

      {/* Mobile : la section courante devient un sélecteur (maquette M1).
          Desktop : la navigation vit à droite, dans `OrgSideNav`. */}
      <OrgSectionSwitcher items={navItems} activeId={tab} shortcuts={shortcuts} onSearch={openSearch} />

      {/* Contenu */}
      {/* Une seule frontière Suspense pour tout le contenu : les onglets sont
          exclusifs, et le fallback est choisi d'après l'onglet demandé — celui
          de l'onglet Tâches ressemble à sa table, celui des Statistiques à ses
          tuiles. Un fallback générique pour tous aurait fait clignoter une
          forme qui n'est pas celle qui arrive. */}
      <Suspense fallback={tabFallback(tab, t)}>
      {tab === 'overview' && (
        <MyWorkTab orgId={myOrg.id} members={members} currentUserId={user?.id} isManager={isManager} />
      )}
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
        <OrgMembersSection
          org={myOrg}
          members={members}
          currentUserId={user?.id}
          isAdmin={isAdmin}
          canInvite={canInvite}
          canCreateTeam={myPermissions.can['team.create']}
          seatsFull={seatsFull}
        />
      )}

      {tab === 'settings' && (
        <OrgSettingsSection
          org={myOrg}
          members={members}
          isOwner={isOwner}
          isAdmin={isAdmin}
          transferPending={transferMutation.isPending}
          deletePending={deleteFlow.isPending}
          leavePending={leaveMutation.isPending}
          onEditProfile={() => setEditProfile(true)}
          onTransfer={() => setTransferring(true)}
          onDelete={() => setConfirmingDelete(true)}
          onLeave={() => setConfirmingLeave(true)}
        />
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
          pending={deleteFlow.isPending}
          onConfirm={() => deleteFlow.run(myOrg.id)}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
      </Suspense>

      {/* Desktop : la navigation vit à DROITE, hors de la zone qui défile.
          Rendue par portail dans l'emplacement de `Layout`, donc sa place
          dans cet arbre ne dit rien de sa place à l'écran. */}
      <OrgSideNav
        items={navItems}
        activeId={tab}
        mode={navMode}
        onModeChange={setNavMode}
        shortcuts={shortcuts}
        onTogglePin={togglePin}
        onSearch={openSearch}
      />
    </div>
  );
};

export default OrganizationPage;
