import { useMemo, useState } from 'react';
import { Trash2, RotateCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  useTeamTrash,
  useRestoreTeamTask,
  TEAM_TASK_TRASH_DAYS,
  type TeamProject,
} from '@/modules/team-projects';
import type { OrgMember } from '@/modules/organizations';
import { useT } from '@/i18n/useT';
import { useLocale } from '@/i18n/store';
import { formatRelativeTime } from '@/i18n/format';

interface TeamTrashDialogProps {
  orgId: string;
  projects: TeamProject[];
  members: OrgMember[];
}

/**
 * Corbeille des tâches d'équipe (M4, mig. 152).
 *
 * Le bouton ne s'affiche que s'il y a quelque chose à restaurer : une entrée
 * vide en permanence dans la barre du portefeuille serait du bruit. La liste
 * ne contient que ce que la personne peut restaurer (le serveur filtre :
 * admin, auteur de la suppression, ou `task.deleteAny` sur un projet visible).
 *
 * ⚠️ La corbeille rend l'INTITULÉ, jamais la description : le contenu revient
 *    avec la restauration, pas avant (`get_team_trash`).
 */
const TeamTrashDialog = ({ orgId, projects, members }: TeamTrashDialogProps) => {
  const { t: ta, tp: tpa } = useT('orgAdmin');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const { data: trash = [], isLoading } = useTeamTrash(orgId);
  const restore = useRestoreTeamTask(orgId);

  const projectName = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const memberName = useMemo(() => new Map(members.map((m) => [m.userId, m.displayName])), [members]);

  // Pendant le chargement on ne dit rien (C-40) : le bouton n'apparaît qu'une
  // fois qu'on SAIT qu'il y a quelque chose à restaurer.
  if (isLoading || trash.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] transition-colors"
      >
        <Trash2 size={13} aria-hidden="true" />
        {tpa('trash.button', trash.length)}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{ta('trash.title')}</DialogTitle>
            <DialogDescription>{ta('trash.description', { days: TEAM_TASK_TRASH_DAYS })}</DialogDescription>
          </DialogHeader>
          <ul className="max-h-80 overflow-y-auto divide-y divide-[rgb(var(--color-border))] rounded-xl border border-[rgb(var(--color-border))]">
            {trash.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate text-[rgb(var(--color-text-primary))]">{item.name}</p>
                  <p className="text-xs truncate text-[rgb(var(--color-text-muted))]">
                    {ta('trash.meta', {
                      project: projectName.get(item.projectId) ?? ta('trash.unknownProject'),
                      who: (item.deletedBy && memberName.get(item.deletedBy)) || ta('trash.someone'),
                      when: formatRelativeTime(item.deletedAt, locale),
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={restore.isPending}
                  onClick={() => restore.mutate(item.id)}
                  aria-label={ta('trash.restoreAria', { name: item.name })}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-50"
                >
                  <RotateCcw size={12} aria-hidden="true" /> {ta('trash.restore')}
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TeamTrashDialog;
