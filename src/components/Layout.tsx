import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Outlet, NavLink, useMatch, useResolvedPath, useLocation } from 'react-router-dom';
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
  Zap } from
  'lucide-react';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { usePendingRequestCount } from '@/modules/friends';
import { useActiveOrganization } from '@/modules/organizations';
import { useOrgNotificationCount } from '@/lib/hooks/use-org-notifications';
import OrgSwitcher from '@/components/organization/OrgSwitcher';
import MobileTabBar from './layout/MobileTabBar';
import DemoConversionBanner from './DemoConversionBanner';
import GlobalNavShortcuts from './GlobalNavShortcuts';
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
  badgeLabel?: string;
  end?: boolean;
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
  badgeLabel,
  end,
}) => {
  const [iconHovered, setIconHovered] = useState(false);
  const [groupHovered, setGroupHovered] = useState(false);
  const resolved = useResolvedPath(to);
  const match = useMatch({ path: resolved.pathname, end: end ?? false });
  const isActive = !!match;
  const isColored = iconHovered || groupHovered || isActive;

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `sidebar-item ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`
      }
      style={groupHovered ? { transform: 'translateX(8px) scale(1.15)' } : undefined}
      onMouseEnter={() => { setGroupHovered(true); onMouseEnterExtra?.(); prefetchRoute(to); }}
      onMouseLeave={() => { setGroupHovered(false); setIconHovered(false); }}
    >
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
            aria-label={badgeLabel ? `${badge} ${badgeLabel}` : undefined}
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
      {!collapsed && <span className="ml-3 truncate">{label}</span>}
    </NavLink>
  );
};

// Titres d'onglet par route (#15) — « Tâches – Cosmo » plutôt qu'un titre
// statique : retrouvable parmi les onglets du navigateur.
const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Accueil',
  '/tasks': 'Tâches',
  '/agenda': 'Agenda',
  '/habits': 'Habitudes',
  '/okr': 'OKR',
  '/statistics': 'Statistiques',
  '/settings': 'Paramètres',
  '/premium': 'Premium',
  '/admin': 'Admin',
  '/entreprise': 'Entreprise',
};

const Layout: React.FC = () => {
  const isMobile = useIsMobile();
  const pendingRequestCount = usePendingRequestCount();
  const orgNotificationCount = useOrgNotificationCount();
  // Entrée « Entreprise » visible uniquement pour les membres d'une organisation.
  const { activeOrg: myOrg, organizations } = useActiveOrganization();
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
    const pageTitle = PAGE_TITLES[location.pathname];
    document.title = pageTitle ? `${pageTitle} – Cosmo` : 'Cosmo';
  }, [location.pathname]);

const NavItems = () =>
  <>
      <NavItemLink to="/dashboard" label="Accueil" icon={<LayoutDashboard size={20} aria-hidden="true" />}
        hoverColor="#94a3b8" collapsed={isCollapsed} badge={pendingRequestCount}
        badgeLabel="demandes en attente" end />

      <NavItemLink to="/tasks" label="Tâches" icon={<CheckSquare size={20} aria-hidden="true" />}
        hoverColor={CHART_COLORS.tasks} collapsed={isCollapsed}
        badge={tasksDueTodayCount} badgeVariant="neutral" badgeLabel="tâches pour aujourd'hui" />

      <NavItemLink to="/agenda" label="Agenda" icon={<Calendar size={20} aria-hidden="true" />}
        hoverColor={CHART_COLORS.events} collapsed={isCollapsed} />

      <NavItemLink to="/okr" label="OKR" icon={<Target size={20} aria-hidden="true" />}
        hoverColor={CHART_COLORS.okrs} collapsed={isCollapsed} />

      <NavItemLink to="/habits" label="Habitudes" icon={<Repeat size={20} aria-hidden="true" />}
        hoverColor={CHART_COLORS.habits} collapsed={isCollapsed} />

      <NavItemLink to="/statistics" label="Statistiques" icon={<BarChart2 size={20} aria-hidden="true" />}
        hoverColor="#8b5cf6" collapsed={isCollapsed} />

      {myOrg && (
        <>
          <NavItemLink to="/entreprise" label="Entreprise" icon={<Building2 size={20} aria-hidden="true" />}
            hoverColor="#6366f1" collapsed={isCollapsed}
            badge={orgNotificationCount} badgeLabel="notifications entreprise" />
          {/* Switcher multi-org — affiché seulement si plusieurs entreprises */}
          {organizations.length > 1 && <OrgSwitcher collapsed={isCollapsed} />}
        </>
      )}
    </>;


  const CompanyItems = () =>
  <>
      {/* Premium masqué tant que PREMIUM_ENFORCED=false (gratuit pour tous).
          Lien + page conservés, réapparaissent dès qu'on réactive le flag. */}
      {PREMIUM_ENFORCED && (
        <NavItemLink to="/premium" label="Premium" icon={<Crown size={20} aria-hidden="true" />}
          hoverColor={CHART_COLORS.habits} collapsed={isCollapsed} />
      )}

      <NavItemLink to="/settings" label="Paramètres" icon={<Settings size={20} aria-hidden="true" />}
        hoverColor="#94a3b8" collapsed={isCollapsed} />
    </>;


  // Composants globaux montés dans les DEUX variantes du Layout (mobile a son
  // propre return early — sans ce bloc partagé, quick-add/rappel/onboarding
  // n'existaient tout simplement pas sur mobile).
  const globalOverlays = (
    <>
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
            toutes les pages protégées : une pensée doit se capturer en 1 tap. */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('open-quick-add'))}
          data-tutorial-id="global-quick-add-fab"
          aria-label="Créer une tâche rapide"
          className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-2xl bg-[rgb(var(--color-accent-solid))] to-purple-600 text-[rgb(var(--color-accent-solid-foreground))] shadow-lg shadow-blue-500/30 flex items-center justify-center active:scale-95 transition-transform"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          <Zap size={24} aria-hidden="true" />
        </button>
        <MobileTabBar />
        {globalOverlays}
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
      {/* Sidebar */}
      <aside
        className={`${isCollapsed ? 'w-20' : 'w-64'} relative transition-all duration-300 ease-in-out nav-container border-r flex flex-col group`}>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 bg-white dark:bg-zinc-800 border rounded-full shadow-sm hover:shadow-md z-50 md:opacity-40 md:group-hover:opacity-100 opacity-100 hover:text-blue-500 hover:border-[rgb(var(--color-accent-solid-hover))] transition-opacity"
          style={{ borderColor: 'rgb(var(--nav-border))' }}
          title="Réduire/agrandir ( [ )"
          aria-label={isCollapsed ? "Agrandir la barre latérale" : "Réduire la barre latérale"}
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
              <button
                type="button"
                onClick={openCommandPalette}
                aria-label={`Rechercher (${IS_MAC ? 'Cmd' : 'Ctrl'}+K)`}
                title={`Rechercher (${IS_MAC ? '⌘K' : 'Ctrl K'})`}
                className="p-3 rounded-xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-hover))] transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))]/40"
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
          {!isCollapsed && <div className="text-xs font-semibold uppercase mb-4 px-2 !whitespace-pre-line" style={{ color: 'rgb(var(--color-text-secondary))' }}>AUTRE</div>}
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
