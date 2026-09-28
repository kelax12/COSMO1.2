import { Download } from 'lucide-react';
import type { OrgMember } from '@/modules/organizations';
import { useTeamProjects, useTeamTaskPages } from '@/modules/team-projects';
import { useTeamCategories, categoryPath, formatPath } from '@/modules/team-categories';
import { useT } from '@/i18n/useT';
import { taskDisplayStatus } from './team-projects.helpers';
import { buildTasksCsv } from './team-tasks-table.helpers';

interface OrgTasksExportSectionProps {
  orgId: string;
  members: OrgMember[];
}

/**
 * Export CSV des tâches de l'organisation, dans Paramètres (2026-09-28) : le
 * bouton quitte la barre de l'onglet Tâches. Il exporte TOUTES les tâches
 * lisibles (lecture complète, plafonnée par page), sans filtre d'écran.
 */
const OrgTasksExportSection = ({ orgId, members }: OrgTasksExportSectionProps) => {
  const { t } = useT('org');
  const pf = useT('portfolio');
  const { data: projects = [] } = useTeamProjects(orgId);
  const { data: categories = [] } = useTeamCategories(orgId);
  const { data: taskPages, isLoading } = useTeamTaskPages(orgId, null);
  const tasks = taskPages?.pages.flat() ?? [];

  const exportCsv = async () => {
    const { downloadCSV } = await import('@/lib/csv-export');
    const h = pf.t;
    const projectById = new Map(projects.map((p) => [p.id, p]));
    const memberById = new Map(members.map((m) => [m.userId, m]));
    const { headers, rows } = buildTasksCsv(tasks, {
      headers: {
        name: h('taskTable.exportHeaders.name'), project: h('taskTable.exportHeaders.project'),
        status: h('taskTable.exportHeaders.status'), priority: h('taskTable.exportHeaders.priority'),
        start: h('taskTable.exportHeaders.start'), deadline: h('taskTable.exportHeaders.deadline'),
        duration: h('taskTable.exportHeaders.duration'), assignees: h('taskTable.exportHeaders.assignees'),
        category: h('taskTable.exportHeaders.category'), createdAt: h('taskTable.exportHeaders.createdAt'),
      },
      statusOf: (task) => t(taskDisplayStatus(task).labelKey as Parameters<typeof t>[0]),
      projectOf: (id) => projectById.get(id)?.name ?? '',
      personOf: (id) => memberById.get(id)?.displayName ?? '',
      categoryOf: (id) => (categories.some((c) => c.id === id) ? formatPath(categoryPath(id, categories)) : ''),
    });
    downloadCSV(pf.t('taskTable.exportFile'), headers, rows);
  };

  return (
    <section className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
      <h2 className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{t('orgSettings.exportTitle')}</h2>
      <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5 mb-3">{t('orgSettings.exportHint')}</p>
      <button
        type="button"
        onClick={() => void exportCsv()}
        disabled={isLoading || tasks.length === 0}
        aria-label={pf.t('taskTable.exportAria')}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[rgb(var(--color-border))] text-sm font-semibold text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Download size={14} aria-hidden="true" />
        {pf.t('taskTable.export')}
      </button>
    </section>
  );
};

export default OrgTasksExportSection;
