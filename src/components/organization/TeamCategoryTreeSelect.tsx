// ═══════════════════════════════════════════════════════════════════
// Sélecteur de catégorie d'entreprise, hiérarchique (mig. 148).
//
// Remplace `OKRCategoryPicker` (OKR d'équipe, mig. 078) ET `TeamCategoryPicker`
// (tâches/projets, mig. 111) : les deux tables ont été fusionnées dans
// `team_categories`, et ce composant est l'unique point d'entrée pour la
// choisir, comme `CategoryTreeSelect` (mode perso) l'est pour `categories`.
//
// ⚠️ Contrairement au mode perso, il n'existe PAS d'écran de gestion séparé
// (pas d'équivalent `ColorSettingsModal` côté entreprise) : la création d'une
// sous-catégorie, le renommage, le déplacement et la suppression vivent donc
// TOUS dans ce même menu déroulant, derrière le droit `category.manage`
// (mig. 115). C'est le choix qui évite de construire un second écran pour un
// geste qui reste occasionnel.
//
// 🔴 Seules les RACINES sont visibles par défaut, repliées — même choix que
// `CategoryTreeSelect` : état d'expansion LOCAL, remis à zéro à la fermeture.
import React, { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, Plus, FolderInput, Trash2, Pencil, MoreHorizontal, X } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { toast } from '@/lib/toast';
import {
  useTeamCategories,
  useCreateTeamCategory,
  useUpdateTeamCategory,
  useDeleteTeamCategory,
  TEAM_CATEGORY_COLORS,
  buildTree,
  categoryPath,
  formatPath,
  wouldCreateCycle,
  wouldExceedMaxDepth,
  treeDepth,
  TEAM_CATEGORY_MAX_DEPTH,
  teamCategoryImpact,
  type TeamCategoryNode,
} from '@/modules/team-categories';
import { useTeamProjects, useTeamTasks } from '@/modules/team-projects';
import { useTeamOKRs } from '@/modules/team-okrs';
import { useMyOrgPermissions } from '@/modules/organizations';
import { getColorHex } from '@/components/CategoryManager';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

interface TeamCategoryTreeSelectProps {
  orgId: string;
  /** Catégorie sélectionnée (id) — null/absent = aucune. */
  value: string | null | undefined;
  onChange: (categoryId: string | null) => void;
}

// Palette hex (value === color) — les catégories d'entreprise stockent l'hex,
// contrairement au mode perso qui stocke un NOM résolu par `getColorHex`.
const resolveColor = (color: string) => (color.startsWith('#') ? color : getColorHex(color));

type PendingForm =
  | { mode: 'create-root' }
  | { mode: 'create-child'; parentId: string }
  | { mode: 'rename'; id: string }
  | null;

