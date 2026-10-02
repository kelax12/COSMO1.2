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
import TeamActivityFeed from './TeamActivityFeed';
import OrgEventsTimeline from './OrgEventsTimeline';
import { MyKeyResultsCard, MyProjectsCard, MyTasksCard, WaitingForMeCard } from './MyWorkCards';
import { ActivityDigestCard, WaitingOnOthersCard, WeekLoadCard } from './MyWorkExtraCards';
import { buildOrgEvents } from './org-events.helpers';
import { KpiStrip } from './MyWorkKpiStrip';
import { useTeamTasksBulk } from './use-team-tasks-bulk';
import { TeamTasksBulkLayer } from './team-tasks-bulk.lazy';
import {
  activityDigest,
  buildActivityItems,
  computeBlocking,
  dependencyIdsOf,
  dependentIdsOf,
  groupByHorizon,
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
  overdueCount: number;
  /** Mes tâches terminées sur la fenêtre lue, pour la barre de l'en-tête. */
  doneCount: number;
  nextDeadline: TeamTask | null;
  onToggle: (task: TeamTask) => void;
  onOpenTask: (task: TeamTask) => void;
  onApprove: (task: TeamTask) => void;
  onSendBack: (task: TeamTask) => void;
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
  activity, deps, notifications, okrs, projects, members, hasAny, estimated,
  agenda, overdueCount, doneCount, nextDeadline, onToggle, onOpenTask, onApprove, onSendBack,
}: MyWorkSectionsProps) => {
  const me = currentUserId ?? '';
  const activeProjectIds = useMemo(
    () => new Set(projects.filter((p) => !p.archivedAt).map((p) => p.id)),
    [projects],
  );
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const groups = useMemo(() => groupByHorizon(open), [open]);
  // Actions groupées sur « Mes tâches », comme partout où il y a une liste.
  const bulk = useTeamTasksBulk(orgId, open);
  const activityItems = useMemo(() => buildActivityItems(activity), [activity]);
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
      ...activityItems.map((i) => i.taskId),
      ...mentions.map((n) => n.taskId!),
    ]);
    return [...wanted].filter((id) => !known.has(id)).sort();
  }, [open, deps, activityItems, mentions, known]);
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
  const digest = useMemo(
    () => activityDigest(activity, new Set(mine.map((t) => t.id)), me),
    [activity, mine, me],
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

  return (
    <>
      {/* Refonte du 2026-10-02 (choix 1B 2B 3A 4C 5B 6A 7C 8C 9A 10A 11B + N1 N2) :
          une phrase d'accueil qui absorbe l'ancienne carte de synthèse, puis
          deux colonnes, l'ACTION à gauche (en attente de moi, mes tâches)
          et le CONTEXTE à droite (charge, agenda, KR, projets), puis ce qui
          dépend des autres et la vie de l'équipe en bas.
          ⚠️ `minmax(0, …)` et `min-w-0` sur les colonnes (maquette 105) : un
          élément de grille a `min-width: auto` et débordait en 390 px.
          ⚠️ L'agenda est rendu HORS de toute condition : un nouvel arrivant
          sans tâche doit aussi voir le sien. */}
      <KpiStrip
        firstName={firstName}
        waiting={reviews.length + mentionRows.length + blocking.length}
        open={open.length}
        overdue={overdueCount}
        done={doneCount}
        nextDeadline={nextDeadline}
      />

      <div className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-5 items-start">
        <div className="min-w-0 space-y-5">
          <WaitingForMeCard
            reviews={reviews}
            mentions={mentionRows}
            blocking={blocking}
            members={members}
            onOpenTask={onOpenTask}
            onApprove={onApprove}
            onSendBack={onSendBack}
          />
          <MyTasksCard
            groups={groups}
            openCount={open.length}
            hasAny={hasAny}
            estimated={estimated}
            projectById={projectById}
            onToggle={onToggle}
            onOpenTask={onOpenTask}
            selection={{
              active: bulk.selectMode,
              selectedIds: bulk.selectedIds,
              onToggle: bulk.toggleSelect,
              onStart: () => bulk.setSelectMode(true),
            }}
          />
        </div>
        <div className="min-w-0 space-y-5">
          <WeekLoadCard load={load} />
          {agenda}
          {krs.length > 0 && <MyKeyResultsCard items={krs} />}
          {myProjects.length > 0 && (
            <MyProjectsCard summaries={myProjects} orgId={orgId} userId={currentUserId} people={people} members={members} />
          )}
        </div>
      </div>

      {bulk.selectMode && (
        <Suspense fallback={null}>
          <TeamTasksBulkLayer bulk={bulk} members={members} projects={projects} />
        </Suspense>
      )}

      {/* Ce qui dépend des autres, puis la vie de l'équipe : digest des 24 h
          (fil du journal, mig. 094, replié dessous) et prochains événements de
          l'entreprise en rail vertical. */}
      <div className="grid lg:grid-cols-3 gap-5 items-start">
        <div className="min-w-0">
          <WaitingOnOthersCard entries={waitingOn} members={members} onOpenTask={onOpenTask} />
        </div>
        <div className="min-w-0">
          <ActivityDigestCard digest={digest}>
            <TeamActivityFeed
              bare
              items={activityItems}
              taskById={taskById}
              projects={projects}
              members={members}
              currentUserId={currentUserId}
              onOpenTask={onOpenTask}
            />
          </ActivityDigestCard>
        </div>
        <div className="min-w-0">
          <OrgEventsTimeline events={orgEvents} />
        </div>
      </div>
    </>
  );
};

export default MyWorkSections;
