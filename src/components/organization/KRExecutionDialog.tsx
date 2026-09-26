// Exécution d'un résultat clé (mig. 160) — ce qui manquait pour qu'un OKR
// cesse d'être déclaratif :
//
//   · RELIER le KR à des projets, et le faire avancer par leurs tâches
//     terminées (mode `tasks`) au lieu d'une valeur saisie à la main ;
//   · poser des POINTS D'ÉTAPE datés (valeur, état, note), dont l'historique
//     se relit à la revue trimestrielle.

import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  useKRCheckins, usePostKRCheckin, useSetKRProjects, useUpdateTeamKR,
  type KRProjectLink, type ProjectHealth, type TeamKeyResult,
} from '@/modules/team-okrs';
import type { TeamProject, TeamProjectTaskStats } from '@/modules/team-projects';
import type { OrgMember } from '@/modules/organizations';
import { getDateLocale } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { krTaskProgress } from './okr-execution.helpers';
import { ProjectHealthBadge } from './ProjectHealthSection';

const HEALTHS: ProjectHealth[] = ['on_track', 'at_risk', 'off_track'];

interface KRExecutionDialogProps {
  orgId: string;
  kr: TeamKeyResult;
  links: KRProjectLink[];
  projects: TeamProject[];
  statsById: Map<string, TeamProjectTaskStats>;
  members: OrgMember[];
  /** Relier des projets et changer le mode : droit de structure (`okr.create`). */
  canEditStructure: boolean;
  onClose: () => void;
}

