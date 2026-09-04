import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { format, parseISO, isPast, isToday } from 'date-fns';
import { getDateLocale } from '@/i18n/format';
import {
  ListTodo, CalendarDays, Check, CircleCheck, ChevronRight,
} from 'lucide-react';
import {
  useTeamProjects,
  useTeamTasks,
  useUpdateTeamTask,
  type TeamTask,
  type UpdateTeamTaskInput,
} from '@/modules/team-projects';
import { useTeamOKRs } from '@/modules/team-okrs';
import { useOrgTeams } from '@/modules/org-teams';
import { useUpcomingEvents, type CalendarEvent } from '@/modules/events';
import { groupEventsByDay } from './agenda-events.helpers';
import type { OrgMember } from '@/modules/organizations';
import {
  projectColor, PRIORITY_META, sortOpenTasks, sumEstimatedTime, formatDuration, priorityLabelOf } from './team-projects.helpers';
import WorkSummaryCard from './WorkSummaryCard';
import TeamTaskModal from './TeamTaskModal';
import TeamActivityFeed from './TeamActivityFeed';
import { MyWorkSkeleton } from './OrgLoadingSkeletons';
import OrgEventsTimeline from './OrgEventsTimeline';
import { buildOrgEvents } from './org-events.helpers';
import { useT } from '@/i18n/useT';
import TouchTarget from '@/components/mobile/TouchTarget';

interface MyWorkTabProps {
  orgId: string;
  members: OrgMember[];
  currentUserId?: string;
}

const isOverdue = (t: TeamTask): boolean => {
  if (t.completed || !t.deadline) return false;
  const d = parseISO(t.deadline);
  return isPast(d) && !isToday(d);
};

/** Bloc latéral « prochaine échéance » de la carte de synthèse Aperçu. */
const NextDeadline = ({ task }: { task: TeamTask | null }) => {
  const { t } = useT('org');
  if (!task || !task.deadline) {
    return (
      <div className="flex flex-col items-center text-[rgb(var(--color-text-muted))]">
        <CalendarDays size={22} aria-hidden="true" />
        <span className="text-xs mt-1.5">{t('myWork.upToDate')}</span>
      </div>
    );
  }
  const d = parseISO(task.deadline);
  const late = isOverdue(task);
  return (
    <div className="flex flex-col items-center max-w-[130px]">
      {/* Jour et mois sont empilés visuellement, donc collés dans le
          `textContent` : « 25août ». Un lecteur d'écran lisait ce mot-là.
          La date complète passe en `sr-only`, les deux fragments visuels
          sortent de l'arbre d'accessibilité. */}
      <time
        dateTime={task.deadline}
        className={`flex flex-col items-center leading-none ${late ? 'text-red-500' : 'text-[rgb(var(--color-accent))]'}`}
      >
        <span className="sr-only">{format(d, 'd MMMM yyyy', { locale: getDateLocale() })}</span>
        <span className="text-xl font-bold" aria-hidden="true">{format(d, 'd', { locale: getDateLocale() })}</span>
        <span className="text-[10px] uppercase mt-0.5" aria-hidden="true">{format(d, 'MMM', { locale: getDateLocale() })}</span>
      </time>
      <span className="text-xs text-[rgb(var(--color-text-primary))] mt-2 text-center truncate max-w-full">{task.name}</span>
      <span className="text-xs text-[rgb(var(--color-text-secondary))] mt-0.5">{t('myWork.nextDeadline')}</span>
    </div>
  );
};

/**
 * Onglet Aperçu (#7) — MON travail dans l'entreprise : mes tâches assignées
 * (cochables), mes échéances à venir et mes projets. Les statistiques
 * collectives ont déménagé dans l'onglet Statistiques (#13, managers/admin).
 */
/** Étape de la checklist de démarrage (reco #3, admins d'une org jeune). */
interface StartStep { id: string; label: string; done: boolean; tab: string; }

/**
 * Accueil d'un membre qui vient d'arriver et à qui rien n'est encore assigné.
 *
 * La checklist de démarrage ne s'adresse qu'aux admins — un membre simple
 * atterrissait donc sur un écran vide sans savoir quoi en faire. Trois portes
 * d'entrée suffisent : ce que fait l'équipe, qui est qui, et où vont les
 * objectifs.
 */
