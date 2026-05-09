import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Target, BarChart2, Crown, Settings, LogOut } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';
import { useAuth } from '@/modules/auth/AuthContext';
import { cn } from '@/lib/utils';

interface MobileMoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const links = [
  { to: '/okr',        label: 'OKR',          icon: Target,    bg: 'bg-green-100 dark:bg-green-900/40',   color: '#22c55e' },
  { to: '/statistics', label: 'Statistiques', icon: BarChart2, bg: 'bg-violet-100 dark:bg-violet-900/40', color: '#8b5cf6' },
  { to: '/premium',    label: 'Premium',      icon: Crown,     bg: 'bg-amber-100 dark:bg-amber-900/40',   color: '#eab308' },
  { to: '/settings',   label: 'Paramètres',   icon: Settings,  bg: 'bg-slate-100 dark:bg-slate-700/60',   color: '#64748b' },
];

const MobileMoreSheet: React.FC<MobileMoreSheetProps> = ({ open, onOpenChange }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    onOpenChange(false);
    await logout();
    navigate('/welcome');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl border-t border-[rgb(var(--color-border))]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <SheetHeader className="text-left px-1 pb-2">
          <SheetTitle className="text-base font-semibold" style={{ color: 'rgb(var(--color-text-muted))' }}>
            Navigation
          </SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col gap-1">
          {links.map(({ to, label, icon: Icon, bg, color }) => (
            <SheetClose asChild key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-2 py-3 rounded-xl min-h-[52px] transition-colors',
                    'hover:bg-[rgb(var(--color-hover))]',
                    isActive && 'bg-[rgb(var(--color-active))]'
                  )
                }
              >
                <span className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', bg)}>
                  <Icon size={20} style={{ color }} aria-hidden="true" />
                </span>
                <span className="text-base font-medium" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  {label}
                </span>
              </NavLink>
            </SheetClose>
          ))}

          <div className="my-1 border-t" style={{ borderColor: 'rgb(var(--color-border))' }} />

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 px-2 py-3 rounded-xl min-h-[52px] text-left hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-red-100 dark:bg-red-900/40">
              <LogOut size={20} className="text-red-500" aria-hidden="true" />
            </span>
            <span className="text-base font-medium text-red-500">Déconnexion</span>
          </button>
        </nav>
      </SheetContent>
    </Sheet>
  );
};

export default MobileMoreSheet;
