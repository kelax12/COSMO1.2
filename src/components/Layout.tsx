import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Outlet, NavLink, useMatch, useResolvedPath, useLocation } from 'react-router-dom';
import { useLastVisitedPage } from '@/modules/ui-states';
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
  ChevronRight } from
  'lucide-react';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { usePendingRequestCount } from '@/modules/friends';
import MobileTabBar from './layout/MobileTabBar';

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
        className="min-w-[20px] flex items-center justify-center relative"
        onMouseEnter={() => setIconHovered(true)}
        onMouseLeave={() => setIconHovered(false)}
        style={{
          transition: 'transform 0.2s ease, color 0.2s ease',
          transform: (iconHovered || groupHovered) ? 'scale(1.32)' : 'scale(1)',
          color: isColored ? hoverColor : undefined,
        }}
      >
        {icon}
        {badge !== undefined && badge > 0 && (
          <span
            className={`absolute ${collapsed ? '-top-1 -right-1' : '-top-2 -right-2'} bg-red-500 text-white text-[10px] rounded-full ${collapsed ? 'w-4 h-4' : 'w-5 h-5'} flex items-center justify-center`}
          >
            {badge}
          </span>
        )}
      </div>
      {!collapsed && <span className="ml-3 truncate">{label}</span>}
    </NavLink>
  );
};

const Layout: React.FC = () => {
  const isMobile = useIsMobile();
  const pendingRequestCount = usePendingRequestCount();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved ? JSON.parse(saved) : false;
  });
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  // Mémorise la page courante : à la prochaine ouverture, l'app rouvre ici
  // (RootRoute lit cette valeur) au lieu de toujours retomber sur le dashboard.
  const location = useLocation();
  const { setLastVisitedPage } = useLastVisitedPage();
  useEffect(() => {
    setLastVisitedPage(location.pathname);
  }, [location.pathname, setLastVisitedPage]);

const NavItems = () =>
  <>
      <NavItemLink to="/" label="Dashboard" icon={<LayoutDashboard size={20} aria-hidden="true" />}
        hoverColor="#94a3b8" collapsed={isCollapsed} badge={pendingRequestCount} end />

      <NavItemLink to="/tasks" label="To do list" icon={<CheckSquare size={20} aria-hidden="true" />}
        hoverColor={CHART_COLORS.tasks} collapsed={isCollapsed} />

      <NavItemLink to="/agenda" label="Agenda" icon={<Calendar size={20} aria-hidden="true" />}
        hoverColor={CHART_COLORS.events} collapsed={isCollapsed} />

      <NavItemLink to="/okr" label="OKR" icon={<Target size={20} aria-hidden="true" />}
        hoverColor={CHART_COLORS.okrs} collapsed={isCollapsed} />

      <NavItemLink to="/habits" label="Habitudes" icon={<Repeat size={20} aria-hidden="true" />}
        hoverColor={CHART_COLORS.habits} collapsed={isCollapsed} />

      <NavItemLink to="/statistics" label="Statistiques" icon={<BarChart2 size={20} aria-hidden="true" />}
        hoverColor="#8b5cf6" collapsed={isCollapsed} />
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


  if (isMobile) {
    return (
      <div
        className="flex flex-col h-[100dvh] overflow-hidden"
        style={{ backgroundColor: 'rgb(var(--color-background))' }}
      >
        <main
          className="flex-1 overflow-auto pb-20"
          style={{ backgroundColor: 'rgb(var(--color-background))' }}
        >
          <Outlet />
        </main>
        <MobileTabBar />
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
          className="absolute -right-3 top-1/2 -translate-y-1/2 bg-white dark:bg-zinc-800 border rounded-full shadow-sm hover:shadow-md z-50 md:opacity-0 md:group-hover:opacity-100 opacity-100 hover:text-blue-500 hover:border-blue-500"
          style={{ borderColor: 'rgb(var(--nav-border))' }}
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
        </div>
      </aside>

      {/* Main content */}
      <main
        className="flex-1 overflow-auto relative"
        style={{ backgroundColor: 'rgb(var(--color-background))' }}>

        {/* Rappel habitudes de fin de journée (#24) — opt-in dans Réglages */}
        <Suspense fallback={null}>
          <HabitEveningReminder />
        </Suspense>
        <Outlet />
      </main>

      {/* Quick-add global (touche N) — lazy : n'alourdit pas le chunk d'entrée */}
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
    </div>);

};

export default Layout;
