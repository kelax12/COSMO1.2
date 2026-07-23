import React from 'react';
import { Plus, Edit2, X, Trash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface CategoryLite {
  id: string;
  name: string;
  color: string;
}

// Minimal structural type — satisfait par useCreateCategory (perso) ET par
// useCreateOrgOKRCategory (entreprise). Le composant n'utilise que .mutate.
interface CreateCategoryMutationLike {
  mutate: (
    variables: { name: string; color: string },
    options?: { onSuccess?: () => void },
  ) => void;
}

interface CategoryFilterBarProps {
  categories: CategoryLite[];
  selectedCategory: string;
  setSelectedCategory: (id: string) => void;
  hoveredCategoryId: string | null;
  setHoveredCategoryId: (id: string | null) => void;
  editingCategoryId: string | null;
  editCategoryName: string;
  setEditCategoryName: (name: string) => void;
  editCategoryColor: string;
  setEditCategoryColor: (color: string) => void;
  startEditCategory: (cat: { id: string; name: string; color: string }) => void;
  cancelEditCategory: () => void;
  submitEditCategory: () => void;
  setCategoryToDeleteId: (id: string | null) => void;
  colorOptions: { value: string; color: string }[];
  resolveColor: (color: string) => string;
  showCreateCategory: boolean;
  setShowCreateCategory: (show: boolean) => void;
  newCategoryName: string;
  setNewCategoryName: (name: string) => void;
  newCategoryColor: string;
  setNewCategoryColor: (color: string) => void;
  createCategoryMutation: CreateCategoryMutationLike;
  /** false = lecture seule : masque édition/suppression/ajout (défaut true). */
  canManage?: boolean;
  /** true = chips agrandies (~+20%) — utilisé par la page OKR perso. */
  large?: boolean;
  /** true = bouton « Tous » actif en bleu (DA Cosmo) plutôt qu'en neutre. */
  accentAllActive?: boolean;
}

const CategoryFilterBar: React.FC<CategoryFilterBarProps> = ({
  categories,
  selectedCategory,
  setSelectedCategory,
  hoveredCategoryId,
  setHoveredCategoryId,
  editingCategoryId,
  editCategoryName,
  setEditCategoryName,
  editCategoryColor,
  setEditCategoryColor,
  startEditCategory,
  cancelEditCategory,
  submitEditCategory,
  setCategoryToDeleteId,
  colorOptions,
  resolveColor,
  showCreateCategory,
  setShowCreateCategory,
  newCategoryName,
  setNewCategoryName,
  newCategoryColor,
  setNewCategoryColor,
  createCategoryMutation,
  canManage = true,
  large = false,
  accentAllActive = false,
}) => {
  // Taille des chips — la page OKR perso les agrandit (~+20%) via `large`.
  const chipCls = large
    ? 'inline-flex items-center gap-2 px-3 min-h-touch sm:min-h-0 sm:py-1.5 rounded-full text-sm font-medium border transition-colors'
    : 'inline-flex items-center gap-1.5 px-2.5 min-h-touch sm:min-h-0 sm:py-1 rounded-full text-xs font-medium border transition-colors';
  const dotCls = large ? 'w-2.5 h-2.5' : 'w-2 h-2';
  const addChipCls = `inline-flex items-center rounded-full font-medium border border-dashed border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:text-blue-500 hover:border-[rgb(var(--color-accent))] transition-colors min-h-touch sm:min-h-0 ${
    large ? 'gap-1.5 px-3 sm:py-1.5 text-sm' : 'gap-1 px-2.5 sm:py-1 text-xs'
  }`;
  const allActiveCls = accentAllActive
    ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] border-transparent'
    : 'bg-[rgb(var(--color-text-primary))] text-[rgb(var(--color-surface))] border-transparent';
  return (
      <div className="flex items-center gap-1.5 flex-wrap mb-6" data-tutorial-id="okr-category-filter">
        {/* Style « pastilles » du mode entreprise, appliqué aux deux modes :
            « Tous » + chips colorées (pastille + fond plein si actif). Les
            actions (crayon/corbeille) restent révélées au survol d'une chip. */}
        <button
          onClick={() => setSelectedCategory('all')}
          className={`${chipCls} ${
            selectedCategory === 'all'
              ? allActiveCls
              : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
          }`}>
          Tous
        </button>
            {categories.map((category) => {
              const isHovered = hoveredCategoryId === category.id;
              const isEditing = editingCategoryId === category.id;
              return (
                <div
                  key={category.id}
                  className="relative"
                  onMouseEnter={() => setHoveredCategoryId(category.id)}
                  onMouseLeave={() => setHoveredCategoryId(null)}
                >
                  {/* Barre flottante d'actions au-dessus de la chip — visible au hover,
                      cachée pendant l'édition (les boutons d'action passent dans le form). */}
                  <AnimatePresence>
                    {canManage && isHovered && !isEditing && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute -top-7 inset-x-0 mx-auto w-fit flex items-center gap-1 z-10"
                      >
                        {/* Crayon — modifier la catégorie (nom + couleur) */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); startEditCategory(category); }}
                          className="p-1 rounded bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:text-blue-600 dark:hover:text-blue-400 shadow-sm transition-colors"
                          title="Modifier la catégorie"
                          aria-label="Modifier la catégorie"
                        >
                          <Edit2 size={14} />
                        </button>
                        {/* Corbeille — supprimer la catégorie */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setCategoryToDeleteId(category.id); }}
                          className="p-1 rounded bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:text-red-600 dark:hover:text-red-400 shadow-sm transition-colors"
                          title="Supprimer la catégorie"
                          aria-label="Supprimer la catégorie"
                        >
                          <Trash size={14} />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {isEditing ? (
                    /* Mode édition inline — même pattern que l'édition des listes
                       (TaskListsBar) : pastille couleur cyclique (Shift+clic = palette
                       hex), input auto-dimensionné, OK, ✕. Pas de pilule englobante. */
                    <form
                      onSubmit={(e) => { e.preventDefault(); submitEditCategory(); }}
                      className="flex items-center gap-2"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          if (e.shiftKey) {
                            e.currentTarget.nextElementSibling?.dispatchEvent(new MouseEvent('click'));
                            return;
                          }
                          const idx = colorOptions.findIndex(c => c.value === editCategoryColor);
                          setEditCategoryColor(colorOptions[(idx + 1) % colorOptions.length].value);
                        }}
                        className="w-5 h-5 rounded-full border-2 border-white dark:border-slate-700 shadow-sm shrink-0 transition-transform hover:scale-110"
                        style={{ backgroundColor: resolveColor(editCategoryColor) }}
                        title="Clic : cycle couleurs · Shift+clic : palette hex"
                      />
                      {/* Color picker hex caché — déclenché par Shift+clic sur la pastille */}
                      <input
                        type="color"
                        value={resolveColor(editCategoryColor)}
                        onChange={(e) => setEditCategoryColor(e.target.value)}
                        className="sr-only"
                        aria-label="Choisir une couleur personnalisée"
                        tabIndex={-1}
                      />
                      <input
                        autoFocus
                        type="text"
                        value={editCategoryName}
                        onChange={(e) => setEditCategoryName(e.target.value)}
                        /* size adapte la largeur au contenu (fallback universel) ;
                           field-sizing:content (Chrome 123+) le fait nativement. */
                        size={Math.max(editCategoryName.length + 2, 6)}
                        className="px-2 py-1 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
                        style={{
                          backgroundColor: 'rgb(var(--color-surface))',
                          borderColor: 'rgb(var(--color-border))',
                          color: 'rgb(var(--color-text-primary))',
                          fieldSizing: 'content',
                        } as React.CSSProperties}
                        onKeyDown={(e) => { if (e.key === 'Escape') cancelEditCategory(); }}
                      />
                      <button
                        type="submit"
                        disabled={editCategoryName.trim().length < 2}
                        className="px-2 py-1 text-xs rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))] font-medium disabled:opacity-40 transition-all"
                      >
                        OK
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditCategory}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        title="Annuler"
                      >
                        <X size={12} />
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => setSelectedCategory(category.id)}
                      className={`${chipCls} ${
                        selectedCategory === category.id
                          ? 'text-white border-transparent'
                          : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
                      }`}
                      style={selectedCategory === category.id ? { backgroundColor: resolveColor(category.color) } : undefined}>
                      <span
                        className={`${dotCls} rounded-full shrink-0`}
                        style={{ backgroundColor: selectedCategory === category.id ? 'rgba(255,255,255,0.9)' : resolveColor(category.color) }}
                        aria-hidden="true"
                      />
                      <span>{category.name}</span>
                    </button>
                  )}
                </div>
              );
            })}

          {canManage && (
          <AnimatePresence mode="wait">
            {!showCreateCategory ? (
              <motion.button
                key="add-btn"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={() => setShowCreateCategory(true)}
                className={addChipCls}
                title="Nouvelle catégorie"
              >
                <Plus size={12} /> Nouvelle catégorie
              </motion.button>
            ) : (
              <motion.form
                key="add-form"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = newCategoryName.trim();
                  if (name.length < 2) {
                    toast.error('Le nom de la catégorie doit contenir au moins 2 caractères');
                    return;
                  }
                  createCategoryMutation.mutate({ name, color: newCategoryColor }, {
                    onSuccess: () => {
                      setNewCategoryName('');
                      setNewCategoryColor('blue');
                      setShowCreateCategory(false);
                    }
                  });
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    const idx = colorOptions.findIndex(c => c.value === newCategoryColor);
                    setNewCategoryColor(colorOptions[(idx + 1) % colorOptions.length].value);
                  }}
                  className="w-5 h-5 rounded-full border-2 border-white dark:border-slate-700 shadow-sm shrink-0 transition-transform hover:scale-110"
                  style={{ backgroundColor: colorOptions.find(c => c.value === newCategoryColor)?.color || '#3B82F6' }}
                  title="Changer la couleur"
                />
                <input
                  autoFocus
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nom de la catégorie…"
                  className="px-3 py-1 text-sm rounded-full border focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
                  style={{
                    backgroundColor: 'rgb(var(--color-surface))',
                    borderColor: 'rgb(var(--color-border))',
                    color: 'rgb(var(--color-text-primary))'
                  }}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setShowCreateCategory(false); setNewCategoryName(''); } }}
                />
                <button
                  type="submit"
                  disabled={newCategoryName.trim().length < 2}
                  className="px-3 py-1 text-sm rounded-full bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))] font-medium disabled:opacity-40 transition-all"
                >
                  Créer
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCreateCategory(false); setNewCategoryName(''); }}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <X size={13} />
                </button>
              </motion.form>
            )}
          </AnimatePresence>
          )}
      </div>
  );
};

export default CategoryFilterBar;
