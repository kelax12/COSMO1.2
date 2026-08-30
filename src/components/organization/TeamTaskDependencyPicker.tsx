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
  useCreateTeamTask,
  type TeamTask,
  type TeamTaskDependency,
} from '@/modules/team-projects';
import { useMyOrgPermissions } from '@/modules/organizations';
import { PRIORITY_META } from './team-projects.helpers';
import {
  dependencyCandidates,
  dependencyEdge,
  type DependencyDirection,
} from '@/lib/dependency-graph';
import { DatePicker } from '@/components/ui/date-picker';
import { useT } from '@/i18n/useT';

interface TeamTaskDependencyPickerProps {
  open: boolean;
  onClose: () => void;
  /** Tâche ouverte — celle dont on complète le graphe. */
  task: TeamTask;
  /** Toutes les tâches de l'organisation (filtrées ici au projet). */
  tasks: TeamTask[];
  dependencies: TeamTaskDependency[];
}

type Mode = 'pick' | 'create';

const PRIORITIES = [1, 2, 3, 4, 5];

/**
 * Popup d'ajout de dépendance : choisir une tâche existante du projet, ou en
 * créer une à la volée.
 *
 * Pourquoi une modale plutôt qu'un menu déroulant : le menu précédent était
 * portalisé à `z-50` alors que `TeamTaskModal` monte à `z-[9999]` — il
 * s'ouvrait réellement, mais DERRIÈRE la modale, donc invisible. Le bouton
 * paraissait mort. Même remède que `DescriptionField` : overlay ET contenu
 * relevés à `z-[10000]`.
 *
 * Le deuxième chemin (créer) n'est pas un confort : au moment où on décrit ce
 * qui bloque une tâche, la tâche bloquante n'existe souvent pas encore. Sans
 * lui, il fallait fermer, créer, rouvrir, retrouver — et on ne le faisait pas.
 */
