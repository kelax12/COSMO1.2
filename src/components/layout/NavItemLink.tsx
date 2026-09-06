// ═══════════════════════════════════════════════════════════════════
// Un élément de la barre latérale
//
// FRONTIÈRE : ce composant ne connaît pas la navigation de COSMO — ni les
// pastilles qu'il affiche, ni les routes qu'il vise, ni l'organisation
// active. Une destination, un libellé, une icône, et de quoi peindre.
//
// ⚠️ Deux détails qui coûteraient un aller-retour visuel à qui les
// réécrirait :
//   • `asChild` sur le déclencheur de menu — un `<button>` natif porte un
//     `appearance: button` que `.sidebar-item` ne redéfinit pas, et il
//     grossissait l'item par rapport aux `<a>` voisins ;
//   • l'écart entre l'icône et le libellé vient du seul `gap` de
//     `.sidebar-item` : un `ml-3` ici s'y ajoutait, pour 24 px cumulés.
//
// Extrait de `Layout.tsx` le 2026-09-05 (C-09).
// ═══════════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { NavLink, useMatch, useResolvedPath } from 'react-router';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from '@/components/ui/dropdown-menu';
import { prefetchRoute } from '@/lib/route-prefetch';

interface NavItemLinkProps {
  to: string;
  label: string;
  icon: React.ReactNode;
  hoverColor: string;
  collapsed: boolean;
  onMouseEnterExtra?: () => void;
  badge?: number;
  /** 'alert' = pastille rouge (notifications) ; 'neutral' = compteur sobre (#49). */
  badgeVariant?: 'alert' | 'neutral';
  /**
   * Libellé accessible COMPLET du badge, compte inclus.
   *
   * i18n — l'appelant fournit la chaîne entière (via `tp()`) plutôt qu'un
   * fragment que ce composant concaténerait à `badge`. Un `${n} ${label}` codé
   * ici imposerait l'ordre « nombre puis texte » à toutes les langues et
   * empêcherait tout accord au pluriel.
   */
  badgeAriaLabel?: string;
  end?: boolean;
  /**
   * Si fourni, le clic n'effectue plus la navigation directe : il ouvre ce
   * menu déroulant à la place (ex. choix de l'organisation active avant
   * d'entrer dans l'espace Entreprise).
   */
  menuContent?: React.ReactNode;
}

const NavItemLink: React.FC<NavItemLinkProps> = ({
  to,
  label,
  icon,
  hoverColor,
  collapsed,
  onMouseEnterExtra,
  badge,
  badgeVariant = 'alert',
  badgeAriaLabel,
  end,
  menuContent,
}) => {
  const [iconHovered, setIconHovered] = useState(false);
  const [groupHovered, setGroupHovered] = useState(false);
  const resolved = useResolvedPath(to);
  const match = useMatch({ path: resolved.pathname, end: end ?? false });
  const isActive = !!match;
  const isColored = iconHovered || groupHovered || isActive;

  const content = (
    <>
      <div
        className="nav-item-icon min-w-[20px] flex items-center justify-center relative"
        onMouseEnter={() => setIconHovered(true)}
        onMouseLeave={() => setIconHovered(false)}
        style={{
          transition: 'transform 0.2s ease, color 0.2s ease',
          transform: (iconHovered || groupHovered) ? 'scale(1.2)' : 'scale(1)',
          color: isColored ? hoverColor : undefined,
        }}
      >
        {icon}
        {badge !== undefined && badge > 0 && (
          <span
            aria-label={badgeAriaLabel}
            className={`absolute ${collapsed ? '-top-1 -right-1' : '-top-2 -right-2'} ${
              badgeVariant === 'alert'
                ? 'bg-red-500 text-white'
                : 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))] border border-[rgb(var(--color-border))]'
            } text-[10px] rounded-full ${collapsed ? 'min-w-4 h-4' : 'min-w-5 h-5'} px-1 flex items-center justify-center`}
          >
            {badge}
          </span>
        )}
      </div>
      {/* Pas de marge propre : l'écart avec l'icône vient du seul `gap` de
          .sidebar-item — un `ml-3` ici s'additionnait au gap (24px cumulés). */}
      {!collapsed && <span className="truncate">{label}</span>}
    </>
  );

  if (menuContent) {
    // asChild : évite de rendre un <button> natif, dont le chrome par défaut
    // du navigateur (appearance: button) grossit visuellement l'item par
    // rapport aux <a> voisins que .sidebar-item ne redéfinit pas.
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            className={`sidebar-item cursor-pointer ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : '!ml-1 !py-[0.7rem]'}`}
            style={groupHovered ? { transform: 'translateX(8px) scale(1.15)' } : undefined}
            onMouseEnter={() => { setGroupHovered(true); onMouseEnterExtra?.(); prefetchRoute(to); }}
            onMouseLeave={() => { setGroupHovered(false); setIconHovered(false); }}
            aria-label={label}
          >
            {content}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side={collapsed ? 'right' : 'bottom'} className="w-56">
          {menuContent}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `sidebar-item ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : '!ml-1 !py-[0.7rem]'}`
      }
      style={groupHovered ? { transform: 'translateX(8px) scale(1.15)' } : undefined}
      onMouseEnter={() => { setGroupHovered(true); onMouseEnterExtra?.(); prefetchRoute(to); }}
      onMouseLeave={() => { setGroupHovered(false); setIconHovered(false); }}
    >
      {content}
    </NavLink>
  );
};

export default NavItemLink;
