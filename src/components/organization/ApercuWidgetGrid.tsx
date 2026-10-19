import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, MotionConfig, motion, type PanInfo } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, LayoutGrid, Pencil, Plus, RotateCcw, Undo2, X } from 'lucide-react';
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

/** Ressort commun : les blocs glissent à leur nouvelle place sans à-coup. */
const SPRING = { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 } as const;
const POP = { type: 'spring', stiffness: 520, damping: 24 } as const;

/** Délai minimal entre deux permutations pendant un glisser, contre l'oscillation. */
const SWAP_COOLDOWN_MS = 140;

/**
 * Aperçu composé de widgets, façon écran d'accueil d'iPhone (2026-10-19).
 *
 * « Modifier » fait VIBRER les blocs (pas de contour : la vibration est le
 * signal), chacun prend une croix, un choix de format et des flèches. Tout est
 * animé pour que la personne voie ce qu'elle fait : les voisins glissent quand
 * on déplace, un bloc retiré s'évanouit (avec « Annuler »), un bloc ajouté
 * arrive en rebondissant puis s'illumine.
 *
 * ⚠️ `MotionConfig reducedMotion="never"` : ces mouvements ne jouent QUE dans le
 * mode édition, qu'on ouvre soi-même et qu'on referme d'un clic (même
 * arbitrage que `GuideCursor`). Hors édition, rien ne bouge. Aucune position
 * finale ne dépend d'une animation : la grille CSS place, l'animation suit.
 *
 * ⚠️ Un geste n'est jamais le seul chemin (WCAG 2.1.1) : flèches et choix de
 * format restent au clavier. En édition, le contenu des widgets est `inert`.
 */
