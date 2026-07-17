import { useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import {
  useOrgOKRCategories,
  useCreateOrgOKRCategory,
  OKR_CATEGORY_COLORS,
} from '@/modules/org-okr-categories';

interface OKRCategoryPickerProps {
  orgId: string;
  /** Nom de la catégorie sélectionnée ('' = aucune). */
  value: string;
  onChange: (categoryName: string) => void;
}

/**
 * Sélecteur de catégorie d'OKR d'entreprise (parité mode perso) : choisir une
 * catégorie existante ou en créer une (nom + couleur). La valeur remontée est
 * le NOM (stocké dans team_okrs.category).
 */
const OKRCategoryPicker = ({ orgId, value, onChange }: OKRCategoryPickerProps) => {
  const { data: categories = [] } = useOrgOKRCategories(orgId);
  const createCategory = useCreateOrgOKRCategory(orgId);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(OKR_CATEGORY_COLORS[0]);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    createCategory.mutate(
      { name, color: newColor },
      {
        onSuccess: (cat) => {
          onChange(cat.name);
          setNewName('');
          setNewColor(OKR_CATEGORY_COLORS[0]);
          setCreating(false);
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {categories.map((c) => {
          const active = value === c.name;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(active ? '' : c.name)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                active ? 'text-white border-transparent' : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
              }`}
              style={active ? { backgroundColor: c.color } : undefined}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: active ? 'rgba(255,255,255,0.9)' : c.color }} aria-hidden="true" />
              {c.name}
              {active && <Check size={11} aria-hidden="true" />}
            </button>
          );
        })}
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:text-blue-500 hover:border-blue-400 transition-colors"
          >
            <Plus size={12} aria-hidden="true" /> Nouvelle catégorie
          </button>
        )}
      </div>

      {creating && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[rgb(var(--color-border))] p-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } if (e.key === 'Escape') setCreating(false); }}
            placeholder="Nom de la catégorie"
            autoFocus
            maxLength={60}
            className="flex-1 min-w-[140px] h-8 px-2.5 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
          <div className="flex items-center gap-1">
            {OKR_CATEGORY_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Couleur ${color}`}
                aria-pressed={newColor === color}
                onClick={() => setNewColor(color)}
                className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${newColor === color ? 'ring-2 ring-offset-1 ring-offset-[rgb(var(--color-surface))] ring-blue-500' : ''}`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!newName.trim() || createCategory.isPending}
            className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold"
          >
            Créer
          </button>
          <button
            type="button"
            onClick={() => setCreating(false)}
            aria-label="Annuler"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};

export default OKRCategoryPicker;
