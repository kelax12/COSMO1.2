import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Plus, Search, Trash2, X } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import {
  WIDGET_DEFS,
  WIDGET_SIZES,
  type PlacedWidget,
  type WidgetId,
  type WidgetSize,
  widgetDef,
} from './apercu-widgets';

/**
 * Largeur « réelle » d'un widget de chaque format sur l'Aperçu desktop : la
 * miniature le rend à cette largeur, puis le réduit à la taille de la carte.
 */
const NATURAL_WIDTH: Record<WidgetSize, number> = { small: 380, medium: 580, large: 1180 };
const PREVIEW_HEIGHT = 170;

/**
 * Miniature VIVANTE du widget : le vrai composant, avec les vraies données,
 * rendu à sa largeur naturelle puis réduit. Inerte et masqué aux lecteurs
 * d'écran (le nom et la description le disent déjà).
 */
const WidgetPreview = ({ size, children }: { size: WidgetSize; children: ReactNode }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.45);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => setScale(Math.min(1, (el.clientWidth - 16) / NATURAL_WIDTH[size]));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [size]);
  return (
    <div
      ref={boxRef}
      aria-hidden="true"
      className="relative overflow-hidden rounded-xl bg-[rgb(var(--color-hover))]"
      style={{ height: PREVIEW_HEIGHT }}
    >
      <div
        ref={(el) => { if (el) el.setAttribute('inert', ''); }}
        className="absolute left-2 top-2 origin-top-left pointer-events-none select-none"
        style={{ width: NATURAL_WIDTH[size], transform: `scale(${scale})` }}
      >
        {children}
      </div>
      {/* Fondu bas : la miniature est un aperçu, pas tout le widget. */}
      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[rgb(var(--color-hover))] to-transparent" />
    </div>
  );
};

/**
 * Carrousel des formats d'un widget : on voit le MÊME widget en petit, moyen
 * et grand avant de choisir. Flèches, onglets, et ← → au clavier.
 */
