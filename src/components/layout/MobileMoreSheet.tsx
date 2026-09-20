import React from 'react';
import { useNavigate, useLocation } from 'react-router';
import { Target, BarChart2, Crown, Settings, LogOut, ChevronRight, Building2, Check, Plus, Bug, Repeat } from 'lucide-react';
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
import { useBottomSheet } from '@/hooks/use-bottom-sheet';
import { useSheetMotion } from '@/components/mobile/mobile-motion';
import { useT } from '@/i18n/useT';
import { useModalA11y, mergeRefs } from '@/hooks/use-modal-a11y';
import type { KeyOf } from '@/i18n/catalog';

interface MobileMoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * ── Maquettes 93 et 94 : la feuille « Plus » ──────────────────────────────
 *
 * 🔴 **Ce qui a été mesuré, et ce qui était faux.** La maquette 93 annonçait
 * « 8 rangées de 122 px, soit 976 px sur un écran de 844, Déconnexion jamais
 * visible ». **C'est faux, et l'erreur vient de moi** : j'avais lu des hauteurs
 * sur une capture en densité 2×, donc doublées. Mesure réelle au navigateur en
 * 390 × 844, le 2026-09-20 : rangées à **60 px**, icônes à **40 px**, feuille à
 * **643 px** de haut pour un écran de 844. Rien ne débordait, rien n'était
 * coupé, et « Déconnexion » était visible sans défiler.
 *
 * Ce qui restait vrai, lui, se lit dans le code : **huit couleurs saturées**
 * qui ne signifient rien (vert, violet, ambre, gris, jaune, indigo, bleu,
 * rouge), dont **deux rouges identiques** pour « Signaler un bug » et
 * « Déconnexion » — l'une ouvre un formulaire, l'autre termine la session.
 *
 * Ce qui change donc : les tuiles de couleur disparaissent, le rouge est rendu
 * à la seule action irréversible, les quatre blocs flottants deviennent deux
 * groupes NOMMÉS, et les sous-titres partent (« Créer une entreprise ou en
 * rejoindre une av… » était tronqué de toute façon).
 *
 * ❌ Ne jamais redonner une couleur de fond à ces icônes : elles ne classent
 * rien, et il n'y a pas huit familles à distinguer dans un menu de huit lignes.
 */
interface SheetLink {
  to: string;
  /** Clés de catalogue — `links` est une constante de module (cf. MobileTabBar). */
  labelKey: KeyOf<'common'>;
  icon: typeof Target;
}

const links: SheetLink[] = [
  { to: '/okr',        labelKey: 'nav.okr',        icon: Target    },
  { to: '/statistics', labelKey: 'nav.statistics', icon: BarChart2 },
  { to: '/premium',    labelKey: 'nav.premium',    icon: Crown     },
  { to: '/settings',   labelKey: 'nav.settings',   icon: Settings  },
];

/** Libellé de groupe, une seule définition pour les deux sections. */
const GroupLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="px-4 pt-1 pb-1.5 text-caption font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))]">
    {children}
  </p>
);

// « Habitudes » remplace son propre onglet dans la barre du bas dès qu'on
// appartient à une organisation (MobileTabBar : `showOrgTab`, « Entreprise »
// prend sa place plutôt que de s'ajouter en 6e position). Un commentaire de
// MobileTabBar affirmait « elle reste atteignable dans Plus, qui la liste
// déjà » — FAUX : elle n'y a jamais été. Aucun chemin mobile ne menait plus
// à /habits pour un membre d'organisation. Ajoutée ICI, conditionnelle au
// même déclencheur que le remplacement dans la barre — un compte SANS
// organisation la voit déjà en barre du bas, l'y dupliquer ferait doublon.
const habitsLink: SheetLink = { to: '/habits', labelKey: 'nav.habits', icon: Repeat };

