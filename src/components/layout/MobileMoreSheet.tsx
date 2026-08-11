import React from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Target, BarChart2, Crown, Settings, LogOut, ChevronRight, Building2, Check, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/modules/auth/AuthContext';
import { prefetchRoute } from '@/lib/route-prefetch';
import { useBilling } from '@/modules/billing/billing.context';
import { PREMIUM_ENFORCED } from '@/modules/billing/premium-config';
import { useActiveOrganization } from '@/modules/organizations';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useActiveModules, type ModuleKey } from '@/modules/ui-states';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';

interface MobileMoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SheetLink {
  to: string;
  /** Clés de catalogue — `links` est une constante de module (cf. MobileTabBar). */
  labelKey: KeyOf<'common'>;
  descriptionKey: KeyOf<'common'>;
  icon: typeof Target;
  iconBg: string;
  /** Onglet optionnel filtré selon AM10 (undefined → toujours visible). */
  module?: ModuleKey;
}

const links: SheetLink[] = [
  { to: '/okr',        labelKey: 'nav.okr',        descriptionKey: 'nav.descriptions.okr',        icon: Target,    iconBg: 'bg-green-500',  module: 'okr' },
  { to: '/statistics', labelKey: 'nav.statistics', descriptionKey: 'nav.descriptions.statistics', icon: BarChart2, iconBg: 'bg-violet-500', module: 'statistics' },
  { to: '/premium',    labelKey: 'nav.premium',    descriptionKey: 'nav.descriptions.premium',    icon: Crown,     iconBg: 'bg-amber-400'  },
  { to: '/settings',   labelKey: 'nav.settings',   descriptionKey: 'nav.descriptions.settings',   icon: Settings,  iconBg: 'bg-gray-500'   },
];

