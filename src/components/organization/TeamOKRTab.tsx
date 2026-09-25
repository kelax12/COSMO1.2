import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from '@/lib/toast';
import { Plus, Target } from 'lucide-react';
import {
  useTeamOKRs,
  useUpdateTeamKR,
  useDeleteTeamOKR,
  useOkrCycles,
  useKRProjects,
  type TeamOKR,
  type TeamKeyResult,
} from '@/modules/team-okrs';
import { useOrgTeams } from '@/modules/org-teams';
import {
  useTeamCategories,
  useCreateTeamCategory,
  useUpdateTeamCategory,
  useDeleteTeamCategory,
  TEAM_CATEGORY_COLORS,
  teamCategoryImpact,
} from '@/modules/team-categories';
import { useTeamProjects, useTeamTasks, useTeamProjectTaskStats } from '@/modules/team-projects';
import { getColorHex } from '@/lib/category-colors';
import CategoryFilterBar from '@/pages/okr/CategoryFilterBar';
import DeleteTeamCategoryConfirm from './DeleteTeamCategoryConfirm';
import TeamOKRModal from './TeamOKRModal';
import TeamOKRCard from './TeamOKRCard';
import OkrCyclesBar from './OkrCyclesBar';
import KRExecutionDialog from './KRExecutionDialog';
import TeamTrashDialog from './TeamTrashDialog';
import { filterOkrsByCycle } from './okr-execution.helpers';
import { readEntityParam } from './deep-link.helpers';
import { useMyOrgPermissions, useOrgMembers } from '@/modules/organizations';
import { useT } from '@/i18n/useT';

interface TeamOKRTabProps {
  orgId: string;

}

// Palette hex (value === color) — les catégories d'entreprise stockent l'hex.
const OKR_COLOR_OPTIONS = TEAM_CATEGORY_COLORS.map((hex) => ({ value: hex, color: hex }));
// Résout une couleur : hex tel quel, sinon nom → hex (parité mode perso).
const resolveColor = (color: string) => (color.startsWith('#') ? color : getColorHex(color));

