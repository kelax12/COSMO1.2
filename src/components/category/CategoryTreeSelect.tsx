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
//
// 🔴 Popover Radix, pas un panneau maison. La première version posait le
// panneau en `position: absolute` dans le flux du champ : à l'intérieur d'une
// modale/sheet qui coupe le débordement (`overflow-hidden`, nécessaire pour
// ses coins arrondis), le panneau élargi se faisait ROGNER — visible seulement
// sur la portion qui restait dans les bornes de la modale. `PopoverContent`
// rend dans un PORTAIL (hors de cet arbre DOM), donc hors de portée de tout
// `overflow-hidden` ancêtre ; Radix gère aussi la collision de bord d'écran,
// ce qu'un `position: absolute` fait à la main ne fait pas.
// ═══════════════════════════════════════════════════════════════════
import React, { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { buildTree, categoryPath, formatPath } from '@/modules/categories';
import { useCollapsedCategories } from '@/modules/categories/collapsed.store';
import type { Category, CategoryNode } from '@/modules/categories';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

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
  // Partagé avec ColorSettingsModal / CategoryFilterTree : un même compte a un
  // seul état de pliage, pas un par sélecteur.
  const { isCollapsed, setCollapsed } = useCollapsedCategories();

  const close = () => { setOpen(false); setQuery(''); };

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

  // Replié/déplié : même état partagé que ColorSettingsModal / CategoryFilterTree
  // (`useCollapsedCategories`). Le chevron est un bouton séparé du bouton de
  // sélection — un bouton ne peut pas en contenir un autre — pour que le
  // repli ne choisisse jamais la catégorie qu'il replie.
  const renderNode = (node: CategoryNode, depth: number): React.ReactNode => {
    const hasChildren = node.children.length > 0;
    const collapsed = hasChildren && isCollapsed(node.category.id);
    return (
      <React.Fragment key={node.category.id}>
        <div
          role="option"
          aria-selected={node.category.id === value}
          style={{ paddingInlineStart: `${8 + depth * 16}px` }}
          className="flex w-full items-center gap-1 min-h-11 text-sm text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))]"
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setCollapsed(node.category.id, !collapsed); }}
              aria-label={collapsed ? t('colorModal.expand') : t('colorModal.collapse')}
              className="p-1 shrink-0 text-blue-600 dark:text-blue-400"
            >
              {collapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
            </button>
          ) : (
            <span className="w-6 shrink-0" aria-hidden="true" />
          )}
          <button
            type="button"
            onClick={() => pick(node.category.id)}
            className="flex flex-1 min-w-0 items-center gap-2 min-h-11 text-left"
          >
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: node.category.color }} />
            <span className="truncate">{node.category.name}</span>
          </button>
        </div>
        {hasChildren && !collapsed && node.children.map((child) => renderNode(child, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <Popover open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <PopoverTrigger asChild>
        <button
          type="button"
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
      </PopoverTrigger>
      {/* 48rem/84vh (x2 largeur, x1,2 hauteur) donnait un panneau démesuré,
          bien au-delà d'un menu déroulant classique — revenu à une taille de
          dropdown ordinaire : largeur du CHAMP lui-même
          (`--radix-popover-trigger-width`, calculée par Radix), hauteur
          bornée avec défilement interne pour un arbre profond.
          `align="start"` : ancré au bord gauche du champ, pas centré dessus. */}
      <PopoverContent
        align="start"
        style={{ width: 'var(--radix-popover-trigger-width)' }}
        className="max-h-80 overflow-y-auto p-2"
      >
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
      </PopoverContent>
    </Popover>
  );
};

export default CategoryTreeSelect;
