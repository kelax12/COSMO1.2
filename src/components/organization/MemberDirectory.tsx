import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import {
  useSetMemberRole,
  useOrgMemberPermissions,
  useSetMemberPermissions,
  useMyOrgPermissions,
  useOrgMemberLastActivity,
  canEditPermissionsOf,
  effectivePermissions,
  subtreeOf,
  type OrgMember,
} from '@/modules/organizations';
import { useOrgTeams, useOrgTeamMembers, type OrgTeam } from '@/modules/org-teams';
import {
  useTeamProjects,
  useTeamTasks,
  useCreateTeamTask,
  useUpdateTeamTask,
  type TeamTask,
  type CreateTeamTaskInput,
} from '@/modules/team-projects';
import { downloadCSV } from '@/lib/csv-export';
import { readEntityParam } from './deep-link.helpers';
import MemberSheet from './MemberSheet';
import { MEMBER_TAB_PARAM, type MemberTab } from './member-sheet.helpers';
import AssignTaskSheet from './AssignTaskSheet';
import TeamTaskModal from './TeamTaskModal';
import { useMemberLifecycle } from './MemberLifecycleActions';
import MemberPermissionsSheet from './MemberPermissionsSheet';
import MemberDirectoryRow from './MemberDirectoryRow';
import MemberDirectoryToolbar from './MemberDirectoryToolbar';
import MemberBulkBar from './MemberBulkBar';
import MemberBulkPicker from './MemberBulkPicker';
import { useMemberBulkActions } from './use-member-bulk-actions';
import {
  applyDirectoryFilters,
  directManagers,
  directoryRoleOf,
  readDirectoryFilters,
  writeDirectoryFilters,
  type DirectoryFilters,
} from './member-directory.filters';
import { buildDirectoryCsv } from './member-directory.export';
import { useT } from '@/i18n/useT';
import OrgConfirmDialog from './OrgConfirmDialog';
import { useBulkRun } from './use-bulk-run';
import { getOrgGovernanceRepository } from '@/lib/repository.factory';
import { orgKeys } from '@/modules/organizations';
import { governanceKeys } from '@/modules/organizations/governance.hooks';

interface MemberDirectoryProps {
  orgId: string;
  ownerId: string;
  members: OrgMember[];
  /** auth.users.id de l'utilisateur courant (marque « Vous », calcule le périmètre). */
  currentUserId?: string;
  /** L'utilisateur courant est-il admin ? */
  isAdmin: boolean;
  /** Bouton Inviter : dans la barre, ou seul à droite quand la barre est masquée. */
  inviteAction?: ReactNode;
}

/**
 * Annuaire des membres. Clic sur une ligne → fiche profil (comme la pyramide,
 * #11). Menu « … » réservé aux supérieurs hiérarchiques (#4). La hiérarchie
 * (rôles) ne se modifie plus ici (#1), sauf par l'action groupée « changer de
 * manager », bornée à la portée de l'appelant.
 *
 * Audit « passage à l'échelle » (2026-09-23) : filtres partageables par l'URL,
 * sélection + actions groupées, export CSV (admins), dernière activité.
 */
