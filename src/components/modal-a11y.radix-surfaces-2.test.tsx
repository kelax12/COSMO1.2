// @vitest-environment jsdom
//
// FRO-01 · suite de `modal-a11y.radix-surfaces.test.tsx` : les surfaces Radix restantes, montees
// REELLES, meme harnais (`modal-a11y.harness.tsx`, 4 controles : entree du focus, piege, Echap +
// retour du focus, role / aria-modal / nom). Seuls les hooks de donnees sont simules.
//
// Non montee ici : la confirmation `AlertDialog` de `src/pages/SettingsPage.tsx` (voir
// `NON_MONTEES` en bas : motif declare, jamais un silence).
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mut = vi.hoisted(() => () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }));
const nothing = vi.hoisted(() => ({ data: [], isLoading: false, isError: false }));

vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/lib/toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock('@/modules/auth/AuthContext', async (orig) => ({
  ...(await orig<object>()),
  useAuth: () => ({ user: { id: 'u1', name: 'Moi', email: 'moi@example.com' } }),
}));
vi.mock('@/modules/organizations', async (orig) => ({
  ...(await orig<object>()),
  useMyOrgPermissions: () => ({ canAssign: () => true, can: () => true, isAdmin: true, isLoading: false }),
  useOrgMembers: () => nothing,
}));
vi.mock('@/modules/org-teams', async (orig) => ({
  ...(await orig<object>()),
  useOrgTeams: () => nothing,
  useOrgTeamMembers: () => nothing,
}));
vi.mock('@/modules/events', async (orig) => ({
  ...(await orig<object>()),
  useCreateGroupEvent: mut,
  useGroupEventsWindow: () => nothing,
}));
vi.mock('@/modules/categories', async (orig) => ({ ...(await orig<object>()), useCategories: () => ({ categories: [], data: [] }) }));
vi.mock('@/modules/tasks', async (orig) => ({
  ...(await orig<object>()),
  useAddTaskDependency: mut,
  useCreateTask: mut,
}));
vi.mock('@/modules/team-projects', async (orig) => ({
  ...(await orig<object>()),
  useAddTaskDependency: mut,
  useCreateTeamTask: mut,
  useSetProjectMember: mut,
  useRemoveProjectMember: mut,
  useAddProjectTeam: mut,
  useTeamProjectTeams: () => nothing,
  useRestoreTeamTask: mut,
  usePurgeTeamTask: mut,
  useTeamTrash: () => ({
    data: [{ id: 't1', name: 'Tache supprimee', projectId: 'p1', deletedAt: new Date().toISOString(), deletedBy: 'u1' }],
    isLoading: false,
  }),
}));
vi.mock('@/modules/team-okrs', async (orig) => ({
  ...(await orig<object>()),
  useTeamOKRTrash: () => nothing,
  useRestoreTeamOKR: mut,
  usePurgeTeamOKR: mut,
  useKRCheckins: () => nothing,
  usePostKRCheckin: mut,
  useSetKRProjects: mut,
  useUpdateTeamKR: mut,
  useCreateTeamOKR: mut,
  useEditTeamOKR: mut,
  useKRProjects: () => nothing,
}));

import { measureSurfaces, WithTrigger, type Surface } from './modal-a11y.harness';
import AssignMembersDialog from './organization/AssignMembersDialog';
import TeamTrashDialog from './organization/TeamTrashDialog';
import { ProjectRolesDialog, ProjectAddDialog } from './organization/ProjectPeopleDialogs';
import KRExecutionDialog from './organization/KRExecutionDialog';
import TeamEventDialog from './organization/TeamEventDialog';
import TeamTaskDependencyPicker from './organization/TeamTaskDependencyPicker';
import TeamOKRModal from './organization/TeamOKRModal';
import OKRModalSheet from './OKRModalSheet';
import { OrgGuideDrawer } from './org-guide/OrgGuideDrawer';
import { PersoGuideDrawer } from './perso-guide/PersoGuideDrawer';
import TaskDependencyPicker from './task-modal/TaskDependencyPicker';
import DescriptionField from './DescriptionField';
import { ORG_PERMISSION_KEYS } from '@/modules/organizations/permissions';