const TeamTaskDependencyPicker = ({
  open,
  onClose,
  task,
  tasks,
  dependencies,
}: TeamTaskDependencyPickerProps) => {
  const { t, tp } = useT('org');
  const { can } = useMyOrgPermissions(task.orgId);

  const [mode, setMode] = useState<Mode>('pick');
  const [direction, setDirection] = useState<DependencyDirection>('blockedBy');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const [newPriority, setNewPriority] = useState(3);
  const [newDeadline, setNewDeadline] = useState('');
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const addDependency = useAddTaskDependency(task.orgId);
  const createTask = useCreateTeamTask(task.orgId);

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
    }
  }

  const candidates = useMemo(
    () =>
      dependencyCandidates({
        tasks,
        dependencies,
        task,
        direction,
        query,
        // Le périmètre est le PROJET, parce que c'est ce que la base accepte
        // (mig. 108). Proposer une tâche d'un autre projet reviendrait à
        // promettre un lien que le serveur refusera.
        inScope: (x) => x.projectId === task.projectId,
      }),
    [tasks, dependencies, task, direction, query],
  );

  const hasAnyInProject = useMemo(
    () => tasks.some((x) => x.id !== task.id && x.projectId === task.projectId),
    [tasks, task.id, task.projectId],
  );

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
    if (added > 0) closeAfter(tp('projects.dependencyAdded', added, { count: added }));
  };

  const submitCreated = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const created = await createTask.mutateAsync({
        projectId: task.projectId,
        name,
        priority: newPriority,
        ...(newDeadline ? { deadline: newDeadline } : {}),
      });
      await addDependency.mutateAsync(dependencyEdge(task.id, created.id, direction));
      setBusy(false);
      closeAfter(t('projects.dependencyCreatedAndLinked'));
    } catch {
      // Les deux mutations affichent déjà leur propre message. La modale
      // reste ouverte, la saisie intacte : on ne fait pas retaper.
      setBusy(false);
    }
  };

  const directionHelp =
    direction === 'blockedBy'
      ? t('projects.dependencyHelpBlockedBy')
      : t('projects.dependencyHelpBlocks');

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

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        // z-[10000] sur l'overlay ET le contenu : cette popup s'ouvre depuis
        // TeamTaskModal (hors Radix, z-[9999]). Sans ça elle est invisible.
        overlayClassName="z-[10000]"
        className="z-[10000] max-w-[calc(100%-1.5rem)] sm:max-w-lg w-full p-0 gap-0 flex flex-col overflow-hidden max-h-[85vh] border-[rgb(var(--color-border))]"
        style={{ backgroundColor: 'rgb(var(--color-surface))' }}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          searchRef.current?.focus();
        }}
      >
        <DialogHeader className="px-5 py-4 border-b shrink-0 space-y-1" style={{ borderColor: 'rgb(var(--color-border))' }}>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="text-base font-semibold flex items-center gap-2" style={{ color: 'rgb(var(--color-text-primary))' }}>
              <Link2 size={16} aria-hidden="true" />
              {t('projects.addDependency')}
            </DialogTitle>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="p-2 -mr-2 rounded-lg transition-colors hover:bg-[rgb(var(--color-hover))]"
              style={{ color: 'rgb(var(--color-text-secondary))' }}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
          <DialogDescription className="text-xs text-left" style={{ color: 'rgb(var(--color-text-muted))' }}>
            {task.name}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 pt-4 shrink-0">
          <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
            {directionTab('blockedBy', t('projects.blockedBy'))}
            {directionTab('blocks', t('projects.blocks'))}
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
                  placeholder={t('projects.dependencySearchPlaceholder')}
                  aria-label={t('projects.dependencySearchPlaceholder')}
                  className="w-full pl-9 pr-3 h-10 text-sm rounded-lg border focus:outline-none focus:border-[rgb(var(--color-accent-solid))] transition-colors"
                  style={{
                    borderColor: 'rgb(var(--color-border))',
                    backgroundColor: 'rgb(var(--color-background))',
                    color: 'rgb(var(--color-text-primary))',
                  }}
                />
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
              {candidates.length === 0 ? (
                <p className="py-6 text-center text-sm" style={{ color: 'rgb(var(--color-text-muted))' }}>
                  {hasAnyInProject
                    ? t('projects.dependencyNoMatch')
                    : t('projects.dependencyNoCandidate')}
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
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_META[item.priority]?.dot ?? 'bg-slate-400'}`}
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
                                ? t('projects.dependencyAlreadyLinked')
                                : t('projects.dependencyWouldCycle')}
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
              {can['task.create'] && (
                <button
                  type="button"
                  onClick={() => {
                    setNewName(query.trim());
                    setMode('create');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[rgb(var(--color-accent-solid))] hover:opacity-80 transition-opacity"
                >
                  <Plus size={14} aria-hidden="true" />
                  {t('projects.dependencyCreateNew')}
                </button>
              )}
              <div className="flex-1" />
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={busy}>
                {t('common.cancel')}
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
                  ? tp('projects.dependencyAddCount', selected.length, { count: selected.length })
                  : t('projects.dependencyAddEmpty')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
              <div>
                <label
                  htmlFor="dep-new-name"
                  className="block text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'rgb(var(--color-text-secondary))' }}
                >
                  {t('projects.dependencyCreateName')}
                </label>
                <input
                  id="dep-new-name"
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void submitCreated();
                    }
                  }}
                  maxLength={200}
                  placeholder={t('projects.dependencyCreatePlaceholder')}
                  className="w-full px-3 h-10 text-sm rounded-lg border focus:outline-none focus:border-[rgb(var(--color-accent-solid))] transition-colors"
                  style={{
                    borderColor: 'rgb(var(--color-border))',
                    backgroundColor: 'rgb(var(--color-background))',
                    color: 'rgb(var(--color-text-primary))',
                  }}
                />
              </div>

              <div>
                <span
                  className="block text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'rgb(var(--color-text-secondary))' }}
                >
                  {t('projects.dependencyPriority')}
                </span>
                <div className="flex gap-1.5">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewPriority(p)}
                      aria-pressed={newPriority === p}
                      aria-label={PRIORITY_META[p].label}
                      className={`flex-1 h-9 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                        newPriority === p
                          ? 'border-[rgb(var(--color-accent-solid))] bg-[rgb(var(--color-accent-solid))]/10'
                          : 'border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-hover))]'
                      }`}
                      style={{ color: 'rgb(var(--color-text-primary))' }}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_META[p].dot}`} aria-hidden="true" />
                      P{p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="dep-new-deadline"
                  className="block text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'rgb(var(--color-text-secondary))' }}
                >
                  {t('projects.dependencyDeadline')}
                </label>
                {/* Calendrier COSMO, jamais le picker natif : il ignore le
                    thème et la locale de l'app. */}
                <DatePicker
                  id="dep-new-deadline"
                  value={newDeadline}
                  onChange={setNewDeadline}
                  className="h-10"
                  // Cette popup monte déjà à z-[10000] : le calendrier
                  // qu'elle ouvre a besoin du cran au-dessus.
                  popoverClassName="z-[10001]"
                />
              </div>

              <p className="text-xs" style={{ color: 'rgb(var(--color-text-muted))' }}>
                {t('projects.dependencyCreateNote')}
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
                {t('projects.dependencyBackToList')}
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
                {t('projects.dependencyCreateSubmit')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TeamTaskDependencyPicker;
