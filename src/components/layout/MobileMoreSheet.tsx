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
  { to: '/okr',        label: 'OKR',          icon: Target,    color: '#22c55e' },
  { to: '/statistics', label: 'Statistiques', icon: BarChart2, color: '#8b5cf6' },
  { to: '/premium',    label: 'Premium',      icon: Crown,     color: '#eab308' },
  { to: '/settings',   label: 'Paramètres',   icon: Settings,  color: '#94a3b8' },
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
        className="rounded-t-2xl pb-safe max-h-[80vh] border-t border-[rgb(var(--color-border))]"
      >
        <SheetHeader className="text-left">
          <SheetTitle>Plus</SheetTitle>
        </SheetHeader>

        <nav className="mt-2 flex flex-col">
          {links.map(({ to, label, icon: Icon, color }) => (
            <SheetClose asChild key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-4 px-2 py-4 rounded-lg min-h-11 transition-colors',
                    'hover:bg-[rgb(var(--color-hover))]',
                    isActive && 'bg-[rgb(var(--color-active))]'
                  )
                }
              >
                <Icon size={22} style={{ color }} aria-hidden="true" />
                <span className="text-base font-medium text-[rgb(var(--color-text-primary))]">
                  {label}
                </span>
              </NavLink>
            </SheetClose>
          ))}

          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 flex items-center gap-4 px-2 py-4 rounded-lg min-h-11 text-left hover:bg-[rgb(var(--color-hover))] transition-colors"
          >
            <LogOut size={22} className="text-red-500" aria-hidden="true" />
            <span className="text-base font-medium text-red-500">Déconnexion</span>
          </button>
        </nav>
      </SheetContent>
    </Sheet>
  );
};

export default MobileMoreSheet;
