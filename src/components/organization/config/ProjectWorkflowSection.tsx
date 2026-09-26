import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useCreateProjectStatus, useDeleteProjectStatus, useProjectStatuses } from '@/modules/org-config';
import type { OrgMember } from '@/modules/organizations';
import type { TeamProject, TeamTaskStatus } from '@/modules/team-projects';
import { useT } from '@/i18n/useT';
import { STATUS_ORDER, STATUS_META } from '../team-projects.helpers';
import CustomFieldsEditor from './CustomFieldsEditor';
import AutomationsEditor from './AutomationsEditor';
import { CARD, TITLE, HINT, FIELD, BUTTON, ICON_BTN, LABEL } from './config-ui';

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

interface Props {
  project: TeamProject;
  members: OrgMember[];
  /** Qui peut modifier le projet (`can_edit_team_project`, mig. 190). */
  canEdit: boolean;
}

/**
 * Flux d'un projet (mig. 197, 198) : ses statuts propres, ses champs, ses
 * règles. Replié derrière un `<details>` : c'est un réglage, pas un contenu.
 */
const ProjectWorkflowSection = ({ project, members, canEdit }: Props) => {
  const { t } = useT('orgConfig');
  const org = useT('org');
  const { data: all = [], isSuccess: loaded } = useProjectStatuses(project.orgId);
  const create = useCreateProjectStatus(project.orgId);
  const remove = useDeleteProjectStatus(project.orgId);
  const statuses = all.filter((s) => s.projectId === project.id);
  const [name, setName] = useState('');
  const [mapsTo, setMapsTo] = useState<TeamTaskStatus>('in_progress');
  const [color, setColor] = useState(COLORS[0]);
  const statusLabel = (s: TeamTaskStatus) => org.t(STATUS_META[s].labelKey as Parameters<typeof org.t>[0]);

  const submit = () => {
    if (!name.trim()) return;
    create.mutate({ projectId: project.id, name: name.trim(), color, mapsTo, position: statuses.length }, { onSuccess: () => setName('') });
  };

  return (
    <details className={CARD}>
      <summary className={`${TITLE} cursor-pointer select-none`}>
        {t('statuses.title')} · {t('fields.title')} · {t('automations.title')}
      </summary>

      <div className="mt-4 space-y-5">
        <div>
          <h3 className={TITLE}>{t('statuses.title')}</h3>
          <p className={`${HINT} mb-2`}>{t('statuses.hint')}</p>
          {!loaded ? null : statuses.length === 0 ? (
            <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('statuses.empty')}</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {statuses.map((s) => (
                <li key={s.id} className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-full border border-[rgb(var(--color-border))] text-xs">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
                  <span className="text-[rgb(var(--color-text-primary))]">{s.name}</span>
                  <span className="text-[rgb(var(--color-text-muted))]">→ {statusLabel(s.mapsTo)}</span>
                  {canEdit && (
                    <button type="button" className={`${ICON_BTN} w-6 h-6`} aria-label={t('statuses.remove', { name: s.name })}
                      disabled={remove.isPending} onClick={() => remove.mutate(s.id)}>
                      <Trash2 size={12} aria-hidden="true" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
            <form className="grid sm:grid-cols-[1fr_160px_auto_auto] gap-2 items-end mt-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
              <label className={LABEL}>
                {t('statuses.name')}
                <input className={FIELD} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className={LABEL}>
                {t('statuses.mapsTo')}
                <select className={FIELD} value={mapsTo} onChange={(e) => setMapsTo(e.target.value as TeamTaskStatus)}>
                  {STATUS_ORDER.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                </select>
              </label>
              <div className="flex gap-1 pb-1.5" role="radiogroup" aria-label={t('statuses.name')}>
                {COLORS.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)}
                    className={`w-5 h-5 rounded-full ${color === c ? 'ring-2 ring-offset-1 ring-[rgb(var(--color-accent))]' : ''}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
              <button type="submit" className={BUTTON} disabled={!name.trim() || create.isPending}>{t('statuses.add')}</button>
            </form>
          )}
        </div>

        <div>
          <h3 className={TITLE}>{t('fields.title')}</h3>
          <p className={`${HINT} mb-2`}>{t('fields.hint')}</p>
          <CustomFieldsEditor orgId={project.orgId} projectId={project.id} canEdit={canEdit} />
        </div>

        <div>
          <h3 className={TITLE}>{t('automations.title')}</h3>
          <p className={`${HINT} mb-2`}>{t('automations.hint')}</p>
          <AutomationsEditor orgId={project.orgId} members={members} projects={[project]} projectId={project.id} canEdit={canEdit} />
        </div>
      </div>
    </details>
  );
};

export default ProjectWorkflowSection;
