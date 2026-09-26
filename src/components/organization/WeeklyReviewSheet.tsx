import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, TrendingUp, TrendingDown, Minus, CalendarClock, AlertTriangle, ArrowRight, Gauge, Save, History } from 'lucide-react';
import { parseISO } from 'date-fns';
import { useOrgActivity, useTeamProjects, useTeamProjectTeams, type TeamTask } from '@/modules/team-projects';
import { useOrgTeams, useOrgTeamMembers } from '@/modules/org-teams';
import type { OrgMember } from '@/modules/organizations';
import { useSaveWeeklyReview, useWeeklyReviews } from '@/modules/organizations/governance.hooks';
import { formatDate } from '@/i18n/format';
import { formatDuration } from './team-projects.helpers';
import { buildWeeklyReview, reviewSummary, reviewWindow, scopeReview, type ReviewScope } from './weekly-review.helpers';
import { teamsOfProject } from './team-audience.helpers';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';

interface WeeklyReviewSheetProps {
  orgId: string;
  /** Tâches du périmètre du lecteur (admin : toute l'org ; manager : son sous-arbre). */
  tasks: TeamTask[];
  /** Membres du même périmètre. */
  members: OrgMember[];
  /** Périmètre de base : toute l'organisation (admin) ou le sous-arbre (manager). */
  baseScope: 'org' | 'subtree';
  /** Ouvre une tâche dans l'onglet Projets — c'est ce qui fait la décision. */
  onOpenTask: (taskId: string) => void;
  onClose: () => void;
}

/** `team:<id>` / `project:<id>` / `base` — la valeur du sélecteur. */
const scopeFromValue = (value: string): ReviewScope => {
  if (value.startsWith('team:')) return { kind: 'team', teamId: value.slice(5) };
  if (value.startsWith('project:')) return { kind: 'project', projectId: value.slice(8) };
  return { kind: 'base' };
};

const Step = ({ index, title, children }: { index: number; title: string; children: React.ReactNode }) => (
  <section className="border-t border-[rgb(var(--color-border))] pt-4 first:border-t-0 first:pt-0">
    <h3 className="flex items-center gap-2 text-sm font-bold text-[rgb(var(--color-text-primary))] mb-3">
      <span className="w-5 h-5 rounded-full bg-[rgb(var(--color-hover))] text-caption font-bold flex items-center justify-center text-[rgb(var(--color-text-muted))] shrink-0">
        {index}
      </span>
      {title}
    </h3>
    {children}
  </section>
);

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs text-[rgb(var(--color-text-muted))] py-2">{children}</p>
);

/**
 * Revue hebdomadaire d'équipe (item #26).
 *
 * Un flux guidé en 4 étapes, pas un tableau de bord de plus : la 4ᵉ étape
 * produit des décisions cliquables. C'est la seule chose qui distingue une
 * revue d'une page de statistiques — sans elle, le manager repart avec des
 * chiffres et rien à faire de sa réunion.
 *
 * Tout le calcul est dans `weekly-review.helpers.ts`, testé.
 */
