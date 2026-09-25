import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  useRemoveMember,
  useSetMemberManager,
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
import ReassignManagerSheet from './ReassignManagerSheet';
import ConfirmRemoveMemberDialog from './ConfirmRemoveMemberDialog';
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

interface MemberDirectoryProps {
  orgId: string;
  ownerId: string;
  members: OrgMember[];
  /** auth.users.id de l'utilisateur courant (marque « Vous », calcule le périmètre). */
  currentUserId?: string;
  /** L'utilisateur courant est-il admin ? */
  isAdmin: boolean;
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
const MemberDirectory = ({ orgId, ownerId, members, currentUserId, isAdmin }: MemberDirectoryProps) => {
  const { t } = useT('org');
  const removeMutation = useRemoveMember();
  const setManager = useSetMemberManager();
  const setRole = useSetMemberRole();
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
  const [creatingTaskFor, setCreatingTaskFor] = useState<OrgMember | null>(null);
  const [removing, setRemoving] = useState<OrgMember | null>(null);
  const [reassigning, setReassigning] = useState<OrgMember | null>(null);
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

  const handleRemove = (m: OrgMember) => {
    // Membre avec subordonnés : choisir d'abord leur nouveau responsable
    // (même parcours que la pyramide — la hiérarchie sous eux est préservée).
    if (members.some((x) => x.managerId === m.userId)) setReassigning(m);
    else setRemoving(m);
  };

  const performRemoveWithReassign = async (member: OrgMember, newManagerId: string | null) => {
    const directs = members.filter((x) => x.managerId === member.userId);
    for (const c of directs) {
      await setManager.mutateAsync({ orgId, userId: c.userId, managerId: newManagerId, silent: true });
    }
    await removeMutation.mutateAsync({ orgId, userId: member.userId });
    setReassigning(null);
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
      {(members.length > 3 || filteredMembers.length !== members.length) && (
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
        />
      )}

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
                  canRemove: isAdmin,
                }}
                lastActivity={activityByUser.get(m.userId)}
                selectMode={bulk.selectMode}
                selected={bulk.selectedIds.has(m.userId)}
                onToggleSelect={() => bulk.toggle(m.userId)}
                onOpen={(tab) => openMember(m, tab)}
                onSetRole={(role) => setRole.mutate({ orgId, userId: m.userId, role })}
                onAssign={() => setAssigning(m)}
                onEditPermissions={() => setEditingPerms(m)}
                onRemove={() => handleRemove(m)}
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
          onExit={bulk.exit}
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
          onCreateNew={() => {
            setCreatingTaskFor(assigning);
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
          defaultProjectId={activeProjects[0]?.id}
          defaultAssigneeIds={[creatingTaskFor.userId]}
          onCreate={modalCreate}
          onClose={() => setCreatingTaskFor(null)}
        />
      )}

      {removing && (
        <ConfirmRemoveMemberDialog
          member={removing}
          pending={removeMutation.isPending}
          onConfirm={() =>
            removeMutation.mutate(
              { orgId, userId: removing.userId },
              { onSettled: () => setRemoving(null) },
            )
          }
          onCancel={() => setRemoving(null)}
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

      {reassigning && (
        <ReassignManagerSheet
          member={reassigning}
          members={members}
          ownerId={ownerId}
          currentUserId={currentUserId}
          onConfirm={(newManagerId) => performRemoveWithReassign(reassigning, newManagerId)}
          onCancel={() => setReassigning(null)}
        />
      )}
    </>
  );
};

export default MemberDirectory;
