import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from '@/lib/toast';
import { Plus, Target, Trash2, Pencil, Building2 } from 'lucide-react';
import {
  useTeamOKRs,
  useUpdateTeamKR,
  useDeleteTeamOKR,
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
import { useTeamProjects, useTeamTasks } from '@/modules/team-projects';
import { getColorHex } from '@/lib/category-colors';
import CategoryFilterBar from '@/pages/okr/CategoryFilterBar';
import DeleteTeamCategoryConfirm from './DeleteTeamCategoryConfirm';
import TeamOKRModal from './TeamOKRModal';
import { useMyOrgPermissions } from '@/modules/organizations';
import { useT } from '@/i18n/useT';
import OrgConfirmDialog from './OrgConfirmDialog';
import { PermissionGate, usePermissionHints } from './permission-hints';
import { readEntityParam } from './deep-link.helpers';
import TeamColorDot from './TeamColorDot';

interface TeamOKRTabProps {
  orgId: string;

}

// Palette hex (value === color) — les catégories d'entreprise stockent l'hex.
const OKR_COLOR_OPTIONS = TEAM_CATEGORY_COLORS.map((hex) => ({ value: hex, color: hex }));
// Résout une couleur : hex tel quel, sinon nom → hex (parité mode perso).
const resolveColor = (color: string) => (color.startsWith('#') ? color : getColorHex(color));

// Progression d'un KR, clampée [0,1] (garde B17 : targetValue > 0 garanti).
const krProgress = (kr: TeamKeyResult): number => {
  if (kr.completed) return 1;
  if (kr.targetValue <= 0) return 0;
  return Math.max(0, Math.min(1, kr.currentValue / kr.targetValue));
};

// Coefficient d'importance effectif : entier borné [1, 10], défaut 1.
const krWeight = (kr: TeamKeyResult): number => {
  const w = Math.round(Number(kr.weight));
  if (!Number.isFinite(w) || w < 1) return 1;
  return Math.min(w, 10);
};

// Progression globale (%) d'un OKR d'équipe : moyenne pondérée par le coefficient.
const okrProgress = (keyResults: TeamKeyResult[]): number => {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const kr of keyResults) {
    const w = krWeight(kr);
    totalWeight += w;
    weightedSum += krProgress(kr) * w;
  }
  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;
};

// ─── Ligne KR : input contrôlé → la barre suit la saisie en direct ─────
interface TeamKRRowProps {
  kr: TeamKeyResult;
  onCommit: (value: number) => void;
}

const TeamKRRow = ({ kr, onCommit }: TeamKRRowProps) => {
  const { t } = useT('org');
  const [value, setValue] = useState<string>(String(kr.currentValue));

  // Resynchronise si la valeur serveur change (mutation d'un autre client / refetch).
  useEffect(() => {
    setValue(String(kr.currentValue));
  }, [kr.currentValue]);

  const numeric = Number(value);
  const liveValue = Number.isNaN(numeric) ? kr.currentValue : numeric;
  const pct = kr.targetValue > 0 ? Math.max(0, Math.min(100, Math.round((liveValue / kr.targetValue) * 100))) : 0;
  const done = liveValue >= kr.targetValue;

  const commit = () => {
    const v = Number(value);
    if (!Number.isNaN(v) && v !== kr.currentValue) onCommit(v);
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm truncate ${kr.completed ? 'line-through text-[rgb(var(--color-text-muted))]' : 'text-[rgb(var(--color-text-primary))]'}`}>
            {kr.title}
          </p>
          {krWeight(kr) !== 1 && (
            <span
              className="shrink-0 text-caption font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400"
              title={`Coefficient d'importance ×${krWeight(kr)}`}
            >
              ×{krWeight(kr)}
            </span>
          )}
          <span className="ml-auto text-xs font-mono text-[rgb(var(--color-text-muted))] shrink-0">
            {liveValue}/{kr.targetValue}{kr.unit ? ` ${kr.unit}` : ''}
          </span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${done ? 'bg-green-500' : 'bg-[rgb(var(--color-accent-solid))]'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {/* Édition rapide de la valeur courante */}
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        aria-label={t('okrTab.currentValueAria', { title: kr.title })}
        className="w-16 h-8 px-2 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/40"
      />
    </div>
  );
};

