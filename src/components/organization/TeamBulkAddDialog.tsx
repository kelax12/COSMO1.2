import { useMemo, useState } from 'react';
import { UsersRound } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getOrgTeamsRepository } from '@/lib/repository.factory';
import type { OrgMember } from '@/modules/organizations';
import { orgTeamKeys, type OrgTeam } from '@/modules/org-teams';
import MemberAvatar from './MemberAvatar';
import { filterMembersByQuery } from './member-search.helpers';
import { useBulkRun } from './use-bulk-run';
import { useT } from '@/i18n/useT';

interface TeamBulkAddDialogProps {
  orgId: string;
  team: OrgTeam;
  /** Membres ajoutables (miroir RLS déjà appliqué par l'appelant). */
  addable: OrgMember[];
}

/**
 * Ajouter PLUSIEURS personnes à une équipe d'un coup (audit du 2026-09-24,
 * « pas d'actions groupées sur les équipes »). Monter une équipe de quinze
 * demandait quinze ouvertures du menu « Ajouter ».
 */
const TeamBulkAddDialog = ({ orgId, team, addable }: TeamBulkAddDialogProps) => {
  const { t } = useT('org');
  const { t: ta, tp: tpa } = useT('orgAdmin');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const { execute, pending } = useBulkRun([orgTeamKeys.all]);
  const shown = useMemo(() => filterMembersByQuery(addable, query), [addable, query]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    await execute([...picked], (userId) => getOrgTeamsRepository().addTeamMember(team.id, orgId, userId));
    setPicked(new Set());
    setOpen(false);
  };

  if (addable.length < 2) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-[rgb(var(--color-chip-border))] px-2 py-0.5 text-xs text-[rgb(var(--color-text-muted))] hover:text-blue-500 transition-colors"
      >
        <UsersRound size={11} aria-hidden="true" /> {ta('teamBulk.addSeveral')}
      </button>
      <Dialog open={open} onOpenChange={(v) => { if (!pending) setOpen(v); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{ta('teamBulk.title', { team: team.name })}</DialogTitle>
            <DialogDescription>{ta('teamBulk.description')}</DialogDescription>
          </DialogHeader>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('assign.memberSearch')}
            aria-label={t('assign.memberSearch')}
            className="w-full px-3 py-2 text-sm rounded-lg border bg-[rgb(var(--color-surface))] border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))]"
          />
          <ul className="max-h-72 overflow-y-auto divide-y divide-[rgb(var(--color-border))] rounded-xl border border-[rgb(var(--color-border))]">
            {shown.map((m) => (
              <li key={m.userId}>
                <label className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-[rgb(var(--color-hover))]">
                  <input
                    type="checkbox"
                    checked={picked.has(m.userId)}
                    onChange={() => toggle(m.userId)}
                    className="w-4 h-4 accent-[rgb(var(--color-accent))]"
                  />
                  <MemberAvatar avatar={m.avatar} name={m.displayName} size={22} />
                  <span className="text-sm text-[rgb(var(--color-text-primary))] truncate">{m.displayName}</span>
                </label>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <button
              type="button"
              disabled={picked.size === 0 || pending}
              onClick={() => void submit()}
              className="px-4 min-h-11 rounded-xl text-sm font-semibold bg-[rgb(var(--color-accent))] text-[rgb(var(--color-background))] hover:opacity-90 disabled:opacity-50"
            >
              {tpa('teamBulk.submit', picked.size)}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TeamBulkAddDialog;
