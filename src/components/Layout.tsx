import React, { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Target,
  BarChart2,
  MessageCircle,
  Crown,
  Settings,
  Repeat,
  ChevronLeft,
  ChevronRight,
  Menu,
  X } from
  'lucide-react';
import Logo from './Logo';
import { useAuth } from '@/modules/auth/AuthContext';
import { useMessages } from '@/modules/user';
import ThemeToggle from './ThemeToggle';
import { Button } from '@/components/ui/button';

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
  mobileOpen: boolean;
  onClick?: () => void;
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
  mobileOpen,
  onClick,
  onMouseEnterExtra,
  badge,
  end,
}) => {
  const [iconHovered, setIconHovered] = useState(false);
  const [groupHovered, setGroupHovered] = useState(false);
  const isCollapsedMode = collapsed && !mobileOpen;
  const isColored = iconHovered || groupHovered;

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `sidebar-item ${isActive ? 'active' : ''} ${isCollapsedMode ? 'justify-center px-0' : ''}`
      }
      onClick={onClick}
      onMouseEnter={() => { setGroupHovered(true); onMouseEnterExtra?.(); }}
      onMouseLeave={() => setGroupHovered(false)}
    >
      <div
        className="min-w-[20px] flex items-center justify-center relative"
        onMouseEnter={() => setIconHovered(true)}
        onMouseLeave={() => setIconHovered(false)}
        style={{
          transition: 'transform 0.2s ease, color 0.2s ease',
          transform: iconHovered ? 'scale(1.2)' : 'scale(1)',
          color: isColored ? hoverColor : undefined,
        }}
      >
        {icon}
        {badge !== undefined && badge > 0 && (
          <span
            className={`absolute ${isCollapsedMode ? '-top-1 -right-1' : '-top-2 -right-2'} bg-red-500 text-white text-[10px] rounded-full ${isCollapsedMode ? 'w-4 h-4' : 'w-5 h-5'} flex items-center justify-center`}
          >
            {badge}
          </span>
        )}
      </div>
      {(!collapsed || mobileOpen) && <span className="ml-3 truncate">{label}</span>}
    </NavLink>
  );
};

