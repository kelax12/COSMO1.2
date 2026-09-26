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
import { buildOrgEvents } from './org-events.helpers';
import { useTeamTasksBulk } from './use-team-tasks-bulk';
import { TeamTasksBulkLayer } from './team-tasks-bulk.lazy';
import {
  buildActivityItems,
  computeBlocking,
  dependentIdsOf,
  groupByHorizon,
  myKeyResults,
  reviewsForMe,
  summarizeMyProjects,
  unreadMentions,
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
  onToggle: (task: TeamTask) => void;
  onOpenTask: (task: TeamTask) => void;
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
  orgId, currentUserId, open, mine, upcoming, createdInReview,
  activity, deps, notifications, okrs, projects, members, hasAny, estimated,
  agenda, onToggle, onOpenTask,
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
    for (const list of [createdInReview, upcoming, mine]) {
      for (const task of list) map.set(task.id, task);
    }
    return map;
  }, [createdInReview, upcoming, mine]);
  const missingIds = useMemo(() => {
    const wanted = new Set([
      ...dependentIdsOf(open, deps),
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
  const krs = useMemo(() => myKeyResults(okrs, me), [okrs, me]);

  // Prochains événements de l'ENTREPRISE : échéances des tâches ouvertes
  // (tous assignés) + fins d'OKR, 6 max, en frise (OrgEventsTimeline).
  const orgEvents = useMemo(
    () => buildOrgEvents(upcoming, okrs, activeProjectIds, new Map(projects.map((p) => [p.id, p.name]))),
    [upcoming, okrs, activeProjectIds, projects],
  );

  return (
    <>
      {/* « En attente de moi » : revue, mentions, dépendances. */}
      <WaitingForMeCard
        reviews={reviews}
        mentions={mentionRows}
        blocking={blocking}
        members={members}
        onOpenTask={onOpenTask}
      />

      {/* ⚠️ `min-w-0` sur les enfants de cette grille (maquette 105) : un
          élément de grille a `min-width: auto`, qui lui interdit de rétrécir
          sous son contenu. Sans lui, en 390 px, la date de la dernière tâche
          sortait de l'écran et était COUPÉE par `overflow-x-hidden`.
          ⚠️ L'agenda est rendu HORS de toute condition : il vivait dans la
          branche « j'ai des tâches », donc un nouvel arrivant sans tâche ne
          voyait pas non plus son agenda. */}
      <div className="grid lg:grid-cols-2 gap-5 items-start">
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
        {agenda}
      </div>

      {(myProjects.length > 0 || krs.length > 0) && (
        <div className="grid lg:grid-cols-2 gap-5 items-start">
          <MyProjectsCard summaries={myProjects} orgId={orgId} userId={currentUserId} />
          <MyKeyResultsCard items={krs} />
        </div>
      )}

      {bulk.selectMode && (
        <Suspense fallback={null}>
          <TeamTasksBulkLayer bulk={bulk} members={members} projects={projects} />
        </Suspense>
      )}

      {/* Activité de l'équipe : lue dans le journal (mig. 094), 14 jours. */}
      <TeamActivityFeed
        items={activityItems}
        taskById={taskById}
        projects={projects}
        members={members}
        currentUserId={currentUserId}
        onOpenTask={onOpenTask}
      />

      {/* Prochains événements de l'entreprise (reco #2) : visibles par tous. */}
      <OrgEventsTimeline events={orgEvents} />
    </>
  );
};

export default MyWorkSections;
