import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { ChevronsRight } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { readJson, safeSetItem } from '@/lib/safe-json';
import { PAGE_RIGHT_RAIL_ID } from '@/components/layout/page-right-rail';
import { orgSectionPath } from './deep-link.helpers';
import { ORG_SECTION_GROUPS, type OrgNavItem } from './org-sections';

interface Props {
  items: OrgNavItem[];
  activeId: string;
}

const STORAGE_KEY = 'org-nav-collapsed';

/**
 * Délai avant qu'un survol de la bande rouvre le panneau. Sans lui, un curseur
 * qui file vers la barre de défilement de la page, collée à la bande, le
 * rouvrirait au passage.
 */
const HOVER_OPEN_DELAY_MS = 150;

/**
 * Navigation de l'espace entreprise, à DROITE de la page (desktop, `md` et plus).
 *
 * POURQUOI À DROITE, et pas une rangée d'onglets : l'espace entreprise est une
 * page qui contient sept pages. En pilules au-dessus du contenu, elles
 * empiétaient sur la page et ne se lisaient pas comme une navigation (demande
 * d'Axel du 2026-09-23, maquette « B · panneau groupé »). La sidebar de l'app
 * reste à gauche ; celle-ci, à droite, dit « tu es dans un espace à part ».
 *
 * Deux états, et PAS de rail d'icônes (choix explicite) :
 * - **ouvert** (défaut) : 200 px, trois groupes nommés ;
 * - **replié** : il n'en reste qu'une bande de 10 px au bord droit. La toucher
 *   au curseur ROUVRE le panneau, durablement, jusqu'au prochain repli.
 *
 * ⚠️ La bande est un vrai `<button>`, et ce n'est pas une finition : un survol
 * est un geste de souris. Sans bouton, un utilisateur clavier ou tactile ne
 * pourrait plus jamais rouvrir la navigation (WCAG 2.1.1, niveau A).
 *
 * ⚠️ Le mouvement porte sur la LARGEUR, jamais sur un transform : sous
 * `prefers-reduced-motion`, un `translateX` d'entrée resterait appliqué et
 * laisserait le panneau hors écran (cf. `src/components/CLAUDE.md`).
 *
 * ⚠️ Rendue par PORTAIL dans l'emplacement que `Layout` pose à droite de
 * `<main>`, hors de la zone qui défile (cf. `page-right-rail.ts`) : sinon la
 * barre de défilement de la page s'intercalait entre la bande et le bord.
 *
 * ⚠️ Pas de `role="tablist"` : ce sont des liens vers des routes, et
 * `aria-current="page"` dit lequel est actif, ce qui est exact.
 */
const OrgSideNav: React.FC<Props> = ({ items, activeId }) => {
  const { t } = useT('org');
  // Lecture tolérante : une valeur corrompue ou un stockage refusé ne doit pas
  // fermer la page (B14). Ouvert par défaut.
  const [collapsed, setCollapsed] = useState(() => readJson<boolean>(STORAGE_KEY) === true);
  const hoverTimer = useRef<number | undefined>(undefined);
  // L'emplacement est posé par `Layout` dans le même commit que cette page :
  // il n'existe pas encore pendant le premier rendu, on le cherche après.
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setSlot(document.getElementById(PAGE_RIGHT_RAIL_ID));
  }, []);

  useEffect(() => {
    safeSetItem(STORAGE_KEY, JSON.stringify(collapsed));
  }, [collapsed]);

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  // Raccourci « ] » : symétrique du « [ » qui replie la sidebar de gauche
  // (`Layout.tsx`), avec la même garde contre les champs de saisie.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const editable =
        el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if (e.key === ']' && !e.metaKey && !e.ctrlKey && !e.altKey && !editable) {
        setCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const open = () => {
    window.clearTimeout(hoverTimer.current);
    setCollapsed(false);
  };

  const hasNews = items.some((item) => item.badgeCount > 0);

  if (!slot) return null;

  return createPortal(
    <nav
      aria-label={t('sideNav.label')}
      data-org-side-nav=""
      data-collapsed={collapsed}
      className={`hidden md:block h-full shrink-0 overflow-hidden border-l bg-[rgb(var(--color-surface))] border-[rgb(var(--color-border))] transition-[width] duration-200 ease-out motion-reduce:transition-none ${
        collapsed ? 'w-2.5' : 'w-[200px]'
      }`}
    >
      {collapsed ? (
        <button
          type="button"
          onClick={open}
          onPointerEnter={() => {
            window.clearTimeout(hoverTimer.current);
            hoverTimer.current = window.setTimeout(open, HOVER_OPEN_DELAY_MS);
          }}
          onPointerLeave={() => window.clearTimeout(hoverTimer.current)}
          aria-label={hasNews ? `${t('sideNav.expand')} · ${t('sideNav.hasNews')}` : t('sideNav.expand')}
          aria-expanded={false}
          title={`${t('sideNav.expand')} (])`}
          className="relative block w-full h-full hover:bg-[rgb(var(--color-hover))] focus-visible:outline-none focus-visible:bg-[rgb(var(--color-accent)/0.25)] transition-colors"
        >
          {/* La pastille ne disparaît pas avec le panneau : replié, il reste
              un point dans la bande. */}
          {hasNews && (
            <span
              aria-hidden="true"
              className="absolute top-1/2 left-[2px] -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[rgb(var(--color-accent-solid))]"
            />
          )}
        </button>
      ) : (
        // Largeur FIXE du contenu : pendant la transition, le conteneur rétrécit
        // et coupe ; les libellés ne se replient pas sur deux lignes.
        <div className="w-[200px] h-full flex flex-col overflow-y-auto overflow-x-hidden py-3 px-2">
          <div className="flex items-center justify-between gap-2 pl-3 pr-1 pb-2">
            <span className="text-sm font-semibold text-[rgb(var(--color-text-primary))] truncate">
              {t('sideNav.title')}
            </span>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
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
      )}
    </nav>,
    slot,
  );
};

export default OrgSideNav;
