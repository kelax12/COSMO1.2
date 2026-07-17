import { useMemo, useState } from 'react';
import {
  Shield, UserCog, UserRound, MoreVertical, LogOut,
  ListTodo, CalendarDays, TrendingUp, ClipboardList, Search, X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  useRemoveMember,
  useSetMemberManager,
  isManagerOf,
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
import MemberAvatar from './MemberAvatar';
import MemberProfileSheet from './MemberProfileSheet';
import MemberInsightsSheet, { type InsightsTab } from './MemberInsightsSheet';
import MemberAgendaSheet from './MemberAgendaSheet';
import AssignTaskSheet from './AssignTaskSheet';
import TeamTaskModal from './TeamTaskModal';
import ReassignManagerSheet from './ReassignManagerSheet';
import ConfirmRemoveMemberDialog from './ConfirmRemoveMemberDialog';

interface MemberDirectoryProps {
  orgId: string;
  ownerId: string;
  members: OrgMember[];
  /** auth.users.id de l'utilisateur courant (marque « Vous », calcule le périmètre). */
  currentUserId?: string;
  /** L'utilisateur courant est-il admin ? */
  isAdmin: boolean;
}

// « Manager » n'est pas un rôle stocké : il est dérivé de la pyramide (a ≥ 1
// subordonné). Le badge est purement informatif — la position ne se modifie
// QUE depuis la pyramide (#1 : plus de changement de rôle depuis l'annuaire).
const BADGE_META = {
  admin: { label: 'Admin', Icon: Shield, className: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10' },
  manager: { label: 'Manager', Icon: UserCog, className: 'text-blue-600 dark:text-blue-400 bg-blue-500/10' },
  member: { label: 'Membre', Icon: UserRound, className: 'text-slate-600 dark:text-slate-400 bg-slate-500/10' },
} as const;

/** Normalisation pour la recherche : minuscules, sans accents (diacritiques combinants). */
const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const RoleBadge = ({ kind }: { kind: keyof typeof BADGE_META }) => {
  const { label, Icon, className } = BADGE_META[kind];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${className}`}>
      <Icon size={11} aria-hidden="true" /> {label}
    </span>
  );
};

/**
 * Annuaire des membres. Clic sur une ligne → fiche profil (comme la pyramide,
 * #11). Menu « … » réservé aux supérieurs hiérarchiques (#4) : attribuer une
 * tâche, voir tâches / agenda / contribution ; retrait (admin) confirmé par
 * un vrai modal (#3). La hiérarchie (rôles) ne se modifie plus ici (#1).
 */
const MemberDirectory = ({ orgId, ownerId, members, currentUserId, isAdmin }: MemberDirectoryProps) => {
  const removeMutation = useRemoveMember();
  const setManager = useSetMemberManager();

  const { data: orgTeams = [] } = useOrgTeams(orgId);
  const { data: orgTeamMembers = [] } = useOrgTeamMembers(orgId);
  const { data: projects = [] } = useTeamProjects(orgId);
  const { data: tasks = [] } = useTeamTasks(orgId);
  const createTask = useCreateTeamTask(orgId);
  const updateTask = useUpdateTeamTask(orgId);

  const [query, setQuery] = useState('');
  const [profile, setProfile] = useState<OrgMember | null>(null);
  const [insights, setInsights] = useState<{ member: OrgMember; tab: InsightsTab } | null>(null);
  const [agendaMember, setAgendaMember] = useState<OrgMember | null>(null);
  const [assigning, setAssigning] = useState<OrgMember | null>(null);
  const [creatingTaskFor, setCreatingTaskFor] = useState<OrgMember | null>(null);
  const [removing, setRemoving] = useState<OrgMember | null>(null);
  const [reassigning, setReassigning] = useState<OrgMember | null>(null);

  // Périmètre hiérarchique de l'utilisateur courant (miroir de la pyramide).
  const mySubtree = useMemo(
    () => (currentUserId ? subtreeOf(members, currentUserId) : new Set<string>()),
    [members, currentUserId],
  );

  const teamsByUser = useMemo(() => {
    const byId = new Map(orgTeams.map((t) => [t.id, t]));
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

  // Recherche par nom ou email (insensible aux accents/casse).
  const filteredMembers = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return members;
    return members.filter(
      (m) => normalize(m.displayName).includes(q) || (m.email ? normalize(m.email).includes(q) : false),
    );
  }, [members, query]);

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
      {/* Recherche (visible dès que l'annuaire compte quelques membres) */}
      {members.length > 3 && (
        <div className="relative mb-3">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))] pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un membre (nom, email)…"
            aria-label="Rechercher un membre dans l'annuaire"
            className="w-full pl-9 pr-9 py-2.5 text-sm rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-primary))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus:border-indigo-400 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Effacer la recherche"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {filteredMembers.length === 0 ? (
        <p className="text-sm text-[rgb(var(--color-text-muted))] py-8 text-center">
          Aucun membre ne correspond à « {query.trim()} ».
        </p>
      ) : (
      <ul className="space-y-2">
        {filteredMembers.map((m) => {
          const isSelf = m.userId === currentUserId;
          // Supérieur hiérarchique de m ? (admin partout ; manager : son sous-arbre)
          const isAbove = !isSelf && (isAdmin || mySubtree.has(m.userId));
          return (
            <li key={m.userId}>
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('button,[role="menu"]')) return;
                  setProfile(m);
                }}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                    e.preventDefault();
                    setProfile(m);
                  }
                }}
                aria-label={`Voir le profil de ${m.displayName}`}
                className="flex items-center gap-3 p-3 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] cursor-pointer hover:border-indigo-400/60 hover:bg-[rgb(var(--color-hover))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <MemberAvatar avatar={m.avatar} name={m.displayName} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-[rgb(var(--color-text-primary))] truncate">
                      {m.displayName}
                    </p>
                    {isSelf && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-muted))]">
                        Vous
                      </span>
                    )}
                  </div>
                  {m.email && (
                    <p className="text-xs text-[rgb(var(--color-text-muted))] truncate">{m.email}</p>
                  )}
                </div>

                <RoleBadge
                  kind={m.role === 'admin' ? 'admin' : isManagerOf(members, m.userId) ? 'manager' : 'member'}
                />

                {isAbove && (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                      aria-label={`Actions pour ${m.displayName}`}
                    >
                      <MoreVertical size={16} aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => setAssigning(m)}>
                        <ClipboardList size={14} className="text-indigo-500" aria-hidden="true" />
                        Attribuer une tâche
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setInsights({ member: m, tab: 'tasks' })}>
                        <ListTodo size={14} className="text-blue-500" aria-hidden="true" />
                        Voir ses tâches
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setAgendaMember(m)}>
                        <CalendarDays size={14} className="text-violet-500" aria-hidden="true" />
                        Voir son agenda
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setInsights({ member: m, tab: 'contribution' })}>
                        <TrendingUp size={14} className="text-emerald-500" aria-hidden="true" />
                        Voir sa contribution
                      </DropdownMenuItem>
                      {isAdmin && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => handleRemove(m)}>
                            <LogOut size={14} aria-hidden="true" /> Retirer de l'entreprise
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      )}

      {profile && (
        <MemberProfileSheet
          member={profile}
          members={members}
          teams={teamsByUser.get(profile.userId) ?? []}
          currentUserId={currentUserId}
          canMove={false}
          canAddUnder={false}
          onClose={() => setProfile(null)}
          onMove={() => {}}
          onAddUnder={() => {}}
        />
      )}

      {insights && (
        <MemberInsightsSheet
          orgId={orgId}
          member={insights.member}
          initialTab={insights.tab}
          onClose={() => setInsights(null)}
        />
      )}

      {agendaMember && (
        <MemberAgendaSheet member={agendaMember} onClose={() => setAgendaMember(null)} />
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
