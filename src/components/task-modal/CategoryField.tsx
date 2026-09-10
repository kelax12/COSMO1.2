// ═══════════════════════════════════════════════════════════════════
// Choisir une catégorie, ou en créer une
//
// FRONTIÈRE : ce champ ne connaît ni la tâche, ni le formulaire qui
// l'accueille, ni ses étapes. Une valeur, une liste de catégories, un
// rappel — et la création en ligne, qui reste ici parce qu'elle n'existe
// que pour ce champ.
//
// ⚠️ Un seul rendu, mobile ET desktop : `CategoryTreeSelect` est déjà une
// feuille en bas d'écran sur petit viewport (`items-end sm:items-center`),
// donc le `select` natif et le menu Radix d'avant n'ont plus de raison
// d'exister séparément — et l'arbre (recherche par chemin, sous-catégories)
// n'a pas d'équivalent dans un `<select>` natif.
//
// ❌ L'ancienne option pseudo-catégorie `value === 'okr'` a été retirée en
// migrant vers l'arbre (tâche 11) : aucun appelant ne pose jamais cette
// valeur littérale — `OKRPage` transmet `objective.category`, un vrai
// identifiant de catégorie (ou `''`). C'était du code mort.
//
// 🔴 La validation de la création était écrite DEUX FOIS — une fois sur
// Entrée, une fois sur le bouton — et les deux ne disaient pas la même
// chose : `fields.categoryNameTooShort` d'un côté, `form.…` de l'autre, deux
// clés qui existent toutes les deux avec des libellés anglais différents. Un
// seul chemin (`submitNewCategory`) désormais, donc un seul message.
//
// Extrait le 2026-09-05 (C-09).
// ═══════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import AddCategoryButton from '@/components/AddCategoryButton';
import CategoryTreeSelect from '@/components/category/CategoryTreeSelect';
import type { Category } from '@/modules/categories';
import { useT } from '@/i18n/useT';

interface ColorOption {
  value: string;
  color: string;
}

interface CategoryFieldProps {
  value: string;
  onChange: (categoryId: string) => void;
  categories: Category[];
  colorOptions: ColorOption[];
  createCategory: (
    input: { name: string; color: string },
    options: { onSuccess: (created: { id: string }) => void },
  ) => void;
  isCreating: boolean;
  /** Message d'erreur de validation du formulaire, s'il y en a un. */
  error?: string;
  /** Le champ est-il marqué « manquant » par le secouement visuel (desktop) ? */
  shaking: boolean;
  /** Le champ a-t-il été pré-rempli depuis un OKR (fond et bordure accentués) ? */
  fromOkr: boolean;
}

const CategoryField = ({
  value,
  onChange,
  categories,
  colorOptions,
  createCategory,
  isCreating,
  error,
  shaking,
  fromOkr,
}: CategoryFieldProps) => {
  const { t } = useT('taskModal');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('blue');

  const resolveColor = (v: string) => colorOptions.find((c) => c.value === v)?.color || '#3B82F6';

  const closeNewCategory = () => {
    setShowNewCategoryInput(false);
    setNewCategoryName('');
    setNewCategoryColor('blue');
  };

  const submitNewCategory = () => {
    const name = newCategoryName.trim();
    if (name.length < 2) {
      toast.error(t('fields.categoryNameTooShort'));
      return;
    }
    createCategory(
      { name, color: resolveColor(newCategoryColor) },
      {
        onSuccess: (created) => {
          onChange(created.id);
          closeNewCategory();
        },
      },
    );
  };

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: 'rgb(var(--color-text-secondary))' }}>
          {t('fields.category')}
        </label>
        {/* Créer une catégorie sans quitter le modal — bouton au-dessus
            de l'input (pattern unifié avec les modals OKR). */}
        <AddCategoryButton onClick={() => { setShowNewCategoryInput(true); setNewCategoryName(''); }} />
      </div>

      <CategoryTreeSelect
        value={value}
        onChange={onChange}
        categories={categories}
        hasError={!!error}
        shaking={shaking}
        fromOkr={fromOkr}
      />

      {showNewCategoryInput && (
        <div className="flex items-center gap-2 mt-2">
          <button
            type="button"
            onClick={() => {
              const idx = colorOptions.findIndex((c) => c.value === newCategoryColor);
              setNewCategoryColor(colorOptions[(idx + 1) % colorOptions.length].value);
            }}
            className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-700 shadow-sm shrink-0 transition-transform hover:scale-110"
            style={{ backgroundColor: resolveColor(newCategoryColor) }}
            title={t('desktop.changeColor')}
          />
          <input
            type="text"
            autoFocus
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); submitNewCategory(); }
              else if (e.key === 'Escape') closeNewCategory();
            }}
            placeholder={t('fields.categoryNamePlaceholder')}
            className="flex-1 min-w-0 px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:border-[rgb(var(--color-accent))] border-[rgb(var(--color-border))]"
            style={{ backgroundColor: 'rgb(var(--color-surface))', color: 'rgb(var(--color-text-primary))' }}
          />
          <button
            type="button"
            disabled={newCategoryName.trim().length < 2 || isCreating}
            onClick={submitNewCategory}
            className="px-3 py-1.5 text-sm rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))] font-medium disabled:opacity-40 transition-all"
          >
            {isCreating ? t('common.creating') : t('common.create')}
          </button>
          <button
            type="button"
            onClick={closeNewCategory}
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            style={{ color: 'rgb(var(--color-text-secondary))' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 mt-1 text-red-600 dark:text-red-400 text-sm" role="alert">
          <AlertCircle size={14} aria-hidden="true" />
          {error}
        </div>
      )}
    </>
  );
};

export default CategoryField;