const MemberDirectory = ({ orgId, ownerId, members, currentUserId, isAdmin, inviteAction }: MemberDirectoryProps) => {
  const { t } = useT('org');
  const setRole = useSetMemberRole();
  // Un admin rétrogradé perd la main sur l'organisation : on le confirme.
  const [demoting, setDemoting] = useState<OrgMember | null>(null);
  const { data: orgPermissions = [] } = useOrgMemberPermissions(orgId);
  const setPermissions = useSetMemberPermissions();
  const myPermissions = useMyOrgPermissions(orgId);

  const { data: orgTeams = [] } = useOrgTeams(orgId);
  const { data: orgTeamMembers = [] } = useOrgTeamMembers(orgId);
  const { data: projects = [] } = useTeamProjects(orgId);
  const { data: tasks = [] } = useTeamTasks(orgId);
  const createTask = useCreateTeamTask(orgId);
  const updateTask = useUpdateTeamTask(orgId);

  // Fiche membre unifiee (item #18) — meme sheet que la pyramide, ouvert sur
  // l'onglet demande. `tab` reste brut : seul `MemberSheet` connait les onglets
  // AUTORISES pour ce membre, et c'est lui qui valide.
  const [sheet, setSheet] = useState<{ member: OrgMember; tab: string | null } | null>(null);
  const [assigning, setAssigning] = useState<OrgMember | null>(null);
  const [creatingTaskFor, setCreatingTaskFor] = useState<{ member: OrgMember; projectId: string | null } | null>(null);
  const [editingPerms, setEditingPerms] = useState<OrgMember | null>(null);

  // ─── URL : deep-link `?member=<id>` et filtres `?dir…` ──────────────
  // `?member=` : on ouvre la fiche puis on retire le paramètre, sinon refermer
  // le sheet le rouvrirait au rendu suivant. Les filtres, eux, RESTENT dans
  // l'URL : c'est ce qui les rend partageables par un lien.
  const [searchParams, setSearchParams] = useSearchParams();
  const deepMemberId = readEntityParam(searchParams, 'member');
  const deepMemberTab = searchParams.get(MEMBER_TAB_PARAM);
  const filters = useMemo(() => readDirectoryFilters(searchParams), [searchParams]);
  const setFilters = (next: DirectoryFilters) =>
    setSearchParams(writeDirectoryFilters(searchParams, next), { replace: true });

  useEffect(() => {
    if (!deepMemberId) return;
    const target = members.find((m) => m.userId === deepMemberId);
    if (!target) return;
    setSheet({ member: target, tab: deepMemberTab });
    const next = new URLSearchParams(searchParams);
    next.delete('member');
    next.delete(MEMBER_TAB_PARAM);
    setSearchParams(next, { replace: true });
  }, [deepMemberId, deepMemberTab, members, searchParams, setSearchParams]);

  const openMember = (member: OrgMember, tab: MemberTab) => setSheet({ member, tab });

  // Périmètre hiérarchique de l'utilisateur courant (miroir de la pyramide).
  const mySubtree = useMemo(
    () => (currentUserId ? subtreeOf(members, currentUserId) : new Set<string>()),
    [members, currentUserId],
  );

  /** Supérieur hiérarchique de `m` ? (admin partout ; manager sur son sous-arbre, jamais soi-même). */
  const isAbove = (m: OrgMember) =>
    m.userId !== currentUserId && (isAdmin || mySubtree.has(m.userId));

  // Droits effectifs de l'utilisateur courant : ils PLAFONNENT ce qu'il peut
  // accorder (miroir de `enforce_org_permission_ceiling`, mig. 115).
  const myEffective = useMemo(() => {
    const me = currentUserId ? members.find((m) => m.userId === currentUserId) : undefined;
    if (!me) return null;
    const mine = orgPermissions.find((o) => o.userId === me.userId) ?? null;
    return effectivePermissions({ member: me, members, overrides: mine });
  }, [members, orgPermissions, currentUserId]);

  const teamsByUser = useMemo(() => {
    const byId = new Map(orgTeams.map((team) => [team.id, team]));
    const map = new Map<string, OrgTeam[]>();
    for (const tm of orgTeamMembers) {
      const team = byId.get(tm.teamId);
      if (!team) continue;
      const arr = map.get(tm.userId) ?? [];
      arr.push(team);
      map.set(tm.userId, arr);
    }
    return map;
  }, [orgTeams, orgTeamMembers]);

  const filteredMembers = useMemo(() => {
    const teamIdsByUser = new Map(
      [...teamsByUser].map(([uid, teams]) => [uid, new Set(teams.map((team) => team.id))]),
    );
    return applyDirectoryFilters(members, filters, {
      ownerId,
      teamIds: new Set(orgTeams.map((team) => team.id)),
      teamIdsByUser,
      now: Date.now(),
    });
  }, [members, filters, ownerId, orgTeams, teamsByUser]);

  const managers = useMemo(() => directManagers(members), [members]);

  // Dernière activité : seulement si l'appelant a quelqu'un à voir (admin, ou
  // manager d'au moins une personne). Le serveur borne de toute façon.
  const { data: lastActivity = [] } = useOrgMemberLastActivity(orgId, {
    enabled: isAdmin || mySubtree.size > 0,
    members,
    viewerId: currentUserId,
  });
  const activityByUser = useMemo(() => new Map(lastActivity.map((a) => [a.userId, a])), [lastActivity]);

  const bulk = useMemberBulkActions({
    orgId,
    members,
    visibleMembers: filteredMembers,
    teams: orgTeams,
    memberships: orgTeamMembers,
    currentUserId,
    isAdmin,
  });

  const exportCsv = () => {
    const { headers, rows } = buildDirectoryCsv(filteredMembers, members, teamsByUser, {
      headers: {
        name: t('directory.export.colName'),
        email: t('directory.export.colEmail'),
        role: t('directory.export.colRole'),
        manager: t('directory.export.colManager'),
        teams: t('directory.export.colTeams'),
        joinedAt: t('directory.export.colJoinedAt'),
      },
      roles: { admin: t('roles.admin'), manager: t('roles.manager'), member: t('roles.member') },
    });
    downloadCSV(t('directory.export.fileName'), headers, rows);
  };

  const activeProjects = projects.filter((p) => !p.archivedAt);

  // M10 : retirer quelqu'un passe par l'assistant de départ, qui transmet
  // tâches, subordonnés, rôles de responsable et KR en une transaction
  // (`offboard_org_member`). L'ancien retrait nu les laissait orphelins.
  const lifecycle = useMemberLifecycle({ orgId, members, ownerId, currentUserId, isAdmin });

  // Suspension EN MASSE (audit du 2026-09-24, étape 4 : « configuration en
  // masse »). Le propriétaire et soi-même sont écartés AVANT l'appel : le
  // serveur (`set_member_access`) les refuserait un par un.
  const accessRun = useBulkRun([orgKeys.all, governanceKeys.all]);
  const setAccessInBulk = (suspended: boolean) => {
    const targets = bulk.selected.filter((m) => m.userId !== ownerId && m.userId !== currentUserId);
    void accessRun.execute(targets, (m) =>
      getOrgGovernanceRepository().setMemberAccess(orgId, m.userId, suspended, m.accessExpiresAt ?? null),
    );
  };

  const assignToMember = (task: TeamTask, member: OrgMember) => {
    if (task.assigneeIds.includes(member.userId)) return;
    updateTask.mutate({ taskId: task.id, input: { assigneeIds: [...task.assigneeIds, member.userId] } });
  };

  const modalCreate = (input: CreateTeamTaskInput) => createTask.mutateAsync(input);

  return (
    <>
      {/* La barre n'apparaît que si l'annuaire compte quelques membres, SAUF si
          un lien arrive déjà filtré : il faut pouvoir voir et retirer le filtre. */}
      {(members.length > 3 || filteredMembers.length !== members.length) ? (
        <MemberDirectoryToolbar
          filters={filters}
          onChange={setFilters}
          teams={orgTeams}
          managers={managers}
          shown={filteredMembers.length}
          total={members.length}
          canSelect={bulk.canSelect}
          selectMode={bulk.selectMode}
          onToggleSelectMode={bulk.toggleSelectMode}
          onExport={isAdmin ? exportCsv : undefined}
          inviteAction={inviteAction}
        />
      ) : inviteAction ? (
        <div className="mb-3 flex justify-end">{inviteAction}</div>
      ) : null}

      {filteredMembers.length === 0 ? (
        <p className="text-sm text-[rgb(var(--color-text-muted))] py-8 text-center">
          {filters.query.trim()
            ? t('directory.noMatch', { query: filters.query.trim() })
            : t('directory.filters.noMatch')}
        </p>
      ) : (
        <ul className={`space-y-2 ${bulk.selectMode ? 'pb-24' : ''}`}>
          {filteredMembers.map((m) => (
            <li key={m.userId}>
              <MemberDirectoryRow
                member={m}
                role={directoryRoleOf(m, members)}
                rights={{
                  isSelf: m.userId === currentUserId,
                  canChangeRole: isAdmin && m.userId !== currentUserId,
                  isAbove: isAbove(m),
                  // Attribuer : seulement dans la portée d'assignation (mig.
                  // 115), sinon le sheet s'ouvrirait pour finir en erreur RLS.
                  canAssign: myPermissions.canAssign(m.userId),
                  canEditPermissions: canEditPermissionsOf({ actorId: currentUserId, actorIsAdmin: isAdmin, target: m, members }),
                }}
                lastActivity={activityByUser.get(m.userId)}
                selectMode={bulk.selectMode}
                selected={bulk.selectedIds.has(m.userId)}
                onToggleSelect={() => bulk.toggle(m.userId)}
                onOpen={(tab) => openMember(m, tab)}
                onSetRole={(role) => (role === 'member' && m.role === 'admin' ? setDemoting(m) : setRole.mutate({ orgId, userId: m.userId, role }))}
                onAssign={() => setAssigning(m)}
                onEditPermissions={() => setEditingPerms(m)}
                lifecycleItems={lifecycle.menuItems(m)}
              />
            </li>
          ))}
        </ul>
      )}

      {bulk.selectMode && (
        <MemberBulkBar
          count={bulk.selected.length}
          visibleCount={filteredMembers.length}
          allVisibleSelected={bulk.allVisibleSelected}
          canAddToTeam={bulk.canAddToTeam}
          canChangeManager={bulk.canChangeManager}
          onToggleAll={bulk.toggleAll}
          onAddToTeam={() => bulk.setPicker('team')}
          onChangeManager={() => bulk.setPicker('manager')}
          canRestrictAccess={isAdmin}
          accessPending={accessRun.pending}
          onSuspend={() => setAccessInBulk(true)}
          onReactivate={() => setAccessInBulk(false)}
          onExit={bulk.exit}
        />
      )}

      {/* Un admin rétrogradé perd la main sur l'organisation : niveau LOURD. */}
      {demoting && (
        <OrgConfirmDialog
          title={t('directory.demoteTitle', { name: demoting.displayName })}
          description={t('directory.demoteBody', { name: demoting.displayName })}
          confirmLabel={t('directory.demoteConfirm')}
          tone="warning"
          pending={setRole.isPending}
          onConfirm={() =>
            setRole.mutate(
              { orgId, userId: demoting.userId, role: 'member' },
              { onSettled: () => setDemoting(null) },
            )
          }
          onCancel={() => setDemoting(null)}
        />
      )}

      {bulk.picker && (
        <MemberBulkPicker
          mode={bulk.picker}
          selectedCount={bulk.selected.length}
          options={bulk.pickerOptions}
          pending={bulk.pending}
          onPick={bulk.pick}
          onClose={() => bulk.setPicker(null)}
        />
      )}

      {sheet && (
        <MemberSheet
          orgId={orgId}
          member={sheet.member}
          members={members}
          teams={teamsByUser.get(sheet.member.userId) ?? []}
          currentUserId={currentUserId}
          // L'annuaire ne modifie pas la hierarchie (#1) : ces deux actions
          // n'appartiennent qu'a la pyramide.
          canMove={false}
          canAddUnder={false}
          canSeeInsights={isAbove(sheet.member)}
          canSeeAgenda={isAbove(sheet.member)}
          initialTab={sheet.tab}
          onClose={() => setSheet(null)}
          onMove={() => {}}
          onAddUnder={() => {}}
        />
      )}

      {assigning && (
        <AssignTaskSheet
          member={assigning}
          projects={activeProjects}
          tasks={tasks}
          onAssign={(task) => assignToMember(task, assigning)}
          onCreateNew={(projectId) => {
            setCreatingTaskFor({ member: assigning, projectId });
            setAssigning(null);
          }}
          onClose={() => setAssigning(null)}
        />
      )}

      {creatingTaskFor && (
        <TeamTaskModal
          isCreating
          projects={activeProjects.length > 0 ? activeProjects : projects}
          members={members}
          // Plus jamais « le premier projet venu » : celui choisi dans la
          // feuille, sinon la fiche demande (audit des popups, 2026-09-25).
          defaultProjectId={creatingTaskFor.projectId ?? undefined}
          requireProjectChoice={!creatingTaskFor.projectId}
          defaultAssigneeIds={[creatingTaskFor.member.userId]}
          onCreate={modalCreate}
          onClose={() => setCreatingTaskFor(null)}
        />
      )}

      {editingPerms && myEffective && (
        <MemberPermissionsSheet
          member={editingPerms}
          members={members}
          current={orgPermissions.find((o) => o.userId === editingPerms.userId) ?? null}
          actorPermissions={myEffective}
          actorIsAdmin={isAdmin}
          actorAssignTargets={myPermissions.assignTargets}
          pending={setPermissions.isPending}
          onSave={(input) =>
            setPermissions.mutate(
              { orgId, userId: editingPerms.userId, input },
              { onSuccess: () => setEditingPerms(null) },
            )
          }
          onClose={() => setEditingPerms(null)}
        />
      )}

      {lifecycle.dialogs}
    </>
  );
};

export default MemberDirectory;
