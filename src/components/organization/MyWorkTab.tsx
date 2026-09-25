import { Suspense, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { format, parseISO, isPast, isToday, startOfDay, subDays } from 'date-fns';
import { getDateLocale } from '@/i18n/format';
import {
  CalendarDays, CircleCheck, ChevronRight,
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
import { groupEventsByDay } from './agenda-events.helpers';
import { useOrgNotifications, type OrgMember } from '@/modules/organizations';
import { sortOpenTasks, sumEstimatedTime } from './team-projects.helpers';
import WorkSummaryCard from './WorkSummaryCard';
import TruncatedDataNotice from './TruncatedDataNotice';
import TeamTaskModal from './TeamTaskModal';
import { MyWorkSkeleton } from './OrgLoadingSkeletons';
import { useT } from '@/i18n/useT';
import { buildOrgLink } from './deep-link.helpers';
import { orgSetupPath } from './org-setup.helpers';
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
        <span className="text-caption uppercase mt-0.5" aria-hidden="true">{format(d, 'MMM', { locale: getDateLocale() })}</span>
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
              onClick={() => navigate(buildOrgLink(h.tab))}
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
    // `min-w-0` : second enfant de la même grille que « Mes tâches », donc
    // même borne `min-width: auto` à lever (cf. maquette 105 juste en dessous).
    <div className="min-w-0 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
      <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))] mb-3">
        {t('myWork.agendaSection')}
      </h3>
      {groups.length === 0 ? (
        <p className="text-xs text-[rgb(var(--color-text-muted))] py-4 text-center">{t('myWork.agendaEmpty')}</p>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div key={group.dayKey}>
              <div className={`text-caption font-semibold uppercase tracking-wide mb-1.5 ${
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

const StartChecklist = ({ steps, orgId }: { steps: StartStep[]; orgId: string }) => {
  const { t } = useT('org');
  const navigate = useNavigate();
  const doneCount = steps.filter((s) => s.done).length;
  // L'assistant couvre les trois premières étapes (inviter, équipe, projet) :
  // proposé tant que l'une d'elles reste à faire.
  const wizardUseful = steps.some((s) => !s.done && (s.id === 'invite' || s.id === 'team' || s.id === 'project'));
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
          onClick={() => navigate(orgSetupPath(orgId))}
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

/** Fenêtre du fil d'activité : 14 jours, comme avant le passage au journal. */
const ACTIVITY_DAYS = 14;

const MyWorkTab = ({ orgId, members, currentUserId, isManager }: MyWorkTabProps) => {
  const { t, tp } = useT('org');
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
  // Créations récentes : le journal ne voit que les UPDATE.
  const { data: recentlyCreated = [] } = useTeamTaskSlice(orgId, {
    createdSince: bounds.activitySince, limit: 20,
  });
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
    { id: 'invite', label: t('myWork.stepInvite'), done: members.length > 1, tab: 'members' },
    { id: 'team', label: t('myWork.stepTeam'), done: teams.length > 0, tab: 'members' },
    { id: 'project', label: t('myWork.stepProject'), done: activeProjects.length > 0, tab: 'projects' },
    { id: 'pyramid', label: t('myWork.stepPyramid'), done: members.some((m) => !!m.managerId), tab: 'pyramid' },
    { id: 'okr', label: t('myWork.stepOkr'), done: okrs.length > 0, tab: 'okr' },
  ], [activeProjects.length, members, okrs.length, teams.length, t]);
  const showChecklist = isAdmin && startSteps.some((s) => !s.done);
  // Un membre non-admin sans tâche arrive sur un écran vide : on lui dit au
  // moins où regarder (la checklist ci-dessus lui est fermée).
  const hasAnyTask = myTasks.length !== 0;
  const showNewcomerHints = !isAdmin && !hasAnyTask;

  const toggleComplete = (task: TeamTask) =>
    updateTask.mutate({ taskId: task.id, input: { completed: !task.completed } });
  const modalUpdate = (taskId: string, input: UpdateTeamTaskInput) =>
    updateTask.mutateAsync({ taskId, input });

  // Premier chargement : ne RIEN affirmer. Sans ce garde, l'écran annonçait
  // « Aucune tâche » et une synthèse à 0 % le temps du fetch, et la checklist
  // montrait ses 5 étapes non faites à un admin qui les avait toutes faites.
  if (loadingProjects || (loadingMine && !!me) || loadingOkrs || loadingTeams) {
    return <MyWorkSkeleton label={t('myWork.loading')} />;
  }

  return (
    <div className="space-y-5">
      {mine.length >= TEAM_TASKS_READ_LIMIT && <TruncatedDataNotice limit={TEAM_TASKS_READ_LIMIT} />}
      {showChecklist && <StartChecklist steps={startSteps} orgId={orgId} />}
      {showNewcomerHints && <NewcomerHints />}

      {/* Carte de synthèse « progress-first » */}
      <WorkSummaryCard
        title={tp('myWork.myTasks', myTasks.length)}
        completed={done.length}
        inProgress={Math.max(0, open.length - overdue.length)}
        overdue={overdue.length}
        emptyLabel={t('myWork.emptyLabel')}
        aside={<NextDeadline task={nextDeadline} />}
      />

      <Suspense fallback={<MyWorkSkeleton label={t('myWork.loading')} />}>
        <MyWorkSections
          orgId={orgId}
          currentUserId={currentUserId}
          open={open}
          mine={mine}
          upcoming={upcoming}
          createdInReview={createdInReview}
          recentlyCreated={recentlyCreated}
          activity={activity}
          deps={deps}
          notifications={notifications}
          okrs={okrs}
          projects={projects}
          members={members}
          hasAny={hasAnyTask}
          estimated={myEstimated}
          agenda={<AgendaEventsCard events={upcomingEvents} />}
          onToggle={toggleComplete}
          onOpenTask={setEditingTask}
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
