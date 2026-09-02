import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useCategories, useCreateCategory, useUpdateCategory, useDeleteCategory, Category } from '@/modules/categories';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useBottomSheet } from '@/hooks/use-bottom-sheet';
import { useT } from '@/i18n/useT';
import { useTasks } from '@/modules/tasks';
import { useOkrs } from '@/modules/okrs';
import { resolveReassignTargets } from '@/modules/categories/impact';
import { useReassignCategory } from '@/modules/categories/useReassignCategory';
import DeleteCategoryDialog from '@/components/category/DeleteCategoryDialog';

type ColorSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  isNested?: boolean;
};

/**
 * Contenu de la modale — monté UNIQUEMENT quand elle est ouverte.
 *
 * 🔴 POURQUOI cette coupure. Cinq écrans montent `<ColorSettingsModal>` en
 * permanence (TasksSummary, EventModal, HabitModal, TaskModal, OKRModalSheet) :
 * tant que les requêtes vivaient au-dessus du `if (!isOpen)`, une lecture des
 * OKR partait depuis les pages Tâches, Agenda et Habitudes, qui n'en affichent
 * aucun, pour une modale que personne n'avait ouverte.
 *
 * Second effet, tout aussi voulu : l'état local meurt à la fermeture. Avant, des
 * suppressions mises en attente puis abandonnées (fermeture sans enregistrer)
 * survivaient à la réouverture, et repartaient à la sauvegarde suivante.
 */