const MobileMoreSheet: React.FC<MobileMoreSheetProps> = ({ open, onOpenChange }) => {
  const sheetMotion = useSheetMotion();
  const { t } = useT('common');
  const { t: tOrg } = useT('org');
  const { user, logout } = useAuth();
  const { isPremium } = useBilling();
  const { activeOrg: myOrg, organizations, setActiveOrgId } = useActiveOrganization();
  const navigate = useNavigate();
  const location = useLocation();

  // Filtre premium, ajoute « Habitudes » pour les membres d'une org (dont la
  // barre du bas ne porte plus cet onglet) puis « Entreprise ».
  const visibleLinks: SheetLink[] = [
    ...(PREMIUM_ENFORCED ? links : links.filter((l) => l.to !== '/premium')),
    ...(myOrg ? [habitsLink] : []),
    ...(myOrg
      ? [{ to: '/entreprise', labelKey: 'nav.enterprise' as const, icon: Building2 }]
      : []),
  ];

  const handleClose = () => onOpenChange(false);
  const { sheetRef, backdropOpacity, handleBarWidth, sheetDragProps } = useBottomSheet(handleClose);
  // C-53 — c'est le SEUL acces mobile a OKR, Statistiques, Parametres et a la
  // deconnexion : une feuille qui n'accueille pas le focus et qu'Echap ne ferme
  // pas y coute plus cher qu'ailleurs.
  const { ref: panelRef, dialogProps } = useModalA11y<HTMLDivElement>({
    open,
    onClose: handleClose,
    label: t('nav.moreOptions'),
  });

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
            // Ancre E2E : le voile sert de TEMOIN LOCAL a la mesure sous
            // mouvement reduit. Il est anime en opacite SEULE, donc sain par
            // construction ; s'il est eteint, c'est le harnais qui ne peint
            // pas, pas la feuille qui est cassee.
            data-mobile-more-sheet-backdrop
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            style={{ opacity: backdropOpacity }}
            onClick={handleClose}
          />

          {/* Sheet */}
          <motion.div
            ref={mergeRefs(sheetRef, panelRef)}
            {...dialogProps}
            // Point d'ancrage stable pour les E2E (navTo dans e2e/fixtures.ts) :
            // sans scope, `getByRole('button', { name: /okr/i })` matchait aussi
            // les MobileCollapsible de la page RESTÉE derrière la feuille (le
            // Dashboard en a un dont le titre contient « OKR »), et `.first()`
            // cliquait un élément recouvert par la feuille → timeout.
            data-mobile-more-sheet
            // ⚠️ `useSheetMotion` et pas un `initial={{ y }}` en dur : sous
            // `prefers-reduced-motion`, Framer ne joue pas les transforms et
            // la valeur `initial` reste appliquee — la feuille s ouvrait
            // 100 % sous l ecran. Mesure le 2026-08-24 (cf. mobile-motion.ts).
            {...sheetMotion}
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

              {/* — Aller à (maquette 93 : un groupe NOMMÉ, pas un bloc flottant) — */}
              <GroupLabel>{t('nav.sheetGoTo')}</GroupLabel>
              <div className="bg-[rgb(var(--color-surface))] rounded-2xl shadow-sm overflow-hidden -mt-2">
                {visibleLinks.map(({ to, labelKey, icon: Icon }, idx) => {
                  const row = (
                    <button
                      type="button"
                      onPointerDown={() => prefetchRoute(to)}
                      onClick={to === '/entreprise' && organizations.length > 1 ? undefined : () => handleNav(to)}
                      className={[
                        'w-full flex items-center gap-3 px-4 min-h-touch py-2.5 text-left transition-colors',
                        'active:bg-[rgb(var(--color-hover))]',
                        location.pathname === to ? 'bg-[rgb(var(--color-hover))]' : '',
                      ].join(' ')}
                      aria-current={location.pathname === to ? 'page' : undefined}
                    >
                      {/* Maquette 94 : l'icône repère, elle ne classe pas. */}
                      <Icon size={19} className="shrink-0 text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
                      <span className="flex-1 min-w-0 text-body font-medium text-[rgb(var(--color-text-primary))] leading-snug">
                        {t(labelKey)}
                        {to === '/premium' && isPremium() && (
                          <span className="ml-2 text-caption font-semibold text-amber-500 uppercase tracking-wide">{t('nav.premiumActive')}</span>
                        )}
                      </span>
                      <ChevronRight size={16} className="text-[rgb(var(--color-text-muted))] shrink-0" />
                    </button>
                  );

                  return (
                    <React.Fragment key={to}>
                      {idx > 0 && (
                        <div className="h-px bg-[rgb(var(--color-border-muted))] ml-[48px]" />
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

              {/* — Autre — Trois blocs flottants sont devenus UN groupe nommé.
                  « Inviter / rejoindre » reste monté que l'entrée « Entreprise »
                  existe ou non : c'est le point d'entrée de quelqu'un qui
                  n'appartient encore à aucune organisation. Les deux fenêtres
                  vivent dans Layout, on les demande par évènement. */}
              <GroupLabel>{t('nav.sheetOther')}</GroupLabel>
              <div className="bg-[rgb(var(--color-surface))] rounded-2xl shadow-sm overflow-hidden -mt-2">
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    window.dispatchEvent(new CustomEvent("open-invite-join"));
                  }}
                  className="w-full flex items-center gap-3 px-4 min-h-touch py-2.5 text-left active:bg-[rgb(var(--color-hover))] transition-colors"
                >
                  <Plus size={19} className="shrink-0 text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
                  <span className="flex-1 min-w-0 text-body font-medium text-[rgb(var(--color-text-primary))] leading-snug">
                    {tOrg('inviteJoin.navLabel')}
                  </span>
                  <ChevronRight size={16} className="text-[rgb(var(--color-text-muted))] shrink-0" />
                </button>

                <div className="h-px bg-[rgb(var(--color-border-muted))] ml-[48px]" />

                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    window.dispatchEvent(new CustomEvent('open-bug-report'));
                  }}
                  className="w-full flex items-center gap-3 px-4 min-h-touch py-2.5 text-left active:bg-[rgb(var(--color-hover))] transition-colors"
                >
                  <Bug size={19} className="shrink-0 text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
                  <span className="flex-1 min-w-0 text-body font-medium text-[rgb(var(--color-text-primary))] leading-snug">
                    {t('nav.bugReport')}
                  </span>
                  <ChevronRight size={16} className="text-[rgb(var(--color-text-muted))] shrink-0" />
                </button>

                <div className="h-px bg-[rgb(var(--color-border-muted))] ml-[48px]" />

                {/* 🔴 Maquette 94 : le SEUL rouge de la feuille. « Signaler un
                    bug » portait exactement la même tuile rouge, alors qu'il
                    ouvre un formulaire, là où celui-ci termine la session. */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 min-h-touch py-2.5 text-left active:bg-red-50 dark:active:bg-red-900/20 transition-colors"
                >
                  <LogOut size={19} className="shrink-0 text-[rgb(var(--color-error))]" aria-hidden="true" />
                  <span className="flex-1 text-body font-medium text-[rgb(var(--color-error))]">
                    {t('nav.logout')}
                  </span>
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
