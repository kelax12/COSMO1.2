import { useState } from 'react';
import type React from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { useAuth } from '@/modules/auth/AuthContext';
import { useActiveOrganization } from '@/modules/organizations';
import { useEmailInvitations } from '@/modules/organizations/governance.hooks';
import { useOrgTeams } from '@/modules/org-teams';
import { useTeamProjects } from '@/modules/team-projects';
import { useTeamOKRs } from '@/modules/team-okrs';
import { setBusinessPending } from '../first-run';
import {
  ORG_SETUP_STEPS,
  orgSetupPath,
  parseSetupScreen,
  setupStepIndex,
  type OrgSetupScreen,
} from '@/components/organization/org-setup.helpers';
import Constellation, { type ConstellationFocus } from './Constellation';
import { initials } from './constellation-geometry';
import { ENT_SCOPE, markMemberWelcomeSeen } from './ent-onboarding';
import { ENT_LINK } from './ent-ui';
import { DoneStep, InviteStep, ObjectiveStep, ProjectStep, TeamStep } from './SetupSteps';
import OrgChoice from './OrgChoice';

/**
 * Accueil entreprise, affiché juste après une inscription « Entreprise »
 * (SignupPage / LoginModal redirigent ici).
 *
 *   choix créer | rejoindre (`OrgChoice`, la carte d'avant le 2026-10-03,
 *   remise le 2026-10-09) → mise en place : équipe, invitations, projet, cap → fin
 *
 * À droite, la constellation dessine l'entreprise au fil des réponses.
 *
 * Contrats repris de la page précédente, et qui tiennent :
 *  · après une CRÉATION, la page devient l'assistant (`?setup=<org>`, étape
 *    dans `?step=`), réservé à un admin de cette organisation, soit celui qui
 *    vient de la créer ; tout autre cas retombe sur le choix ;
 *  · ⚠️ la navigation part de `setupOrg.id`, jamais de `setupOrgId` : ce
 *    dernier est lu dans l'URL, tel quel (cf. `no-open-redirect.test.ts`) ;
 *  · chaque étape est une entrée d'historique : le bouton précédent ramène à
 *    la précédente au lieu de quitter l'assistant.
 *
 * ⚠️ DA FIXE (nuit de la landing entreprise) : variables de thème redéclarées
 * sur le conteneur (`ENT_SCOPE`), pour que les champs globaux et
 * `OrgConsentNotice` suivent la nuit quel que soit le thème de l'app.
 */
