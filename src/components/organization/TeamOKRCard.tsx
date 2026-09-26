import { useEffect, useState } from 'react';
import { Building2, CornerLeftUp, Flag, Pencil, Trash2, Users } from 'lucide-react';
import type { TeamKeyResult, TeamOKR } from '@/modules/team-okrs';
import type { OkrCycle } from '@/modules/team-okrs/execution.types';
import { krProgress, krWeight, okrHealth, okrProgress, type KRProgressContext } from './okr-execution.helpers';
import { HEALTH_META } from './okr-health';
import { useT } from '@/i18n/useT';

interface TeamOKRCardProps {
  okr: TeamOKR;
  ctx: KRProgressContext;
  parentTitle?: string | null;
  childCount: number;
  cycle?: OkrCycle | null;
  teamName: (id: string) => string;
  category?: { name: string; color: string };
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCommitValue: (kr: TeamKeyResult, value: number) => void;
  onCheckin: (kr: TeamKeyResult) => void;
  /** Décalage d'alignement (vue arborescente). */
  depth?: number;
}

const HealthPill = ({ health }: { health: TeamKeyResult['health'] }) => {
  const { t } = useT('org');
  if (!health) return null;
  const meta = HEALTH_META[health];
  return (
    <span className={`inline-flex items-center gap-1 shrink-0 rounded-full px-2 py-0.5 text-caption font-semibold ${meta.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} aria-hidden="true" /> {t(meta.labelKey)}
    </span>
  );
};

const KRRow = ({ kr, ctx, onCommit, onCheckin }: {
  kr: TeamKeyResult;
  ctx: KRProgressContext;
  onCommit: (v: number) => void;
  onCheckin: () => void;
}) => {
  const { t, tp } = useT('org');
  const computed = kr.progressMode === 'tasks';
  const [value, setValue] = useState(String(kr.currentValue));
  useEffect(() => { setValue(String(kr.currentValue)); }, [kr.currentValue]);
  const numeric = Number(value);
  const live = computed ? kr : { ...kr, currentValue: Number.isNaN(numeric) ? kr.currentValue : numeric };
  const pct = Math.round(krProgress(live, ctx) * 100);
  const linked = ctx.links.filter((l) => l.krId === kr.id).length;

  const commit = () => {
    const v = Number(value);
    if (!Number.isNaN(v) && v !== kr.currentValue) onCommit(v);
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm truncate ${kr.completed ? 'line-through text-[rgb(var(--color-text-muted))]' : 'text-[rgb(var(--color-text-primary))]'}`}>
            {kr.title}
          </p>
          {krWeight(kr) !== 1 && (
            <span
              className="shrink-0 text-caption font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400"
              title={t('okrExec.weightTitle', { weight: krWeight(kr) })}
            >
              ×{krWeight(kr)}
            </span>
          )}
          <HealthPill health={kr.health} />
          <span className="ml-auto text-xs font-mono text-[rgb(var(--color-text-muted))] shrink-0">
            {computed ? `${pct} %` : `${live.currentValue}/${kr.targetValue}${kr.unit ? ` ${kr.unit}` : ''}`}
          </span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : 'bg-[rgb(var(--color-accent-solid))]'}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        {computed && (
          <p className="mt-0.5 text-caption text-[rgb(var(--color-text-muted))]">
            {linked > 0 ? tp('okrExec.computedFrom', linked) : t('okrExec.computedNoProject')}
          </p>
        )}
      </div>
      {!computed && (
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          aria-label={t('okrTab.currentValueAria', { title: kr.title })}
          className="w-16 h-8 px-2 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
      )}
      <button
        type="button"
        onClick={onCheckin}
        aria-label={t('okrExec.checkinFor', { title: kr.title })}
        title={t('okrExec.checkinHeading')}
        className="min-w-11 min-h-11 flex items-center justify-center rounded-lg text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-hover))]"
      >
        <Flag size={15} aria-hidden="true" />
      </button>
    </div>
  );
};

/**
 * Un objectif et ses KR (mig. 160, M9) : progression calculée ou saisie,
 * état déclaré au dernier point d'étape, objectif auquel il contribue.
 */
const TeamOKRCard = ({
  okr, ctx, parentTitle, childCount, cycle, teamName, category, canEdit, canDelete,
  onEdit, onDelete, onCommitValue, onCheckin, depth = 0,
}: TeamOKRCardProps) => {
  const { t, tp } = useT('org');
  const avg = okrProgress(okr.keyResults, ctx);
  const health = okrHealth(okr.keyResults);

  return (
    <section
      className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4"
      style={depth > 0 ? { marginLeft: `${Math.min(depth, 4) * 1.25}rem` } : undefined}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {category && (
              <span
                className="inline-flex items-center gap-1 text-caption font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide"
                style={{ backgroundColor: `${category.color}1a`, color: category.color }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: category.color }} aria-hidden="true" />
                {category.name}
              </span>
            )}
            <h3 className="text-base font-bold text-[rgb(var(--color-text-primary))] truncate">{okr.title}</h3>
            {health !== 'none' && <HealthPill health={health} />}
          </div>
          {parentTitle && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-[rgb(var(--color-text-muted))]">
              <CornerLeftUp size={12} aria-hidden="true" /> {t('okrExec.contributesTo', { title: parentTitle })}
            </p>
          )}
          {okr.description && <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">{okr.description}</p>}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {cycle && (
              <span className="inline-flex items-center text-caption font-medium px-2 py-0.5 rounded-full bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))]">
                {cycle.name}
              </span>
            )}
            {okr.teamIds.length === 0 ? (
              <span className="inline-flex items-center gap-1 text-caption font-medium px-2 py-0.5 rounded-full border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))]">
                <Building2 size={11} aria-hidden="true" /> {t('common.orgWideBadge')}
              </span>
            ) : (
              okr.teamIds.map((tid) => (
                <span key={tid} className="inline-flex items-center gap-1 text-caption font-medium px-2 py-0.5 rounded-full bg-[rgb(var(--color-accent-solid))]/10 text-blue-600 dark:text-blue-400">
                  <Users size={11} aria-hidden="true" /> {teamName(tid)}
                </span>
              ))
            )}
            {childCount > 0 && (
              <span className="text-caption text-[rgb(var(--color-text-muted))]">{tp('okrExec.childCount', childCount)}</span>
            )}
          </div>
        </div>
        <span className="text-lg font-bold text-blue-600 dark:text-blue-400 shrink-0">{avg}%</span>
        {(canEdit || canDelete) && (
          <div className="flex items-center gap-1 shrink-0">
            {canEdit && (
              <button
                type="button"
                onClick={onEdit}
                aria-label={t('common.editOkrAria', { title: okr.title })}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-blue-500 hover:bg-[rgb(var(--color-accent-solid-hover))]/10 transition-colors"
              >
                <Pencil size={15} aria-hidden="true" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={onDelete}
                aria-label={t('common.deleteOkrAria', { title: okr.title })}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-red-500 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="space-y-3">
        {okr.keyResults.map((kr) => (
          <KRRow
            key={kr.id}
            kr={kr}
            ctx={ctx}
            onCommit={(v) => onCommitValue(kr, v)}
            onCheckin={() => onCheckin(kr)}
          />
        ))}
      </div>
    </section>
  );
};

export default TeamOKRCard;
