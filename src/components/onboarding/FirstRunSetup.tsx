import { useMemo, useRef, useState } from 'react';
import type React from 'react';
import { useLocation } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CalendarClock, Check, MoveRight, Plus, Sparkles, X } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { useIsDemo } from '@/lib/app-mode.store';
import { useAuth } from '@/modules/auth/AuthContext';
import { useTasks, useCreateTask } from '@/modules/tasks';
import { useCreateHabit } from '@/modules/habits';
import { useCreateOkr } from '@/modules/okrs';
import {
  MAX_FIRST_TASKS,
  buildHabitInput,
  buildOkrInput,
  buildTaskInput,
  firstName,
  markFirstRunDone,
  readFirstRunDone,
  shouldOfferFirstRun,
} from './first-run';
import { EMPHASIS_CLASS, withEmphasis } from './onboarding-text';
import Orrery from './perso/Orrery';
import PersoPreview from './perso/PersoPreview';
import { PLANETS, PLANET_COLOR, type Planet } from './perso/orrery-geometry';

/**
 * Premier écran d'un compte réel (T-23), refait le 2026-10-03 en planétaire :
 * COSMO se présente comme un système dont vous êtes le centre, et chaque
 * étape allume l'orbite d'un module. Quatre étapes (tâches, agenda,
 * habitudes, objectif), encadrées d'une présentation et d'un bilan.
 *
 * Les règles de la version précédente tiennent toutes, et pour les mêmes
 * raisons (cf. `src/components/CLAUDE.md` § Onboarding) :
 *
 * ⚠️ Monté dans `Layout`, PAS sur une route : une inscription par Google ne
 * repasse pas par `SignupPage`.
 *
 * ⚠️ Chaque étape crée AU MOMENT où elle est validée, jamais à la fin.
 * Quelqu'un qui répond à la première question puis ferme l'onglet garde sa
 * tâche : c'est précisément la population qu'on essaie de retenir.
 *
 * ⚠️ L'étape Agenda ne crée rien et ne demande rien : elle montre ce que
 * devient une tâche posée sur l'agenda, avec la PREMIÈRE tâche que la
 * personne vient d'écrire. On ne crée pas de créneau à sa place : elle n'a
 * donné aucune heure.
 *
 * ⚠️ DA FIXE, claire, celle de la landing perso d'où vient la personne
 * (blanc, encre, bleu → violet → fuchsia), quel que soit le thème de l'app.
 * Les variables de thème sont redéclarées sur le conteneur (`LIGHT_SCOPE`) :
 * sans elles, les styles globaux des champs (`index.css`) dessineraient des
 * bordures sombres en thème Noir, sur ce fond blanc.
 */
const TOTAL_STEPS = PLANETS.length;
const STEP_DONE = TOTAL_STEPS + 1;

const LIGHT_SCOPE = {
  colorScheme: 'light',
  '--color-border': '226 232 240',
  '--color-border-strong': '148 163 184',
  '--color-accent': '37 99 235',
  '--color-surface': '255 255 255',
  '--color-background': '255 255 255',
  '--color-hover': '241 245 249',
  '--color-text-primary': '15 23 42',
  '--color-text-secondary': '71 85 105',
  '--color-text-muted': '100 116 139',
} as React.CSSProperties;

const PRIMARY =
  'inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--cta)] px-6 text-body font-semibold text-white shadow-[0_12px_28px_-14px_var(--cta)] transition-[filter] hover:brightness-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cta)]';
const SKIP =
  'rounded-full px-2 py-2 text-sm font-medium text-[#64748B] underline-offset-4 transition-colors hover:text-[#0F172A] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563EB]';
const FIELD =
  'flex items-center gap-2 rounded-2xl border border-[#E2E8F0] bg-white p-1.5 pl-4 transition-shadow focus-within:border-[#2563EB] focus-within:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]';
const FIELD_INPUT =
  'no-input-chrome h-11 min-w-0 flex-1 bg-transparent text-base text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none';