const WeeklyReviewSheet = ({ orgId, tasks: baseTasks, members: baseMembers, baseScope, onOpenTask, onClose }: WeeklyReviewSheetProps) => {
  const { t } = useT('org');
  const { t: ta, tp: tpa } = useT('orgAdmin');
  // ─── Périmètre (audit du 2026-09-24) : équipe ou projet, en plus du ─────
  // périmètre de base. Un périmètre RESTREINT, jamais n'élargit.
  const { data: teams = [] } = useOrgTeams(orgId);
  const { data: memberships = [] } = useOrgTeamMembers(orgId);
  const { data: projects = [] } = useTeamProjects(orgId);
  const { data: projectTeams = [] } = useTeamProjectTeams(orgId);
  const [scopeValue, setScopeValue] = useState('base');
  const scope = useMemo(() => scopeFromValue(scopeValue), [scopeValue]);
  const reviewProjects = useMemo(() => {
    const ids = new Set(baseTasks.map((task) => task.projectId));
    return projects.filter((p) => ids.has(p.id) && !p.archivedAt);
  }, [baseTasks, projects]);
  const { tasks, members } = useMemo(() => scopeReview({
    scope,
    tasks: baseTasks,
    members: baseMembers,
    memberships,
    teamsOfProject: (projectId) => {
      const project = projects.find((p) => p.id === projectId);
      return project ? teamsOfProject(project, projectTeams) : new Set<string>();
    },
  }), [scope, baseTasks, baseMembers, memberships, projects, projectTeams]);

  // ─── Enregistrement et historique (mig. 162) ────────────────────────
  const [note, setNote] = useState('');
  const save = useSaveWeeklyReview(orgId);
  const { data: allReviews = [] } = useWeeklyReviews(orgId);
  const scopeType = scope.kind === 'base' ? baseScope : scope.kind;
  const scopeId = scope.kind === 'team' ? scope.teamId : scope.kind === 'project' ? scope.projectId : null;
  const history = allReviews.filter((r) => r.scopeType === scopeType && (r.scopeId ?? null) === scopeId).slice(0, 8);

  // Borne STABLE d'un rendu à l'autre : elle entre dans la clé de cache de
  // `useOrgActivity`. Un `new Date()` recalculé à chaque rendu produirait une
  // requête par rendu.
  const since = useMemo(() => reviewWindow().lastWeekStart.toISOString(), []);
  const { data: activity = [] } = useOrgActivity(orgId, since);

  const review = useMemo(
    () => buildWeeklyReview(tasks, members, activity),
    [tasks, members, activity],
  );

  const { velocityChange } = review;
  const VelocityIcon = velocityChange === null || velocityChange === 0
    ? Minus
    : velocityChange > 0 ? TrendingUp : TrendingDown;
  const velocityTone = velocityChange === null || velocityChange === 0
    ? 'text-[rgb(var(--color-text-muted))]'
    : velocityChange > 0 ? 'text-emerald-500' : 'text-red-500';

  // C-53 — piege de focus, restitution du focus au declencheur, Echap et
  // semantique ARIA. Le nom accessible est celui que la surface portait deja.
  const { ref: modalA11yRef, dialogProps: modalA11yProps } = useModalA11y<HTMLDivElement>({
    open: true,
    onClose: onClose,
    label: ta('weeklyReview.title'),
  });

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-t-[24px] sm:rounded-2xl w-full sm:max-w-lg max-h-[88vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        ref={modalA11yRef}
        {...modalA11yProps}
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-3 border-b border-[rgb(var(--color-border))] shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[rgb(var(--color-text-primary))]">
              {ta('weeklyReview.title')}
            </h2>
            <p className="text-xs text-[rgb(var(--color-text-muted))]">{ta('weeklyReview.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] shrink-0"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          <label className="flex items-center gap-2 text-xs text-[rgb(var(--color-text-muted))]">
            <span className="font-semibold">{ta('weeklyReview.scopeLabel')}</span>
            <select
              value={scopeValue}
              onChange={(e) => setScopeValue(e.target.value)}
              className="flex-1 min-w-0 h-9 px-2 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-sm text-[rgb(var(--color-text-primary))]"
            >
              <option value="base">{ta(baseScope === 'org' ? 'weeklyReview.scopeOrg' : 'weeklyReview.scopeSubtree')}</option>
              {teams.length > 0 && (
                <optgroup label={ta('weeklyReview.scopeTeams')}>
                  {teams.map((team) => <option key={team.id} value={`team:${team.id}`}>{team.name}</option>)}
                </optgroup>
              )}
              {reviewProjects.length > 0 && (
                <optgroup label={ta('weeklyReview.scopeProjects')}>
                  {reviewProjects.map((p) => <option key={p.id} value={`project:${p.id}`}>{p.name}</option>)}
                </optgroup>
              )}
            </select>
          </label>

          {/* 1. Ce qui a avancé */}
          <Step index={1} title={ta('weeklyReview.progressTitle')}>
            <div className="flex items-center gap-4">
              <p className="text-3xl font-bold text-[rgb(var(--color-text-primary))] tabular-nums">
                {review.completedThisWeek}
              </p>
              <div className="min-w-0">
                <p className={`text-sm font-semibold inline-flex items-center gap-1 ${velocityTone}`}>
                  <VelocityIcon size={15} aria-hidden="true" />
                  {/* `null` n'est pas 0 % : une équipe qui passe de 0 à 5 n'a
                      pas fait « +∞ % », il n'y a simplement rien à comparer. */}
                  {velocityChange === null
                    ? ta('weeklyReview.noComparison')
                    : ta('weeklyReview.vsLastWeek', { change: velocityChange > 0 ? `+${velocityChange}` : String(velocityChange) })}
                </p>
                <p className="text-xs text-[rgb(var(--color-text-muted))]">
                  {tpa('weeklyReview.lastWeekCount', review.completedLastWeek)}
                </p>
              </div>
            </div>
          </Step>

          {/* 2. Ce qui a dérapé */}
          <Step index={2} title={ta('weeklyReview.slippedTitle')}>
            {review.slipped.length === 0 ? (
              <Empty>{ta('weeklyReview.slippedEmpty')}</Empty>
            ) : (
              <ul className="space-y-1.5">
                {review.slipped.map((s) => (
                  <li key={s.taskId}>
                    <button
                      type="button"
                      onClick={() => onOpenTask(s.taskId)}
                      className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-[rgb(var(--color-border))] hover:border-indigo-400 hover:bg-[rgb(var(--color-hover))] transition-colors text-left"
                    >
                      <CalendarClock size={15} className="text-amber-500 shrink-0" aria-hidden="true" />
                      <span className="text-sm text-[rgb(var(--color-text-primary))] flex-1 truncate">{s.name}</span>
                      <span className="text-caption text-[rgb(var(--color-text-muted))] tabular-nums shrink-0">
                        {s.from} → {s.to}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Step>

          {/* 3. Qui est en tension */}
          <Step index={3} title={ta('weeklyReview.tensionTitle')}>
            {review.overloaded.length === 0 ? (
              <Empty>{ta('weeklyReview.tensionEmpty')}</Empty>
            ) : (
              <ul className="space-y-1.5">
                {review.overloaded.map((m) => (
                  <li
                    key={m.userId}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl border border-red-300/60 bg-red-50/40 dark:bg-red-900/10"
                  >
                    <Gauge size={15} className="text-red-500 shrink-0" aria-hidden="true" />
                    <span className="text-sm font-semibold text-[rgb(var(--color-text-primary))] flex-1 truncate">
                      {m.name}
                    </span>
                    <span className="text-caption text-[rgb(var(--color-text-muted))] tabular-nums shrink-0">
                      {ta('weeklyReview.workload', {
                        duration: formatDuration(m.estimatedMinutes),
                        open: m.open,
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Step>

          {/* 4. Arbitrages — la seule section qui produit des décisions. */}
          <Step index={4} title={ta('weeklyReview.arbitrageTitle')}>
            {review.needsArbitration.length === 0 ? (
              <Empty>{ta('weeklyReview.arbitrageEmpty')}</Empty>
            ) : (
              <>
                <p className="text-xs text-[rgb(var(--color-text-muted))] mb-2">
                  {ta('weeklyReview.arbitrageHint')}
                </p>
                <ul className="space-y-1.5">
                  {review.needsArbitration.map((task) => (
                    <li key={task.id}>
                      <button
                        type="button"
                        onClick={() => onOpenTask(task.id)}
                        className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-[rgb(var(--color-border))] hover:border-indigo-400 hover:bg-[rgb(var(--color-hover))] transition-colors text-left"
                      >
                        <AlertTriangle size={15} className="text-red-500 shrink-0" aria-hidden="true" />
                        <span className="text-sm text-[rgb(var(--color-text-primary))] flex-1 truncate">{task.name}</span>
                        <span className="text-caption font-semibold text-red-500 tabular-nums shrink-0">
                          {task.deadline}
                        </span>
                        <ArrowRight size={14} className="text-[rgb(var(--color-text-muted))] shrink-0" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Step>

          {/* Enregistrer : la revue n'était pas gardée, on ne retrouvait pas
              la semaine d'avant. On fige des NOMBRES et une note, jamais les
              noms des personnes en tension. */}
          <section className="border-t border-[rgb(var(--color-border))] pt-4 space-y-2">
            <label htmlFor="weekly-review-note" className="block text-xs font-semibold text-[rgb(var(--color-text-secondary))]">
              {ta('weeklyReview.noteLabel')}
            </label>
            <textarea
              id="weekly-review-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder={ta('weeklyReview.notePlaceholder')}
              className="w-full px-3 py-2 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm text-[rgb(var(--color-text-primary))] resize-none"
            />
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => save.mutate(
                { scopeType, scopeId, summary: reviewSummary(review), note },
                { onSuccess: () => setNote('') },
              )}
              className="inline-flex items-center gap-1.5 min-h-10 px-3 rounded-xl text-sm font-semibold bg-[rgb(var(--color-accent))] text-[rgb(var(--color-background))] hover:opacity-90 disabled:opacity-50"
            >
              <Save size={14} aria-hidden="true" /> {ta('weeklyReview.save')}
            </button>
          </section>

          <section className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-bold text-[rgb(var(--color-text-primary))]">
              <History size={15} aria-hidden="true" /> {ta('weeklyReview.historyTitle')}
            </h3>
            {history.length === 0 ? (
              <Empty>{ta('weeklyReview.historyEmpty')}</Empty>
            ) : (
              <ul className="space-y-1.5">
                {history.map((r) => (
                  <li key={r.id} className="rounded-xl border border-[rgb(var(--color-border))] p-2.5">
                    <p className="text-xs font-semibold text-[rgb(var(--color-text-primary))]">
                      {formatDate(parseISO(r.createdAt), { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-caption text-[rgb(var(--color-text-muted))]">
                      {ta('weeklyReview.historyLine', {
                        completed: r.summary.completed ?? 0,
                        slipped: r.summary.slipped ?? 0,
                        blocked: r.summary.blocked ?? 0,
                        overloaded: r.summary.overloaded ?? 0,
                      })}
                    </p>
                    {r.note && <p className="text-xs text-[rgb(var(--color-text-secondary))] mt-1 whitespace-pre-line">{r.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default WeeklyReviewSheet;