const noop = () => {};
const member = { id: 'm1', userId: 'u2', displayName: 'Membre', name: 'Membre', email: 'm@example.com', role: 'member', suspendedAt: null, accessExpiresAt: null } as never;
const project = { id: 'p1', orgId: 'o1', name: 'Projet', archivedAt: null, isTemplate: false } as never;
const team = { id: 'tm1', name: 'Equipe', parentId: null } as never;
const task = { id: 't1', projectId: 'p1', orgId: 'o1', name: 'Tache', title: 'Tache', assigneeIds: [], status: 'todo', priority: 3 } as never;
const kr = { id: 'k1', title: 'KR', currentValue: 1, targetValue: 10, unit: '', progressMode: 'manual', health: 'on_track' } as never;
const viewer = {
  can: Object.fromEntries(ORG_PERMISSION_KEYS.map((k) => [k, true])),
  isAdmin: true, isOwner: true, customRolesAvailable: true,
} as never;
const guideT = (key: string) => key;

const qc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });
const wrap = (node: React.ReactNode) => <QueryClientProvider client={qc()}>{node}</QueryClientProvider>;

const SURFACES: Surface[] = [
  ['AssignMembersDialog', () => (
    <WithTrigger>{(close) => <AssignMembersDialog orgId="o1" task={task} members={[member]} onSave={noop} onClose={close} />}</WithTrigger>
  )],
  ['TeamTrashDialog', () => <TeamTrashDialog orgId="o1" projects={[project]} members={[member]} />, true],
  ['ProjectRolesDialog', () => (
    <WithTrigger>{(close) => (
      <ProjectRolesDialog open onOpenChange={(o) => { if (!o) close(); }} project={project} projectMembers={[]} viewers={[member]} canManage currentUserId="u1" />
    )}</WithTrigger>
  )],
  ['ProjectAddDialog', () => (
    <WithTrigger>{(close) => <ProjectAddDialog mode="person" onClose={close} project={project} projectMembers={[]} orgMembers={[member]} teams={[team]} />}</WithTrigger>
  )],
  ['KRExecutionDialog', () => (
    <WithTrigger>{(close) => (
      <KRExecutionDialog orgId="o1" kr={kr} links={[]} projects={[project]} statsById={new Map()} members={[member]} canEditStructure onClose={close} />
    )}</WithTrigger>
  )],
  ['TeamEventDialog', () => (
    <WithTrigger>{(close) => <TeamEventDialog open onClose={close} members={[member]} currentUserId="u1" isAdmin />}</WithTrigger>
  )],
  ['TeamTaskDependencyPicker', () => (
    <WithTrigger>{(close) => <TeamTaskDependencyPicker open onClose={close} task={task} tasks={[task]} dependencies={[]} />}</WithTrigger>
  )],
  ['TeamOKRModal', () => wrap(
    <WithTrigger>{(close) => <TeamOKRModal orgId="o1" editingOKR={null} onClose={close} />}</WithTrigger>,
  )],
  ['OKRModalSheet', () => (
    <WithTrigger>{(close) => <OKRModalSheet isOpen onClose={close} categories={[]} editingObjective={null} onSubmit={noop} />}</WithTrigger>
  )],
  ['OrgGuideDrawer', () => (
    <WithTrigger>{(close) => <OrgGuideDrawer open viewer={viewer} onClose={close} onStart={noop} onSeeAdmins={noop} />}</WithTrigger>
  )],
  ['PersoGuideDrawer', () => (
    <WithTrigger>{(close) => <PersoGuideDrawer open t={guideT} onClose={close} onStart={noop} />}</WithTrigger>
  )],
  ['TaskDependencyPicker', () => (
    <WithTrigger>{(close) => <TaskDependencyPicker open onClose={close} task={task} tasks={[task]} dependencies={[]} />}</WithTrigger>
  )],
  // Ouverte par SON PROPRE bouton « Agrandir » : le declencheur est dans le composant.
  ['DescriptionField', () => <DescriptionField value="" onChange={noop} />, true],
];

measureSurfaces('FRO-01 Radix reel (suite)', SURFACES);

// ── Declarees non montees ───────────────────────────────────────────
//
// `src/pages/SettingsPage.tsx` : la surface est un `AlertDialog` de confirmation (suppression de
// compte, d'export, etc.) ouvert par un etat de la page, qui agrege une quinzaine de hooks
// (auth, billing, consentement, import, preferences, categories). La monter en jsdom reviendrait a
// simuler la page entiere : la mesure ne porterait plus sur la surface. Elle est portee par le
// contrat des trois enveloppes (`ui/modal-contract.test.tsx`) et par la garde statique
// (`modal-a11y.guard.test.ts` : `AlertDialogContent` a son `AlertDialogTitle`).
