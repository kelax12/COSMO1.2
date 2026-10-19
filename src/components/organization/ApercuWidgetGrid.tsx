import { lazy, Suspense, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Check, LayoutGrid, Pencil, Plus, RotateCcw, X } from 'lucide-react';
import { useT } from '@/i18n/useT';
import {
  DEFAULT_LAYOUT,
  SIZE_SPAN_CLASS,
  addWidget,
  moveWidget,
  removeWidget,
  resizeWidget,
  widgetDef,
  type PlacedWidget,
  type WidgetId,
  type WidgetSize,
} from './apercu-widgets';

const AddWidgetPage = lazy(() => import('./AddWidgetPage'));

interface ApercuWidgetGridProps {
  layout: PlacedWidget[];
  onChange: (next: PlacedWidget[]) => void;
  /** Rend le contenu d'un widget ; `null` = rien à montrer pour l'instant. */
  renderWidget: (id: WidgetId, size: WidgetSize) => ReactNode;
}

const SIZE_LETTER: Record<WidgetSize, 'S' | 'M' | 'L'> = { small: 'S', medium: 'M', large: 'L' };

/**
 * Aperçu composé de widgets, façon écran d'accueil d'iPhone : « Modifier »
 * fait vibrer les blocs, chacun prend une croix pour le retirer, un choix de
 * format et des flèches pour le déplacer (le glisser-déposer existe aussi,
 * mais un geste n'est jamais le seul chemin : WCAG 2.1.1).
 *
 * ⚠️ En édition, le contenu des widgets est `inert` : un clic sur une case à
 * cocher pendant qu'on range l'écran ne doit rien terminer.
 */
