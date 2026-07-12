import { useState } from 'react';
import { Plus, Target, Trash2, Check } from 'lucide-react';
import {
  useTeamOKRs,
  useUpdateTeamKR,
  useDeleteTeamOKR,
  type TeamKeyResult,
} from '@/modules/team-okrs';
import type { OrgMember } from '@/modules/organizations';
import MemberAvatar from './MemberAvatar';
import CreateTeamOKRModal from './CreateTeamOKRModal';

interface TeamOKRTabProps {
  orgId: string;
  members: OrgMember[];
  isManager: boolean;
}

// Progression d'un KR, clampée [0,1] (garde B17 : targetValue > 0 garanti).
const krProgress = (kr: TeamKeyResult): number => {
  if (kr.completed) return 1;
  if (kr.targetValue <= 0) return 0;
  return Math.max(0, Math.min(1, kr.currentValue / kr.targetValue));
};

// Coefficient d'importance effectif : entier borné [1, 10], défaut 1.
const krWeight = (kr: TeamKeyResult): number => {
  const w = Math.round(Number(kr.weight));
  if (!Number.isFinite(w) || w < 1) return 1;
  return Math.min(w, 10);
};

// Progression globale (%) d'un OKR d'équipe : moyenne pondérée par le coefficient.
const okrProgress = (keyResults: TeamKeyResult[]): number => {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const kr of keyResults) {
    const w = krWeight(kr);
    totalWeight += w;
    weightedSum += krProgress(kr) * w;
  }
  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;
};

const TeamOKRTab = ({ orgId, members, isManager }: TeamOKRTabProps) => {
  const [showCreate, setShowCreate] = useState(false);
  const { data: okrs = [], isLoading } = useTeamOKRs(orgId);
  const updateKR = useUpdateTeamKR(orgId);
  const deleteOKR = useDeleteTeamOKR(orgId);

  const memberOf = (id?: string | null) => members.find((m) => m.userId === id);

  const setCurrent = (kr: TeamKeyResult, value: number) =>
    updateKR.mutate({ krId: kr.id, input: { currentValue: value } });
  const toggleComplete = (kr: TeamKeyResult) =>
    updateKR.mutate({ krId: kr.id, input: { completed: !kr.completed } });

  if (isLoading) {
    return <div className="py-10 text-center text-sm text-[rgb(var(--color-text-muted))]">Chargement…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {isManager && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-hover))] text-sm font-medium text-[rgb(var(--color-text-secondary))] transition-colors"
          >
            <Plus size={15} aria-hidden="true" /> Nouvel objectif
          </button>
        )}
      </div>

      {okrs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--color-hover))] flex items-center justify-center mb-3">
            <Target size={22} className="text-[rgb(var(--color-text-muted))]" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-[rgb(var(--color-text-primary))]">Aucun objectif</p>
          <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1">
            {isManager ? 'Créez un objectif pour aligner l\'équipe.' : 'Un manager doit créer un objectif.'}
          </p>
        </div>
      ) : (
        okrs.map((okr) => {
          const avg = okrProgress(okr.keyResults);
          return (
            <section key={okr.id} className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {okr.category && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                        {okr.category}
                      </span>
                    )}
                    <h3 className="text-base font-bold text-[rgb(var(--color-text-primary))] truncate">{okr.title}</h3>
                  </div>
                  {okr.description && (
                    <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">{okr.description}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{avg}%</span>
                </div>
                {isManager && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Supprimer l'objectif « ${okr.title} » ?`)) deleteOKR.mutate(okr.id);
                    }}
                    aria-label={`Supprimer l'objectif ${okr.title}`}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {okr.keyResults.map((kr) => {
                  const pct = Math.round(krProgress(kr) * 100);
                  const assignee = memberOf(kr.assigneeId);
                  return (
                    <div key={kr.id} className="flex items-center gap-3">
                      {assignee ? (
                        <MemberAvatar avatar={assignee.avatar} size={28} />
                      ) : (
                        <span className="w-7 h-7 rounded-full border border-dashed border-[rgb(var(--color-border))]" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm truncate ${kr.completed ? 'line-through text-[rgb(var(--color-text-muted))]' : 'text-[rgb(var(--color-text-primary))]'}`}>
                            {kr.title}
                          </p>
                          {krWeight(kr) !== 1 && (
                            <span
                              className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              title={`Coefficient d'importance ×${krWeight(kr)}`}
                            >
                              ×{krWeight(kr)}
                            </span>
                          )}
                          <span className="ml-auto text-xs font-mono text-[rgb(var(--color-text-muted))] shrink-0">
                            {kr.currentValue}/{kr.targetValue}{kr.unit ? ` ${kr.unit}` : ''}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-[rgb(var(--color-hover))] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${kr.completed ? 'bg-green-500' : 'bg-indigo-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      {/* Édition rapide de la valeur courante */}
                      <input
                        type="number"
                        defaultValue={kr.currentValue}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (!Number.isNaN(v) && v !== kr.currentValue) setCurrent(kr, v);
                        }}
                        aria-label={`Valeur actuelle de ${kr.title}`}
                        className="w-16 h-8 px-2 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      />
                      <button
                        type="button"
                        onClick={() => toggleComplete(kr)}
                        aria-label={kr.completed ? 'Marquer le KR non atteint' : 'Marquer le KR atteint'}
                        aria-pressed={kr.completed}
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 transition-colors ${
                          kr.completed
                            ? 'bg-green-600 border-green-600 text-white'
                            : 'border-[rgb(var(--color-border))] hover:border-green-500 text-[rgb(var(--color-text-muted))]'
                        }`}
                      >
                        <Check size={15} aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}

      {showCreate && (
        <CreateTeamOKRModal orgId={orgId} members={members} onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
};

export default TeamOKRTab;