const Layout: React.FC = () => {
  const { user } = useAuth();
  const { messages, markMessagesAsRead } = useMessages();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  // Responsive: collapse on small screens
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 768);
      if (width < 768) {
        setIsCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Compter les messages non lus
  const unreadMessages = messages.filter((msg) => !msg.read).length;

  const NavItems = () =>
  <>
      <NavItemLink to="/" label="Dashboard" icon={<LayoutDashboard size={20} aria-hidden="true" />}
        hoverColor={CHART_COLORS.tasks} collapsed={isCollapsed} mobileOpen={isMobileMenuOpen}
        onClick={() => setIsMobileMenuOpen(false)} end />

      <NavItemLink to="/tasks" label="To do list" icon={<CheckSquare size={20} aria-hidden="true" />}
        hoverColor={CHART_COLORS.tasks} collapsed={isCollapsed} mobileOpen={isMobileMenuOpen}
        onClick={() => setIsMobileMenuOpen(false)} />

      <NavItemLink to="/agenda" label="Agenda" icon={<Calendar size={20} aria-hidden="true" />}
        hoverColor={CHART_COLORS.events} collapsed={isCollapsed} mobileOpen={isMobileMenuOpen}
        onClick={() => setIsMobileMenuOpen(false)} />

      <NavItemLink to="/okr" label="OKR" icon={<Target size={20} aria-hidden="true" />}
        hoverColor={CHART_COLORS.okrs} collapsed={isCollapsed} mobileOpen={isMobileMenuOpen}
        onClick={() => setIsMobileMenuOpen(false)} />

      <NavItemLink to="/habits" label="Habitudes" icon={<Repeat size={20} aria-hidden="true" />}
        hoverColor={CHART_COLORS.habits} collapsed={isCollapsed} mobileOpen={isMobileMenuOpen}
        onClick={() => setIsMobileMenuOpen(false)} />

      <NavItemLink to="/statistics" label="Statistiques" icon={<BarChart2 size={20} aria-hidden="true" />}
        hoverColor="#8b5cf6" collapsed={isCollapsed} mobileOpen={isMobileMenuOpen}
        onClick={() => setIsMobileMenuOpen(false)} />
    </>;


  const CompanyItems = () =>
  <>
      <NavItemLink to="/messages" label="Messagerie" icon={<MessageCircle size={20} aria-hidden="true" />}
        hoverColor={CHART_COLORS.tasks} collapsed={isCollapsed} mobileOpen={isMobileMenuOpen}
        badge={unreadMessages}
        onClick={() => { setIsMobileMenuOpen(false); markMessagesAsRead(); }}
        onMouseEnterExtra={markMessagesAsRead} />

      <NavItemLink to="/premium" label="Premium" icon={<Crown size={20} aria-hidden="true" />}
        hoverColor={CHART_COLORS.habits} collapsed={isCollapsed} mobileOpen={isMobileMenuOpen}
        onClick={() => setIsMobileMenuOpen(false)} />

      <NavItemLink to="/settings" label="Paramètres" icon={<Settings size={20} aria-hidden="true" />}
        hoverColor="#94a3b8" collapsed={isCollapsed} mobileOpen={isMobileMenuOpen}
        onClick={() => setIsMobileMenuOpen(false)} />
    </>;


  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
      {/* Mobile Header */}
        {isMobile &&
      <header className="fixed top-0 left-0 right-0 h-16 bg-[rgb(var(--color-surface))] border-b border-[rgb(var(--color-border))] flex items-center justify-between px-4 z-40">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              style={{ color: 'rgb(var(--color-text-primary))' }}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </Button>
            <Logo showText={true} />
          </header>
      }

      {/* Sidebar Overlay for Mobile */}
      {isMobile && isMobileMenuOpen &&
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
        onClick={() => setIsMobileMenuOpen(false)} />

      }

      {/* Sidebar */}
      <aside
        className={`
          ${isMobile ?
        `fixed inset-y-0 left-0 z-50 w-64 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out` :
        `${isCollapsed ? 'w-20' : 'w-64'} relative transition-all duration-300 ease-in-out`}
          nav-container border-r flex flex-col group
        `
        }>

        {/* Toggle Button - Only Desktop */}
        {!isMobile &&
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
        }

        <div className={`p-6 border-b flex flex-col items-center ${isCollapsed && !isMobile ? 'px-2' : ''}`} style={{ borderColor: 'rgb(var(--nav-border))' }}>
          <div className={`${isCollapsed && !isMobile ? 'scale-75' : ''} transition-transform duration-300`}>
            <Logo showText={!isCollapsed || isMobile} />
          </div>
          
            <div className="mt-6 flex justify-center w-full">
              <ThemeToggle />
            </div>
        </div>
      
        <nav className={`flex-1 ${isCollapsed && !isMobile ? 'px-2' : 'px-4'} py-6 space-y-2 overflow-x-hidden overflow-y-auto`}>
          <NavItems />
        </nav>
        
        {/* Section Company */}
        <div className={`border-t ${isCollapsed && !isMobile ? 'p-2' : 'p-4'}`} style={{ borderColor: 'rgb(var(--nav-border))' }}>
          {(!isCollapsed || isMobile) && <div className="text-xs font-semibold uppercase mb-4 px-2 !whitespace-pre-line" style={{ color: 'rgb(var(--color-text-muted))' }}>AUTRE</div>}
          <CompanyItems />
        </div>
      </aside>

      {/* Main content */}
      <main
        className={`flex-1 overflow-auto relative ${isMobile ? 'pt-16' : ''}`}
        style={{ backgroundColor: 'rgb(var(--color-background))' }}>

        <Outlet />
      </main>
    </div>);

};

export default Layout;
