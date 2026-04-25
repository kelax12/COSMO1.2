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
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={onClose}
          onKeyDown={handleKeyDown}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="w-full rounded-2xl shadow-2xl border overflow-hidden"
            style={{ backgroundColor: 'rgb(var(--color-surface))', borderColor: 'rgb(var(--color-border))', maxWidth: 'calc(32rem * 1.08)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex justify-between items-center px-6 py-4 border-b"
              style={{ borderColor: 'rgb(var(--color-border))' }}
            >
              <h2 className="text-lg font-semibold" style={{ color: 'rgb(var(--color-text-primary))' }}>
                {isEditing ? "Modifier l'habitude" : 'Nouvelle habitude'}
              </h2>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X size={18} />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
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

              <div
                className="flex justify-end gap-3 pt-4 border-t"
                style={{ borderColor: 'rgb(var(--color-border))' }}
              >
                <Button type="button" variant="outline" size="lg" onClick={onClose}>
                  Annuler
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700 !text-white !border-0 gap-2"
                >
                  <Check size={16} />
                  {isEditing ? 'Sauvegarder' : "Créer l'habitude"}
                </Button>
              </div>
            </form>
          </motion.div>

          <ColorSettingsModal isOpen={isColorSettingsOpen} onClose={() => setIsColorSettingsOpen(false)} />
        </div>
      )}
    </AnimatePresence>
  );
};

export default HabitModal;
