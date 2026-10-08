import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, Copy, Plus } from 'lucide-react';
import { toast } from '@/lib/toast';
import { useT } from '@/i18n/useT';
import { useInviteByEmail } from '@/modules/organizations/governance.hooks';
import { useCreateOrgTeam, useOrgTeams } from '@/modules/org-teams';
import { useCreateTeamProjectWithTasks } from '@/modules/team-projects';
import { useCreateTeamOKR } from '@/modules/team-okrs';
import { BUILT_IN_TEMPLATES, builtInPayload } from '@/components/organization/project-templates';
import { instantiateTemplate, todayLocal } from '@/components/organization/portfolio.helpers';
import { splitEmails } from '@/components/organization/invite-email.helpers';
import { buildCompanyOkrInput } from './ent-onboarding';
import { PlacesGrid } from './ent-places';
import {
  ENT_CARD,
  ENT_CHIP,
  ENT_FIELD,
  ENT_INPUT,
  ENT_LABEL,
  ENT_LINK,
  ENT_PRIMARY,
  EntActions,
  EntBody,
  EntKicker,
  EntTitle,
} from './ent-ui';

// ═══════════════════════════════════════════════════════════════════
// Les étapes de la mise en place d'une entreprise (après sa création).
//
// Mêmes règles que l'accueil du premier compte (`src/components/CLAUDE.md`) :
//   · chaque étape CRÉE au moment où elle est validée, jamais à la fin :
//     quelqu'un qui ferme l'onglet après avoir invité garde ses invitations ;
//   · chaque étape se PASSE, et passer avance exactement comme faire ;
//   · l'étape courante vit dans l'URL (la page la porte) : un rechargement y
//     revient au lieu de tout reprendre depuis le début.
//
// Chaque étape remonte aussi son BROUILLON (`onDraft`) : la constellation le
// dessine pendant la frappe, pour que la personne voie ce qu'elle construit
// avant même de le valider.
// ═══════════════════════════════════════════════════════════════════

type TemplateKey = (typeof BUILT_IN_TEMPLATES)[number]['key'];

// ─── Inviter ─────────────────────────────────────────────────────────