const ApercuWidgetGrid = ({ layout, onChange, renderWidget }: ApercuWidgetGridProps) => {
  const { t } = useT('orgAdmin');
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [dragged, setDragged] = useState<WidgetId | null>(null);
  /** Dernier widget ajouté ou redimensionné : il s'illumine un instant. */
  const [highlight, setHighlight] = useState<{ id: WidgetId; entering: boolean } | null>(null);
  const [removed, setRemoved] = useState<{ widget: PlacedWidget; index: number } | null>(null);

  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const lastSwap = useRef(0);

  const name = (id: WidgetId) => t(`apercu.widgets.names.${id}`);
  const sizeName = (size: WidgetSize) => t(`apercu.widgets.sizes.${size}`);

  useEffect(() => {
    if (!highlight) return;
    const timer = window.setTimeout(() => setHighlight(null), 1800);
    return () => window.clearTimeout(timer);
  }, [highlight]);

  useEffect(() => {
    if (!removed) return;
    const timer = window.setTimeout(() => setRemoved(null), 6000);
    return () => window.clearTimeout(timer);
  }, [removed]);

  useEffect(() => {
    if (!highlight?.entering) return;
    const timer = window.setTimeout(() => {
      document.querySelector(`[data-widget="${highlight.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [highlight]);

  const remove = (id: WidgetId) => {
    const index = layout.findIndex((w) => w.id === id);
    if (index < 0) return;
    setRemoved({ widget: layout[index], index });
    onChange(removeWidget(layout, id));
  };

  const undoRemove = () => {
    if (!removed) return;
    const next = [...layout.filter((w) => w.id !== removed.widget.id)];
    next.splice(Math.min(removed.index, next.length), 0, removed.widget);
    onChange(next);
    setHighlight({ id: removed.widget.id, entering: true });
    setRemoved(null);
  };

  const resize = (id: WidgetId, size: WidgetSize) => {
    onChange(resizeWidget(layout, id, size));
    setHighlight({ id, entering: false });
  };

  /** Pendant le glisser : le bloc survolé cède sa place, les autres glissent. */
  const onDrag = (id: WidgetId, info: PanInfo) => {
    const now = performance.now();
    if (now - lastSwap.current < SWAP_COOLDOWN_MS) return;
    const x = info.point.x - window.scrollX;
    const y = info.point.y - window.scrollY;
    const over = document.elementsFromPoint(x, y)
      .map((el) => el.closest<HTMLElement>('[data-widget]'))
      .find((el) => el && el.dataset.widget !== id);
    if (!over) return;
    const current = layoutRef.current;
    const to = current.findIndex((w) => w.id === over.dataset.widget);
    const from = current.findIndex((w) => w.id === id);
    if (to < 0 || to === from) return;
    lastSwap.current = now;
    onChange(moveWidget(current, id, to));
  };

  const toolbarButton = 'min-h-touch inline-flex items-center gap-1.5 px-3.5 rounded-xl text-sm font-semibold';

  return (
    <MotionConfig reducedMotion="never">
      <section aria-label={t('apercu.widgets.regionLabel')} className="space-y-4">
        <div className="flex flex-wrap items-center justify-end gap-2 min-h-touch">
          <AnimatePresence mode="popLayout" initial={false}>
            {editing ? (
              [
                <motion.button
                  key="reset"
                  type="button"
                  layout
                  initial={{ opacity: 0, y: -10, scale: 0.85 }}
                  animate={{ opacity: 1, y: 0, scale: 1, transition: { ...POP, delay: 0.05 } }}
                  exit={{ opacity: 0, y: -10, scale: 0.85 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => { onChange([...DEFAULT_LAYOUT]); setRemoved(null); }}
                  className={`${toolbarButton} font-normal text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]`}
                >
                  <RotateCcw size={15} aria-hidden="true" />
                  {t('apercu.widgets.reset')}
                </motion.button>,
                <motion.button
                  key="add"
                  type="button"
                  layout
                  initial={{ opacity: 0, y: -10, scale: 0.85 }}
                  animate={{ opacity: 1, y: 0, scale: 1, transition: { ...POP, delay: 0.1 } }}
                  exit={{ opacity: 0, y: -10, scale: 0.85 }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setPicking(true)}
                  className={`${toolbarButton} border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))]`}
                >
                  <motion.span animate={{ rotate: [0, 90, 0] }} transition={{ duration: 0.6, delay: 0.3 }} className="inline-flex">
                    <Plus size={16} aria-hidden="true" />
                  </motion.span>
                  {t('apercu.widgets.add')}
                </motion.button>,
                <motion.button
                  key="done"
                  type="button"
                  layout
                  initial={{ opacity: 0, y: -10, scale: 0.85 }}
                  animate={{ opacity: 1, y: 0, scale: 1, transition: { ...POP, delay: 0.15 } }}
                  exit={{ opacity: 0, y: -10, scale: 0.85 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setEditing(false)}
                  className={`${toolbarButton} px-4 bg-[rgb(var(--color-accent))] text-white hover:opacity-90`}
                >
                  <Check size={16} aria-hidden="true" />
                  {t('apercu.widgets.done')}
                </motion.button>,
              ]
            ) : (
              <motion.button
                key="edit"
                type="button"
                layout
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1, transition: POP }}
                exit={{ opacity: 0, scale: 0.85 }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.94 }}
                onClick={() => setEditing(true)}
                data-testid="apercu-edit"
                className={`${toolbarButton} px-4 border border-[rgb(var(--color-accent)/0.4)] bg-[rgb(var(--color-accent)/0.1)] text-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-accent)/0.16)]`}
              >
                <Pencil size={15} aria-hidden="true" />
                {t('apercu.widgets.edit')}
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence initial={false}>
          {editing && (
            <motion.p
              key="hint"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-center text-sm text-[rgb(var(--color-text-secondary))] overflow-hidden"
            >
              {t('apercu.widgets.editHint')}
            </motion.p>
          )}
        </AnimatePresence>

        {layout.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={SPRING}
            className="rounded-2xl border border-dashed border-[rgb(var(--color-border))] p-8 text-center"
          >
            <motion.span
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              className="inline-flex"
            >
              <LayoutGrid size={28} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
            </motion.span>
            <p className="mt-2 text-sm text-[rgb(var(--color-text-secondary))]">{t('apercu.widgets.emptyAll')}</p>
            <motion.button
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => { setEditing(true); setPicking(true); }}
              className="mt-3 min-h-touch inline-flex items-center gap-1.5 px-4 rounded-xl bg-[rgb(var(--color-accent))] text-sm font-semibold text-white"
            >
              <Plus size={16} aria-hidden="true" />
              {t('apercu.widgets.add')}
            </motion.button>
          </motion.div>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-6 gap-5 items-stretch">
            <AnimatePresence mode="popLayout" initial={false}>
              {layout.map((w, index) => {
                const def = widgetDef(w.id);
                const content = renderWidget(w.id, w.size);
                const isDragged = dragged === w.id;
                const lit = highlight?.id === w.id;
                return (
                  <motion.li
                    key={w.id}
                    data-widget={w.id}
                    layout
                    transition={SPRING}
                    initial={lit && highlight?.entering ? { opacity: 0, scale: 0.4, y: 60 } : false}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.3, rotate: -6, filter: 'blur(8px)', transition: { duration: 0.38, ease: [0.4, 0, 0.2, 1] } }}
                    drag={editing}
                    dragSnapToOrigin
                    dragMomentum={false}
                    dragElastic={0.18}
                    onDragStart={() => setDragged(w.id)}
                    onDrag={(_, info) => onDrag(w.id, info)}
                    onDragEnd={() => setDragged(null)}
                    whileDrag={{ scale: 1.06, zIndex: 40, boxShadow: '0 24px 48px -12px rgba(0,0,0,0.45)' }}
                    style={{ zIndex: isDragged ? 40 : undefined, touchAction: editing ? 'none' : undefined }}
                    className={`relative min-w-0 rounded-2xl ${SIZE_SPAN_CLASS[w.size]} ${editing ? (isDragged ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
                  >
                    {/* La vibration : rotation seule, rythme décalé d'un bloc à l'autre. */}
                    <motion.div
                      className="h-full"
                      animate={editing && !isDragged
                        ? { rotate: [-0.45, 0.45, -0.45], scale: 0.98 }
                        : { rotate: 0, scale: 1 }}
                      transition={editing && !isDragged
                        ? {
                          rotate: { duration: 0.42 + (index % 3) * 0.04, repeat: Infinity, ease: 'easeInOut', delay: (index % 4) * 0.06 },
                          scale: SPRING,
                        }
                        : SPRING}
                    >
                      <div
                        ref={(el) => { if (el) el.toggleAttribute('inert', editing); }}
                        className={editing ? 'h-full pointer-events-none select-none' : 'h-full'}
                      >
                        {content ?? (editing ? (
                          <div className="h-full rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4 min-h-[96px]">
                            <p className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{name(w.id)}</p>
                            <p className="mt-1 text-xs text-[rgb(var(--color-text-muted))]">{t('apercu.widgets.emptyWidget')}</p>
                          </div>
                        ) : null)}
                      </div>
                    </motion.div>

                    {/* Halo d'arrivée ou de redimensionnement. */}
                    <AnimatePresence>
                      {lit && (
                        <motion.span
                          key="halo"
                          aria-hidden="true"
                          className="pointer-events-none absolute -inset-1 rounded-[20px] ring-4 ring-[rgb(var(--color-accent))]"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0, 0.9, 0.2, 0.9, 0] }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 1.6, ease: 'easeInOut' }}
                        />
                      )}
                    </AnimatePresence>

                    <AnimatePresence>
                      {editing && !isDragged && (
                        <>
                          <motion.button
                            key="remove"
                            type="button"
                            initial={{ scale: 0, opacity: 0, rotate: -90 }}
                            animate={{ scale: 1, opacity: 1, rotate: 0, transition: { ...POP, delay: 0.04 * (index % 8) } }}
                            exit={{ scale: 0, opacity: 0, rotate: 90 }}
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.85 }}
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() => remove(w.id)}
                            aria-label={t('apercu.widgets.remove', { name: name(w.id) })}
                            className="absolute -top-3 -left-3 z-10 w-8 h-8 rounded-full bg-[rgb(var(--color-text-primary))] text-[rgb(var(--color-surface))] flex items-center justify-center shadow-lg"
                          >
                            <X size={16} strokeWidth={2.5} aria-hidden="true" />
                          </motion.button>
                          <motion.div
                            key="controls"
                            initial={{ y: -12, opacity: 0, scale: 0.8 }}
                            animate={{ y: 0, opacity: 1, scale: 1, transition: { ...POP, delay: 0.04 * (index % 8) + 0.05 } }}
                            exit={{ y: -12, opacity: 0, scale: 0.8 }}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="absolute -top-4 right-2 z-10 flex items-center gap-1 rounded-full border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-1 py-0.5 shadow-lg"
                          >
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => onChange(moveWidget(layout, w.id, index - 1))}
                              aria-label={t('apercu.widgets.moveBefore', { name: name(w.id) })}
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-30"
                            >
                              <ArrowLeft size={14} aria-hidden="true" />
                            </button>
                            <span role="group" aria-label={t('apercu.widgets.sizeOf', { name: name(w.id) })} className="relative flex">
                              {def?.sizes.map((size) => {
                                const active = w.size === size;
                                return (
                                  <button
                                    key={size}
                                    type="button"
                                    onClick={() => resize(w.id, size)}
                                    aria-pressed={active}
                                    aria-label={sizeName(size)}
                                    title={sizeName(size)}
                                    className={`relative w-7 h-7 rounded-full text-xs font-bold ${active ? 'text-white' : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'}`}
                                  >
                                    {active && (
                                      <motion.span
                                        layoutId={`size-pill-${w.id}`}
                                        transition={POP}
                                        className="absolute inset-0 rounded-full bg-[rgb(var(--color-accent))]"
                                        aria-hidden="true"
                                      />
                                    )}
                                    <span className="relative">{SIZE_LETTER[size]}</span>
                                  </button>
                                );
                              })}
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
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}

        {/* Retrait annulable : la personne voit ce qu'elle vient de faire. */}
        <AnimatePresence>
          {removed && (
            // Le CENTRAGE vient du conteneur fixe, jamais d'un transform que
            // l'animation réécrirait.
            <div key="undo" className="fixed inset-x-0 bottom-24 md:bottom-8 z-40 flex justify-center px-4 pointer-events-none">
            <motion.div
              role="status"
              initial={{ opacity: 0, y: 40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.9 }}
              transition={POP}
              className="pointer-events-auto flex items-center gap-3 rounded-full bg-[rgb(var(--color-text-primary))] pl-5 pr-2 py-2 text-sm text-[rgb(var(--color-surface))] shadow-2xl"
            >
              <span>{t('apercu.widgets.removedToast', { name: name(removed.widget.id) })}</span>
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={undoRemove}
                className="min-h-[36px] inline-flex items-center gap-1.5 px-3 rounded-full bg-[rgb(var(--color-accent))] text-white font-semibold"
              >
                <Undo2 size={15} aria-hidden="true" />
                {t('apercu.widgets.undo')}
              </motion.button>
            </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {picking && (
            <Suspense key="picker" fallback={null}>
              <AddWidgetPage
                layout={layout}
                onAdd={(id, size) => {
                  onChange(addWidget(layout, id, size));
                  setHighlight({ id, entering: !layout.some((w) => w.id === id) });
                  setPicking(false);
                }}
                onClose={() => setPicking(false)}
              />
            </Suspense>
          )}
        </AnimatePresence>
      </section>
    </MotionConfig>
  );
};

export default ApercuWidgetGrid;
