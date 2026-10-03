import { useState } from 'react';
import type React from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Compass, Eye, ListChecks } from 'lucide-react';
import { toast } from '@/lib/toast';
import { useT } from '@/i18n/useT';
import { useAuth } from '@/modules/auth/AuthContext';
import {
  useActiveOrganization,
  useCancelJoinRequest,
  useCreateOrganization,
  useMySentJoinRequest,
  useRequestJoinOrganization,
} from '@/modules/organizations';
import OrgConsentNotice from '@/components/organization/OrgConsentNotice';
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
import {
  ENT_CARD,
  ENT_FIELD,
  ENT_INPUT,
  ENT_LABEL,
  ENT_LINK,
  ENT_PRIMARY,
  ENT_SECONDARY,
  EntActions,
  EntBody,
  EntKicker,
  EntTitle,
} from './ent-ui';
import { DoneStep, InviteStep, ObjectiveStep, ProjectStep, TeamStep } from './SetupSteps';
import { PlacesGrid } from './ent-places';

type Mode = 'welcome' | 'create' | 'join';

/**
 * Accueil entreprise complet (refait le 2026-10-03), affiché juste après une
 * inscription « Entreprise » (SignupPage / LoginModal redirigent ici).
 *
 *   bienvenue → créer (nom) → mise en place : inviter, équipe, projet, cap → fin
 *            ↘ rejoindre (code + consentement) → attente, avec la visite des lieux
 *
 * À droite, la constellation dessine l'entreprise au fil des réponses.
 *
 * Contrats repris de la page précédente, et qui tiennent :
 *  · après une CRÉATION, la page devient l'assistant (`?setup=<org>`, étape
 *    dans `?step=`), réservé à un admin de cette organisation, soit celui qui
 *    vient de la créer ; tout autre cas retombe sur la bienvenue ;
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
  const { t, tp } = useT('onboarding');
  const navigate = useNavigate();
  const reduce = useReducedMotion() ?? false;
  const { activeOrg, organizations, isLoading, setActiveOrgId } = useActiveOrganization();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const setupOrgId = searchParams.get('setup');
  const setupOrg = setupOrgId ? organizations.find((o) => o.id === setupOrgId && o.myRole === 'admin') : undefined;
  const screen = parseSetupScreen(searchParams.get('step'));

  const [mode, setMode] = useState<Mode>('welcome');
  const [orgDraft, setOrgDraft] = useState('');
  const [code, setCode] = useState('');
  const [consent, setConsent] = useState(false);

  const createOrg = useCreateOrganization();
  const requestJoin = useRequestJoinOrganization();
  const cancelJoin = useCancelJoinRequest();
  const { data: sentRequest } = useMySentJoinRequest();

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

  const goToScreen = (next: OrgSetupScreen) => {
    if (!setupOrg) return;
    navigate(orgSetupPath(setupOrg.id, next));
  };
  const finishSetup = () => {
    if (setupOrg) {
      setActiveOrgId(setupOrg.id);
      // Qui vient de tout mettre en place n'a pas besoin de l'accueil membre.
      if (user?.id) markMemberWelcomeSeen(setupOrg.id, user.id);
    }
    navigate('/entreprise');
  };

  const settingUp = Boolean(setupOrgId && (isLoading || setupOrg));
  const pending = !settingUp && Boolean(sentRequest);
  const view: 'setup' | 'pending' | Mode = settingUp ? 'setup' : pending ? 'pending' : mode;

  const focus: ConstellationFocus =
    view === 'setup' ? screen : view === 'create' ? 'name' : view === 'join' || view === 'pending' ? 'join' : 'demo';
  const orgName = setupOrg?.name ?? (view === 'create' ? orgDraft.trim() : '');
  const stage = {
    focus,
    orgName,
    youInitials: initials(user?.name),
    people: invited.length > 0 ? invited : view === 'setup' && screen === 'invite' ? peopleDraft : [],
    teamName: teamName || (screen === 'team' ? teamDraft : ''),
    project: project ?? (screen === 'project' ? projectDraft : null),
    objective: objective || (screen === 'objective' ? objectiveDraft : ''),
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

  const leave = () => (setupOrg ? finishSetup() : navigate('/dashboard'));

  let content: React.ReactNode = null;
  if (view === 'setup') {
    content = !setupOrg ? (
      <div className="h-40" aria-hidden="true" />
    ) : screen === 'invite' ? (
      <InviteStep
        orgId={setupOrg.id}
        joinCode={setupOrg.joinCode}
        onDraft={setPeopleDraft}
        onDone={(emails) => {
          setInvited(emails);
          goToScreen('team');
        }}
        onSkip={() => goToScreen('team')}
      />
    ) : screen === 'team' ? (
      <TeamStep
        orgId={setupOrg.id}
        onDraft={setTeamDraft}
        onDone={(id, name) => {
          setTeamId(id);
          setTeamName(name);
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
  } else if (view === 'pending') {
    content = (
      <>
        <EntTitle text={t('ent.pending.title')} size="lg" />
        <EntBody>{t('ent.pending.body')}</EntBody>
        <div className="mt-7">
          <PlacesGrid keys={['overview', 'tasks', 'projects', 'okr']} label={t('ent.pending.tourLabel')} />
        </div>
        <EntActions>
          <button
            type="button"
            onClick={() =>
              sentRequest &&
              cancelJoin.mutate(sentRequest.id, { onSuccess: () => toast.success(t('ent.pending.cancelled')) })
            }
            disabled={cancelJoin.isPending}
            className={ENT_LINK}
          >
            {t('ent.pending.cancel')}
          </button>
          <span />
        </EntActions>
      </>
    );
  } else if (view === 'create') {
    const valid = orgDraft.trim().length >= 2;
    const submit = () => {
      if (!valid || createOrg.isPending) return;
      createOrg.mutate(orgDraft.trim(), { onSuccess: (org) => setSearchParams({ setup: org.id }) });
    };
    content = (
      <>
        <button type="button" onClick={() => setMode('welcome')} className={`-ml-2 mb-6 inline-flex items-center gap-1.5 ${ENT_LINK}`}>
          <ArrowLeft size={15} aria-hidden="true" />
          {t('common.back')}
        </button>
        <EntKicker>{t('ent.create.kicker')}</EntKicker>
        <EntTitle text={t('ent.create.title')} />
        <EntBody>{t('ent.create.body')}</EntBody>
        <label htmlFor="org-name" className={`mt-6 ${ENT_LABEL}`}>
          {t('ent.create.label')}
        </label>
        <div className={`mt-2 ${ENT_FIELD}`}>
          <input
            id="org-name"
            type="text"
            value={orgDraft}
            onChange={(e) => setOrgDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder={t('ent.create.placeholder')}
            maxLength={80}
            autoFocus
            className={`${ENT_INPUT} h-14 font-display text-2xl italic`}
          />
        </div>
        <EntActions>
          <span />
          <button type="button" onClick={submit} disabled={!valid || createOrg.isPending} className={ENT_PRIMARY}>
            {createOrg.isPending ? t('common.creating') : t('ent.create.cta')}
            {!createOrg.isPending && <ArrowRight size={17} aria-hidden="true" />}
          </button>
        </EntActions>
      </>
    );
  } else if (view === 'join') {
    const valid = code.trim().length > 0 && consent;
    const submit = () => {
      if (!valid || requestJoin.isPending) return;
      requestJoin.mutate(code.trim(), { onSuccess: () => setCode('') });
    };
    content = (
      <>
        <button type="button" onClick={() => setMode('welcome')} className={`-ml-2 mb-6 inline-flex items-center gap-1.5 ${ENT_LINK}`}>
          <ArrowLeft size={15} aria-hidden="true" />
          {t('common.back')}
        </button>
        <EntKicker>{t('ent.join.kicker')}</EntKicker>
        <EntTitle text={t('ent.join.title')} />
        <EntBody>{t('ent.join.body')}</EntBody>
        <label htmlFor="org-code" className={`mt-6 ${ENT_LABEL}`}>
          {t('ent.join.label')}
        </label>
        <div className={`mt-2 ${ENT_FIELD}`}>
          <input
            id="org-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="COSMO-XXXXXXXXXX"
            // 'COSMO-' + 10 caractères depuis la mig. 083 (faille M-7) = 16.
            // Une limite plus courte TRONQUAIT les codes récents à la saisie,
            // et la personne lisait « Code invalide » sur un code valide.
            maxLength={16}
            autoFocus
            className={`${ENT_INPUT} font-data tracking-[0.16em]`}
          />
        </div>
        <div className="mt-4">
          <OrgConsentNotice checked={consent} onChange={setConsent} />
        </div>
        <EntActions>
          <span />
          <button type="button" onClick={submit} disabled={!valid || requestJoin.isPending} className={ENT_PRIMARY}>
            {requestJoin.isPending ? t('ent.join.sending') : t('ent.join.cta')}
            {!requestJoin.isPending && <ArrowRight size={17} aria-hidden="true" />}
          </button>
        </EntActions>
      </>
    );
  } else {
    content = (
      <>
        {/* Multi-org : déjà membre → raccourci, MAIS on peut toujours en
            créer ou en rejoindre une autre en dessous. */}
        {!isLoading && activeOrg && (
          <div className={`mb-8 p-4 ${ENT_CARD}`}>
            <p className="text-body text-[#EDF2F7]">
              {organizations.length > 1
                ? tp('ent.welcome.memberOfCount', organizations.length)
                : t('ent.welcome.memberOf', { name: activeOrg.name })}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => navigate('/entreprise')} className={`${ENT_PRIMARY} h-11`}>
                {t('ent.welcome.goToOrg')}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
              <span className="text-label text-[#8B96A8]">{t('ent.welcome.orAnother')}</span>
            </div>
          </div>
        )}
        <EntTitle text={t('ent.welcome.title')} size="lg" />
        <EntBody>{t('ent.welcome.body')}</EntBody>
        <ul aria-label={t('ent.welcome.pillarsLabel')} className="mt-7 space-y-4">
          {[
            { Icon: ListChecks, title: t('ent.welcome.p1Title'), body: t('ent.welcome.p1Body') },
            { Icon: Eye, title: t('ent.welcome.p2Title'), body: t('ent.welcome.p2Body') },
            { Icon: Compass, title: t('ent.welcome.p3Title'), body: t('ent.welcome.p3Body') },
          ].map(({ Icon, title, body }) => (
            <li key={title} className="flex gap-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#2D3542] text-[#EDF2F7]">
                <Icon size={17} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-body font-semibold text-[#EDF2F7]">{title}</span>
                <span className="mt-0.5 block text-sm leading-snug text-[#8B96A8]">{body}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-9" role="group" aria-label={t('ent.welcome.choiceLabel')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <button type="button" onClick={() => setMode('create')} className={`${ENT_PRIMARY} w-full`}>
                {t('ent.welcome.create')}
                <ArrowRight size={17} aria-hidden="true" />
              </button>
              <p className="mt-2 px-1 text-xs leading-snug text-[#8B96A8]">{t('ent.welcome.createHint')}</p>
            </div>
            <div>
              <button type="button" onClick={() => setMode('join')} className={`${ENT_SECONDARY} w-full`}>
                {t('ent.welcome.join')}
              </button>
              <p className="mt-2 px-1 text-xs leading-snug text-[#8B96A8]">{t('ent.welcome.joinHint')}</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const current = setupStepIndex(screen);
  const stepLabels: Record<(typeof ORG_SETUP_STEPS)[number], string> = {
    name: t('ent.steps.name'),
    invite: t('ent.steps.invite'),
    team: t('ent.steps.team'),
    project: t('ent.steps.project'),
    objective: t('ent.steps.objective'),
  };
  const contentKey = view === 'setup' ? `setup-${screen}` : view;

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
            {view === 'setup' && setupOrg && screen !== 'done' ? (
              <button type="button" onClick={finishSetup} className={ENT_LINK}>
                {t('common.skipAll')}
              </button>
            ) : view !== 'setup' ? (
              <button type="button" onClick={leave} className={`hidden sm:inline-flex ${ENT_LINK}`}>
                {t('ent.welcome.later')}
              </button>
            ) : null}
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
              {view === 'setup' && setupOrg && (
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
              {view === 'setup' && setupOrg && screen !== 'done' && (
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

              {view !== 'setup' && (
                <button type="button" onClick={leave} className={`mt-6 sm:hidden ${ENT_LINK} -ml-2`}>
                  {t('ent.welcome.later')}
                </button>
              )}
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
