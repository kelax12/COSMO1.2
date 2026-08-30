import { useMemo, useRef, useState } from 'react';
import { Check, Link2, Loader2, Plus, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  useAddTaskDependency,
  useCreateTask,
  type Task,
  type TaskDependency,
} from '@/modules/tasks';
import { useCategories } from '@/modules/categories';
import {
  dependencyCandidates,
  dependencyEdge,
  type DependencyDirection,
} from '@/lib/dependency-graph';
import { DatePicker } from '@/components/ui/date-picker';
import { useT } from '@/i18n/useT';

interface TaskDependencyPickerProps {
  open: boolean;
  onClose: () => void;
  /** Tâche ouverte — celle dont on complète le graphe. */
  task: Task;
  /** Toutes mes tâches. */
  tasks: Task[];
  dependencies: TaskDependency[];
}

type Mode = 'pick' | 'create';

const PRIORITIES = [1, 2, 3, 4, 5];

const PRIORITY_DOT: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-orange-500',
  3: 'bg-blue-500',
  4: 'bg-sky-400',
  5: 'bg-slate-400',
};

/**
 * Popup d'ajout de dépendance côté tâches personnelles : choisir une tâche
 * existante, ou en créer une à la volée.
 *
 * Jumelle de `organization/TeamTaskDependencyPicker`, et volontairement pas
 * factorisée avec elle : les deux ne partagent ni le type de tâche, ni la
 * règle de périmètre (projet contre compte), ni les champs de création
 * (assignés et projet d'un côté, catégorie de l'autre). Ce qu'elles partagent
 * vraiment — le parcours du graphe et le calcul des candidats — est extrait
 * dans `@/lib/dependency-graph`, et c'est la seule partie où une divergence
 * serait un bug plutôt qu'une différence de produit.
 *
 * Le second chemin (créer) n'est pas un confort : au moment où on décrit ce
 * qui bloque une tâche, la tâche bloquante n'existe souvent pas encore. Sans
 * lui, il faudrait fermer, créer, rouvrir, retrouver — et on ne le ferait pas.
 */
