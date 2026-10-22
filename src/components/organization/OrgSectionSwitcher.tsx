import React, { Suspense, useState } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { orgSectionPath } from './deep-link.helpers';
import type { OrgNavItem, OrgShortcutGroup } from './org-sections';

// La feuille n'arrive qu'au premier toucher (budget de `OrganizationPage`).
const SectionSheet = lazyWithRetry(() => import('./OrgSectionSheet'));

interface Props {
  items: OrgNavItem[];
  activeId: string;
  /** Même groupe « Épinglés / Récents » que le panneau desktop. */
  shortcuts?: OrgShortcutGroup;
  onSearch?: () => void;
  /** Glossaire : il a quitté l'en-tête mobile (maquette 236). */
  onGlossary?: () => void;
  /** Section courante absente de `items` (section masquée, ex. Statistiques) :
   *  sans elle, le bouton s'affichait VIDE (maquette 275). */
  fallbackActive?: Pick<OrgNavItem, 'label' | 'Icon'>;
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
 * La feuille (`OrgSectionSheet`) arrive en lazy au premier toucher.
 */
const OrgSectionSwitcher: React.FC<Props> = ({ items, activeId, shortcuts, onSearch, onGlossary, fallbackActive }) => {
  const { t: tOrgAdmin } = useT('orgAdmin');
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const active = items.find((item) => item.id === activeId) ?? fallbackActive;

  return (
    <div className="md:hidden mb-5">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={tOrgAdmin('sideNav.switchSection', { section: active?.label ?? '' })}
        data-org-section-switcher=""
        className="w-full flex items-center gap-2.5 px-4 min-h-touch rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-left active:bg-[rgb(var(--color-hover))] transition-colors"
      >
        {active && <active.Icon size={18} aria-hidden="true" className="shrink-0 text-[rgb(var(--color-accent-solid))]" />}
        <span className="flex-1 min-w-0 truncate text-body font-semibold text-[rgb(var(--color-text-primary))]">
          {active?.label}
        </span>
        {/* Maquette 226 (2026-10-10) : plus de total ici. Le même écran
            affichait 1 (onglet), 3 (cloche), 6 (ce bouton), 6 (« En attente
            de moi ») : le nombre ne vit plus que dans la section qui le fait
            baisser, et dans la feuille, section par section. */}
        <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-[rgb(var(--color-text-muted))]" />
      </button>

      <AnimatePresence>
        {open && (
          <Suspense key="org-section-sheet" fallback={null}>
            <SectionSheet
              items={items}
              activeId={activeId}
              shortcuts={shortcuts}
              onClose={() => setOpen(false)}
              onSelect={(id) => {
                setOpen(false);
                navigate(orgSectionPath(id));
              }}
              onGo={(href) => {
                setOpen(false);
                navigate(href);
              }}
              onSearch={onSearch ? () => { setOpen(false); onSearch(); } : undefined}
              onGlossary={onGlossary ? () => { setOpen(false); onGlossary(); } : undefined}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OrgSectionSwitcher;
