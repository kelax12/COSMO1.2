import { Suspense, useMemo, type ReactNode } from 'react';
import {
  useTeamTaskSlice,
  type TeamProject,
  type TeamTask,
  type TeamTaskActivity,
  type TeamTaskDependency,
} from '@/modules/team-projects';
import type { TeamOKR } from '@/modules/team-okrs';
import type { OrgMember, OrgNotification } from '@/modules/organizations';
import { MyKeyResultsCard, MyProjectsCard, WaitingForMeCard } from './MyWorkCards';
import { WaitingOnOthersCard, WeekLoadCard } from './MyWorkExtraCards';
import { buildOrgEvents } from './org-events.helpers';
import { useNavigate } from 'react-router';
import type { CalendarEvent } from '@/modules/events';
import ApercuWidgetGrid from './ApercuWidgetGrid';
import type { TemplateId } from './apercu-templates';
import type { PlacedWidget, WidgetId, WidgetSize } from './apercu-widgets';
import { AgendaCompact, KpiCompact, KpiTiles, TasksCompact } from './MyWorkCompactAction';
import { KrsCompact, OrgEventsCompact, ProjectsCompact, WaitingOnCompact } from './MyWorkCompactContext';
import { buildOrgLink } from './deep-link.helpers';
import { BlockedByMeWidget, DeadlinesWidget } from './MyWorkDeadlineWidgets';
import { ActivityWidget } from './MyWorkActivityWidget';
import { recentItems } from './apercu-activity.helpers';
import { MentionsWidget, NoteWidget } from './MyWorkSocialWidgets';
import { OkrsWidget, TeamLoadWidget, TeamOverdueWidget } from './MyWorkTeamWidgets';
import { InvitationsWidget, OrgHealthWidget, RiskProjectsWidget, UnassignedWidget } from './MyWorkAdminWidgets';
import { isTaskOverdue, myTeam, okrRows, riskyProjects as riskyProjectsOf, teamLoad as teamLoadOf, teamOverdue as teamOverdueOf, unassignedTasks } from './apercu-team.helpers';
import { KpiStrip } from './MyWorkKpiStrip';
import { useTeamTasksBulk } from './use-team-tasks-bulk';
import { TeamTasksBulkLayer } from './team-tasks-bulk.lazy';
import {
  computeBlocking,
  dependencyIdsOf,
  dependentIdsOf,
  myKeyResults,
  projectPeople,
  reviewsForMe,
  summarizeMyProjects,
  unreadMentions,
  waitingOnOthers,
  weekLoad,
} from './my-work.helpers';

export interface MyWorkSectionsProps {
  orgId: string;
  currentUserId?: string;
  /** Mes tâches ouvertes, triées, projets actifs seulement. */
  open: TeamTask[];
  /** Toutes les lignes lues par l'Aperçu, pour nommer ce qu'on connaît déjà. */
  mine: TeamTask[];
  upcoming: TeamTask[];
  createdInReview: TeamTask[];
  /** Tâches ouvertes que j'ai créées (« J'attends quelqu'un »). */
  delegated: TeamTask[];
  activity: TeamTaskActivity[];
  deps: TeamTaskDependency[];
  notifications: OrgNotification[];
  okrs: TeamOKR[];
  projects: TeamProject[];
  members: OrgMember[];
  hasAny: boolean;
  estimated: number;
  /** Carte « Mon agenda », construite par `MyWorkTab`. */
  agenda: ReactNode;
  /** Mêmes événements que la carte agenda, pour les formats petit et moyen. */
  agendaEvents: CalendarEvent[];
  overdueCount: number;
  /** Mes tâches terminées sur la fenêtre lue, pour la barre de l'en-tête. */
  doneCount: number;
  nextDeadline: TeamTask | null;
  onToggle: (task: TeamTask) => void;
  onOpenTask: (task: TeamTask) => void;
  onApprove: (task: TeamTask) => void;
  onSendBack: (task: TeamTask) => void;
  /** Reporter d'un jour (widget « Mes échéances »). */
  onPostpone: (task: TeamTask) => void;
  /** Tâches ouvertes de l'organisation (widgets d'équipe et d'administration). */
  teamOpen: TeamTask[];
  /** Modèle du rôle : recommandé dans le choix des modèles, remis par « Réinitialiser ». */
  roleTemplate: TemplateId;
  /** Disposition des widgets, tenue par `MyWorkTab` (préférence par personne). */
  layout: PlacedWidget[];
  onLayoutChange: (next: PlacedWidget[]) => void;
}

