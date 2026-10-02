import { useState, type ReactNode } from 'react';
import { ChevronDown, CircleCheckBig, Link2, UserRoundCheck } from 'lucide-react';
import type { TeamTask } from '@/modules/team-projects';
import type { OrgMember } from '@/modules/organizations';
import { useT } from '@/i18n/useT';
import { formatDuration } from './team-projects.helpers';
import { WEEK_CAPACITY_MINUTES, type ActivityDigest, type WaitingOnEntry, type WeekLoad } from './my-work.helpers';
import { CARD, MemberInitials, TaskLink, TITLE } from './MyWorkCards';

// Cartes ajoutées à l'Aperçu le 2026-10-02 (N1, N2, maquette 8 C), à part de
// `MyWorkCards.tsx` pour qu'il reste sous le plafond de 600 lignes.

// ─── Ma charge de la semaine (N1) ───────────────────────────────────

/**
 * Le temps estimé de ce qui tombe sous sept jours (retards compris), rapporté
 * à une semaine de 35 h. Le champ était saisi puis rangé dans un sous-titre ;
 * il répond pourtant à « est-ce que ça tient ? ». Les tâches sans estimation
 * sont annoncées : la somme les ignore, elle ne doit pas le cacher.
 */
export const WeekLoadCard = ({ load }: { load: WeekLoad }) => {
  const { t: tOrgAdmin, tp: tpOrgAdmin } = useT('orgAdmin');
  if (load.tasks === 0) return null;
  const ratio = load.minutes / WEEK_CAPACITY_MINUTES;
  const percent = Math.min(100, Math.round(ratio * 100));
  const tone = ratio > 1 ? 'bg-red-500' : ratio > 0.8 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className={CARD}>
      <h3 className={`${TITLE} mb-2`}>{tOrgAdmin('apercu.weekLoad.title')}</h3>
      <p className="text-sm text-[rgb(var(--color-text-secondary))]">
        <span className="text-lg font-bold tabular-nums text-[rgb(var(--color-text-primary))]">{formatDuration(load.minutes) || '0 min'}</span>{' '}
        {tOrgAdmin('apercu.weekLoad.ofCapacity')}
      </p>
      <span
        className="mt-2 block h-2 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden"
        role="img"
        aria-label={tOrgAdmin('apercu.weekLoad.percent', { percent: Math.round(ratio * 100) })}
      >
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
      </span>
      <p className="mt-1.5 text-xs text-[rgb(var(--color-text-muted))]">
        {tpOrgAdmin('apercu.weekLoad.tasks', load.tasks)}
        {load.unestimated > 0 && <> · {tpOrgAdmin('apercu.weekLoad.unestimated', load.unestimated)}</>}
      </p>
    </div>
  );
};

// ─── J'attends quelqu'un (N2) ───────────────────────────────────────

interface WaitingOnProps {
  entries: WaitingOnEntry[];
  members: OrgMember[];
  onOpenTask: (task: TeamTask) => void;
}

/**
 * Miroir de « En attente de moi » : ce qui dépend d'autres personnes. Ouvrir
 * la tâche mène aux commentaires, où l'on relance avec une mention.
 */
export const WaitingOnOthersCard = ({ entries, members, onOpenTask }: WaitingOnProps) => {
  const { t: tOrgAdmin, tp: tpOrgAdmin } = useT('orgAdmin');
  const fullName = (id: string) =>
    members.find((x) => x.userId === id)?.displayName ?? tOrgAdmin('activity.someMember');
  return (
    <section className={CARD} aria-labelledby="waiting-on-others-title">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 id="waiting-on-others-title" className={TITLE}>{tOrgAdmin('apercu.waitingOn.title')}</h3>
        {entries.length > 0 && (
          <span className="text-caption font-semibold px-2 py-0.5 rounded-full bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))]">
            {entries.length}
          </span>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="flex items-center gap-2 text-xs text-[rgb(var(--color-text-muted))] py-2">
          <CircleCheckBig size={15} className="text-emerald-500" aria-hidden="true" />
          {tOrgAdmin('apercu.waitingOn.empty')}
        </p>
      ) : (
        <ul>
          {entries.slice(0, 6).map(({ task, reason, idleDays }) => {
            const who = task.assigneeIds[0];
            return (
              <li key={task.id}>
                <TaskLink onClick={() => onOpenTask(task)}>
                  {who ? <MemberInitials name={fullName(who)} /> : <span className="w-6 shrink-0" />}
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-sm text-[rgb(var(--color-text-primary))]">{task.name}</span>
                    <span className="flex items-center gap-1 text-caption text-[rgb(var(--color-text-muted))]">
                      {reason === 'blocked' ? <Link2 size={11} aria-hidden="true" /> : <UserRoundCheck size={11} aria-hidden="true" />}
                      {tOrgAdmin(reason === 'blocked' ? 'apercu.waitingOn.blocked' : 'apercu.waitingOn.delegated')}
                    </span>
                  </span>
                  <span className={`text-xs shrink-0 tabular-nums ${idleDays >= 7 ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-[rgb(var(--color-text-muted))]'}`}>
                    {tpOrgAdmin('apercu.waitingOn.idle', idleDays)}
                  </span>
                </TaskLink>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

// ─── Digest de l'activité (maquette 8 C) ────────────────────────────

/**
 * Résumé des dernières 24 h en tête, fil détaillé replié dessous : on lit le
 * chiffre d'abord, on déroule si on veut savoir qui.
 */
export const ActivityDigestCard = ({ digest, children }: { digest: ActivityDigest; children: ReactNode }) => {
  const { t: tOrgAdmin, tp: tpOrgAdmin } = useT('orgAdmin');
  const [expanded, setExpanded] = useState(false);
  const quiet = digest.completed === 0 && digest.created === 0;
  return (
    <section className={CARD} aria-labelledby="activity-digest-title">
      <h3 id="activity-digest-title" className={`${TITLE} mb-2`}>{tOrgAdmin('apercu.digest.title')}</h3>
      {quiet ? (
        <p className="text-xs text-[rgb(var(--color-text-muted))]">{tOrgAdmin('apercu.digest.quiet')}</p>
      ) : (
        <p className="flex flex-wrap gap-1.5">
          {digest.completed > 0 && (
            <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              {tpOrgAdmin('apercu.digest.completed', digest.completed)}
            </span>
          )}
          {digest.created > 0 && (
            <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-[rgb(var(--color-accent)/0.12)] text-[rgb(var(--color-accent))]">
              {tpOrgAdmin('apercu.digest.created', digest.created)}
            </span>
          )}
        </p>
      )}
      {digest.aboutMe > 0 && (
        <p className="mt-2 text-xs text-[rgb(var(--color-text-secondary))]">{tpOrgAdmin('apercu.digest.aboutMe', digest.aboutMe)}</p>
      )}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="mt-2 min-h-9 inline-flex items-center gap-1 -ml-1 px-1 rounded-md text-xs font-medium text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))] transition-colors"
      >
        <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
        {tOrgAdmin(expanded ? 'apercu.digest.hide' : 'apercu.digest.show')}
      </button>
      {expanded && <div className="mt-2">{children}</div>}
    </section>
  );
};
