import { formatDistanceToNow, parseISO } from 'date-fns';
import { History } from 'lucide-react';
import { getDateLocale } from '@/i18n/format';
import { useTeamTaskActivity, type TeamActivityField, type TeamProject } from '@/modules/team-projects';
import type { OrgMember } from '@/modules/organizations';
import { STATUS_META, priorityLabelOf, resolveActivityValue } from './team-projects.helpers';
import type { TeamTaskStatus } from '@/modules/team-projects';
import { useT } from '@/i18n/useT';

interface TeamTaskHistoryPanelProps {
  taskId: string;
  members: OrgMember[];
  projects: TeamProject[];
}

const FIELD_KEY: Record<TeamActivityField, `popups.history.field.${TeamActivityField}`> = {
  status: 'popups.history.field.status',
  assignees: 'popups.history.field.assignees',
  deadline: 'popups.history.field.deadline',
  priority: 'popups.history.field.priority',
  project: 'popups.history.field.project',
  name: 'popups.history.field.name',
};

/**
 * Onglet Historique de la fiche de tâche (mig. 094) : « qui a réassigné ça,
 * quand l'échéance a-t-elle bougé ». Le journal est écrit par un trigger, en
 * valeurs brutes ; la traduction se fait ici, au rendu, par
 * `resolveActivityValue` (un nom ou une langue qui change ne réécrit pas le passé).
 */
const TeamTaskHistoryPanel = ({ taskId, members, projects }: TeamTaskHistoryPanelProps) => {
  const { t } = useT('org');
  const { data: entries = [], isLoading } = useTeamTaskActivity(taskId);

  const memberName = (id: string) => members.find((m) => m.userId === id)?.displayName ?? t('popups.history.formerMember');
  const resolvers = {
    statusLabel: (s: string) =>
      s in STATUS_META ? t(STATUS_META[s as TeamTaskStatus].labelKey as Parameters<typeof t>[0]) : s,
    memberName,
    projectName: (id: string) => projects.find((p) => p.id === id)?.name ?? t('popups.history.formerProject'),
    priorityLabel: (p: string) => priorityLabelOf(Number(p)),
  };

  if (isLoading) {
    return <p className="text-sm text-[rgb(var(--color-text-muted))] py-6 text-center">{t('popups.history.loading')}</p>;
  }
  if (entries.length === 0) {
    return (
      <p className="text-sm text-[rgb(var(--color-text-muted))] py-6 text-center">
        <History size={16} className="inline-block mr-1.5 align-[-3px]" aria-hidden="true" />
        {t('popups.history.empty')}
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry) => {
        const before = resolveActivityValue(entry.field, entry.oldValue, resolvers) ?? t('popups.history.none');
        const after = resolveActivityValue(entry.field, entry.newValue, resolvers) ?? t('popups.history.none');
        const actor = entry.actorId ? memberName(entry.actorId) : t('popups.history.system');
        return (
          <li key={entry.id} className="flex gap-3">
            <span className="mt-1.5 w-2 h-2 rounded-full bg-[rgb(var(--color-accent))] shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[rgb(var(--color-text-primary))]">
                {entry.field === 'name'
                  ? t('popups.history.renamed', { actor })
                  : t('popups.history.changed', { actor, field: t(FIELD_KEY[entry.field]) })}
              </p>
              {entry.field !== 'name' && (
                <p className="text-xs text-[rgb(var(--color-text-secondary))] break-words">
                  <span className="line-through opacity-70">{before}</span>
                  <span aria-hidden="true"> → </span>
                  <span className="sr-only">{t('popups.history.becomes')}</span>
                  <span className="font-semibold">{after}</span>
                </p>
              )}
              <p className="text-caption text-[rgb(var(--color-text-muted))]">
                {formatDistanceToNow(parseISO(entry.createdAt), { addSuffix: true, locale: getDateLocale() })}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default TeamTaskHistoryPanel;
