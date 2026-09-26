import { useMemo, useState } from 'react';
import { Trash2, RotateCcw, Target, CheckSquare } from 'lucide-react';
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
  usePurgeTeamTask,
  TEAM_TASK_TRASH_DAYS,
  type TeamProject,
} from '@/modules/team-projects';
import { useTeamOKRTrash, useRestoreTeamOKR, usePurgeTeamOKR } from '@/modules/team-okrs';
import type { OrgMember } from '@/modules/organizations';
import { useAuth } from '@/modules/auth/AuthContext';
import { useT } from '@/i18n/useT';
import { useLocale } from '@/i18n/store';
import { formatRelativeTime } from '@/i18n/format';

interface TeamTrashDialogProps {
  orgId: string;
  projects: TeamProject[];
  members: OrgMember[];
}

interface TrashRow {
  kind: 'task' | 'okr';
  id: string;
  name: string;
  context: string;
  deletedAt: string;
  deletedBy: string | null;
}

/**
 * Corbeille de l'organisation : tâches d'équipe (M4, mig. 152) ET objectifs
 * (mig. 193), 30 jours avant la purge automatique.
 *
 * Le bouton ne s'affiche que s'il y a quelque chose à restaurer : une entrée
 * vide en permanence dans la barre serait du bruit. La liste ne contient que
 * ce que la personne peut restaurer (le serveur filtre : admin, auteur de la
 * suppression, ou droit de suppression sur ce qu'il voit).
 *
 * Un ADMIN peut aussi supprimer définitivement, sans attendre 30 jours (une
 * donnée à effacer tout de suite, une erreur de saisie qui encombre). Le
 * serveur le refuse à tout autre (`purge_team_task`, `purge_team_okr`).
 *
 * ⚠️ La corbeille rend l'INTITULÉ, jamais la description : le contenu revient
 *    avec la restauration, pas avant (`get_team_trash`, `get_team_okr_trash`).
 */
const TeamTrashDialog = ({ orgId, projects, members }: TeamTrashDialogProps) => {
  const { t, tp } = useT('org');
  const locale = useLocale();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState<string | null>(null);
  const { data: taskTrash = [], isLoading: loadingTasks } = useTeamTrash(orgId);
  const { data: okrTrash = [], isLoading: loadingOkrs } = useTeamOKRTrash(orgId);
  const restoreTask = useRestoreTeamTask(orgId);
  const restoreOkr = useRestoreTeamOKR(orgId);
  const purgeTask = usePurgeTeamTask(orgId);
  const purgeOkr = usePurgeTeamOKR(orgId);
  // Indication d'interface seulement : le serveur reste la barrière.
  const isAdmin = !!user && members.some((m) => m.userId === user.id && m.role === 'admin');

  const projectName = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const memberName = useMemo(() => new Map(members.map((m) => [m.userId, m.displayName])), [members]);

  const rows = useMemo<TrashRow[]>(() => [
    ...taskTrash.map((item) => ({
      kind: 'task' as const,
      id: item.id,
      name: item.name,
      context: projectName.get(item.projectId) ?? t('trash.unknownProject'),
      deletedAt: item.deletedAt,
      deletedBy: item.deletedBy,
    })),
    ...okrTrash.map((item) => ({
      kind: 'okr' as const,
      id: item.id,
      name: item.title,
      context: t('trash.objective'),
      deletedAt: item.deletedAt,
      deletedBy: item.deletedBy,
    })),
  ].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt)), [taskTrash, okrTrash, projectName, t]);

  // Pendant le chargement on ne dit rien (C-40) : le bouton n'apparaît qu'une
  // fois qu'on SAIT qu'il y a quelque chose à restaurer.
  if (loadingTasks || loadingOkrs || rows.length === 0) return null;

  const restore = (row: TrashRow) => (row.kind === 'task' ? restoreTask.mutate(row.id) : restoreOkr.mutate(row.id));
  const purge = (row: TrashRow) => {
    setConfirmPurge(null);
    if (row.kind === 'task') purgeTask.mutate(row.id);
    else purgeOkr.mutate(row.id);
  };
  const pending = restoreTask.isPending || restoreOkr.isPending || purgeTask.isPending || purgeOkr.isPending;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))] transition-colors"
      >
        <Trash2 size={13} aria-hidden="true" />
        {tp('trash.button', rows.length)}
      </button>

      <Dialog open={open} onOpenChange={(next) => { setOpen(next); setConfirmPurge(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('trash.title')}</DialogTitle>
            <DialogDescription>{t('trash.description', { days: TEAM_TASK_TRASH_DAYS })}</DialogDescription>
          </DialogHeader>
          <ul className="max-h-80 overflow-y-auto divide-y divide-[rgb(var(--color-border))] rounded-xl border border-[rgb(var(--color-border))]">
            {rows.map((row) => {
              const Icon = row.kind === 'task' ? CheckSquare : Target;
              const key = `${row.kind}-${row.id}`;
              return (
                <li key={key} className="flex items-center gap-3 px-3 py-2.5">
                  <Icon size={14} className="shrink-0 text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate text-[rgb(var(--color-text-primary))]">{row.name}</p>
                    <p className="text-xs truncate text-[rgb(var(--color-text-muted))]">
                      {t('trash.meta', {
                        project: row.context,
                        who: (row.deletedBy && memberName.get(row.deletedBy)) || t('trash.someone'),
                        when: formatRelativeTime(row.deletedAt, locale),
                      })}
                    </p>
                  </div>
                  {confirmPurge === key ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => purge(row)}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {t('trash.confirmPurge')}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => restore(row)}
                        aria-label={t('trash.restoreAria', { name: row.name })}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-50"
                      >
                        <RotateCcw size={12} aria-hidden="true" /> {t('trash.restore')}
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setConfirmPurge(key)}
                          aria-label={t('trash.purgeAria', { name: row.name })}
                          title={t('trash.purgeAria', { name: row.name })}
                          className="p-1.5 rounded-lg text-[rgb(var(--color-text-muted))] hover:text-red-500 hover:bg-[rgb(var(--color-hover))] disabled:opacity-50"
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TeamTrashDialog;