const KRExecutionDialog = ({
  orgId, kr, links, projects, statsById, members, canEditStructure, onClose,
}: KRExecutionDialogProps) => {
  const { t } = useT('org');
  const { t: pf } = useT('portfolio');
  const { data: checkins = [], isLoading } = useKRCheckins(kr.id);
  const postCheckin = usePostKRCheckin(orgId);
  const setProjects = useSetKRProjects(orgId);
  const updateKR = useUpdateTeamKR(orgId);

  const linked = useMemo(() => new Set(links.filter((l) => l.krId === kr.id).map((l) => l.projectId)), [links, kr.id]);
  const [selected, setSelected] = useState<Set<string>>(linked);
  const [value, setValue] = useState(String(kr.currentValue));
  const [status, setStatus] = useState<ProjectHealth>(kr.health ?? 'on_track');
  const [note, setNote] = useState('');
  const taskMode = kr.progressMode === 'tasks';
  const progress = krTaskProgress(kr.id, links, statsById);
  const memberName = useMemo(() => new Map(members.map((m) => [m.userId, m.displayName])), [members]);
  const activeProjects = useMemo(() => projects.filter((p) => !p.archivedAt && !p.isTemplate), [projects]);
  const selectionChanged = selected.size !== linked.size || [...selected].some((id) => !linked.has(id));

  const toggle = (projectId: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(projectId)) next.delete(projectId); else next.add(projectId);
    return next;
  });

  const submitCheckin = () => {
    // En mode tâches, la valeur du point d'étape est l'avancement mesuré.
    const v = taskMode ? progress.done : Number(value);
    if (!Number.isFinite(v)) return;
    postCheckin.mutate({ krId: kr.id, value: v, status, note: note.trim() || undefined }, {
      onSuccess: () => setNote(''),
    });
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{kr.title}</DialogTitle>
          <DialogDescription>{pf('krExec.description')}</DialogDescription>
        </DialogHeader>

        {/* ── Mode de progression ─────────────────────────────────── */}
        <section className="space-y-2">
          <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{pf('krExec.modeTitle')}</h3>
          <div role="radiogroup" aria-label={pf('krExec.modeTitle')} className="inline-flex rounded-lg border border-[rgb(var(--color-border))] p-0.5 gap-0.5">
            {(['manual', 'tasks'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={(kr.progressMode ?? 'manual') === mode}
                disabled={!canEditStructure || updateKR.isPending}
                onClick={() => updateKR.mutate({ krId: kr.id, input: { progressMode: mode } })}
                className={`h-8 px-3 rounded-md text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                  (kr.progressMode ?? 'manual') === mode
                    ? 'bg-[rgb(var(--color-hover))] text-[rgb(var(--color-text-primary))]'
                    : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-secondary))]'
                }`}
              >
                {pf(`krExec.mode.${mode}`)}
              </button>
            ))}
          </div>
          <p className="text-xs text-[rgb(var(--color-text-muted))]">{pf(`krExec.modeHelp.${taskMode ? 'tasks' : 'manual'}`)}</p>
        </section>

        {/* ── Projets reliés ─────────────────────────────────────── */}
        <section className="space-y-2">
          <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{pf('krExec.projectsTitle')}</h3>
          {taskMode && progress.projectCount > 0 && (
            <p className="text-xs text-[rgb(var(--color-text-secondary))]">
              {pf('krExec.tasksProgress', { done: progress.done, total: progress.total })}
            </p>
          )}
          {activeProjects.length === 0 ? (
            <p className="text-xs text-[rgb(var(--color-text-muted))]">{pf('krExec.noProject')}</p>
          ) : (
            <ul className="max-h-44 overflow-y-auto space-y-1 rounded-xl border border-[rgb(var(--color-border))] p-2">
              {activeProjects.map((p) => {
                const s = statsById.get(p.id);
                return (
                  <li key={p.id}>
                    <label className="flex items-center gap-2 text-sm text-[rgb(var(--color-text-primary))]">
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        disabled={!canEditStructure}
                        onChange={() => toggle(p.id)}
                      />
                      <span className="flex-1 truncate">{p.name}</span>
                      {s && <span className="text-xs tabular-nums text-[rgb(var(--color-text-muted))]">{s.completed}/{s.total}</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {canEditStructure && selectionChanged && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setProjects.mutate({ krId: kr.id, projectIds: [...selected] })}
                disabled={setProjects.isPending}
                className="h-8 px-3 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {pf('krExec.saveProjects')}
              </button>
            </div>
          )}
        </section>

        {/* ── Point d'étape ──────────────────────────────────────── */}
        <section className="space-y-2 border-t border-[rgb(var(--color-border))] pt-3">
          <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{pf('krExec.checkinTitle')}</h3>
          <div className="flex flex-wrap items-end gap-2">
            {!taskMode && (
              <label className="block">
                <span className="block text-xs font-semibold text-[rgb(var(--color-text-secondary))] mb-1">
                  {pf('krExec.value', { target: kr.targetValue, unit: kr.unit ?? '' })}
                </span>
                <input
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-28 h-9 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-2 text-sm"
                />
              </label>
            )}
            <div role="radiogroup" aria-label={pf('krExec.statusLabel')} className="flex flex-wrap gap-1">
              {HEALTHS.map((h) => (
                <button
                  key={h}
                  type="button"
                  role="radio"
                  aria-checked={status === h}
                  onClick={() => setStatus(h)}
                  className={`h-9 px-2.5 rounded-lg text-xs font-semibold border ${
                    status === h ? 'border-indigo-500 text-[rgb(var(--color-text-primary))]' : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))]'
                  }`}
                >
                  {pf(`health.${h}`)}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="sr-only">{pf('krExec.noteLabel')}</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder={pf('krExec.notePlaceholder')}
              className="w-full rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-3 py-2 text-sm"
            />
          </label>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={submitCheckin}
              disabled={postCheckin.isPending || (!taskMode && !Number.isFinite(Number(value)))}
              className="h-9 px-3 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {pf('krExec.postCheckin')}
            </button>
          </div>
        </section>

        {/* ── Historique ─────────────────────────────────────────── */}
        <section className="space-y-2">
          <h3 className="text-sm font-bold text-[rgb(var(--color-text-primary))]">{pf('krExec.historyTitle')}</h3>
          {isLoading ? null : checkins.length === 0 ? (
            <p className="text-xs text-[rgb(var(--color-text-muted))]">{pf('krExec.historyEmpty')}</p>
          ) : (
            <ol className="space-y-2">
              {checkins.map((c) => (
                <li key={c.id} className="rounded-xl border border-[rgb(var(--color-border))] px-3 py-2">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <ProjectHealthBadge health={c.status} />
                    <span className="font-semibold tabular-nums text-[rgb(var(--color-text-primary))]">{c.value}{kr.unit ? ` ${kr.unit}` : ''}</span>
                    <span className="text-[rgb(var(--color-text-muted))]">
                      {pf('krExec.byOn', {
                        name: (c.authorId && memberName.get(c.authorId)) || t('trash.someone'),
                        date: format(parseISO(c.createdAt), 'd MMM yyyy', { locale: getDateLocale() }),
                      })}
                    </span>
                  </div>
                  {c.note && <p className="mt-1 text-sm whitespace-pre-line text-[rgb(var(--color-text-secondary))]">{c.note}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
};

export default KRExecutionDialog;
