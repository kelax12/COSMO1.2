import { useState } from 'react';
import { Trash2, Zap } from 'lucide-react';
import {
  useAutomations, useCreateAutomation, useDeleteAutomation, useSetAutomationEnabled,
  type Automation, type AutomationAction, type AutomationTrigger,
} from '@/modules/org-config';
import type { OrgMember } from '@/modules/organizations';
import type { TeamProject, TeamTaskStatus } from '@/modules/team-projects';
import { useT } from '@/i18n/useT';
import { STATUS_ORDER, STATUS_META } from '../team-projects.helpers';
import { FIELD, BUTTON, ICON_BTN, LABEL, HINT } from './config-ui';

interface Props {
  orgId: string;
  members: OrgMember[];
  projects: TeamProject[];
  /** Fixé : les règles d'UN projet (page projet). Absent : toutes (Paramètres). */
  projectId?: string;
  canEdit: boolean;
}

/**
 * Automatisations simples (mig. 198) : un déclencheur, une action. La base les
 * applique dans un trigger sur la tâche qu'on est en train d'écrire ; la démo
 * rejoue la même règle (`applyAutomations`).
 */
const AutomationsEditor = ({ orgId, members, projects, projectId, canEdit }: Props) => {
  const { t } = useT('orgConfig');
  const org = useT('org');
  const { data: all = [], isSuccess: loaded } = useAutomations(orgId);
  const create = useCreateAutomation(orgId);
  const toggle = useSetAutomationEnabled(orgId);
  const remove = useDeleteAutomation(orgId);
  const rules = projectId ? all.filter((r) => r.projectId === projectId) : all;

  const [name, setName] = useState('');
  const [scope, setScope] = useState(projectId ?? '');
  const [trigger, setTrigger] = useState<AutomationTrigger>('task_created');
  const [triggerStatus, setTriggerStatus] = useState<TeamTaskStatus>('review');
  const [action, setAction] = useState<AutomationAction>('set_priority');
  const [value, setValue] = useState('2');

  const statusLabel = (s: string) => org.t(STATUS_META[s as TeamTaskStatus].labelKey as Parameters<typeof org.t>[0]);
  const memberName = (id: string) => members.find((m) => m.userId === id)?.displayName ?? '?';
  const describe = (r: Automation) => {
    const when = r.triggerKind === 'task_created' ? t('automations.triggerCreated') : t('automations.triggerStatus', { status: statusLabel(r.triggerValue ?? 'todo') });
    const then = r.actionKind === 'add_assignee'
      ? t('automations.actionAssign', { name: memberName(r.actionValue) })
      : r.actionKind === 'notify_member'
        ? t('automations.actionNotify', { name: r.actionValue === 'assignees' ? t('automations.notifyAssignees') : memberName(r.actionValue) })
        : r.actionKind === 'set_priority' ? t('automations.actionPriority', { p: r.actionValue }) : t('automations.actionStatus', { status: statusLabel(r.actionValue) });
    return `${t('automations.when')} ${when}, ${then}`;
  };

  const echo = trigger === 'status_changed' && action === 'set_status';
  const valid = name.trim().length > 0 && !!value && !echo;
  const changeAction = (a: AutomationAction) => {
    setAction(a);
    setValue(a === 'set_priority' ? '2' : a === 'set_status' ? 'in_progress' : a === 'notify_member' ? 'assignees' : members[0]?.userId ?? '');
  };
  const submit = () => {
    if (!valid) return;
    create.mutate({
      projectId: scope || null, name: name.trim(), triggerKind: trigger,
      triggerValue: trigger === 'status_changed' ? triggerStatus : null, actionKind: action, actionValue: value,
    }, { onSuccess: () => setName('') });
  };

  return (
    <div className="space-y-3">
      {!loaded ? null : rules.length === 0 ? (
        <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('automations.empty')}</p>
      ) : (
        <ul className="divide-y divide-[rgb(var(--color-border))] rounded-xl border border-[rgb(var(--color-border))]">
          {rules.map((r) => (
            <li key={r.id} className="flex items-center gap-2 px-3 py-2">
              <Zap size={14} aria-hidden="true" className={r.enabled ? 'text-amber-500' : 'text-[rgb(var(--color-text-muted))]'} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-[rgb(var(--color-text-primary))] truncate">{r.name}</span>
                <span className="block text-caption text-[rgb(var(--color-text-muted))]">
                  {describe(r)}{r.projectId ? ` · ${projects.find((p) => p.id === r.projectId)?.name ?? ''}` : ''}
                </span>
              </span>
              <label className="inline-flex items-center gap-1.5 text-caption text-[rgb(var(--color-text-muted))]">
                <input type="checkbox" className="w-4 h-4 accent-[rgb(var(--color-accent))]" checked={r.enabled}
                  disabled={!canEdit || toggle.isPending} aria-label={t('automations.toggle', { name: r.name })}
                  onChange={(e) => toggle.mutate({ id: r.id, enabled: e.target.checked })} />
                {!r.enabled && t('automations.paused')}
              </label>
              {canEdit && (
                <button type="button" className={ICON_BTN} aria-label={t('automations.remove', { name: r.name })}
                  disabled={remove.isPending} onClick={() => remove.mutate(r.id)}>
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form className="grid sm:grid-cols-2 gap-2 items-end" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label className={LABEL}>
            {t('automations.name')}
            <input className={FIELD} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </label>
          {!projectId && (
            <label className={LABEL}>
              {t('automations.scope')}
              <select className={FIELD} value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="">{t('automations.scopeOrg')}</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          )}
          <label className={LABEL}>
            {t('automations.when')}
            <select className={FIELD} value={trigger === 'task_created' ? 'created' : triggerStatus}
              onChange={(e) => {
                if (e.target.value === 'created') setTrigger('task_created');
                else { setTrigger('status_changed'); setTriggerStatus(e.target.value as TeamTaskStatus); }
              }}>
              <option value="created">{t('automations.triggerCreated')}</option>
              {STATUS_ORDER.map((s) => <option key={s} value={s}>{t('automations.triggerStatus', { status: statusLabel(s) })}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className={LABEL}>
              {t('automations.then')}
              <select className={FIELD} value={action} onChange={(e) => changeAction(e.target.value as AutomationAction)}>
                <option value="set_priority">{t('automations.kindPriority')}</option>
                <option value="add_assignee">{t('automations.kindAssign')}</option>
                <option value="notify_member">{t('automations.kindNotify')}</option>
                <option value="set_status" disabled={trigger === 'status_changed'}>{t('automations.kindStatus')}</option>
              </select>
            </label>
            <label className={LABEL}>
              <span aria-hidden="true">&nbsp;</span>
              <select className={FIELD} value={value} aria-label={t('automations.then')} onChange={(e) => setValue(e.target.value)}>
                {action === 'set_priority' && [1, 2, 3, 4, 5].map((p) => <option key={p} value={String(p)}>P{p}</option>)}
                {action === 'set_status' && STATUS_ORDER.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                {action === 'notify_member' && <option value="assignees">{t('automations.notifyAssignees')}</option>}
                {(action === 'add_assignee' || action === 'notify_member') && members.map((m) => <option key={m.userId} value={m.userId}>{m.displayName}</option>)}
              </select>
            </label>
          </div>
          {echo && <p className="text-xs text-amber-600 dark:text-amber-400 sm:col-span-2" role="status">{t('automations.echo')}</p>}
          <div className="sm:col-span-2 flex items-center justify-between gap-2">
            <p className={HINT}>{projectId ? '' : t('automations.limitAuthor')}</p>
            <button type="submit" className={BUTTON} disabled={!valid || create.isPending}>{t('automations.add')}</button>
          </div>
        </form>
      )}
    </div>
  );
};

export default AutomationsEditor;
