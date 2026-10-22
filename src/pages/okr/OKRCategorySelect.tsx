import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Settings2 } from 'lucide-react';
import { BottomSheet } from '@/components/mobile';
import { useT } from '@/i18n/useT';
import { rootCategories, childrenOfCategory, toggleRootCategory } from './category-filter-logic';

interface CategoryLite {
  id: string;
  name: string;
  color: string;
  parentId?: string | null;
}

interface Props {
  categories: CategoryLite[];
  activeCategoryIds: ReadonlySet<string>;
  setActiveCategoryIds: (next: Set<string>) => void;
  resolveColor: (color: string) => string;
  onManageCategories: () => void;
}

/**
 * Filtre de catégorie de la page Objectifs, sur MOBILE (2026-10-10).
 *
 * Demande d'Axel sur la maquette 186 : « juste un sélecteur de catégorie à
 * la place des pastilles cliquables ». Le libellé « Catégorie : », son « + »
 * et la rangée de pastilles deviennent UN bouton (« Toutes les catégories ▾ »)
 * qui ouvre une feuille. Choix unique : « Toutes », une racine (avec ses
 * sous-catégories, même règle que les pastilles, `toggleRootCategory`), ou
 * une sous-catégorie seule. La gestion (créer, renommer, couleur) reste
 * atteignable par « Gérer les catégories ».
 *
 * Desktop garde `CategoryFilterBar`, inchangé.
 */
const OKRCategorySelect: React.FC<Props> = ({
  categories, activeCategoryIds, setActiveCategoryIds, resolveColor, onManageCategories,
}) => {
  const { t } = useT('okr');
  const [open, setOpen] = useState(false);

  const selected = categories.find((c) => activeCategoryIds.has(c.id) && !(c.parentId && activeCategoryIds.has(c.parentId)));
  const label = activeCategoryIds.size === 0 || !selected ? t('categories.allLong') : selected.name;

  const pick = (next: Set<string>) => {
    setActiveCategoryIds(next);
    setOpen(false);
  };

  const row = (key: string, text: string, active: boolean, onPick: () => void, color?: string, indent = false) => (
    <li key={key}>
      <button
        type="button"
        onClick={onPick}
        aria-pressed={active}
        className={`w-full flex items-center gap-3 min-h-touch text-left active:bg-[rgb(var(--color-hover))] ${indent ? 'pl-7' : ''}`}
      >
        {color && <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />}
        <span className="flex-1 text-body text-[rgb(var(--color-text-primary))]">{text}</span>
        {active && <Check size={18} aria-hidden="true" className="shrink-0 text-[rgb(var(--color-accent))]" />}
      </button>
    </li>
  );

  return (
    <div className="md:hidden mb-5">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="inline-flex items-center gap-2 min-h-touch px-4 rounded-full bg-[rgb(var(--color-chip-bg))] text-label font-medium text-[rgb(var(--color-text-primary))]"
      >
        {selected && activeCategoryIds.size > 0 && (
          <span className="size-2 rounded-full" style={{ backgroundColor: resolveColor(selected.color) }} aria-hidden="true" />
        )}
        {label}
        <ChevronDown size={16} aria-hidden="true" className="text-[rgb(var(--color-text-muted))]" />
      </button>

      {createPortal(
        <BottomSheet open={open} onClose={() => setOpen(false)} ariaLabel={t('categories.allLong')}>
          <div className="px-gutter pb-4">
            <ul className="divide-y divide-[rgb(var(--color-border))]">
              {row('all', t('categories.allLong'), activeCategoryIds.size === 0, () => pick(new Set()))}
              {rootCategories(categories).flatMap((root) => [
                row(root.id, root.name, selected?.id === root.id, () => pick(toggleRootCategory(root.id, new Set(), categories)), resolveColor(root.color)),
                ...childrenOfCategory(root.id, categories).map((child) =>
                  row(child.id, child.name, selected?.id === child.id, () => pick(new Set([child.id])), resolveColor(child.color), true),
                ),
              ])}
            </ul>
            <button
              type="button"
              onClick={() => { setOpen(false); onManageCategories(); }}
              className="mt-3 w-full flex items-center gap-3 min-h-touch text-left text-body text-[rgb(var(--color-accent))]"
            >
              <Settings2 size={18} aria-hidden="true" />
              {t('categories.manage')}
            </button>
          </div>
        </BottomSheet>,
        document.body,
      )}
    </div>
  );
};

export default OKRCategorySelect;