/**
 * Tout ce que l'Aperçu DÉRIVE et PEINT sous la carte de synthèse, chargé à
 * part de `MyWorkTab` (qui garde les lectures, la synthèse et la checklist).
 *
 * ⚠️ Pourquoi ce découpage plutôt que rendre `MyWorkTab` paresseux : essayé le
 * 2026-09-24, et mesuré. `MyWorkTab` importe `TeamTaskModal`, donc `popover` ;
 * en faire une entrée dynamique a déplacé Popper (radix + floating-ui) hors de
 * `dropdown-menu` vers un chunk commun, et le lot `index` a pris 12 ko pour en
 * rendre 3 au chunk de la page. Rien de ce qui est chargé ici ne tire de
 * radix : le graphe des chunks partagés ne bouge pas.
 *
 * Le chunk part dès l'évaluation de `MyWorkTab` (préchargement), en parallèle
 * des requêtes : son attente est couverte par le squelette de données.
 */
const MyWorkSections = ({
  orgId, currentUserId, open, mine, upcoming, createdInReview, delegated,
  activity, deps, notifications, okrs, projects, members,
  agenda, overdueCount, doneCount, nextDeadline, onToggle, onOpenTask, onApprove, onSendBack,
  layout, onLayoutChange, agendaEvents, onPostpone, teamOpen, roleTemplate,
}: MyWorkSectionsProps) => {
  const me = currentUserId ?? '';
  const activeProjectIds = useMemo(
    () => new Set(projects.filter((p) => !p.archivedAt).map((p) => p.id)),
    [projects],
  );
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  // Actions groupées sur « Mes tâches », comme partout où il y a une liste.
  const bulk = useTeamTasksBulk(orgId, open);
  const mentions = useMemo(() => unreadMentions(notifications), [notifications]);

  // Tâches à nommer sans les avoir encore : celles qui attendent les miennes,
  // celles du fil d'activité, celles où l'on m'a cité. Une seule lecture par
  // identifiants, triés pour que la clé de cache ne bouge pas.
  const known = useMemo(() => {
    const map = new Map<string, TeamTask>();
    for (const list of [delegated, createdInReview, upcoming, mine]) {
      for (const task of list) map.set(task.id, task);
    }
    return map;
  }, [delegated, createdInReview, upcoming, mine]);
  const missingIds = useMemo(() => {
    const wanted = new Set([
      ...dependentIdsOf(open, deps),
      ...dependencyIdsOf(open, deps),
      ...recentItems(activity).map((i) => i.taskId),
      ...mentions.map((n) => n.taskId!),
    ]);
    return [...wanted].filter((id) => !known.has(id)).sort();
  }, [open, deps, activity, mentions, known]);
  const { data: byIds = [] } = useTeamTaskSlice(
    orgId,
    { ids: missingIds, limit: 100 },
    { enabled: missingIds.length > 0 },
  );
  const taskById = useMemo(() => {
    const map = new Map(known);
    for (const task of byIds) map.set(task.id, task);
    return map;
  }, [known, byIds]);

  const blocking = useMemo(() => computeBlocking(open, deps, [...taskById.values()], me), [open, deps, taskById, me]);
  const reviews = useMemo(() => reviewsForMe(createdInReview, me), [createdInReview, me]);
  const mentionRows = useMemo(
    () => mentions.flatMap((n) => {
      const task = taskById.get(n.taskId!);
      return task ? [{ notification: n, task }] : [];
    }),
    [mentions, taskById],
  );
  const myProjects = useMemo(() => summarizeMyProjects(open, projects), [open, projects]);
  const people = useMemo(() => projectPeople([...taskById.values()], me), [taskById, me]);
  const krs = useMemo(() => myKeyResults(okrs, me), [okrs, me]);
  const load = useMemo(() => weekLoad(open), [open]);
  const waitingOn = useMemo(
    () => waitingOnOthers(open, deps, [...taskById.values()], delegated, me),
    [open, deps, taskById, delegated, me],
  );
  // La démo nomme le compte courant « Vous » / « You » : « Bonjour Vous. »
  // ne se dit pas, on retombe alors sur le salut neutre.
  const ownName = members.find((m) => m.userId === me)?.displayName.split(' ')[0] || null;
  const firstName = ownName && !/^(vous|you)$/i.test(ownName) ? ownName : null;

  // Prochains événements de l'ENTREPRISE : échéances des tâches ouvertes
  // (tous assignés) + fins d'OKR, 6 max, en frise (OrgEventsTimeline).
  const orgEvents = useMemo(
    () => buildOrgEvents(upcoming, okrs, activeProjectIds, new Map(projects.map((p) => [p.id, p.name]))),
    [upcoming, okrs, activeProjectIds, projects],
  );

  const navigate = useNavigate();
  const waitingCount = reviews.length + mentionRows.length + blocking.length;
  const seeTasks = () => navigate(buildOrgLink('tasks'));
  const myTaskIdSet = useMemo(() => new Set(mine.map((t) => t.id)), [mine]);

  // Équipe et administration (modèles chef d'équipe / admin, 2026-10-19).
  const team = useMemo(() => myTeam(members, me), [members, me]);
  const teamLoads = useMemo(() => teamLoadOf(team, teamOpen), [team, teamOpen]);
  const teamLate = useMemo(() => teamOverdueOf(team, teamOpen), [team, teamOpen]);
  const teamOkrRows = useMemo(() => okrRows(okrs, true), [okrs]);
  const companyOkrRows = useMemo(() => okrRows(okrs, false), [okrs]);
  const risky = useMemo(() => riskyProjectsOf(projects, teamOpen), [projects, teamOpen]);
  const orphans = useMemo(() => unassignedTasks(teamOpen, activeProjectIds), [teamOpen, activeProjectIds]);
  const orgOverdue = useMemo(() => teamOpen.filter((t) => isTaskOverdue(t)).length, [teamOpen]);
  const openOkr = (okrId: string) => navigate(buildOrgLink('okr', { okr: okrId }));


  /**
   * Formats petit et moyen (règle des maquettes du 2026-10-19) : la taille
   * change la présentation, jamais l'accès. Chaque élément garde son action,
   * le reste se parcourt avec ‹ 1/N ›. `undefined` = ce widget n'a pas de
   * rendu compact propre, on retombe sur la carte complète.
   */
  const renderCompact = (id: WidgetId, size: 'small' | 'medium'): ReactNode | undefined => {
    switch (id) {
      case 'kpi':
        return (
          <KpiCompact
            waiting={waitingCount}
            overdue={overdueCount}
            open={open.length}
            done={doneCount}
            nextDeadline={nextDeadline}
            onOpenTask={onOpenTask}
          />
        );
      // « En attente de moi » : petit et moyen reprennent la carte complète (2026-10-20).
      case 'waiting':
        return undefined;
      case 'tasks':
        return <TasksCompact size={size} open={open} projectById={projectById} onToggle={onToggle} onOpenTask={onOpenTask} onSeeAll={seeTasks} />;
      case 'agenda':
        return <AgendaCompact size={size} events={agendaEvents} onSeeAll={() => navigate('/agenda')} />;
      case 'krs':
        return <KrsCompact size={size} items={krs} onOpen={(okrId) => navigate(buildOrgLink('okr', { okr: okrId }))} />;
      case 'projects':
        return (
          <ProjectsCompact
            size={size}
            summaries={myProjects}
            onOpen={(projectId) => navigate(buildOrgLink('projects', { project: projectId }))}
            onSeeAll={() => navigate(buildOrgLink('projects'))}
          />
        );
      case 'waitingOn':
        return <WaitingOnCompact size={size} entries={waitingOn} members={members} onOpenTask={onOpenTask} />;
      case 'activity':
        return <ActivityWidget size={size} activity={activity} myTaskIds={myTaskIdSet} me={me} members={members} taskById={taskById} onOpenTask={onOpenTask} />;
      case 'orgEvents':
        return (
          <OrgEventsCompact
            size={size}
            events={orgEvents}
            onOpen={(e) => {
              if (e.kind === 'okr') { navigate(buildOrgLink('okr', { okr: e.id.slice(4) })); return; }
              const task = taskById.get(e.id.slice(5));
              if (task) onOpenTask(task);
            }}
          />
        );
      default:
        return undefined;
    }
  };

  // Aperçu en widgets (2026-10-19) : chaque bloc d'avant est un widget que
  // la personne retire, ajoute, redimensionne et déplace. `null` = rien à
  // montrer (la grille affiche alors un cadre vide en mode édition).
  // ⚠️ L'agenda reste rendu sans condition : un nouvel arrivant sans tâche
  // doit aussi voir le sien.
  const renderWidget = (id: WidgetId, size: WidgetSize): ReactNode => {
    if (size !== 'large') {
      const compact = renderCompact(id, size);
      if (compact !== undefined) return compact;
    }
    switch (id) {
      case 'orgEvents':
        return (
          <OrgEventsCompact
            size="large"
            events={orgEvents}
            onOpen={(e) => {
              if (e.kind === 'okr') { navigate(buildOrgLink('okr', { okr: e.id.slice(4) })); return; }
              const task = taskById.get(e.id.slice(5));
              if (task) onOpenTask(task);
            }}
          />
        );
      case 'tasks':
        return <TasksCompact size="large" open={open} projectById={projectById} onToggle={onToggle} onOpenTask={onOpenTask} onSeeAll={seeTasks} />;
      case 'deadlines':
        return <DeadlinesWidget size={size} open={open} onToggle={onToggle} onOpenTask={onOpenTask} onPostpone={onPostpone} onSeeAll={seeTasks} />;
      case 'mentions':
        return <MentionsWidget size={size} orgId={orgId} mentions={mentionRows} members={members} onOpenTask={onOpenTask} />;
      case 'blockedByMe':
        return <BlockedByMeWidget size={size} blocking={blocking} members={members} onToggle={onToggle} onOpenTask={onOpenTask} />;
      case 'teamLoad':
        return <TeamLoadWidget size={size} loads={teamLoads} onSeeAll={() => navigate(buildOrgLink('members'))} />;
      case 'teamOverdue':
        return <TeamOverdueWidget size={size} groups={teamLate} onOpenTask={onOpenTask} />;
      case 'teamOkrs':
        return <OkrsWidget size={size} rows={teamOkrRows} scope="team" onOpen={openOkr} />;
      case 'companyOkrs':
        return <OkrsWidget size={size} rows={companyOkrRows} scope="company" onOpen={openOkr} />;
      case 'orgHealth':
        return (
          <OrgHealthWidget
            size={size}
            riskyProjects={risky.length}
            okrsBehind={companyOkrRows.filter((r) => r.behind).length}
            unassigned={orphans.length}
            overdue={orgOverdue}
            onGo={(section) => navigate(buildOrgLink(section))}
          />
        );
      case 'riskProjects':
        return <RiskProjectsWidget size={size} rows={risky} onOpen={(projectId) => navigate(buildOrgLink('projects', { project: projectId }))} />;
      case 'unassigned':
        return <UnassignedWidget size={size} tasks={orphans} projectName={(id) => projectById.get(id)?.name} onOpenTask={onOpenTask} />;
      case 'invitations':
        return <InvitationsWidget size={size} orgId={orgId} onSeeAll={() => navigate(buildOrgLink('members'))} />;
      case 'note':
        return <NoteWidget size={size} orgId={orgId} userId={me} />;
      case 'kpi':
        return (
          <KpiStrip
            firstName={firstName}
            waiting={waitingCount}
            open={open.length}
            overdue={overdueCount}
            done={doneCount}
            nextDeadline={nextDeadline}
          >
            <KpiTiles waiting={waitingCount} overdue={overdueCount} open={open.length} done={doneCount} />
          </KpiStrip>
        );
      case 'waiting':
        return (
          <WaitingForMeCard
            reviews={reviews}
            mentions={mentionRows}
            blocking={blocking}
            members={members}
            onOpenTask={onOpenTask}
            onApprove={onApprove}
            onSendBack={onSendBack}
          />
        );
      case 'load':
        return <WeekLoadCard load={load} />;
      case 'agenda':
        return agenda;
      case 'krs':
        return krs.length > 0 ? <MyKeyResultsCard items={krs} /> : null;
      case 'projects':
        return myProjects.length > 0
          ? <MyProjectsCard summaries={myProjects} orgId={orgId} userId={currentUserId} people={people} members={members} />
          : null;
      case 'waitingOn':
        return <WaitingOnOthersCard entries={waitingOn} members={members} onOpenTask={onOpenTask} />;
      case 'activity':
        return <ActivityWidget size={size} activity={activity} myTaskIds={myTaskIdSet} me={me} members={members} taskById={taskById} onOpenTask={onOpenTask} />;
    }
  };

  return (
    <>
      <ApercuWidgetGrid layout={layout} onChange={onLayoutChange} renderWidget={renderWidget} roleTemplate={roleTemplate} />

      {bulk.selectMode && (
        <Suspense fallback={null}>
          <TeamTasksBulkLayer bulk={bulk} members={members} projects={projects} />
        </Suspense>
      )}
    </>
  );
};

export default MyWorkSections;
