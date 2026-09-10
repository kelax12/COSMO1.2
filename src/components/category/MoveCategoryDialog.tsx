import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { categoryPath, descendantIds, formatPath } from '@/modules/categories';
import { wouldExceedMaxDepth } from '@/modules/categories/tree';
import type { Category } from '@/modules/categories';

/**
 * « Déplacer vers… » — le SEUL chemin de reparentage.
 *
 * 🔴 Pas de glisser-déposer, décision du 2026-09-09 : la fonctionnalité doit
 * rester simple et intuitive. Ce menu marche partout, à la souris, au doigt et
 * au clavier, sans cas particulier ni auto-défilement, et il n'a pas besoin
 * d'un second chemin qui ferait la même chose autrement.
 *
 * Destinations exclues, et pourquoi :
 *   - la catégorie elle-même  → cycle immédiat
 *   - ses descendants         → cycle indirect
 *   - toute ligne `temp-`     → ne désigne aucune ligne serveur
 *   - toute destination qui ferait dépasser CATEGORY_MAX_DEPTH, en comptant la
 *     HAUTEUR de la branche déplacée, pas seulement le nœud (`wouldExceedMaxDepth`,
 *     importé directement de `tree.ts` — non ré-exporté par le barrel, comme
 *     `impact.ts` ailleurs dans ce même écran)
 */
interface MoveCategoryDialogProps {
  open: boolean;
  category: Category | null;
  categories: Category[];
  onCancel: () => void;
  onConfirm: (parentId: string | null) => void;
}

const MoveCategoryDialog: React.FC<MoveCategoryDialogProps> = ({
  open, category, categories, onCancel, onConfirm,
}) => {
  const { t } = useT('tasks');
  const [target, setTarget] = useState<string>('');

  const options = useMemo(() => {
    if (!category) return [];
    const forbidden = new Set([category.id, ...descendantIds(category.id, categories)]);

    return categories.filter((c) => {
      if (forbidden.has(c.id)) return false;
      if (c.id.startsWith('temp-')) return false;
      return !wouldExceedMaxDepth(category.id, c.id, categories);
    });
  }, [category, categories]);

  const { ref, dialogProps } = useModalA11y<HTMLDivElement>({
    open,
    onClose: onCancel,
    label: t('colorModal.moveTitle'),
  });

  if (!open || !category) return null;

  return (
    <div ref={ref} {...dialogProps} className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-md" onClick={onCancel} />
      <div className="relative bg-[rgb(var(--color-surface))] rounded-xl w-full max-w-sm p-6 border border-[rgb(var(--color-border))]">
        <h3 className="text-lg font-bold mb-4 text-[rgb(var(--color-text-primary))]">
          {t('colorModal.moveTitle')}
        </h3>

        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          aria-label={t('colorModal.moveTarget')}
          className="w-full min-h-11 rounded-xl border px-3 text-sm bg-[rgb(var(--color-hover))] border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))]"
        >
          <option value="">{t('colorModal.moveToRoot')}</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {formatPath(categoryPath(c.id, categories))}
            </option>
          ))}
        </select>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1 min-h-11" onClick={onCancel}>
            {t('colorModal.moveCancel')}
          </Button>
          <Button className="flex-1 min-h-11" onClick={() => onConfirm(target === '' ? null : target)}>
            {t('colorModal.moveConfirm')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MoveCategoryDialog;