export const InviteStep = ({
  orgId,
  joinCode,
  team,
  currentUserId,
  onDraft,
  onDone,
  onSkip,
}: {
  orgId: string;
  joinCode?: string;
  /** Équipe à laquelle rattacher les invitations (créée juste avant), s'il y en a une. */
  team: { id: string; name: string } | null;
  currentUserId?: string;
  onDraft: (emails: string[]) => void;
  onDone: (invited: string[]) => void;
  onSkip: () => void;
}) => {
  const { t, tp } = useT('onboarding');
  const invite = useInviteByEmail(orgId);
  const [raw, setRaw] = useState('');
  // Les invitations partaient sans équipe ni manager, et il fallait replacer
  // chaque personne ailleurs, plus tard (relevé le 2026-10-04). Les deux
  // rattachements sont proposés, cochés, et décochables.
  const [joinTeam, setJoinTeam] = useState(true);
  const [underMe, setUnderMe] = useState(true);
  const [sent, setSent] = useState<{ emails: string[]; unavailable: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const emails = useMemo(() => splitEmails(raw), [raw]);

  const copyCode = async () => {
    if (!joinCode) return;
    try {
      await navigator.clipboard.writeText(joinCode);
      setCopied(true);
      toast.success(t('ent.invite.copied'));
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error(t('ent.invite.copyFailed'));
    }
  };

  return (
    <>
      <EntKicker>{t('ent.invite.kicker')}</EntKicker>
      <EntTitle text={t('ent.invite.title')} />
      <EntBody>{t('ent.invite.body')}</EntBody>

      {sent ? (
        <p role="status" className={`mt-6 flex items-start gap-3 p-4 text-body text-[#EDF2F7] ${ENT_CARD}`}>
          <Check size={18} className="mt-0.5 shrink-0 text-[#22D3EE]" aria-hidden="true" />
          {sent.unavailable
            ? tp('ent.invite.createdNotSent', sent.emails.length)
            : tp('ent.invite.sent', sent.emails.length)}
        </p>
      ) : (
        <>
          <label htmlFor="setup-invite-emails" className={`mt-6 ${ENT_LABEL}`}>
            {t('ent.invite.label')}
          </label>
          <div className={`mt-2 ${ENT_FIELD} py-2`}>
            <textarea
              id="setup-invite-emails"
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                onDraft(splitEmails(e.target.value));
              }}
              rows={3}
              placeholder="marie@exemple.fr, paul@exemple.fr"
              className="no-input-chrome min-w-0 flex-1 resize-none bg-transparent py-1 text-base leading-relaxed text-[#EDF2F7] placeholder:text-[#5E6878] focus:outline-none"
              autoFocus
            />
          </div>
          <p className="mt-2 text-label text-[#8B96A8]">{t('ent.invite.hint')}</p>
          <fieldset className="mt-4 space-y-2">
            <legend className="sr-only">{t('ent.invite.placementLegend')}</legend>
            {team && (
              <label className="flex cursor-pointer items-start gap-3 text-sm text-[#C9D2DE]">
                <input
                  type="checkbox"
                  checked={joinTeam}
                  onChange={(e) => setJoinTeam(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#22D3EE]"
                />
                {t('ent.invite.joinTeam', { team: team.name })}
              </label>
            )}
            {currentUserId && (
              <label className="flex cursor-pointer items-start gap-3 text-sm text-[#C9D2DE]">
                <input
                  type="checkbox"
                  checked={underMe}
                  onChange={(e) => setUnderMe(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[#22D3EE]"
                />
                {t('ent.invite.underMe')}
              </label>
            )}
          </fieldset>
        </>
      )}

      {joinCode && (
        <div className={`mt-5 p-4 ${ENT_CARD}`}>
          <p className="text-sm font-medium text-[#EDF2F7]">{t('ent.invite.codeTitle')}</p>
          <p className="mt-1 text-label leading-snug text-[#8B96A8]">{t('ent.invite.codeHint')}</p>
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl border border-[#2D3542] bg-[#11151B] px-3.5 py-2.5 font-data text-body tracking-[0.12em] text-[#EDF2F7]">
              {joinCode}
            </code>
            <button
              type="button"
              onClick={copyCode}
              aria-label={t('ent.invite.copy')}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#2D3542] text-[#C9D2DE] transition-colors hover:border-[#22D3EE]/60 hover:text-[#EDF2F7]"
            >
              {copied ? <Check size={17} className="text-[#22D3EE]" aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
            </button>
          </div>
        </div>
      )}

      <EntActions>
        {sent ? (
          <span />
        ) : (
          <button type="button" onClick={onSkip} disabled={invite.isPending} className={ENT_LINK}>
            {t('common.skipStep')}
          </button>
        )}
        {sent ? (
          <button type="button" onClick={() => onDone(sent.emails)} className={ENT_PRIMARY}>
            {t('common.next')}
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            disabled={emails.length === 0 || invite.isPending}
            onClick={() =>
              invite.mutate(
                {
                  emails,
                  managerId: underMe && currentUserId ? currentUserId : null,
                  teamIds: joinTeam && team ? [team.id] : [],
                  accessDays: null,
                },
                {
                  onSuccess: ({ results, sending }) =>
                    setSent({
                      emails: results.filter((r) => r.status === 'created').map((r) => r.email),
                      unavailable: Boolean(sending.unavailable),
                    }),
                },
              )
            }
            className={ENT_PRIMARY}
          >
            {invite.isPending ? t('ent.invite.sending') : tp('ent.invite.cta', Math.max(1, emails.length))}
            {!invite.isPending && <ArrowRight size={17} aria-hidden="true" />}
          </button>
        )}
      </EntActions>
    </>
  );
};

// ─── Première équipe ─────────────────────────────────────────────────

export const TeamStep = ({
  orgId,
  onDraft,
  onDone,
  onSkip,
}: {
  orgId: string;
  onDraft: (name: string) => void;
  onDone: (teamId: string, name: string) => void;
  onSkip: () => void;
}) => {
  const { t } = useT('onboarding');
  const createTeam = useCreateOrgTeam(orgId);
  const [name, setName] = useState('');
  const valid = name.trim().length >= 2;
  const change = (value: string) => {
    setName(value);
    onDraft(value.trim());
  };
  const submit = () => {
    if (!valid || createTeam.isPending) return;
    const value = name.trim();
    createTeam.mutate({ name: value }, { onSuccess: (team) => onDone(team.id, value) });
  };

  return (
    <>
      <EntKicker>{t('ent.team.kicker')}</EntKicker>
      <EntTitle text={t('ent.team.title')} />
      <EntBody>{t('ent.team.body')}</EntBody>
      <label htmlFor="setup-team-name" className={`mt-6 ${ENT_LABEL}`}>
        {t('ent.team.label')}
      </label>
      <div className={`mt-2 ${ENT_FIELD}`}>
        <input
          id="setup-team-name"
          type="text"
          value={name}
          onChange={(e) => change(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={t('ent.team.placeholder')}
          maxLength={60}
          className={ENT_INPUT}
          autoFocus
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {[t('ent.team.idea1'), t('ent.team.idea2'), t('ent.team.idea3'), t('ent.team.idea4')].map((idea) => (
          <button key={idea} type="button" onClick={() => change(idea)} className={ENT_CHIP}>
            <Plus size={13} aria-hidden="true" />
            {idea}
          </button>
        ))}
      </div>
      <EntActions>
        <button type="button" onClick={onSkip} disabled={createTeam.isPending} className={ENT_LINK}>
          {t('common.skipStep')}
        </button>
        <button type="button" onClick={submit} disabled={!valid || createTeam.isPending} className={ENT_PRIMARY}>
          {createTeam.isPending ? t('common.creating') : t('ent.team.cta')}
          {!createTeam.isPending && <ArrowRight size={17} aria-hidden="true" />}
        </button>
      </EntActions>
    </>
  );
};

// ─── Premier projet, à partir d'un modèle ────────────────────────────

export const ProjectStep = ({
  orgId,
  currentUserId,
  createdTeamId,
  onDraft,
  onDone,
  onSkip,
}: {
  orgId: string;
  currentUserId?: string;
  createdTeamId: string | null;
  onDraft: (project: { name: string; taskCount: number }) => void;
  onDone: (project: { name: string; taskCount: number }) => void;
  onSkip: () => void;
}) => {
  const { t } = useT('onboarding');
  const { t: pf } = useT('portfolio');
  const createProject = useCreateTeamProjectWithTasks(orgId);
  const { data: teams = [] } = useOrgTeams(orgId);
  const [templateKey, setTemplateKey] = useState<TemplateKey>(BUILT_IN_TEMPLATES[0].key);
  const [name, setName] = useState('');
  const templateLabel = (key: TemplateKey) => pf(`builtIn.${key}` as 'builtIn.sprint');
  // Le projet va à l'équipe créée juste avant ; après un rechargement, à la
  // seule équipe de l'entreprise s'il n'y en a qu'une. Sinon, à toute
  // l'entreprise : c'est une création, visible et modifiable ensuite.
  const teamId = createdTeamId ?? (teams.length === 1 ? teams[0].id : null);
  const effectiveName = name.trim() || templateLabel(templateKey);
  const def = BUILT_IN_TEMPLATES.find((b) => b.key === templateKey);
  const taskCount = def?.tasks.length ?? 0;

  // La constellation dessine le projet tel qu'il sera créé, modèle compris.
  useEffect(() => {
    onDraft({ name: effectiveName, taskCount });
  }, [effectiveName, taskCount, onDraft]);

  const submit = () => {
    if (!def || createProject.isPending) return;
    const start = todayLocal();
    // Le modèle se DATE maintenant, depuis aujourd'hui : mêmes décalages que
    // la création depuis l'onglet Projets (`NewTeamProjectModal`).
    const fromTemplate = instantiateTemplate(builtInPayload(def, (key) => pf(key as 'builtIn.sprint')), start);
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
      },
      { onSuccess: () => onDone({ name: effectiveName, taskCount }) },
    );
  };

  return (
    <>
      <EntKicker>{t('ent.project.kicker')}</EntKicker>
      <EntTitle text={t('ent.project.title')} />
      <EntBody>{t('ent.project.body')}</EntBody>
      <fieldset className="mt-6 grid gap-2">
        <legend className={`mb-2 ${ENT_LABEL}`}>{t('ent.project.templateLegend')}</legend>
        {BUILT_IN_TEMPLATES.map((tpl) => {
          const active = templateKey === tpl.key;
          const listId = `setup-template-tasks-${tpl.key}`;
          return (
            <div
              key={tpl.key}
              className={`rounded-2xl border px-4 py-3 transition-colors ${
                active ? 'border-[#22D3EE]/70 bg-[#22D3EE]/[0.06]' : 'border-[#1F2530] bg-[#0E1116] hover:border-[#2D3542]'
              }`}
            >
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name="setup-template"
                  value={tpl.key}
                  checked={active}
                  onChange={() => setTemplateKey(tpl.key)}
                  aria-describedby={active ? listId : undefined}
                  className="h-4 w-4 shrink-0 accent-[#22D3EE]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-semibold text-[#EDF2F7]">{templateLabel(tpl.key)}</span>
                  <span className="block font-data text-caption text-[#8B96A8]">
                    {t('ent.project.templateMeta', { tasks: tpl.tasks.length, days: tpl.durationDays })}
                  </span>
                </span>
              </label>
              {/* Le modèle choisi montre ses tâches (on choisissait à l'aveugle
                  entre deux noms, relevé le 2026-10-04). HORS du <label> : dedans,
                  la liste entrait dans le nom accessible du bouton radio. */}
              {active && (
                <ul id={listId} className="ml-7 mt-2 space-y-1 border-l border-[#2D3542] pl-3">
                  {tpl.tasks.map((task) => (
                    <li key={task.key} className="text-label text-[#C9D2DE]">
                      {pf(`builtIn.${task.key}` as 'builtIn.sprint')}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </fieldset>
      <label htmlFor="setup-project-name" className={`mt-5 ${ENT_LABEL}`}>
        {t('ent.project.label')}
      </label>
      <div className={`mt-2 ${ENT_FIELD}`}>
        <input
          id="setup-project-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={templateLabel(templateKey)}
          maxLength={120}
          className={ENT_INPUT}
        />
      </div>
      <EntActions>
        <button type="button" onClick={onSkip} disabled={createProject.isPending} className={ENT_LINK}>
          {t('common.skipStep')}
        </button>
        <button type="button" onClick={submit} disabled={createProject.isPending} className={ENT_PRIMARY}>
          {createProject.isPending ? t('common.creating') : t('ent.project.cta')}
          {!createProject.isPending && <ArrowRight size={17} aria-hidden="true" />}
        </button>
      </EntActions>
    </>
  );
};

// ─── Le cap : premier objectif d'entreprise ──────────────────────────

export const ObjectiveStep = ({
  orgId,
  onDraft,
  onDone,
  onSkip,
}: {
  orgId: string;
  onDraft: (objective: string) => void;
  onDone: (objective: string) => void;
  onSkip: () => void;
}) => {
  const { t } = useT('onboarding');
  const createOkr = useCreateTeamOKR(orgId);
  const [objective, setObjective] = useState('');
  const [keyResult, setKeyResult] = useState('');
  const [target, setTarget] = useState('');
  // Le schéma exige un résultat clé : sans lui, le bouton reste fermé plutôt
  // que de laisser zod répondre par une erreur que personne n'a demandée.
  const valid = objective.trim().length > 0 && keyResult.trim().length > 0;

  const submit = () => {
    if (!valid || createOkr.isPending) return;
    const title = objective.trim();
    createOkr.mutate(buildCompanyOkrInput(title, keyResult, target), { onSuccess: () => onDone(title) });
  };

  return (
    <>
      <EntKicker>{t('ent.objective.kicker')}</EntKicker>
      <EntTitle text={t('ent.objective.title')} />
      <EntBody>{t('ent.objective.body')}</EntBody>
      <label htmlFor="setup-objective" className={`mt-6 ${ENT_LABEL}`}>
        {t('ent.objective.objectiveLabel')}
      </label>
      <div className={`mt-2 ${ENT_FIELD}`}>
        <input
          id="setup-objective"
          type="text"
          value={objective}
          onChange={(e) => {
            setObjective(e.target.value);
            onDraft(e.target.value.trim());
          }}
          placeholder={t('ent.objective.objectivePlaceholder')}
          maxLength={200}
          className={ENT_INPUT}
          autoFocus
        />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_9.5rem]">
        <div>
          <label htmlFor="setup-kr" className={ENT_LABEL}>
            {t('ent.objective.krLabel')}
          </label>
          <div className={`mt-2 ${ENT_FIELD}`}>
            <input
              id="setup-kr"
              type="text"
              value={keyResult}
              onChange={(e) => setKeyResult(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder={t('ent.objective.krPlaceholder')}
              maxLength={300}
              className={ENT_INPUT}
            />
          </div>
        </div>
        <div>
          <label htmlFor="setup-kr-target" className={ENT_LABEL}>
            {t('ent.objective.targetLabel')}
          </label>
          <div className={`mt-2 ${ENT_FIELD}`}>
            <input
              id="setup-kr-target"
              type="number"
              inputMode="decimal"
              min={0}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={t('ent.objective.targetPlaceholder')}
              className={ENT_INPUT}
            />
          </div>
        </div>
      </div>
      <p className="mt-3 text-label text-[#8B96A8]">{t('ent.objective.hint')}</p>
      {objective.trim() && !keyResult.trim() && (
        <p role="status" className="mt-2 text-label text-[#F5B942]">
          {t('ent.objective.krNeeded')}
        </p>
      )}
      <EntActions>
        <button type="button" onClick={onSkip} disabled={createOkr.isPending} className={ENT_LINK}>
          {t('common.skipStep')}
        </button>
        <button type="button" onClick={submit} disabled={!valid || createOkr.isPending} className={ENT_PRIMARY}>
          {createOkr.isPending ? t('common.creating') : t('ent.objective.cta')}
          {!createOkr.isPending && <ArrowRight size={17} aria-hidden="true" />}
        </button>
      </EntActions>
    </>
  );
};

// ─── Fin ─────────────────────────────────────────────────────────────

export const DoneStep = ({
  orgName,
  invitedCount,
  teamName,
  projectName,
  objective,
  onFinish,
}: {
  orgName: string;
  invitedCount: number;
  teamName: string;
  projectName: string;
  objective: string;
  onFinish: () => void;
}) => {
  const { t, tp } = useT('onboarding');
  const recap: string[] = [];
  if (invitedCount > 0) recap.push(tp('ent.done.invited', invitedCount));
  if (teamName) recap.push(t('ent.done.team', { name: teamName }));
  if (projectName) recap.push(t('ent.done.project', { name: projectName }));
  if (objective) recap.push(t('ent.done.objective', { name: objective }));

  return (
    <>
      <EntTitle text={t('ent.done.title', { name: orgName })} />
      <EntBody>{t('ent.done.body')}</EntBody>
      <div className={`mt-6 p-4 ${ENT_CARD}`}>
        <p className={ENT_LABEL}>{t('ent.done.recapTitle')}</p>
        {recap.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {recap.map((line) => (
              <li key={line} className="flex items-start gap-3 text-body leading-snug text-[#EDF2F7]">
                <Check size={16} className="mt-0.5 shrink-0 text-[#22D3EE]" aria-hidden="true" />
                <span className="min-w-0 break-words">{line}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-body leading-snug text-[#8B96A8]">{t('ent.done.nothing')}</p>
        )}
      </div>
      <p className={`mt-6 ${ENT_LABEL}`}>{t('ent.done.mapTitle')}</p>
      <div className="mt-3">
        <PlacesGrid keys={['overview', 'tasks', 'projects', 'okr', 'pyramid', 'members']} label={t('ent.done.mapTitle')} compact />
      </div>
      <EntActions>
        <span />
        <button type="button" onClick={onFinish} className={ENT_PRIMARY}>
          {t('ent.done.cta')}
          <ArrowRight size={17} aria-hidden="true" />
        </button>
      </EntActions>
    </>
  );
};
