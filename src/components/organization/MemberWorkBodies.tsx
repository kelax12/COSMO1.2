import { useMemo, useState } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Crown, FolderKanban, History, Users2 } from 'lucide-react';
import { getDateLocale } from '@/i18n/format';
import type { OrgMember } from '@/modules/organizations';
import { useOrgTeamMembers, type OrgTeam } from '@/modules/org-teams';
import { useOrgActivity, useTeamProjects, useTeamTasks, type TeamActivityField } from '@/modules/team-projects';
import { projectColor } from './team-projects.helpers';
import { useT } from '@/i18n/useT';

// ═══════════════════════════════════════════════════════════════════
// Fiche membre : onglets « Équipes et projets » et « Historique »
//
// Audit des popups du 2026-09-25 : la fiche 360° ne disait ni dans quelles
// équipes travaille la personne, ni sur quels projets, ni ce qu'elle a fait
// récemment. Ces deux corps lisent des caches que l'espace entreprise charge
// déjà (équipes, projets, tâches, journal) : aucune requête nouvelle.
// ═══════════════════════════════════════════════════════════════════

interface WorkBodyProps {
  orgId: string;
  member: OrgMember;
  /** Équipes transverses du membre (déjà calculées par l'appelant). */
  teams: OrgTeam[];
  /** Supérieur hiérarchique : voit aussi les projets où elle a des tâches. */
  canSeeInsights: boolean;
}

const sectionTitle = 'text-caption font-bold uppercase tracking-wide text-[rgb(var(--color-text-muted))] mb-2';

