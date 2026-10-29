// ════════════════════════════════════════════════════════════════
// EventModalDesktopCategoryPicker — champ « Catégorie » du corps desktop
// ════════════════════════════════════════════════════════════════
//
// Refait le 2026-10-29 (modale en une colonne, maquette 3) : la grille de
// pastilles, sa bulle de sous-catégories et la légende repliable sont
// remplacées par le menu déroulant commun `CategoryTreeSelect` (sous-catégories
// en cascade à droite au survol).
//
// ⚠️ Un événement ne porte PAS d'identifiant de catégorie : il porte une
// COULEUR. Le champ traduit donc dans les deux sens : couleur courante →
// catégorie qui la porte (la première trouvée), choix → couleur de la
// catégorie, « Sans catégorie » → `NO_CATEGORY_COLOR`.
// ════════════════════════════════════════════════════════════════
import React, { useMemo } from 'react';
import type { Category } from '@/modules/categories';
import AddCategoryButton from '@/components/AddCategoryButton';
import CategoryTreeSelect from '@/components/category/CategoryTreeSelect';
import { NO_CATEGORY_COLOR } from '@/lib/category-colors';
import { useT } from '@/i18n/useT';

interface EventModalDesktopCategoryPickerProps {
  /** Sans `position` côté entreprise (`categoriesOverride`) : l'ordre reçu fait foi. */
  categories: Array<Omit<Category, 'position'> & { position?: number }>;
  color: string;
  setColor: (value: string) => void;
  handleFieldChange: (field: string, setter: (value: string) => void, value: string) => void;
  setIsColorSettingsOpen: (open: boolean) => void;
}

const EventModalDesktopCategoryPicker: React.FC<EventModalDesktopCategoryPickerProps> = ({
  categories, color, setColor, handleFieldChange, setIsColorSettingsOpen,
}) => {
  const { t } = useT('tasks');
  const tree = useMemo<Category[]>(
    () => categories.map((cat, index) => ({ ...cat, position: cat.position ?? index })),
    [categories],
  );
  const selectedId = categories.find((cat) => cat.color === color)?.id ?? '';

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span
          className="block text-xs font-semibold uppercase tracking-wider"
          style={{ color: "rgb(var(--color-text-secondary))" }}
        >
          {t('fields.category')}
        </span>
        <AddCategoryButton onClick={() => setIsColorSettingsOpen(true)} />
      </div>
      <CategoryTreeSelect
        value={selectedId}
        categories={tree}
        onChange={(id) => {
          const next = categories.find((cat) => cat.id === id)?.color ?? NO_CATEGORY_COLOR;
          handleFieldChange("color", setColor, next);
        }}
      />
    </div>
  );
};

export default EventModalDesktopCategoryPicker;