const TeamOKRTab = ({ orgId }: TeamOKRTabProps) => {
  const { can } = useMyOrgPermissions(orgId);
  const { t } = useT('org');
  const [showCreate, setShowCreate] = useState(false);
  const [editingOKR, setEditingOKR] = useState<TeamOKR | null>(null);
  // `live` : c'est l'écran où l'on regarde les OKR (cf. useTeamOKRs).
  const { data: okrs = [], isLoading } = useTeamOKRs(orgId, { live: true });
  const { data: teams = [] } = useOrgTeams(orgId);
  const { data: categories = [] } = useTeamCategories(orgId);
  const createCategory = useCreateTeamCategory(orgId);
  const updateCategory = useUpdateTeamCategory(orgId);
  const deleteCategory = useDeleteTeamCategory(orgId);
  // Impact d'une suppression — mêmes lectures que `TeamCategoryTreeSelect`,
  // réservées à qui peut gérer les catégories.
  const { data: impactProjects = [] } = useTeamProjects(can['category.manage'] ? orgId : undefined);
  const { data: impactTasks = [] } = useTeamTasks(can['category.manage'] ? orgId : undefined, undefined, { background: true });
  const updateKR = useUpdateTeamKR(orgId);
  const deleteOKR = useDeleteTeamOKR(orgId);
  // Exécution (mig. 160) : cycles, KR reliés à des projets, avancement serveur.
  const { data: cycles = [] } = useOkrCycles(orgId);
  const { data: krLinks = [] } = useKRProjects(orgId);
  const { data: allProjects = [] } = useTeamProjects(orgId);
  const { data: statsRows = [] } = useTeamProjectTaskStats(orgId);
  const { data: members = [] } = useOrgMembers(orgId);
  const statsById = useMemo(() => new Map(statsRows.map((r) => [r.projectId, r])), [statsRows]);
  const [cycleFilter, setCycleFilter] = useState('');
  const [openKrId, setOpenKrId] = useState<string | null>(null);
  const openKr = useMemo(
    () => okrs.flatMap((o) => o.keyResults).find((k) => k.id === openKrId) ?? null,
    [okrs, openKrId],
  );
  // Lien profond `?okr=<id>` (recherche globale, mig. 191) : la carte est
  // amenée à l'écran et soulignée.
  const [searchParams, setSearchParams] = useSearchParams();
  const focusedOkrId = readEntityParam(searchParams, 'okr');
  useEffect(() => {
    if (!focusedOkrId || isLoading) return;
    document.getElementById(`okr-${focusedOkrId}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [focusedOkrId, isLoading]);
  const openOkr = (okrId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('okr', okrId);
    setSearchParams(next, { replace: true });
  };

  // ── Filtre + gestion des catégories (UI identique au mode perso) ────
  // `team_categories` est hiérarchique depuis la mig. 148 : le filtre cascade
  // désormais réellement sur les sous-catégories (cf. CategoryFilterBar).
  const [activeCategoryIds, setActiveCategoryIds] = useState<Set<string>>(new Set());
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

  const teamName = (id: string) => teams.find((x) => x.id === id)?.name ?? t('okrTab.fallbackTeam');
  // Couleur d'une catégorie par son id (badge coloré, parité mode perso).
  const colorById = useMemo(() => {
    const m = new Map<string, { name: string; color: string }>();
    for (const c of categories) m.set(c.id, { name: c.name, color: resolveColor(c.color) });
    return m;
  }, [categories]);

  const setCurrent = (kr: TeamKeyResult, value: number) =>
    updateKR.mutate({ krId: kr.id, input: { currentValue: value } });

  // Filtrage par catégories actives, par id — plus de détour par le nom
  // depuis que `team_okrs.category_id` est un vrai FK (mig. 148).
  const visibleOKRs = useMemo(() => {
    const byCategory = activeCategoryIds.size === 0 ? okrs : okrs.filter((o) => !!o.categoryId && activeCategoryIds.has(o.categoryId));
    return filterOkrsByCycle(byCategory, cycleFilter);
  }, [okrs, activeCategoryIds, cycleFilter]);

  // ── Handlers catégories (mêmes noms/comportements que OKRPage) ──────
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
    // Aucune cascade à faire ici : `team_okrs.category_id` est un FK (mig.
    // 148), renommer la catégorie suffit à ce que tout ce qui la référence
    // affiche le nouveau nom.
    updateCategory.mutate(
      { categoryId: editingCategoryId, input: { name, color: editCategoryColor } },
      {
        onSuccess: () => {
          cancelEditCategory();
          toast.success(t('okrCategory.updated'));
        },
      },
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
  if (isLoading) {
    return <div className="py-10 text-center text-sm text-[rgb(var(--color-text-muted))]">{t('okrTab.loading')}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filtre par catégorie — UI identique à la page OKR perso.
          Les actions de gestion (créer/éditer/supprimer) sont réservées aux
          managers ; un simple membre ne voit que « Tous » + les chips.
          Toujours rendu (même sans catégorie) pour que la barre occupe sa place
          normale : sinon les boutons/cartes en dessous remontaient (#4). */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        {(
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
            resolveColor={resolveColor}
            showCreateCategory={showCreateCategory}
            setShowCreateCategory={setShowCreateCategory}
            newCategoryName={newCategoryName}
            setNewCategoryName={setNewCategoryName}
            newCategoryColor={newCategoryColor}
            setNewCategoryColor={setNewCategoryColor}
            createCategoryMutation={createCategory}
            canManage={can['category.manage']}
            accentAllActive
          />
        )}
        {can['okr.create'] && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] shadow-sm transition-colors"
          >
            <Plus size={15} aria-hidden="true" /> {t('okrTab.newObjective')}
          </button>
        )}
      </div>

      {/* Cycles (mig. 160) et corbeille des objectifs (mig. 193). */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <OkrCyclesBar orgId={orgId} cycles={cycles} value={cycleFilter} onChange={setCycleFilter} canManage={can['okr.create']} />
        <TeamTrashDialog orgId={orgId} projects={allProjects} members={members} />
      </div>

      {okrs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--color-hover))] flex items-center justify-center mb-3">
            <Target size={22} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{t('okrTab.empty')}</p>
          <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1">
            {can['okr.create'] ? t('okrTab.emptyManager') : t('okrTab.emptyMember')}
          </p>
        </div>
      ) : visibleOKRs.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{t('okrTab.emptyCategory')}</p>
          <button
            type="button"
            onClick={() => setActiveCategoryIds(new Set())}
            className="mt-2 text-xs font-semibold text-blue-500 hover:text-blue-600"
          >
            {t('okrTab.seeAll')}
          </button>
        </div>
      ) : (
        visibleOKRs.map((okr) => (
          <TeamOKRCard
            key={okr.id}
            okr={okr}
            okrs={okrs}
            cycles={cycles}
            links={krLinks}
            statsById={statsById}
            category={okr.categoryId ? colorById.get(okr.categoryId) : undefined}
            teamName={teamName}
            canEdit={can['okr.create']}
            canDelete={can['okr.delete']}
            highlighted={focusedOkrId === okr.id}
            onEdit={() => setEditingOKR(okr)}
            // Corbeille (mig. 193) : 30 jours pour restaurer, sans confirmation bloquante.
            onDelete={() => deleteOKR.mutate(okr.id)}
            onCommitKR={setCurrent}
            onOpenKR={(kr) => setOpenKrId(kr.id)}
            onOpenOkr={openOkr}
          />
        ))
      )}

      {/* Dialog suppression catégorie (mig. 148 : team_categories, FK partagé
          tâches/projets/OKR — plus de réaffectation à proposer). */}
      <DeleteTeamCategoryConfirm
        open={!!categoryToDeleteId}
        categoryName={categoryToDelete?.name}
        impact={deleteImpact}
        onCancel={() => setCategoryToDeleteId(null)}
        onConfirm={confirmDeleteCategory}
        isWorking={deleteCategory.isPending}
      />

      {showCreate && (
        <TeamOKRModal orgId={orgId} onClose={() => setShowCreate(false)} />
      )}
      {editingOKR && (
        <TeamOKRModal orgId={orgId} editingOKR={editingOKR} onClose={() => setEditingOKR(null)} />
      )}
      {openKr && (
        <KRExecutionDialog
          orgId={orgId}
          kr={openKr}
          links={krLinks}
          projects={allProjects}
          statsById={statsById}
          members={members}
          canEditStructure={can['okr.create']}
          onClose={() => setOpenKrId(null)}
        />
      )}
    </div>
  );
};

export default TeamOKRTab;
