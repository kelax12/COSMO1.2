import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, Category } from '@/modules/categories';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

type ColorSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  isNested?: boolean;
};

const ColorSettingsModal: React.FC<ColorSettingsModalProps> = ({ isOpen, onClose, isNested }) => {
  const { data: categories = [] } = useCategories();
  const createCategoryMutation = useCreateCategory();
  const updateCategoryMutation = useUpdateCategory();
  const deleteCategoryMutation = useDeleteCategory();
  
  const [localCategories, setLocalCategories] = useState<Category[]>([]);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync local state with fetched categories
  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  if (!isOpen) return null;

  const handleAddCategory = () => {
    const newId = `temp-${Date.now()}`;
    const newCat: Category = {
      id: newId,
      name: '',
      color: '#3B82F6'
    };
    setLocalCategories([...localCategories, newCat]);
    
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 100);
  };

  const handleUpdateLocal = (id: string, updates: Partial<{ name: string; color: string }>) => {
    setLocalCategories(prev => prev.map(cat => cat.id === id ? { ...cat, ...updates } : cat));
  };

  const handleDeleteLocal = (id: string) => {
    setCategoryToDelete(id);
  };

  const confirmDeleteLocal = () => {
    if (categoryToDelete) {
      setLocalCategories(prev => prev.filter(cat => cat.id !== categoryToDelete));
      setCategoryToDelete(null);
    }
  };
  
  const handleSave = async () => {
    // Validation : chaque nom de catégorie doit faire ≥ 2 caractères
    const invalid = localCategories.find(lc => lc.name.trim().length < 2);
    if (invalid) {
      toast.error('Chaque nom de catégorie doit contenir au moins 2 caractères');
      return;
    }

    setIsSaving(true);
    try {
      // Delete categories that were removed
      const deletePromises = categories
        .filter(cat => !localCategories.find(lc => lc.id === cat.id))
        .map(cat => deleteCategoryMutation.mutateAsync(cat.id));

      // Create or update categories
      const savePromises = localCategories.map(lc => {
        const existing = categories.find(cat => cat.id === lc.id);
        if (existing) {
          // Update existing category
          if (existing.name !== lc.name || existing.color !== lc.color) {
            return updateCategoryMutation.mutateAsync({ 
              id: lc.id, 
              updates: { name: lc.name, color: lc.color } 
            });
          }
          return Promise.resolve();
        } else {
          // Create new category (temp IDs start with 'temp-')
          return createCategoryMutation.mutateAsync({ 
            name: lc.name, 
            color: lc.color 
          });
        }
      });

      await Promise.all([...deletePromises, ...savePromises]);
      onClose();
    } catch (error) {
      console.error('Error saving categories:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:px-4 pointer-events-auto">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className={`relative w-full overflow-hidden rounded-t-[20px] sm:rounded-[20px] bg-white dark:bg-slate-800 monochrome:bg-neutral-900 text-slate-800 dark:text-white shadow-2xl border-t sm:border border-slate-200 dark:border-slate-700 monochrome:border-neutral-700 transition-all flex flex-col max-h-[92vh] sm:max-h-[85vh] ${
              isNested ? 'sm:max-w-[510px]' : 'sm:max-w-[572px]'
            }`}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* Drag handle (mobile only) */}
          <div className="sm:hidden flex justify-center pt-2 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
          </div>

          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 dark:border-slate-700/50 monochrome:border-neutral-700 shrink-0">
            <h2 className="text-base sm:text-xl font-medium text-slate-800 dark:text-white">Modifier les catégories</h2>
            <button
              onClick={onClose}
              aria-label="Fermer"
              className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-700 monochrome:hover:text-white transition-colors"
            >
              <X size={22} strokeWidth={2.5} />
            </button>
          </div>

          <div
            ref={scrollRef}
            className="px-4 sm:px-6 py-4 sm:py-6 overflow-y-auto flex-1 custom-scrollbar scroll-smooth"
          >
            <div className="flex justify-end mb-4">
              <button 
                onClick={handleAddCategory}
                className="text-blue-600 hover:text-blue-700 monochrome:text-neutral-300 monochrome:hover:text-white transition-colors p-2 bg-blue-50 dark:bg-blue-900/20 monochrome:bg-neutral-800 rounded-full shadow-sm"
              >
                <Plus size={24} strokeWidth={3} />
              </button>
            </div>

            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {localCategories.map((category) => (
                    <motion.div
                      key={category.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex items-center gap-3"
                    >
                      <div className="relative group bg-white dark:bg-slate-800 monochrome:bg-neutral-800 rounded-[15px]">
                        <div 
                          className="h-10 w-10 rounded-[15px] flex-shrink-0 cursor-pointer shadow-sm hover:brightness-110 transition-all"
                          style={{ backgroundColor: category.color }}
                        />
                        <input
                            type="color"
                            value={category.color}
                            onChange={(e) => handleUpdateLocal(category.id, { color: e.target.value })}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full rounded-[15px] bg-transparent"
                          />
                      </div>
                    
                    <div className="flex-1">
                      <input
                        type="text"
                        value={category.name}
                        onChange={(e) => handleUpdateLocal(category.id, { name: e.target.value })}
                        className="w-full bg-transparent border border-slate-300 dark:border-slate-700 monochrome:border-neutral-600 rounded-xl px-4 py-2 text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-blue-500 dark:focus:border-slate-500 monochrome:focus:border-white transition-all"
                        placeholder="Nom de la catégorie"
                      />
                    </div>

                      <button
                        onClick={() => handleDeleteLocal(category.id)}
                        className="p-1 text-red-500 hover:text-red-600 monochrome:text-neutral-400 monochrome:hover:text-white transition-colors"
                      >
                        <Trash2 size={20} />
                      </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

            <div className="px-4 sm:px-6 pt-3 pb-3 sm:pb-6 border-t border-slate-200 dark:border-slate-700/50 monochrome:border-neutral-700 shrink-0 flex justify-center">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full sm:w-48 min-h-11 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 monochrome:bg-white monochrome:hover:bg-neutral-200 text-white monochrome:text-black font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-500/20 monochrome:shadow-white/10 flex items-center justify-center"
              >
                {isSaving ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Enregistrer'
                )}
              </button>
            </div>

        </motion.div>

        <AnimatePresence>
          {categoryToDelete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 monochrome:bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-[90] sm:p-4"
              onClick={() => setCategoryToDelete(null)}
            >
              <motion.div
                initial={{ y: '100%', scale: 0.95, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                exit={{ y: '100%', scale: 0.95, opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                onClick={(e) => e.stopPropagation()}
                className="rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm overflow-hidden border-t sm:border monochrome:border-neutral-700"
                style={{
                  backgroundColor: 'rgb(var(--color-surface))',
                  borderColor: 'rgb(var(--color-border))',
                  paddingBottom: 'env(safe-area-inset-bottom)',
                }}
              >
                <div className="sm:hidden flex justify-center pt-2 pb-1">
                  <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                </div>
                <div className="p-5 sm:p-6">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 monochrome:bg-neutral-800" style={{ backgroundColor: 'rgba(239,68,68,0.12)' }}>
                    <Trash2 className="text-red-500 monochrome:text-neutral-300" size={24} />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold mb-2" style={{ color: 'rgb(var(--color-text-primary))' }}>Supprimer la catégorie</h3>
                  <p className="text-sm leading-relaxed mb-5 sm:mb-6" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                    Êtes-vous sûr de vouloir supprimer cette catégorie ? Cette action est irréversible.
                  </p>
                  <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                    <button
                      onClick={() => setCategoryToDelete(null)}
                      className="flex-1 min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold border transition-all monochrome:border-neutral-600 monochrome:hover:bg-neutral-800"
                      style={{
                        color: 'rgb(var(--color-text-primary))',
                        borderColor: 'rgb(var(--color-border))',
                        backgroundColor: 'rgb(var(--color-hover))',
                      }}
                    >
                      Annuler
                    </button>
                    <button
                      onClick={confirmDeleteLocal}
                      className="flex-1 min-h-11 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 monochrome:bg-white monochrome:text-black monochrome:hover:bg-neutral-200 transition-all shadow-md shadow-red-500/20 monochrome:shadow-white/10"
                    >
                      Confirmer
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
    </div>
  );
};

export default ColorSettingsModal;
