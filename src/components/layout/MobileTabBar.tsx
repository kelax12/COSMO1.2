import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Repeat,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePendingRequestCount } from '@/modules/friends';
import { useTasks } from '@/modules/tasks';
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
  icon: LucideIcon;
  color: string;
  end?: boolean;
}

const TABS: TabConfig[] = [
  { to: '/dashboard', label: 'Accueil',  icon: LayoutDashboard, color: NAV_COLORS.dashboard, end: true },
  { to: '/tasks',  label: 'Tâches',   icon: CheckSquare,     color: NAV_COLORS.tasks },
  { to: '/agenda', label: 'Agenda',   icon: Calendar,        color: NAV_COLORS.agenda },
  { to: '/habits', label: 'Habitudes', icon: Repeat,         color: NAV_COLORS.habits },
];

const tabBaseClasses =
  'flex flex-col items-center justify-center gap-0.5 flex-1 min-h-11 text-[10px] font-medium transition-colors active:scale-95 transform-gpu';

const MobileTabBar: React.FC = () => {
  const [moreOpen, setMoreOpen] = useState(false);
  const pendingRequestCount = usePendingRequestCount();
  // Badge neutre « tâches restantes aujourd'hui » sur l'onglet Tâches (#49).
  const { data: allTasks = [] } = useTasks();
  const todayStr = new Date().toLocaleDateString('en-CA');
  const tasksDueTodayCount = allTasks.filter(
    (t) => !t.completed && t.deadline && t.deadline.slice(0, 10) === todayStr
  ).length;

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
                    <span className="relative">
                      <Icon
                        size={22}
                        className={cn('transition-transform', isActive && 'scale-110')}
                      />
                      {end && pendingRequestCount > 0 && (
                        <span
                          aria-label={`${pendingRequestCount} demandes en attente`}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] leading-none rounded-full min-w-4 h-4 px-1 flex items-center justify-center"
                        >
                          {pendingRequestCount}
                        </span>
                      )}
                      {to === '/tasks' && tasksDueTodayCount > 0 && (
                        <span
                          aria-label={`${tasksDueTodayCount} tâches pour aujourd'hui`}
                          className="absolute -top-1.5 -right-1.5 bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))] border border-[rgb(var(--color-border))] text-[10px] leading-none rounded-full min-w-4 h-4 px-1 flex items-center justify-center"
                        >
                          {tasksDueTodayCount}
                        </span>
                      )}
                    </span>
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
