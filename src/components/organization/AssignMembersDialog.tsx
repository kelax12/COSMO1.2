import { useState } from 'react';
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
import MemberPickList from './MemberPickList';
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
 * Tâches (TeamTasksTab) : cette table n'a pas de colonne assignés, donc pas
 * d'AssigneesPicker déjà visible sur la ligne.
 */
const AssignMembersDialog = ({ orgId, task, members, onSave, onClose }: AssignMembersDialogProps) => {
  const { t } = useT('org');
  const { canAssign } = useMyOrgPermissions(orgId);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task?.assigneeIds ?? []);
  // Portée d'assignation (mig. 115). Un membre déjà assigné reste listé : le
  // serveur ne contrôle que les AJOUTS, on doit pouvoir le retirer.
  const assignable = members.filter((m) => canAssign(m.userId) || assigneeIds.includes(m.userId));
  // MÊME sélecteur que la fiche de tâche (audit des popups, 2026-09-25) :
  // recherche, équipes, pagination. Il ne filtre que l'AFFICHAGE.

  // `task` change à chaque ouverture (nouvelle tâche ciblée) — resynchronise
  // la sélection locale sans dépendre d'un useEffect.
  const [openedFor, setOpenedFor] = useState<string | null>(task?.id ?? null);
  if (task && task.id !== openedFor) {
    setOpenedFor(task.id);
    setAssigneeIds(task.assigneeIds);
  }

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

        <div className="max-h-80 overflow-y-auto rounded-xl border" style={{ borderColor: 'rgb(var(--color-border))' }}>
          {/* `key` : une nouvelle tâche ciblée repart d'une recherche vide. */}
          <MemberPickList
            key={task?.id ?? 'none'}
            members={assignable}
            value={assigneeIds}
            onChange={setAssigneeIds}
            teamGroupsOrgId={orgId}
            label={t('assign.assignMembers')}
          />
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
