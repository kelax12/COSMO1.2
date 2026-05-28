import React, { useState, useEffect } from 'react';
import { X, Plus, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';
import { useInvalidShake } from '@/hooks/use-invalid-shake';
import { useIsMobile } from '@/lib/hooks/use-mobile';
import { useFavoriteColors } from '@/modules/ui-states';
import { useCategories } from '@/modules/categories';
import { useCreateHabit, useUpdateHabit, Habit } from '@/modules/habits';
import ColorSettingsModal from './ColorSettingsModal';
import { Button } from '@/components/ui/button';

interface HabitModalProps {
  isOpen: boolean;
  onClose: () => void;
  habit?: Habit;
}

const HabitModal: React.FC<HabitModalProps> = ({ isOpen, onClose, habit }) => {
  const { favoriteColors } = useFavoriteColors();
  const { data: categories = [] } = useCategories();
  const createHabitMutation = useCreateHabit();
  const updateHabitMutation = useUpdateHabit();
  const isEditing = !!habit;
  const isMobile = useIsMobile();

  const [formData, setFormData] = useState({
    name: '',
    estimatedTime: 30,
    color: '#3B82F6',
  });
  const [isColorSettingsOpen, setIsColorSettingsOpen] = useState(false);
  const { register, trigger, clear, isInvalid } = useInvalidShake();

  useEffect(() => {
    if (isOpen) {
      if (habit) {
        setFormData({ name: habit.name, estimatedTime: habit.estimatedTime, color: habit.color });
      } else {
        setFormData({
          name: '',
          estimatedTime: 30,
          color: categories[0]?.color || favoriteColors[0] || '#3B82F6',
        });
      }
    }
  }, [isOpen, habit, categories, favoriteColors]);

  const doSave = () => {
    if (!formData.name.trim()) {
      trigger(['name']);
      return;
    }
    if (isEditing && habit) {
      updateHabitMutation.mutate({ id: habit.id, updates: formData }, { onSuccess: () => onClose() });
    } else {
      createHabitMutation.mutate(
        { name: formData.name, estimatedTime: formData.estimatedTime, color: formData.color, frequency: 'daily', icon: '✓', description: '' },
        { onSuccess: () => onClose() }
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSave();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  const { sheetRef, handleBarWidth, sheetDragProps } = useBottomSheet(onClose);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-md flex items-end sm:items-center justify-center z-50 sm:p-4"
            onClick={onClose}
            onKeyDown={handleKeyDown}
          >
            <motion.div
              ref={sheetRef}
              {...sheetDragProps}
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '110%', opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
              transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
              className="w-full sm:max-w-lg sm:rounded-2xl rounded-t-[28px] shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:shadow-2xl flex flex-col max-h-[88vh]"
              style={{
                backgroundColor: 'rgb(var(--color-surface))',
                paddingBottom: isMobile ? 0 : 'env(safe-area-inset-bottom)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {isMobile ? (
                /* ── MOBILE iOS ── */
                <div className="flex flex-col bg-gray-50 dark:bg-gray-950 rounded-t-3xl">
                  {/* Drag handle */}
                  <div className="flex justify-center pt-2.5 shrink-0">
                    <motion.div style={{ width: handleBarWidth }} className="h-1 rounded-full bg-gray-300/70 dark:bg-gray-600/60" />
                  </div>

                  {/* iOS Header */}
                  <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200/80 dark:border-gray-800 shrink-0">
                    <button
                      type="button"
                      onClick={onClose}
                      className="text-blue-500 text-[15px] min-w-16 min-h-11 flex items-center"
                    >
                      Annuler
                    </button>
                    <span className="text-[17px] font-semibold text-gray-900 dark:text-gray-100">
                      {isEditing ? 'Modifier' : 'Nouvelle habitude'}
                    </span>
                    <button
                      type="button"
                      onClick={doSave}
                      className={`text-[15px] font-semibold min-w-16 min-h-11 flex items-center justify-end ${
                        formData.name.trim() ? 'text-blue-500' : 'text-blue-300'
                      }`}
                    >
                      {isEditing ? 'OK' : 'Créer'}
                    </button>
                  </div>

                  {/* Scroll area */}
                  <div data-scroll-area className="flex-1 overflow-y-auto px-4 py-4">

                    {/* Groupe 1 — Nom (sans overflow-hidden pour iOS selection handles) */}
                    <div
                      ref={register('name')}
                      className={`bg-white dark:bg-gray-900 rounded-2xl shadow-sm transition-[box-shadow] ${
                        isInvalid('name') ? 'ring-2 ring-red-500' : ''
                      }`}
                    >
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => { setFormData({ ...formData, name: e.target.value }); clear('name'); }}
                        placeholder="Nom de l'habitude"
                        autoFocus
                        className="w-full px-4 min-h-12 text-[17px] bg-transparent focus:outline-none focus:ring-0 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600"
                        style={{ border: 'none' }}
                      />
                    </div>

                    {/* Section DÉTAILS */}
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 pb-1 pt-5">
                      Détails
                    </p>
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden">
                      <div className="flex items-center px-4 min-h-11">
                        <span className="flex-1 text-[15px] text-gray-900 dark:text-gray-100">Durée</span>
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() =>
                              setFormData({ ...formData, estimatedTime: Math.max(5, formData.estimatedTime - 5) })
                            }
                            aria-label="Réduire la durée"
                            className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 text-lg leading-none"
                          >
                            −
                          </button>
                          <span className="text-[15px] text-blue-500 w-16 text-center">
                            {formData.estimatedTime} min
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setFormData({ ...formData, estimatedTime: formData.estimatedTime + 5 })
                            }
                            aria-label="Augmenter la durée"
                            className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 text-lg leading-none"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Section COULEUR */}
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-4 pb-1 pt-5">
                      Couleur
                    </p>
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden px-4 py-4">
                      <div className="flex flex-wrap gap-3">
                        {favoriteColors.map((favColor, index) => (
                          <button
                            key={`${favColor}-${index}`}
                            type="button"
                            onClick={() => setFormData({ ...formData, color: favColor })}
                            aria-label={`Couleur ${favColor}`}
                            className={`w-10 h-10 rounded-xl transition-transform active:scale-90 ${
                              formData.color === favColor
                                ? 'ring-2 ring-offset-2 ring-gray-900 dark:ring-white scale-110'
                                : ''
                            }`}
                            style={{ backgroundColor: favColor }}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => setIsColorSettingsOpen(true)}
                          aria-label="Personnaliser les couleurs"
                          className="w-10 h-10 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center"
                        >
                          <Plus className="w-4 h-4 text-blue-500" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Footer CTA */}
                  <div
                    className="px-4 pt-3 border-t border-gray-100 dark:border-gray-800 shrink-0"
                    style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
                  >
                    <button
                      type="button"
                      onClick={doSave}
                      className={`w-full h-[50px] rounded-2xl text-[17px] font-semibold text-white transition-colors ${
                        formData.name.trim()
                          ? 'bg-blue-600 active:bg-blue-700'
                          : 'bg-blue-200 dark:bg-blue-900/40'
                      }`}
                    >
                      {isEditing ? 'Sauvegarder' : "Créer l'habitude"}
                    </button>
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
                    className="flex justify-between items-center px-4 sm:px-6 py-3 sm:py-4 border-b shrink-0"
                    style={{ borderColor: 'rgb(var(--color-border))' }}
                  >
                    <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                      {isEditing ? "Modifier l'habitude" : 'Nouvelle habitude'}
                    </h2>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                      <X size={18} />
                    </Button>
                  </div>

                  {/* Scrollable body */}
                  <form id="habit-form" onSubmit={handleSubmit} data-scroll-area className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2" ref={register('name')}>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                          Nom de l'habitude
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => { setFormData({ ...formData, name: e.target.value }); clear('name'); }}
                          className={`w-full px-4 h-11 border rounded-lg focus:outline-none focus:ring-2 transition-colors text-sm ${
                            isInvalid('name') ? 'border-red-500 focus:ring-red-500/40' : 'focus:ring-blue-500 focus:border-blue-500'
                          }`}
                          style={{
                            backgroundColor: 'rgb(var(--color-surface))',
                            color: 'rgb(var(--color-text-primary))',
                            borderColor: isInvalid('name') ? '#ef4444' : 'rgb(var(--color-border))',
                          }}
                          placeholder="Ex: Lire 30 minutes..."
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
                          className="w-full px-4 h-11 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
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
                          className="w-9 h-9 rounded-lg border-2 border-dashed flex items-center justify-center transition-all hover:scale-105 hover:border-blue-500"
                          style={{ borderColor: 'rgb(var(--color-border))' }}
                        >
                          <Plus className="w-4 h-4 text-blue-500" />
                        </button>
                      </div>

                      {categories.length > 0 && (
                        <div
                          className="mt-3 p-2.5 rounded-xl border"
                          style={{ borderColor: 'rgb(var(--color-border))' }}
                        >
                          <h4
                            className="text-[10px] font-bold uppercase tracking-widest mb-2"
                            style={{ color: 'rgb(var(--color-text-muted))' }}
                          >
                            Légende
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
                    className="px-4 sm:px-6 pt-3 pb-3 border-t shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end gap-2"
                    style={{ borderColor: 'rgb(var(--color-border))' }}
                  >
                    <Button type="button" variant="outline" size="lg" onClick={onClose} className="sm:w-auto">
                      Annuler
                    </Button>
                    <Button
                      type="submit"
                      form="habit-form"
                      size="lg"
                      className="bg-blue-600 hover:bg-blue-700 !text-white !border-0 gap-2 sm:w-auto"
                    >
                      <Check size={16} />
                      {isEditing ? 'Sauvegarder' : "Créer l'habitude"}
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
    </>
  );
};

export default HabitModal;
