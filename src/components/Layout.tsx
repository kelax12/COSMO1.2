import React, { useState, useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import {
  Home,
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
      <NavLink
      to="/"
      className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''} ${isCollapsed && !isMobileMenuOpen ? 'justify-center px-0' : ''}`}
      end
      onClick={() => setIsMobileMenuOpen(false)}>

        <div className="min-w-[20px] flex items-center justify-center">
          <LayoutDashboard size={20} aria-hidden="true" />
        </div>
        {(!isCollapsed || isMobileMenuOpen) && <span className="ml-3 truncate">Dashboard</span>}
      </NavLink>
      
      <NavLink
      to="/tasks"
      className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''} ${isCollapsed && !isMobileMenuOpen ? 'justify-center px-0' : ''}`}
      onClick={() => setIsMobileMenuOpen(false)}>

        <div className="min-w-[20px] flex items-center justify-center">
          <CheckSquare size={20} aria-hidden="true" />
        </div>
        {(!isCollapsed || isMobileMenuOpen) && <span className="ml-3 truncate">To do list</span>}
      </NavLink>
      
      <NavLink
      to="/agenda"
      className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''} ${isCollapsed && !isMobileMenuOpen ? 'justify-center px-0' : ''}`}
      onClick={() => setIsMobileMenuOpen(false)}>

        <div className="min-w-[20px] flex items-center justify-center">
          <Calendar size={20} aria-hidden="true" />
        </div>
        {(!isCollapsed || isMobileMenuOpen) && <span className="ml-3 truncate">Agenda</span>}
      </NavLink>
      
      <NavLink
      to="/okr"
      className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''} ${isCollapsed && !isMobileMenuOpen ? 'justify-center px-0' : ''}`}
      onClick={() => setIsMobileMenuOpen(false)}>

        <div className="min-w-[20px] flex items-center justify-center">
          <Target size={20} aria-hidden="true" />
        </div>
        {(!isCollapsed || isMobileMenuOpen) && <span className="ml-3 truncate">OKR</span>}
      </NavLink>
      
      <NavLink
      to="/habits"
      className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''} ${isCollapsed && !isMobileMenuOpen ? 'justify-center px-0' : ''}`}
      onClick={() => setIsMobileMenuOpen(false)}>

        <div className="min-w-[20px] flex items-center justify-center">
          <Repeat size={20} aria-hidden="true" />
        </div>
        {(!isCollapsed || isMobileMenuOpen) && <span className="ml-3 truncate">Habitudes</span>}
      </NavLink>
      
      <NavLink
      to="/statistics"
      className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''} ${isCollapsed && !isMobileMenuOpen ? 'justify-center px-0' : ''}`}
      onClick={() => setIsMobileMenuOpen(false)}>

        <div className="min-w-[20px] flex items-center justify-center">
          <BarChart2 size={20} aria-hidden="true" />
        </div>
        {(!isCollapsed || isMobileMenuOpen) && <span className="ml-3 truncate">Statistiques</span>}
      </NavLink>
    </>;


  const CompanyItems = () =>
  <>
        <NavLink
      to="/messages"
      className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''} ${isCollapsed && !isMobileMenuOpen ? 'justify-center px-0' : ''}`}
      onClick={() => {
        setIsMobileMenuOpen(false);
        markMessagesAsRead();
      }}
      onMouseEnter={markMessagesAsRead}>

        <div className="min-w-[20px] flex items-center justify-center relative">
          <MessageCircle size={20} aria-hidden="true" />
          {unreadMessages > 0 &&
        <span className={`absolute ${isCollapsed && !isMobileMenuOpen ? '-top-1 -right-1' : '-top-2 -right-2'} bg-red-500 text-white text-[10px] rounded-full ${isCollapsed && !isMobileMenuOpen ? 'w-4 h-4' : 'w-5 h-5'} flex items-center justify-center`}>
              {unreadMessages}
            </span>
        }
        </div>
        {(!isCollapsed || isMobileMenuOpen) && <span className="ml-3 truncate">Messagerie</span>}
      </NavLink>
      
      <NavLink
      to="/premium"
      className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''} ${isCollapsed && !isMobileMenuOpen ? 'justify-center px-0' : ''}`}
      onClick={() => setIsMobileMenuOpen(false)}>

        <div className="min-w-[20px] flex items-center justify-center">
          <Crown size={20} aria-hidden="true" />
        </div>
        {(!isCollapsed || isMobileMenuOpen) && <span className="ml-3 truncate">Premium</span>}
      </NavLink>
      
        <NavLink
      to="/settings"
      className={({ isActive }) => `sidebar-item ${isActive ? 'active' : ''} ${isCollapsed && !isMobileMenuOpen ? 'justify-center px-0' : ''}`}
      onClick={() => setIsMobileMenuOpen(false)}>

          <div className="min-w-[20px] flex items-center justify-center">
            <Settings size={20} aria-hidden="true" />
          </div>
          {(!isCollapsed || isMobileMenuOpen) && <span className="ml-3 truncate">Paramètres</span>}
        </NavLink>
    </>;


  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
      {/* Mobile Header */}
        {isMobile &&
      <header className="fixed top-0 left-0 right-0 h-16 bg-[rgb(var(--color-surface))] border-b border-[rgb(var(--color-border))] flex items-center justify-between px-4 z-40">
            <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-background))] rounded-lg transition-colors">

              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
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
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-1/2 -translate-y-1/2 bg-white dark:bg-zinc-800 border rounded-full p-1.5 shadow-sm hover:shadow-md transition-all z-50 md:opacity-0 md:group-hover:opacity-100 opacity-100 hover:text-blue-500 hover:border-blue-500"
          style={{ borderColor: 'rgb(var(--nav-border))' }}
          aria-label={isCollapsed ? "Agrandir la barre latérale" : "Réduire la barre latérale"}>

            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
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