const TeamOKRTab = ({ orgId }: TeamOKRTabProps) => {
  const { can } = useMyOrgPermissions(orgId);
  const hints = usePermissionHints(orgId);
  const { t, tp } = useT('org');
  const [showCreate, setShowCreate] = useState(false);
  const [editingOKR, setEditingOKR] = useState<TeamOKR | null>(null);
  // Niveau LOURD (cf. OrgConfirmDialog) : un objectif n'a pas de corbeille.
  const [deletingOKR, setDeletingOKR] = useState<TeamOKR | null>(null);
  // `?okr=<id>` : l'adresse d'un objectif (OrgDeepLinkHost y mène depuis toute
  // section). Il reste dans l'URL, comme `?project=` : c'est une adresse.
  const [searchParams] = useSearchParams();
  const focusedOkrId = readEntityParam(searchParams, 'okr');
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
  const teamColor = (id: string) => teams.find((x) => x.id === id)?.color;
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
  const visibleOKRs = useMemo(
    () => (activeCategoryIds.size === 0 ? okrs : okrs.filter((o) => !!o.categoryId && activeCategoryIds.has(o.categoryId))),
    [okrs, activeCategoryIds],
  );

  // L'objectif demandé par l'URL : un filtre de catégorie qui le cacherait est
  // levé, puis on l'amène à l'écran une fois les données arrivées.
  const focusedLoaded = !!focusedOkrId && okrs.some((o) => o.id === focusedOkrId);
  const focusedHidden = focusedLoaded && !visibleOKRs.some((o) => o.id === focusedOkrId);
  useEffect(() => {
    if (focusedHidden) setActiveCategoryIds(new Set());
  }, [focusedHidden]);
  useEffect(() => {
    if (!focusedLoaded || focusedHidden) return;
    document.getElementById(`okr-${focusedOkrId}`)?.scrollIntoView({ block: 'center' });
  }, [focusedLoaded, focusedHidden, focusedOkrId]);

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
        <PermissionGate reason={hints.deniedReason('okr.create')}>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] shadow-sm transition-colors"
          >
            <Plus size={15} aria-hidden="true" /> {t('okrTab.newObjective')}
          </button>
        </PermissionGate>
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
        visibleOKRs.map((okr) => {
          const avg = okrProgress(okr.keyResults);
          const cat = okr.categoryId ? colorById.get(okr.categoryId) : undefined;
          return (
            <section
              key={okr.id}
              id={`okr-${okr.id}`}
              aria-current={okr.id === focusedOkrId ? 'true' : undefined}
              className={`rounded-2xl border bg-[rgb(var(--color-surface))] p-4 scroll-mt-24 ${
                okr.id === focusedOkrId ? 'border-[rgb(var(--color-accent))] ring-2 ring-[rgb(var(--color-accent))]/40' : 'border-[rgb(var(--color-border))]'
              }`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {cat && (
                      <span
                        className="inline-flex items-center gap-1 text-caption font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide"
                        style={{ backgroundColor: `${cat.color}1a`, color: cat.color }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} aria-hidden="true" />
                        {cat.name}
                      </span>
                    )}
                    <h3 className="text-base font-bold text-[rgb(var(--color-text-primary))] truncate">{okr.title}</h3>
                  </div>
                  {okr.description && (
                    <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">{okr.description}</p>
                  )}
                  {/* Rattachement d'équipes (cloisonnement) */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {okr.teamIds.length === 0 ? (
                      <span className="inline-flex items-center gap-1 text-caption font-medium px-2 py-0.5 rounded-full border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))]">
                        <Building2 size={11} aria-hidden="true" /> {t('common.orgWideBadge')}
                      </span>
                    ) : (
                      okr.teamIds.map((tid) => (
                        <span key={tid} className="inline-flex items-center gap-1.5 text-caption font-medium px-2 py-0.5 rounded-full bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))]">
                          <TeamColorDot color={teamColor(tid)} size={7} /> {teamName(tid)}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{avg}%</span>
                </div>
                <>
                  <div className="flex items-center gap-1 shrink-0">
                    <PermissionGate reason={hints.deniedReason('okr.create')}>
                    <button
                      type="button"
                      onClick={() => setEditingOKR(okr)}
                      aria-label={t('common.editOkrAria', { title: okr.title })}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-blue-500 hover:bg-[rgb(var(--color-accent-solid-hover))]/10 transition-colors"
                    >
                      <Pencil size={15} aria-hidden="true" />
                    </button>
                    </PermissionGate>
                    <PermissionGate reason={hints.deniedReason('okr.delete')}>
                    <button
                      type="button"
                      onClick={() => setDeletingOKR(okr)}
                      aria-label={t('common.deleteOkrAria', { title: okr.title })}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                    </PermissionGate>
                  </div>
                </>
              </div>

              <div className="space-y-3">
                {okr.keyResults.map((kr) => (
                  <TeamKRRow key={kr.id} kr={kr} onCommit={(v) => setCurrent(kr, v)} />
                ))}
              </div>
            </section>
          );
        })
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
      {deletingOKR && (
        <OrgConfirmDialog
          title={t('common.deleteOkrTitle', { title: deletingOKR.title })}
          impact={[
            ...(deletingOKR.keyResults.length > 0 ? [tp('common.deleteOkrImpactKrs', deletingOKR.keyResults.length)] : []),
            t('common.deleteOkrImpactHistory'),
          ]}
          confirmLabel={t('common.deleteAction')}
          pending={deleteOKR.isPending}
          onConfirm={() => deleteOKR.mutate(deletingOKR.id, { onSettled: () => setDeletingOKR(null) })}
          onCancel={() => setDeletingOKR(null)}
        />
      )}
    </div>
  );
};

export default TeamOKRTab;
