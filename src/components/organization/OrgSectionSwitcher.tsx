import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';
import { useSheetMotion } from '@/components/mobile/mobile-motion';
import { useModalA11y, mergeRefs } from '@/hooks/use-modal-a11y';
import { orgSectionPath } from './deep-link.helpers';
import { ORG_SECTION_GROUPS, type OrgNavItem } from './org-sections';

interface Props {
  items: OrgNavItem[];
  activeId: string;
}

/**
 * Sélecteur de section de l'espace entreprise, sur MOBILE (sous `md`).
 *
 * Le panneau de droite (`OrgSideNav`) n'a pas sa place sur 375 px : il
 * mangerait le contenu. Ici, la section courante est un bouton pleine largeur
 * (« Projets ▾ ») qui ouvre une feuille du bas en grille (maquette M1 du
 * 2026-09-23). Il remplace la rangée de pilules défilante, où quatre
 * destinations sur sept étaient hors champ.
 *
 * La feuille suit `MobileMoreSheet` : `useSheetMotion` (sûr sous mouvement
 * réduit), `useBottomSheet` (la poignée tient son geste, C-07) et
 * `useModalA11y` (piège de focus, Échap, C-53).
 */
const OrgSectionSwitcher: React.FC<Props> = ({ items, activeId }) => {
  const { t } = useT('org');
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const active = items.find((item) => item.id === activeId);
  const newsCount = items.reduce((sum, item) => sum + item.badgeCount, 0);

  return (
    <div className="md:hidden mb-5">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('sideNav.switchSection', { section: active?.label ?? '' })}
        data-org-section-switcher=""
        className="w-full flex items-center gap-2.5 px-4 min-h-touch rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-left active:bg-[rgb(var(--color-hover))] transition-colors"
      >
        {active && <active.Icon size={18} aria-hidden="true" className="shrink-0 text-[rgb(var(--color-accent-solid))]" />}
        <span className="flex-1 min-w-0 truncate text-body font-semibold text-[rgb(var(--color-text-primary))]">
          {active?.label}
        </span>
        {/* Le total des nouveautés, ailleurs que dans la section courante : la
            feuille fermée ne doit pas les cacher. */}
        {newsCount > 0 && (
          <span
            aria-hidden="true"
            className="min-w-[18px] h-[18px] px-1 rounded-full bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] text-caption font-bold inline-flex items-center justify-center"
          >
            {newsCount}
          </span>
        )}
        <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-[rgb(var(--color-text-muted))]" />
      </button>

      <AnimatePresence>
        {open && (
          <SectionSheet
            items={items}
            activeId={activeId}
            onClose={() => setOpen(false)}
            onSelect={(id) => {
              setOpen(false);
              navigate(orgSectionPath(id));
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

interface SheetProps {
  items: OrgNavItem[];
  activeId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
}

const SectionSheet: React.FC<SheetProps> = ({ items, activeId, onClose, onSelect }) => {
  const { t } = useT('org');
  const sheetMotion = useSheetMotion();
  const { sheetRef, backdropOpacity, handleBarWidth, sheetDragProps } = useBottomSheet(onClose);
  const { ref: panelRef, dialogProps } = useModalA11y<HTMLDivElement>({
    open: true,
    onClose,
    label: t('sideNav.label'),
  });

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        style={{ opacity: backdropOpacity }}
        onClick={onClose}
      />
      <motion.div
        ref={mergeRefs(sheetRef, panelRef)}
        {...dialogProps}
        data-org-section-sheet=""
        {...sheetMotion}
        className="fixed bottom-0 inset-x-0 z-50 rounded-t-[28px] bg-[rgb(var(--color-background))] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        {...sheetDragProps}
      >
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <motion.div
            className="h-[5px] rounded-full bg-[rgb(var(--color-border-strong))]"
            style={{ width: handleBarWidth }}
          />
        </div>

        <div className="px-4 pb-5 flex flex-col gap-3" data-scroll-area>
          {ORG_SECTION_GROUPS.map((group) => {
            const groupItems = items.filter((item) => item.group === group.id);
            if (groupItems.length === 0) return null;
            return (
              <div key={group.id}>
                <p className="px-1 pt-1 pb-1.5 text-caption font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))]">
                  {t(group.labelKey)}
                </p>
                <ul className="grid grid-cols-3 gap-2">
                  {groupItems.map(({ id, label, Icon, badgeCount, badgeAriaLabel }) => {
                    const active = id === activeId;
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          onClick={() => onSelect(id)}
                          aria-current={active ? 'page' : undefined}
                          className={`relative w-full min-h-[76px] rounded-2xl flex flex-col items-center justify-center gap-1.5 px-1 text-caption font-medium transition-colors ${
                            active
                              ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]'
                              : 'bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-secondary))] active:bg-[rgb(var(--color-hover))]'
                          }`}
                        >
                          <Icon size={20} aria-hidden="true" />
                          <span className="max-w-full truncate">{label}</span>
                          {badgeCount > 0 && (
                            <span
                              aria-label={badgeAriaLabel}
                              className={`absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-caption font-bold inline-flex items-center justify-center ${
                                active
                                  ? 'bg-[rgb(var(--color-accent-solid-foreground))] text-[rgb(var(--color-accent-solid))]'
                                  : 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]'
                              }`}
                            >
                              {badgeCount}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </motion.div>
    </>
  );
};

export default OrgSectionSwitcher;
