import { formatDistanceToNow, parseISO } from 'date-fns';
import { getDateLocale } from '@/i18n/format';
import { History } from 'lucide-react';
import { useTeamTaskActivity, type TeamActivityField } from '@/modules/team-projects';
import type { OrgMember } from '@/modules/organizations';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';

interface TeamTaskHistorySectionProps {
  taskId: string;
  members: OrgMember[];
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
const TeamTaskHistorySection = ({ taskId, members }: TeamTaskHistorySectionProps) => {
  const { t } = useT('org');
  const { data: entries = [] } = useTeamTaskActivity(taskId);

  const nameOf = (userId: string | null): string => {
    if (!userId) return t('taskModal.historyUnknownActor');
    return members.find((m) => m.userId === userId)?.displayName
      ?? t('taskModal.historyUnknownActor');
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
            return (
              <li key={entry.id} className="text-xs text-[rgb(var(--color-text-secondary))]">
                <span className="text-[rgb(var(--color-text-primary))] font-medium">
                  {nameOf(entry.actorId)}
                </span>{' '}
                {labelKey ? t(labelKey) : entry.field}
                {showValues && (
                  <>
                    {entry.oldValue ? ` ${t('taskModal.historyFrom', { from: entry.oldValue })}` : ''}
                    {entry.newValue
                      ? ` ${t('taskModal.historyTo', { to: entry.newValue })}`
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