const FormatCarousel = ({
  id, startIndex, placedSize, renderWidget, onAdd, onRemove, onBack,
}: {
  id: WidgetId;
  startIndex: number;
  placedSize: WidgetSize | undefined;
  renderWidget: (id: WidgetId, size: WidgetSize) => ReactNode;
  onAdd: (id: WidgetId, size: WidgetSize) => void;
  onRemove: (id: WidgetId) => void;
  onBack: () => void;
}) => {
  const { t } = useT('orgAdmin');
  const sizes = widgetDef(id)?.sizes ?? [];
  const [[index, dir], setSlide] = useState<[number, number]>([Math.max(0, startIndex), 0]);
  const backRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { backRef.current?.focus(); }, []);
  const size = sizes[index];
  const go = (delta: number) => {
    const next = index + delta;
    if (next >= 0 && next < sizes.length) setSlide([next, delta]);
  };
  const sizeName = (s: WidgetSize) => t(`apercu.widgets.sizes.${s}`);
  if (!size) return null;
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ type: 'spring', stiffness: 360, damping: 32 }}
      className="absolute inset-0 z-20 flex flex-col bg-[rgb(var(--color-background))]"
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') go(-1);
        if (e.key === 'ArrowRight') go(1);
      }}
    >
      <div className="shrink-0 flex items-center gap-2 border-b border-[rgb(var(--color-border))] px-5 py-3">
        <button
          ref={backRef}
          type="button"
          onClick={onBack}
          aria-label={t('apercu.widgets.picker.backToList')}
          className="min-h-touch min-w-touch rounded-full flex items-center justify-center text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-[rgb(var(--color-text-primary))] truncate">{t(`apercu.widgets.names.${id}`)}</h2>
          <p className="text-sm text-[rgb(var(--color-text-muted))] truncate">{t(`apercu.widgets.desc.${id}`)}</p>
        </div>
      </div>

      <div role="group" aria-label={t('apercu.widgets.picker.formats')} className="shrink-0 flex justify-center gap-2 pt-4">
        {sizes.map((s, i) => (
          <button
            key={s}
            type="button"
            aria-pressed={i === index}
            onClick={() => setSlide([i, i > index ? 1 : -1])}
            className={`relative min-h-touch px-4 rounded-full text-sm font-semibold ${i === index ? 'text-white' : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'}`}
          >
            {i === index && (
              <motion.span
                layoutId="format-tab"
                className="absolute inset-0 rounded-full bg-[rgb(var(--color-accent))]"
                transition={{ type: 'spring', stiffness: 480, damping: 34 }}
              />
            )}
            <span className="relative">{sizeName(s)}</span>
          </button>
        ))}
      </div>

      <div className="relative flex-1 min-h-0 flex items-center px-16 py-4 overflow-hidden">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={index === 0}
          aria-label={t('apercu.widgets.pager.prev')}
          className="absolute left-3 z-10 w-11 h-11 rounded-full border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] flex items-center justify-center shadow-md disabled:opacity-30"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <div className="relative w-full h-full flex items-center justify-center">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={size}
              initial={{ opacity: 0, x: dir * 180, scale: 0.92 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: dir * -180, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-full max-h-full overflow-hidden"
              style={{ maxWidth: NATURAL_WIDTH[size] }}
            >
              <div ref={(el) => { if (el) el.setAttribute('inert', ''); }} aria-hidden="true" className="pointer-events-none select-none">
                {renderWidget(id, size)}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={index === sizes.length - 1}
          aria-label={t('apercu.widgets.pager.next')}
          className="absolute right-3 z-10 w-11 h-11 rounded-full border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] flex items-center justify-center shadow-md disabled:opacity-30"
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>

      <div className="shrink-0 flex items-center justify-center gap-3 border-t border-[rgb(var(--color-border))] px-5 py-3">
        {placedSize ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              <Check size={15} aria-hidden="true" />
              {t('apercu.widgets.picker.alreadyHere')}
            </span>
            <button
              type="button"
              onClick={() => onRemove(id)}
              className="min-h-touch inline-flex items-center gap-1.5 px-4 rounded-xl border border-red-500/40 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10"
            >
              <Trash2 size={15} aria-hidden="true" />
              {t('apercu.widgets.picker.removeFrom')}
            </button>
          </>
        ) : (
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => onAdd(id, size)}
            className="min-h-touch inline-flex items-center gap-1.5 px-6 rounded-xl bg-[rgb(var(--color-accent))] text-sm font-semibold text-white hover:opacity-90"
          >
            <Plus size={16} aria-hidden="true" />
            {t('apercu.widgets.picker.addInSize', { size: sizeName(size).toLocaleLowerCase() })}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};

interface AddWidgetPageProps {
  layout: PlacedWidget[];
  onAdd: (id: WidgetId, size: WidgetSize) => void;
  onRemove: (id: WidgetId) => void;
  renderWidget: (id: WidgetId, size: WidgetSize) => ReactNode;
  onClose: () => void;
}

/**
 * Fenêtre « Ajouter un widget » (2026-10-19) : une vraie pop-up centrée aux
 * bords arrondis, sur un voile. Recherche, raccourcis horizontaux vers les
 * trois formats, une section par format, et pour chaque widget sa miniature
 * vivante.
 *
 * Un widget déjà posé ne propose QUE « Retirer » : un « Passer en petit » du
 * même bleu que « Ajouter » se confondait avec lui (retour d'Axel, 2026-10-19).
 */
const AddWidgetPage = ({ layout, onAdd, onRemove, renderWidget, onClose }: AddWidgetPageProps) => {
  const { t } = useT('orgAdmin');
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState<{ id: WidgetId; index: number } | null>(null);
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/55 backdrop-blur-sm"
    >
      <motion.div
        ref={ref}
        {...dialogProps}
        initial={{ opacity: 0, scale: 0.94, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16, transition: { duration: 0.18 } }}
        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
        className="relative w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden rounded-3xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] shadow-2xl"
      >
        <header className="shrink-0 border-b border-[rgb(var(--color-border))] px-5 pt-4 pb-3 space-y-3">
          <div className="flex items-center gap-2">
            <h1 className="flex-1 text-xl font-bold text-[rgb(var(--color-text-primary))]">{t('apercu.widgets.picker.title')}</h1>
            <motion.button
              type="button"
              whileHover={{ rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              aria-label={t('apercu.widgets.picker.back')}
              className="min-h-touch min-w-touch rounded-full flex items-center justify-center text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]"
            >
              <X size={20} aria-hidden="true" />
            </motion.button>
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
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-8">
          {nothing && (
            <p className="text-sm text-[rgb(var(--color-text-secondary))]">{t('apercu.widgets.picker.searchEmpty', { query })}</p>
          )}

          {sections.map(({ size, defs }) => defs.length > 0 && (
            <section
              key={size}
              ref={(el) => { sectionRefs.current[size] = el; }}
              aria-labelledby={`widget-section-${size}`}
              className="scroll-mt-4"
            >
              <h2 id={`widget-section-${size}`} className="text-lg font-bold text-[rgb(var(--color-text-primary))]">{sizeName(size)}</h2>
              <p className="text-sm text-[rgb(var(--color-text-muted))] mb-3">{t(`apercu.widgets.picker.sectionHint_${size}`)}</p>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence mode="popLayout" initial>
                  {defs.map(({ id }, i) => {
                    const current = placed.get(id);
                    return (
                      <motion.li
                        key={id}
                        layout
                        initial={{ opacity: 0, y: 24, scale: 0.94 }}
                        animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 360, damping: 28, delay: 0.08 + i * 0.045 } }}
                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                        whileHover={{ y: -4 }}
                        className="flex flex-col rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-3"
                      >
                        <button
                          type="button"
                          onClick={() => setFocus({ id, index: widgetDef(id)?.sizes.indexOf(size) ?? 0 })}
                          aria-label={t('apercu.widgets.picker.seeFormats', { name: name(id) })}
                          className="block w-full text-left rounded-xl cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
                        >
                          <WidgetPreview size={size}>{renderWidget(id, size)}</WidgetPreview>
                        </button>
                        <p className="mt-3 px-1 text-base font-bold text-[rgb(var(--color-text-primary))]">{name(id)}</p>
                        <p className="mt-0.5 px-1 text-sm text-[rgb(var(--color-text-secondary))] flex-1">{desc(id)}</p>
                        {current ? (
                          <div className="mt-3 flex items-center gap-2">
                            <span className="flex-1 inline-flex items-center gap-1.5 px-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              <Check size={14} aria-hidden="true" />
                              {t('apercu.widgets.picker.alreadyHere')}
                            </span>
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.94 }}
                              onClick={() => onRemove(id)}
                              className="min-h-touch inline-flex items-center gap-1.5 px-3.5 rounded-xl border border-red-500/40 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-500/10"
                            >
                              <Trash2 size={15} aria-hidden="true" />
                              {t('apercu.widgets.picker.removeFrom')}
                              <span className="sr-only">{` ${name(id)}`}</span>
                            </motion.button>
                          </div>
                        ) : (
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.94 }}
                            onClick={() => onAdd(id, size)}
                            className="mt-3 min-h-touch inline-flex items-center justify-center gap-1.5 rounded-xl bg-[rgb(var(--color-accent))] text-sm font-semibold text-white hover:opacity-90"
                          >
                            <Plus size={16} aria-hidden="true" />
                            {t('apercu.widgets.picker.addTo')}
                            <span className="sr-only">{` ${name(id)} (${sizeName(size)})`}</span>
                          </motion.button>
                        )}
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </section>
          ))}
        </div>

        <AnimatePresence>
          {focus && (
            <FormatCarousel
              key={focus.id}
              id={focus.id}
              startIndex={focus.index}
              placedSize={placed.get(focus.id)}
              renderWidget={renderWidget}
              onAdd={onAdd}
              onRemove={onRemove}
              onBack={() => setFocus(null)}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

export default AddWidgetPage;