const MobileMoreSheet: React.FC<MobileMoreSheetProps> = ({ open, onOpenChange }) => {
  const { t } = useT('common');
  const { t: tOrg } = useT('org');
  const { user, logout } = useAuth();
  const { isPremium } = useBilling();
  const { activeOrg: myOrg, organizations, setActiveOrgId } = useActiveOrganization();
  const activeModules = useActiveModules();
  const navigate = useNavigate();
  const location = useLocation();

  // Filtre par module actif (AM10), puis par premium, puis ajoute l'entrée
  // « Entreprise » pour les membres d'une org.
  const visibleLinks: SheetLink[] = [
    ...(PREMIUM_ENFORCED ? links : links.filter((l) => l.to !== '/premium')).filter(
      (link) => !link.module || activeModules[link.module]
    ),
    ...(myOrg
      ? [{
          to: '/entreprise',
          labelKey: 'nav.enterprise' as const,
          descriptionKey: 'nav.descriptions.enterprise' as const,
          icon: Building2,
          iconBg: 'bg-indigo-500',
        }]
      : []),
  ];

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
            // Point d'ancrage stable pour les E2E (navTo dans e2e/fixtures.ts) :
            // sans scope, `getByRole('button', { name: /okr/i })` matchait aussi
            // les MobileCollapsible de la page RESTÉE derrière la feuille (le
            // Dashboard en a un dont le titre contient « OKR »), et `.first()`
            // cliquait un élément recouvert par la feuille → timeout.
            data-mobile-more-sheet
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
            className="fixed bottom-0 inset-x-0 z-50 rounded-t-[28px] bg-[rgb(var(--color-background))] flex flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            {...sheetDragProps}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2.5 pb-1 shrink-0">
              <motion.div
                className="h-[5px] rounded-full bg-[rgb(var(--color-border-strong))]"
                style={{ width: handleBarWidth }}
              />
            </div>

            {/* Content */}
            <div className="px-4 pb-5 flex flex-col gap-3" data-scroll-area>

              {/* — Profile card — */}
              <div className="bg-[rgb(var(--color-surface))] rounded-2xl shadow-sm overflow-hidden">
                <button
                  type="button"
                  onPointerDown={() => prefetchRoute('/settings')}
                  onClick={() => handleNav('/settings')}
                  className="w-full flex items-center gap-3.5 px-4 min-h-[72px] active:bg-[rgb(var(--color-hover))] transition-colors"
                  aria-label={t('nav.goToSettings')}
                >
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br bg-[rgb(var(--color-accent-solid))] flex items-center justify-center shrink-0 overflow-hidden">
                    {user?.avatar ? (
                      <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-[17px] font-semibold">{initials}</span>
                    )}
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[15px] font-semibold text-[rgb(var(--color-text-primary))] truncate leading-snug">
                      {user?.name ?? t('nav.userFallback')}
                    </p>
                    <p className="text-[13px] text-[rgb(var(--color-text-muted))] truncate mt-0.5 leading-snug">
                      {user?.email ?? ''}
                    </p>
                  </div>

                  {/* Premium badge or chevron */}
                  <div className="flex items-center gap-2 shrink-0">
                    {PREMIUM_ENFORCED && isPremium() && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 text-[11px] font-semibold uppercase tracking-wide">
                        {t('nav.premium')}
                      </span>
                    )}
                    <ChevronRight size={18} className="text-[rgb(var(--color-text-muted))]" />
                  </div>
                </button>
              </div>

              {/* — Navigation links — */}
              <div className="bg-[rgb(var(--color-surface))] rounded-2xl shadow-sm overflow-hidden">
                {visibleLinks.map(({ to, labelKey, icon: Icon, iconBg, descriptionKey }, idx) => {
                  const row = (
                    <button
                      type="button"
                      onPointerDown={() => prefetchRoute(to)}
                      onClick={to === '/entreprise' && organizations.length > 1 ? undefined : () => handleNav(to)}
                      className={[
                        'w-full flex items-center gap-3.5 px-4 min-h-[60px] text-left transition-colors',
                        'active:bg-[rgb(var(--color-hover))]',
                        location.pathname === to ? 'bg-[rgb(var(--color-hover))]' : '',
                      ].join(' ')}
                      aria-current={location.pathname === to ? 'page' : undefined}
                    >
                      {/* Icon square */}
                      <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 ${iconBg}`}>
                        <Icon size={20} className="text-white" aria-hidden="true" />
                      </div>

                      {/* Label + description */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-medium text-[rgb(var(--color-text-primary))] leading-snug">
                          {t(labelKey)}
                          {to === '/premium' && isPremium() && (
                            <span className="ml-2 text-[11px] font-semibold text-amber-500 uppercase tracking-wide">{t('nav.premiumActive')}</span>
                          )}
                        </p>
                        <p className="text-[12px] text-[rgb(var(--color-text-muted))] mt-0.5 truncate">
                          {t(descriptionKey)}
                        </p>
                      </div>

                      <ChevronRight size={16} className="text-[rgb(var(--color-text-muted))] shrink-0" />
                    </button>
                  );

                  return (
                    <React.Fragment key={to}>
                      {idx > 0 && (
                        <div className="h-px bg-[rgb(var(--color-border))] ml-[68px]" />
                      )}
                      {/* Plusieurs organisations : le tap ouvre le choix au lieu de
                          naviguer directement (une seule entrée « Entreprise »). */}
                      {to === '/entreprise' && organizations.length > 1 ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>{row}</DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>{tOrg('switcher.myOrgs')}</DropdownMenuLabel>
                            {organizations.map((org) => (
                              <DropdownMenuItem
                                key={org.id}
                                onClick={() => { setActiveOrgId(org.id); handleNav('/entreprise'); }}
                              >
                                <span className="truncate">{org.name}</span>
                                <span className="ml-auto flex items-center gap-1.5">
                                  {org.id === myOrg?.id && <Check size={14} aria-hidden="true" />}
                                </span>
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleNav('/entreprise/onboarding')}>
                              <Plus size={14} aria-hidden="true" /> {tOrg('switcher.createOrJoin')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : row}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* — Logout — */}
              <div className="bg-[rgb(var(--color-surface))] rounded-2xl shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3.5 px-4 min-h-[60px] text-left active:bg-red-50 dark:active:bg-red-900/20 transition-colors"
                >
                  <div className="w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 bg-red-500">
                    <LogOut size={20} className="text-white" aria-hidden="true" />
                  </div>
                  <p className="flex-1 text-[15px] font-medium text-red-500">
                    {t('nav.logout')}
                  </p>
                  <ChevronRight size={16} className="text-[rgb(var(--color-text-muted))] shrink-0" />
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