const TaskDependencyPicker = ({
  open,
  onClose,
  task,
  tasks,
  dependencies,
}: TaskDependencyPickerProps) => {
  const { t, tp } = useT('tasks');
  const { data: categories = [] } = useCategories();

  const [mode, setMode] = useState<Mode>('pick');
  const [direction, setDirection] = useState<DependencyDirection>('blockedBy');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const [newPriority, setNewPriority] = useState(3);
  const [newDeadline, setNewDeadline] = useState('');
  const [newCategory, setNewCategory] = useState(task.category ?? '');
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const addDependency = useAddTaskDependency();
  const createTask = useCreateTask();

  // Chaque ouverture repart d'un état neuf, sans useEffect : garder la
  // sélection d'une session précédente ferait ajouter des liens qu'on croyait
  // avoir abandonnés en fermant.
  const [openedAt, setOpenedAt] = useState(false);
  if (open !== openedAt) {
    setOpenedAt(open);
    if (open) {
      setMode('pick');
      setDirection('blockedBy');
      setQuery('');
      setSelected([]);
      setNewName('');
      setNewPriority(3);
      setNewDeadline('');
      // La tâche bloquante appartient presque toujours au même sujet : la
      // catégorie de la tâche ouverte est le défaut qui demande le moins de
      // corrections.
      setNewCategory(task.category ?? '');
    }
  }

  const candidates = useMemo(
    // Aucun `inScope` : le périmètre autorisé par la mig. 132 est le COMPTE,
    // et `tasks` ne contient déjà que les tâches du compte.
    () => dependencyCandidates({ tasks, dependencies, task, direction, query }),
    [tasks, dependencies, task, direction, query],
  );

  const hasAnyOther = tasks.some((x) => x.id !== task.id);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // Le sens est un choix, pas une préférence : changer d'avis après avoir
  // coché invaliderait les cycles calculés pour l'autre sens.
  const switchDirection = (next: DependencyDirection) => {
    setDirection(next);
    setSelected([]);
  };

  const closeAfter = (message: string) => {
    toast.success(message);
    onClose();
  };

  const submitPicked = async () => {
    if (selected.length === 0 || busy) return;
    setBusy(true);
    let added = 0;
    for (const id of selected) {
      try {
        await addDependency.mutateAsync(dependencyEdge(task.id, id, direction));
        added += 1;
      } catch {
        // Le hook a déjà affiché la raison exacte (cycle, doublon). On
        // continue la liste : un refus sur un lien n'invalide pas les autres.
      }
    }
    setBusy(false);
    if (added > 0) closeAfter(tp('dependencies.added', added, { count: added }));
  };

  const submitCreated = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const created = await createTask.mutateAsync({
        name,
        priority: newPriority,
        category: newCategory,
        deadline: newDeadline,
        estimatedTime: 0,
        bookmarked: false,
        completed: false,
      });
      await addDependency.mutateAsync(dependencyEdge(task.id, created.id, direction));
      setBusy(false);
      closeAfter(t('dependencies.createdAndLinked'));
    } catch {
      // Les deux mutations affichent déjà leur propre message. La modale
      // reste ouverte, la saisie intacte : on ne fait pas retaper.
      setBusy(false);
    }
  };

  const directionHelp =
    direction === 'blockedBy'
      ? t('dependencies.helpBlockedBy')
      : t('dependencies.helpBlocks');

  const directionTab = (value: DependencyDirection, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => switchDirection(value)}
      aria-pressed={direction === value}
      className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
        direction === value
          ? 'bg-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]'
          : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
      }`}
    >
      {label}
    </button>
  );

  const fieldClass =
    'no-input-chrome w-full px-3 h-10 text-sm rounded-lg border focus:outline-none focus:border-[rgb(var(--color-accent-solid))] transition-colors';
  const fieldStyle = {
    borderColor: 'rgb(var(--color-border))',
    backgroundColor: 'rgb(var(--color-background))',
    color: 'rgb(var(--color-text-primary))',
  };
  const legendClass = 'block text-xs font-semibold uppercase tracking-wider mb-2';
  const legendStyle = { color: 'rgb(var(--color-text-secondary))' };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        // z-[10000] sur l'overlay ET le contenu : cette popup s'ouvre par
        // dessus le modal de tâche, lui-même un Dialog Radix. Sans ça, elle
        // s'ouvrirait derrière — c'est exactement le bug qui rendait le bouton
        // « Ajouter une dépendance » inerte côté entreprise.
        overlayClassName="z-[10000]"
        className="z-[10000] max-w-[calc(100%-1.5rem)] sm:max-w-lg w-full p-0 gap-0 flex flex-col overflow-hidden max-h-[85vh] border-[rgb(var(--color-border))]"
        style={{ backgroundColor: 'rgb(var(--color-surface))' }}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          searchRef.current?.focus();
        }}
      >
        <DialogHeader
          className="px-5 py-4 border-b shrink-0 space-y-1"
          style={{ borderColor: 'rgb(var(--color-border))' }}
        >
          <div className="flex items-center justify-between gap-3">
            <DialogTitle
              className="text-base font-semibold flex items-center gap-2"
              style={{ color: 'rgb(var(--color-text-primary))' }}
            >
              <Link2 size={16} aria-hidden="true" />
              {t('dependencies.add')}
            </DialogTitle>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('dependencies.close')}
              className="p-2 -mr-2 rounded-lg transition-colors hover:bg-[rgb(var(--color-hover))]"
              style={{ color: 'rgb(var(--color-text-secondary))' }}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <DialogDescription
            className="text-xs text-left"
            style={{ color: 'rgb(var(--color-text-muted))' }}
          >
            {task.name}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pt-4 shrink-0">
          <div
            className="flex gap-1 p-1 rounded-xl"
            style={{ backgroundColor: 'rgb(var(--color-background))' }}
          >
            {directionTab('blockedBy', t('dependencies.blockedBy'))}
            {directionTab('blocks', t('dependencies.blocks'))}
          </div>
          <p className="mt-2 text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
            {directionHelp}
          </p>
        </div>

        {mode === 'pick' ? (
          <>
            <div className="px-5 pt-3 shrink-0">
              <div className="relative">
                <Search
                  size={15}
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]"
                />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('dependencies.searchPlaceholder')}
                  aria-label={t('dependencies.searchPlaceholder')}
                  className={`${fieldClass} pl-9`}
                  style={fieldStyle}
                />
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
              {candidates.length === 0 ? (
                <p
                  className="py-6 text-center text-sm"
                  style={{ color: 'rgb(var(--color-text-muted))' }}
                >
                  {hasAnyOther ? t('dependencies.noMatch') : t('dependencies.noCandidate')}
                </p>
              ) : (
                <ul className="space-y-1">
                  {candidates.map(({ task: item, selectable, alreadyLinked, wouldCycle }) => {
                    const checked = selected.includes(item.id);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          disabled={!selectable}
                          onClick={() => toggle(item.id)}
                          aria-pressed={checked}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                            selectable
                              ? 'hover:bg-[rgb(var(--color-hover))]'
                              : 'opacity-55 cursor-not-allowed'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                              checked
                                ? 'bg-[rgb(var(--color-accent-solid))] border-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]'
                                : 'border-[rgb(var(--color-border))]'
                            }`}
                            aria-hidden="true"
                          >
                            {checked && <Check size={12} />}
                          </span>
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              PRIORITY_DOT[item.priority] ?? 'bg-slate-400'
                            }`}
                            aria-hidden="true"
                          />
                          <span
                            className={`text-sm flex-1 truncate ${item.completed ? 'line-through' : ''}`}
                            style={{
                              color: item.completed
                                ? 'rgb(var(--color-text-muted))'
                                : 'rgb(var(--color-text-primary))',
                            }}
                          >
                            {item.name}
                          </span>
                          {(alreadyLinked || wouldCycle) && (
                            <span className="shrink-0 text-[0.6875rem] font-semibold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                              {alreadyLinked
                                ? t('dependencies.alreadyLinked')
                                : t('dependencies.wouldCycle')}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div
              className="px-5 py-3 border-t flex items-center gap-2 shrink-0"
              style={{ borderColor: 'rgb(var(--color-border))' }}
            >
              <button
                type="button"
                onClick={() => {
                  setNewName(query.trim());
                  setMode('create');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[rgb(var(--color-accent-solid))] hover:opacity-80 transition-opacity"
              >
                <Plus size={14} aria-hidden="true" />
                {t('dependencies.createNew')}
              </button>
              <div className="flex-1" />
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
                {t('dependencies.cancel')}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={submitPicked}
                disabled={selected.length === 0 || busy}
                className="!bg-[rgb(var(--color-accent-solid))] hover:!bg-[rgb(var(--color-accent-solid-hover))] !text-[rgb(var(--color-accent-solid-foreground))] !border-0"
              >
                {busy && <Loader2 size={14} className="animate-spin mr-1.5" aria-hidden="true" />}
                {selected.length > 0
                  ? tp('dependencies.addCount', selected.length, { count: selected.length })
                  : t('dependencies.addEmpty')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
              <div>
                <label htmlFor="task-dep-new-name" className={legendClass} style={legendStyle}>
                  {t('dependencies.createName')}
                </label>
                <input
                  id="task-dep-new-name"
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      // Le modal de tâche parent valide sur Entrée : sans
                      // stopPropagation, créer la dépendance enregistrerait et
                      // fermerait la tâche entière.
                      e.preventDefault();
                      e.stopPropagation();
                      void submitCreated();
                    }
                  }}
                  maxLength={200}
                  placeholder={t('dependencies.createPlaceholder')}
                  className={fieldClass}
                  style={fieldStyle}
                />
              </div>

              <div>
                <span className={legendClass} style={legendStyle}>
                  {t('dependencies.priority')}
                </span>
                <div className="flex gap-1.5">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewPriority(p)}
                      aria-pressed={newPriority === p}
                      className={`flex-1 h-9 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                        newPriority === p
                          ? 'border-[rgb(var(--color-accent-solid))] bg-[rgb(var(--color-accent-solid))]/10'
                          : 'border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-hover))]'
                      }`}
                      style={{ color: 'rgb(var(--color-text-primary))' }}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[p]}`}
                        aria-hidden="true"
                      />
                      P{p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="task-dep-new-deadline"
                    className={legendClass}
                    style={legendStyle}
                  >
                    {t('dependencies.deadline')}
                  </label>
                  {/* Calendrier COSMO, jamais le picker natif : il ignore le
                      thème et la locale de l'app. */}
                  <DatePicker
                    id="task-dep-new-deadline"
                    value={newDeadline}
                    onChange={setNewDeadline}
                    className="h-10"
                    // Cette popup monte déjà à z-[10000] : le calendrier
                    // qu'elle ouvre a besoin du cran au-dessus.
                    popoverClassName="z-[10001]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="task-dep-new-category"
                    className={legendClass}
                    style={legendStyle}
                  >
                    {t('dependencies.category')}
                  </label>
                  <select
                    id="task-dep-new-category"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className={fieldClass}
                    style={fieldStyle}
                  >
                    <option value="">—</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
                {t('dependencies.createNote')}
              </p>
            </div>

            <div
              className="px-5 py-3 border-t flex items-center gap-2 shrink-0"
              style={{ borderColor: 'rgb(var(--color-border))' }}
            >
              <button
                type="button"
                onClick={() => setMode('pick')}
                className="text-xs font-semibold transition-colors hover:opacity-80"
                style={{ color: 'rgb(var(--color-text-secondary))' }}
              >
                {t('dependencies.backToList')}
              </button>
              <div className="flex-1" />
              <Button
                type="button"
                size="sm"
                onClick={submitCreated}
                disabled={!newName.trim() || busy}
                className="!bg-[rgb(var(--color-accent-solid))] hover:!bg-[rgb(var(--color-accent-solid-hover))] !text-[rgb(var(--color-accent-solid-foreground))] !border-0"
              >
                {busy && <Loader2 size={14} className="animate-spin mr-1.5" aria-hidden="true" />}
                {t('dependencies.createSubmit')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TaskDependencyPicker;
