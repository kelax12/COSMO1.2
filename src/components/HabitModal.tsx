import React, { useState, useEffect } from 'react';
import { X, Plus, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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

  const [formData, setFormData] = useState({
    name: '',
    estimatedTime: 30,
    color: '#3B82F6',
  });
  const [isColorSettingsOpen, setIsColorSettingsOpen] = useState(false);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (isEditing && habit) {
      updateHabitMutation.mutate({ id: habit.id, updates: formData }, { onSuccess: () => onClose() });
    } else {
      createHabitMutation.mutate(
        { name: formData.name, estimatedTime: formData.estimatedTime, color: formData.color, frequency: 'daily', icon: '✓', description: '' },
        { onSuccess: () => onClose() }
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

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
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0, transition: { duration: 0.25, ease: [0.32, 0.72, 0, 1] } }}
              transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
              className="w-full sm:max-w-lg sm:rounded-2xl rounded-t-[28px] shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:shadow-2xl flex flex-col max-h-[88vh]"
              style={{
                backgroundColor: 'rgb(var(--color-surface))',
                paddingBottom: 'env(safe-area-inset-bottom)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag handle (mobile only - visual) */}
              <div className="sm:hidden flex justify-center pt-4 pb-3 shrink-0">
                <div className="w-9 h-[5px] rounded-full bg-slate-300/70 dark:bg-slate-500/60" />
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
              <form id="habit-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                      Nom de l'habitude
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 h-11 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                      style={{
                        backgroundColor: 'rgb(var(--color-surface))',
                        color: 'rgb(var(--color-text-primary))',
                        borderColor: 'rgb(var(--color-border))',
                      }}
                      placeholder="Ex: Lire 30 minutes..."
                      autoFocus
                      required
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
