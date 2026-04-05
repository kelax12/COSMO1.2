import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, Category } from '@/modules/categories';
import { motion, AnimatePresence } from 'framer-motion';

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
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose} 
      />
      
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
            className={`relative w-full overflow-hidden rounded-[20px] bg-white dark:bg-slate-800 monochrome:bg-neutral-900 text-slate-800 dark:text-white shadow-2xl border border-slate-200 dark:border-slate-700 monochrome:border-neutral-700 transition-all duration-300 ${
              isNested ? 'max-w-[600px]' : 'max-w-2xl'
            }`}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700/50 monochrome:border-neutral-700">
            <h2 className="text-xl font-medium text-slate-800 dark:text-white">Modifier les catégories</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-blue-600 monochrome:hover:text-white transition-colors"
            >
              <X size={28} strokeWidth={3} />
            </button>
          </div>

          <div 
            ref={scrollRef}
            className="px-6 py-6 overflow-y-auto max-h-[60vh] custom-scrollbar scroll-smooth"
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

            <div className="px-6 pb-8 pt-2 flex justify-center">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-48 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 monochrome:bg-white monochrome:hover:bg-neutral-200 text-white monochrome:text-black font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-500/20 monochrome:shadow-white/10 flex items-center justify-center"
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
            <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/70 monochrome:bg-black/80 backdrop-blur-sm flex items-center justify-center z-[90] p-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white dark:bg-slate-800 monochrome:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700 monochrome:border-neutral-700"
              >
                <div className="p-6">
                  <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 monochrome:bg-neutral-800 flex items-center justify-center mb-4">
                    <Trash2 className="text-red-600 dark:text-red-400 monochrome:text-neutral-300" size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Supprimer la catégorie</h3>
                  <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6">
                    Êtes-vous sûr de vouloir supprimer cette catégorie ? Cette action est irréversible.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setCategoryToDelete(null)}
                      className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 monochrome:border-neutral-600 hover:bg-slate-50 dark:hover:bg-slate-700 monochrome:hover:bg-neutral-800 transition-all duration-200"
                    >
                      Annuler
                    </button>
                      <button
                        onClick={confirmDeleteLocal}
                        className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 monochrome:bg-white monochrome:text-black monochrome:hover:bg-neutral-200 transition-all duration-200 shadow-md shadow-red-500/20 monochrome:shadow-white/10"
                      >
                        Confirmer
                      </button>

                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
    </div>
  );
};

export default ColorSettingsModal;
