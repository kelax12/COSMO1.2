import { useState } from 'react';
import { Users, Network, PauseCircle, PlayCircle, Clock, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getOrgGovernanceRepository, getOrgTeamsRepository, getOrganizationsRepository } from '@/lib/repository.factory';
import { orgKeys, type OrgMember } from '@/modules/organizations';
import { governanceKeys } from '@/modules/organizations/governance.hooks';
import { orgTeamKeys, type OrgTeam } from '@/modules/org-teams';
import { DatePicker } from '@/components/ui/date-picker';
import OrgConfirmDialog from './OrgConfirmDialog';
import MemberAvatar from './MemberAvatar';
import { useBulkRun } from './use-bulk-run';
import { useT } from '@/i18n/useT';

interface MemberBulkBarProps {
  orgId: string;
  ownerId: string;
  currentUserId?: string;
  selected: OrgMember[];
  members: OrgMember[];
  teams: OrgTeam[];
  onExit: () => void;
}

const actionClass =
  'inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-medium text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] transition-colors whitespace-nowrap disabled:opacity-50';

/** 'YYYY-MM-DD' local → fin de journée locale, en ISO (même règle que `MemberAccessDialog`). */
const endOfLocalDay = (date: string): string => new Date(`${date}T23:59:59`).toISOString();

/**
 * Actions groupées sur les MEMBRES (audit du 2026-09-24, « changement de
 * configuration en masse »). Réservé aux admins : chacun de ces gestes l'est
 * côté serveur (`set_member_access`, placement libre dans la pyramide).
 *
 * Le propriétaire et soi-même sont écartés des gestes d'accès AVANT l'appel :
 * le serveur les refuserait un par un, et le toast compterait des échecs que
 * l'écran pouvait éviter.
 */
const MemberBulkBar = ({ orgId, ownerId, currentUserId, selected, members, teams, onExit }: MemberBulkBarProps) => {
  const { t, tp } = useT('org');
  const { execute, pending } = useBulkRun([orgKeys.all, orgTeamKeys.all, governanceKeys.all]);
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [expiryOpen, setExpiryOpen] = useState(false);
  const [expiry, setExpiry] = useState('');

  const restrictable = selected.filter((m) => m.userId !== ownerId && m.userId !== currentUserId);
  const selectedIds = new Set(selected.map((m) => m.userId));

  const addToTeam = (team: OrgTeam) =>
    void execute(selected, (m) => getOrgTeamsRepository().addTeamMember(team.id, orgId, m.userId));

  const placeUnder = (managerId: string | null) =>
    void execute(
      selected.filter((m) => m.userId !== managerId),
      (m) => getOrganizationsRepository().setMemberManager(orgId, m.userId, managerId),
    );

  const setSuspended = (suspended: boolean) =>
    void execute(restrictable, (m) =>
      getOrgGovernanceRepository().setMemberAccess(orgId, m.userId, suspended, m.accessExpiresAt ?? null),
    );

  const applyExpiry = () => {
    const expiresAt = expiry ? endOfLocalDay(expiry) : null;
    setExpiryOpen(false);
    void execute(restrictable, (m) =>
      getOrgGovernanceRepository().setMemberAccess(orgId, m.userId, !!m.suspendedAt, expiresAt),
    );
  };

  return (
    <>
      <div
        role="toolbar"
        aria-label={selected.length > 0 ? tp('bulk.membersSelected', selected.length) : t('bulk.membersSelectHint')}
        className="fixed left-1/2 -translate-x-1/2 bottom-20 sm:bottom-6 z-40 flex items-center gap-1 px-2 py-2 rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] shadow-lg max-w-[calc(100vw-2rem)] overflow-x-auto hide-scrollbar"
      >
        <span className="px-2 text-sm whitespace-nowrap tabular-nums font-semibold text-[rgb(var(--color-text-primary))]">
          {selected.length > 0 ? tp('bulk.membersSelected', selected.length) : t('bulk.membersSelectHint')}
        </span>

        {selected.length > 0 && (
          <>
            <span className="w-px h-6 bg-[rgb(var(--color-border))] shrink-0" aria-hidden="true" />
            {teams.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger className={actionClass} disabled={pending}>
                  <Users size={15} aria-hidden="true" /> {t('bulk.addToTeam')}
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="center" className="w-56 max-h-72 overflow-y-auto">
                  <DropdownMenuLabel>{t('bulk.addToTeam')}</DropdownMenuLabel>
                  {teams.map((team) => (
                    <DropdownMenuItem key={team.id} onClick={() => addToTeam(team)}>
                      <span className="truncate">{team.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger className={actionClass} disabled={pending}>
                <Network size={15} aria-hidden="true" /> {t('bulk.placeUnder')}
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="center" className="w-60 max-h-72 overflow-y-auto">
                <DropdownMenuLabel>{t('bulk.placeUnder')}</DropdownMenuLabel>
                {members.filter((m) => !selectedIds.has(m.userId)).map((m) => (
                  <DropdownMenuItem key={m.userId} onClick={() => placeUnder(m.userId)}>
                    <MemberAvatar avatar={m.avatar} name={m.displayName} size={20} />
                    <span className="truncate">{m.displayName}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => placeUnder(null)}>{t('bulk.detach')}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {restrictable.length > 0 && (
              <>
                <button type="button" className={actionClass} disabled={pending} onClick={() => setConfirmSuspend(true)}>
                  <PauseCircle size={15} aria-hidden="true" /> {t('bulk.suspend')}
                </button>
                {restrictable.some((m) => m.suspendedAt) && (
                  <button type="button" className={actionClass} disabled={pending} onClick={() => setSuspended(false)}>
                    <PlayCircle size={15} aria-hidden="true" /> {t('bulk.reactivate')}
                  </button>
                )}
                <button type="button" className={actionClass} disabled={pending} onClick={() => setExpiryOpen(true)}>
                  <Clock size={15} aria-hidden="true" /> {t('bulk.accessUntil')}
                </button>
              </>
            )}
          </>
        )}

        <button
          type="button"
          onClick={onExit}
          aria-label={t('bulk.exit')}
          title={t('bulk.exit')}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))] transition-colors shrink-0"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {confirmSuspend && (
        <OrgConfirmDialog
          title={tp('bulk.suspendTitle', restrictable.length)}
          description={t('lifecycle.stateSuspendedHint')}
          impact={restrictable.slice(0, 8).map((m) => m.displayName)}
          confirmLabel={t('bulk.suspend')}
          onConfirm={() => { setConfirmSuspend(false); setSuspended(true); }}
          onCancel={() => setConfirmSuspend(false)}
        />
      )}

      {expiryOpen && (
        <OrgConfirmDialog
          title={tp('bulk.accessUntilTitle', restrictable.length)}
          description={t('lifecycle.accessUntilHint')}
          confirmLabel={t('lifecycle.accessSave')}
          tone="accent"
          onConfirm={applyExpiry}
          onCancel={() => setExpiryOpen(false)}
        >
          <DatePicker
            id="bulk-access-until"
            value={expiry}
            onChange={(v) => setExpiry(v ?? '')}
            placeholder={t('lifecycle.accessUntilNone')}
            minDate={new Date().toLocaleDateString('en-CA')}
          />
        </OrgConfirmDialog>
      )}
    </>
  );
};

export default MemberBulkBar;
