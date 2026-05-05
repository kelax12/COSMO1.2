import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Repeat,
  MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import MobileMoreSheet from './MobileMoreSheet';

const NAV_COLORS = {
  dashboard: '#94a3b8',
  tasks: '#3b82f6',
  agenda: '#ef4444',
  habits: '#eab308',
  more: '#64748b',
} as const;

interface TabConfig {
  to?: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  end?: boolean;
}

const TABS: TabConfig[] = [
  { to: '/',       label: 'Accueil',  icon: LayoutDashboard, color: NAV_COLORS.dashboard, end: true },
  { to: '/tasks',  label: 'Tâches',   icon: CheckSquare,     color: NAV_COLORS.tasks },
  { to: '/agenda', label: 'Agenda',   icon: Calendar,        color: NAV_COLORS.agenda },
  { to: '/habits', label: 'Habitudes', icon: Repeat,         color: NAV_COLORS.habits },
];

const tabBaseClasses =
  'flex flex-col items-center justify-center gap-0.5 flex-1 min-h-11 text-[10px] font-medium transition-colors active:scale-95 transform-gpu';

const MobileTabBar: React.FC = () => {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav
        aria-label="Navigation mobile"
        className="fixed bottom-0 inset-x-0 z-40 bg-[rgb(var(--color-surface))] border-t border-[rgb(var(--color-border))] pb-safe"
        style={{ boxShadow: '0 -1px 3px rgba(0,0,0,0.04)' }}
      >
        <ul className="flex items-stretch h-16">
          {TABS.map(({ to, label, icon: Icon, color, end }) => (
            <li key={to} className="flex-1 flex">
              <NavLink
                to={to!}
                end={end}
                className={({ isActive }) =>
                  cn(
                    tabBaseClasses,
                    isActive
                      ? 'text-[rgb(var(--color-text-primary))]'
                      : 'text-[rgb(var(--color-text-muted))]'
                  )
                }
                style={({ isActive }) =>
                  isActive ? { color } : undefined
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      size={22}
                      className={cn('transition-transform', isActive && 'scale-110')}
                    />
                    <span className="leading-tight">{label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}

          <li className="flex-1 flex">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-label="Plus d'options"
              className={cn(
                tabBaseClasses,
                moreOpen
                  ? 'text-[rgb(var(--color-text-primary))]'
                  : 'text-[rgb(var(--color-text-muted))]'
              )}
              style={moreOpen ? { color: NAV_COLORS.more } : undefined}
            >
              <MoreHorizontal size={22} />
              <span className="leading-tight">Plus</span>
            </button>
          </li>
        </ul>
      </nav>

      <MobileMoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
};

export default MobileTabBar;
