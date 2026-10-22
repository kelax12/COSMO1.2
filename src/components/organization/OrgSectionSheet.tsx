// Feuille des sections de l'espace entreprise, sur MOBILE.
//
// Sortie d'`OrgSectionSwitcher` le 2026-10-15 et chargée au premier toucher
// (budget du chunk `OrganizationPage`) : le bouton est rendu à chaque visite,
// la feuille seulement quand on l'ouvre. Elle suit `MobileMoreSheet` :
// `useSheetMotion` (sûr sous mouvement réduit), `useBottomSheet` (la poignée
// tient son geste, C-07) et `useModalA11y` (piège de focus, Échap, C-53).
import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Search } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';
import { useSheetMotion } from '@/components/mobile/mobile-motion';
import { useModalA11y, mergeRefs } from '@/hooks/use-modal-a11y';
import { ORG_SECTION_GROUPS, type OrgNavItem, type OrgShortcutGroup } from './org-sections';

export interface SheetProps {
  items: OrgNavItem[];
  activeId: string;
  shortcuts?: OrgShortcutGroup;
  onClose: () => void;
  onSelect: (id: string) => void;
  onGo: (href: string) => void;
  onSearch?: () => void;
  onGlossary?: () => void;
}

const SectionSheet: React.FC<SheetProps> = ({ items, activeId, shortcuts, onClose, onSelect, onGo, onSearch, onGlossary }) => {
  const { t: tOrgAdmin } = useT('orgAdmin');
  const { t: tOrg } = useT('org');
  const sheetMotion = useSheetMotion();
  const { sheetRef, backdropOpacity, handleBarWidth, sheetDragProps } = useBottomSheet(onClose);
  const { ref: panelRef, dialogProps } = useModalA11y<HTMLDivElement>({
    open: true,
    onClose,
    label: tOrgAdmin('sideNav.label'),
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
          {onSearch && (
            <button
              type="button"
              onClick={onSearch}
              className="w-full flex items-center gap-2.5 px-4 min-h-touch rounded-2xl bg-[rgb(var(--color-surface))] text-body text-[rgb(var(--color-text-muted))] active:bg-[rgb(var(--color-hover))]"
            >
              <Search size={18} aria-hidden="true" />
              {tOrgAdmin('sideNav.search')}
            </button>
          )}
          {ORG_SECTION_GROUPS.map((group) => {
            const groupItems = items.filter((item) => item.group === group.id);
            if (groupItems.length === 0) return null;
            return (
              <div key={group.id}>
                <p className="px-1 pt-1 pb-1.5 text-caption font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
                  {tOrgAdmin(group.labelKey)}
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

          {onGlossary && (
            <button
              type="button"
              onClick={onGlossary}
              className="w-full flex items-center gap-2.5 px-4 min-h-touch rounded-2xl bg-[rgb(var(--color-surface))] text-body text-[rgb(var(--color-text-secondary))] active:bg-[rgb(var(--color-hover))]"
            >
              <BookOpen size={18} aria-hidden="true" />
              {tOrg('glossary.open')}
            </button>
          )}
          {shortcuts && shortcuts.items.length > 0 && (
            <div>
              <p className="px-1 pt-1 pb-1.5 text-caption font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
                {tOrgAdmin(shortcuts.kind === 'pinned' ? 'sideNav.groupPinned' : 'sideNav.groupRecent')}
              </p>
              <ul className="space-y-1">
                {shortcuts.items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onGo(item.href)}
                      className="w-full flex items-center gap-2.5 px-4 min-h-touch rounded-2xl bg-[rgb(var(--color-surface))] text-left text-body text-[rgb(var(--color-text-secondary))] active:bg-[rgb(var(--color-hover))]"
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${item.dotClass}`} aria-hidden="true" />
                      <span className="flex-1 min-w-0 truncate">{item.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
};

export default SectionSheet;
