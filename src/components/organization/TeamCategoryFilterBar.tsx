import { useMemo, useState } from 'react';
import { toast } from '@/lib/toast';
import {
  useTeamCategories,
  useCreateTeamCategory,
  useUpdateTeamCategory,
  useDeleteTeamCategory,
  TEAM_CATEGORY_COLORS,
  teamCategoryImpact,
} from '@/modules/team-categories';
import { useTeamOKRs } from '@/modules/team-okrs';
import { useTeamProjects, useTeamTasks } from '@/modules/team-projects';
import { getColorHex } from '@/lib/category-colors';
import CategoryFilterBar from '@/pages/okr/CategoryFilterBar';
import DeleteTeamCategoryConfirm from './DeleteTeamCategoryConfirm';
import { useT } from '@/i18n/useT';

interface TeamCategoryFilterBarProps {
  orgId: string;
  activeCategoryIds: Set<string>;
  setActiveCategoryIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  /**
   * Créer, renommer, recolorer, supprimer. Vrai dans Paramètres → Catégories
   * (M13) ; faux dans l'onglet OKR, où la barre ne sert plus qu'à filtrer.
   */
  canManage: boolean;
}

const OKR_COLOR_OPTIONS = TEAM_CATEGORY_COLORS.map((hex) => ({ value: hex, color: hex }));
export const resolveCategoryColor = (color: string) => (color.startsWith('#') ? color : getColorHex(color));

/**
 * Barre des catégories d'entreprise (mig. 148), sortie de l'onglet OKR le
 * 2026-09-24 : elles classent aussi projets et tâches, leur gestion n'avait
 * rien à faire sous « Objectifs » (audit 2026-09-23, M13).
 */
const TeamCategoryFilterBar = ({ orgId, activeCategoryIds, setActiveCategoryIds, canManage }: TeamCategoryFilterBarProps) => {
  const { t } = useT('org');
  const { data: categories = [] } = useTeamCategories(orgId);
  const createCategory = useCreateTeamCategory(orgId);
  const updateCategory = useUpdateTeamCategory(orgId);
  const deleteCategory = useDeleteTeamCategory(orgId);
  // Impact d'une suppression : lu seulement par qui peut supprimer.
  const { data: okrs = [] } = useTeamOKRs(canManage ? orgId : undefined);
  const { data: impactProjects = [] } = useTeamProjects(canManage ? orgId : undefined);
  const { data: impactTasks = [] } = useTeamTasks(canManage ? orgId : undefined, undefined, { background: true });

  const [hoveredCategoryId, setHoveredCategoryId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryColor, setEditCategoryColor] = useState<string>(TEAM_CATEGORY_COLORS[0]);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState<string>(TEAM_CATEGORY_COLORS[0]);
  const [categoryToDeleteId, setCategoryToDeleteId] = useState<string | null>(null);

  const categoryToDelete = categories.find((c) => c.id === categoryToDeleteId);
  const deleteImpact = useMemo(
    () => teamCategoryImpact(categoryToDeleteId, impactTasks, impactProjects, okrs, categories),
    [categoryToDeleteId, impactTasks, impactProjects, okrs, categories],
  );

  const startEditCategory = (cat: { id: string; name: string; color: string }) => {
    setEditingCategoryId(cat.id);
    setEditCategoryName(cat.name);
    setEditCategoryColor(cat.color);
    setHoveredCategoryId(null);
  };
  const cancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditCategoryName('');
    setEditCategoryColor(TEAM_CATEGORY_COLORS[0]);
  };
  const submitEditCategory = () => {
    if (!editingCategoryId) return;
    const name = editCategoryName.trim();
    if (name.length < 2) {
      toast.error(t('okrCategory.nameTooShort'));
      return;
    }
    updateCategory.mutate(
      { categoryId: editingCategoryId, input: { name, color: editCategoryColor } },
      { onSuccess: () => { cancelEditCategory(); toast.success(t('okrCategory.updated')); } },
    );
  };
  const confirmDeleteCategory = () => {
    if (!categoryToDeleteId) return;
    deleteCategory.mutate(categoryToDeleteId, {
      onSuccess: () => {
        setActiveCategoryIds((prev) => {
          if (!prev.has(categoryToDeleteId)) return prev;
          const next = new Set(prev);
          next.delete(categoryToDeleteId);
          return next;
        });
        setCategoryToDeleteId(null);
      },
    });
  };

  return (
    <>
      <CategoryFilterBar
        categories={categories.map((c) => ({ id: c.id, name: c.name, color: c.color, parentId: c.parentId }))}
        activeCategoryIds={activeCategoryIds}
        setActiveCategoryIds={setActiveCategoryIds}
        hoveredCategoryId={hoveredCategoryId}
        setHoveredCategoryId={setHoveredCategoryId}
        editingCategoryId={editingCategoryId}
        editCategoryName={editCategoryName}
        setEditCategoryName={setEditCategoryName}
        editCategoryColor={editCategoryColor}
        setEditCategoryColor={setEditCategoryColor}
        startEditCategory={startEditCategory}
        cancelEditCategory={cancelEditCategory}
        submitEditCategory={submitEditCategory}
        setCategoryToDeleteId={setCategoryToDeleteId}
        colorOptions={OKR_COLOR_OPTIONS}
        resolveColor={resolveCategoryColor}
        showCreateCategory={showCreateCategory}
        setShowCreateCategory={setShowCreateCategory}
        newCategoryName={newCategoryName}
        setNewCategoryName={setNewCategoryName}
        newCategoryColor={newCategoryColor}
        setNewCategoryColor={setNewCategoryColor}
        createCategoryMutation={createCategory}
        canManage={canManage}
        accentAllActive
        large={!canManage}
      />
      <DeleteTeamCategoryConfirm
        open={!!categoryToDeleteId}
        categoryName={categoryToDelete?.name}
        impact={deleteImpact}
        onCancel={() => setCategoryToDeleteId(null)}
        onConfirm={confirmDeleteCategory}
        isWorking={deleteCategory.isPending}
      />
    </>
  );
};

export default TeamCategoryFilterBar;