const TeamCategoryTreeSelect: React.FC<TeamCategoryTreeSelectProps> = ({ orgId, value, onChange }) => {
  const { t } = useT('org');
  const { can } = useMyOrgPermissions(orgId);
  const canManage = can['category.manage'];

  const { data: categories = [] } = useTeamCategories(orgId);
  const createCategory = useCreateTeamCategory(orgId);
  const updateCategory = useUpdateTeamCategory(orgId);
  const deleteCategory = useDeleteTeamCategory(orgId);

  // Impact d'une suppression — lectures réservées à qui peut supprimer, et en
  // arrière-plan : ce composant ne les AFFICHE qu'au moment de confirmer.
  const { data: projects = [] } = useTeamProjects(canManage ? orgId : undefined);
  const { data: tasks = [] } = useTeamTasks(canManage ? orgId : undefined, undefined, { background: true });
  const { data: okrs = [] } = useTeamOKRs(canManage ? orgId : undefined);

  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [form, setForm] = useState<PendingForm>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(TEAM_CATEGORY_COLORS[0]);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const selectedPath = useMemo(
    () => (value ? formatPath(categoryPath(value, categories)) : ''),
    [value, categories],
  );

  const close = () => {
    setOpen(false);
    setExpanded(new Set());
    setForm(null);
    setMovingId(null);
    setDeletingId(null);
  };

  const pick = (id: string) => { onChange(id); close(); };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const closeForm = () => {
    setForm(null);
    setName('');
    setColor(TEAM_CATEGORY_COLORS[0]);
  };

  const openCreateRoot = () => {
    setDeletingId(null);
    setMovingId(null);
    setName('');
    setColor(TEAM_CATEGORY_COLORS[0]);
    setForm({ mode: 'create-root' });
  };

  const openCreateChild = (parentId: string) => {
    setDeletingId(null);
    setMovingId(null);
    setName('');
    setColor(TEAM_CATEGORY_COLORS[0]);
    setForm({ mode: 'create-child', parentId });
    setExpanded((prev) => new Set(prev).add(parentId));
  };

  const openRename = (cat: { id: string; name: string; color: string }) => {
    setDeletingId(null);
    setMovingId(null);
    setName(cat.name);
    setColor(cat.color);
    setForm({ mode: 'rename', id: cat.id });
  };

  const submitForm = () => {
    const trimmed = name.trim();
    if (!trimmed || !form) return;
    if (form.mode === 'rename') {
      updateCategory.mutate({ categoryId: form.id, input: { name: trimmed, color } }, { onSuccess: closeForm });
      return;
    }
    const parentId = form.mode === 'create-child' ? form.parentId : null;
    createCategory.mutate(
      { name: trimmed, color, parentId },
      { onSuccess: (cat) => { onChange(cat.id); closeForm(); } },
    );
  };

  // Destinations valides pour un déplacement : ni soi-même, ni un descendant
  // (cycle), ni un point d'attache qui dépasserait la profondeur maximale
  // (miroir client du trigger `enforce_team_category_tree`, mig. 148).
  const moveTargets = useMemo(() => {
    if (!movingId) return [];
    return categories.filter(
      (c) => c.id !== movingId
        && !wouldCreateCycle(movingId, c.id, categories)
        && !wouldExceedMaxDepth(movingId, c.id, categories),
    );
  }, [movingId, categories]);

  const openMove = (id: string) => {
    setDeletingId(null);
    closeForm();
    setMovingId(id);
    setMoveTarget('');
  };

  const confirmMove = () => {
    if (!movingId) return;
    const newParentId = moveTarget === '' ? null : moveTarget;
    updateCategory.mutate(
      { categoryId: movingId, input: { parentId: newParentId, position: 0 } },
      { onSuccess: () => { toast.success(t('teamCategory.moved')); setMovingId(null); } },
    );
  };

  const openDelete = (id: string) => {
    closeForm();
    setMovingId(null);
    setDeletingId(id);
  };

  const impact = useMemo(
    () => teamCategoryImpact(deletingId, tasks, projects, okrs, categories),
    [deletingId, tasks, projects, okrs, categories],
  );

  const confirmDelete = (id: string) => {
    deleteCategory.mutate(id, {
      onSuccess: () => {
        // La catégorie (ou une de ses branches) vient de disparaître : ne pas
        // laisser le champ hôte pointer sur un identifiant mort.
        if (value === id) onChange(null);
        setDeletingId(null);
      },
    });
  };

  const isPending = createCategory.isPending || updateCategory.isPending;
  // Créer un enfant sous `parentId` ajoute un niveau : refusé si `parentId`
  // est déjà au niveau maximal (miroir du trigger, mig. 148).
  const atMaxDepth = (parentId: string) => treeDepth(parentId, categories) >= TEAM_CATEGORY_MAX_DEPTH;

  const renderNode = (node: TeamCategoryNode, depth: number): React.ReactNode => {
    const cat = node.category;
    const hasChildren = node.children.length > 0;
    const isExpanded = hasChildren && expanded.has(cat.id);
    const isRenaming = form?.mode === 'rename' && form.id === cat.id;
    const isCreatingChild = form?.mode === 'create-child' && form.parentId === cat.id;
    const isMoving = movingId === cat.id;
    const isDeleting = deletingId === cat.id;

    return (
      <React.Fragment key={cat.id}>
        <div
          role="option"
          aria-selected={cat.id === value}
          style={{ paddingInlineStart: `${8 + depth * 16}px` }}
          className="flex w-full items-center gap-1 min-h-11 text-sm text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))]"
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggleExpanded(cat.id); }}
              aria-label={isExpanded ? t('teamCategory.collapse') : t('teamCategory.expand')}
              className="p-1 shrink-0 text-blue-600 dark:text-blue-400"
            >
              {isExpanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
            </button>
          ) : (
            <span className="w-6 shrink-0" aria-hidden="true" />
          )}

          {isRenaming ? (
            <form
              className="flex flex-1 items-center gap-1.5"
              onSubmit={(e) => { e.preventDefault(); submitForm(); }}
            >
              <input
                type="color"
                value={resolveColor(color)}
                onChange={(e) => setColor(e.target.value)}
                aria-label={t('teamCategory.colorAria', { color })}
                className="w-6 h-6 rounded-full shrink-0 cursor-pointer border-0 bg-transparent p-0"
              />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') closeForm(); }}
                autoFocus
                maxLength={60}
                className="flex-1 min-w-0 h-8 px-2 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
              <button type="submit" disabled={!name.trim() || isPending} className="text-xs font-semibold text-blue-600 dark:text-blue-400 disabled:opacity-40 px-1">
                {t('teamCategory.save')}
              </button>
              <button type="button" onClick={closeForm} aria-label={t('okrCategory.cancel')} className="p-1 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))]">
                <X size={13} aria-hidden="true" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => pick(cat.id)}
              className="flex flex-1 min-w-0 items-center gap-2 min-h-11 text-left"
            >
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: resolveColor(cat.color) }} />
              <span className="truncate">{cat.name}</span>
            </button>
          )}

          {canManage && !isRenaming && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={t('teamCategory.moreActions', { name: cat.name })}
                  className="min-w-9 min-h-9 flex items-center justify-center shrink-0 text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] transition-colors"
                >
                  <MoreHorizontal size={16} aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[10000]">
                <DropdownMenuItem onClick={() => openRename(cat)}>
                  <Pencil size={14} aria-hidden="true" /> {t('teamCategory.rename')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => openCreateChild(cat.id)}
                  disabled={atMaxDepth(cat.id)}
                  title={atMaxDepth(cat.id) ? t('teamCategory.atMaxDepth') : undefined}
                >
                  <Plus size={14} aria-hidden="true" /> {t('teamCategory.createSubcategory')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openMove(cat.id)}>
                  <FolderInput size={14} aria-hidden="true" /> {t('teamCategory.moveTitle')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openDelete(cat.id)} variant="destructive">
                  <Trash2 size={14} aria-hidden="true" className="!text-red-500" /> {t('teamCategory.deleteConfirm')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {isMoving && (
          <div
            role="group"
            aria-label={t('teamCategory.moveTo', { name: cat.name })}
            style={{ paddingInlineStart: `${8 + (depth + 1) * 16}px` }}
            className="flex flex-wrap items-center gap-2 py-1.5 pr-2"
          >
            <select
              aria-label={t('teamCategory.moveTo', { name: cat.name })}
              value={moveTarget}
              onChange={(e) => setMoveTarget(e.target.value)}
              className="flex-1 min-w-[140px] h-8 px-2 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-xs"
            >
              <option value="">{t('teamCategory.moveToRoot')}</option>
              {moveTargets.map((c) => (
                <option key={c.id} value={c.id}>{formatPath(categoryPath(c.id, categories))}</option>
              ))}
            </select>
            <button type="button" onClick={confirmMove} disabled={updateCategory.isPending} className="h-8 px-2.5 rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))] text-xs font-semibold disabled:opacity-50">
              {t('teamCategory.moveConfirm')}
            </button>
            <button type="button" onClick={() => setMovingId(null)} className="text-xs text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))]">
              {t('teamCategory.moveCancel')}
            </button>
          </div>
        )}

        {isDeleting && (
          <div
            role="alertdialog"
            aria-label={t('teamCategory.deleteTitle', { name: cat.name })}
            style={{ paddingInlineStart: `${8 + (depth + 1) * 16}px` }}
            className="flex flex-wrap items-center gap-2 py-1.5 pr-2 rounded-lg bg-red-500/5"
          >
            <p className="flex-1 min-w-[160px] text-xs text-[rgb(var(--color-text-secondary))]">
              {t('teamCategory.deleteImpact', { projects: impact.projects, tasks: impact.tasks, okrs: impact.okrs })}
              {impact.subcategories > 0 ? t('teamCategory.deleteImpactSubcategories', { count: impact.subcategories }) : ''}
            </p>
            <button
              type="button"
              onClick={() => confirmDelete(cat.id)}
              disabled={deleteCategory.isPending}
              className="h-8 px-3 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-semibold"
            >
              {t('teamCategory.deleteConfirm')}
            </button>
            <button type="button" onClick={() => setDeletingId(null)} className="h-8 px-3 rounded-lg border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] text-xs font-semibold">
              {t('okrCategory.cancel')}
            </button>
          </div>
        )}

        {isCreatingChild && (
          <div style={{ paddingInlineStart: `${8 + (depth + 1) * 16}px` }} className="flex flex-wrap items-center gap-2 py-1.5 pr-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitForm(); } if (e.key === 'Escape') closeForm(); }}
              placeholder={t('okrCategory.namePlaceholder')}
              autoFocus
              maxLength={60}
              className="flex-1 min-w-[120px] h-8 px-2.5 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <div className="flex items-center gap-1">
              {TEAM_CATEGORY_COLORS.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  aria-label={t('teamCategory.colorAria', { color: swatch })}
                  aria-pressed={color === swatch}
                  onClick={() => setColor(swatch)}
                  className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${color === swatch ? 'ring-2 ring-offset-1 ring-offset-[rgb(var(--color-surface))] ring-blue-500' : ''}`}
                  style={{ backgroundColor: swatch }}
                />
              ))}
            </div>
            <button type="button" onClick={submitForm} disabled={!name.trim() || isPending} className="h-8 px-3 rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-50 text-[rgb(var(--color-accent-solid-foreground))] text-xs font-semibold">
              {t('okrCategory.create')}
            </button>
            <button type="button" onClick={closeForm} aria-label={t('okrCategory.cancel')} className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]">
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}

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
          className="w-full min-h-11 rounded-xl border px-3 text-left text-sm truncate text-[rgb(var(--color-text-primary))] border-[rgb(var(--color-border))] bg-[rgb(var(--color-hover))]"
        >
          {selectedPath || t('teamCategory.noCategory')}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        style={{ width: 'var(--radix-popover-trigger-width)' }}
        className="max-h-80 overflow-y-auto p-2"
      >
        <div role="listbox" aria-label={t('teamCategory.picker')}>
          {buildTree(categories).map((node) => renderNode(node, 0))}
        </div>

        {canManage && (
          form?.mode === 'create-root' ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[rgb(var(--color-border))] p-2 mt-1">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitForm(); } if (e.key === 'Escape') closeForm(); }}
                placeholder={t('okrCategory.namePlaceholder')}
                autoFocus
                maxLength={60}
                className="flex-1 min-w-[120px] h-8 px-2.5 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
              <div className="flex items-center gap-1">
                {TEAM_CATEGORY_COLORS.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    aria-label={t('teamCategory.colorAria', { color: swatch })}
                    aria-pressed={color === swatch}
                    onClick={() => setColor(swatch)}
                    className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${color === swatch ? 'ring-2 ring-offset-1 ring-offset-[rgb(var(--color-surface))] ring-blue-500' : ''}`}
                    style={{ backgroundColor: swatch }}
                  />
                ))}
              </div>
              <button type="button" onClick={submitForm} disabled={!name.trim() || isPending} className="h-8 px-3 rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-50 text-[rgb(var(--color-accent-solid-foreground))] text-xs font-semibold">
                {t('okrCategory.create')}
              </button>
              <button type="button" onClick={closeForm} aria-label={t('okrCategory.cancel')} className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]">
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openCreateRoot}
              className="mt-1 w-full inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-dashed border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:text-blue-500 hover:border-[rgb(var(--color-accent-solid-hover))] transition-colors"
            >
              <Plus size={12} aria-hidden="true" /> {t('okrCategory.new')}
            </button>
          )
        )}
      </PopoverContent>
    </Popover>
  );
};

export default TeamCategoryTreeSelect;
