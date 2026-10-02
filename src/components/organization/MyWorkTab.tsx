import { Suspense, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { format, parseISO, isPast, isToday, startOfDay, subDays } from 'date-fns';
import { getDateLocale } from '@/i18n/format';
import {
  CircleCheck, ChevronRight, FolderKanban, Target, Users,
} from 'lucide-react';
import {
  useTeamProjects,
  useTeamTaskSlice,
  useTeamTaskDependencies,
  useOrgActivity,
  TEAM_TASKS_READ_LIMIT,
  useUpdateTeamTask,
  type TeamTask,
  type UpdateTeamTaskInput,
} from '@/modules/team-projects';
import { useTeamOKRs } from '@/modules/team-okrs';
import { useOrgTeams } from '@/modules/org-teams';
import { useUpcomingEvents, type CalendarEvent } from '@/modules/events';
import { dayTimeline, groupEventsByDay } from './agenda-events.helpers';
import { useOrgNotifications, type OrgMember } from '@/modules/organizations';
import { sortOpenTasks, sumEstimatedTime } from './team-projects.helpers';
import TruncatedDataNotice from './TruncatedDataNotice';
import TeamTaskModal from './TeamTaskModal';
import { MyWorkSkeleton } from './OrgLoadingSkeletons';
import { useT } from '@/i18n/useT';
import { buildOrgLink } from './deep-link.helpers';
import { lazyWithRetry } from '@/lib/lazy-with-retry';

interface MyWorkTabProps {
  orgId: string;
  members: OrgMember[];
  currentUserId?: string;
  /**
   * Dérivé par la PAGE, comme pour Projets et Tâches. Transmis tel quel à la
   * modale de tâche : c'est ce qui y ouvre les dépendances.
   */
  isManager: boolean;
}


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
  const { t: tOrgAdmin } = useT('orgAdmin');
  const navigate = useNavigate();
  // Maquette 11 B (2026-10-02) : trois cartes à icône plutôt que trois liens,
  // la porte d'entrée se repère avant de se lire.
  const hints: { id: string; label: string; tab: string; Icon: typeof FolderKanban }[] = [
    { id: 'projects', label: tOrgAdmin('myWork.hintProjects'), tab: 'projects', Icon: FolderKanban },
    { id: 'members', label: tOrgAdmin('myWork.hintMembers'), tab: 'members', Icon: Users },
    { id: 'okr', label: tOrgAdmin('myWork.hintOkr'), tab: 'okr', Icon: Target },
  ];
  return (
    <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
      <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{tOrgAdmin('myWork.welcomeTitle')}</h3>
      <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1 mb-3">{tOrgAdmin('myWork.welcomeIntro')}</p>
      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {hints.map(({ id, label, tab, Icon }) => (
          <li key={id} className="min-w-0">
            <button
              type="button"
              onClick={() => navigate(buildOrgLink(tab))}
              className="w-full h-full min-h-touch flex sm:flex-col items-center sm:justify-center gap-2.5 sm:gap-2 p-3 rounded-xl border border-[rgb(var(--color-border))] text-left sm:text-center transition-colors hover:bg-[rgb(var(--color-hover))] hover:border-[rgb(var(--color-accent))]"
            >
              <span className="w-9 h-9 rounded-xl bg-[rgb(var(--color-accent)/0.12)] text-[rgb(var(--color-accent))] flex items-center justify-center shrink-0">
                <Icon size={18} aria-hidden="true" />
              </span>
              <span className="text-sm text-[rgb(var(--color-text-primary))]">{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * Frise de la journée (maquette 5 B, 2026-10-02) : mes rendez-vous du jour
 * posés sur une règle horaire, « maintenant » en trait rouge. On voit d'un
 * coup d'œil où sont les trous pour travailler.
 */
const DayTimelineStrip = ({ events }: { events: CalendarEvent[] }) => {
  const { t: tOrgAdmin } = useT('orgAdmin');
  const { fromHour, toHour, blocks, now } = dayTimeline(events);
  const mid = Math.round((fromHour + toHour) / 2);
  return (
    <div>
      <div className="relative h-12 rounded-lg bg-[rgb(var(--color-hover))]">
        <ul aria-label={tOrgAdmin('myWork.agendaToday')}>
          {blocks.map(({ event, left, width }) => (
            <li
              key={event.id}
              className="absolute top-1.5 bottom-1.5 min-w-0 rounded-md px-1.5 flex items-center overflow-hidden text-[11px] font-semibold text-white"
              style={{ left: `${left}%`, width: `${width}%`, backgroundColor: event.color || 'rgb(var(--color-accent))' }}
              title={`${format(parseISO(event.start), 'HH:mm')} · ${event.title}`}
            >
              <span className="truncate">{event.title}</span>
            </li>
          ))}
        </ul>
        {now !== null && (
          <span className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-red-500" style={{ left: `${now}%` }} aria-hidden="true" />
        )}
      </div>
      <div className="flex justify-between mt-1 text-caption tabular-nums text-[rgb(var(--color-text-muted))]" aria-hidden="true">
        <span>{fromHour} h</span><span>{mid} h</span><span>{toHour} h</span>
      </div>
    </div>
  );
};

/**
 * Mon agenda — événements à venir de MON calendrier personnel (module
 * `events`), pas les échéances de tâches d'équipe : celles-ci vivent dans le
 * rail « Prochains événements d'entreprise » plus bas.
 *
 * Aujourd'hui en frise horaire (maquette 5 B), les jours suivants en liste
 * groupée par jour sous la frise : la frise ne sait montrer qu'une journée.
 */
const AgendaEventsCard = ({ events }: { events: CalendarEvent[] }) => {
  const { t: tOrgAdmin } = useT('orgAdmin');
  const allGroups = groupEventsByDay(events);
  const today = allGroups.find((g) => g.isToday);
  const groups = allGroups.filter((g) => !g.isToday);
  return (
    // `min-w-0` : second enfant de la même grille que « Mes tâches », donc
    // même borne `min-width: auto` à lever (cf. maquette 105 juste en dessous).
    <div className="min-w-0 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
      <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))] mb-3">
        {tOrgAdmin('myWork.agendaSection')}
      </h3>
      <p className="text-caption font-semibold uppercase tracking-wide mb-1.5 text-[rgb(var(--color-accent))]">
        {tOrgAdmin('myWork.agendaToday')}
      </p>
      {today ? (
        <DayTimelineStrip events={today.events} />
      ) : (
        <p className="text-xs text-[rgb(var(--color-text-muted))] py-2">{tOrgAdmin('apercu.agendaFreeToday')}</p>
      )}
      {groups.length === 0 ? (
        !today && <p className="text-xs text-[rgb(var(--color-text-muted))] pt-1">{tOrgAdmin('myWork.agendaEmpty')}</p>
      ) : (
        <div className="space-y-3 mt-3">
          {groups.map((group) => (
            <div key={group.dayKey}>
              <div className={`text-caption font-semibold uppercase tracking-wide mb-1.5 ${
                group.isToday ? 'text-[rgb(var(--color-accent))]' : 'text-[rgb(var(--color-text-muted))]'
              }`}
              >
                {group.isToday ? (
                  tOrgAdmin('myWork.agendaToday')
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

// Entrée de l'assistant de démarrage, écrite en toutes lettres plutôt
// qu'importée d'`org-setup.helpers` : ce module, partagé avec cet écran,
// deviendrait un chunk de plus dans la table de préchargement du chunk
// d'ENTRÉE (mesuré le 2026-09-25). Même forme que `orgSetupPath`, testée là-bas.
const StartChecklist = ({ steps, orgId }: { steps: StartStep[]; orgId: string }) => {
  const { t } = useT('org');
  const { t: tOrgAdmin } = useT('orgAdmin');
  const navigate = useNavigate();
  const doneCount = steps.filter((s) => s.done).length;
  // L'assistant couvre les trois premières étapes (inviter, équipe, projet) :
  // proposé tant que l'une d'elles reste à faire.
  const wizardUseful = steps.some((s) => !s.done && (s.id === 'invite' || s.id === 'team' || s.id === 'project'));
  return (
    <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{tOrgAdmin('myWork.getStarted')}</h3>
        <span className="text-xs text-[rgb(var(--color-text-muted))]">{doneCount}/{steps.length}</span>
      </div>
      <ul className="space-y-1">
        {steps.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              disabled={s.done}
              onClick={() => navigate(buildOrgLink(s.tab))}
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
      {wizardUseful && (
        <button
          type="button"
          onClick={() => navigate(`/entreprise/onboarding?setup=${encodeURIComponent(orgId)}`)}
          className="mt-2 w-full rounded-xl border border-[rgb(var(--color-border))] px-3 py-2 text-sm font-medium text-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-hover))] transition-colors"
        >
          {t('setup.resume')}
        </button>
      )}
    </div>
  );
};

// Blocs peints de l'Aperçu : chunk à part, PRÉCHARGÉ dès l'évaluation de ce
// module, donc en parallèle des requêtes (cf. `MyWorkSections` pour le pourquoi
// de ce découpage). Sans catalogue demandé : ceux de /entreprise sont déclarés
// par la ROUTE (`App.tsx`), la seule que lit `lazy-namespaces.guard.test.ts`.
const loadSections = () => import('./MyWorkSections');
const MyWorkSections = lazyWithRetry(loadSections);
void loadSections().catch(() => { /* rejoué par lazyWithRetry au rendu */ });

// Dupliqué de `isOverdue` (my-work.helpers) exprès : l'importer tirerait les
// helpers de l'Aperçu hors du chunk paresseux `MyWorkSections`.
const isOverdue = (t: TeamTask): boolean => {
  if (t.completed || !t.deadline) return false;
  const d = parseISO(t.deadline);
  return isPast(d) && !isToday(d);
};

/** Fenêtre du fil d'activité : 14 jours, comme avant le passage au journal. */
const ACTIVITY_DAYS = 14;

const MyWorkTab = ({ orgId, members, currentUserId, isManager }: MyWorkTabProps) => {
  const { t: tOrgAdmin } = useT('orgAdmin');
  const me = currentUserId ?? '';
  const { data: projects = [], isLoading: loadingProjects } = useTeamProjects(orgId);
  const { data: okrs = [], isLoading: loadingOkrs } = useTeamOKRs(orgId);
  const { data: teams = [], isLoading: loadingTeams } = useOrgTeams(orgId);
  const upcomingEvents = useUpcomingEvents(5);
  const updateTask = useUpdateTeamTask(orgId);
  const [editingTask, setEditingTask] = useState<TeamTask | null>(null);

  // Bornes figées au montage : elles entrent dans les clés de cache.
  const bounds = useMemo(() => {
    const now = new Date();
    return {
      today: now.toLocaleDateString('en-CA'),
      workingSince: startOfDay(subDays(now, 30)).toISOString(),
      activitySince: startOfDay(subDays(now, ACTIVITY_DAYS)).toISOString(),
    };
  }, []);

  // ── Lectures CIBLÉES (audit du 2026-09-24) ─────────────────────────
  // L'Aperçu lisait tout l'ensemble de travail de l'organisation (plafond
  // 1 000) pour n'en garder que MES tâches : dans une grande organisation, une
  // tâche à moi pouvait tomber sous le plafond. Chaque bloc demande désormais
  // ses lignes au serveur, qui filtre AVANT de plafonner. Elles partent ici,
  // avec la page, pas après le chunk des blocs (`MyWorkSections`).
  // `live` : onglet de travail quotidien, on y attend l'arrivée d'une tâche.
  const { data: mine = [], isLoading: loadingMine } = useTeamTaskSlice(
    orgId,
    { assigneeId: me, openOrCompletedSince: bounds.workingSince },
    { live: true, enabled: !!me },
  );
  // Prochaines échéances de l'ENTREPRISE (frise) : les 30 plus proches.
  const { data: upcoming = [] } = useTeamTaskSlice(orgId, {
    completed: false, deadlineFrom: bounds.today, orderBy: 'deadline', limit: 30,
  });
  // Ce que j'ai confié et qui revient en revue.
  const { data: createdInReview = [] } = useTeamTaskSlice(
    orgId,
    { createdBy: me, status: 'review', limit: 50 },
    { enabled: !!me },
  );
  // Ce que j'ai confié et qui reste ouvert (« J'attends quelqu'un ») : la
  // dérivation ne garde que ce qui dort depuis trois jours.
  const { data: delegated = [] } = useTeamTaskSlice(
    orgId,
    { createdBy: me, completed: false, limit: 50 },
    { enabled: !!me },
  );
  // Créations : dans le journal depuis la mig. 181, plus relues à part.
  const { data: activity = [] } = useOrgActivity(orgId, bounds.activitySince);
  const { data: deps = [] } = useTeamTaskDependencies(orgId);
  const { data: notifications = [] } = useOrgNotifications(orgId);

  const activeProjects = useMemo(() => projects.filter((p) => !p.archivedAt), [projects]);
  const activeProjectIds = useMemo(() => new Set(activeProjects.map((p) => p.id)), [activeProjects]);

  const myTasks = useMemo(() => mine.filter((task) => activeProjectIds.has(task.projectId)), [mine, activeProjectIds]);
  const open = useMemo(() => sortOpenTasks(myTasks.filter((task) => !task.completed)), [myTasks]);
  const done = myTasks.filter((task) => task.completed);
  const overdue = open.filter(isOverdue);
  /** Mon reste à faire estimé — le champ était saisi puis jamais restitué. */
  const myEstimated = useMemo(() => sumEstimatedTime(open), [open]);

  const nextDeadline = useMemo(() => {
    const scheduled = open.filter((task) => !!task.deadline).sort((a, b) => (a.deadline! < b.deadline! ? -1 : 1));
    return scheduled.find((task) => !isOverdue(task)) ?? scheduled[0] ?? null;
  }, [open]);

  // Checklist de démarrage (reco #3) — admins uniquement, masquée dès que
  // toutes les étapes sont faites. « Créer une équipe » passe AVANT « créer
  // un projet » : c'est le rattachement qui porte le cloisonnement.
  const isAdmin = members.find((m) => m.userId === currentUserId)?.role === 'admin';
  const startSteps = useMemo<StartStep[]>(() => [
    { id: 'invite', label: tOrgAdmin('myWork.stepInvite'), done: members.length > 1, tab: 'members' },
    { id: 'team', label: tOrgAdmin('myWork.stepTeam'), done: teams.length > 0, tab: 'members' },
    { id: 'project', label: tOrgAdmin('myWork.stepProject'), done: activeProjects.length > 0, tab: 'projects' },
    { id: 'pyramid', label: tOrgAdmin('myWork.stepPyramid'), done: members.some((m) => !!m.managerId), tab: 'pyramid' },
    { id: 'okr', label: tOrgAdmin('myWork.stepOkr'), done: okrs.length > 0, tab: 'okr' },
  ], [activeProjects.length, members, okrs.length, teams.length, tOrgAdmin]);
  const showChecklist = isAdmin && startSteps.some((s) => !s.done);
  // Un membre non-admin sans tâche arrive sur un écran vide : on lui dit au
  // moins où regarder (la checklist ci-dessus lui est fermée).
  const hasAnyTask = myTasks.length !== 0;
  const showNewcomerHints = !isAdmin && !hasAnyTask;

  const toggleComplete = (task: TeamTask) =>
    updateTask.mutate({ taskId: task.id, input: { completed: !task.completed } });
  // Validation sur place (maquette 2 B) : `completed` et `status` sont
  // synchronisés côté serveur (mig. 091), on écrit les deux pour l'optimiste.
  const approve = (task: TeamTask) =>
    updateTask.mutate({ taskId: task.id, input: { completed: true, status: 'done' } });
  const sendBack = (task: TeamTask) =>
    updateTask.mutate({ taskId: task.id, input: { status: 'in_progress' } });
  const modalUpdate = (taskId: string, input: UpdateTeamTaskInput) =>
    updateTask.mutateAsync({ taskId, input });

  // Premier chargement : ne RIEN affirmer. Sans ce garde, l'écran annonçait
  // « Aucune tâche » et une synthèse à 0 % le temps du fetch, et la checklist
  // montrait ses 5 étapes non faites à un admin qui les avait toutes faites.
  if (loadingProjects || (loadingMine && !!me) || loadingOkrs || loadingTeams) {
    return <MyWorkSkeleton label={tOrgAdmin('myWork.loading')} />;
  }

  return (
    <div className="space-y-5">
      {mine.length >= TEAM_TASKS_READ_LIMIT && <TruncatedDataNotice limit={TEAM_TASKS_READ_LIMIT} />}
      {showChecklist && <StartChecklist steps={startSteps} orgId={orgId} />}
      {showNewcomerHints && <NewcomerHints />}

      <Suspense fallback={<MyWorkSkeleton label={tOrgAdmin('myWork.loading')} />}>
        <MyWorkSections
          orgId={orgId}
          currentUserId={currentUserId}
          open={open}
          mine={mine}
          upcoming={upcoming}
          createdInReview={createdInReview}
          delegated={delegated}
          activity={activity}
          deps={deps}
          notifications={notifications}
          okrs={okrs}
          projects={projects}
          members={members}
          hasAny={hasAnyTask}
          estimated={myEstimated}
          agenda={<AgendaEventsCard events={upcomingEvents} />}
          overdueCount={overdue.length}
          doneCount={done.length}
          nextDeadline={nextDeadline}
          onToggle={toggleComplete}
          onOpenTask={setEditingTask}
          onApprove={approve}
          onSendBack={sendBack}
        />
      </Suspense>

      {editingTask && (
        <TeamTaskModal
          task={editingTask}
          projects={activeProjects}
          members={members}
          onUpdate={modalUpdate}
          // Même valeur que Projets et Tâches : c'est la PAGE qui la dérive.
          // Elle recevait `isAdmin` ici, donc un manager non admin perdait sur
          // l'Aperçu des droits qu'il avait sur les autres écrans.
          isManager={isManager}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  );
};

export default MyWorkTab;
