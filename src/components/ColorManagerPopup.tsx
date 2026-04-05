import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Palette, Info, Tag } from 'lucide-react';
import { useTasks } from '../context/TaskContext';
import { useCategories } from '@/modules/categories';

type ColorManagerPopupProps = {
  isOpen: boolean;
  onClose: () => void;
};

const ColorManagerPopup: React.FC<ColorManagerPopupProps> = ({ isOpen, onClose }) => {
  const { favoriteColors, setFavoriteColors } = useTasks();
  const { data: categories = [] } = useCategories();
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  if (!isOpen) return null;

  const categoryColorMap = new Map(categories.map(c => [c.color.toUpperCase(), c.name]));

  const handleColorSelect = (newColor: string) => {
    if (selectedSlot !== null) {
      const newFavorites = [...favoriteColors];
      newFavorites[selectedSlot] = newColor;
      setFavoriteColors(newFavorites);
      setSelectedSlot(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg overflow-hidden rounded-3xl shadow-2xl border border-white/10"
        style={{ backgroundColor: 'rgb(var(--color-surface))' }}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/25 text-blue-500">
              <Palette size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold tracking-tight" style={{ color: 'rgb(var(--color-text-primary))' }}>
                Personnaliser vos couleurs
              </h3>
              <p className="text-sm font-medium opacity-60" style={{ color: 'rgb(var(--color-text-muted))' }}>
                Gérez vos raccourcis de couleurs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all active:scale-90"
            style={{ color: 'rgb(var(--color-text-muted))' }}>
            <X size={22} />
          </button>
        </div>

        <div className="p-8 space-y-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {/* Instructions Step 1 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-500">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white text-[10px]">1</span>
              Étape 1 : Choisissez l'emplacement à modifier
            </div>
            
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
              {favoriteColors.map((color, index) => {
                const isCategory = categoryColorMap.has(color.toUpperCase());
                return (
                  <button
                    key={`fav-${index}`}
                    onClick={() => setSelectedSlot(index)}
                    className={`group relative aspect-square rounded-2xl transition-all duration-300 ${
                      selectedSlot === index 
                        ? 'ring-4 ring-blue-500 ring-offset-4 dark:ring-offset-slate-900 scale-105 z-10' 
                        : 'hover:scale-105'
                    }`}
                    style={{ 
                      backgroundColor: color,
                      boxShadow: selectedSlot === index ? `0 0 20px ${color}40` : '0 4px 10px rgba(0,0,0,0.1)'
                    }}>
                    <div className={`absolute inset-0 flex items-center justify-center rounded-2xl transition-opacity ${
                      selectedSlot === index ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 bg-white/20'
                    }`}>
                      {selectedSlot === index ? (
                        <div className="w-2.5 h-2.5 bg-white rounded-full shadow-lg" />
                      ) : (
                        <div className="w-1.5 h-1.5 bg-white/50 rounded-full" />
                      )}
                    </div>
                    {isCategory && (
                      <div className="absolute -top-1 -right-1 p-0.5 bg-white dark:bg-slate-900 rounded-full shadow-sm border border-black/5">
                        <Tag size={8} className="text-blue-500" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <AnimatePresence mode="wait">
            {selectedSlot !== null ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="space-y-6"
              >
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-500">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px]">2</span>
                  Étape 2 : Sélectionnez la nouvelle couleur
                </div>

                <div className="space-y-6">
                  {/* Categories Grid */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-xs font-semibold opacity-50">Couleurs de vos catégories</p>
                    </div>
                    {categories.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                          {categories.map((cat) => (
                              <button
                                key={cat.id}
                                onClick={() => handleColorSelect(cat.color)}
                                className="flex items-center gap-3 p-3 rounded-2xl border border-border/50 bg-white/30 hover:bg-white/45 hover:border-blue-500/30 transition-all group active:scale-[0.98] relative overflow-hidden"
                              >
                            <div className="absolute top-0 right-0 p-1.5 opacity-20 group-hover:opacity-40 transition-opacity">
                              <Tag size={12} />
                            </div>
                            <div 
                              className="w-6 h-6 rounded-full shadow-inner ring-2 ring-black/5 flex items-center justify-center"
                              style={{ backgroundColor: cat.color }} 
                            >
                              <Tag size={10} className="text-white opacity-60" />
                            </div>
                            <span className="text-sm font-semibold truncate opacity-80 group-hover:opacity-100" style={{ color: 'rgb(var(--color-text-primary))' }}>
                              {cat.name}
                            </span>
                          </button>
                        ))}
                      </div>
                      ) : (
                        <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/15 border border-dashed border-border text-center">
                          <p className="text-sm opacity-50">Aucune catégorie définie</p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-12 px-6 rounded-3xl bg-gray-50/50 dark:bg-white/15 border border-dashed border-border"
                >
                <Info size={32} className="text-blue-500/40 mb-3" />
                <p className="text-sm font-medium text-center opacity-50 max-w-[200px]" style={{ color: 'rgb(var(--color-text-muted))' }}>
                  Cliquez sur un carré de couleur ci-dessus pour le remplacer
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-6 px-8 border-t border-border/50 flex items-center justify-between bg-gray-50/50 dark:bg-black/20">
          <div className="text-xs font-medium opacity-40">
            Modifications enregistrées automatiquement
          </div>
          <button
            onClick={onClose}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all shadow-xl shadow-blue-500/20 active:scale-95">
            Terminer
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ColorManagerPopup;