const CHIP =
  'inline-flex items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-white px-3 py-1.5 text-label text-[#334155] transition-colors hover:border-[#2563EB] hover:text-[#1D4ED8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563EB]';
const QUESTION =
  'mt-3 text-3xl font-semibold leading-[1.06] tracking-[-0.035em] text-[#0F172A] sm:text-4xl';

/** Planète de chaque étape (1 à 4). */
const stepPlanet = (step: number): Planet | null => PLANETS[step - 1] ?? null;

const FirstRunSetup: React.FC = () => {
  const { t, tp } = useT('onboarding');
  const isDemo = useIsDemo();
  const { pathname } = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { data: tasks, isSuccess } = useTasks({ enabled: isAuthenticated && !isDemo });
  const createTask = useCreateTask();
  const createHabit = useCreateHabit();
  const createOkr = useCreateOkr();
  const reduce = useReducedMotion() ?? false;
  // Le focus d'entrée va au bouton « Commencer », pas au premier focalisable
  // (« Passer l'accueil ») : la touche Entrée doit faire avancer, pas fermer.
  const primaryRef = useRef<HTMLButtonElement>(null);

  // Lu une seule fois : le marquage se fait à la sortie, et relire à chaque
  // rendu ferait disparaître l'écran sous les doigts de la personne.
  const alreadyDone = useMemo(() => readFirstRunDone(), []);
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState(0);
  const [taskDraft, setTaskDraft] = useState('');
  const [taskNames, setTaskNames] = useState<string[]>([]);
  const [habitDraft, setHabitDraft] = useState('');
  const [okrDraft, setOkrDraft] = useState('');
  const [krDraft, setKrDraft] = useState('');
  // Ce qui a été créé, pour l'étape Agenda (la première tâche) et le bilan.
  const [createdTasks, setCreatedTasks] = useState<string[]>([]);
  const [createdHabit, setCreatedHabit] = useState('');
  const [createdOkr, setCreatedOkr] = useState('');

  const eligible =
    // L'espace entreprise a son propre accueil (`/entreprise/onboarding`) :
    // y superposer celui du compte perso, c'était enchaîner deux accueils à
    // la sortie du premier. La garde est relue à la navigation suivante.
    !pathname.startsWith('/entreprise') &&
    shouldOfferFirstRun({
      isDemo,
      isAuthenticated,
      tasksLoaded: isSuccess,
      taskCount: tasks?.length ?? 0,
      alreadyDone,
    });

  // 🔴 LA CONDITION D'OUVERTURE EST UN VERROU, PAS UNE CONDITION D'AFFICHAGE.
  //
  // `useCreateTask` écrit la tâche créée dans le cache (`setQueryData`) : dès
  // la PREMIÈRE réponse, `tasks.length` passe à 1 et la garde se referme. Sans
  // ce verrou, l'accueil DISPARAISSAIT entre la question des tâches et la
  // suivante (trouvé le 2026-09-08 par `e2e/stubbed/first-run.spec.ts`, et par
  // lui seul). **Une garde d'entrée se fige à l'entrée.**
  //
  // ❌ Ne jamais « optimiser » ce verrou en le remplaçant par la condition
  //    directe : la sortie est un geste de la personne (`close()`), jamais un
  //    effet de bord de ce qu'elle vient de saisir.
  const [latched, setLatched] = useState(false);
  if (eligible && !latched) setLatched(true);

  const open = !dismissed && (eligible || latched);

  const close = () => {
    markFirstRunDone();
    setDismissed(true);
  };

  // C-53 — appelé AVANT le return anticipé (ordre des hooks). Échap emprunte
  // le MÊME chemin que « Passer l'accueil » : c'est le seul geste de fermeture
  // de cet écran, qui n'a pas de voile à cliquer.
  const { ref: modalA11yRef, dialogProps: modalA11yProps } = useModalA11y<HTMLDivElement>({
    open,
    onClose: close,
    label: t('perso.dialogLabel'),
    initialFocusRef: primaryRef,
  });

  if (!open) return null;

  const addTask = (raw: string) => {
    const name = raw.trim();
    if (!name) return;
    setTaskNames((prev) => (prev.length >= MAX_FIRST_TASKS ? prev : [...prev, name]));
  };

  const addTaskDraft = () => {
    addTask(taskDraft);
    setTaskDraft('');
  };

  const advance = () => setStep((s) => Math.min(s + 1, STEP_DONE));

  // Passer : on avance exactement comme en validant, SANS rien créer, et on
  // oublie ce qui avait été tapé : une étape passée ne doit rien laisser
  // traîner que la suivante pourrait créer par erreur.
  const skip = () => {
    if (step === 1) {
      setTaskNames([]);
      setTaskDraft('');
    } else if (step === 3) {
      setHabitDraft('');
    } else if (step === 4) {
      setOkrDraft('');
      setKrDraft('');
    }
    advance();
  };

  // Chaque étape valide ce qu'elle a, crée, puis avance. Le champ en cours de
  // saisie compte : personne ne devrait avoir à cliquer « Ajouter » avant
  // « Continuer » pour que sa réponse existe.
  const submit = () => {
    if (step === 1) {
      const pending = taskDraft.trim();
      const all = pending && taskNames.length < MAX_FIRST_TASKS ? [...taskNames, pending] : taskNames;
      all.forEach((name) => createTask.mutate(buildTaskInput(name)));
      setCreatedTasks(all);
      setTaskNames([]);
      setTaskDraft('');
    } else if (step === 3) {
      const name = habitDraft.trim();
      if (name) {
        createHabit.mutate(buildHabitInput(name));
        setCreatedHabit(name);
      }
      setHabitDraft('');
    } else if (step === 4) {
      // Un résultat clé sans objectif n'a aucun sens : rien n'est créé.
      const objective = okrDraft.trim();
      if (objective) {
        createOkr.mutate(buildOkrInput(objective, krDraft));
        setCreatedOkr(objective);
      }
      setOkrDraft('');
      setKrDraft('');
    } else if (step === STEP_DONE) {
      close();
      return;
    }
    advance();
  };

  const planet = stepPlanet(step);
  // Le bouton prend la couleur de l'orbite en cours (chaque teinte tient
  // 4,5:1 sous du texte blanc) ; bleu des tâches hors étape.
  const accent = planet ? PLANET_COLOR[planet] : PLANET_COLOR.tasks;
  const name = firstName(user?.name);
  const previewTasks = step === 1 ? [...taskNames, ...(taskDraft.trim() ? [taskDraft.trim()] : [])] : createdTasks;
  const stageTaskCount = step === 1 ? previewTasks.length : createdTasks.length;
  const planetLabels = {
    you: t('perso.planets.you'),
    tasks: t('perso.planets.tasks'),
    agenda: t('perso.planets.agenda'),
    habits: t('perso.planets.habits'),
    okr: t('perso.planets.okr'),
  };
  const emClass = EMPHASIS_CLASS;
  const enter = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 } };

  const bigTitle = (text: string) => (
    <h2 className="mt-3 text-4xl font-semibold leading-[1.04] tracking-[-0.035em] text-[#0F172A] sm:text-5xl">
      {withEmphasis(text, emClass)}
    </h2>
  );
  const body = (text: string) => <p className="mt-4 text-base leading-[1.6] text-[#475569]">{text}</p>;
  const kicker = (p: Planet) => (
    <p className="font-data text-caption uppercase tracking-[0.16em]" style={{ color: PLANET_COLOR[p] }}>
      {`0${PLANETS.indexOf(p) + 1} · ${planetLabels[p]}`}
    </p>
  );
  const ideas = (list: string[], onPick: (value: string) => void) => (
    <div className="mt-4">
      <p className="font-data text-caption uppercase tracking-[0.14em] text-[#64748B]">{t('common.ideas')}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {list.map((idea) => (
          <button key={idea} type="button" onClick={() => onPick(idea)} className={CHIP}>
            <Plus size={13} aria-hidden="true" />
            {idea}
          </button>
        ))}
      </div>
    </div>
  );
  const onEnterSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };

  let content: React.ReactNode;
  if (step === 0) {
    content = (
      <>
        <p className="text-base text-[#475569]">{name ? t('perso.intro.hello', { name }) : t('perso.intro.helloAnon')}</p>
        {bigTitle(t('perso.intro.title'))}
        {body(t('perso.intro.body'))}
        <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#F1F5F9] px-3 py-1.5 font-data text-caption text-[#475569]">
          <Sparkles size={13} aria-hidden="true" className="text-[#4F46E5]" />
          {t('perso.intro.duration')}
        </p>
      </>
    );
  } else if (step === 1) {
    const full = taskNames.length >= MAX_FIRST_TASKS;
    content = (
      <>
        {kicker('tasks')}
        <h2 className={QUESTION}>{t('perso.tasks.title')}</h2>
        {body(t('perso.tasks.body'))}
        <div className={`mt-6 ${FIELD}`}>
          <input
            autoFocus
            value={taskDraft}
            disabled={full}
            onChange={(e) => setTaskDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTaskDraft();
              }
            }}
            placeholder={t('perso.tasks.placeholder')}
            aria-label={t('perso.tasks.title')}
            maxLength={200}
            className={FIELD_INPUT}
          />
          <button
            type="button"
            onClick={addTaskDraft}
            disabled={full}
            className="h-11 shrink-0 rounded-xl bg-[#0F172A] px-4 text-sm font-medium text-white transition-colors hover:bg-[#1E293B] disabled:opacity-40"
          >
            {t('common.add')}
          </button>
        </div>
        {taskNames.length > 0 && (
          <ul aria-label={t('perso.tasks.listLabel')} className="mt-3 flex flex-wrap gap-2">
            {taskNames.map((task, i) => (
              <li key={`${task}-${i}`} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#EFF6FF] py-1 pl-3 pr-1 text-label text-[#1E3A8A]">
                <span className="truncate">{task}</span>
                <button
                  type="button"
                  aria-label={t('common.remove', { name: task })}
                  onClick={() => setTaskNames((prev) => prev.filter((_, j) => j !== i))}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#2563EB] hover:bg-[#DBEAFE]"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {full ? (
          <p className="mt-3 text-label text-[#64748B]">{t('perso.tasks.limit')}</p>
        ) : (
          ideas(
            [t('perso.tasks.idea1'), t('perso.tasks.idea2'), t('perso.tasks.idea3')].filter((idea) => !taskNames.includes(idea)),
            addTask,
          )
        )}
        <p className="mt-6 flex items-start gap-2 text-label leading-relaxed text-[#64748B]">
          <kbd className="mt-px rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-1.5 font-data text-caption text-[#334155]">N</kbd>
          {t('perso.tasks.tip')}
        </p>
      </>
    );
  } else if (step === 2) {
    content = (
      <>
        {kicker('agenda')}
        <h2 className={QUESTION}>{withEmphasis(t('perso.agenda.title'), emClass)}</h2>
        {body(t('perso.agenda.body'))}
        <ul className="mt-6 space-y-3">
          {[
            { Icon: MoveRight, text: t('perso.agenda.point1') },
            { Icon: CalendarClock, text: t('perso.agenda.point2') },
            { Icon: Check, text: t('perso.agenda.point3') },
          ].map(({ Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-body leading-snug text-[#334155]">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF] text-[#4F46E5]">
                <Icon size={14} aria-hidden="true" />
              </span>
              <span className="pt-1">{text}</span>
            </li>
          ))}
        </ul>
      </>
    );
  } else if (step === 3) {
    content = (
      <>
        {kicker('habits')}
        <h2 className={QUESTION}>{t('perso.habits.title')}</h2>
        {body(t('perso.habits.body'))}
        <div className={`mt-6 ${FIELD} pr-4`}>
          <input
            autoFocus
            value={habitDraft}
            onChange={(e) => setHabitDraft(e.target.value)}
            onKeyDown={onEnterSubmit}
            placeholder={t('perso.habits.placeholder')}
            aria-label={t('perso.habits.title')}
            maxLength={120}
            className={FIELD_INPUT}
          />
        </div>
        {ideas(
          [t('perso.habits.idea1'), t('perso.habits.idea2'), t('perso.habits.idea3'), t('perso.habits.idea4')],
          setHabitDraft,
        )}
      </>
    );
  } else if (step === 4) {
    content = (
      <>
        {kicker('okr')}
        <h2 className={QUESTION}>{t('perso.okr.title')}</h2>
        {body(t('perso.okr.body'))}
        <div className={`mt-6 ${FIELD} pr-4`}>
          <input
            autoFocus
            value={okrDraft}
            onChange={(e) => setOkrDraft(e.target.value)}
            placeholder={t('perso.okr.placeholder')}
            aria-label={t('perso.okr.title')}
            maxLength={200}
            className={FIELD_INPUT}
          />
        </div>
        <label className="mt-4 block">
          <span className="font-data text-caption uppercase tracking-[0.14em] text-[#64748B]">{t('perso.okr.krLabel')}</span>
          <span className={`mt-2 ${FIELD} pr-4`}>
            <input
              value={krDraft}
              onChange={(e) => setKrDraft(e.target.value)}
              onKeyDown={onEnterSubmit}
              placeholder={t('perso.okr.krPlaceholder')}
              maxLength={300}
              className={FIELD_INPUT}
            />
          </span>
        </label>
      </>
    );
  } else {
    const recap: { planet: Planet; text: string }[] = [];
    if (createdTasks.length > 0) recap.push({ planet: 'tasks', text: tp('perso.done.recapTasks', createdTasks.length) });
    if (createdHabit) recap.push({ planet: 'habits', text: t('perso.done.recapHabit', { name: createdHabit }) });
    if (createdOkr) recap.push({ planet: 'okr', text: t('perso.done.recapOkr', { name: createdOkr }) });
    content = (
      <>
        {bigTitle(t('perso.done.title'))}
        {body(t('perso.done.body'))}
        <div className="mt-6 rounded-[20px] border border-[#E2E8F0] p-4">
          <p className="font-data text-caption uppercase tracking-[0.14em] text-[#64748B]">{t('perso.done.recapTitle')}</p>
          {recap.length > 0 ? (
            <ul className="mt-3 space-y-2.5">
              {recap.map((item) => (
                <li key={item.planet} className="flex items-start gap-3 text-body leading-snug text-[#0F172A]">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ backgroundColor: PLANET_COLOR[item.planet] }}
                  >
                    <Check size={12} strokeWidth={3} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 break-words">{item.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-body leading-snug text-[#475569]">{t('perso.done.recapNothing')}</p>
          )}
        </div>
        <p className="mt-4 text-label leading-relaxed text-[#64748B]">{t('perso.done.next')}</p>
      </>
    );
  }

  const primaryLabel =
    step === 0 ? t('perso.intro.cta') : step === 2 ? t('perso.agenda.cta') : step === STEP_DONE ? t('perso.done.cta') : t('common.next');
  const canSkip = step === 1 || step === 3 || step === 4;

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto bg-white text-[#0F172A]"
      style={LIGHT_SCOPE}
      ref={modalA11yRef}
      {...modalA11yProps}
    >
      <div className="min-h-full lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
        <div className="flex min-h-[100dvh] flex-col">
          <header className="flex items-center justify-between gap-3 px-5 pt-4 sm:px-10 lg:px-14 lg:pt-8">
            <span className="flex items-center gap-2.5">
              <img src="/logo.svg" alt="" className="h-8 w-8" />
              <span className="text-body font-semibold tracking-[-0.01em]">COSMO</span>
            </span>
            <button
              type="button"
              onClick={close}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-label font-medium text-[#475569] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563EB]"
            >
              {t('common.skipAll')}
              <X size={15} aria-hidden="true" />
            </button>
          </header>

          {/* Planétaire réduit, au-dessus du formulaire : la signature reste
              visible sur téléphone, sans étiquettes (illisibles à cette taille). */}
          <div aria-hidden="true" className="mx-5 mt-3 h-[150px] rounded-[22px] bg-[#F6F7FB] px-3 py-3 sm:mx-10 sm:h-[200px] lg:hidden">
            <Orrery step={step} labels={planetLabels} taskCount={stageTaskCount} compact />
          </div>

          <div className="flex flex-1 flex-col px-5 pt-7 sm:justify-center sm:px-10 lg:px-14 lg:py-10">
            <div className="flex w-full max-w-[31rem] flex-1 flex-col sm:flex-none">
              {planet && (
                <div className="mb-7">
                  <ol className="flex gap-1.5" aria-hidden="true">
                    {PLANETS.map((p, i) => (
                      <li
                        key={p}
                        className="h-1 flex-1 rounded-full transition-colors duration-500"
                        style={{ backgroundColor: i + 1 <= step ? PLANET_COLOR[p] : '#E2E8F0' }}
                      />
                    ))}
                  </ol>
                  <p className="mt-2 font-data text-caption text-[#64748B]" aria-live="polite">
                    {t('common.progress', { current: String(step), total: String(TOTAL_STEPS) })}
                  </p>
                </div>
              )}

              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={step} {...enter} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
                  {content}
                </motion.div>
              </AnimatePresence>

              {/* Sur téléphone, `mt-auto` pousse les actions en bas de l'écran
                  quand le contenu est court, et `sticky` les y garde quand il
                  est long. L'espaceur garantit l'écart minimal. */}
              <div className="h-8 shrink-0" aria-hidden="true" />
              <div className="sticky bottom-0 -mx-5 mt-auto flex items-center justify-between gap-3 border-t border-[#EEF2F7] bg-white px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:static sm:mx-0 sm:mt-0 sm:border-0 sm:bg-transparent sm:p-0">
                {canSkip ? (
                  <button type="button" onClick={skip} className={SKIP}>
                    {t('common.skipStep')}
                  </button>
                ) : (
                  <span />
                )}
                <button
                  ref={primaryRef}
                  type="button"
                  onClick={submit}
                  className={PRIMARY}
                  style={{ '--cta': accent } as React.CSSProperties}
                >
                  {primaryLabel}
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
          <div className="hidden h-6 sm:block lg:h-0" />
        </div>

        {/* La scène : planétaire + aperçu de ce que l'étape va créer. */}
        <aside aria-hidden="true" className="relative hidden p-3 lg:block">
          <div className="sticky top-3 flex h-[calc(100dvh-1.5rem)] flex-col items-center justify-center overflow-hidden rounded-[28px] bg-[#F6F7FB] px-10 py-8">
            <div
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{
                backgroundImage: 'radial-gradient(rgba(15,23,42,0.07) 1px, transparent 1px)',
                backgroundSize: '22px 22px',
                maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, #000 20%, transparent 80%)',
                WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, #000 20%, transparent 80%)',
              }}
            />
            <div className={`relative w-full max-w-[620px] ${step === STEP_DONE ? '' : '-mb-6'}`}>
              <Orrery step={step} labels={planetLabels} taskCount={stageTaskCount} />
            </div>
            <div className="relative w-full max-w-[430px]">
              <PersoPreview
                step={step}
                tasks={previewTasks}
                habit={habitDraft.trim()}
                objective={okrDraft.trim()}
                keyResult={krDraft.trim()}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default FirstRunSetup;
