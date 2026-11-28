// ═══════════════════════════════════════════════════════════════════
// DesktopDetailsStep — étape 1 (champs principaux) du wizard desktop TaskModal
// ═══════════════════════════════════════════════════════════════════
// Extrait verbatim de TaskModalDesktopBody (bloc `step === 1`). Possède ses
// propres états locaux de création inline catégorie/liste (propres à cette
// étape). Tout le reste vient des props. Un composant par onglet ; les champs
// de l'onglet Détails vivent dans `DesktopDetailsFields`.
import React, { useEffect, useState } from 'react';
import { X, Check, ChevronDown, Plus } from 'lucide-react';
import CategoryField from './CategoryField';
import SubtaskChecklist from './SubtaskChecklist';
import TaskStateFields from './TaskStateFields';
import TaskDependenciesSection from './TaskDependenciesSection';
import { CreateStateFields, CreateDependenciesField } from './CreateTaskPendingFields';
import {
  TaskNameField, PriorityField, DeadlineField, DurationField, DescriptionSection, BookmarkToggle,
} from './DesktopDetailsFields';
import type { useCreateCategory, Category } from '@/modules/categories';
import type { useCreateList } from '@/modules/lists';
import { useT } from '@/i18n/useT';

type TaskFormState = {
  name: string;
  description: string;
  priority: number;
  category: string;
  deadline: string;
  estimatedTime: number;
  completed: boolean;
  bookmarked: boolean;
  isFromOKR: boolean;
  krId: string;
  recurrence: import('@/modules/tasks').TaskRecurrence;
  subtasks: import('@/modules/tasks').Subtask[];
  status?: import('@/modules/tasks').TaskStatus;
  health?: import('@/modules/tasks').TaskHealth | null;
  blockedByIds?: string[];
};

export type DetailsTab = 'details' | 'advanced' | 'subtasks' | 'dependencies' | 'share';

export interface DesktopDetailsStepProps {
  formData: TaskFormState;
  setFormData: React.Dispatch<React.SetStateAction<TaskFormState>>;
  handleInputChange: (field: string, value: string | number | boolean) => void;
  errors: { [key: string]: string };
  setErrors: React.Dispatch<React.SetStateAction<{ [key: string]: string }>>;
  okrFields: Record<string, boolean>;
  setHasChanges: React.Dispatch<React.SetStateAction<boolean>>;
  dRegister: (name: string) => (el: HTMLElement | null) => void;
  dClear: (name: string) => void;
  dInvalid: (name: string) => boolean;
  categories: Category[];
  createCategoryMutation: ReturnType<typeof useCreateCategory>;
  listColorOptions: { value: string; color: string }[];
  lists: Array<{ id: string; name: string; color: string; taskIds: string[]; type?: string; smartRule?: string; isDefault?: boolean; position?: number }>;
  selectedListIds: string[];
  setSelectedListIds: React.Dispatch<React.SetStateAction<string[]>>;
  createListMutation: ReturnType<typeof useCreateList>;
  isCreating: boolean;
  /** Tâche existante (mode édition) — requis pour la checklist de sous-tâches. */
  task?: import('@/modules/tasks').Task | null;
  /** Section Description masquée par défaut — même système que EventModal. */
  showDescription: boolean;
  setShowDescription: React.Dispatch<React.SetStateAction<boolean>>;
  /** Onglet affiché. « Partager » est rendu par le parent : ici, rien. */
  tab?: DetailsTab;
}
/**
 * Création inline d'une liste (onglet Avancé). L'état vit dans l'étape, pas
 * dans l'onglet : un nom commencé survit à un changement d'onglet.
 */
function useNewListDraft({ listColorOptions, createListMutation, setSelectedListIds, setHasChanges }: Pick<
  DesktopDetailsStepProps, 'listColorOptions' | 'createListMutation' | 'setSelectedListIds' | 'setHasChanges'
>) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState('blue');
  const reset = () => { setOpen(false); setName(''); setColor('blue'); };
  const submit = () => {
    if (!name.trim()) return;
    createListMutation.mutate(
      { name: name.trim(), color },
      {
        onSuccess: (created) => {
          setSelectedListIds(prev => [...prev, created.id]);
          setHasChanges(true);
          reset();
        }
      }
    );
  };
  const cycleColor = () => {
    const idx = listColorOptions.findIndex(c => c.value === color);
    setColor(listColorOptions[(idx + 1) % listColorOptions.length].value);
  };
  const start = () => { setOpen(true); setName(''); };
  return { open, name, setName, color, start, submit, reset, cycleColor, pending: createListMutation.isPending };
}

