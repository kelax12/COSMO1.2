import { Suspense, useEffect, useMemo, useState } from 'react';
import { parseISO, isPast, isToday, startOfDay, subDays } from 'date-fns';
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
import { useUpcomingEvents } from '@/modules/events';
import { useOrgNotifications, type OrgMember } from '@/modules/organizations';
import { sortOpenTasks, sumEstimatedTime } from './team-projects.helpers';
import TruncatedDataNotice from './TruncatedDataNotice';
import TeamTaskModal from './TeamTaskModal';
import { MyWorkSkeleton } from './OrgLoadingSkeletons';
import type { StartStep } from './MyWorkStartHints';
import { useT } from '@/i18n/useT';
import { lazyWithRetry } from '@/lib/lazy-with-retry';
import { loadLayout, saveLayout, type PlacedWidget } from './apercu-widgets';
import { TEMPLATES, templateForRole } from './apercu-templates';
import { postponedDeadline } from './apercu-new-widgets.helpers';

interface MyWorkTabProps {
  orgId: string;
  members: OrgMember[];
  currentUserId?: string;
  /**
   * Droit `task.editAny`, dérivé par la PAGE comme pour Projets et Tâches.
   * Transmis tel quel à la modale de tâche : il y ouvre les dépendances.
   */
  canEditDependencies: boolean;
}


/**
 * Onglet Aperçu (#7) — MON travail dans l'entreprise : mes tâches assignées
 * (cochables), mes échéances à venir et mes projets. Les statistiques
 * collectives ont déménagé dans l'onglet Statistiques (#13, managers/admin).
 */


// Blocs peints de l'Aperçu : chunk à part, PRÉCHARGÉ dès l'évaluation de ce
// module, donc en parallèle des requêtes (cf. `MyWorkSections` pour le pourquoi
// de ce découpage). Sans catalogue demandé : ceux de /entreprise sont déclarés
// par la ROUTE (`App.tsx`), la seule que lit `lazy-namespaces.guard.test.ts`.
const loadSections = () => import('./MyWorkSections');
const MyWorkSections = lazyWithRetry(loadSections);
void loadSections().catch(() => { /* rejoué par lazyWithRetry au rendu */ });
// Checklist de démarrage et accueil du nouvel arrivant : rares, donc à la demande.
const MyWorkStartHints = lazyWithRetry(() => import('./MyWorkStartHints'));

// Dupliqué de `isOverdue` (my-work.helpers) exprès : l'importer tirerait les
// helpers de l'Aperçu hors du chunk paresseux `MyWorkSections`.
const isOverdue = (t: TeamTask): boolean => {
  if (t.completed || !t.deadline) return false;
  const d = parseISO(t.deadline);
  return isPast(d) && !isToday(d);
};

/** Widgets qui lisent les tâches ouvertes de toute l'organisation. */
const TEAM_TASK_WIDGETS = new Set<PlacedWidget['id']>(['teamLoad', 'teamOverdue', 'orgHealth', 'riskProjects', 'unassigned']);

/** Fenêtre du fil d'activité : 14 jours, comme avant le passage au journal. */
const ACTIVITY_DAYS = 14;

const MyWorkTab = ({ orgId, members, currentUserId, canEditDependencies }: MyWorkTabProps) => {
  const { t: tOrgAdmin } = useT('orgAdmin');
  const me = currentUserId ?? '';
  const { data: projects = [], isLoading: loadingProjects } = useTeamProjects(orgId);
  const { data: okrs = [], isLoading: loadingOkrs } = useTeamOKRs(orgId);
  const { data: teams = [], isLoading: loadingTeams } = useOrgTeams(orgId);
  const upcomingEvents = useUpcomingEvents(5);
  const updateTask = useUpdateTeamTask(orgId);
  const [editingTask, setEditingTask] = useState<TeamTask | null>(null);
  // Disposition des widgets : une par entreprise et par personne. Relue quand
  // l'une ou l'autre change (la session peut arriver après le premier rendu).
  // Sans disposition enregistrée : le modèle du rôle (admin, chef d'équipe, membre).
  const roleIsAdmin = members.find((m) => m.userId === currentUserId)?.role === 'admin';
  const roleTemplateId = templateForRole(roleIsAdmin);
  const roleTemplate = TEMPLATES[roleTemplateId];
  const [layout, setLayout] = useState<PlacedWidget[]>(() => loadLayout(orgId, me, roleTemplate));
  useEffect(() => { setLayout(loadLayout(orgId, me, roleTemplate)); }, [orgId, me, roleTemplate]);
  const changeLayout = (next: PlacedWidget[]) => {
    setLayout(next);
    saveLayout(orgId, me, next);
  };

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
  // Tâches ouvertes de l'organisation (ce que la RLS me laisse voir), pour les
  // widgets d'équipe et d'administration. Lues seulement si l'un d'eux est
  // posé, ou pour un admin : un membre ne paie pas cette lecture.
  const needsTeamTasks = roleIsAdmin
    || layout.some((w) => TEAM_TASK_WIDGETS.has(w.id));
  const { data: teamOpen = [] } = useTeamTaskSlice(
    orgId,
    { completed: false, limit: TEAM_TASKS_READ_LIMIT },
    { enabled: needsTeamTasks },
  );
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
  const postpone = (task: TeamTask) =>
    updateTask.mutate({ taskId: task.id, input: { deadline: postponedDeadline(task.deadline) } });
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
      {(showChecklist || showNewcomerHints) && (
        <Suspense fallback={null}>
          <MyWorkStartHints steps={startSteps} showChecklist={showChecklist} showNewcomerHints={showNewcomerHints} />
        </Suspense>
      )}

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
          agendaEvents={upcomingEvents}
          overdueCount={overdue.length}
          doneCount={done.length}
          nextDeadline={nextDeadline}
          onToggle={toggleComplete}
          onOpenTask={setEditingTask}
          onApprove={approve}
          onSendBack={sendBack}
          layout={layout}
          onLayoutChange={changeLayout}
          onPostpone={postpone}
          teamOpen={teamOpen}
          roleTemplate={roleTemplateId}
        />
      </Suspense>

      {editingTask && (
        <TeamTaskModal
          task={editingTask}
          projects={activeProjects}
          members={members}
          onUpdate={modalUpdate}
          // Même valeur que Projets et Tâches : c'est la PAGE qui la dérive.
          canEditDependencies={canEditDependencies}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  );
};

export default MyWorkTab;
