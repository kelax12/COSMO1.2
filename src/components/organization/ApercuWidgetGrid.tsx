import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion, type InertiaOptions } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, LayoutGrid, LayoutTemplate, Pencil, Plus, RotateCcw, Undo2, X } from 'lucide-react';
import { useT } from '@/i18n/useT';
import {
  SIZE_SPAN_CLASS,
  WIDGET_DEFS,
  addWidgetIn,
  findDef,
  moveWidget,
  removeWidget,
  resizeWidgetIn,
  type PlacedOf,
  type WidgetId,
  type WidgetSize,
} from './apercu-widgets';
import type { WidgetCatalog } from './widget-catalog';

import { TEMPLATES, type TemplateId } from './apercu-templates';
import { useWidgetDragReorder } from './use-widget-drag-reorder';
import type { AddWidgetPageProps } from './AddWidgetPage';

const AddWidgetPage = lazy(() => import('./AddWidgetPage')) as unknown as <Id extends string>(props: AddWidgetPageProps<Id>) => ReactNode;
const TemplatePicker = lazy(() => import('./TemplatePicker'));

interface ApercuWidgetGridProps<Id extends string> {
  layout: PlacedOf<Id>[];
  onChange: (next: PlacedOf<Id>[]) => void;
  /** Rend le contenu d'un widget ; `null` = rien à montrer pour l'instant. */
  renderWidget: (id: Id, size: WidgetSize) => ReactNode;
  /** Modèle du rôle : recommandé dans le choix des modèles. Absent = pas de modèles. */
  roleTemplate?: TemplateId;
  /** Catalogue des widgets ; absent = celui de l'Aperçu entreprise. */
  catalog?: WidgetCatalog<Id>;
  /**
   * Où monter la barre « Modifier les widgets » ; absent = au-dessus de la
   * grille. Le dashboard perso la place sous la boîte de réception (2026-10-29).
   */
  toolbarSlot?: HTMLElement | null;
}

const SIZE_LETTER: Record<WidgetSize, 'S' | 'M' | 'L'> = { small: 'S', medium: 'M', large: 'L' };

/** Ressort commun : les blocs glissent à leur nouvelle place sans à-coup. */
const SPRING = { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 } as const;
/** Ressort des voisins pendant un glisser : plus souple, sans dépassement. */
const REFLOW = { type: 'spring', stiffness: 260, damping: 32, mass: 0.8 } as const;
const POP = { type: 'spring', stiffness: 520, damping: 24 } as const;

/**
 * Retour instantané d'un bloc lâché, sous mouvement réduit. `dragSnapToOrigin`
 * anime x/y par `animateMotionValue` SANS consulter `reducedMotion` (lu dans
 * `VisualElementDragControls`, framer-motion 12.43) : le bloc revenait en
 * glissant ~400 ms. `{ type: false }` est la transition instantanée de
 * motion-dom ; elle manque au type `InertiaOptions`, d'où la conversion.
 */
const INSTANT_DRAG_SNAP = { type: false } as unknown as InertiaOptions;

/**
 * Aperçu composé de widgets, façon écran d'accueil d'iPhone (2026-10-19).
 *
 * « Modifier » fait VIBRER les blocs (pas de contour : la vibration est le
 * signal), chacun prend une croix, un choix de format et des flèches. Tout est
 * animé pour que la personne voie ce qu'elle fait : les voisins glissent quand
 * on déplace, un bloc retiré s'évanouit (avec « Annuler »), un bloc ajouté
 * arrive en rebondissant puis s'illumine.
 *
 * 🔴 Mouvement réduit (WCAG 2.3.3) : ce composant suit le `MotionConfig
 * reducedMotion="user"` d'`App.tsx`. Il a porté un `reducedMotion="never"`
 * (2026-10-19 à 2026-10-22, « mode ouvert par la personne ») qui faisait
 * vibrer les blocs EN BOUCLE chez qui demande moins d'animation. ❌ Ne pas le
 * remettre : `e2e/reduced-motion-widgets.spec.ts` échoue s'il revient.
 * Sous mouvement réduit, ce que le `MotionConfig` ne couvre pas est coupé à la
 * main via `reduce`, trois trous mesurés en CI le 2026-10-22 :
 *   · `layout` / `layoutId` RETIRÉS : Framer rend l'animation de layout
 *     instantanée PUIS replace le bloc à son ancienne position pour une frame
 *     (`mixTargetDelta(0)`), un saut aller-retour de 260 px. Sans `layout`, la
 *     grille CSS place directement ; le glisser reste corrigé (la
 *     fonctionnalité `drag` mesure le layout elle-même) ;
 *   · retour du bloc lâché : `INSTANT_DRAG_SNAP` ;
 *   · la vibration (une boucle instantanée laisserait un `rotate` résiduel), le
 *     défilement doux.
 * Seule exception, pendant un glisser à la souris : les voisins glissent par
 * un FLIP natif (`snapshotForFlip`, décision du 2026-10-29).
 * Aucune position finale ne dépend d'une animation : la grille CSS place.
 *
 * ⚠️ Un geste n'est jamais le seul chemin (WCAG 2.1.1) : flèches et choix de
 * format restent au clavier. En édition, le contenu des widgets est `inert`.
 */
