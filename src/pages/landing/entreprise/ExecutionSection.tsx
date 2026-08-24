import React from 'react';
import { Link2, GitBranch } from 'lucide-react';
import { useT } from '@/i18n/useT';
import type { KeyOf } from '@/i18n/catalog';
import StepSection from './StepSection';

/** Les trois arguments de l'étape — dans l'ordre où ils répondent à « qui bloque quoi ». */
const POINTS: { titleKey: KeyOf<'landing'>; bodyKey: KeyOf<'landing'> }[] = [
  { titleKey: 'enterprise.execution.p1t', bodyKey: 'enterprise.execution.p1d' },
  { titleKey: 'enterprise.execution.p2t', bodyKey: 'enterprise.execution.p2d' },
  { titleKey: 'enterprise.execution.p3t', bodyKey: 'enterprise.execution.p3d' },
];

/**
 * Statut de flux d'une tâche du panneau — même vocabulaire et mêmes couleurs
 * de pastille que `STATUS_META` (`src/components/organization/team-projects.helpers.ts`) :
 * la landing ne réinvente pas de palette pour un statut qui existe déjà dans
 * le produit.
 */
type MockStatus = 'todo' | 'in_progress' | 'review' | 'blocked' | 'done';

const STATUS_DOT: Record<MockStatus, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-blue-500',
  review: 'bg-violet-500',
  blocked: 'bg-red-500',
  done: 'bg-emerald-500',
};

const STATUS_LABEL_KEY: Record<MockStatus, KeyOf<'landing'>> = {
  todo: 'enterprise.execution.statusTodo',
  in_progress: 'enterprise.execution.statusProgress',
  review: 'enterprise.execution.statusReview',
  blocked: 'enterprise.execution.statusBlocked',
  done: 'enterprise.execution.statusDone',
};

/**
 * Les quatre tâches du panneau — mêmes personas que la pyramide (`data.ts`),
 * pour que le visiteur retrouve les mêmes noms d'un bloc à l'autre. Trois
 * d'entre elles s'enchaînent (le chemin critique), la quatrième est
 * indépendante : c'est ce contraste qui fait comprendre la notion de marge.
 */
const TASKS: {
  nameKey: KeyOf<'landing'>;
  status: MockStatus;
  initials: string;
  avatarClass: string;
  onCriticalPath: boolean;
  blockedByKey?: KeyOf<'landing'>;
}[] = [
  { nameKey: 'enterprise.execution.task1', status: 'done', initials: 'MD', avatarClass: 'bg-emerald-500', onCriticalPath: true },
  {
    nameKey: 'enterprise.execution.task2',
    status: 'in_progress',
    initials: 'SB',
    avatarClass: 'bg-emerald-500',
    onCriticalPath: true,
    blockedByKey: 'enterprise.execution.task1',
  },
  {
    nameKey: 'enterprise.execution.task3',
    status: 'blocked',
    initials: 'MD',
    avatarClass: 'bg-emerald-500',
    onCriticalPath: true,
    blockedByKey: 'enterprise.execution.task2',
  },
  { nameKey: 'enterprise.execution.task4', status: 'todo', initials: 'LM', avatarClass: 'bg-pink-600', onCriticalPath: false },
];

/**
 * Étape 3 — l'exécution : le tableau de tâches transverse, les cinq statuts
 * de flux, les dépendances et le chemin critique.
 *
 * Section dédiée (option B retenue le 2026-08-24, plutôt que d'étendre
 * `ProjectsSection` à quatre points) : ces trois arguments méritaient leur
 * propre respiration plutôt que de s'entasser dans la carte « projets ». Le
 * panneau de droite n'est PAS une capture d'écran — `taches.webp` n'existe
 * pas encore — mais un mockup fidèle aux classes réelles (`STATUS_META`,
 * `critical-path.helpers.ts`), sur le même principe que la pyramide interactive
 * de `PyramidSection` : une reconstruction, pas une image.
 */
const ExecutionSection: React.FC = () => {
  const { t } = useT('landing');

  return (
    <StepSection
      id="execution"
      step={3}
      titleKey="enterprise.execution.title"
      subtitleKey="enterprise.execution.subtitle"
    >
      <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-14">
        <ul className="space-y-6">
          {POINTS.map(({ titleKey, bodyKey }) => (
            <li key={titleKey} className="border-l border-white/[0.12] pl-5">
              <h3 className="mb-1.5 text-base font-semibold text-white">{t(titleKey)}</h3>
              <p className="text-sm leading-relaxed text-slate-400">{t(bodyKey)}</p>
            </li>
          ))}
        </ul>

        {/* ── Panneau : onglet Tâches + dépendances + chemin critique ── */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0A0C11] p-5 sm:p-6">
          <span className="mb-4 block font-mono text-caption uppercase tracking-[0.22em] text-slate-500">
            {t('enterprise.execution.panelLabel')}
          </span>

          <ul className="space-y-2">
            {TASKS.map((task) => (
              <li
                key={task.nameKey}
                className={`rounded-xl border p-3.5 ${
                  task.onCriticalPath
                    ? 'border-cyan-300/25 bg-cyan-400/[0.05]'
                    : 'border-white/[0.06] bg-white/[0.015]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[task.status]}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-200">
                    {t(task.nameKey)}
                  </span>
                  <span
                    className={`h-6 w-6 shrink-0 rounded-full ${task.avatarClass} flex items-center justify-center font-mono text-[0.6rem] font-bold text-black/70`}
                  >
                    {task.initials}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 pl-5 font-mono text-[0.65rem] uppercase tracking-[0.1em] text-slate-500">
                  <span>{t(STATUS_LABEL_KEY[task.status])}</span>
                  {task.blockedByKey && (
                    <span className="inline-flex items-center gap-1 normal-case tracking-normal text-slate-400">
                      <Link2 size={11} aria-hidden="true" />
                      {t('enterprise.execution.blockedBy', { name: t(task.blockedByKey) })}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {/* Verdict du chemin critique, sous le tableau — même grammaire que
              le bloc « Votre palier » de `PricingSection` (label mono, valeur
              en gros, phrase d'explication). */}
          <div className="mt-5 flex items-center justify-between gap-4 border-t border-white/[0.06] pt-4">
            <div className="flex items-center gap-2.5">
              <GitBranch size={15} className="shrink-0 text-cyan-400" aria-hidden="true" />
              <div>
                <span className="block text-sm font-semibold text-white">
                  {t('enterprise.execution.pathLabel')}
                </span>
                <span className="block text-xs text-slate-500">{t('enterprise.execution.pathHint')}</span>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-cyan-400/15 px-3 py-1 font-mono text-caption tabular-nums text-cyan-300">
              {t('enterprise.execution.pathBadge')}
            </span>
          </div>
        </div>
      </div>
    </StepSection>
  );
};

export default ExecutionSection;