type NewListDraft = ReturnType<typeof useNewListDraft>;

/** Champ de création d'une liste : pastille de couleur, nom, Créer, annuler. */
function NewListInput({ draft, listColorOptions }: { draft: NewListDraft; listColorOptions: DesktopDetailsStepProps['listColorOptions'] }) {
  const { t } = useT('taskModal');
  const { t: tCommon } = useT('common');
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={draft.cycleColor}
        className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-700 shadow-sm shrink-0 transition-transform hover:scale-110"
        style={{ backgroundColor: listColorOptions.find(c => c.value === draft.color)?.color || '#3B82F6' }}
        title={tCommon('actions.changeColor')}
      />
      <input
        type="text"
        autoFocus
        value={draft.name}
        onChange={(e) => draft.setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            draft.submit();
          } else if (e.key === 'Escape') {
            draft.reset();
          }
        }}
        placeholder={t('desktop.listNamePlaceholder')}
        className="flex-1 px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:border-[rgb(var(--color-accent))] border-[rgb(var(--color-border))]"
        style={{ backgroundColor: 'rgb(var(--color-surface))', color: 'rgb(var(--color-text-primary))' }}
      />
      <button
        type="button"
        disabled={!draft.name.trim() || draft.pending}
        onClick={draft.submit}
        className="px-3 py-1.5 text-sm rounded-lg bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] text-[rgb(var(--color-accent-solid-foreground))] font-medium disabled:opacity-40 transition-all"
      >
        {draft.pending ? t('common.creating') : t('common.create')}
      </button>
      <button
        type="button"
        onClick={draft.reset}
        className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        style={{ color: 'rgb(var(--color-text-secondary))' }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

/**
 * Onglet Avancé : statut et état (mig. 214), puis les listes affichées
 * d'emblée, trois par ligne : un clic coche ou décoche, sans menu déroulant à
 * ouvrir d'abord. Les listes intelligentes se remplissent seules : elles n'y
 * figurent pas.
 */
function AdvancedTab({
  formData, setFormData, setHasChanges, isCreating, task,
  lists, listColorOptions, selectedListIds, setSelectedListIds, draft,
}: Pick<DesktopDetailsStepProps,
  'formData' | 'setFormData' | 'setHasChanges' | 'isCreating' | 'task'
  | 'lists' | 'listColorOptions' | 'selectedListIds' | 'setSelectedListIds'
> & { draft: NewListDraft }) {
  const { t } = useT('taskModal');
  return (
    <div className="space-y-5">
      {/* Statut et État (mig. 214) — édition : enregistrés à chaque choix. */}
      {!isCreating && task
        ? <TaskStateFields taskId={task.id} />
        : <CreateStateFields form={formData} setForm={setFormData} setHasChanges={setHasChanges} />}
      <div>
        <p className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'rgb(var(--color-text-secondary))' }}>
          {t('fields.addToList')}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {lists.filter(l => l.type !== 'smart').map(list => {
            const listColorHex = listColorOptions.find(c => c.value === list.color)?.color || list.color || '#3B82F6';
            const checked = selectedListIds.includes(list.id);
            return (
              <button
                key={list.id}
                type="button"
                aria-pressed={checked}
                onClick={() => {
                  setSelectedListIds(checked
                    ? selectedListIds.filter(id => id !== list.id)
                    : [...selectedListIds, list.id]);
                  setHasChanges(true);
                }}
                className={`flex items-center gap-2 min-w-0 px-3 py-2 rounded-lg border text-sm font-medium text-left transition-all ${
                  checked
                    ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent-solid))]/10'
                    : 'border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-border-strong))] bg-[rgb(var(--color-surface))]'
                }`}
                style={{ color: 'rgb(var(--color-text-primary))' }}
              >
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: listColorHex }}
                >
                  {checked && <Check size={10} className="text-white" strokeWidth={3} aria-hidden="true" />}
                </span>
                <span className="truncate">{list.name}</span>
              </button>
            );
          })}
          {!draft.open && (
            <button
              type="button"
              onClick={draft.start}
              className="flex items-center gap-2 min-w-0 px-3 py-2 rounded-lg border border-dashed text-sm font-medium text-blue-600 dark:text-blue-300 border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-border-strong))] hover:bg-[rgb(var(--color-accent-solid))]/10 transition-colors"
            >
              <Plus size={15} className="shrink-0" />
              <span className="truncate">{t('fields.createList')}</span>
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:gap-4 items-center">
        {draft.open && <NewListInput draft={draft} listColorOptions={listColorOptions} />}
      </div>
    </div>
  );
}

