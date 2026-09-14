// ═══════════════════════════════════════════════════════════════════
// Sélecteur de catégorie arborescent.
//
// ⚠️ Un parent reste SÉLECTIONNABLE : une tâche peut vivre dans « Travail »
// même si « Travail › SEO » existe. C'est une décision produit, pas un oubli.
//
// ❌ Pas de menus en cascade : ils sont impraticables au doigt et au clavier.
// Un panneau unique, indenté, tient à n'importe quelle profondeur.
//
// 🔴 Seules les RACINES sont visibles par défaut, repliées sur elles-mêmes.
// État d'expansion LOCAL au composant (pas `useCollapsedCategories`, partagé
// par ColorSettingsModal / CategoryFilterTree) : ces deux-là sont des écrans
// de GESTION ou de FILTRE, où voir l'arbre entier d'emblée est le bon défaut
// (leur propre magasin le documente). Ici c'est un simple choix ponctuel —
// repartir replié à chaque ouverture évite qu'un dépliage fait ailleurs (ou
// la fois précédente) fasse resurgir un arbre profond pour choisir une seule
// racine.
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
  /**
   * Classes ajoutées au panneau (`PopoverContent`), typiquement pour relever
   * son `z-index` : rendu dans un PORTAIL, il hérite du z-50 par défaut de
   * `PopoverContent`, ce qui le fait passer SOUS un conteneur hôte à z-index
   * plus élevé (ex. `QuickEventCard`, z-[60]).
   */
  panelClassName?: string;
}

const CategoryTreeSelect: React.FC<CategoryTreeSelectProps> = ({
  value,
  onChange,
  categories,
  hasError = false,
  shaking = false,
  fromOkr = false,
  panelClassName = '',
}) => {
  const { t } = useT('tasks');
  const [open, setOpen] = useState(false);
  // Local, PAS le magasin partagé : identifiants des racines DÉPLIÉES.
  // Absent = replié, l'inverse de `useCollapsedCategories` (qui mémorise le
  // replié) — ici le défaut voulu est justement l'inverse du leur.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  const close = () => { setOpen(false); setExpanded(new Set()); };

  const selectedPath = useMemo(
    () => (value ? formatPath(categoryPath(value, categories)) : ''),
    [value, categories],
  );

  const pick = (id: string) => { onChange(id); close(); };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Le chevron est un bouton séparé du bouton de sélection — un bouton ne
  // peut pas en contenir un autre — pour que déplier ne choisisse jamais la
  // catégorie qu'il déplie.
  const renderNode = (node: CategoryNode, depth: number): React.ReactNode => {
    const hasChildren = node.children.length > 0;
    const isExpanded = hasChildren && expanded.has(node.category.id);
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
              onClick={(e) => { e.stopPropagation(); toggleExpanded(node.category.id); }}
              aria-label={isExpanded ? t('colorModal.collapse') : t('colorModal.expand')}
              className="p-1 shrink-0 text-blue-600 dark:text-blue-400"
            >
              {isExpanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
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
        {hasChildren && isExpanded && node.children.map((child) => renderNode(child, depth + 1))}
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
          } ${fromOkr ? 'bg-blue-50/50 dark:bg-blue-900/20' : 'bg-[rgb(var(--color-surface))]'}`}
        >
          {selectedPath || t('fields.categoryNone')}
        </button>
      </PopoverTrigger>
      {/* Largeur du CHAMP lui-même (`--radix-popover-trigger-width`, calculée
          par Radix), hauteur bornée avec défilement interne pour un arbre
          profond. `align="start"` : ancré au bord gauche du champ, pas
          centré dessus. */}
      <PopoverContent
        align="start"
        style={{ width: 'var(--radix-popover-trigger-width)' }}
        className={`max-h-80 overflow-y-auto p-2 ${panelClassName}`}
      >
        <div role="listbox" aria-label={t('fields.category')}>
          {buildTree(categories).map((node) => renderNode(node, 0))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default CategoryTreeSelect;
