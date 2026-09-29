// Primitives des pages entreprise : fil d'Ariane (reco UI n° 3) et état
// vide (reco UI n° 46). Réunies dans UN module exprès : séparées, elles
// formaient deux lots partagés de plus, et chaque lot partagé s'ajoute aux
// préchargements de `OrganizationPage`, à son plafond (mesuré le 2026-09-29).
import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { useT } from '@/i18n/useT';

/**
 * Un maillon du fil d'Ariane. `to` (lien) ou `onClick` (retour géré par la
 * page, ex. fermeture d'un détail de projet qui vit dans l'URL de Projets) ;
 * le dernier maillon n'a ni l'un ni l'autre : c'est la page courante.
 */
export interface OrgCrumb {
  label: string;
  to?: string;
  onClick?: () => void;
}

const linkClass =
  'inline-flex items-center min-h-11 font-medium text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] transition-colors';

/**
 * Fil d'Ariane des pages profondes de l'espace entreprise (reco UI n° 3).
 * Remplace le seul lien « Retour » : on voit où l'on est, et chaque niveau
 * reste cliquable.
 */
export const OrgBreadcrumb = ({ items }: { items: OrgCrumb[] }) => {
  const { t } = useT('orgAdmin');
  return (
    <nav aria-label={t('ui.breadcrumbAria')}>
      <ol className="flex items-center flex-wrap gap-1 text-sm">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <Fragment key={`${i}-${c.label}`}>
              <li className="min-w-0">
                {last ? (
                  <span aria-current="page" className="font-semibold text-[rgb(var(--color-text-primary))] truncate block max-w-[60vw]">
                    {c.label}
                  </span>
                ) : c.to ? (
                  <Link to={c.to} className={linkClass}>{c.label}</Link>
                ) : (
                  <button type="button" onClick={c.onClick} className={linkClass}>{c.label}</button>
                )}
              </li>
              {!last && (
                <li aria-hidden="true" className="text-[rgb(var(--color-text-muted))]">
                  <ChevronRight size={14} />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
};

interface OrgEmptyStateProps {
  Icon: LucideIcon;
  title: string;
  /** Une phrase qui dit à quoi sert l'espace, pas qu'il est vide. */
  body?: string;
  /** Le geste qui le remplit, quand l'appelant y a droit. */
  action?: ReactNode;
}

/**
 * État vide des sections entreprise (reco UI n° 46) : une invitation, pas
 * une excuse. Même gabarit partout, pour que « rien ici » se lise pareil
 * dans Projets, OKR et Équipes.
 */
export const OrgEmptyState = ({ Icon, title, body, action }: OrgEmptyStateProps) => (
  <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
    <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--color-hover))] flex items-center justify-center mb-3">
      <Icon size={22} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
    </div>
    <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{title}</p>
    {body && <p className="mt-1 max-w-sm text-xs text-[rgb(var(--color-text-muted))]">{body}</p>}
    {action && <div className="mt-3">{action}</div>}
  </div>
);
