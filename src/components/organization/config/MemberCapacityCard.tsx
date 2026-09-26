import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { subtreeOf, type OrgMember } from '@/modules/organizations';
import { useMemberCapacities, useSetMemberCapacity } from '@/modules/org-config';
import { useT } from '@/i18n/useT';
import MemberAvatar from '../MemberAvatar';
import { formatDuration } from '../team-projects.helpers';
import { capacityLoad } from './capacity.helpers';
import { CARD, TITLE, HINT } from './config-ui';

export interface CapacityRow {
  userId: string;
  name: string;
  /** Minutes estimées restantes sur les tâches ouvertes. */
  estimatedMinutes: number;
}

interface Props {
  orgId: string;
  rows: CapacityRow[];
  members: OrgMember[];
  currentUserId?: string;
  isAdmin: boolean;
}

/**
 * Charge AU REGARD d'une capacité (audit du 2026-09-24, Statistiques). La
 * carte de charge existante compare chacun à la médiane de l'équipe ; celle-ci
 * répond à « peut-il tenir ? » : temps restant estimé / capacité hebdomadaire
 * déclarée (mig. 196). Sans capacité, rien n'est jugé.
 *
 * Qui peut la déclarer : la personne, un admin, ou quelqu'un au-dessus d'elle
 * dans la pyramide (miroir de la policy ; la base reste juge).
 */
const MemberCapacityCard = ({ orgId, rows, members, currentUserId, isAdmin }: Props) => {
  const { t } = useT('orgConfig');
  const { data: capacities = [], isSuccess: loaded } = useMemberCapacities(orgId);
  const setCapacity = useSetMemberCapacity(orgId);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const below = useMemo(() => (currentUserId ? subtreeOf(members, currentUserId) : new Set<string>()), [members, currentUserId]);
  const capacityOf = new Map(capacities.map((c) => [c.userId, c.weeklyMinutes]));
  const canEdit = (userId: string) => isAdmin || userId === currentUserId || below.has(userId);
  const memberById = new Map(members.map((m) => [m.userId, m]));
  const visible = rows.filter((r) => r.estimatedMinutes > 0 || capacityOf.has(r.userId));

  const commit = (userId: string) => {
    const hours = draft.trim() === '' ? null : Number(draft.replace(',', '.'));
    setEditing(null);
    if (hours !== null && (!Number.isFinite(hours) || hours < 0 || hours > 100)) return;
    setCapacity.mutate({ userId, weeklyMinutes: hours === null ? null : Math.round(hours * 60) });
  };

  return (
    <section className={CARD} aria-labelledby="capacity-title">
      <h3 id="capacity-title" className={TITLE}>{t('capacity.title')}</h3>
      <p className={HINT}>{t('capacity.hint')}</p>
      {!loaded ? null : visible.length === 0 ? (
        <p className="text-xs text-[rgb(var(--color-text-muted))] py-4 text-center">{t('capacity.empty')}</p>
      ) : (
        <ul className="space-y-2.5 mt-3">
          {visible.map((row) => {
            const m = memberById.get(row.userId);
            const cap = capacityOf.get(row.userId);
            const load = capacityLoad(row.estimatedMinutes, cap);
            return (
              <li key={row.userId} className="flex items-center gap-3">
                {m && <MemberAvatar avatar={m.avatar} name={m.displayName} size={26} />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="truncate text-[rgb(var(--color-text-primary))]">{row.name}</span>
                    {load.over && (
                      <span className="inline-flex items-center gap-1 text-caption font-semibold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 shrink-0">
                        <AlertTriangle size={10} aria-hidden="true" /> {t('capacity.over')}
                      </span>
                    )}
                    <span className="ml-auto text-xs tabular-nums text-[rgb(var(--color-text-muted))] shrink-0">
                      {formatDuration(row.estimatedMinutes)}
                      {load.weeks !== null && ` · ${t('capacity.weeks', { weeks: load.weeks.toLocaleString(undefined, { maximumFractionDigits: 1 }) })}`}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden" aria-hidden="true">
                    {load.weeks !== null && (
                      <div className={`h-full rounded-full ${load.over ? 'bg-red-500' : 'bg-[rgb(var(--color-accent))]'}`}
                        style={{ width: `${Math.min(100, Math.round(load.weeks * 100))}%` }} />
                    )}
                  </div>
                </div>
                {editing === row.userId ? (
                  <input
                    autoFocus
                    className="w-16 h-8 px-2 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-sm text-right"
                    inputMode="decimal"
                    aria-label={t('capacity.edit', { name: row.name })}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => commit(row.userId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commit(row.userId);
                      if (e.key === 'Escape') setEditing(null);
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    disabled={!canEdit(row.userId) || setCapacity.isPending}
                    onClick={() => { setDraft(cap !== undefined ? String(Math.round((cap / 60) * 10) / 10) : ''); setEditing(row.userId); }}
                    aria-label={t('capacity.edit', { name: row.name })}
                    className="shrink-0 min-w-16 h-8 px-2 rounded-lg border border-[rgb(var(--color-border))] text-xs text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))] disabled:hover:bg-transparent disabled:cursor-default"
                  >
                    {cap !== undefined ? `${Math.round((cap / 60) * 10) / 10} ${t('capacity.hours')}` : t('capacity.unknown')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default MemberCapacityCard;
