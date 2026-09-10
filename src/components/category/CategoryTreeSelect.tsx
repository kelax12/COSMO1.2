// ═══════════════════════════════════════════════════════════════════
// Sélecteur de catégorie arborescent, avec recherche par chemin.
//
// ⚠️ Un parent reste SÉLECTIONNABLE : une tâche peut vivre dans « Travail »
// même si « Travail › SEO » existe. C'est une décision produit, pas un oubli.
//
// ❌ Pas de menus en cascade : ils sont impraticables au doigt et au clavier.
// Un panneau unique, indenté, plus une recherche, tient à n'importe quelle
// profondeur.
//
// ⚠️ La recherche filtre sur le CHEMIN COMPLET et l'affiche : chercher
// « backlinks » doit trouver « Travail › SEO › Backlinks », sinon une feuille
// profonde est introuvable dès qu'on ne se souvient plus de son parent.
//
// Namespace `tasks` (et non `taskModal`) : ce sélecteur est générique, il sert
// aussi le filtre de tâches (arbre repliable de `TaskFilter`), pas seulement
// la modale de création.
// ═══════════════════════════════════════════════════════════════════
import React, { useMemo, useState } from 'react';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { buildTree, categoryPath, formatPath } from '@/modules/categories';
import type { Category, CategoryNode } from '@/modules/categories';

interface CategoryTreeSelectProps {
  value: string;
  onChange: (categoryId: string) => void;
  categories: Category[];
  /** Bordure d'erreur (validation du formulaire). */
  hasError?: boolean;
  /** Secouement visuel desktop signalant un champ manquant. */
  shaking?: boolean;
  /** Le champ a-t-il été pré-rempli depuis un OKR (fond et bordure accentués) ? */
  fromOkr?: boolean;
}

const CategoryTreeSelect: React.FC<CategoryTreeSelectProps> = ({
  value,
  onChange,
  categories,
  hasError = false,
  shaking = false,
  fromOkr = false,
}) => {
  const { t } = useT('tasks');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const close = () => { setOpen(false); setQuery(''); };

  // Échap emprunte EXACTEMENT le chemin du clic à l'extérieur : `close`.
  const { ref, dialogProps } = useModalA11y<HTMLDivElement>({
    open,
    onClose: close,
    label: t('fields.category'),
  });

  const selectedPath = useMemo(
    () => (value ? formatPath(categoryPath(value, categories)) : ''),
    [value, categories],
  );

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') return null;
    return categories
      .map((c) => ({ category: c, path: formatPath(categoryPath(c.id, categories)) }))
      .filter((m) => m.path.toLowerCase().includes(needle));
  }, [query, categories]);

  const pick = (id: string) => { onChange(id); close(); };

  const renderNode = (node: CategoryNode, depth: number): React.ReactNode => (
    <React.Fragment key={node.category.id}>
      <button
        type="button"
        role="option"
        aria-selected={node.category.id === value}
        onClick={() => pick(node.category.id)}
        style={{ paddingInlineStart: `${8 + depth * 16}px` }}
        className="flex w-full items-center gap-2 min-h-11 text-left text-sm text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))]"
      >
        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: node.category.color }} />
        <span className="truncate">{node.category.name}</span>
      </button>
      {node.children.map((child) => renderNode(child, depth + 1))}
    </React.Fragment>
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full min-h-11 rounded-xl border px-3 text-left text-sm truncate text-[rgb(var(--color-text-primary))] ${
          hasError || shaking
            ? 'border-[rgb(var(--color-error))]'
            : (fromOkr ? 'border-[rgb(var(--color-accent-solid))]' : 'border-[rgb(var(--color-border))]')
        } ${fromOkr ? 'bg-blue-50/50 dark:bg-blue-900/20' : 'bg-[rgb(var(--color-hover))]'}`}
      >
        {selectedPath || t('fields.categoryNone')}
      </button>

      {open && (
        <div ref={ref} {...dialogProps} className="fixed inset-0 z-[85] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-md" onClick={close} />
          <div className="relative w-full sm:max-w-sm max-h-[70vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] p-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('fields.categorySearch')}
              aria-label={t('fields.categorySearch')}
              className="w-full min-h-11 rounded-xl px-3 mb-2 text-sm bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))]"
            />

            <div role="listbox" aria-label={t('fields.category')}>
              <button
                type="button"
                role="option"
                aria-selected={value === ''}
                onClick={() => pick('')}
                className="flex w-full items-center min-h-11 px-2 text-left text-sm text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]"
              >
                {t('fields.categoryNone')}
              </button>

              {matches === null
                ? buildTree(categories).map((node) => renderNode(node, 0))
                : matches.length === 0
                  ? <p className="px-2 py-3 text-sm text-[rgb(var(--color-text-muted))]">{t('fields.categoryNoResult')}</p>
                  : matches.map((m) => (
                      <button
                        key={m.category.id}
                        type="button"
                        role="option"
                        aria-selected={m.category.id === value}
                        onClick={() => pick(m.category.id)}
                        className="flex w-full items-center gap-2 min-h-11 px-2 text-left text-sm text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))]"
                      >
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: m.category.color }} />
                        <span className="truncate">{m.path}</span>
                      </button>
                    ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryTreeSelect;