/** Onglet Détails : le nom, puis les champs facultatifs, repliés en création (#2). */
function DetailsTab({ showAllFields, onShowAllFields, ...p }: Omit<DesktopDetailsStepProps, 'tab'> & {
  showAllFields: boolean;
  onShowAllFields: () => void;
}) {
  const { t } = useT('taskModal');
  return (
    <div className="space-y-5">
      <TaskNameField {...p} />

      {/* Formulaire minimal (#2) : en création, seuls le nom + ce
          toggle sont visibles. Les champs facultatifs (priorité,
          catégorie, échéance, durée…) se déplient à la demande —
          seul le nom est requis (cf. validation.ts). */}
      {p.isCreating && !showAllFields && (
        <button
          type="button"
          data-guide-id="perso-task-form-more"
          onClick={onShowAllFields}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed text-sm font-medium transition-all hover:border-[rgb(var(--color-border-strong))] hover:bg-[rgb(var(--color-accent-solid-hover))]/5 border-[rgb(var(--color-border))]"
          style={{ color: 'rgb(var(--color-text-secondary))' }}
        >
          <ChevronDown size={16} aria-hidden="true" />
          {t('fields.moreOptions')}
        </button>
      )}

      {showAllFields && (<>
        {/* Priority and Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PriorityField {...p} />
          <div ref={p.dRegister('category')}>
            <CategoryField
              value={p.formData.category}
              onChange={(id) => p.handleInputChange('category', id)}
              categories={p.categories}
              colorOptions={p.listColorOptions}
              createCategory={(input, options) => p.createCategoryMutation.mutate(input, options)}
              isCreating={p.createCategoryMutation.isPending}
              error={p.errors.category}
              shaking={p.dInvalid('category')}
              fromOkr={!!p.okrFields.category}
            />
          </div>
        </div>

        {/* Deadline and Estimated Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DeadlineField {...p} />
          <DurationField {...p} />
        </div>

        {/* Sélecteur « Contribue à un résultat clé » retiré à la
            demande utilisateur — le lien tâche↔KR reste géré via
            l'auto-liaison depuis la page OKR (formData.krId préservé). */}

        <DescriptionSection {...p} />

        <BookmarkToggle bookmarked={p.formData.bookmarked} onToggle={() => p.handleInputChange('bookmarked', !p.formData.bookmarked)} />
      </>)}
    </div>
  );
}

const DesktopDetailsStep: React.FC<DesktopDetailsStepProps> = ({ tab = 'details', ...props }) => {
  const { formData, setFormData, setHasChanges, isCreating, task } = props;
  // Formulaire minimal (#2) : replié en création, toujours déplié en édition.
  const [showAllFields, setShowAllFields] = useState(!isCreating);

  // `isCreating` peut basculer true → false en cours de session (génération
  // d'un lien de partage pendant la création : la tâche est persistée à la
  // volée et la popup bascule en édition sans démonter ce composant). Sans ce
  // sync, `showAllFields` restait figé à `false` et le bouton "Plus d'options"
  // — rendu seulement quand `isCreating` — disparaissait aussi : tous les
  // champs (priorité, catégorie, échéance, durée…) devenaient inaccessibles.
  useEffect(() => {
    if (!isCreating) setShowAllFields(true);
  }, [isCreating]);
  const newListDraft = useNewListDraft(props);

  if (tab === 'share') return null;

  if (tab === 'advanced') return <AdvancedTab {...props} draft={newListDraft} />;

  if (tab === 'subtasks') {
    return (
      <div className="space-y-5">
        {!isCreating && task && <SubtaskChecklist taskId={task.id} initialSubtasks={task.subtasks} />}
        {isCreating && (
          <SubtaskChecklist
            value={formData.subtasks ?? []}
            onChange={(subtasks) => setFormData(prev => ({ ...prev, subtasks }))}
          />
        )}
      </div>
    );
  }

  if (tab === 'dependencies') {
    // Dépendances (mig. 132). En création, les arêtes sont gardées dans le
    // formulaire et posées juste après l'insertion (`createTaskWithShares`).
    return (
      <div className="space-y-5">
        {!isCreating && task
          ? <TaskDependenciesSection taskId={task.id} alwaysOpen />
          : <CreateDependenciesField form={formData} setForm={setFormData} setHasChanges={setHasChanges} />}
      </div>
    );
  }

  return <DetailsTab {...props} showAllFields={showAllFields} onShowAllFields={() => setShowAllFields(true)} />;
};

export default DesktopDetailsStep;
