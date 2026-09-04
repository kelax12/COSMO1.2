import { useState } from 'react';
import { Plus, Check, X, Pencil, Trash2 } from 'lucide-react';
import {
  useTeamCategories,
  useCreateTeamCategory,
  useUpdateTeamCategory,
  useDeleteTeamCategory,
  TEAM_CATEGORY_COLORS,
} from '@/modules/team-categories';
import { useTeamProjects, useTeamTasks } from '@/modules/team-projects';
import { useMyOrgPermissions } from '@/modules/organizations';
import { useT } from '@/i18n/useT';

interface TeamCategoryPickerProps {
  orgId: string;
  /** Catégorie sélectionnée (id) — null = aucune. */
  value: string | null;
  onChange: (categoryId: string | null) => void;
}

/** Formulaire ouvert : création, ou édition d'une catégorie existante. */
type FormState = { mode: 'create' } | { mode: 'edit'; id: string } | null;

/**
 * Sélecteur de catégorie d'entreprise (mig. 111) : choisir une catégorie
 * existante, en créer une, la renommer ou la supprimer (nom + couleur) — même
 * pattern que `OKRCategoryPicker`, mais la valeur remontée est l'ID (relation
 * par FK, pas par nom recopié) : un projet ou une tâche ne doit pas perdre sa
 * catégorie si elle est renommée.
 *
 * Renommage et suppression sont gardés par `can['category.manage']`, jamais par
 * `isManager` (mig. 115) : c'est le droit que les policies `team_categories_*`
 * exigent côté serveur. Ils sont arrivés le 2026-09-04 (C-66) : les hooks, les
 * policies et le repository existaient depuis la mig. 111, sans aucun écran.
 *
 * ⚠️ La suppression annonce son impact (garde-fou CLAUDE.md « Supprimer une
 * catégorie annonce son impact »). Ici le FK est `ON DELETE SET NULL` : rien ne
 * pointe dans le vide, mais les projets et les tâches concernés perdent leur
 * étiquette, et c'est ce chiffre-là qu'on montre avant de confirmer.
 */
