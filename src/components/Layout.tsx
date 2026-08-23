import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Outlet, NavLink, useMatch, useResolvedPath, useLocation, useNavigate } from 'react-router';
import { useLastVisitedPage } from '@/modules/ui-states';
import { useTasks } from '@/modules/tasks';
import { prefetchRoute } from '@/lib/route-prefetch';
import { PREMIUM_ENFORCED } from '@/modules/billing/premium-config';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Target,
  BarChart2,
  Crown,
  Settings,
  Repeat,
  Search,
  ChevronLeft,
  ChevronRight,
  Building2,
  Plus,
  Check } from
  'lucide-react';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';
import { usePendingRequestCount } from '@/modules/friends';
import { useActiveOrganization } from '@/modules/organizations';
import { useOrgNotificationCount } from '@/lib/hooks/use-org-notifications';
import MobileTabBar from './layout/MobileTabBar';
import DemoConversionBanner from './DemoConversionBanner';
import DemoBridgePrompt from './DemoBridgePrompt';
import GlobalNavShortcuts from './GlobalNavShortcuts';
import InviteOrJoinModal from './organization/InviteOrJoinModal';
import DeadlineReminder from './DeadlineReminder';
import SyncStatusIndicator from './SyncStatusIndicator';

// Quick-add global — lazy : ne se charge qu'au premier rendu du Layout.
const QuickAddBar = lazy(() => import('./QuickAddBar'));
// Rappel habitudes du soir (#24) — lazy également.
const HabitEveningReminder = lazy(() => import('./HabitEveningReminder'));
// Aide raccourcis clavier (#48) — touche « ? ».
const ShortcutsHelp = lazy(() => import('./ShortcutsHelp'));
// Tâches d'exemple au premier login (#49) — headless.
const OnboardingExampleTasks = lazy(() => import('./OnboardingExampleTasks'));

// Détection plateforme pour afficher le bon badge de raccourci (⌘K vs Ctrl K).
const IS_MAC =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent || '');

// Ouvre la palette de commandes (écoutée dans CommandPalette.tsx).
const openCommandPalette = () => {
  window.dispatchEvent(new CustomEvent('open-command-palette'));
};

// Couleurs du graphique "Répartition du temps"
const CHART_COLORS = {
  tasks:  '#3b82f6',
  events: '#ef4444',
  okrs:   '#22c55e',
  habits: '#eab308',
} as const;

interface NavItemLinkProps {
  to: string;
  label: string;
  icon: React.ReactNode;
  hoverColor: string;
  collapsed: boolean;
  onMouseEnterExtra?: () => void;
  badge?: number;
  /** 'alert' = pastille rouge (notifications) ; 'neutral' = compteur sobre (#49). */
  badgeVariant?: 'alert' | 'neutral';
  /**
   * Libellé accessible COMPLET du badge, compte inclus.
   *
   * i18n — l'appelant fournit la chaîne entière (via `tp()`) plutôt qu'un
   * fragment que ce composant concaténerait à `badge`. Un `${n} ${label}` codé
   * ici imposerait l'ordre « nombre puis texte » à toutes les langues et
   * empêcherait tout accord au pluriel.
   */
  badgeAriaLabel?: string;
  end?: boolean;
  /**
   * Si fourni, le clic n'effectue plus la navigation directe : il ouvre ce
   * menu déroulant à la place (ex. choix de l'organisation active avant
   * d'entrer dans l'espace Entreprise).
   */
  menuContent?: React.ReactNode;
}

