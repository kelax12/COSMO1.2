// ═══════════════════════════════════════════════════════════════════
// Sélection multiple + actions groupées de l'annuaire
//
// Deux gestes : ajouter à une équipe, changer de manager. Chacun :
//   1. écarte d'abord ce que le serveur refuserait (`member-bulk.helpers`) ;
//   2. passe par les hooks EXISTANTS (`useAddTeamMember`, `useSetMemberManager`)
//      avec `bulk: true`, qui coupe leurs toasts unitaires ;
//   3. rend UN toast récapitulatif, avec « Annuler » quand le geste s'inverse.
// Une sélection ne survit pas au filtre : seuls les membres encore VISIBLES
// sont pris en compte (même règle que l'onglet Projets).
// ═══════════════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import { toast } from '@/lib/toast';
import { showUndoToast } from '@/lib/undo-toast';
import { useSetMemberManager, type OrgMember } from '@/modules/organizations';
import { useAddTeamMember, useRemoveTeamMember, type OrgTeam, type OrgTeamMember } from '@/modules/org-teams';
import { useT } from '@/i18n/useT';
import {
  canUseBulkActions,
  managerDestinations,
  manageableTeams,
  partitionForManager,
  partitionForTeam,
  type Partition,
} from './member-bulk.helpers';
import type { BulkPickerOption } from './MemberBulkPicker';

interface Options {
  orgId: string;
  members: OrgMember[];
  visibleMembers: OrgMember[];
  teams: OrgTeam[];
  memberships: OrgTeamMember[];
  currentUserId: string | undefined;
  isAdmin: boolean;
}

export type BulkPickerMode = 'team' | 'manager';

export const useMemberBulkActions = ({
  orgId, members, visibleMembers, teams, memberships, currentUserId, isAdmin,
}: Options) => {
  const { t, tp } = useT('org');
  const addMember = useAddTeamMember(orgId);
  const removeMember = useRemoveTeamMember(orgId);
  const setManager = useSetMemberManager();
  const actor = useMemo(() => ({ currentUserId, isAdmin }), [currentUserId, isAdmin]);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [picker, setPicker] = useState<BulkPickerMode | null>(null);
  const [pending, setPending] = useState(false);

  const selected = useMemo(
    () => visibleMembers.filter((m) => selectedIds.has(m.userId)),
    [visibleMembers, selectedIds],
  );
  const allVisibleSelected = visibleMembers.length > 0 && selected.length === visibleMembers.length;

  const toggle = (userId: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });

  const toggleAll = () =>
    setSelectedIds(allVisibleSelected ? new Set() : new Set(visibleMembers.map((m) => m.userId)));

  const exit = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setPicker(null);
  };

  const teamsICanManage = useMemo(() => manageableTeams(teams, memberships, actor), [teams, memberships, actor]);
  const destinations = useMemo(() => managerDestinations(members, actor), [members, actor]);
  const canSelect = useMemo(
    () => canUseBulkActions(members, teams, memberships, actor),
    [members, teams, memberships, actor],
  );
  const canChangeManager = isAdmin || (!!currentUserId && members.some((m) => m.managerId === currentUserId));

  const pickerOptions: BulkPickerOption[] = useMemo(() => {
    if (picker === 'team') {
      return teamsICanManage.map((team) => ({
        id: team.id,
        label: team.name,
        color: team.color,
        eligible: partitionForTeam(selected, team, memberships, members, actor).eligible.length,
      }));
    }
    if (picker === 'manager') {
      const opts: BulkPickerOption[] = destinations.map((m) => ({
        id: m.userId,
        label: m.displayName,
        avatar: m.avatar,
        eligible: partitionForManager(selected, m.userId, members, actor).eligible.length,
      }));
      if (isAdmin) {
        opts.unshift({ id: null, label: t('member.detach'), eligible: partitionForManager(selected, null, members, actor).eligible.length });
      }
      return opts;
    }
    return [];
  }, [picker, teamsICanManage, destinations, selected, memberships, members, actor, isAdmin, t]);

  /** « · 2 ignorés · 1 échec » — ce que le toast doit dire en plus du résultat. */
  const suffix = (p: Partition, failed: number) => {
    const skipped = p.unchanged.length + p.outOfScope.length;
    return (skipped > 0 ? ` · ${tp('directory.bulk.skipped', skipped)}` : '')
      + (failed > 0 ? ` · ${tp('directory.bulk.failed', failed)}` : '');
  };

  const settle = async <T,>(items: T[], run: (item: T) => Promise<unknown>) => {
    const results = await Promise.allSettled(items.map(run));
    return items.filter((_, i) => results[i].status === 'fulfilled');
  };

  const addToTeam = async (teamId: string) => {
    const team = teams.find((x) => x.id === teamId);
    if (!team) return;
    const p = partitionForTeam(selected, team, memberships, members, actor);
    if (p.eligible.length === 0) {
      toast.info(t('directory.bulk.nothingToDo'));
      return;
    }
    setPending(true);
    const done = await settle(p.eligible, (m) => addMember.mutateAsync({ teamId, userId: m.userId, bulk: true }));
    setPending(false);
    setPicker(null);
    setSelectedIds(new Set());
    const failed = p.eligible.length - done.length;
    const message = tp('directory.bulk.addedToTeam', done.length, { team: team.name }) + suffix(p, failed);
    if (done.length === 0) {
      toast.error(message);
      return;
    }
    showUndoToast(message, () => {
      void settle(done, (m) => removeMember.mutateAsync({ teamId, userId: m.userId, bulk: true }));
    });
  };

  const moveUnder = async (destId: string | null) => {
    const p = partitionForManager(selected, destId, members, actor);
    if (p.eligible.length === 0) {
      toast.info(t('directory.bulk.nothingToDo'));
      return;
    }
    // L'annulation remet CHACUN sous son ancien manager : on le note avant.
    const previous = new Map(p.eligible.map((m) => [m.userId, m.managerId ?? null]));
    setPending(true);
    const done = await settle(p.eligible, (m) =>
      setManager.mutateAsync({ orgId, userId: m.userId, managerId: destId, bulk: true }),
    );
    setPending(false);
    setPicker(null);
    setSelectedIds(new Set());
    const failed = p.eligible.length - done.length;
    const destName = destId ? members.find((m) => m.userId === destId)?.displayName ?? '' : '';
    const message = (destId
      ? tp('directory.bulk.movedUnder', done.length, { name: destName })
      : tp('directory.bulk.detached', done.length)) + suffix(p, failed);
    if (done.length === 0) {
      toast.error(message);
      return;
    }
    showUndoToast(message, () => {
      void settle(done, (m) =>
        setManager.mutateAsync({ orgId, userId: m.userId, managerId: previous.get(m.userId) ?? null, bulk: true }),
      );
    });
  };

  return {
    canSelect,
    selectMode,
    toggleSelectMode: () => (selectMode ? exit() : setSelectMode(true)),
    exit,
    selectedIds,
    selected,
    allVisibleSelected,
    toggle,
    toggleAll,
    canAddToTeam: teamsICanManage.length > 0,
    canChangeManager,
    picker,
    setPicker,
    pickerOptions,
    pending,
    pick: (id: string | null) => {
      if (picker === 'team' && id) void addToTeam(id);
      else if (picker === 'manager') void moveUnder(id);
    },
  };
};
