import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Check, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';
import { useInvalidShake } from '@/hooks/use-invalid-shake';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { useFavoriteColors } from '@/modules/ui-states';
import { useCategories } from '@/modules/categories';
import { NO_CATEGORY_COLOR } from '@/lib/category-colors';
import { useCreateHabit, useUpdateHabit, Habit } from '@/modules/habits';
import ColorSettingsModal from './ColorSettingsModal';
import ConfirmDiscardDialog from './ConfirmDiscardDialog';
import { Button } from '@/components/ui/button';
import { formatDurationMinutes } from '@/lib/duration';
import { useT } from '@/i18n/useT';
import { useSheetMotion } from '@/components/mobile/mobile-motion';

interface HabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  habit?: Habit;
}

/** Minutes → `HH:MM` pour l'input natif `type="time"` (roue OS), même
 *  pattern que le champ Durée de TaskModalMobileBody. */
const minutesToTimeValue = (minutes: number | string): string => {
  const total = typeof minutes === 'number' ? minutes : Number(minutes) || 0;
  const h = Math.floor(total / 60).toString().padStart(2, '0');
  const m = (total % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

const timeValueToMinutes = (value: string): number => {
  const [h, m] = value.split(':').map((n) => Number(n) || 0);
  return h * 60 + m;
};

const HabitModal: React.FC<HabitModalProps> = ({ isOpen, onClose, habit }) => {
  const { t } = useT('habits');
  const { t: tCommon } = useT('common');
  const { favoriteColors } = useFavoriteColors();
  const { data: categories = [] } = useCategories();
  const createHabitMutation = useCreateHabit();
  const updateHabitMutation = useUpdateHabit();
  const isEditing = !!habit;
  const isMobile = useIsMobile();
  // Maquette 329 : la catégorie se choisit par identifiant ; plusieurs
  // catégories partagent une couleur, la couleur seule ne la désigne pas.
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    estimatedTime: 30,
    color: '#3B82F6',
  });
  const [isColorSettingsOpen, setIsColorSettingsOpen] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const { register, trigger, clear, isInvalid } = useInvalidShake();
  // Garde anti-double-soumission : un double-clic rapide déclenchait deux
  // mutations create avant que `isPending` ne passe à true (re-render async).
  const isSubmittingRef = useRef(false);

  // #40 — snapshot des valeurs initiales : fermer avec des changements non
  // sauvés demande confirmation (misclick d'overlay, Échap, drag du sheet).
  const initialSnapshotRef = useRef<string>('');

  useEffect(() => {
    if (isOpen) {
      const initial = habit
        ? { name: habit.name, estimatedTime: habit.estimatedTime, color: habit.color }
        : {
            name: '',
            estimatedTime: 30,
            color: categories[0]?.color || favoriteColors[0] || '#3B82F6',
          };
      setFormData(initial);
      setCategoryId(null);
      initialSnapshotRef.current = JSON.stringify(initial);
    }
  }, [isOpen, habit, categories, favoriteColors]);

  const isDirty = initialSnapshotRef.current !== '' && JSON.stringify(formData) !== initialSnapshotRef.current;
  const guardedClose = () => {
    if (isDirty) { setShowDiscardConfirm(true); return; }
    onClose();
  };
  const confirmDiscardClose = () => {
    setShowDiscardConfirm(false);
    onClose();
  };

  const doSave = () => {
    if (!formData.name.trim()) {
      trigger(['name']);
      return;
    }
    // Anti-double-soumission (double-clic / double-tap).
    if (isSubmittingRef.current || createHabitMutation.isPending || updateHabitMutation.isPending) return;
    isSubmittingRef.current = true;
    if (isEditing && habit) {
      updateHabitMutation.mutate(
        { id: habit.id, updates: formData },
        { onSuccess: () => onClose(), onSettled: () => { isSubmittingRef.current = false; } }
      );
    } else {
      createHabitMutation.mutate(
        { name: formData.name, estimatedTime: formData.estimatedTime, color: formData.color, frequency: 'daily', icon: '✓', description: '' },
        { onSuccess: () => onClose(), onSettled: () => { isSubmittingRef.current = false; } }
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSave();
  };

  // C-53 — l'ancien gestionnaire d'Echap etait un `onKeyDown` React pose sur
  // l'overlay : il dependait de la remontee d'un evenement depuis l'element
  // focalise, donc il mourait des que le focus sortait de la modale. Il n'y
  // avait par ailleurs aucun piege, aucune restitution du focus, aucun role.
  // Tout cela vient maintenant de `useModalA11y`, qui ecoute `document`.
  const { sheetRef, handleBarWidth, sheetDragProps } = useBottomSheet(guardedClose);
  const sheetMotion = useSheetMotion();
  const { ref: overlayRef, dialogProps } = useModalA11y<HTMLDivElement>({
    open: isOpen,
    onClose: guardedClose,
    label: isEditing ? t('modal.editHabit') : t('modal.createHabit'),
  });

  // `'__none'` : « Sans catégorie » choisi explicitement (couleur grise).
  const noCategory = categoryId === '__none' || (!categoryId && formData.color === NO_CATEGORY_COLOR);
  const selectedCategory = noCategory ? undefined : (categories.find((c) => c.id === categoryId) ?? categories.find((c) => c.color === formData.color));

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            ref={overlayRef}
            {...dialogProps}
            className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-end sm:items-center justify-center z-50 sm:p-4"
            onClick={guardedClose}
          >
            <motion.div
              ref={sheetRef}
              {...sheetDragProps}
              {...sheetMotion}
              className="w-full sm:max-w-lg sm:rounded-2xl rounded-t-[28px] shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:shadow-2xl flex flex-col max-h-[88vh]"
              style={{
                backgroundColor: 'rgb(var(--color-surface))',
                paddingBottom: isMobile ? 0 : 'env(safe-area-inset-bottom)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {isMobile ? (
                /* ── MOBILE iOS ── */
                <div className="flex flex-col bg-[rgb(var(--color-background))] rounded-t-3xl">
                  {/* Drag handle */}
                  <div className="flex justify-center pt-2.5 shrink-0">
                    <motion.div style={{ width: handleBarWidth }} className="h-1 rounded-full bg-[rgb(var(--color-border-strong))]" />
                  </div>

                  {/* iOS Header */}
                  <div className="flex items-center justify-between px-4 h-14 border-b border-[rgb(var(--color-border))] shrink-0">
                    <button
                      type="button"
                      onClick={guardedClose}
                      className="text-blue-500 text-[15px] min-w-16 min-h-11 flex items-center"
                    >
                      {tCommon('actions.cancel')}
                    </button>
                    <span className="text-[17px] font-semibold text-[rgb(var(--color-text-primary))]">
                      {isEditing ? t('modal.edit') : t('modal.newHabit')}
                    </span>
                    <button
                      type="button"
                      onClick={doSave}
                      className={`text-[15px] font-semibold min-w-16 min-h-11 flex items-center justify-end ${
                        formData.name.trim() ? 'text-blue-500' : 'text-[rgb(var(--color-text-muted))]'
                      }`}
                    >
                      {isEditing ? t('modal.ok') : t('modal.create')}
                    </button>
                  </div>

                  {/* Scroll area — le padding bas remplace celui de l'ancien
                      CTA plein-largeur (supprimé) pour garder le contenu au-
                      dessus de l'indicateur d'accueil iOS. */}
                  <div
                    data-scroll-area
                    className="flex-1 overflow-y-auto px-4 pt-4"
                    style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}
                  >

                    {/* Groupe 1 — Nom (sans overflow-hidden pour iOS selection handles) */}
                    <div
                      ref={register('name')}
                      // Maquette 325 : le nom sans cadre, en titre.
                      className={`rounded-xl transition-[box-shadow] ${
                        isInvalid('name') ? 'ring-2 ring-red-500' : ''
                      }`}
                    >
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => { setFormData({ ...formData, name: e.target.value }); clear('name'); }}
                        placeholder={t('modal.namePlaceholder')}
                        // Maquette 331 : le clavier s'ouvre sur le nom.
                        autoFocus={!isEditing}
                        className="no-input-chrome w-full px-1 min-h-12 text-title font-semibold bg-transparent focus:outline-none focus:ring-0 text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-muted))]"
                        style={{ border: 'none' }}
                      />
                    </div>

                    {/* Maquettes 326 à 334 (2026-10-11) : un seul groupe, comme la
                        fiche tâche (332). Durée lue « 30 min » (326) ; catégorie en
                        une ligne point et nom (328), choisie PAR IDENTIFIANT : par
                        couleur, trois catégories bleues paraissaient choisies (329). */}
                    <p className="text-label font-semibold text-[rgb(var(--color-text-muted))] px-4 pb-1 pt-5">
                      {t('modal.details')}
                    </p>
                    <div className="bg-[rgb(var(--color-surface))] rounded-2xl shadow-sm overflow-hidden">
                      <label className="relative flex items-center justify-between px-4 min-h-11">
                        <span className="text-[15px] text-[rgb(var(--color-text-primary))]">{t('modal.duration')}</span>
                        <span className="text-[15px] text-[rgb(var(--color-text-secondary))]">{formatDurationMinutes(formData.estimatedTime)}</span>
                        <input
                          type="time"
                          aria-label={t('modal.duration')}
                          value={minutesToTimeValue(formData.estimatedTime)}
                          onChange={(e) => setFormData({ ...formData, estimatedTime: timeValueToMinutes(e.target.value) })}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          style={{ border: 'none' }}
                        />
                      </label>
                      <div className="h-px bg-[rgb(var(--color-border))] ml-4" />
                      <label className="relative flex items-center justify-between gap-3 px-4 min-h-11">
                        <span className="text-[15px] text-[rgb(var(--color-text-primary))]">{t('modal.category')}</span>
                        <span className="flex items-center gap-2 min-w-0 text-[15px] text-[rgb(var(--color-text-secondary))]">
                          {selectedCategory ? (
                            <>
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: selectedCategory.color }} aria-hidden="true" />
                              <span className="truncate">{selectedCategory.name}</span>
                            </>
                          ) : noCategory ? (
                            <span className="truncate">{tCommon('noCategory')}</span>
                          ) : (
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: formData.color }} aria-hidden="true" />
                          )}
                          <ChevronRight size={16} aria-hidden="true" className="text-[rgb(var(--color-text-muted))]" />
                        </span>
                        <select
                          aria-label={t('modal.category')}
                          value={selectedCategory?.id ?? (noCategory ? '__none' : '')}
                          onChange={(e) => {
                            if (e.target.value === '__new') { setIsColorSettingsOpen(true); return; }
                            if (e.target.value === '__none') { setCategoryId('__none'); setFormData({ ...formData, color: NO_CATEGORY_COLOR }); return; }
                            const cat = categories.find((c) => c.id === e.target.value);
                            if (cat) { setCategoryId(cat.id); setFormData({ ...formData, color: cat.color }); }
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        >
                          {!selectedCategory && !noCategory && <option value="">{t('modal.category')}</option>}
                          <option value="__none">{tCommon('noCategory')}</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                          {/* Maquette 334 : « Nouvelle catégorie », plus « + Personnaliser » en pointillés. */}
                          <option value="__new">{t('modal.newCategory')}</option>
                        </select>
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── DESKTOP (inchangé) ── */
                <>
                  {/* Drag handle — reacts to swipe on mobile */}
                  <div className="sm:hidden flex justify-center pt-4 pb-3 shrink-0">
                    <motion.div style={{ width: handleBarWidth }} className="h-[5px] rounded-full bg-slate-300/70 dark:bg-slate-500/60" />
                  </div>

                  {/* Sticky header */}
                  <div
                    className="flex justify-between items-center px-4 sm:px-6 py-[0.420204rem] sm:py-[0.560272rem] border-b shrink-0"
                    style={{ borderColor: 'rgb(var(--color-border))' }}
                  >
                    <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                      {isEditing ? t('modal.editHabit') : t('modal.newHabit')}
                    </h2>
                    <Button variant="ghost" size="icon" onClick={guardedClose} aria-label={t('modal.close')}>
                      <X size={18} />
                    </Button>
                  </div>

                  {/* Scrollable body */}
                  <form id="habit-form" onSubmit={handleSubmit} data-scroll-area className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-5" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2" ref={register('name')}>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                          {t('modal.nameLabel')}
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => { setFormData({ ...formData, name: e.target.value }); clear('name'); }}
                          className={`w-full px-[0.875425rem] h-[2.407419rem] border rounded-lg focus:outline-none focus:ring-2 transition-colors text-[0.765997rem] ${
                            isInvalid('name') ? 'border-red-500 focus:ring-red-500/40' : 'focus:ring-[rgb(var(--color-accent))] focus:border-[rgb(var(--color-accent))]'
                          }`}
                          style={{
                            backgroundColor: 'rgb(var(--color-surface))',
                            color: 'rgb(var(--color-text-primary))',
                            borderColor: isInvalid('name') ? '#ef4444' : 'rgb(var(--color-border))',
                          }}
                          placeholder={t('modal.descriptionPlaceholder')}
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                          Temps (min)
                        </label>
                        <input
                          type="number"
                          value={formData.estimatedTime}
                          onChange={(e) => setFormData({ ...formData, estimatedTime: Number(e.target.value) })}
                          className="w-full px-[0.875425rem] h-[2.407419rem] border rounded-lg focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))] focus:border-[rgb(var(--color-accent))] transition-colors text-[0.765997rem]"
                          style={{
                            backgroundColor: 'rgb(var(--color-surface))',
                            color: 'rgb(var(--color-text-primary))',
                            borderColor: 'rgb(var(--color-border))',
                          }}
                          min="1"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                        Couleur
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {favoriteColors.map((favColor, index) => (
                          <button
                            key={`${favColor}-${index}`}
                            type="button"
                            onClick={() => setFormData({ ...formData, color: favColor })}
                            className={`w-9 h-9 rounded-lg border-2 transition-all hover:scale-105 ${
                              formData.color === favColor ? 'scale-110 shadow-lg border-slate-900 dark:border-white' : ''
                            }`}
                            style={{
                              backgroundColor: favColor,
                              borderColor: formData.color === favColor ? undefined : 'rgb(var(--color-border))',
                            }}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => setIsColorSettingsOpen(true)}
                          className="w-9 h-9 rounded-lg border-2 border-dashed flex items-center justify-center transition-all hover:scale-105 hover:border-[rgb(var(--color-accent))]"
                          style={{ borderColor: 'rgb(var(--color-border))' }}
                        >
                          <Plus className="w-4 h-4 text-blue-500" />
                        </button>
                      </div>

                      {categories.length > 0 && (
                        <div
                          className="mt-3 p-2.5 rounded-xl border"
                          style={{ borderColor: 'rgb(var(--color-border))', backgroundColor: 'rgb(var(--color-surface))' }}
                        >
                          <h4
                            className="text-[10px] font-bold uppercase tracking-widest mb-2"
                            style={{ color: 'rgb(var(--color-text-muted))' }}
                          >
                            {t('modal.legend')}
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5 max-h-[80px] overflow-y-auto">
                            {categories.map((cat) => (
                              <div key={cat.id} className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                                <span className="text-xs truncate" style={{ color: 'rgb(var(--color-text-primary))' }}>
                                  {cat.name}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </form>

                  {/* Sticky footer */}
                  <div
                    className="px-4 sm:px-6 pt-[0.6555rem] pb-[0.6555rem] border-t shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2"
                    style={{ borderColor: 'rgb(var(--color-border))' }}
                  >
                    <Button type="button" variant="outline" size="lg" onClick={guardedClose} className="sm:w-auto">
                      {tCommon('actions.cancel')}
                    </Button>
                    <Button
                      type="submit"
                      form="habit-form"
                      size="lg"
                      className="bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] !text-[rgb(var(--color-accent-solid-foreground))] !border-0 gap-2 sm:w-auto"
                    >
                      <Check size={16} />
                      {isEditing ? t('modal.save') : t('modal.createHabit')}
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ColorSettingsModal en dehors du div overlay pour éviter la propagation de clics */}
      <ColorSettingsModal isOpen={isColorSettingsOpen} onClose={() => setIsColorSettingsOpen(false)} />

      <ConfirmDiscardDialog
        isOpen={showDiscardConfirm}
        onCancel={() => setShowDiscardConfirm(false)}
        onConfirm={confirmDiscardClose}
      />
    </>
  );
};

export default HabitModal;
