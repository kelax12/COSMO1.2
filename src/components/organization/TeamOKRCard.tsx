// Carte d'un objectif d'entreprise. Extraite de `TeamOKRTab` quand l'OKR a
// rejoint l'exécution (mig. 160) : cycle, objectif auquel il contribue, KR
// reliés à des projets et points d'étape. L'onglet garde le filtrage et les
// catégories ; la carte, la lecture d'UN objectif.

import { useEffect, useState } from 'react';
import { Target, Trash2, Pencil, Building2, CornerLeftUp, Activity, ClipboardList } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import type { KRProjectLink, ProjectHealth, TeamKeyResult, TeamOKR } from '@/modules/team-okrs';
import type { TeamProjectTaskStats } from '@/modules/team-projects';
import type { OrgMember } from '@/modules/organizations';
import MemberAvatar from './MemberAvatar';
import VisibilityPill from './VisibilityPill';
import { PermissionGate } from './permission-hints';
import TeamColorDot from './TeamColorDot';
import { useT } from '@/i18n/useT';
import { effectiveKrRatio, krTaskProgress, krWeight, okrRatioPercent } from './okr-execution.helpers';
import { ProjectHealthBadge } from './ProjectHealthSection';

const HEALTH_DOT: Record<ProjectHealth, string> = {
  on_track: 'bg-emerald-500',
  at_risk: 'bg-amber-500',
  off_track: 'bg-red-500',
};

// ─── Ligne KR : input contrôlé → la barre suit la saisie en direct ─────
interface TeamKRRowProps {
  kr: TeamKeyResult;
  links: KRProjectLink[];
  statsById: Map<string, TeamProjectTaskStats>;
  onCommit: (value: number) => void;
  onOpenExecution: () => void;
  /** Change l'état du KR : pose un point d'étape à la valeur courante. */
  onSetHealth: (status: ProjectHealth, value: number) => void;
  personOf?: (userId: string) => OrgMember | undefined;
}

