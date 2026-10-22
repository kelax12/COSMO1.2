import { useState } from 'react';
import { CalendarDays, Download, Eye, EyeOff, Link2, Trash2 } from 'lucide-react';
import {
  useCreateWebhook, useDeleteWebhook, useOrgWebhooks, useUpdateWebhook, webhookUrlIsAllowed, WEBHOOK_EVENTS,
  type WebhookEvent, type WebhookFormat,
} from '@/modules/org-config';
import type { OrgMember } from '@/modules/organizations';
import {
  getOrgTeamsRepository, getTeamOKRsRepository, getTeamProjectsRepository,
} from '@/lib/repository.factory';
import type { TeamTask } from '@/modules/team-projects';
import { useT } from '@/i18n/useT';
import { toast } from '@/lib/toast';
import { buildOrgExport, buildTasksIcs } from './org-export';
import { CARD, TITLE, HINT, FIELD, BUTTON, GHOST, ICON_BTN, LABEL } from './config-ui';
import MenuSelect from '@/components/organization/MenuSelect';

interface Props {
  orgId: string;
  members: OrgMember[];
  currentUserId?: string;
  /** Webhooks et export complet : admins. Le calendrier (ses propres échéances) : tout le monde. */
  isAdmin: boolean;
}

const PAGE = 1000;
const MAX_PAGES = 50;

