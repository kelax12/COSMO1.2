import { useState } from 'react';
import { Check, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useMyOrgPermissions } from '@/modules/organizations';
import type { OrgMember } from '@/modules/organizations';
import type { TeamTask } from '@/modules/team-projects';
import MemberAvatar from './MemberAvatar';
import TeamAssigneeGroups from './TeamAssigneeGroups';
import { MEMBER_SEARCH_THRESHOLD, filterMembersByQuery } from './member-search.helpers';
import { useT } from '@/i18n/useT';

interface AssignMembersDialogProps {
  orgId: string;
  task: TeamTask | null;
  members: OrgMember[];
  onSave: (task: TeamTask, assigneeIds: string[]) => void;
  onClose: () => void;
}

/**
 * Dialog dédié « Attribuer à quelqu'un », ouvert depuis le menu ⋯ de l'onglet
 * Tâches (TeamTasksTab) — cette table n'a pas de colonne assignés, donc pas
 * d'AssigneesPicker déjà visible sur la ligne.
 */
const AssignMembersDialog = ({ orgId, task, members, onSave, onClose }: AssignMembersDialogProps) => {
  const { t } = useT('org');
  const { canAssign } = useMyOrgPermissions(orgId);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task?.assigneeIds ?? []);
  // Portée d'assignation (mig. 115). Un membre déjà assigné reste listé : le
  // serveur ne contrôle que les AJOUTS, on doit pouvoir le retirer.
  const assignable = members.filter((m) => canAssign(m.userId) || assigneeIds.includes(m.userId));
  // Recherche au-delà de quelques personnes : à mille membres, la liste brute
  // se parcourait au défilement. Elle ne filtre que l'AFFICHAGE, jamais la
  // sélection : une personne cochée puis masquée par la requête reste assignée.
  const [query, setQuery] = useState('');
  const searchable = assignable.length > MEMBER_SEARCH_THRESHOLD;
  const shown = searchable ? filterMembersByQuery(assignable, query) : assignable;

  // `task` change à chaque ouverture (nouvelle tâche ciblée) — resynchronise
  // la sélection locale sans dépendre d'un useEffect.
  const [openedFor, setOpenedFor] = useState<string | null>(task?.id ?? null);
  if (task && task.id !== openedFor) {
    setOpenedFor(task.id);
    setAssigneeIds(task.assigneeIds);
    setQuery('');
  }

  const toggle = (userId: string) =>
    setAssigneeIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));

  const handleSave = () => {
    if (!task) return;
    onSave(task, assigneeIds);
    onClose();
  };

  return (
    <Dialog open={!!task} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('assign.assignMembers')}</DialogTitle>
          <DialogDescription>{task?.name}</DialogDescription>
        </DialogHeader>

        {searchable && (
          <label className="relative block">
            <span className="sr-only">{t('assign.memberSearch')}</span>
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('assign.memberSearch')}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border bg-[rgb(var(--color-surface))] border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-accent))]"
            />
          </label>
        )}

        <div className="max-h-72 overflow-y-auto rounded-xl border" style={{ borderColor: 'rgb(var(--color-border))' }}>
          {/* Les groupes d'équipe n'ont de sens que sur la liste entière : sous
              une recherche, ils cocheraient des personnes qu'on ne voit pas. */}
          {!query.trim() && <TeamAssigneeGroups orgId={orgId} value={assigneeIds} onChange={setAssigneeIds} />}
          {shown.length === 0 && (
            <p className="px-3 py-4 text-xs text-center text-[rgb(var(--color-text-muted))]">{t('assign.noMemberMatch')}</p>
          )}
          {shown.map((m) => {
            const checked = assigneeIds.includes(m.userId);
            return (
              <button
                key={m.userId}
                type="button"
                onClick={() => toggle(m.userId)}
                aria-pressed={checked}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-[rgb(var(--color-hover))] transition-colors text-left"
              >
                <MemberAvatar avatar={m.avatar} name={m.displayName} size={26} />
                <span className="text-sm truncate flex-1" style={{ color: 'rgb(var(--color-text-primary))' }}>
                  {m.displayName}
                </span>
                <span
                  className={`w-6 h-6 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                    checked ? 'bg-[rgb(var(--color-accent-solid))] border-[rgb(var(--color-accent-solid))] text-[rgb(var(--color-accent-solid-foreground))]' : 'border-[rgb(var(--color-border))]'
                  }`}
                  aria-hidden="true"
                >
                  {checked && <Check size={13} />}
                </span>
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="lg" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="button" size="lg" onClick={handleSave} className="!bg-[rgb(var(--color-accent-solid))] hover:!bg-[rgb(var(--color-accent-solid-hover))] !text-[rgb(var(--color-accent-solid-foreground))] !border-0">
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignMembersDialog;