const NewcomerHints = () => {
  const { t } = useT('org');
  const navigate = useNavigate();
  const hints: { id: string; label: string; tab: string }[] = [
    { id: 'projects', label: t('myWork.hintProjects'), tab: 'projects' },
    { id: 'members', label: t('myWork.hintMembers'), tab: 'members' },
    { id: 'okr', label: t('myWork.hintOkr'), tab: 'okr' },
  ];
  return (
    <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
      <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{t('myWork.welcomeTitle')}</h3>
      <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1 mb-3">{t('myWork.welcomeIntro')}</p>
      <ul className="space-y-1">
        {hints.map((h) => (
          <li key={h.id}>
            <button
              type="button"
              onClick={() => navigate(`/entreprise?tab=${h.tab}`)}
              className="w-full flex items-center gap-2.5 py-2 px-2 rounded-xl text-left transition-colors hover:bg-[rgb(var(--color-hover))]"
            >
              <ChevronRight size={15} className="text-[rgb(var(--color-text-muted))] shrink-0" aria-hidden="true" />
              <span className="text-sm text-[rgb(var(--color-text-secondary))]">{h.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * Mon agenda — événements à venir de MON calendrier personnel (module
 * `events`), pas les échéances de tâches d'équipe : celles-ci vivent dans la
 * frise « Prochains événements d'entreprise » plus bas. Occupe la colonne
 * droite laissée vacante par le retrait de « Mes échéances ».
 *
 * Rendu groupé par jour (concept B) : un en-tête « Aujourd'hui » ou
 * « jeudi 4 sept. » sépare les jours, l'heure passe en colonne fixe à
 * gauche. Utile dès que plusieurs événements tombent le même jour, ce que la
 * liste plate précédente ne distinguait pas visuellement.
 */
const AgendaEventsCard = ({ events }: { events: CalendarEvent[] }) => {
  const { t } = useT('org');
  const groups = groupEventsByDay(events);
  return (
    <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
      <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))] mb-3">
        {t('myWork.agendaSection')}
      </h3>
      {groups.length === 0 ? (
        <p className="text-xs text-[rgb(var(--color-text-muted))] py-4 text-center">{t('myWork.agendaEmpty')}</p>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.dayKey}>
              <div className={`text-[11px] font-semibold uppercase tracking-wide mb-1.5 ${
                group.isToday ? 'text-[rgb(var(--color-accent))]' : 'text-[rgb(var(--color-text-muted))]'
              }`}
              >
                {group.isToday ? (
                  t('myWork.agendaToday')
                ) : (
                  <span className="capitalize">{format(group.date, 'EEEE d MMM', { locale: getDateLocale() })}</span>
                )}
              </div>
              <ul className="space-y-1">
                {group.events.map((e) => {
                  const start = parseISO(e.start);
                  return (
                    <li key={e.id} className="flex items-center gap-2 py-1 px-2 rounded-lg bg-[rgb(var(--color-hover))]">
                      <span className="text-xs font-semibold text-[rgb(var(--color-text-secondary))] w-11 shrink-0">
                        {format(start, 'HH:mm', { locale: getDateLocale() })}
                      </span>
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: e.color || 'rgb(var(--color-accent))' }}
                        aria-hidden="true"
                      />
                      <span className="text-sm text-[rgb(var(--color-text-primary))] flex-1 truncate">{e.title}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const StartChecklist = ({ steps }: { steps: StartStep[] }) => {
  const { t } = useT('org');
  const navigate = useNavigate();
  const doneCount = steps.filter((s) => s.done).length;
  return (
    <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{t('myWork.getStarted')}</h3>
        <span className="text-xs text-[rgb(var(--color-text-muted))]">{doneCount}/{steps.length}</span>
      </div>
      <ul className="space-y-1">
        {steps.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              disabled={s.done}
              onClick={() => navigate(`/entreprise?tab=${s.tab}`)}
              className={`w-full flex items-center gap-2.5 py-2 px-2 rounded-xl text-left transition-colors ${
                s.done ? 'opacity-60' : 'hover:bg-[rgb(var(--color-hover))]'
              }`}
            >
              <CircleCheck
                size={17}
                className={s.done ? 'text-emerald-500 shrink-0' : 'text-[rgb(var(--color-text-muted))] shrink-0'}
                aria-hidden="true"
              />
              <span className={`flex-1 text-sm ${s.done ? 'line-through text-[rgb(var(--color-text-muted))]' : 'text-[rgb(var(--color-text-primary))]'}`}>
                {s.label}
              </span>
              {!s.done && <ChevronRight size={15} className="text-[rgb(var(--color-text-muted))] shrink-0" aria-hidden="true" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const MyWorkTab = ({ orgId, members, currentUserId }: MyWorkTabProps) => {
  // `tt` est un alias de `t` : dans ce fichier, `t` est aussi le nom de la
  // variable de tâche des callbacks (`open.filter((t) => …)`). `tt` sert là où
  // le traducteur est appelé À L'INTÉRIEUR d'un de ces callbacks, où `t`
  // désigne la tâche.
  const { t, tp } = useT('org');
  const tt = t;
  const { data: projects = [], isLoading: loadingProjects } = useTeamProjects(orgId);
  // `live` : onglet de travail quotidien, on y attend l'arrivée d'une tâche.
  const { data: tasks = [], isLoading: loadingTasks } = useTeamTasks(orgId, undefined, { live: true });
  const { data: okrs = [], isLoading: loadingOkrs } = useTeamOKRs(orgId);
  const { data: teams = [], isLoading: loadingTeams } = useOrgTeams(orgId);
  const upcomingEvents = useUpcomingEvents(5);
  const updateTask = useUpdateTeamTask(orgId);
  const [editingTask, setEditingTask] = useState<TeamTask | null>(null);

  const activeProjects = useMemo(() => projects.filter((p) => !p.archivedAt), [projects]);
  const activeProjectIds = useMemo(() => new Set(activeProjects.map((p) => p.id)), [activeProjects]);

  const mine = useMemo(
    () =>
      currentUserId
        ? tasks.filter((t) => t.assigneeIds.includes(currentUserId) && activeProjectIds.has(t.projectId))
        : [],
    [tasks, currentUserId, activeProjectIds],
  );
  const open = useMemo(() => sortOpenTasks(mine.filter((t) => !t.completed)), [mine]);
  const done = mine.filter((t) => t.completed);
  const overdue = open.filter(isOverdue);
  /** Mon reste à faire estimé — le champ était saisi puis jamais restitué. */
  const myEstimated = useMemo(() => sumEstimatedTime(open), [open]);
  const completionRate = mine.length ? Math.round((done.length / mine.length) * 100) : 0;

  // Échéances à venir (mes tâches ouvertes datées, triées).
  const scheduled = useMemo(
    () => open.filter((t) => !!t.deadline).sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1)),
    [open],
  );

  const nextDeadline = useMemo(
    () => scheduled.find((t) => !isOverdue(t)) ?? scheduled[0] ?? null,
    [scheduled],
  );

  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  // Prochains événements de l'ENTREPRISE : deadlines des tâches d'équipe
  // ouvertes (tous assignés) + échéances des OKR, à venir, 6 max. Zéro modèle
  // d'événement partagé nécessaire. Le rendu est une frise chronologique
  // (OrgEventsTimeline), pas une liste : l'écart entre deux échéances se voit.
  const orgEvents = useMemo(
    () => buildOrgEvents(
      tasks,
      okrs,
      activeProjectIds,
      new Map(projects.map((p) => [p.id, p.name])),
    ),
    [tasks, okrs, activeProjectIds, projects],
  );

  // Checklist de démarrage (reco #3) — admins uniquement, masquée dès que
  // toutes les étapes sont faites.
  //
  // « Créer une équipe » passe AVANT « créer un projet » : un projet rattaché
  // après coup demande un geste de plus, et c'est le rattachement qui porte
  // tout le cloisonnement de visibilité.
  const isAdmin = members.find((m) => m.userId === currentUserId)?.role === 'admin';
  const startSteps = useMemo<StartStep[]>(() => [
    { id: 'invite', label: t('myWork.stepInvite'), done: members.length > 1, tab: 'members' },
    { id: 'team', label: t('myWork.stepTeam'), done: teams.length > 0, tab: 'members' },
    { id: 'project', label: t('myWork.stepProject'), done: activeProjects.length > 0, tab: 'projects' },
    { id: 'pyramid', label: t('myWork.stepPyramid'), done: members.some((m) => !!m.managerId), tab: 'pyramid' },
    { id: 'okr', label: t('myWork.stepOkr'), done: okrs.length > 0, tab: 'okr' },
    // `t` en dépendance : les libellés de la checklist sont traduits ici.
  ], [activeProjects.length, members, okrs.length, teams.length, t]);
  const showChecklist = isAdmin && startSteps.some((s) => !s.done);

  // Un membre non-admin n'a AUCUN guidage : il arrive sur un écran vide sans
  // savoir ce qu'il peut y faire, et la checklist ci-dessus lui est fermée
  // (les 5 étapes demandent des droits d'admin). Tant qu'aucune tâche ne lui
  // est assignée, on lui dit au moins où regarder.
  const showNewcomerHints = !isAdmin && mine.length === 0;

  const toggleComplete = (task: TeamTask) =>
    updateTask.mutate({ taskId: task.id, input: { completed: !task.completed } });
  const modalUpdate = (taskId: string, input: UpdateTeamTaskInput) =>
    updateTask.mutateAsync({ taskId, input });

  // Premier chargement : ne RIEN affirmer. Sans ce garde, l'écran annonçait
  // « Aucune tâche pour l'instant » et une synthèse à 0 % le temps du fetch,
  // et la checklist de démarrage montrait ses 5 étapes non faites à un admin
  // qui les avait toutes faites. Les quatre requêtes comptent : chacune
  // alimente un chiffre visible ici.
  if (loadingProjects || loadingTasks || loadingOkrs || loadingTeams) {
    return <MyWorkSkeleton label={t('myWork.loading')} />;
  }

  return (
    <div className="space-y-5">
      {showChecklist && <StartChecklist steps={startSteps} />}
      {showNewcomerHints && <NewcomerHints />}

      {/* Carte de synthèse « progress-first » */}
      <WorkSummaryCard
        title={tp('myWork.myTasks', mine.length)}
        completed={done.length}
        inProgress={Math.max(0, open.length - overdue.length)}
        overdue={overdue.length}
        completionRate={completionRate}
        emptyLabel={t('myWork.emptyLabel')}
        aside={<NextDeadline task={nextDeadline} />}
      />

      {mine.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--color-hover))] flex items-center justify-center mb-3">
            <ListTodo size={22} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">{t('myWork.emptyTitle')}</p>
          <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1 max-w-xs">
            {t('myWork.emptyHint')}
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-5 items-start">
          {/* Mes tâches */}
          <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
            <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))] mb-3">
              {t('myWork.myTasksSection', { count: open.length })}
              {myEstimated > 0 && (
                // `{' '}` : le `ml-2` sépare visuellement mais pas dans le
                // `textContent`, qui donnait « Mes tâches (3)· 1 h 45 ».
                <>
                  {' '}
                  <span className="ml-2 font-normal text-[rgb(var(--color-text-muted))]">
                    · {formatDuration(myEstimated)}
                  </span>
                </>
              )}
            </h3>
            {open.length === 0 ? (
              <p className="text-xs text-[rgb(var(--color-text-muted))] py-4 text-center">{t('myWork.allDone')}</p>
            ) : (
              <ul className="space-y-1">
                {open.map((t) => {
                  const project = projectById.get(t.projectId);
                  const pColor = project ? projectColor(project.color) : null;
                  const late = isOverdue(t);
                  const priority = PRIORITY_META[t.priority] ?? PRIORITY_META[3];
                  return (
                    <li key={t.id} className="flex items-center gap-2.5 py-1.5 px-1 rounded-lg hover:bg-[rgb(var(--color-hover))] transition-colors">
                      {/* C-57 — la case faisait 24 x 24 px, soit un peu plus de
                          la moitie de la cible WCAG 2.5.5. La BORDURE reste a
                          24 px (c'est elle qu'on voit), la CIBLE fait 44 :
                          l'element interieur porte l'apparence, le bouton porte
                          la zone tactile. Marges negatives pour que la rangee
                          ne grandisse pas. */}
                      <TouchTarget
                        onClick={() => toggleComplete(t)}
                        aria-label={tt('myWork.markDone', { name: t.name })}
                        className="-my-2.5 -ml-2.5"
                      >
                        <span className="w-6 h-6 rounded-md border border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-accent))] flex items-center justify-center transition-colors">
                          {t.completed && <Check size={13} aria-hidden="true" />}
                        </span>
                      </TouchTarget>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${priority.dot}`} role="img" aria-label={priorityLabelOf(t.priority)} title={priorityLabelOf(t.priority)} />
                      {/* C-57 — `min-h-8` = 32 px : large mais trop bas. WCAG
                          2.5.5 demande 44 px dans les DEUX dimensions, et ce
                          n'est pas une cible en ligne (l'exception ne couvre
                          qu'une incise dans une phrase), c'est un bloc. */}
                      <button
                        type="button"
                        onClick={() => setEditingTask(t)}
                        className="flex-1 min-w-0 min-h-touch flex flex-col justify-center text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60 rounded-md"
                      >
                        <span className="block text-sm text-[rgb(var(--color-text-primary))] truncate">{t.name}</span>
                      </button>
                      {project && pColor && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 truncate max-w-[110px] ${pColor.soft}`}>
                          {project.name}
                        </span>
                      )}
                      {t.deadline && (
                        <span className={`text-[10px] shrink-0 ${late ? 'text-red-500 font-semibold' : 'text-[rgb(var(--color-text-muted))]'}`}>
                          {format(parseISO(t.deadline), 'd MMM', { locale: getDateLocale() })}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Mon agenda — espace laissé par le retrait de « Mes échéances ». */}
          <AgendaEventsCard events={upcomingEvents} />
        </div>
      )}

      {/* Activité de l'équipe (reco #11) — dérivée des tâches, 14 derniers jours. */}
      <TeamActivityFeed tasks={tasks} projects={projects} members={members} />

      {/* Prochains événements de l'entreprise (reco #2) — visibles par tous,
          même sans tâche assignée. */}
      <OrgEventsTimeline events={orgEvents} />

      {editingTask && (
        <TeamTaskModal
          task={editingTask}
          projects={activeProjects}
          members={members}
          onUpdate={modalUpdate}
          isManager={isAdmin}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  );
};

export default MyWorkTab;