/** Toutes les tâches lisibles, page par page (mig. 191) : un export ne se tronque pas en silence. */
async function readAllTasks(orgId: string, assigneeId?: string): Promise<TeamTask[]> {
  const repo = getTeamProjectsRepository();
  const out: TeamTask[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const rows = await repo.getTasks(orgId, { limit: PAGE, offset: page * PAGE, ...(assigneeId ? { assigneeId } : {}) });
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

function downloadText(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Intégrations (audit du 2026-09-24, étape 6) : webhooks (mig. 199), export
 * complet en CSV et échéances en .ics. Admins seulement.
 */
const OrgIntegrationsCard = ({ orgId, members, currentUserId, isAdmin }: Props) => {
  const { t } = useT('orgConfig');
  // Non-admin : la RLS rendrait une liste vide, on ne la demande même pas.
  const { data: webhooks = [], isSuccess: webhooksLoaded } = useOrgWebhooks(isAdmin ? orgId : undefined);
  const create = useCreateWebhook(orgId);
  const update = useUpdateWebhook(orgId);
  const remove = useDeleteWebhook(orgId);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<WebhookFormat>('slack');
  const [events, setEvents] = useState<WebhookEvent[]>(['task.created', 'task.completed']);
  const [shown, setShown] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const eventLabel: Record<WebhookEvent, string> = {
    'task.created': t('integrations.eventCreated'),
    'task.status_changed': t('integrations.eventStatus'),
    'task.completed': t('integrations.eventCompleted'),
  };
  const urlOk = webhookUrlIsAllowed(url);
  const valid = name.trim().length > 0 && urlOk && events.length > 0;

  const submit = () => {
    if (!valid) return;
    create.mutate({ name: name.trim(), url: url.trim(), format, events }, { onSuccess: () => { setName(''); setUrl(''); } });
  };

  const exportAll = async () => {
    setExporting(true);
    try {
      const [{ downloadCSV }, projects, tasks, okrs, teams, memberships] = await Promise.all([
        import('@/lib/csv-export'),
        getTeamProjectsRepository().getProjects(orgId),
        readAllTasks(orgId),
        getTeamOKRsRepository().getAll(orgId),
        getOrgTeamsRepository().getTeams(orgId),
        getOrgTeamsRepository().getTeamMembers(orgId),
      ]);
      const files = buildOrgExport({ members, teams, memberships, projects, tasks, okrs },
        (k) => t(`integrations.exportHeaders.${k}` as 'integrations.exportHeaders.name'));
      // Un fichier par type, espacés : certains navigateurs bloquent des
      // téléchargements simultanés (même règle que `exportAllCSV`).
      files.forEach((f, i) => setTimeout(() => downloadCSV(`${t('integrations.exportFile')}-${f.name}`, f.headers, f.rows), i * 200));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const exportIcs = async () => {
    if (!currentUserId) return;
    const [tasks, projects] = await Promise.all([readAllTasks(orgId, currentUserId), getTeamProjectsRepository().getProjects(orgId)]);
    const open = tasks.filter((x) => !x.completed && x.deadline);
    if (open.length === 0) return toast.info(t('integrations.calendarEmpty'));
    const names = new Map(projects.map((p) => [p.id, p.name]));
    downloadText('cosmo-echeances.ics', buildTasksIcs(open, (id) => names.get(id) ?? ''), 'text/calendar;charset=utf-8');
  };

  return (
    <section className={CARD} aria-labelledby="org-integrations-title">
      <h2 id="org-integrations-title" className={`${TITLE} inline-flex items-center gap-1.5`}>
        <Link2 size={15} aria-hidden="true" /> {t('integrations.title')}
      </h2>
      <p className={HINT}>{t('integrations.hint')}</p>

      {isAdmin && (<>
      <h3 className="mt-4 text-caption font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">{t('integrations.webhooks')}</h3>
      {!webhooksLoaded ? null : webhooks.length === 0 ? (
        <p className="text-xs text-[rgb(var(--color-text-muted))] mt-2">{t('integrations.empty')}</p>
      ) : (
        <ul className="mt-2 divide-y divide-[rgb(var(--color-border))] rounded-xl border border-[rgb(var(--color-border))]">
          {webhooks.map((w) => (
            <li key={w.id} className="px-3 py-2 space-y-1">
              <div className="flex items-center gap-2">
                <span className="flex-1 min-w-0">
                  <span className="block text-sm text-[rgb(var(--color-text-primary))] truncate">{w.name}</span>
                  <span className="block text-caption text-[rgb(var(--color-text-muted))] truncate">
                    {w.format === 'slack' ? t('integrations.formatSlack') : t('integrations.formatJson')} · {w.events.map((e) => eventLabel[e]).join(', ')}
                    {' · '}{w.lastStatus !== null ? t('integrations.lastStatus', { status: w.lastStatus }) : t('integrations.neverSent')}
                  </span>
                </span>
                <input type="checkbox" className="w-4 h-4 accent-[rgb(var(--color-accent))]" checked={w.enabled}
                  aria-label={t('integrations.toggle', { name: w.name })} disabled={update.isPending}
                  onChange={(e) => update.mutate({ id: w.id, patch: { enabled: e.target.checked } })} />
                <button type="button" className={ICON_BTN} aria-label={t('integrations.remove', { name: w.name })}
                  disabled={remove.isPending} onClick={() => remove.mutate(w.id)}>
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
              {!w.enabled && <p className="text-caption text-amber-600 dark:text-amber-400">{t('integrations.paused')}</p>}
              {w.format === 'json' && (
                <div className="flex items-center gap-2 text-caption text-[rgb(var(--color-text-muted))]">
                  <span>{t('integrations.secret')}</span>
                  <code className="flex-1 min-w-0 truncate rounded bg-[rgb(var(--color-hover))] px-1.5 py-0.5">
                    {shown === w.id ? w.secret : '•'.repeat(24)}
                  </code>
                  <button type="button" className={GHOST} onClick={() => setShown(shown === w.id ? null : w.id)}>
                    {shown === w.id ? <EyeOff size={12} aria-hidden="true" /> : <Eye size={12} aria-hidden="true" />}
                    {shown === w.id ? t('integrations.hideSecret') : t('integrations.showSecret')}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <form className="grid sm:grid-cols-2 gap-2 mt-3 items-end" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <label className={LABEL}>
          {t('integrations.name')}
          <input className={FIELD} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className={LABEL}>
          {t('integrations.format')}
          <MenuSelect className={FIELD} value={format} onChange={(e) => setFormat(e.target.value as WebhookFormat)}>
            <option value="slack">{t('integrations.formatSlack')}</option>
            <option value="json">{t('integrations.formatJson')}</option>
          </MenuSelect>
        </label>
        <label className={`${LABEL} sm:col-span-2`}>
          {t('integrations.url')}
          <input className={FIELD} value={url} type="url" inputMode="url" spellCheck={false}
            aria-invalid={url.length > 0 && !urlOk} onChange={(e) => setUrl(e.target.value)} />
        </label>
        <fieldset className={`${LABEL} sm:col-span-2`}>
          <legend>{t('integrations.events')}</legend>
          <div className="flex flex-wrap gap-3 mt-1">
            {WEBHOOK_EVENTS.map((ev) => (
              <label key={ev} className="inline-flex items-center gap-1.5 text-sm text-[rgb(var(--color-text-primary))]">
                <input type="checkbox" className="w-4 h-4 accent-[rgb(var(--color-accent))]" checked={events.includes(ev)}
                  onChange={() => setEvents((p) => (p.includes(ev) ? p.filter((x) => x !== ev) : [...p, ev]))} />
                {eventLabel[ev]}
              </label>
            ))}
          </div>
        </fieldset>
        <p className={`${HINT} sm:col-span-2`}>{t('integrations.dataWarning')}{format === 'json' ? ` ${t('integrations.signatureHelp')}` : ''}</p>
        <div className="sm:col-span-2 flex justify-end">
          <button type="submit" className={BUTTON} disabled={!valid || create.isPending}>{t('integrations.add')}</button>
        </div>
      </form>
      </>)}

      <div className="grid sm:grid-cols-2 gap-3 mt-5">
        {isAdmin && (
        <div className="rounded-xl border border-[rgb(var(--color-border))] p-3">
          <h3 className={TITLE}>{t('integrations.export')}</h3>
          <p className={HINT}>{t('integrations.exportHint')}</p>
          <button type="button" className={`${GHOST} mt-2`} disabled={exporting} onClick={() => void exportAll()}>
            <Download size={13} aria-hidden="true" /> {exporting ? t('integrations.exporting') : t('integrations.exportRun')}
          </button>
        </div>
        )}
        <div className="rounded-xl border border-[rgb(var(--color-border))] p-3">
          <h3 className={TITLE}>{t('integrations.calendar')}</h3>
          <p className={HINT}>{t('integrations.calendarHint')}</p>
          <button type="button" className={`${GHOST} mt-2`} disabled={!currentUserId} onClick={() => void exportIcs()}>
            <CalendarDays size={13} aria-hidden="true" /> {t('integrations.calendarRun')}
          </button>
        </div>
      </div>
    </section>
  );
};

export default OrgIntegrationsCard;
