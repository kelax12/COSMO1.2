import { formatDistanceToNow, parseISO } from 'date-fns';
import { getDateLocale } from '@/i18n/format';
import { History } from 'lucide-react';
import { useTeamTaskActivity, type TeamActivityField, type TeamProject } from '@/modules/team-projects';
import type { OrgMember } from '@/modules/organizations';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';
import { STATUS_META, PRIORITY_META, resolveActivityValue } from './team-projects.helpers';
import type { TeamTaskStatus } from '@/modules/team-projects';

interface TeamTaskHistorySectionProps {
  taskId: string;
  members: OrgMember[];
  /** Projets de l'org — sert à rendre lisible l'UUID écrit par le trigger. */
  projects: TeamProject[];
}

/** Clé de libellé par champ journalisé — le trigger n'écrit que ces six-là. */
const FIELD_KEYS: Record<TeamActivityField, KeyOf<'org'>> = {
  status: 'taskModal.historyStatus',
  assignees: 'taskModal.historyAssignees',
  deadline: 'taskModal.historyDeadline',
  priority: 'taskModal.historyPriority',
  project: 'taskModal.historyProject',
  name: 'taskModal.historyName',
};

/**
 * Historique d'une tâche (mig. 094) — lecture seule.
 *
 * Répond à « qui a réassigné ça ? » et « quand la deadline a-t-elle bougé ? »,
 * questions sans réponse jusqu'ici : le flux d'activité existant est dérivé de
 * l'état COURANT des tâches, il ne voit donc que ce qui est encore vrai.
 */
const TeamTaskHistorySection = ({ taskId, members, projects }: TeamTaskHistorySectionProps) => {
  const { t } = useT('org');
  const { data: entries = [] } = useTeamTaskActivity(taskId);

  const nameOf = (userId: string | null): string => {
    if (!userId) return t('taskModal.historyUnknownActor');
    return members.find((m) => m.userId === userId)?.displayName
      ?? t('taskModal.historyUnknownActor');
  };

  // Le journal stocke des valeurs brutes (statut technique, UUID) — c'est le
  // bon choix côté base (append-only, indépendant des libellés du moment) ;
  // la traduction se fait donc ici, au rendu. Un membre ou un projet supprimé
  // depuis n'a plus de nom : on affiche un repli plutôt qu'un blanc.
  const resolvers = {
    statusLabel: (status: string) => {
      const meta = STATUS_META[status as TeamTaskStatus];
      return meta ? t(meta.labelKey as Parameters<typeof t>[0]) : status;
    },
    memberName: (userId: string) =>
      members.find((m) => m.userId === userId)?.displayName
        ?? t('taskModal.historyRemovedMember'),
    projectName: (projectId: string) =>
      projects.find((p) => p.id === projectId)?.name
        ?? t('taskModal.historyRemovedProject'),
    // Mêmes libellés que le sélecteur de priorité de la modale (PRIORITY_META).
    priorityLabel: (priority: string) => PRIORITY_META[Number(priority)]?.label ?? priority,
  };

  return (
    <div>
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-2 text-[rgb(var(--color-text-secondary))]">
        <History size={12} aria-hidden="true" /> {t('taskModal.historyTitle')}
      </span>

      {entries.length === 0 ? (
        <p className="text-xs text-[rgb(var(--color-text-muted))] py-1">
          {t('taskModal.historyEmpty')}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {entries.map((entry) => {
            const labelKey = FIELD_KEYS[entry.field];
            // Le trigger de la mig. 094 n'écrit PAS les valeurs pour `name` :
            // savoir que le titre a changé suffit, stocker les anciens libellés
            // ferait du journal une copie du contenu (charge RGPD).
            const showValues = entry.field !== 'name';
            const oldLabel = resolveActivityValue(entry.field, entry.oldValue, resolvers);
            const newLabel = resolveActivityValue(entry.field, entry.newValue, resolvers);
            return (
              <li key={entry.id} className="text-xs text-[rgb(var(--color-text-secondary))]">
                <span className="text-[rgb(var(--color-text-primary))] font-medium">
                  {nameOf(entry.actorId)}
                </span>{' '}
                {labelKey ? t(labelKey) : entry.field}
                {showValues && (
                  <>
                    {oldLabel ? ` ${t('taskModal.historyFrom', { from: oldLabel })}` : ''}
                    {newLabel
                      ? ` ${t('taskModal.historyTo', { to: newLabel })}`
                      : ` ${t('taskModal.historyTo', { to: t('taskModal.historyNone') })}`}
                  </>
                )}
                <span className="text-[rgb(var(--color-text-muted))]">
                  {' · '}
                  {formatDistanceToNow(parseISO(entry.createdAt), {
                    addSuffix: true,
                    locale: getDateLocale(),
                  })}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default TeamTaskHistorySection;
