// Santé déclarée d'un projet (mig. 190) — « dans les temps », « à risque »,
// « en difficulté », avec une note. C'est une DÉCLARATION de qui pilote, pas
// un calcul : l'avancement dit combien de tâches sont faites, la santé dit si
// le projet tiendra. Passer à « à risque » prévient le responsable, les
// co-pilotes et les suiveurs (notification `project_at_risk`).

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Activity } from 'lucide-react';
import { getDateLocale } from '@/i18n/format';
import { useUpdateTeamProject, type TeamProject, type TeamProjectHealth } from '@/modules/team-projects';
import type { OrgMember } from '@/modules/organizations';
import { useT } from '@/i18n/useT';

const PROJECT_HEALTH_META: Record<TeamProjectHealth, { dot: string; soft: string }> = {
  on_track: { dot: 'bg-emerald-500', soft: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  at_risk: { dot: 'bg-amber-500', soft: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  off_track: { dot: 'bg-red-500', soft: 'bg-red-500/10 text-red-600 dark:text-red-400' },
};

const HEALTHS: TeamProjectHealth[] = ['on_track', 'at_risk', 'off_track'];

/** Pastille de santé, réutilisée par la page projet et le portefeuille. */
export const ProjectHealthBadge = ({ health }: { health: TeamProjectHealth | null | undefined }) => {
  const { t: pf } = useT('portfolio');
  if (!health) return null;
  return (
    <span className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full ${PROJECT_HEALTH_META[health].soft}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${PROJECT_HEALTH_META[health].dot}`} aria-hidden="true" />
      {pf(`health.${health}`)}
    </span>
  );
};

interface ProjectHealthSectionProps {
  project: TeamProject;
  members: OrgMember[];
  canEdit: boolean;
}

const ProjectHealthSection = ({ project, members, canEdit }: ProjectHealthSectionProps) => {
  const { t: pf } = useT('portfolio');
  const update = useUpdateTeamProject(project.orgId);
  const [editing, setEditing] = useState(false);
  const [health, setHealth] = useState<TeamProjectHealth | ''>(project.health ?? '');
  const [note, setNote] = useState(project.healthNote ?? '');
  const author = project.healthUpdatedBy ? members.find((m) => m.userId === project.healthUpdatedBy) : undefined;

  const startEdit = () => {
    setHealth(project.health ?? '');
    setNote(project.healthNote ?? '');
    setEditing(true);
  };

  const save = () => {
    update.mutate(
      { projectId: project.id, input: { health: health || null, healthNote: note.trim() || null } },
      { onSuccess: () => setEditing(false) },
    );
  };

  return (
    <section aria-labelledby={`health-${project.id}`} className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 id={`health-${project.id}`} className="flex items-center gap-1.5 text-sm font-bold text-[rgb(var(--color-text-primary))]">
          <Activity size={14} aria-hidden="true" /> {pf('health.title')}
        </h3>
        {canEdit && !editing && (
          <button type="button" onClick={startEdit} className="text-xs font-semibold text-indigo-500 hover:underline">
            {project.health ? pf('health.update') : pf('health.declare')}
          </button>
        )}
      </div>

      {!editing ? (
        project.health ? (
          <div className="space-y-1.5 text-sm">
            <ProjectHealthBadge health={project.health} />
            {project.healthNote && (
              <p className="whitespace-pre-line text-[rgb(var(--color-text-secondary))]">{project.healthNote}</p>
            )}
            {project.healthUpdatedAt && (
              <p className="text-xs text-[rgb(var(--color-text-muted))]">
                {pf('health.updatedBy', {
                  name: author?.displayName ?? pf('health.someone'),
                  date: format(parseISO(project.healthUpdatedAt), 'd MMM yyyy', { locale: getDateLocale() }),
                })}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-[rgb(var(--color-text-muted))]">{pf('health.none')}</p>
        )
      ) : (
        <div className="space-y-2">
          <div role="radiogroup" aria-label={pf('health.title')} className="flex flex-wrap gap-1.5">
            {HEALTHS.map((h) => (
              <button
                key={h}
                type="button"
                role="radio"
                aria-checked={health === h}
                onClick={() => setHealth(health === h ? '' : h)}
                className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-semibold border transition-colors ${
                  health === h
                    ? `${PROJECT_HEALTH_META[h].soft} border-transparent`
                    : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${PROJECT_HEALTH_META[h].dot}`} aria-hidden="true" />
                {pf(`health.${h}`)}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="sr-only">{pf('health.noteLabel')}</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder={pf('health.notePlaceholder')}
              className="w-full rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-2 text-sm text-[rgb(var(--color-text-primary))]"
            />
          </label>
          {(health === 'at_risk' || health === 'off_track') && (
            <p className="text-xs text-[rgb(var(--color-text-muted))]">{pf('health.notifyHint')}</p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="h-8 px-3 rounded-lg text-xs font-semibold text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]">
              {pf('health.cancel')}
            </button>
            <button type="button" onClick={save} disabled={update.isPending} className="h-8 px-3 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">
              {pf('health.save')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default ProjectHealthSection;
