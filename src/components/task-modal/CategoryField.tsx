// ═══════════════════════════════════════════════════════════════════
// Choisir une catégorie, ou en créer une
//
// FRONTIÈRE : ce champ ne connaît ni la tâche, ni le formulaire qui
// l'accueille, ni ses étapes. Une valeur, une liste de catégories, un
// rappel — et la création en ligne, qui reste ici parce qu'elle n'existe
// que pour ce champ.
//
// ⚠️ Deux rendus, un seul état : `select` natif sur mobile (la roue système
// vaut mieux qu'un menu maison au doigt), menu Radix sur desktop.
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
import { ChevronDown, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import AddCategoryButton from '@/components/AddCategoryButton';
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

      {/* Mobile : select natif système */}
      <div className="sm:hidden relative">
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-[2.626275rem] px-[0.875425rem] pr-10 border rounded-lg appearance-none text-[0.875425rem] focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{
            backgroundColor: 'rgb(var(--color-surface))',
            color: value ? 'rgb(var(--color-text-primary))' : 'rgb(var(--color-text-muted))',
            borderColor: error ? 'rgb(var(--color-error))' : 'rgb(var(--color-border))',
          }}
        >
          <option value="">{t('common.chooseDots')}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
        <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-blue-500" />
      </div>

      {/* Desktop : dropdown custom */}
      <div className="hidden sm:block">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={`w-full flex items-center justify-between px-[0.875425rem] h-[2.626275rem] border rounded-lg focus:outline-none hover:border-[rgb(var(--color-border-strong))] focus:border-[rgb(var(--color-accent))] focus:ring-1 focus:ring-[rgb(var(--color-accent))] data-[state=open]:border-[rgb(var(--color-accent))] data-[state=open]:ring-1 data-[state=open]:ring-[rgb(var(--color-accent))] transition-all text-[0.875425rem] ${
                error || shaking ? 'border-[rgb(var(--color-error))]' : (fromOkr ? 'border-[rgb(var(--color-accent-solid))] dark:border-[rgb(var(--color-accent-solid))]' : 'border-[rgb(var(--color-border))]')
              } ${fromOkr ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}
              style={{
                backgroundColor: fromOkr ? undefined : 'rgb(var(--color-surface))',
                color: value ? 'rgb(var(--color-text-primary))' : 'rgb(var(--color-text-muted))',
                borderColor: error || shaking ? '#ef4444' : undefined,
              }}
            >
              <span>{categories.find((c) => c.id === value)?.name || (value === 'okr' ? 'OKR' : t('common.chooseDots'))}</span>
              <ChevronDown size={18} className="text-blue-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[var(--radix-dropdown-menu-trigger-width)] border-[rgb(var(--color-border))] p-1 shadow-xl"
            style={{ backgroundColor: 'rgb(var(--color-surface))' }}
          >
            {value === 'okr' && !categories.find((c) => c.id === 'okr') && (
              <DropdownMenuItem asChild>
                <button
                  type="button"
                  onClick={() => onChange('okr')}
                  className="w-full text-left px-4 py-3 text-base rounded-md transition-colors flex items-center gap-2 bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] shadow-sm"
                >
                  <div className="w-2 h-2 rounded-full bg-[rgb(var(--color-accent-solid))]" />
                  OKR
                </button>
              </DropdownMenuItem>
            )}
            {categories.map((cat) => (
              <DropdownMenuItem key={cat.id} asChild>
                <button
                  type="button"
                  onClick={() => onChange(value === cat.id ? '' : cat.id)}
                  className={`w-full text-left px-4 py-3 text-base rounded-md transition-colors flex items-center gap-2 ${
                    value === cat.id
                      ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))] shadow-sm'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-[rgb(var(--color-accent-solid-hover))] hover:text-[rgb(var(--color-accent-solid-foreground))] dark:hover:bg-[rgb(var(--color-accent-solid-hover))]'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </button>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

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
