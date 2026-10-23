import { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { TONE_BADGE, type Pager, type WidgetTone } from './widget-shell.helpers';

/**
 * Coque commune des formats petit et moyen de l'Aperçu (2026-10-19) : un
 * en-tête (icône, titre, compteur), un corps, et une BARRE DE CONTRÔLE en bas.
 *
 * Règle des maquettes : la taille change la PRÉSENTATION, jamais ce qui est
 * accessible. Ce qui ne tient pas dans le cadre se parcourt avec ‹ 1/N ›, et
 * l'action principale de chaque élément reste dans le widget.
 */

interface WidgetShellProps {
  icon: LucideIcon;
  title: string;
  /** Précision discrète à la suite du titre (« 2 personnes t'attendent »). */
  titleExtra?: ReactNode;
  /** Bouton ⓘ à droite du titre : son texte s'affiche au survol ET au clic. */
  info?: string;
  /** Action placée dans l'en-tête, à droite du titre (« Nouvelle note »). */
  headerAction?: ReactNode;
  /** Commande collée au titre (menu déroulant des OKR). */
  titleControl?: ReactNode;
  count?: number;
  countTone?: WidgetTone;
  /** Contrôles propres au widget, à gauche de la pagination. */
  actions?: ReactNode;
  pager?: Pager;
  /** Libellé de pagination (« 1/9 », « 1-3 / 9 ») ; défaut « page/pages ». */
  pagerLabel?: string;
  onSeeAll?: () => void;
  tone?: WidgetTone;
  children: ReactNode;
}

const SHELL = 'h-full min-w-0 flex flex-col rounded-2xl border p-4';

export const WidgetShell = ({
  icon: _icon, title, titleExtra, info, headerAction, titleControl, count, countTone = 'neutral', actions, pager, pagerLabel, onSeeAll, tone = 'neutral', children,
}: WidgetShellProps) => {
  const { t } = useT('orgAdmin');
  const tinted = tone === 'danger'
    ? 'border-red-500/40 bg-red-500/[0.07]'
    : 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]';
  const hasBar = !!actions || (pager && pager.pages > 1) || !!onSeeAll;
  return (
    <section className={`${SHELL} ${tinted}`} aria-label={title}>
      <header className="flex items-center gap-2 mb-3">
        {/* Pas d'icône devant le titre (retour d'Axel, 2026-10-20) : `icon` reste
            accepté pour ne pas toucher chaque appel, mais n'est plus peint. */}
        <h3 className={`${titleControl ? 'shrink-0' : 'flex-1'} min-w-0 truncate text-sm font-bold text-[rgb(var(--color-text-primary))]`}>
          {title}
          {titleExtra && <span className="ml-1.5 font-normal text-xs text-[rgb(var(--color-text-secondary))]">{titleExtra}</span>}
        </h3>
        {titleControl && <div className="flex-1 min-w-0">{titleControl}</div>}
        {info && <InfoButton text={info} />}
        {headerAction}
        {count !== undefined && (
          <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-bold tabular-nums ${TONE_BADGE[countTone]}`}>{count}</span>
        )}
      </header>
      <div className="flex-1 min-w-0">{children}</div>
      {hasBar && (
        <div className="mt-3 pt-3 border-t border-[rgb(var(--color-border))] flex items-center gap-1.5 flex-wrap">
          {actions}
          {pager && pager.pages > 1 && (
            <span className="inline-flex items-center gap-1">
              <button
                type="button"
                onClick={pager.prev}
                disabled={pager.page === 0}
                aria-label={t('apercu.widgets.pager.prev')}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-30"
              >
                <ChevronLeft size={17} aria-hidden="true" />
              </button>
              <span className="min-w-[2.5rem] text-center text-xs font-semibold tabular-nums text-[rgb(var(--color-text-secondary))]" aria-live="polite">
                {pagerLabel ?? `${pager.page + 1}/${pager.pages}`}
              </span>
              <button
                type="button"
                onClick={pager.next}
                disabled={pager.page >= pager.pages - 1}
                aria-label={t('apercu.widgets.pager.next')}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-30"
              >
                <ChevronRight size={17} aria-hidden="true" />
              </button>
            </span>
          )}
          {onSeeAll && (
            <button
              type="button"
              onClick={onSeeAll}
              className="ml-auto min-h-[36px] px-2.5 rounded-lg text-xs font-semibold text-[rgb(var(--color-accent-text))] hover:bg-[rgb(var(--color-hover))]"
            >
              {t('apercu.widgets.pager.seeAll')}
            </button>
          )}
        </div>
      )}
    </section>
  );
};

/** Bouton d'action d'un élément (Terminer, Valider, Ouvrir…). */
export const ItemAction = ({
  onClick, label, icon: Icon, primary = false, iconOnly = false, hideIcon = false,
}: {
  onClick: () => void; label: string; icon: LucideIcon; primary?: boolean; iconOnly?: boolean;
  /** Libellé seul, sans icône : petit format où chaque pixel compte. */
  hideIcon?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={iconOnly ? label : undefined}
    title={iconOnly ? label : undefined}
    className={`shrink-0 h-9 ${iconOnly ? 'w-9' : hideIcon ? 'px-2.5' : 'px-3'} inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors ${primary
      ? 'bg-[rgb(var(--color-accent))] text-white hover:opacity-90'
      : 'border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))]'}`}
  >
    {!hideIcon && <Icon size={15} aria-hidden="true" />}
    {!iconOnly && label}
  </button>
);

/**
 * Petit bouton ⓘ : l'explication s'ouvre au survol, au focus clavier ET au
 * clic (un écran tactile n'a pas de survol).
 */
export const InfoButton = ({ text }: { text: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative shrink-0" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={text}
        aria-expanded={open}
        className="w-6 h-6 rounded-full border border-[rgb(var(--color-border))] text-[11px] font-bold italic font-serif text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] inline-flex items-center justify-center"
      >
        i
      </button>
      {open && (
        <span role="tooltip" className="absolute right-0 top-8 z-20 w-64 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-3 text-xs leading-relaxed text-[rgb(var(--color-text-secondary))] shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
};

/** Phrase de liste vide, commune aux formats compacts. */
export const WidgetEmpty = ({ children }: { children: ReactNode }) => (
  <p className="text-sm text-[rgb(var(--color-text-muted))] py-2">{children}</p>
);