const EnterpriseOnboarding = () => {
  const { t } = useT('onboarding');
  const navigate = useNavigate();
  const reduce = useReducedMotion() ?? false;
  const { organizations, isLoading, setActiveOrgId } = useActiveOrganization();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const setupOrgId = searchParams.get('setup');
  const setupOrg = setupOrgId ? organizations.find((o) => o.id === setupOrgId && o.myRole === 'admin') : undefined;
  const screen = parseSetupScreen(searchParams.get('step'));

  // Ce qui a été posé pendant la visite, et les brouillons en cours : la
  // constellation dessine les deux. Perdus au rechargement, sans conséquence :
  // l'écran de fin ne résume que la visite en cours.
  const [peopleDraft, setPeopleDraft] = useState<string[]>([]);
  const [invited, setInvited] = useState<string[]>([]);
  const [teamDraft, setTeamDraft] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamId, setTeamId] = useState<string | null>(null);
  const [projectDraft, setProjectDraft] = useState<{ name: string; taskCount: number } | null>(null);
  const [project, setProject] = useState<{ name: string; taskCount: number } | null>(null);
  const [objectiveDraft, setObjectiveDraft] = useState('');
  const [objective, setObjective] = useState('');

  // 🔴 La constellation se redessine à partir des VRAIES données de
  // l'entreprise : après un rechargement, l'état local est perdu, et la scène
  // repartait en pointillés comme si rien n'avait été enregistré (relevé le
  // 2026-10-04). L'état local reste prioritaire : il suit la frappe.
  const realOrgId = setupOrg?.id;
  const { data: realTeams = [] } = useOrgTeams(realOrgId);
  const { data: realInvites = [] } = useEmailInvitations(realOrgId);
  const { data: realProjects = [] } = useTeamProjects(realOrgId);
  const { data: realOkrs = [] } = useTeamOKRs(realOrgId);
  const firstRealProject = realProjects.find((p) => !p.archivedAt);
  const firstRealOkr = realOkrs[0];
  // L'équipe à laquelle rattacher les invitations : celle créée pendant la
  // visite, sinon la seule de l'entreprise s'il n'y en a qu'une.
  const inviteTeam = teamId
    ? { id: teamId, name: teamName }
    : realTeams.length === 1
      ? { id: realTeams[0].id, name: realTeams[0].name }
      : null;

  const goToScreen = (next: OrgSetupScreen) => {
    if (!setupOrg) return;
    navigate(orgSetupPath(setupOrg.id, next));
  };
  const finishSetup = () => {
    setBusinessPending(false);
    if (setupOrg) {
      setActiveOrgId(setupOrg.id);
      // Qui vient de tout mettre en place n'a pas besoin de l'accueil membre.
      if (user?.id) markMemberWelcomeSeen(setupOrg.id, user.id);
    }
    navigate('/entreprise');
  };

  const settingUp = Boolean(setupOrgId && (isLoading || setupOrg));
  const focus: ConstellationFocus = screen;
  const orgName = setupOrg?.name ?? '';
  const stage = {
    focus,
    orgName,
    youInitials: initials(user?.name),
    people:
      invited.length > 0
        ? invited
        : screen === 'invite' && peopleDraft.length > 0
          ? peopleDraft
          : realInvites.filter((i) => !i.claimedAt).map((i) => i.email),
    teamName: teamName || (screen === 'team' ? teamDraft : '') || realTeams[0]?.name || '',
    project:
      project ??
      (screen === 'project' ? projectDraft : null) ??
      (firstRealProject ? { name: firstRealProject.name, taskCount: 4 } : null),
    objective: objective || (screen === 'objective' ? objectiveDraft : '') || firstRealOkr?.title || '',
    labels: {
      you: t('ent.stage.you'),
      north: t('ent.stage.north'),
      team: t('ent.stage.team'),
      project: t('ent.stage.project'),
      orgFallback: t('ent.stage.orgFallback'),
      pending: t('ent.stage.pending'),
    },
  };

  const enter = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 } };

  // Sans mise en place à mener, c'est le choix « créer ou rejoindre ».
  if (!settingUp) return <OrgChoice />;

  const content: React.ReactNode = !setupOrg ? (
    <div className="h-40" aria-hidden="true" />
  ) : screen === 'team' ? (
    <TeamStep
      orgId={setupOrg.id}
      onDraft={setTeamDraft}
      onDone={(id, name) => {
        setTeamId(id);
        setTeamName(name);
        goToScreen('invite');
      }}
      onSkip={() => goToScreen('invite')}
    />
  ) : screen === 'invite' ? (
    <InviteStep
      orgId={setupOrg.id}
      joinCode={setupOrg.joinCode}
      team={inviteTeam}
      currentUserId={user?.id}
      onDraft={setPeopleDraft}
      onDone={(emails) => {
        setInvited(emails);
        goToScreen('project');
      }}
      onSkip={() => goToScreen('project')}
    />
  ) : screen === 'project' ? (
    <ProjectStep
      orgId={setupOrg.id}
      currentUserId={user?.id}
      createdTeamId={teamId}
      onDraft={setProjectDraft}
      onDone={(p) => {
        setProject(p);
        goToScreen('objective');
      }}
      onSkip={() => {
        setProjectDraft(null);
        goToScreen('objective');
      }}
    />
  ) : screen === 'objective' ? (
    <ObjectiveStep
      orgId={setupOrg.id}
      onDraft={setObjectiveDraft}
      onDone={(title) => {
        setObjective(title);
        goToScreen('done');
      }}
      onSkip={() => goToScreen('done')}
    />
  ) : (
    <DoneStep
      orgName={setupOrg.name}
      invitedCount={invited.length}
      teamName={teamName}
      projectName={project?.name ?? ''}
      objective={objective}
      onFinish={finishSetup}
    />
  );

  const current = setupStepIndex(screen);
  const stepLabels: Record<(typeof ORG_SETUP_STEPS)[number], string> = {
    name: t('ent.steps.name'),
    invite: t('ent.steps.invite'),
    team: t('ent.steps.team'),
    project: t('ent.steps.project'),
    objective: t('ent.steps.objective'),
  };
  const contentKey = `setup-${screen}`;

  return (
    <main className="min-h-[100dvh] bg-[#08090C] text-[#EDF2F7]" style={ENT_SCOPE}>
      <div className="min-h-[100dvh] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.04fr)]">
        <div className="flex min-h-[100dvh] flex-col">
          <header className="flex items-center justify-between gap-3 px-5 pt-4 sm:px-10 lg:px-14 lg:pt-8">
            <span className="flex items-center gap-2.5">
              <img src="/logo.svg" alt="" className="h-8 w-8" />
              <span className="text-body font-semibold tracking-[-0.01em]">COSMO</span>
              <span className="rounded-full border border-[#22D3EE]/40 px-2 py-0.5 font-data text-caption uppercase tracking-[0.16em] text-[#22D3EE]">
                {t('ent.badge')}
              </span>
            </span>
            {setupOrg && screen !== 'done' && (
              <button type="button" onClick={finishSetup} className={ENT_LINK}>
                {t('common.skipAll')}
              </button>
            )}
          </header>

          {/* Constellation réduite, au-dessus du formulaire sur téléphone. */}
          <div aria-hidden="true" className="relative mx-5 mt-3 h-[230px] overflow-hidden rounded-[22px] border border-[#1F2530] bg-[#0B0D11] sm:mx-10 sm:h-[280px] lg:hidden">
            <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(34,211,238,0.14),transparent_70%)]" />
            <div className="relative h-full py-2">
              <Constellation {...stage} compact />
            </div>
          </div>

          <div className="flex flex-1 flex-col px-5 pt-7 sm:justify-center sm:px-10 lg:px-14 lg:py-10">
            <div className="flex w-full max-w-[33rem] flex-1 flex-col sm:flex-none">
              {setupOrg && (
                <ol className="mb-8 flex items-center gap-1.5" aria-label={t('ent.steps.aria')}>
                  {ORG_SETUP_STEPS.map((step, i) => {
                    const done = i < current;
                    const active = i === current;
                    return (
                      <li key={step} className="min-w-0 flex-1" aria-current={active ? 'step' : undefined}>
                        <span
                          className={`block h-1 rounded-full transition-colors duration-500 ${
                            done ? 'bg-[#EDF2F7]/60' : active ? 'bg-[#22D3EE]' : 'bg-[#1F2530]'
                          }`}
                          aria-hidden="true"
                        />
                        {/* Sur téléphone, cinq libellés ne tiennent pas côte à
                            côte : ils restent lus (`sr-only`), et l'étape en
                            cours est écrite en clair sous le fil. */}
                        <span
                          className={`sr-only mt-2 items-center gap-1 whitespace-nowrap font-data text-caption uppercase tracking-[0.1em] sm:not-sr-only sm:flex ${
                            active ? 'text-[#22D3EE]' : done ? 'text-[#C9D2DE]' : 'text-[#5E6878]'
                          }`}
                        >
                          {done && <Check size={11} aria-hidden="true" />}
                          {stepLabels[step]}
                          <span className="sr-only">
                            {` (${done ? t('ent.steps.stateDone') : active ? t('ent.steps.stateCurrent') : t('ent.steps.stateTodo')})`}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              )}
              {setupOrg && screen !== 'done' && (
                <p className="-mt-5 mb-8 font-data text-caption uppercase tracking-[0.12em] text-[#22D3EE] sm:hidden" aria-hidden="true">
                  {`${t('common.progress', { current: String(current + 1), total: String(ORG_SETUP_STEPS.length) })} · ${stepLabels[ORG_SETUP_STEPS[current]]}`}
                </p>
              )}

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={contentKey}
                  {...enter}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  // Colonne flexible sur téléphone : `EntActions` s'y pousse en bas.
                  className="flex flex-1 flex-col sm:block"
                >
                  {content}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
          <div className="hidden h-6 sm:block lg:h-0" />
        </div>

        {/* La scène : le ciel de l'entreprise. */}
        <aside aria-hidden="true" className="relative hidden lg:block">
          <div className="sticky top-0 flex h-[100dvh] items-center justify-center overflow-hidden border-l border-[#14181F] bg-[#0A0C10] px-10 py-12">
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.45]"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.08) 1px, transparent 1px)',
                backgroundSize: '64px 64px',
                maskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, #000 30%, transparent 100%)',
                WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 30%, #000 30%, transparent 100%)',
              }}
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] bg-[radial-gradient(ellipse_50%_50%_at_50%_0%,rgba(34,211,238,0.14),transparent_70%)]" />
            <div className="relative aspect-square w-full max-w-[min(600px,78vh)]">
              <Constellation {...stage} />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
};

export default EnterpriseOnboarding;