const ApercuWidgetGrid = <Id extends string>({ layout: saved, onChange: save, renderWidget, roleTemplate, catalog, toolbarSlot }: ApercuWidgetGridProps<Id>) => {
  const { t } = useT('orgAdmin');
  const { t: tCommon } = useT('common');
  const reduce = useReducedMotion() ?? false;
  type Placed = PlacedOf<Id>;
  const cat: WidgetCatalog<Id> = catalog ?? ({
    defs: WIDGET_DEFS,
    name: (id: WidgetId) => t(`apercu.widgets.names.${id}`),
    desc: (id: WidgetId) => t(`apercu.widgets.desc.${id}`),
  } as unknown as WidgetCatalog<Id>);
  const templateOf = (id: TemplateId) => TEMPLATES[id] as unknown as readonly Placed[];
  /**
   * Modèle en APERÇU : choisi mais pas encore validé. Tant qu'il n'est pas
   * validé, rien n'est enregistré, et la personne peut déjà le retoucher
   * (ses retouches vont dans l'aperçu). « Valider » l'enregistre ; ensuite
   * elle continue de modifier comme d'habitude.
   */
  const [draft, setDraft] = useState<{ template: TemplateId; layout: Placed[] } | null>(null);
  const [choosingTemplate, setChoosingTemplate] = useState(false);
  const layout = draft?.layout ?? saved;
  const onChange = (next: Placed[]) => {
    if (draft) setDraft({ ...draft, layout: next });
    else save(next);
  };
  const [editing, setEditing] = useState(false);
  /**
   * Point de reprise (2026-10-20) : l'état VALIDÉ. Il est pris à l'ouverture
   * du mode édition et à chaque « Terminé ». « Réinitialiser » ramène à lui,
   * et n'apparaît que s'il y a quelque chose à défaire. Pour un modèle en
   * aperçu, le point de reprise est le modèle tel quel.
   */
  const [checkpoint, setCheckpoint] = useState<Placed[]>(saved);
  const base = draft ? templateOf(draft.template) : checkpoint;
  const dirty = JSON.stringify(layout) !== JSON.stringify(base);
  const startEditing = () => { setCheckpoint(layout); setEditing(true); };
  const finishEditing = () => { setCheckpoint(layout); setEditing(false); };
  const [picking, setPicking] = useState(false);
  /** Dernier widget ajouté ou redimensionné : il s'illumine un instant. */
  const [highlight, setHighlight] = useState<{ id: Id; entering: boolean } | null>(null);
  const [removed, setRemoved] = useState<{ widget: Placed; index: number } | null>(null);

  const { gridRef, dragged, dragHeight, startDrag, dragTo, endDrag } = useWidgetDragReorder<Id>(layout, onChange, reduce);

  const name = (id: Id) => cat.name(id);
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
      document.querySelector(`[data-widget="${highlight.id}"]`)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [highlight, reduce]);

  const remove = (id: Id) => {
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

  const resize = (id: Id, size: WidgetSize) => {
    onChange(resizeWidgetIn(cat.defs, layout, id, size));
    setHighlight({ id, entering: false });
  };

  const toolbarButton = 'min-h-touch inline-flex items-center gap-1.5 px-3.5 rounded-xl text-sm font-semibold';

  const toolbar = (
        <div className="flex flex-wrap items-center justify-end gap-2 min-h-touch">
          <AnimatePresence mode="popLayout" initial={false}>
            {editing ? (
              [
                // « Réinitialiser » : défait ce qui a changé depuis le dernier point
                // de reprise, et seulement s'il y a quelque chose à défaire.
                dirty && (
                  <motion.button
                    key="reset"
                    type="button"
                    layout={!reduce}
                    initial={{ opacity: 0, y: -10, scale: 0.85 }}
                    animate={{ opacity: 1, y: 0, scale: 1, transition: POP }}
                    exit={{ opacity: 0, y: -10, scale: 0.85 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => { onChange([...base]); setRemoved(null); }}
                    className={`${toolbarButton} font-normal text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]`}
                  >
                    <RotateCcw size={15} aria-hidden="true" />
                    {t('apercu.widgets.reset')}
                  </motion.button>
                ),
                roleTemplate && <motion.button
                  key="templates"
                  type="button"
                  layout={!reduce}
                  initial={{ opacity: 0, y: -10, scale: 0.85 }}
                  animate={{ opacity: 1, y: 0, scale: 1, transition: { ...POP, delay: 0.08 } }}
                  exit={{ opacity: 0, y: -10, scale: 0.85 }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setChoosingTemplate(true)}
                  className={`${toolbarButton} border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))]`}
                >
                  <LayoutTemplate size={16} aria-hidden="true" />
                  {t('apercu.widgets.tpl.button')}
                </motion.button>,
                <motion.button
                  key="add"
                  type="button"
                  layout={!reduce}
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
                  layout={!reduce}
                  initial={{ opacity: 0, y: -10, scale: 0.85 }}
                  animate={{ opacity: 1, y: 0, scale: 1, transition: { ...POP, delay: 0.15 } }}
                  exit={{ opacity: 0, y: -10, scale: 0.85 }}
                  whileTap={{ scale: 0.94 }}
                  onClick={finishEditing}
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
                layout={!reduce}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1, transition: POP }}
                exit={{ opacity: 0, scale: 0.85 }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.94 }}
                onClick={startEditing}
                data-testid="apercu-edit"
                // Bouton discret, dashboard perso ET Aperçu entreprise (maquette 3,
                // 2026-10-29 ; même fonctionnalité, même bouton).
                className={`${toolbarButton} px-3 font-medium text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))]`}
                aria-label={t('apercu.widgets.edit')}
              >
                <Pencil size={15} aria-hidden="true" />
                {tCommon('actions.edit')}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
  );

  return (
      <section aria-label={t('apercu.widgets.regionLabel')} className="space-y-4">
        {toolbarSlot ? createPortal(toolbar, toolbarSlot) : toolbar}

        <AnimatePresence initial={false}>
          {draft && (
            <motion.div
              key="draft"
              role="status"
              initial={{ opacity: 0, y: -12, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -12, height: 0 }}
              transition={SPRING}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[rgb(var(--color-accent)/0.5)] bg-[rgb(var(--color-accent)/0.08)] px-4 py-3">
                <LayoutTemplate size={18} className="shrink-0 text-[rgb(var(--color-accent))]" aria-hidden="true" />
                <p className="flex-1 min-w-[200px] text-sm text-[rgb(var(--color-text-primary))]">
                  <span className="font-semibold">{t('apercu.widgets.tpl.draftTitle', { name: t(`apercu.widgets.tpl.names.${draft.template}`) })}</span>{' '}
                  <span className="text-[rgb(var(--color-text-secondary))]">{t('apercu.widgets.tpl.draftHint')}</span>
                </p>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setDraft(null)}
                  className="min-h-touch px-3.5 rounded-xl text-sm font-semibold text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]"
                >
                  {t('apercu.widgets.tpl.cancel')}
                </motion.button>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => { save(draft.layout); setCheckpoint(draft.layout); setDraft(null); setRemoved(null); }}
                  className="min-h-touch inline-flex items-center gap-1.5 px-4 rounded-xl bg-[rgb(var(--color-accent))] text-sm font-semibold text-white hover:opacity-90"
                >
                  <Check size={16} aria-hidden="true" />
                  {t('apercu.widgets.tpl.apply')}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
              onClick={() => { startEditing(); setPicking(true); }}
              className="mt-3 min-h-touch inline-flex items-center gap-1.5 px-4 rounded-xl bg-[rgb(var(--color-accent))] text-sm font-semibold text-white"
            >
              <Plus size={16} aria-hidden="true" />
              {t('apercu.widgets.add')}
            </motion.button>
          </motion.div>
        ) : (
          <ul ref={gridRef} className="apercu-widget-grid relative z-0 isolate grid grid-cols-1 md:grid-cols-6 gap-5 items-stretch">
            <AnimatePresence mode="popLayout" initial={false}>
              {layout.map((w, index) => {
                const def = findDef(cat.defs, w.id);
                const content = renderWidget(w.id, w.size);
                const isDragged = dragged === w.id;
                const lit = highlight?.id === w.id;
                return (
                  <motion.li
                    key={w.id}
                    data-widget={w.id}
                    layout={!reduce}
                    transition={dragged ? REFLOW : SPRING}
                    initial={lit && highlight?.entering ? { opacity: 0, scale: 0.4, y: 60 } : false}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.3, rotate: -6, filter: 'blur(8px)', transition: { duration: 0.38, ease: [0.4, 0, 0.2, 1] } }}
                    drag={editing}
                    dragSnapToOrigin
                    dragTransition={reduce ? INSTANT_DRAG_SNAP : undefined}
                    dragMomentum={false}
                    dragElastic={0.18}
                    onDragStart={(e) => startDrag(w.id, (e.target as HTMLElement).closest<HTMLElement>('[data-widget]'))}
                    onDrag={(_, info) => dragTo(w.id, info)}
                    onDragEnd={(e) => endDrag((e.target as HTMLElement).closest<HTMLElement>('[data-widget]'))}
                    whileDrag={{ scale: 1.06, zIndex: 40, boxShadow: '0 24px 48px -12px rgba(0,0,0,0.45)' }}
                    style={{ zIndex: isDragged ? 40 : undefined, height: isDragged ? dragHeight ?? undefined : undefined, touchAction: editing ? 'none' : undefined }}
                    // Bloc tenu : `self-start`, il garde SA hauteur. Étiré à la
                    // hauteur de chaque ligne traversée, il changeait de taille
                    // d'un coup à chaque échange (177 → 394 px en une image),
                    // Framer n'animant pas le layout d'un élément en glisser.
                    className={`relative min-w-0 rounded-2xl ${SIZE_SPAN_CLASS[w.size]} ${editing ? (isDragged ? 'cursor-grabbing self-start' : 'cursor-grab') : ''}`}
                  >
                    {/* La vibration : rotation seule, rythme décalé d'un bloc à l'autre.
                        Coupée sous mouvement réduit : la croix et les flèches
                        disent déjà qu'on est en édition. */}
                    <motion.div
                      className="h-full"
                      animate={editing && !isDragged && !reduce
                        ? { rotate: [-0.45, 0.45, -0.45], scale: 0.98 }
                        : { rotate: 0, scale: 1 }}
                      transition={editing && !isDragged && !reduce
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
                                        layoutId={reduce ? undefined : `size-pill-${w.id}`}
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
          {choosingTemplate && roleTemplate && (
            <Suspense key="templates" fallback={null}>
              <TemplatePicker
                recommended={roleTemplate ?? 'member'}
                onPick={(id) => {
                  setDraft({ template: id, layout: [...templateOf(id)] });
                  setRemoved(null);
                  setChoosingTemplate(false);
                  setEditing(true);
                }}
                onClose={() => setChoosingTemplate(false)}
              />
            </Suspense>
          )}
          {picking && (
            <Suspense key="picker" fallback={null}>
              <AddWidgetPage
                layout={layout}
                catalog={cat}
                onAdd={(id: Id, size: WidgetSize) => {
                  const next = addWidgetIn(cat.defs, layout, id, size);
                  onChange(next);
                  // Widget multiple : le nouvel exemplaire est le dernier posé.
                  const multi = !!findDef(cat.defs, id)?.multi;
                  const target = multi ? next[next.length - 1].id : id;
                  setHighlight({ id: target, entering: multi || !layout.some((w) => w.id === id) });
                  setPicking(false);
                }}
                onRemove={remove}
                renderWidget={renderWidget}
                onClose={() => setPicking(false)}
              />
            </Suspense>
          )}
        </AnimatePresence>
      </section>
  );
};

export default ApercuWidgetGrid;