const NavItemLink: React.FC<NavItemLinkProps> = ({
  to,
  label,
  icon,
  hoverColor,
  collapsed,
  onMouseEnterExtra,
  badge,
  badgeVariant = 'alert',
  badgeAriaLabel,
  end,
  menuContent,
}) => {
  const [iconHovered, setIconHovered] = useState(false);
  const [groupHovered, setGroupHovered] = useState(false);
  const resolved = useResolvedPath(to);
  const match = useMatch({ path: resolved.pathname, end: end ?? false });
  const isActive = !!match;
  const isColored = iconHovered || groupHovered || isActive;

  const content = (
    <>
      <div
        className="nav-item-icon min-w-[20px] flex items-center justify-center relative"
        onMouseEnter={() => setIconHovered(true)}
        onMouseLeave={() => setIconHovered(false)}
        style={{
          transition: 'transform 0.2s ease, color 0.2s ease',
          transform: (iconHovered || groupHovered) ? 'scale(1.2)' : 'scale(1)',
          color: isColored ? hoverColor : undefined,
        }}
      >
        {icon}
        {badge !== undefined && badge > 0 && (
          <span
            aria-label={badgeAriaLabel}
            className={`absolute ${collapsed ? '-top-1 -right-1' : '-top-2 -right-2'} ${
              badgeVariant === 'alert'
                ? 'bg-red-500 text-white'
                : 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))] border border-[rgb(var(--color-border))]'
            } text-[10px] rounded-full ${collapsed ? 'min-w-4 h-4' : 'min-w-5 h-5'} px-1 flex items-center justify-center`}
          >
            {badge}
          </span>
        )}
      </div>
      {/* Pas de marge propre : l'écart avec l'icône vient du seul `gap` de
          .sidebar-item — un `ml-3` ici s'additionnait au gap (24px cumulés). */}
      {!collapsed && <span className="truncate">{label}</span>}
    </>
  );

  if (menuContent) {
    // asChild : évite de rendre un <button> natif, dont le chrome par défaut
    // du navigateur (appearance: button) grossit visuellement l'item par
    // rapport aux <a> voisins que .sidebar-item ne redéfinit pas.
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            className={`sidebar-item cursor-pointer ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : '!ml-1 !py-[0.7rem]'}`}
            style={groupHovered ? { transform: 'translateX(8px) scale(1.15)' } : undefined}
            onMouseEnter={() => { setGroupHovered(true); onMouseEnterExtra?.(); prefetchRoute(to); }}
            onMouseLeave={() => { setGroupHovered(false); setIconHovered(false); }}
            aria-label={label}
          >
            {content}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side={collapsed ? 'right' : 'bottom'} className="w-56">
          {menuContent}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `sidebar-item ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : '!ml-1 !py-[0.7rem]'}`
      }
      style={groupHovered ? { transform: 'translateX(8px) scale(1.15)' } : undefined}
      onMouseEnter={() => { setGroupHovered(true); onMouseEnterExtra?.(); prefetchRoute(to); }}
      onMouseLeave={() => { setGroupHovered(false); setIconHovered(false); }}
    >
      {content}
    </NavLink>
  );
};

// Titres d'onglet par route (#15) — « Tâches – Cosmo » plutôt qu'un titre
// statique : retrouvable parmi les onglets du navigateur.
//
// Les valeurs sont des CLÉS, pas du texte : ce sont exactement les libellés de
// la navigation, et les dupliquer les ferait diverger à la première retouche.
//
// Les chemins n'ont pas de préfixe de locale : `basename` (cf. src/main.tsx) le
// retire déjà de `location.pathname`. C'est ce qui permet à cette table de
// rester identique dans toutes les langues.
const PAGE_TITLE_KEYS: Record<string, KeyOf<'common'>> = {
  '/dashboard': 'nav.dashboard',
  '/tasks': 'nav.tasks',
  '/agenda': 'nav.agenda',
  '/habits': 'nav.habits',
  '/okr': 'nav.okr',
  '/statistics': 'nav.statistics',
  '/settings': 'nav.settings',
  '/premium': 'nav.premium',
  '/admin': 'nav.admin',
  '/entreprise': 'nav.enterprise',
};