const TeamKRRow = ({ kr, links, statsById, onCommit, onOpenExecution, onSetHealth, personOf }: TeamKRRowProps) => {
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
          {/* Porteurs du KR : responsable puis contributeurs (mig. 160). */}
          {personOf && (() => {
            const ids = [...new Set([kr.assigneeId, ...(kr.contributorIds ?? [])].filter((x): x is string => !!x))];
            const people = ids.map(personOf).filter((m): m is OrgMember => !!m);
            if (people.length === 0) return null;
            return (
              <span className="flex -space-x-1.5 shrink-0" title={pf('krContrib.carriers', { names: people.map((m) => m.displayName).join(', ') })}>
                {people.slice(0, 4).map((m) => (
                  <span key={m.userId} className="rounded-full ring-2 ring-[rgb(var(--color-surface))]">
                    <MemberAvatar avatar={m.avatar} name={m.displayName} size={18} />
                  </span>
                ))}
              </span>
            );
          })()}
          <span className="ml-auto text-xs font-mono text-[rgb(var(--color-text-muted))] shrink-0">
            {measured && taskProgress
              ? pf('krExec.tasksShort', { done: taskProgress.done, total: taskProgress.total })
              : `${liveValue}/${kr.targetValue}${kr.unit ? ` ${kr.unit}` : ''}`}
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden">
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
      {/* Menu d'état, même vocabulaire que le filtre « État » : changer l'état
          pose un point d'étape à la valeur courante ; le détail reste à un clic. */}
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={pf('krExec.openAria', { title: kr.title })}
          title={pf('krExec.openAria', { title: kr.title })}
          className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-indigo-500 hover:bg-[rgb(var(--color-hover))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/60"
        >
          {kr.health && !done
            ? <span className={`w-2.5 h-2.5 rounded-full ${HEALTH_DOT[kr.health]}`} aria-hidden="true" />
            : <Activity size={15} aria-hidden="true" />}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{pf('krExec.statusLabel')}</DropdownMenuLabel>
          {(Object.keys(HEALTH_DOT) as ProjectHealth[]).map((h) => (
            <DropdownMenuItem key={h} onClick={() => onSetHealth(h, measured && taskProgress ? taskProgress.done : kr.currentValue)}>
              <span className={`w-2 h-2 rounded-full ${HEALTH_DOT[h]}`} aria-hidden="true" />
              {pf(`health.${h}`)}
              {kr.health === h && !done && <span className="ml-auto text-xs" aria-hidden="true">✓</span>}
            </DropdownMenuItem>
          ))}
          {!measured && (
            <DropdownMenuItem disabled={done} onClick={() => onCommit(kr.targetValue)}>
              <span className="w-2 h-2 rounded-full bg-blue-500" aria-hidden="true" />
              {pf('okrFilters.stateDone')}
              {done && <span className="ml-auto text-xs" aria-hidden="true">✓</span>}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onOpenExecution}>
            <ClipboardList size={14} aria-hidden="true" />
            {pf('krExec.checkinTitle')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

interface TeamOKRCardProps {
  okr: TeamOKR;
  okrs: TeamOKR[];
  links: KRProjectLink[];
  statsById: Map<string, TeamProjectTaskStats>;
  category?: { name: string; color: string };
  teamName: (teamId: string) => string;
  /** Couleur CHOISIE de l'équipe (cohérence globale : elle se voit partout où l'équipe est nommée). */
  teamColor: (teamId: string) => string | undefined;
  /** Pourquoi modifier est refusé, quand il l'est : le bouton se grise et le dit. */
  editDeniedReason?: string;
  deleteDeniedReason?: string;
  highlighted: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCommitKR: (kr: TeamKeyResult, value: number) => void;
  onOpenKR: (kr: TeamKeyResult) => void;
  onSetKRHealth: (kr: TeamKeyResult, status: ProjectHealth, value: number) => void;
  onOpenOkr: (okrId: string) => void;
  personOf?: (userId: string) => OrgMember | undefined;
}

const TeamOKRCard = ({
  okr, okrs, links, statsById, category, teamName, teamColor, editDeniedReason, deleteDeniedReason, highlighted,
  onEdit, onDelete, onCommitKR, onOpenKR, onSetKRHealth, onOpenOkr, personOf,
}: TeamOKRCardProps) => {
  const { t } = useT('org');
  const { t: pf, tp: tpf } = useT('portfolio');
  const avg = okrRatioPercent(okr.keyResults, links, statsById);
  const parent = okr.parentOkrId ? okrs.find((o) => o.id === okr.parentOkrId) : undefined;
  const children = okrs.filter((o) => o.parentOkrId === okr.id);

  return (
    <section
      id={`okr-${okr.id}`}
      className={`rounded-2xl border bg-[rgb(var(--color-surface))] p-5 sm:p-6 scroll-mt-24 transition-shadow ${
        highlighted ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-[rgb(var(--color-border))]'
      }`}
    >
      <div className="flex items-start gap-3 pb-4 mb-4 border-b border-[rgb(var(--color-border))]">
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
            <p className="text-sm text-[rgb(var(--color-text-muted))] mt-1">{okr.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            {okr.teamIds.length === 0 ? (
              <span className="inline-flex items-center gap-1 text-caption font-medium px-2 py-0.5 rounded-full border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))]">
                <Building2 size={11} aria-hidden="true" /> {t('common.orgWideBadge')}
              </span>
            ) : (
              okr.teamIds.map((tid) => (
                <span key={tid} className="inline-flex items-center gap-1.5 text-caption font-medium px-2 py-0.5 rounded-full bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-secondary))]">
                  <TeamColorDot color={teamColor(tid)} size={7} /> {teamName(tid)}
                </span>
              ))
            )}
            {/* Qui voit cet objectif, et pourquoi (M12). */}
            <VisibilityPill orgId={okr.orgId} teamIds={okr.teamIds} />
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
        {/* Toujours présents : grisés avec leur raison plutôt que masqués
            (cohérence globale, « droits »). */}
        <div className="flex items-center gap-1 shrink-0">
            <PermissionGate reason={editDeniedReason}>
              <button
                type="button"
                onClick={onEdit}
                aria-label={t('common.editOkrAria', { title: okr.title })}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-blue-500 hover:bg-[rgb(var(--color-accent-solid-hover))]/10 transition-colors"
              >
                <Pencil size={15} aria-hidden="true" />
              </button>
            </PermissionGate>
            <PermissionGate reason={deleteDeniedReason}>
              <button
                type="button"
                onClick={onDelete}
                aria-label={t('common.deleteOkrAria', { title: okr.title })}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-red-500 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </PermissionGate>
        </div>
      </div>

      {okr.keyResults.length === 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-[rgb(var(--color-text-muted))]">
          <Target size={12} aria-hidden="true" /> {pf('okrCard.noKr')}
        </p>
      ) : (
        <div className="space-y-5">
          {okr.keyResults.map((kr) => (
            <TeamKRRow
              key={kr.id}
              kr={kr}
              links={links}
              statsById={statsById}
              onCommit={(v) => onCommitKR(kr, v)}
              onOpenExecution={() => onOpenKR(kr)}
              onSetHealth={(status, value) => onSetKRHealth(kr, status, value)}
              personOf={personOf}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default TeamOKRCard;
