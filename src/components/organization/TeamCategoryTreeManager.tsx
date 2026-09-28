import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FolderInput, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from '@/lib/toast';
import {
  useTeamCategories,
  useCreateTeamCategory,
  useUpdateTeamCategory,
  useDeleteTeamCategory,
  TEAM_CATEGORY_COLORS,
  TEAM_CATEGORY_MAX_DEPTH,
  buildTree,
  childrenOf,
  descendantIdSet,
  formatPath,
  categoryPath,
  treeDepth,
  wouldCreateCycle,
  wouldExceedMaxDepth,
  teamCategoryImpact,
} from '@/modules/team-categories';
import type { TeamCategory, TeamCategoryNode } from '@/modules/team-categories';
import { useTeamOKRs } from '@/modules/team-okrs';
import { useTeamProjects, useTeamTasks } from '@/modules/team-projects';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import DeleteTeamCategoryConfirm from './DeleteTeamCategoryConfirm';
import { resolveCategoryColor } from './TeamCategoryFilterBar';
import { useT } from '@/i18n/useT';
import MenuSelect from '@/components/organization/MenuSelect';

/**
 * Gestion de l'arbre des catégories d'entreprise (Paramètres → Catégories).
 * La barre de chips ne savait que créer des racines : ici chaque nœud se
 * renomme, se recolore, reçoit des sous-catégories, se déplace et se supprime.
 * Cycles et profondeur passent par `@/modules/team-categories` (jamais
 * recalculés ici), le trigger `enforce_team_category_tree` fait foi.
 */

const INPUT =
  'flex-1 min-w-0 min-h-10 bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-lg px-3 text-sm text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus:border-[rgb(var(--color-accent-solid))]';

interface DraftProps {
  onSubmit: (name: string, color: string) => void;
  onCancel: () => void;
  initialName?: string;
  initialColor?: string;
  submitLabel: string;
  isWorking: boolean;
}

const CategoryDraft = ({ onSubmit, onCancel, initialName = '', initialColor = TEAM_CATEGORY_COLORS[0], submitLabel, isWorking }: DraftProps) => {
  const { t } = useT('org');
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const submit = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error(t('okrCategory.nameTooShort'));
      return;
    }
    onSubmit(trimmed, color);
  };
  return (
    <div className="flex flex-col gap-2 py-2">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); submit(); }
            if (e.key === 'Escape') onCancel();
          }}
          placeholder={t('okrCategory.namePlaceholder')}
          aria-label={t('okrCategory.namePlaceholder')}
          className={INPUT}
        />
        <Button type="button" size="sm" onClick={submit} disabled={isWorking}>{submitLabel}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>{t('okrCategory.cancel')}</Button>
      </div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup">
        {TEAM_CATEGORY_COLORS.map((hex) => (
          <button
            key={hex}
            type="button"
            role="radio"
            aria-checked={color === hex}
            aria-label={t('teamCategory.colorAria', { color: hex })}
            onClick={() => setColor(hex)}
            className={`h-6 w-6 rounded-full transition-transform ${color === hex ? 'ring-2 ring-offset-2 ring-[rgb(var(--color-accent-solid))] ring-offset-[rgb(var(--color-surface))] scale-110' : ''}`}
            style={{ backgroundColor: hex }}
          />
        ))}
      </div>
    </div>
  );
};

