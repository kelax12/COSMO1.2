import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { ChevronsRight } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { PAGE_RIGHT_RAIL_ID } from '@/components/layout/page-right-rail';
import { orgSectionPath } from './deep-link.helpers';
import { ORG_SECTION_GROUPS, type OrgNavItem } from './org-sections';

interface Props {
  items: OrgNavItem[];
  activeId: string;
  /** État porté par la page (`useOrgNavCollapsed`) : elle réserve la place du panneau ouvert. */
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

/** Largeur de la carte, marge au bord, et ce qu'il en reste de visible une fois repliée. */
const ORG_NAV_WIDTH = 208;
const EDGE_GAP = 12;
const PEEK = 10;

/**
 * Courbe de sortie franche : le panneau part vite et se pose en douceur. Posée
 * en `style` et pas en classe arbitraire : `ease-[cubic-bezier(…)]` est
 * ambigu pour Tailwind, qui le signale à chaque build.
 */
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

/**
 * Navigation de l'espace entreprise, à DROITE de la page (desktop, `md` et plus).
 *
 * Une carte FLOTTANTE aux coins arrondis, centrée verticalement (demande d'Axel
 * du 2026-09-23 : « format pop-up », plutôt qu'une vraie barre pleine hauteur).
 *
 * - **Ouverte** (défaut) : la carte entière, groupes nommés.
 * - **Repliée** : la carte glisse hors de l'écran et n'en laisse que 10 px au
 *   bord. Dès que le curseur approche du bord, elle ressort, SANS délai : un
 *   délai de 150 ms rendait l'ouverture pâteuse. Une zone d'approche invisible
 *   pleine hauteur rattrape le curseur même hors de la hauteur de la carte.
 *
 * ⚠️ Le mouvement ne passe que par `transform` (composité par le GPU, aucune
 * remise en page pendant l'animation). Une transition de LARGEUR recalculait
 * toute la page à chaque image. Sous `prefers-reduced-motion`, la transition
 * saute (`motion-reduce:transition-none`) : c'est une transition CSS entre deux
 * classes, l'état final vient toujours du CSS, rien ne peut rester coincé à
 * mi-course comme avec un `initial` Framer.
 *
 * ⚠️ La zone d'approche est un vrai `<button>` : le survol est un geste de
 * souris, le clavier et le tactile doivent pouvoir rouvrir (WCAG 2.1.1).
 * Repliée, la carte est `inert` : ses liens hors écran ne prennent plus le focus.
 *
 * ⚠️ Rendue par PORTAIL dans l'emplacement que `Layout` pose hors de `<main>`
 * (cf. `page-right-rail.ts`) : sur mobile, pas d'emplacement, donc rien.
 *
 * ⚠️ Pas de `role="tablist"` : ce sont des liens vers des routes, et
 * `aria-current="page"` dit lequel est actif, ce qui est exact.
 */
const OrgSideNav: React.FC<Props> = ({ items, activeId, collapsed, onCollapsedChange }) => {
  const { t } = useT('org');
  const card = useRef<HTMLDivElement>(null);
  // L'emplacement est posé par `Layout` dans le même commit que cette page :
  // il n'existe pas encore pendant le premier rendu, on le cherche après.
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setSlot(document.getElementById(PAGE_RIGHT_RAIL_ID));
  }, []);

  // `inert` n'est pas typé par React 18 : posé à la main.
  useEffect(() => {
    const el = card.current;
    if (!el) return;
    if (collapsed) el.setAttribute('inert', '');
    else el.removeAttribute('inert');
  }, [collapsed, slot]);

  const open = () => onCollapsedChange(false);
  const hasNews = items.some((item) => item.badgeCount > 0);

  if (!slot) return null;

  return createPortal(
    <nav
      aria-label={t('sideNav.label')}
      data-org-side-nav=""
      data-collapsed={collapsed}
      className="hidden md:flex fixed inset-y-0 right-0 z-30 items-center pointer-events-none"
    >
      {/* Zone d'approche : pleine hauteur, au bord, seulement repliée. */}
      {collapsed && (
        <button
          type="button"
          onClick={open}
          onPointerEnter={open}
          aria-label={hasNews ? `${t('sideNav.expand')} · ${t('sideNav.hasNews')}` : t('sideNav.expand')}
          aria-expanded={false}
          title={`${t('sideNav.expand')} (])`}
          className="pointer-events-auto absolute inset-y-0 right-0 w-5 focus-visible:outline-none focus-visible:bg-[rgb(var(--color-accent)/0.2)]"
        />
      )}

      <div
        ref={card}
        onPointerEnter={collapsed ? open : undefined}
        className="pointer-events-auto relative flex flex-col max-h-[calc(100dvh-24px)] overflow-y-auto overflow-x-hidden rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] shadow-xl shadow-black/20 py-3 px-2 will-change-transform transition-transform duration-300 motion-reduce:transition-none"
        style={{
          width: ORG_NAV_WIDTH,
          marginRight: EDGE_GAP,
          transform: collapsed ? `translateX(${ORG_NAV_WIDTH + EDGE_GAP - PEEK}px)` : 'translateX(0)',
          transitionTimingFunction: EASE,
        }}
      >
        {/* Repliée, la notification ne disparaît pas avec la carte : un point
            dans les 10 px qui restent visibles. */}
        {collapsed && hasNews && (
          <span
            aria-hidden="true"
            className="absolute top-1/2 left-[2px] -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[rgb(var(--color-accent-solid))]"
          />
        )}

        <div className="flex items-center justify-between gap-2 pl-3 pr-1 pb-1">
          <span className="text-sm font-semibold text-[rgb(var(--color-text-primary))] truncate">
            {t('sideNav.title')}
          </span>
          <button
            type="button"
            onClick={() => onCollapsedChange(true)}
            aria-label={t('sideNav.collapse')}
            aria-expanded={true}
            title={`${t('sideNav.collapse')} (])`}
            className="min-w-11 min-h-11 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors"
          >
            <ChevronsRight size={16} aria-hidden="true" />
          </button>
        </div>

        {ORG_SECTION_GROUPS.map((group) => {
          const groupItems = items.filter((item) => item.group === group.id);
          if (groupItems.length === 0) return null;
          return (
            <div key={group.id} className="mt-2">
              <p className="px-3 pb-1 text-caption font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))]">
                {t(group.labelKey)}
              </p>
              <ul className="space-y-0.5">
                {groupItems.map(({ id, label, Icon, badge }) => {
                  const active = activeId === id;
                  return (
                    <li key={id}>
                      <Link
                        to={orgSectionPath(id)}
                        aria-current={active ? 'page' : undefined}
                        data-active={active}
                        className={`flex items-center gap-2.5 px-3 min-h-11 rounded-xl text-sm font-medium transition-colors ${
                          active
                            ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]'
                            : 'text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))]'
                        }`}
                      >
                        <Icon size={17} aria-hidden="true" className="shrink-0" />
                        <span className="flex-1 min-w-0 truncate">{label}</span>
                        {badge}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>,
    slot,
  );
};

export default OrgSideNav;