const ApercuWidgetGrid = ({ layout, onChange, renderWidget }: ApercuWidgetGridProps) => {
  const { t } = useT('orgAdmin');
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [dragged, setDragged] = useState<WidgetId | null>(null);

  const name = (id: WidgetId) => t(`apercu.widgets.names.${id}`);
  const sizeName = (size: WidgetSize) => t(`apercu.widgets.sizes.${size}`);

  return (
    <section aria-label={t('apercu.widgets.regionLabel')} className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {editing ? (
          <>
            <button
              type="button"
              onClick={() => onChange([...DEFAULT_LAYOUT])}
              className="min-h-touch inline-flex items-center gap-1.5 px-3 rounded-xl text-sm text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]"
            >
              <RotateCcw size={15} aria-hidden="true" />
              {t('apercu.widgets.reset')}
            </button>
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="min-h-touch inline-flex items-center gap-1.5 px-3.5 rounded-xl border border-[rgb(var(--color-border))] text-sm font-semibold text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))]"
            >
              <Plus size={16} aria-hidden="true" />
              {t('apercu.widgets.add')}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="min-h-touch inline-flex items-center gap-1.5 px-4 rounded-xl bg-[rgb(var(--color-accent))] text-sm font-semibold text-white hover:opacity-90"
            >
              <Check size={16} aria-hidden="true" />
              {t('apercu.widgets.done')}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            data-testid="apercu-edit"
            className="min-h-touch inline-flex items-center gap-1.5 px-4 rounded-xl border border-[rgb(var(--color-accent)/0.4)] bg-[rgb(var(--color-accent)/0.1)] text-sm font-semibold text-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-accent)/0.16)]"
          >
            <Pencil size={15} aria-hidden="true" />
            {t('apercu.widgets.edit')}
          </button>
        )}
      </div>

      {layout.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[rgb(var(--color-border))] p-8 text-center">
          <LayoutGrid size={28} className="mx-auto text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
          <p className="mt-2 text-sm text-[rgb(var(--color-text-secondary))]">{t('apercu.widgets.emptyAll')}</p>
          <button
            type="button"
            onClick={() => { setEditing(true); setPicking(true); }}
            className="mt-3 min-h-touch inline-flex items-center gap-1.5 px-4 rounded-xl bg-[rgb(var(--color-accent))] text-sm font-semibold text-white"
          >
            <Plus size={16} aria-hidden="true" />
            {t('apercu.widgets.add')}
          </button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-6 gap-5 items-stretch">
          {layout.map((w, index) => {
            const def = widgetDef(w.id);
            const content = renderWidget(w.id, w.size);
            return (
              <li
                key={w.id}
                data-widget={w.id}
                className={`relative min-w-0 ${SIZE_SPAN_CLASS[w.size]} ${dragged === w.id ? 'opacity-40' : ''}`}
                draggable={editing}
                onDragStart={(e) => { setDragged(w.id); e.dataTransfer.effectAllowed = 'move'; }}
                onDragEnd={() => setDragged(null)}
                onDragOver={(e) => { if (editing && dragged) e.preventDefault(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragged && dragged !== w.id) onChange(moveWidget(layout, dragged, index));
                  setDragged(null);
                }}
              >
                <div
                  className={editing
                    ? 'h-full rounded-2xl outline-dashed outline-2 outline-offset-4 outline-[rgb(var(--color-accent)/0.45)] motion-safe:animate-jiggle cursor-grab'
                    : 'h-full'}
                  style={editing ? { animationDelay: `${(index % 3) * -0.11}s` } : undefined}
                >
                  <div
                    ref={(el) => { if (el) el.toggleAttribute('inert', editing); }}
                    className={editing ? 'h-full pointer-events-none select-none' : 'h-full'}
                  >
                    {content ?? (editing ? (
                      <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4 min-h-[96px]">
                        <p className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{name(w.id)}</p>
                        <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))]">{t('apercu.widgets.emptyWidget')}</p>
                      </div>
                    ) : null)}
                  </div>
                </div>

                {editing && (
                  <>
                    <button
                      type="button"
                      onClick={() => onChange(removeWidget(layout, w.id))}
                      aria-label={t('apercu.widgets.remove', { name: name(w.id) })}
                      className="absolute -top-2.5 -left-2.5 z-10 w-8 h-8 rounded-full bg-[rgb(var(--color-text-primary))] text-[rgb(var(--color-surface))] flex items-center justify-center shadow-md hover:scale-105 transition-transform"
                    >
                      <X size={16} strokeWidth={2.5} aria-hidden="true" />
                    </button>
                    <div className="absolute -top-3 right-2 z-10 flex items-center gap-1 rounded-full border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-1 py-0.5 shadow-md">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => onChange(moveWidget(layout, w.id, index - 1))}
                        aria-label={t('apercu.widgets.moveBefore', { name: name(w.id) })}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-30"
                      >
                        <ArrowLeft size={14} aria-hidden="true" />
                      </button>
                      <span role="group" aria-label={t('apercu.widgets.sizeOf', { name: name(w.id) })} className="flex">
                        {def?.sizes.map((size) => (
                          <button
                            key={size}
                            type="button"
                            onClick={() => onChange(resizeWidget(layout, w.id, size))}
                            aria-pressed={w.size === size}
                            aria-label={sizeName(size)}
                            title={sizeName(size)}
                            className={`w-7 h-7 rounded-full text-xs font-bold ${w.size === size
                              ? 'bg-[rgb(var(--color-accent))] text-white'
                              : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'}`}
                          >
                            {SIZE_LETTER[size]}
                          </button>
                        ))}
                      </span>
                      <button
                        type="button"
                        disabled={index === layout.length - 1}
                        onClick={() => onChange(moveWidget(layout, w.id, index + 1))}
                        aria-label={t('apercu.widgets.moveAfter', { name: name(w.id) })}
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-30"
                      >
                        <ArrowRight size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {picking && (
        <Suspense fallback={null}>
          <AddWidgetPage
            layout={layout}
            onAdd={(id, size) => { onChange(addWidget(layout, id, size)); setPicking(false); }}
            onClose={() => setPicking(false)}
          />
        </Suspense>
      )}
    </section>
  );
};

export default ApercuWidgetGrid;
