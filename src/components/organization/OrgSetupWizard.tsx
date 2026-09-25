import { useMemo, useState } from 'react';
import { Check, FolderKanban, Mail, PartyPopper, Users } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { useInviteByEmail } from '@/modules/organizations/governance.hooks';
import type { SendInvitationsResult } from '@/modules/organizations/governance.types';
import { useCreateOrgTeam, useOrgTeams } from '@/modules/org-teams';
import { useCreateTeamProjectWithTasks } from '@/modules/team-projects';
import { BUILT_IN_TEMPLATES, builtInPayload } from './project-templates';
import { instantiateTemplate, todayLocal } from './portfolio.helpers';
import { splitEmails } from './invite-email.helpers';
import { ORG_SETUP_STEPS, setupStepIndex, type OrgSetupScreen } from './org-setup.helpers';

interface OrgSetupWizardProps {
  orgId: string;
  orgName: string;
  currentUserId?: string;
  screen: OrgSetupScreen;
  /** Passe à un écran (la page le porte dans l'URL : un rechargement y revient). */
  onScreen: (screen: OrgSetupScreen) => void;
  /** Sortie vers l'espace entreprise. */
  onFinish: () => void;
}

const inputClass =
  'w-full bg-[rgb(var(--color-hover))] border border-[rgb(var(--color-border))] rounded-xl px-4 py-3 text-sm text-[rgb(var(--color-text-primary))] placeholder-[rgb(var(--color-text-muted))] focus:outline-none focus:ring-2 focus:ring-blue-500/40';
const primaryBtn =
  'flex-1 py-3 rounded-xl text-sm font-semibold text-[rgb(var(--color-accent-solid-foreground))] bg-[rgb(var(--color-accent-solid))] hover:bg-[rgb(var(--color-accent-solid-hover))] disabled:opacity-60 transition-colors';
const skipBtn =
  'px-4 py-3 rounded-xl text-sm font-medium text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text-primary))] hover:bg-[rgb(var(--color-hover))] disabled:opacity-60 transition-colors';

type TemplateKey = (typeof BUILT_IN_TEMPLATES)[number]['key'];

/**
 * Assistant de démarrage d'une entreprise qui vient d'être créée.
 *
 * Avant lui, la création s'arrêtait sur un code à partager, et la suite
 * (inviter, une équipe, un projet) n'existait que comme checklist de l'Aperçu,
 * que seuls les admins voyaient et qu'il fallait trouver.
 *
 * Mêmes règles que l'accueil du premier compte (`src/components/CLAUDE.md`) :
 *   · chaque étape CRÉE au moment où elle est validée, jamais à la fin :
 *     quelqu'un qui ferme l'onglet après avoir invité garde ses invitations ;
 *   · chaque étape se PASSE, et passer avance exactement comme faire ;
 *   · l'étape courante vit dans l'URL : un rechargement y revient au lieu de
 *     tout reprendre depuis le début.
 */