export const MemberWorkBody = ({ orgId, member, teams, canSeeInsights }: WorkBodyProps) => {
  const { t } = useT('org');
  const { data: memberships = [] } = useOrgTeamMembers(orgId);
  const { data: projects = [] } = useTeamProjects(orgId);
  // Les tâches ne se lisent que pour un supérieur : un pair n'a pas à
  // connaître la charge d'un collègue, et la lecture la plus chère du produit
  // ne part pas pour lui.
  const { data: tasks = [] } = useTeamTasks(canSeeInsights ? orgId : undefined);

  const leadOf = new Set(memberships.filter((m) => m.userId === member.userId && m.isLead).map((m) => m.teamId));
  const openCountByProject = useMemo(() => {
    const map = new Map<string, number>();
    for (const task of tasks) {
      if (!task.completed && task.assigneeIds.includes(member.userId)) map.set(task.projectId, (map.get(task.projectId) ?? 0) + 1);
    }
    return map;
  }, [tasks, member.userId]);

  const involved = projects
    .filter((p) => !p.archivedAt && (p.ownerId === member.userId || openCountByProject.has(p.id)))
    .sort((a, b) => Number(b.ownerId === member.userId) - Number(a.ownerId === member.userId) || a.name.localeCompare(b.name));

  return (
    // Grand format (maquette A, 2026-09-28) : équipes à gauche, projets à droite.
    <div className="grid gap-5 sm:grid-cols-[220px_minmax(0,1fr)]">
      <section>
        <h3 className={sectionTitle}><Users2 size={12} className="inline-block mr-1 align-[-1px]" aria-hidden="true" />{t('popups.member.teams')}</h3>
        {teams.length === 0 ? (
          <p className="text-sm text-[rgb(var(--color-text-muted))]">{t('popups.member.noTeam')}</p>
        ) : (
          <ul className="space-y-1.5">
            {teams.map((team) => (
              <li key={team.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[rgb(var(--color-border))] text-sm text-[rgb(var(--color-text-primary))]">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: team.color }} aria-hidden="true" />
                <span className="flex-1 min-w-0 truncate">{team.name}</span>
                {leadOf.has(team.id) && (
                  <span className="inline-flex items-center gap-0.5 shrink-0 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    <Crown size={11} aria-hidden="true" /> {t('popups.member.lead')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className={sectionTitle}><FolderKanban size={12} className="inline-block mr-1 align-[-1px]" aria-hidden="true" />{t('popups.member.projects')}</h3>
        {involved.length === 0 ? (
          <p className="text-sm text-[rgb(var(--color-text-muted))]">{t('popups.member.noProject')}</p>
        ) : (
          <ul className="space-y-1.5">
            {involved.map((p) => {
              const open = openCountByProject.get(p.id) ?? 0;
              return (
                <li key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[rgb(var(--color-border))]">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${projectColor(p.color).dot}`} aria-hidden="true" />
                  <span className="flex-1 min-w-0 truncate text-sm text-[rgb(var(--color-text-primary))]">{p.name}</span>
                  {p.ownerId === member.userId && (
                    <span className="text-caption font-semibold text-[rgb(var(--color-accent))] shrink-0">{t('popups.member.owner')}</span>
                  )}
                  {open > 0 && (
                    <span className="text-caption text-[rgb(var(--color-text-muted))] shrink-0">{t('popups.member.openTasks', { count: open })}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {!canSeeInsights && (
          <p className="mt-2 text-caption text-[rgb(var(--color-text-muted))]">{t('popups.member.projectsPeerHint')}</p>
        )}
      </section>
    </div>
  );
};

const FIELD_KEY: Record<TeamActivityField, `popups.history.field.${TeamActivityField}`> = {
  status: 'popups.history.field.status',
  assignees: 'popups.history.field.assignees',
  deadline: 'popups.history.field.deadline',
  priority: 'popups.history.field.priority',
  project: 'popups.history.field.project',
  name: 'popups.history.field.name',
  created: 'popups.history.field.created',
};

const FIELD_ORDER: TeamActivityField[] = ['created', 'status', 'assignees', 'deadline', 'priority', 'project', 'name'];

/** Fenêtre de l'historique d'une personne : trente jours, bornée côté serveur (500 lignes). */
const HISTORY_DAYS = 30;

export const MemberHistoryBody = ({ orgId, member }: { orgId: string; member: OrgMember }) => {
  const { t } = useT('org');
  // Borne STABLE (elle entre dans la clé de cache) : calculée une fois, au jour près.
  const [since] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - HISTORY_DAYS);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  });
  const { data: activity = [], isLoading } = useOrgActivity(orgId, since);
  const { data: tasks = [] } = useTeamTasks(orgId);
  const taskName = useMemo(() => new Map(tasks.map((task) => [task.id, task.name])), [tasks]);
  const mine = activity.filter((a) => a.actorId === member.userId).slice(0, 60);
  const [filter, setFilter] = useState<TeamActivityField | null>(null);

  if (isLoading) return <p className="text-sm text-[rgb(var(--color-text-muted))] py-6 text-center">{t('popups.history.loading')}</p>;
  if (mine.length === 0) {
    return (
      <p className="text-sm text-[rgb(var(--color-text-muted))] py-6 text-center">
        <History size={16} className="inline-block mr-1.5 align-[-3px]" aria-hidden="true" />
        {t('popups.member.historyEmpty', { days: HISTORY_DAYS })}
      </p>
    );
  }

  const fields = FIELD_ORDER.filter((f) => mine.some((a) => a.field === f));
  const shown = filter ? mine.filter((a) => a.field === filter) : mine;
  const chip = (active: boolean) =>
    `px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
      active
        ? 'border-transparent bg-[rgb(var(--color-accent)/0.12)] text-[rgb(var(--color-accent))]'
        : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
    }`;

  // Grand format (maquette B, 2026-09-28) : journal filtrable par champ, en tableau.
  return (
    <>
      <p className="text-caption text-[rgb(var(--color-text-muted))] mb-3">{t('popups.member.historyScope', { days: HISTORY_DAYS })}</p>
      {fields.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button type="button" aria-pressed={filter === null} onClick={() => setFilter(null)} className={chip(filter === null)}>
            {t('popups.member.filterAll')}
          </button>
          {fields.map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`${chip(filter === f)} capitalize`}>
              {t(FIELD_KEY[f])}
            </button>
          ))}
        </div>
      )}
      <table className="w-full text-sm table-fixed">
        <thead>
          <tr className="text-left text-caption uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
            <th scope="col" className="font-semibold pb-2 w-32">{t('popups.member.colWhen')}</th>
            <th scope="col" className="font-semibold pb-2 w-28">{t('popups.member.colField')}</th>
            <th scope="col" className="font-semibold pb-2">{t('popups.member.colTask')}</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((entry) => (
            <tr key={entry.id} className="border-t border-[rgb(var(--color-border))]">
              <td className="py-2.5 pr-2 text-caption text-[rgb(var(--color-text-muted))]">
                {formatDistanceToNow(parseISO(entry.createdAt), { addSuffix: true, locale: getDateLocale() })}
              </td>
              <td className="py-2.5 pr-2 text-[rgb(var(--color-text-secondary))] capitalize">{t(FIELD_KEY[entry.field])}</td>
              <td className="py-2.5 text-[rgb(var(--color-text-primary))] truncate">
                {taskName.get(entry.taskId) ?? t('popups.member.hiddenTask')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
};