const TeamCategoryTreeManager = ({ orgId }: { orgId: string }) => {
  const { t } = useT('org');
  const { data: categories = [] } = useTeamCategories(orgId);
  const createCategory = useCreateTeamCategory(orgId);
  const updateCategory = useUpdateTeamCategory(orgId);
  const deleteCategory = useDeleteTeamCategory(orgId);
  const { data: okrs = [] } = useTeamOKRs(orgId);
  const { data: projects = [] } = useTeamProjects(orgId);
  const { data: tasks = [] } = useTeamTasks(orgId, undefined, { background: true });

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  // « root » = nouvelle racine ; un id = nouvelle sous-catégorie de ce nœud.
  const [creatingUnder, setCreatingUnder] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<string>('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const tree = useMemo(() => buildTree(categories), [categories]);
  const toDelete = categories.find((c) => c.id === deleteId);
  const impact = useMemo(
    () => teamCategoryImpact(deleteId, tasks, projects, okrs, categories),
    [deleteId, tasks, projects, okrs, categories],
  );

  const create = (parentId: string | null, name: string, color: string) => {
    createCategory.mutate(
      { name, color, parentId, position: childrenOf(parentId, categories).length },
      {
        onSuccess: () => {
          setCreatingUnder(null);
          if (parentId) setCollapsed((prev) => { const next = new Set(prev); next.delete(parentId); return next; });
        },
      },
    );
  };

  const rename = (id: string, name: string, color: string) => {
    updateCategory.mutate(
      { categoryId: id, input: { name, color } },
      { onSuccess: () => { setEditingId(null); toast.success(t('okrCategory.updated')); } },
    );
  };

  const moving = categories.find((c) => c.id === movingId);
  const moveOptions = useMemo(() => {
    if (!moving) return [];
    const excluded = descendantIdSet(moving.id, categories);
    return categories
      .filter((c) => c.id !== moving.id && !excluded.has(c.id))
      .filter((c) => !wouldCreateCycle(moving.id, c.id, categories) && !wouldExceedMaxDepth(moving.id, c.id, categories))
      .map((c) => ({ id: c.id, label: formatPath(categoryPath(c.id, categories)) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [moving, categories]);

  const confirmMove = () => {
    if (!moving) return;
    const parentId = moveTarget === '' ? null : moveTarget;
    if (parentId === moving.parentId) { setMovingId(null); return; }
    updateCategory.mutate(
      { categoryId: moving.id, input: { parentId, position: childrenOf(parentId, categories).length } },
      { onSuccess: () => { setMovingId(null); toast.success(t('teamCategory.moved')); } },
    );
  };

  const renderNode = (node: TeamCategoryNode, depth: number) => {
    const cat: TeamCategory = node.category;
    const hasChildren = node.children.length > 0;
    const isExpanded = !collapsed.has(cat.id);
    const atMaxDepth = treeDepth(cat.id, categories) >= TEAM_CATEGORY_MAX_DEPTH;
    const indent = { paddingInlineStart: `${(depth - 1) * 20}px` };

    return (
      <li key={cat.id} role="treeitem" aria-level={depth} aria-expanded={hasChildren ? isExpanded : undefined} aria-selected={false}>
        {editingId === cat.id ? (
          <div style={indent}>
            <CategoryDraft
              initialName={cat.name}
              initialColor={resolveCategoryColor(cat.color)}
              submitLabel={t('teamCategory.save')}
              isWorking={updateCategory.isPending}
              onSubmit={(name, color) => rename(cat.id, name, color)}
              onCancel={() => setEditingId(null)}
            />
          </div>
        ) : (
          <div className="group flex items-center gap-2 min-h-11 rounded-lg hover:bg-[rgb(var(--color-hover))]" style={indent}>
            {hasChildren ? (
              <button
                type="button"
                onClick={() => setCollapsed((prev) => {
                  const next = new Set(prev);
                  if (next.has(cat.id)) next.delete(cat.id); else next.add(cat.id);
                  return next;
                })}
                aria-label={isExpanded ? t('teamCategory.collapse') : t('teamCategory.expand')}
                className="min-w-8 min-h-8 flex items-center justify-center text-[rgb(var(--color-text-muted))]"
              >
                {isExpanded ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
              </button>
            ) : (
              <span className="w-8 shrink-0" aria-hidden="true" />
            )}
            <span className="h-3.5 w-3.5 rounded-full shrink-0" style={{ backgroundColor: resolveCategoryColor(cat.color) }} aria-hidden="true" />
            <span className="flex-1 min-w-0 truncate text-sm font-medium text-[rgb(var(--color-text-primary))]">{cat.name}</span>
            {hasChildren && (
              <span className="text-xs text-[rgb(var(--color-text-muted))] tabular-nums">{node.children.length}</span>
            )}
            <button
              type="button"
              onClick={() => setCreatingUnder(cat.id)}
              disabled={atMaxDepth}
              title={atMaxDepth ? t('teamCategory.atMaxDepth') : t('teamCategory.createSubcategory')}
              aria-label={t('teamCategory.createSubcategory')}
              className="min-w-9 min-h-9 flex items-center justify-center rounded-md text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            >
              <Plus size={16} aria-hidden="true" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t('teamCategory.moreActions', { name: cat.name })}
                  className="min-w-9 min-h-9 flex items-center justify-center rounded-md text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))]"
                >
                  <MoreHorizontal size={16} aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setCreatingUnder(cat.id)} disabled={atMaxDepth}>
                  <Plus size={14} aria-hidden="true" /> {t('teamCategory.createSubcategory')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEditingId(cat.id)}>
                  <Pencil size={14} aria-hidden="true" /> {t('teamCategory.rename')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setMovingId(cat.id); setMoveTarget(cat.parentId ?? ''); }}>
                  <FolderInput size={14} aria-hidden="true" /> {t('teamCategory.moveTitle')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDeleteId(cat.id)} variant="destructive">
                  <Trash2 size={14} aria-hidden="true" className="!text-red-500" /> {t('teamCategory.deleteConfirm')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {movingId === cat.id && (
          <div className="flex flex-wrap items-center gap-2 py-2" style={{ paddingInlineStart: `${(depth - 1) * 20 + 40}px` }}>
            <label className="text-xs text-[rgb(var(--color-text-secondary))]" htmlFor={`move-${cat.id}`}>
              {t('teamCategory.moveTo', { name: cat.name })}
            </label>
            <MenuSelect
              id={`move-${cat.id}`}
              value={moveTarget}
              onChange={(e) => setMoveTarget(e.target.value)}
              className="min-h-10 max-w-full rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] px-2 text-sm text-[rgb(var(--color-text-primary))]"
            >
              <option value="">{t('teamCategory.moveToRoot')}</option>
              {moveOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </MenuSelect>
            <Button type="button" size="sm" onClick={confirmMove} disabled={updateCategory.isPending}>{t('teamCategory.moveConfirm')}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setMovingId(null)}>{t('teamCategory.moveCancel')}</Button>
          </div>
        )}

        {(hasChildren && isExpanded) || creatingUnder === cat.id ? (
          <ul role="group" className="border-s border-[rgb(var(--color-border))] ms-4">
            {isExpanded && node.children.map((child) => renderNode(child, depth + 1))}
            {creatingUnder === cat.id && (
              <li style={{ paddingInlineStart: `${depth * 20}px` }}>
                <CategoryDraft
                  submitLabel={t('okrCategory.create')}
                  isWorking={createCategory.isPending}
                  onSubmit={(name, color) => create(cat.id, name, color)}
                  onCancel={() => setCreatingUnder(null)}
                  initialColor={resolveCategoryColor(cat.color)}
                />
              </li>
            )}
          </ul>
        ) : null}
      </li>
    );
  };

  return (
    <>
      {tree.length > 0 ? (
        <ul role="tree" aria-label={t('settings.tab_categories')} className="flex flex-col">
          {tree.map((node) => renderNode(node, 1))}
        </ul>
      ) : (
        <p className="text-sm text-[rgb(var(--color-text-muted))] py-2">{t('teamCategory.noCategory')}</p>
      )}

      {creatingUnder === 'root' ? (
        <CategoryDraft
          submitLabel={t('okrCategory.create')}
          isWorking={createCategory.isPending}
          onSubmit={(name, color) => create(null, name, color)}
          onCancel={() => setCreatingUnder(null)}
        />
      ) : (
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setCreatingUnder('root')}>
          <Plus size={14} aria-hidden="true" /> {t('okrCategory.new')}
        </Button>
      )}

      <DeleteTeamCategoryConfirm
        open={!!deleteId}
        categoryName={toDelete?.name}
        impact={impact}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (!deleteId) return;
          deleteCategory.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
        }}
        isWorking={deleteCategory.isPending}
      />
    </>
  );
};

export default TeamCategoryTreeManager;
