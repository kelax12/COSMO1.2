import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Target, Trash2, Pencil, Users, Building2 } from 'lucide-react';
import {
  useTeamOKRs,
  useUpdateTeamKR,
  useDeleteTeamOKR,
  useReassignTeamOKRCategory,
  type TeamOKR,
  type TeamKeyResult,
} from '@/modules/team-okrs';
import { useOrgTeams } from '@/modules/org-teams';
import {
  useOrgOKRCategories,
  useCreateOrgOKRCategory,
  useUpdateOrgOKRCategory,
  useDeleteOrgOKRCategory,
  OKR_CATEGORY_COLORS,
} from '@/modules/org-okr-categories';
import { getColorHex } from '@/components/CategoryManager';
import CategoryFilterBar from '@/pages/okr/CategoryFilterBar';
import DeleteCategoryConfirm from '@/pages/okr/DeleteCategoryConfirm';
import TeamOKRModal from './TeamOKRModal';

interface TeamOKRTabProps {
  orgId: string;
  isManager: boolean;
}

// Palette hex (value === color) — les catégories d'entreprise stockent l'hex.
const OKR_COLOR_OPTIONS = OKR_CATEGORY_COLORS.map((hex) => ({ value: hex, color: hex }));
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
              className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400"
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
            className={`h-full rounded-full transition-all ${done ? 'bg-green-500' : 'bg-blue-500'}`}
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
        aria-label={`Valeur actuelle de ${kr.title}`}
        className="w-16 h-8 px-2 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/40"
      />
    </div>
  );
};