const ColorSettingsModalContent: React.FC<Omit<ColorSettingsModalProps, 'isOpen'>> = ({ onClose, isNested }) => {
  const { t } = useT('tasks');
  const { t: tCommon, tp: tpCommon } = useT('common');
  const { data: tasks = [] } = useTasks();
  const { data: okrs = [] } = useOkrs();
  const reassignCategory = useReassignCategory();
  const { sheetRef, handleBarWidth, sheetDragProps } = useBottomSheet(onClose);
  const { data: categories = [] } = useCategories();
  const createCategoryMutation = useCreateCategory();
  const updateCategoryMutation = useUpdateCategory();
  const deleteCategoryMutation = useDeleteCategory();
  
  // Initialize directly from cached data so the list is populated on first
  // render when categories are already in the React Query cache.
  const [localCategories, setLocalCategories] = useState<Category[]>(categories);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  // R-02 : ou partent les elements d'une categorie retiree, par categorie.
  // La modale met les suppressions EN ATTENTE jusqu'a l'enregistrement : la
  // decision de reclassement doit donc etre memorisee avec elles, sinon elle
  // serait prise puis perdue.
  const [reassignTargets, setReassignTargets] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync local state with fetched categories
  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  // Une categorie encore en brouillon (`temp-`) n'existe pas cote serveur : la
  // proposer comme destination ferait pointer des elements vers un identifiant
  // qui ne sera jamais celui de la ligne creee.
  const reassignOptions = localCategories.filter((c) => !c.id.startsWith('temp-'));

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

  const confirmDeleteLocal = (reassignTo: string) => {
    if (categoryToDelete) {
      setReassignTargets(prev => ({ ...prev, [categoryToDelete]: reassignTo }));
      setLocalCategories(prev => prev.filter(cat => cat.id !== categoryToDelete));
      setCategoryToDelete(null);
    }
  };
  
  const handleSave = async () => {
    // Validation : chaque nom de catégorie doit faire ≥ 2 caractères
    const invalid = localCategories.find(lc => lc.name.trim().length < 2);
    if (invalid) {
      toast.error(t('colorModal.nameTooShort'));
      return;
    }

    setIsSaving(true);
    try {
      // R-02 : reaffecter AVANT de supprimer. L'ordre inverse laisserait une
      // fenetre ou les elements pointent dans le vide, et un echec du
      // reclassement deviendrait irrattrapable : plus rien ne dirait quels
      // elements portaient la categorie disparue.
      const removed = categories.filter(cat => !localCategories.find(lc => lc.id === cat.id));
      // On peut supprimer DEUX categories d'un coup et designer la seconde comme
      // destination de la premiere. `resolveReassignTargets` suit la chaine
      // jusqu'a une categorie qui survit : sans lui, des elements partaient vers
      // une categorie supprimee une ligne plus bas, et l'instantane `tasks` ne
      // les montrait deja plus sous leur ancienne categorie au tour suivant.
      const finalTargets = resolveReassignTargets(removed.map(c => c.id), reassignTargets);
      let movedTotal = 0;
      for (const cat of removed) {
        const { moved } = await reassignCategory(cat.id, finalTargets[cat.id], tasks, okrs);
        movedTotal += moved;
      }

      const deletePromises = removed.map(cat => deleteCategoryMutation.mutateAsync(cat.id));

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
      // Le message de reclassement part APRES les ecritures : annoncer un
      // deplacement avant de savoir si la suppression aboutit, c'est promettre
      // un resultat qu'on n'a pas encore.
      if (movedTotal > 0) toast.success(tpCommon('deleteCategory.doneReassigned', movedTotal));
      onClose();
    } catch (error) {
      // Un echec avale en silence laissait l'utilisateur devant une modale qui
      // ne se ferme pas, sans un mot. La reaffectation ayant lieu AVANT les
      // suppressions, un echec de reclassement ne supprime rien ; un echec plus
      // tard peut laisser une partie du lot ecrite. Dans les deux cas la modale
      // reste ouverte sur l'etat local, donc rejouable.
      console.error('Error saving categories:', error);
      toast.error(tCommon('pageError.hint'));
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
        className="absolute inset-0 bg-black/30 backdrop-blur-md"
        onClick={onClose}
      />

        <motion.div
          ref={sheetRef}
          {...sheetDragProps}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '110%', opacity: 0, transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
          transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.7 }}
            className={`relative w-full overflow-hidden rounded-t-[28px] sm:rounded-[20px] bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-primary))] shadow-[0_-12px_40px_rgba(0,0,0,0.18)] sm:shadow-2xl border-t sm:border border-[rgb(var(--color-border))] transition-all flex flex-col max-h-[88vh] sm:max-h-[85vh] ${
              isNested ? 'sm:max-w-[510px]' : 'sm:max-w-[572px]'
            }`}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* Drag handle — reacts to swipe on mobile */}
          <div className="sm:hidden flex justify-center pt-4 pb-3 shrink-0">
            <motion.div style={{ width: handleBarWidth }} className="h-[5px] rounded-full bg-slate-300/70 dark:bg-slate-500/60" />
          </div>

          <div className="flex items-center justify-between px-4 sm:px-6 py-[0.420204rem] sm:py-[0.560272rem] border-b border-[rgb(var(--color-border))] shrink-0">
            <h2 className="text-base sm:text-xl font-medium text-[rgb(var(--color-text-primary))]">{t('colorModal.title')}</h2>
            <button
              onClick={onClose}
              aria-label={tCommon('actions.close')}
              className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-[rgb(var(--color-text-muted))] hover:text-blue-600 hover:bg-[rgb(var(--color-hover))] transition-colors"
            >
              <X size={22} strokeWidth={2.5} />
            </button>
          </div>

          <div
            ref={scrollRef}
            data-scroll-area
            className="px-4 sm:px-6 py-4 sm:py-6 overflow-y-auto flex-1 custom-scrollbar scroll-smooth"
            style={{ backgroundColor: 'rgb(var(--color-surface))' }}
          >
            <div className="flex justify-end mb-4">
              <button 
                onClick={handleAddCategory}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors p-2 bg-blue-50 dark:bg-blue-900/20 rounded-full shadow-sm"
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
                      <div className="relative group bg-[rgb(var(--color-surface))] rounded-[15px]">
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
                        className="w-full bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl px-4 py-2 text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus:border-[rgb(var(--color-accent-solid))] dark:focus:border-slate-500 transition-all"
                        placeholder={t('colorModal.namePlaceholder')}
                      />
                    </div>

                      <button
                        onClick={() => handleDeleteLocal(category.id)}
                        className="p-1 text-red-500 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={20} />
                      </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

            <div className="px-4 sm:px-6 pt-[0.6555rem] pb-[0.6555rem] sm:pb-[1.311rem] border-t border-[rgb(var(--color-border))] shrink-0 flex justify-center">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full sm:w-48 min-h-11 py-3 bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-500/20 flex items-center justify-center"
              >
                {isSaving ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  tCommon('actions.save')
                )}
              </button>
            </div>

        </motion.div>

        {/* Une seule confirmation de suppression de categorie dans tout le
            produit : la reecrire ici a la main, c'etait deux ecrans a maintenir
            pour la meme decision, et deux occasions de les laisser diverger. */}
        <DeleteCategoryDialog
          open={!!categoryToDelete}
          category={localCategories.find(c => c.id === categoryToDelete) ?? null}
          categories={reassignOptions}
          onCancel={() => setCategoryToDelete(null)}
          onConfirm={confirmDeleteLocal}
        />
    </div>
  );
};

const ColorSettingsModal: React.FC<ColorSettingsModalProps> = ({ isOpen, onClose, isNested }) =>
  isOpen ? <ColorSettingsModalContent onClose={onClose} isNested={isNested} /> : null;

export default ColorSettingsModal;
