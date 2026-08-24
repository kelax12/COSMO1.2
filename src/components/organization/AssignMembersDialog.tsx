import { useState } from 'react';
import { Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { OrgMember } from '@/modules/organizations';
import type { TeamTask } from '@/modules/team-projects';
import MemberAvatar from './MemberAvatar';
import TeamAssigneeGroups from './TeamAssigneeGroups';
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
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task?.assigneeIds ?? []);

  // `task` change à chaque ouverture (nouvelle tâche ciblée) — resynchronise
  // la sélection locale sans dépendre d'un useEffect.
  const [openedFor, setOpenedFor] = useState<string | null>(task?.id ?? null);
  if (task && task.id !== openedFor) {
    setOpenedFor(task.id);
    setAssigneeIds(task.assigneeIds);
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

        <div className="max-h-72 overflow-y-auto rounded-xl border" style={{ borderColor: 'rgb(var(--color-border))' }}>
          <TeamAssigneeGroups orgId={orgId} value={assigneeIds} onChange={setAssigneeIds} />
          {members.map((m) => {
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
                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
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