const TeamOKRTab = ({ orgId, isManager }: TeamOKRTabProps) => {
  const [showCreate, setShowCreate] = useState(false);
  const [editingOKR, setEditingOKR] = useState<TeamOKR | null>(null);
  const { data: okrs = [], isLoading } = useTeamOKRs(orgId);
  const { data: teams = [] } = useOrgTeams(orgId);
  const { data: categories = [] } = useOrgOKRCategories(orgId);
  const createCategory = useCreateOrgOKRCategory(orgId);
  const updateCategory = useUpdateOrgOKRCategory(orgId);
  const deleteCategory = useDeleteOrgOKRCategory(orgId);
  const reassignCategory = useReassignTeamOKRCategory(orgId);
  const updateKR = useUpdateTeamKR(orgId);
  const deleteOKR = useDeleteTeamOKR(orgId);

  // ── Filtre + gestion des catégories (UI identique au mode perso) ────
  // Sélection = id de catégorie ('all' = toutes). Le filtrage des OKR se fait
  // ensuite par NOM (team_okrs.category stocke le nom).
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [hoveredCategoryId, setHoveredCategoryId] = useState<string | null>(null);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryColor, setEditCategoryColor] = useState<string>(OKR_CATEGORY_COLORS[0]);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState<string>(OKR_CATEGORY_COLORS[0]);
  const [categoryToDeleteId, setCategoryToDeleteId] = useState<string | null>(null);

  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? 'Équipe';
  // Couleur d'une catégorie par son nom (badge coloré, parité mode perso).
  const colorByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.name, resolveColor(c.color));
    return m;
  }, [categories]);

  const setCurrent = (kr: TeamKeyResult, value: number) =>
    updateKR.mutate({ krId: kr.id, input: { currentValue: value } });

  // Filtrage par catégorie sélectionnée (id → nom).
  const selectedName = selectedCategory === 'all'
    ? null
    : categories.find((c) => c.id === selectedCategory)?.name ?? null;
  const visibleOKRs = useMemo(
    () => (selectedCategory === 'all' ? okrs : okrs.filter((o) => o.category === selectedName)),
    [okrs, selectedCategory, selectedName],
  );

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
    setEditCategoryColor(OKR_CATEGORY_COLORS[0]);
  };
  const submitEditCategory = () => {
    if (!editingCategoryId) return;
    const name = editCategoryName.trim();
    if (name.length < 2) {
      toast.error('Le nom de la catégorie doit contenir au moins 2 caractères');
      return;
    }
    const oldName = categories.find((c) => c.id === editingCategoryId)?.name;
    updateCategory.mutate(
      { categoryId: editingCategoryId, input: { name, color: editCategoryColor } },
      {
        onSuccess: () => {
          // Cascade : réétiqueter les OKR portant l'ancien nom (le champ
          // team_okrs.category stocke le nom, pas un id).
          if (oldName && oldName !== name) {
            const ids = okrs.filter((o) => o.category === oldName).map((o) => o.id);
            if (ids.length > 0) reassignCategory.mutate({ okrIds: ids, category: name });
          }
          cancelEditCategory();
          toast.success('Catégorie mise à jour');
        },
      },
    );
  };
  const confirmDeleteCategory = () => {
    if (!categoryToDeleteId) return;
    deleteCategory.mutate(categoryToDeleteId, {
      onSuccess: () => {
        if (selectedCategory === categoryToDeleteId) setSelectedCategory('all');
        setCategoryToDeleteId(null);
      },
    });
  };

  if (isLoading) {
    return <div className="py-10 text-center text-sm text-[rgb(var(--color-text-muted))]">Chargement…</div>;
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
            categories={categories.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
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
            canManage={isManager}
            accentAllActive
          />
        )}
        {isManager && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-semibold text-white shadow-sm transition-colors"
          >
            <Plus size={15} aria-hidden="true" /> Nouvel objectif
          </button>
        )}
      </div>

      {okrs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--color-hover))] flex items-center justify-center mb-3">
            <Target size={22} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">Aucun objectif</p>
          <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1">
            {isManager ? 'Créez un objectif pour aligner l\'équipe.' : 'Un manager doit créer un objectif.'}
          </p>
        </div>
      ) : visibleOKRs.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">Aucun objectif dans cette catégorie</p>
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className="mt-2 text-xs font-semibold text-blue-500 hover:text-blue-600"
          >
            Voir tous les objectifs
          </button>
        </div>
      ) : (
        visibleOKRs.map((okr) => {
          const avg = okrProgress(okr.keyResults);
          const catColor = okr.category ? colorByName.get(okr.category) : undefined;
          return (
            <section key={okr.id} className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {okr.category && (
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide ${catColor ? '' : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'}`}
                        style={catColor ? { backgroundColor: `${catColor}1a`, color: catColor } : undefined}
                      >
                        {catColor && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: catColor }} aria-hidden="true" />}
                        {okr.category}
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
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))]">
                        <Building2 size={11} aria-hidden="true" /> Entreprise
                      </span>
                    ) : (
                      okr.teamIds.map((tid) => (
                        <span key={tid} className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          <Users size={11} aria-hidden="true" /> {teamName(tid)}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{avg}%</span>
                </div>
                {isManager && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingOKR(okr)}
                      aria-label={`Modifier l'objectif ${okr.title}`}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
                    >
                      <Pencil size={15} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Supprimer l'objectif « ${okr.title} » ?`)) deleteOKR.mutate(okr.id);
                      }}
                      aria-label={`Supprimer l'objectif ${okr.title}`}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                )}
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

      {/* Dialog suppression catégorie (même composant que la page OKR perso) */}
      <DeleteCategoryConfirm
        open={!!categoryToDeleteId}
        categoryName={categories.find((c) => c.id === categoryToDeleteId)?.name}
        onCancel={() => setCategoryToDeleteId(null)}
        onConfirm={confirmDeleteCategory}
      />

      {showCreate && (
        <TeamOKRModal orgId={orgId} onClose={() => setShowCreate(false)} />
      )}
      {editingOKR && (
        <TeamOKRModal orgId={orgId} editingOKR={editingOKR} onClose={() => setEditingOKR(null)} />
      )}
    </div>
  );
};

export default TeamOKRTab;
