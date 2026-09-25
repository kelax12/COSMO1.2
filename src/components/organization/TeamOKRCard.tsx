// Carte d'un objectif d'entreprise. Extraite de `TeamOKRTab` quand l'OKR a
// rejoint l'exécution (mig. 160) : cycle, objectif auquel il contribue, KR
// reliés à des projets et points d'étape. L'onglet garde le filtrage et les
// catégories ; la carte, la lecture d'UN objectif.

import { useEffect, useState } from 'react';
import { Target, Trash2, Pencil, Users, Building2, CalendarRange, CornerLeftUp, Activity } from 'lucide-react';
import type { KRProjectLink, OkrCycle, TeamKeyResult, TeamOKR } from '@/modules/team-okrs';
import type { TeamProjectTaskStats } from '@/modules/team-projects';
import { useT } from '@/i18n/useT';
import { effectiveKrRatio, krTaskProgress, krWeight, okrRatioPercent } from './okr-execution.helpers';
import { ProjectHealthBadge } from './ProjectHealthSection';

// ─── Ligne KR : input contrôlé → la barre suit la saisie en direct ─────
interface TeamKRRowProps {
  kr: TeamKeyResult;
  links: KRProjectLink[];
  statsById: Map<string, TeamProjectTaskStats>;
  onCommit: (value: number) => void;
  onOpenExecution: () => void;
}

const TeamKRRow = ({ kr, links, statsById, onCommit, onOpenExecution }: TeamKRRowProps) => {
  const { t } = useT('org');
  const { t: pf } = useT('portfolio');
  const [value, setValue] = useState<string>(String(kr.currentValue));

  // Resynchronise si la valeur serveur change (mutation d'un autre client / refetch).
  useEffect(() => {
    setValue(String(kr.currentValue));
  }, [kr.currentValue]);

  // Mode `tasks` (mig. 160) : l'avancement se MESURE sur les projets reliés,
  // la valeur ne se saisit plus.
  const taskProgress = kr.progressMode === 'tasks' ? krTaskProgress(kr.id, links, statsById) : null;
  const measured = !!taskProgress && taskProgress.projectCount > 0;
  const numeric = Number(value);
  const liveValue = Number.isNaN(numeric) ? kr.currentValue : numeric;
  const ratio = measured
    ? effectiveKrRatio(kr, links, statsById)
    : kr.targetValue > 0 ? Math.max(0, Math.min(1, liveValue / kr.targetValue)) : 0;
  const pct = Math.round(ratio * 100);
  const done = ratio >= 1;

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
              title={pf('okrCard.weightTitle', { weight: krWeight(kr) })}
            >
              ×{krWeight(kr)}
            </span>
          )}
          {kr.health && <span className="shrink-0 text-caption"><ProjectHealthBadge health={kr.health} /></span>}
          <span className="ml-auto text-xs font-mono text-[rgb(var(--color-text-muted))] shrink-0">
            {measured && taskProgress
              ? pf('krExec.tasksShort', { done: taskProgress.done, total: taskProgress.total })
              : `${liveValue}/${kr.targetValue}${kr.unit ? ` ${kr.unit}` : ''}`}
          </span>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${done ? 'bg-green-500' : 'bg-[rgb(var(--color-accent-solid))]'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {!measured && (
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
        onClick={onOpenExecution}
        aria-label={pf('krExec.openAria', { title: kr.title })}
        title={pf('krExec.openAria', { title: kr.title })}
        className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-indigo-500 hover:bg-[rgb(var(--color-hover))]"
      >
        <Activity size={15} aria-hidden="true" />
      </button>
    </div>
  );
};

interface TeamOKRCardProps {
  okr: TeamOKR;
  okrs: TeamOKR[];
  cycles: OkrCycle[];
  links: KRProjectLink[];
  statsById: Map<string, TeamProjectTaskStats>;
  category?: { name: string; color: string };
  teamName: (teamId: string) => string;
  canEdit: boolean;
  canDelete: boolean;
  highlighted: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCommitKR: (kr: TeamKeyResult, value: number) => void;
  onOpenKR: (kr: TeamKeyResult) => void;
  onOpenOkr: (okrId: string) => void;
}

const TeamOKRCard = ({
  okr, okrs, cycles, links, statsById, category, teamName, canEdit, canDelete, highlighted,
  onEdit, onDelete, onCommitKR, onOpenKR, onOpenOkr,
}: TeamOKRCardProps) => {
  const { t } = useT('org');
  const { t: pf, tp: tpf } = useT('portfolio');
  const avg = okrRatioPercent(okr.keyResults, links, statsById);
  const cycle = okr.cycleId ? cycles.find((c) => c.id === okr.cycleId) : undefined;
  const parent = okr.parentOkrId ? okrs.find((o) => o.id === okr.parentOkrId) : undefined;
  const children = okrs.filter((o) => o.parentOkrId === okr.id);

  return (
    <section
      id={`okr-${okr.id}`}
      className={`rounded-2xl border bg-[rgb(var(--color-surface))] p-4 scroll-mt-24 transition-shadow ${
        highlighted ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-[rgb(var(--color-border))]'
      }`}
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
          </div>
          {okr.description && (
            <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">{okr.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
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
            {cycle && (
              <span className="inline-flex items-center gap-1 text-caption font-medium px-2 py-0.5 rounded-full border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))]">
                <CalendarRange size={11} aria-hidden="true" /> {cycle.name}
              </span>
            )}
            {parent && (
              <button
                type="button"
                onClick={() => onOpenOkr(parent.id)}
                className="inline-flex items-center gap-1 text-caption font-medium px-2 py-0.5 rounded-full border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-hover))]"
              >
                <CornerLeftUp size={11} aria-hidden="true" /> {pf('okrCard.contributesTo', { title: parent.title })}
              </button>
            )}
            {children.length > 0 && (
              <span className="text-caption text-[rgb(var(--color-text-muted))]">
                {tpf('okrCard.childrenCount', children.length)}
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{avg}%</span>
        </div>
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

      {okr.keyResults.length === 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-[rgb(var(--color-text-muted))]">
          <Target size={12} aria-hidden="true" /> {pf('okrCard.noKr')}
        </p>
      ) : (
        <div className="space-y-3">
          {okr.keyResults.map((kr) => (
            <TeamKRRow
              key={kr.id}
              kr={kr}
              links={links}
              statsById={statsById}
              onCommit={(v) => onCommitKR(kr, v)}
              onOpenExecution={() => onOpenKR(kr)}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default TeamOKRCard;
