// Dépendances entre projets (mig. 153, M2). Même vocabulaire que les tâches
// (mig. 108) : ce projet ATTEND ceux dont il dépend, et BLOQUE ceux qui
// dépendent de lui. Le serveur refuse un cycle, la démo aussi.

import { Link2, X } from 'lucide-react';
import {
  useAddProjectDependency, useRemoveProjectDependency,
  type TeamProject, type TeamProjectDependency,
} from '@/modules/team-projects';
import { projectColor } from './team-projects.helpers';
import { PROJECT_STATUS_META, openBlockers } from './portfolio.helpers';
import { useT } from '@/i18n/useT';

interface ProjectDependenciesSectionProps {
  orgId: string;
  project: TeamProject;
  /** Projets visibles non archivés — candidats et noms des arêtes. */
  projects: TeamProject[];
  dependencies: TeamProjectDependency[];
  canEdit: boolean;
  onOpenProject: (projectId: string) => void;
}

const ProjectDependenciesSection = ({
  orgId, project, projects, dependencies, canEdit, onOpenProject,
}: ProjectDependenciesSectionProps) => {
  const { t: pf, tp: tpf } = useT('portfolio');
  const add = useAddProjectDependency(orgId);
  const remove = useRemoveProjectDependency(orgId);
  const byId = new Map(projects.map((p) => [p.id, p]));

  const waitsFor = dependencies
    .filter((d) => d.projectId === project.id)
    .map((d) => byId.get(d.dependsOnId))
    .filter((p): p is TeamProject => !!p);
  const blocks = dependencies
    .filter((d) => d.dependsOnId === project.id)
    .map((d) => byId.get(d.projectId))
    .filter((p): p is TeamProject => !!p);
  const candidates = projects.filter(
    (p) => p.id !== project.id && !p.archivedAt && !waitsFor.some((w) => w.id === p.id),
  );
  const waiting = openBlockers(project.id, dependencies, projects).length;

  // Une fonction de rendu, pas un composant déclaré dans le rendu : ce dernier
  // serait un NOUVEAU type à chaque rendu, donc démonté et remonté à chaque fois.
  const renderRow = (other: TeamProject, onRemove?: () => void) => {
    const status = other.status ?? 'active';
    return (
      <li key={other.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[rgb(var(--color-hover))]/60">
        <span className={`w-2 h-2 rounded-full shrink-0 ${projectColor(other.color).dot}`} aria-hidden="true" />
        <button type="button" onClick={() => onOpenProject(other.id)} className="flex-1 min-w-0 text-left text-sm truncate text-[rgb(var(--color-text-primary))] hover:underline">
          {other.name}
        </button>
        <span className={`text-caption font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${PROJECT_STATUS_META[status].soft}`}>
          {pf(`status.${status}`)}
        </span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={pf('deps.remove', { name: other.name })}
            className="w-7 h-7 rounded-md flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-red-500 hover:bg-red-500/10 shrink-0"
          >
            <X size={13} aria-hidden="true" />
          </button>
        )}
      </li>
    );
  };

  return (
    <section aria-labelledby={`deps-${project.id}`} className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
      <h3 id={`deps-${project.id}`} className="flex items-center gap-1.5 text-sm font-bold text-[rgb(var(--color-text-primary))] mb-1">
        <Link2 size={14} aria-hidden="true" /> {pf('deps.title')}
      </h3>
      {waiting > 0 && (
        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-2">{tpf('deps.waiting', waiting)}</p>
      )}

      {waitsFor.length === 0 && blocks.length === 0 && (
        <p className="text-xs text-[rgb(var(--color-text-muted))] mb-3">{pf('deps.none')}</p>
      )}

      {waitsFor.length > 0 && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))] mt-2 mb-1">{pf('deps.blockedBy')}</p>
          <ul className="space-y-0.5">
            {waitsFor.map((other) =>
              renderRow(other, canEdit ? () => remove.mutate({ projectId: project.id, dependsOnId: other.id }) : undefined),
            )}
          </ul>
        </>
      )}

      {blocks.length > 0 && (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))] mt-3 mb-1">{pf('deps.blocks')}</p>
          <ul className="space-y-0.5">
            {blocks.map((other) => renderRow(other))}
          </ul>
        </>
      )}

      {canEdit && candidates.length > 0 && (
        <div className="mt-3">
          <label htmlFor={`deps-add-${project.id}`} className="sr-only">{pf('deps.add')}</label>
          <select
            id={`deps-add-${project.id}`}
            value=""
            onChange={(e) => { if (e.target.value) add.mutate({ projectId: project.id, dependsOnId: e.target.value }); }}
            className="w-full h-10 px-3 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm text-[rgb(var(--color-text-primary))]"
          >
            <option value="">{pf('deps.pick')}</option>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}
    </section>
  );
};

export default ProjectDependenciesSection;
