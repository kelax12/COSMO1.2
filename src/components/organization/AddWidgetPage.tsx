import { useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowLeft, CalendarClock, CalendarDays, CircleCheckBig, Clock3, FolderKanban,
  Gauge, Hourglass, Plus, Search, Sparkles, Target, type LucideIcon,
} from 'lucide-react';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import {
  WIDGET_DEFS,
  WIDGET_SIZES,
  type PlacedWidget,
  type WidgetId,
  type WidgetSize,
} from './apercu-widgets';

const ICONS: Record<WidgetId, LucideIcon> = {
  kpi: Gauge,
  waiting: Hourglass,
  tasks: CircleCheckBig,
  load: Clock3,
  agenda: CalendarDays,
  krs: Target,
  projects: FolderKanban,
  waitingOn: Hourglass,
  activity: Activity,
  orgEvents: CalendarClock,
};

/** Silhouette du format, à l'échelle de la grille de 6 colonnes. */
const SHAPE: Record<WidgetSize, string> = {
  small: 'w-1/3',
  medium: 'w-1/2',
  large: 'w-full',
};

interface AddWidgetPageProps {
  layout: PlacedWidget[];
  onAdd: (id: WidgetId, size: WidgetSize) => void;
  onClose: () => void;
}

/**
 * Page « Ajouter un widget » : plein écran, une barre de recherche, des
 * raccourcis horizontaux vers les trois formats, puis une section par format
 * (petit, moyen, grand). Un widget déjà posé propose de changer de format
 * plutôt que d'en poser un second.
 */
const AddWidgetPage = ({ layout, onAdd, onClose }: AddWidgetPageProps) => {
  const { t } = useT('orgAdmin');
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const sectionRefs = useRef<Partial<Record<WidgetSize, HTMLElement | null>>>({});
  const { ref, dialogProps } = useModalA11y<HTMLDivElement>({
    open: true,
    onClose,
    label: t('apercu.widgets.picker.title'),
    initialFocusRef: searchRef,
  });

  const placed = useMemo(() => new Map(layout.map((w) => [w.id, w.size])), [layout]);
  const name = (id: WidgetId) => t(`apercu.widgets.names.${id}`);
  const desc = (id: WidgetId) => t(`apercu.widgets.desc.${id}`);
  const sizeName = (size: WidgetSize) => t(`apercu.widgets.sizes.${size}`);

  const needle = query.trim().toLocaleLowerCase();
  const matches = (id: WidgetId) =>
    !needle || `${name(id)} ${desc(id)}`.toLocaleLowerCase().includes(needle);

  const sections = WIDGET_SIZES.map((size) => ({
    size,
    defs: WIDGET_DEFS.filter((d) => d.sizes.includes(size) && matches(d.id)),
  }));
  const nothing = sections.every((s) => s.defs.length === 0);

  return (
    <div
      ref={ref}
      {...dialogProps}
      className="fixed inset-0 z-50 overflow-y-auto bg-[rgb(var(--color-background))]"
    >
      <header className="sticky top-0 z-10 border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-background)/0.95)] backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 pt-3 pb-3 space-y-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label={t('apercu.widgets.picker.back')}
              className="min-h-touch min-w-touch rounded-xl flex items-center justify-center text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]"
            >
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
            <h1 className="text-xl font-bold text-[rgb(var(--color-text-primary))]">{t('apercu.widgets.picker.title')}</h1>
          </div>
          <label className="relative block">
            <span className="sr-only">{t('apercu.widgets.picker.search')}</span>
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('apercu.widgets.picker.search')}
              className="w-full h-11 pl-10 pr-3 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-sm text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))]"
            />
          </label>
          <nav aria-label={t('apercu.widgets.picker.sectionsNav')} className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-0.5">
            {sections.map(({ size, defs }) => (
              <button
                key={size}
                type="button"
                onClick={() => sectionRefs.current[size]?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="shrink-0 min-h-touch inline-flex items-center gap-2 px-4 rounded-full border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-sm font-semibold text-[rgb(var(--color-text-primary))] hover:border-[rgb(var(--color-accent))]"
              >
                {sizeName(size)}
                <span className="text-xs tabular-nums text-[rgb(var(--color-text-muted))]">{defs.length}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5 space-y-8">
        {nothing && (
          <p className="text-sm text-[rgb(var(--color-text-secondary))]">{t('apercu.widgets.picker.searchEmpty', { query })}</p>
        )}

        {sections.map(({ size, defs }) => defs.length > 0 && (
          <section
            key={size}
            ref={(el) => { sectionRefs.current[size] = el; }}
            aria-labelledby={`widget-section-${size}`}
            className="scroll-mt-48"
          >
            <h2 id={`widget-section-${size}`} className="text-lg font-bold text-[rgb(var(--color-text-primary))]">{sizeName(size)}</h2>
            <p className="text-sm text-[rgb(var(--color-text-muted))] mb-3">{t(`apercu.widgets.picker.sectionHint_${size}`)}</p>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {defs.map(({ id }) => {
                const Icon = ICONS[id];
                const current = placed.get(id);
                const isCurrent = current === size;
                return (
                  <li key={id} className="flex flex-col rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
                    <div className="h-14 rounded-xl bg-[rgb(var(--color-hover))] p-2 flex" aria-hidden="true">
                      <div className={`${SHAPE[size]} h-full rounded-lg bg-[rgb(var(--color-accent)/0.18)] border border-[rgb(var(--color-accent)/0.35)] flex items-center justify-center`}>
                        <Icon size={18} className="text-[rgb(var(--color-accent))]" />
                      </div>
                    </div>
                    <p className="mt-3 text-base font-bold text-[rgb(var(--color-text-primary))]">{name(id)}</p>
                    <p className="mt-0.5 text-sm text-[rgb(var(--color-text-secondary))] flex-1">{desc(id)}</p>
                    {current && (
                      <p className="mt-2 text-xs text-[rgb(var(--color-text-muted))]">
                        {isCurrent ? t('apercu.widgets.picker.current') : t('apercu.widgets.picker.alreadyHere')}
                      </p>
                    )}
                    {!isCurrent && (
                      <button
                        type="button"
                        onClick={() => onAdd(id, size)}
                        className="mt-3 min-h-touch inline-flex items-center justify-center gap-1.5 rounded-xl bg-[rgb(var(--color-accent))] text-sm font-semibold text-white hover:opacity-90"
                      >
                        <Plus size={16} aria-hidden="true" />
                        {current
                          ? t('apercu.widgets.picker.switchSize', { size: sizeName(size).toLocaleLowerCase() })
                          : t('apercu.widgets.picker.addTo')}
                        <span className="sr-only">{` ${name(id)}`}</span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        {!needle && (
          <section className="rounded-2xl border border-dashed border-[rgb(var(--color-border))] p-4 flex gap-3">
            <Sparkles size={18} className="shrink-0 text-[rgb(var(--color-accent))]" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{t('apercu.widgets.picker.ideas')}</p>
              <p className="text-sm text-[rgb(var(--color-text-secondary))]">{t('apercu.widgets.picker.ideasHint')}</p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default AddWidgetPage;