const OrgSetupWizard = ({ orgId, orgName, currentUserId, screen, onScreen, onFinish }: OrgSetupWizardProps) => {
  const { t, tp } = useT('orgSetup');
  const { t: pf } = useT('portfolio');
  const current = setupStepIndex(screen);

  // Ce qui a été fait, pour l'écran de fin. Perdu au rechargement, et c'est
  // sans conséquence : l'écran de fin ne résume que la visite en cours.
  const [invitedCount, setInvitedCount] = useState(0);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [createdTeamId, setCreatedTeamId] = useState<string | null>(null);

  const stepLabels: Record<(typeof ORG_SETUP_STEPS)[number], string> = {
    name: t('stepName'),
    invite: t('stepInvite'),
    team: t('stepTeam'),
    project: t('stepProject'),
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-lg font-bold text-[rgb(var(--color-text-primary))]">
          {screen === 'done' ? t('doneTitle', { name: orgName }) : t('title', { name: orgName })}
        </h2>
      </div>

      {/* Fil d'étapes. Une liste ordonnée : l'ordre EST l'information. */}
      <ol className="flex items-center gap-2" aria-label={t('progressAria')}>
        {ORG_SETUP_STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={step} className="flex-1 min-w-0" aria-current={active ? 'step' : undefined}>
              <div
                className={`h-1.5 rounded-full ${
                  done || active ? 'bg-[rgb(var(--color-accent))]' : 'bg-[rgb(var(--color-border))]'
                } ${active ? 'opacity-60' : ''}`}
                aria-hidden="true"
              />
              <span
                className={`mt-1.5 flex items-center gap-1 text-[11px] truncate ${
                  active ? 'font-semibold text-[rgb(var(--color-text-primary))]' : 'text-[rgb(var(--color-text-muted))]'
                }`}
              >
                {done && <Check size={11} aria-hidden="true" />}
                {stepLabels[step]}
                <span className="sr-only">
                  {done ? t('stepDone') : active ? t('stepCurrent') : t('stepTodo')}
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      {screen === 'invite' && (
        <InviteStep
          orgId={orgId}
          onDone={(count) => { setInvitedCount(count); onScreen('team'); }}
          onSkip={() => onScreen('team')}
        />
      )}
      {screen === 'team' && (
        <TeamStep
          orgId={orgId}
          onDone={(id, name) => { setCreatedTeamId(id); setTeamName(name); onScreen('project'); }}
          onSkip={() => onScreen('project')}
        />
      )}
      {screen === 'project' && (
        <ProjectStep
          orgId={orgId}
          currentUserId={currentUserId}
          createdTeamId={createdTeamId}
          templateLabel={(key) => pf(`builtIn.${key}` as 'builtIn.sprint')}
          translate={(key) => pf(key as 'builtIn.sprint')}
          onDone={(name) => { setProjectName(name); onScreen('done'); }}
          onSkip={() => onScreen('done')}
        />
      )}
      {screen === 'done' && (
        <div className="space-y-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
            <PartyPopper size={26} className="text-emerald-500" aria-hidden="true" />
          </div>
          <ul className="text-sm text-[rgb(var(--color-text-secondary))] space-y-1">
            {invitedCount > 0 && <li>{tp('doneInvited', invitedCount)}</li>}
            {teamName && <li>{t('doneTeam', { name: teamName })}</li>}
            {projectName && <li>{t('doneProject', { name: projectName })}</li>}
            {invitedCount === 0 && !teamName && !projectName && <li>{t('doneNothing')}</li>}
          </ul>
          <button type="button" onClick={onFinish} className={`${primaryBtn} w-full`}>
            {t('finish')}
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Étape 2 : inviter par e-mail ─────────────────────────────────────

const InviteStep = ({ orgId, onDone, onSkip }: { orgId: string; onDone: (count: number) => void; onSkip: () => void }) => {
  const { t, tp } = useT('orgSetup');
  const invite = useInviteByEmail(orgId);
  const [raw, setRaw] = useState('');
  const [sent, setSent] = useState<{ created: number; sending: SendInvitationsResult } | null>(null);
  const emails = useMemo(() => splitEmails(raw), [raw]);

  if (sent) {
    return (
      <div className="space-y-4">
        <p role="status" className="rounded-xl bg-[rgb(var(--color-hover))] text-sm text-[rgb(var(--color-text-primary))] p-3">
          {sent.sending.unavailable
            ? tp('inviteCreatedNotSent', sent.created)
            : tp('inviteSent', sent.created)}
        </p>
        <button type="button" onClick={() => onDone(sent.created)} className={`${primaryBtn} w-full`}>
          {t('next')}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <Mail size={20} className="text-blue-500 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm text-[rgb(var(--color-text-secondary))]">{t('inviteIntro')}</p>
      </div>
      <label htmlFor="setup-invite-emails" className="block text-xs font-medium text-[rgb(var(--color-text-secondary))]">
        {t('inviteLabel')}
      </label>
      <textarea
        id="setup-invite-emails"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={3}
        placeholder="marie@exemple.fr, paul@exemple.fr"
        className={inputClass}
        autoFocus
      />
      <p className="text-xs text-[rgb(var(--color-text-muted))]">{t('inviteHint')}</p>
      <div className="flex gap-2">
        <button type="button" onClick={onSkip} disabled={invite.isPending} className={skipBtn}>
          {t('skip')}
        </button>
        <button
          type="button"
          disabled={emails.length === 0 || invite.isPending}
          onClick={() =>
            invite.mutate(
              { emails, managerId: null, teamIds: [], accessDays: null },
              {
                onSuccess: ({ results, sending }) =>
                  setSent({ created: results.filter((r) => r.status === 'created').length, sending }),
              },
            )
          }
          className={primaryBtn}
        >
          {invite.isPending ? t('inviteSending') : tp('inviteCta', Math.max(1, emails.length))}
        </button>
      </div>
    </div>
  );
};

// ─── Étape 3 : première équipe ────────────────────────────────────────

const TeamStep = ({ orgId, onDone, onSkip }: {
  orgId: string;
  onDone: (teamId: string, name: string) => void;
  onSkip: () => void;
}) => {
  const { t } = useT('orgSetup');
  const createTeam = useCreateOrgTeam(orgId);
  const [name, setName] = useState('');
  const valid = name.trim().length >= 2;
  const submit = () => {
    if (!valid || createTeam.isPending) return;
    const value = name.trim();
    createTeam.mutate({ name: value }, { onSuccess: (team) => onDone(team.id, value) });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <Users size={20} className="text-indigo-500 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm text-[rgb(var(--color-text-secondary))]">{t('teamIntro')}</p>
      </div>
      <label htmlFor="setup-team-name" className="block text-xs font-medium text-[rgb(var(--color-text-secondary))]">
        {t('teamLabel')}
      </label>
      <input
        id="setup-team-name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder={t('teamPlaceholder')}
        maxLength={60}
        className={inputClass}
        autoFocus
      />
      <div className="flex gap-2">
        <button type="button" onClick={onSkip} disabled={createTeam.isPending} className={skipBtn}>
          {t('skip')}
        </button>
        <button type="button" onClick={submit} disabled={!valid || createTeam.isPending} className={primaryBtn}>
          {createTeam.isPending ? t('creating') : t('teamCta')}
        </button>
      </div>
    </div>
  );
};

// ─── Étape 4 : premier projet, à partir d'un modèle ───────────────────

const ProjectStep = ({ orgId, currentUserId, createdTeamId, templateLabel, translate, onDone, onSkip }: {
  orgId: string;
  currentUserId?: string;
  createdTeamId: string | null;
  templateLabel: (key: TemplateKey) => string;
  translate: (key: string) => string;
  onDone: (name: string) => void;
  onSkip: () => void;
}) => {
  const { t } = useT('orgSetup');
  const createProject = useCreateTeamProjectWithTasks(orgId);
  const { data: teams = [] } = useOrgTeams(orgId);
  const [templateKey, setTemplateKey] = useState<TemplateKey>(BUILT_IN_TEMPLATES[0].key);
  const [name, setName] = useState('');
  // Le projet va à l'équipe créée juste avant ; après un rechargement, à la
  // seule équipe de l'entreprise s'il n'y en a qu'une. Sinon, à toute
  // l'entreprise : c'est une création, visible et modifiable ensuite.
  const teamId = createdTeamId ?? (teams.length === 1 ? teams[0].id : null);
  const effectiveName = name.trim() || templateLabel(templateKey);

  const submit = () => {
    const def = BUILT_IN_TEMPLATES.find((b) => b.key === templateKey);
    if (!def || createProject.isPending) return;
    const start = todayLocal();
    // Le modèle se DATE maintenant, depuis aujourd'hui : mêmes décalages que
    // la création depuis l'onglet Projets (`NewTeamProjectModal`).
    const fromTemplate = instantiateTemplate(builtInPayload(def, translate), start);
    createProject.mutate(
      {
        input: {
          name: effectiveName.slice(0, 120),
          color: 'blue',
          teamId,
          ownerId: currentUserId ?? null,
          startDate: start,
          dueDate: fromTemplate.dueDate,
        },
        tasks: fromTemplate.tasks,
        milestones: fromTemplate.milestones,
      },
      { onSuccess: () => onDone(effectiveName) },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <FolderKanban size={20} className="text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-sm text-[rgb(var(--color-text-secondary))]">{t('projectIntro')}</p>
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-xs font-medium text-[rgb(var(--color-text-secondary))]">{t('templateLegend')}</legend>
        {BUILT_IN_TEMPLATES.map((tpl) => (
          <label
            key={tpl.key}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
              templateKey === tpl.key
                ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent)/0.08)]'
                : 'border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-hover))]'
            }`}
          >
            <input
              type="radio"
              name="setup-template"
              value={tpl.key}
              checked={templateKey === tpl.key}
              onChange={() => setTemplateKey(tpl.key)}
              className="shrink-0"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[rgb(var(--color-text-primary))]">{templateLabel(tpl.key)}</span>
              <span className="block text-xs text-[rgb(var(--color-text-muted))]">
                {t('templateMeta', { tasks: tpl.tasks.length, days: tpl.durationDays })}
              </span>
            </span>
          </label>
        ))}
      </fieldset>
      <label htmlFor="setup-project-name" className="block text-xs font-medium text-[rgb(var(--color-text-secondary))]">
        {t('projectLabel')}
      </label>
      <input
        id="setup-project-name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={templateLabel(templateKey)}
        maxLength={120}
        className={inputClass}
      />
      <div className="flex gap-2">
        <button type="button" onClick={onSkip} disabled={createProject.isPending} className={skipBtn}>
          {t('skip')}
        </button>
        <button type="button" onClick={submit} disabled={createProject.isPending} className={primaryBtn}>
          {createProject.isPending ? t('creating') : t('projectCta')}
        </button>
      </div>
    </div>
  );
};

export default OrgSetupWizard;
