import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Target, BarChart2, Crown, Settings, LogOut, ChevronRight, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/modules/auth/AuthContext';
import { useBilling } from '@/modules/billing/billing.context';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';

interface MobileMoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const links = [
  { to: '/okr',        label: 'OKR',          icon: Target,    iconBg: 'bg-green-500',  description: 'Objectifs & résultats' },
  { to: '/statistics', label: 'Statistiques', icon: BarChart2, iconBg: 'bg-violet-500', description: 'Suivi de progression'  },
  { to: '/premium',    label: 'Premium',       icon: Crown,     iconBg: 'bg-amber-400',  description: 'Débloquer toutes les fonctions' },
  { to: '/settings',   label: 'Paramètres',   icon: Settings,  iconBg: 'bg-gray-500',   description: 'Compte & préférences'  },
];

const MobileMoreSheet: React.FC<MobileMoreSheetProps> = ({ open, onOpenChange }) => {
  const { user, logout } = useAuth();
  const { isPremium } = useBilling();
  const navigate = useNavigate();
  const location = useLocation();

  const handleClose = () => onOpenChange(false);
  const { sheetRef, backdropOpacity, handleBarWidth, sheetDragProps } = useBottomSheet(handleClose);

  const handleLogout = async () => {
    handleClose();
    await logout();
    navigate('/');
  };

  const handleNav = (to: string) => {
    handleClose();
    navigate(to);
  };

  const handleSearch = () => {
    handleClose();
    // Laisse la feuille se fermer avant d'ouvrir la palette (overlay propre).
    setTimeout(() => window.dispatchEvent(new CustomEvent('open-command-palette')), 280);
  };

  const initials = user
    ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            style={{ opacity: backdropOpacity }}
            onClick={handleClose}
          />

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
            className="fixed bottom-0 inset-x-0 z-50 rounded-t-[28px] bg-gray-50 dark:bg-gray-950 flex flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            {...sheetDragProps}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <motion.div
                className="h-[5px] rounded-full bg-gray-300 dark:bg-gray-700"
                style={{ width: handleBarWidth }}
              />
            </div>

            {/* Content */}
            <div className="px-4 pb-5 flex flex-col gap-3" data-scroll-area>

              {/* — Profile card — */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => handleNav('/settings')}
                  className="w-full flex items-center gap-3.5 px-4 min-h-[72px] active:bg-gray-100 dark:active:bg-gray-800 transition-colors"
                  aria-label="Aller aux paramètres"
                >
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shrink-0 overflow-hidden">
                    {user?.avatar ? (
                      <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-[17px] font-semibold">{initials}</span>
                    )}
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 truncate leading-snug">
                      {user?.name ?? 'Utilisateur'}
                    </p>
                    <p className="text-[13px] text-gray-500 dark:text-gray-400 truncate mt-0.5 leading-snug">
                      {user?.email ?? ''}
                    </p>
                  </div>

                  {/* Premium badge or chevron */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isPremium() && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 text-[11px] font-semibold uppercase tracking-wide">
                        Premium
                      </span>
                    )}
                    <ChevronRight size={18} className="text-gray-400 dark:text-gray-600" />
                  </div>
                </button>
              </div>

              {/* — Recherche (palette de commandes) — */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={handleSearch}
                  className="w-full flex items-center gap-3.5 px-4 min-h-[60px] text-left transition-colors active:bg-gray-100 dark:active:bg-gray-800"
                  aria-label="Rechercher (navigation et actions rapides)"
                >
                  <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 bg-blue-500">
                    <Search size={20} className="text-white" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-gray-900 dark:text-gray-100 leading-snug">
                      Rechercher
                    </p>
                    <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                      Navigation & actions rapides
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 dark:text-gray-600 shrink-0" />
                </button>
              </div>

              {/* — Navigation links — */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden">
                {links.map(({ to, label, icon: Icon, iconBg, description }, idx) => (
                  <React.Fragment key={to}>
                    {idx > 0 && (
                      <div className="h-px bg-gray-200/80 dark:bg-gray-700/60 ml-[68px]" />
                    )}
                    <button
                      type="button"
                      onClick={() => handleNav(to)}
                      className={[
                        'w-full flex items-center gap-3.5 px-4 min-h-[60px] text-left transition-colors',
                        'active:bg-gray-100 dark:active:bg-gray-800',
                        location.pathname === to ? 'bg-gray-50 dark:bg-gray-800/50' : '',
                      ].join(' ')}
                      aria-current={location.pathname === to ? 'page' : undefined}
                    >
                      {/* Icon square */}
                      <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 ${iconBg}`}>
                        <Icon size={20} className="text-white" aria-hidden="true" />
                      </div>

                      {/* Label + description */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-medium text-gray-900 dark:text-gray-100 leading-snug">
                          {label}
                          {to === '/premium' && isPremium() && (
                            <span className="ml-2 text-[11px] font-semibold text-amber-500 uppercase tracking-wide">Actif</span>
                          )}
                        </p>
                        <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                          {description}
                        </p>
                      </div>

                      <ChevronRight size={16} className="text-gray-300 dark:text-gray-600 shrink-0" />
                    </button>
                  </React.Fragment>
                ))}
              </div>

              {/* — Logout — */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3.5 px-4 min-h-[60px] text-left active:bg-red-50 dark:active:bg-red-900/20 transition-colors"
                >
                  <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 bg-red-500">
                    <LogOut size={20} className="text-white" aria-hidden="true" />
                  </div>
                  <p className="flex-1 text-[15px] font-medium text-red-500">
                    Déconnexion
                  </p>
                  <ChevronRight size={16} className="text-gray-300 dark:text-gray-600 shrink-0" />
                </button>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default MobileMoreSheet;