const TeamCategoryPicker = ({ orgId, value, onChange }: TeamCategoryPickerProps) => {
  const { t } = useT('org');
  const { can } = useMyOrgPermissions(orgId);
  const canManage = can['category.manage'];
  const { data: categories = [] } = useTeamCategories(orgId);
  const createCategory = useCreateTeamCategory(orgId);
  const updateCategory = useUpdateTeamCategory(orgId);
  const deleteCategory = useDeleteTeamCategory(orgId);
  // Impact d'une suppression. Lectures réservées à qui peut supprimer, et en
  // `background` : ce composant ne les AFFICHE pas, il n'en tire qu'un compte.
  const { data: projects = [] } = useTeamProjects(canManage ? orgId : undefined);
  const { data: tasks = [] } = useTeamTasks(canManage ? orgId : undefined, undefined, { background: true });

  const [form, setForm] = useState<FormState>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(TEAM_CATEGORY_COLORS[0]);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const closeForm = () => {
    setForm(null);
    setName('');
    setColor(TEAM_CATEGORY_COLORS[0]);
  };

  const openCreate = () => {
    setPendingDelete(null);
    setName('');
    setColor(TEAM_CATEGORY_COLORS[0]);
    setForm({ mode: 'create' });
  };

  const openEdit = (category: { id: string; name: string; color: string }) => {
    setPendingDelete(null);
    setName(category.name);
    setColor(category.color);
    setForm({ mode: 'edit', id: category.id });
  };

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed || !form) return;
    if (form.mode === 'edit') {
      updateCategory.mutate(
        { categoryId: form.id, input: { name: trimmed, color } },
        { onSuccess: closeForm },
      );
      return;
    }
    createCategory.mutate(
      { name: trimmed, color },
      {
        onSuccess: (cat) => {
          onChange(cat.id);
          closeForm();
        },
      },
    );
  };

  const confirmDelete = (categoryId: string) => {
    deleteCategory.mutate(categoryId, {
      onSuccess: () => {
        // La catégorie sélectionnée vient de disparaître : le formulaire hôte
        // ne doit pas garder un id mort dans son état.
        if (value === categoryId) onChange(null);
        setPendingDelete(null);
      },
    });
  };

  const deleting = pendingDelete ? categories.find((c) => c.id === pendingDelete) : undefined;
  const impactProjects = pendingDelete ? projects.filter((p) => p.categoryId === pendingDelete).length : 0;
  const impactTasks = pendingDelete ? tasks.filter((tk) => tk.categoryId === pendingDelete).length : 0;
  const isPending = createCategory.isPending || updateCategory.isPending;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {categories.map((c) => {
          const active = value === c.id;
          const editing = form?.mode === 'edit' && form.id === c.id;
          if (editing) return null;
          return (
            <div key={c.id} className="group relative inline-flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => onChange(active ? null : c.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  active ? 'text-white border-transparent' : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
                }`}
                style={active ? { backgroundColor: c.color } : undefined}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: active ? 'rgba(255,255,255,0.9)' : c.color }} aria-hidden="true" />
                {c.name}
                {active && <Check size={11} aria-hidden="true" />}
              </button>
              {canManage && (
                // Révélées au survol ET au focus clavier : elles restent dans le
                // DOM, donc atteignables à la tabulation (WCAG 2.1.1).
                <span className="inline-flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    aria-label={t('teamCategory.renameAria', { name: c.name })}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-blue-500 hover:bg-[rgb(var(--color-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
                  >
                    <Pencil size={12} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { closeForm(); setPendingDelete(c.id); }}
                    aria-label={t('teamCategory.deleteAria', { name: c.name })}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-red-500 hover:bg-[rgb(var(--color-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]"
                  >
                    <Trash2 size={12} aria-hidden="true" />
                  </button>
                </span>
              )}
            </div>
          );
        })}
        {!form && canManage && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:text-blue-500 hover:border-[rgb(var(--color-accent-solid-hover))] transition-colors"
          >
            <Plus size={12} aria-hidden="true" /> {t('okrCategory.new')}
          </button>
        )}
      </div>

      {form && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[rgb(var(--color-border))] p-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } if (e.key === 'Escape') closeForm(); }}
            placeholder={t('okrCategory.namePlaceholder')}
            aria-label={t('okrCategory.namePlaceholder')}
            autoFocus
            maxLength={60}
            className="flex-1 min-w-[140px] h-8 px-2.5 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
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
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim() || isPending}
            className="h-8 px-3 rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-50 text-[rgb(var(--color-accent-solid-foreground))] text-xs font-semibold"
          >
            {form.mode === 'edit' ? t('teamCategory.save') : t('okrCategory.create')}
          </button>
          <button
            type="button"
            onClick={closeForm}
            aria-label={t('okrCategory.cancel')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {deleting && (
        // Confirmation EN LIGNE, pas un AlertDialog : ce sélecteur est monté
        // dans une feuille (TeamTaskModal) et dans un modal — empiler un second
        // piège de focus par-dessus est la façon la plus simple de rendre la
        // confirmation inatteignable au clavier.
        <div
          role="alertdialog"
          aria-label={t('teamCategory.deleteTitle', { name: deleting.name })}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/5 p-2 text-xs"
        >
          <p className="flex-1 min-w-[180px] text-[rgb(var(--color-text-secondary))]">
            {t('teamCategory.deleteTitle', { name: deleting.name })}{' '}
            <span className="text-[rgb(var(--color-text-muted))]">
              {t('teamCategory.deleteImpact', { projects: impactProjects, tasks: impactTasks })}
            </span>
          </p>
          <button
            type="button"
            onClick={() => confirmDelete(deleting.id)}
            disabled={deleteCategory.isPending}
            className="h-8 px-3 rounded-lg bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-semibold"
          >
            {t('teamCategory.deleteConfirm')}
          </button>
          <button
            type="button"
            onClick={() => setPendingDelete(null)}
            className="h-8 px-3 rounded-lg border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] text-xs font-semibold"
          >
            {t('okrCategory.cancel')}
          </button>
        </div>
      )}
    </div>
  );
};

export default TeamCategoryPicker;