const Layout: React.FC = () => {
  const { t, tp } = useT('common');
  const { t: tOrg } = useT('org');
  const isMobile = useIsMobile();
  const pendingRequestCount = usePendingRequestCount();
  const orgNotificationCount = useOrgNotificationCount();
  // Entrée « Entreprise » visible uniquement pour les membres d'une organisation.
  const { activeOrg: myOrg, organizations, setActiveOrgId } = useActiveOrganization();
  const navigate = useNavigate();
  // Compteur de tâches restantes aujourd'hui (#49) — badge neutre sur l'item
  // Tâches. La disparition du badge (0 restant) est la récompense.
  const { data: allTasks = [] } = useTasks();
  const todayStr = new Date().toLocaleDateString('en-CA');
  const tasksDueTodayCount = allTasks.filter(
    (t) => !t.completed && t.deadline && t.deadline.slice(0, 10) === todayStr
  ).length;
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved ? JSON.parse(saved) : false;
  });
  // « + » de la nav : inviter un ami / rejoindre une entreprise avec un code.
  // Monte dans `globalOverlays`, donc partage par les rendus mobile ET desktop.
  const [inviteOpen, setInviteOpen] = useState(false);

  // La feuille « Plus » du mobile vit sous MobileTabBar, plusieurs niveaux
  // sous cet etat. Meme convention que la palette de commandes : un evenement
  // custom, plutot qu un contexte de plus pour un seul booleen.
  useEffect(() => {
    const open = () => setInviteOpen(true);
    window.addEventListener("open-invite-join", open);
    return () => window.removeEventListener("open-invite-join", open);
  }, []);
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  // Raccourci « [ » : replie/déplie la sidebar (#14) — convention Linear.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const editable = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if (e.key === '[' && !e.metaKey && !e.ctrlKey && !e.altKey && !editable) {
        setIsCollapsed((prev: boolean) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Mémorise la page courante : à la prochaine ouverture, l'app rouvre ici
  // (RootRoute lit cette valeur) au lieu de toujours retomber sur le dashboard.
  const location = useLocation();
  const { setLastVisitedPage } = useLastVisitedPage();
  useEffect(() => {
    setLastVisitedPage(location.pathname);
  }, [location.pathname, setLastVisitedPage]);

  // Titre d'onglet par page (#15).
  useEffect(() => {
    const key = PAGE_TITLE_KEYS[location.pathname];
    document.title = key ? t('nav.documentTitle', { page: t(key) }) : 'Cosmo';
  }, [location.pathname, t]);

const NavItems = () =>
  <>
      <NavItemLink to="/dashboard" label={t('nav.dashboard')} icon={<LayoutDashboard size={20} aria-hidden="true" />}
        hoverColor="#94a3b8" collapsed={isCollapsed} badge={pendingRequestCount}
        badgeAriaLabel={tp('nav.badge.pendingRequest', pendingRequestCount)} end />

      <NavItemLink to="/tasks" label={t('nav.tasks')} icon={<CheckSquare size={20} aria-hidden="true" />}
        hoverColor={CHART_COLORS.tasks} collapsed={isCollapsed}
        badge={tasksDueTodayCount} badgeVariant="neutral"
        badgeAriaLabel={tp('nav.badge.taskDueToday', tasksDueTodayCount)} />

      <NavItemLink to="/agenda" label={t('nav.agenda')} icon={<Calendar size={20} aria-hidden="true" />}
          hoverColor={CHART_COLORS.events} collapsed={isCollapsed} />

      <NavItemLink to="/okr" label={t('nav.okr')} icon={<Target size={20} aria-hidden="true" />}
          hoverColor={CHART_COLORS.okrs} collapsed={isCollapsed} />

      <NavItemLink to="/habits" label={t('nav.habits')} icon={<Repeat size={20} aria-hidden="true" />}
          hoverColor={CHART_COLORS.habits} collapsed={isCollapsed} />

      <NavItemLink to="/statistics" label={t('nav.statistics')} icon={<BarChart2 size={20} aria-hidden="true" />}
          hoverColor="#8b5cf6" collapsed={isCollapsed} />

      {myOrg && (
        <NavItemLink to="/entreprise" label={t('nav.enterprise')} icon={<Building2 size={20} aria-hidden="true" />}
          hoverColor="#6366f1" collapsed={isCollapsed}
          badge={orgNotificationCount}
          badgeAriaLabel={tp('nav.badge.orgNotification', orgNotificationCount)}
          // Plusieurs organisations : le clic ouvre le choix au lieu de naviguer
          // directement (une seule icône « Entreprise » dans la nav — #plan).
          menuContent={organizations.length > 1 ? (
            <>
              <DropdownMenuLabel>{tOrg('switcher.myOrgs')}</DropdownMenuLabel>
              {organizations.map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => { setActiveOrgId(org.id); navigate('/entreprise'); }}
                >
                  <span className="truncate">{org.name}</span>
                  <span className="ml-auto flex items-center gap-1.5">
                    {org.myRole === 'admin' && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        {tOrg('common.adminBadge')}
                      </span>
                    )}
                    {org.id === myOrg?.id && <Check size={14} aria-hidden="true" />}
                  </span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/entreprise/onboarding')}>
                <Plus size={14} aria-hidden="true" /> {tOrg('switcher.createOrJoin')}
              </DropdownMenuItem>
            </>
          ) : undefined} />
      )}

      {/* « + » — inviter un ami / rejoindre une entreprise avec un code.
          Monte INCONDITIONNELLEMENT, que l'entree « Entreprise » ci-dessus
          soit affichee ou non : c'est justement le point d'entree de
          quelqu'un qui n'appartient encore a aucune organisation. */}
      <button
        type="button"
        onClick={() => setInviteOpen(true)}
        title={tOrg('inviteJoin.navAria')}
        aria-label={tOrg('inviteJoin.navAria')}
        className={[
          'sidebar-item w-full flex items-center rounded-xl transition-colors',
          'text-[rgb(var(--nav-item-text))] hover:bg-[rgb(var(--nav-item-hover-bg))] hover:text-[rgb(var(--nav-item-hover-text))]',
          isCollapsed ? 'justify-center p-3' : 'gap-3 px-3 py-2.5',
        ].join(' ')}
      >
        <Plus size={20} aria-hidden="true" />
        {!isCollapsed && <span className="text-sm font-medium">{tOrg('inviteJoin.navLabel')}</span>}
      </button>
    </>;


  const CompanyItems = () =>
  <>
      {/* Premium masqué tant que PREMIUM_ENFORCED=false (gratuit pour tous).
          Lien + page conservés, réapparaissent dès qu'on réactive le flag. */}
      {PREMIUM_ENFORCED && (
        <NavItemLink to="/premium" label={t('nav.premium')} icon={<Crown size={20} aria-hidden="true" />}
          hoverColor={CHART_COLORS.habits} collapsed={isCollapsed} />
      )}

      <NavItemLink to="/settings" label={t('nav.settings')} icon={<Settings size={20} aria-hidden="true" />}
        hoverColor="#94a3b8" collapsed={isCollapsed} />
    </>;


  // Composants globaux montés dans les DEUX variantes du Layout (mobile a son
  // propre return early — sans ce bloc partagé, quick-add/rappel/onboarding
  // n'existaient tout simplement pas sur mobile).
  const globalOverlays = (
    <>
      {/* Pont démo → compte : proposé au visiteur démo engagé (90 s ou 3ᵉ
          création). Monté ici pour n'exister qu'une fois, mobile et desktop
          partageant ce fragment. */}
      <DemoBridgePrompt />
      {/* Quick-add global (touche N / FAB éclair) — lazy */}
      <Suspense fallback={null}>
        <QuickAddBar />
      </Suspense>
      {/* Aide raccourcis (touche ?) */}
      <Suspense fallback={null}>
        <ShortcutsHelp />
      </Suspense>
      {/* Tâches d'exemple au premier login prod (#49) */}
      <Suspense fallback={null}>
        <OnboardingExampleTasks />
      </Suspense>
      {/* Raccourcis « g puis lettre » (#44) */}
      <GlobalNavShortcuts />
      {/* Rappel deadlines du jour à l'ouverture (#30) — headless, 1×/jour */}
      <DeadlineReminder />
      <InviteOrJoinModal open={inviteOpen} onOpenChange={setInviteOpen} />
    </>
  );

  if (isMobile) {
    return (
      <div
        className="flex flex-col h-[100dvh] overflow-hidden"
        style={{ backgroundColor: 'rgb(var(--color-background))' }}
      >
        {/* Bannière conversion démo → compte (#9) */}
        <DemoConversionBanner />
        {/* État sync mobile (#37) — visible uniquement hors ligne / en cours */}
        <div className="fixed top-2 right-2 z-40 rounded-full bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] px-2.5 py-1 shadow-sm empty:hidden">
          <SyncStatusIndicator hideWhenSynced />
        </div>
        <main
          className="flex-1 overflow-auto pb-20"
          style={{ backgroundColor: 'rgb(var(--color-background))' }}
        >
          {/* Rappel habitudes de fin de journée (#24) — opt-in dans Réglages */}
          <Suspense fallback={null}>
            <HabitEveningReminder />
          </Suspense>
          <Outlet />
        </main>
        {/* FAB de capture rapide global (#43) — au-dessus de la tab bar, sur
            toutes les pages protégées SAUF le Dashboard (déjà un widget
            "Tâches prioritaires" en haut, pas besoin d'un raccourci flottant
            en plus), et SAUF Habitudes/OKR qui ont déjà leur propre FAB dédié
            (même position, z-30) — le garder ici les rendait inutilisables :
            ce FAB (z-40) passait au-dessus et interceptait tous les taps,
            ouvrant la capture rapide générique au lieu du bon modal. */}
        {location.pathname !== '/dashboard' && location.pathname !== '/habits' && location.pathname !== '/okr' && (
          <button
            type="button"
            onClick={() => {
              // Sur /tasks, la capture rapide (QuickAddBar) n'est pas la bonne
              // popup : on ouvre le formulaire de création complet, comme le
              // bouton « Nouvelle tâche » du desktop. TasksPage écoute cet
              // événement. Ailleurs, capture rapide globale inchangée.
              const evt = location.pathname === '/tasks' ? 'open-task-create'
                : location.pathname === '/agenda' ? 'open-agenda-create'
                : 'open-quick-add';
              window.dispatchEvent(new CustomEvent(evt));
            }}
            data-tutorial-id="global-quick-add-fab"
            aria-label={t('nav.createTask')}
            className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-2xl bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] shadow-lg shadow-black/30 flex items-center justify-center active:scale-95 transition-transform"
            style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
          >
            <Plus size={26} aria-hidden="true" />
          </button>
        )}
        <MobileTabBar />
        {globalOverlays}
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
      {/* Sidebar */}
      <aside
        className={`${isCollapsed ? 'w-20' : 'w-[205px]'} relative transition-all duration-300 ease-in-out nav-container border-r flex flex-col group`}>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 bg-white dark:bg-zinc-800 border rounded-full shadow-sm hover:shadow-md z-50 md:opacity-40 md:group-hover:opacity-100 opacity-100 hover:text-blue-500 hover:border-[rgb(var(--color-accent-solid-hover))] transition-opacity"
          style={{ borderColor: 'rgb(var(--nav-border))' }}
          title={t('nav.sidebar.toggleTitle')}
          aria-label={isCollapsed ? t('nav.sidebar.expand') : t('nav.sidebar.collapse')}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </Button>

        <div className={`p-6 border-b flex flex-col items-center ${isCollapsed ? 'px-2' : ''}`} style={{ borderColor: 'rgb(var(--nav-border))' }}>
          <div className={`${isCollapsed ? 'scale-75' : ''} transition-transform duration-300`}>
            <Logo showText={!isCollapsed} />
          </div>

            {/* Thème + Recherche (loupe juste en dessous) */}
            <div className="mt-6 flex flex-col items-center gap-3 w-full">
              <ThemeToggle />
              {/* Raccourci Ctrl/Cmd+K : masqué sous `lg`. C'est une affordance
                  purement clavier — elle n'a aucun sens sur un écran tactile,
                  où la barre latérale s'affiche encore (entre 768 et 1024 px)
                  alors qu'il n'y a pas de clavier. La palette reste ouvrable au
                  clavier partout où un clavier existe. */}
              <button
                type="button"
                onClick={openCommandPalette}
                aria-label={t('nav.search.ariaLabel', { shortcut: IS_MAC ? 'Cmd+K' : 'Ctrl+K' })}
                title={t('nav.search.title', { shortcut: IS_MAC ? '⌘K' : 'Ctrl K' })}
                className="hidden lg:block p-3 rounded-xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-hover))] transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))]/40"
              >
                <Search size={18} className="text-[rgb(var(--color-text-secondary))]" aria-hidden="true" />
              </button>
            </div>
        </div>

        <nav className={`flex-1 ${isCollapsed ? 'px-2' : 'px-4'} py-6 space-y-2 overflow-x-hidden overflow-y-auto`}>
          {NavItems()}
        </nav>

        {/* Section Company */}
        <div className={`border-t ${isCollapsed ? 'p-2' : 'p-4'}`} style={{ borderColor: 'rgb(var(--nav-border))' }}>
          {!isCollapsed && <div className="text-xs font-semibold uppercase mb-4 px-2 !whitespace-pre-line" style={{ color: 'rgb(var(--color-text-secondary))' }}>{t('nav.sectionOther')}</div>}
          {CompanyItems()}
          {/* État de synchronisation (#37) */}
          <div className={`mt-3 ${isCollapsed ? 'flex justify-center' : 'px-2'}`}>
            <SyncStatusIndicator compact={isCollapsed} />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Bannière conversion démo → compte (#9) */}
        <DemoConversionBanner />
        <main
          className="flex-1 overflow-auto relative"
          style={{ backgroundColor: 'rgb(var(--color-background))' }}>

          {/* Rappel habitudes de fin de journée (#24) — opt-in dans Réglages */}
          <Suspense fallback={null}>
            <HabitEveningReminder />
          </Suspense>
          <Outlet />
        </main>
      </div>

      {globalOverlays}
    </div>);

};

export default Layout;
