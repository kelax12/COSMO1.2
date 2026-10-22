import { useMemo, useRef, useState } from 'react';
import type React from 'react';
import { useLocation, useNavigate } from 'react-router';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Pause, Play, X } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { formatDate, formatTime } from '@/i18n/format';
import { useModalA11y } from '@/hooks/use-modal-a11y';
import { useIsDemo } from '@/lib/app-mode.store';
import { useAuth } from '@/modules/auth/AuthContext';
import { useTasks, useCreateTask } from '@/modules/tasks';
import { useCreateHabit } from '@/modules/habits';
import { useCreateOkr } from '@/modules/okrs';
import { useCreateEvent } from '@/modules/events';
import {
  MAX_FIRST_TASKS,
  buildHabitInput,
  buildOkrInput,
  buildSlotEvent,
  buildTaskInput,
  firstName,
  markFirstRunDone,
  readBusinessPending,
  readFirstRunDone,
  shouldOfferFirstRun,
  type SlotDay,
} from './first-run';
import Orrery from './perso/Orrery';
import PersoPreview from './perso/PersoPreview';
import { PersoStepContent } from './perso/PersoSteps';
import { PLANETS, PLANET_COLOR, type Planet } from './perso/orrery-geometry';
import { persoScope, readAppTheme } from './perso/perso-theme';

/**
 * Premier écran d'un compte réel (T-23), refait le 2026-10-03 en planétaire,
 * corrigé le 2026-10-05 après une revue de ses points faibles : retour
 * arrière, vrai créneau d'agenda, aperçu sur téléphone, durée d'habitude,
 * cible chiffrée, sorties concrètes, thème de l'app suivi, mouvement à la
 * demande.
 *
 * Les règles d'origine tiennent toutes (cf. `src/components/CLAUDE.md`) :
 *
 * ⚠️ Monté dans `Layout`, PAS sur une route : une inscription par Google ne
 * repasse pas par `SignupPage`.
 *
 * ⚠️ Chaque étape crée AU MOMENT où elle est validée, jamais à la fin.
 *
 * ⚠️ Revenir en arrière ne recrée JAMAIS : une étape déjà faite s'affiche
 * comme enregistrée, et « Continuer » n'y crée que ce qui est nouveau (des
 * tâches en plus, dans la limite de cinq).
 */
const TOTAL_STEPS = PLANETS.length;
const STEP_DONE = TOTAL_STEPS + 1;

const PRIMARY =
  'inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--cta)] px-6 text-body font-semibold text-white shadow-[0_12px_28px_-14px_var(--cta)] transition-[filter] hover:brightness-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cta)]';
const QUIET =
  'inline-flex items-center gap-1.5 rounded-full px-2 py-2 text-sm font-medium text-[var(--onb-muted)] underline-offset-4 transition-colors hover:text-[var(--onb-ink)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563EB]';

/** Planète de chaque étape (1 à 4). */
const stepPlanet = (step: number): Planet | null => PLANETS[step - 1] ?? null;

const FirstRunSetup: React.FC = () => {
  const { t, tp } = useT('onboarding');
  const isDemo = useIsDemo();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isAuthenticated, user } = useAuth();
  const { data: tasks, isSuccess } = useTasks({ enabled: isAuthenticated && !isDemo });
  const createTask = useCreateTask();
  const createHabit = useCreateHabit();
  const createOkr = useCreateOkr();
  const createEvent = useCreateEvent();
  const prefersReduced = useReducedMotion() ?? false;
  // Le focus d'entrée va au bouton principal, pas au premier focalisable
  // (« Passer l'accueil ») : la touche Entrée doit faire avancer, pas fermer.
  const primaryRef = useRef<HTMLButtonElement>(null);

  // Lus une seule fois : le marquage se fait à la sortie, et relire à chaque
  // rendu ferait disparaître l'écran sous les doigts de la personne.
  const alreadyDone = useMemo(() => readFirstRunDone(), []);
  const [theme] = useState(readAppTheme);
  const [businessPending] = useState(readBusinessPending);
  const [dismissed, setDismissed] = useState(false);
  const [forceMotion, setForceMotion] = useState(false);
  const [step, setStep] = useState(0);
  const [taskDraft, setTaskDraft] = useState('');
  const [taskNames, setTaskNames] = useState<string[]>([]);
  const [habitDraft, setHabitDraft] = useState('');
  const [habitMinutes, setHabitMinutes] = useState(30);
  const [okrDraft, setOkrDraft] = useState('');
  const [krDraft, setKrDraft] = useState('');
  const [targetDraft, setTargetDraft] = useState('');
  const [slotDay, setSlotDay] = useState<SlotDay>('today');
  const [slotHour, setSlotHour] = useState<number | null>(null);
  // Ce qui a été créé : relu par le retour arrière (rien n'est recréé), par
  // l'étape Agenda (la première tâche et son id) et par le bilan.
  const [createdTasks, setCreatedTasks] = useState<string[]>([]);
  const firstTaskId = useRef<string | undefined>(undefined);
  const [createdSlot, setCreatedSlot] = useState('');
  const [createdHabit, setCreatedHabit] = useState('');
  const [createdOkr, setCreatedOkr] = useState('');

  const eligible =
    // L'espace entreprise a son propre accueil (`/entreprise/onboarding`) :
    // y superposer celui du compte perso, c'était enchaîner deux accueils.
    !pathname.startsWith('/entreprise') &&
    shouldOfferFirstRun({
      isDemo,
      isAuthenticated,
      tasksLoaded: isSuccess,
      taskCount: tasks?.length ?? 0,
      alreadyDone,
    });

  // 🔴 LA CONDITION D'OUVERTURE EST UN VERROU, PAS UNE CONDITION D'AFFICHAGE.
  // `useCreateTask` écrit la tâche créée dans le cache : dès la PREMIÈRE
  // réponse, `tasks.length` passe à 1 et la garde se referme (2026-09-08).
  // **Une garde d'entrée se fige à l'entrée.**
  const [latched, setLatched] = useState(false);
  if (eligible && !latched) setLatched(true);

  const open = !dismissed && (eligible || latched);

  const close = () => {
    markFirstRunDone();
    setDismissed(true);
  };

  // C-53 — appelé AVANT le return anticipé (ordre des hooks). Échap emprunte
  // le MÊME chemin que « Passer l'accueil ».
  const { ref: modalA11yRef, dialogProps: modalA11yProps } = useModalA11y<HTMLDivElement>({
    open,
    onClose: close,
    label: t('perso.dialogLabel'),
    initialFocusRef: primaryRef,
  });

  if (!open) return null;

  const room = MAX_FIRST_TASKS - createdTasks.length;
  const addTask = (raw: string) => {
    const name = raw.trim();
    if (!name) return;
    setTaskNames((prev) => (prev.length >= room ? prev : [...prev, name]));
  };
  const addTaskDraft = () => {
    addTask(taskDraft);
    setTaskDraft('');
  };

  const advance = () => setStep((s) => Math.min(s + 1, STEP_DONE));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  /** Jour et heure du créneau, en toutes lettres, dans la langue de la personne. */
  const slotWhen = (day: SlotDay, hour: number) => {
    const d = new Date();
    if (day === 'tomorrow') d.setDate(d.getDate() + 1);
    d.setHours(hour, 0, 0, 0);
    return `${formatDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}, ${formatTime(d, { hour: '2-digit', minute: '2-digit' })}`;
  };

  // Passer : on avance exactement comme en validant, SANS rien créer, et on
  // oublie ce qui avait été tapé.
  const skip = () => {
    if (step === 1) {
      setTaskNames([]);
      setTaskDraft('');
    } else if (step === 2) {
      setSlotHour(null);
    } else if (step === 3) {
      setHabitDraft('');
    } else if (step === 4) {
      setOkrDraft('');
      setKrDraft('');
      setTargetDraft('');
    }
    advance();
  };

  // Chaque étape valide ce qu'elle a, crée ce qui est NOUVEAU, puis avance.
  const submit = () => {
    if (step === 1) {
      const pending = taskDraft.trim();
      const fresh = pending && taskNames.length < room ? [...taskNames, pending] : taskNames;
      fresh.forEach((name, i) =>
        createTask.mutate(buildTaskInput(name), {
          onSuccess: (task) => {
            // L'id de la première tâche relie le créneau de l'étape Agenda.
            if (i === 0 && createdTasks.length === 0 && task?.id) firstTaskId.current = task.id;
          },
        }),
      );
      setCreatedTasks((prev) => [...prev, ...fresh]);
      setTaskNames([]);
      setTaskDraft('');
    } else if (step === 2) {
      const first = createdTasks[0];
      if (first && slotHour !== null && !createdSlot) {
        createEvent.mutate(buildSlotEvent(first, firstTaskId.current, slotDay, slotHour));
        setCreatedSlot(slotWhen(slotDay, slotHour));
      }
    } else if (step === 3) {
      const name = habitDraft.trim();
      if (name && !createdHabit) {
        createHabit.mutate(buildHabitInput(name, habitMinutes));
        setCreatedHabit(name);
      }
      setHabitDraft('');
    } else if (step === 4) {
      // Un résultat clé sans objectif n'a aucun sens : rien n'est créé.
      const objective = okrDraft.trim();
      if (objective && !createdOkr) {
        createOkr.mutate(buildOkrInput(objective, krDraft, new Date(), targetDraft));
        setCreatedOkr(objective);
      }
      setOkrDraft('');
      setKrDraft('');
      setTargetDraft('');
    } else if (step === STEP_DONE) {
      close();
      return;
    }
    advance();
  };

  const goTo = (path: string) => {
    close();
    navigate(path);
  };
  const openBusiness = () => goTo('/entreprise/onboarding');

  const planet = stepPlanet(step);
  // Le bouton prend la couleur de l'orbite en cours (chaque teinte tient
  // 4,5:1 sous du texte blanc) ; bleu des tâches hors étape.
  const accent = planet ? PLANET_COLOR[planet] : PLANET_COLOR.tasks;
  const previewTasks =
    step === 1 ? [...createdTasks, ...taskNames, ...(taskDraft.trim() ? [taskDraft.trim()] : [])] : createdTasks;
  const stageTaskCount = step === 1 ? previewTasks.length : createdTasks.length;
  const planetLabels = {
    you: t('perso.planets.you'),
    tasks: t('perso.planets.tasks'),
    agenda: t('perso.planets.agenda'),
    habits: t('perso.planets.habits'),
    okr: t('perso.planets.okr'),
  };
  const slotPreview =
    step === 2 && slotHour !== null && !createdSlot
      ? { hour: slotHour, dayLabel: slotWhen(slotDay, slotHour).split(',')[0] }
      : null;
  const recap: { planet: Planet; text: string }[] = [];
  if (createdTasks.length > 0) recap.push({ planet: 'tasks', text: tp('perso.done.recapTasks', createdTasks.length) });
  if (createdSlot) recap.push({ planet: 'agenda', text: t('perso.done.recapSlot', { when: createdSlot }) });
  if (createdHabit) recap.push({ planet: 'habits', text: t('perso.done.recapHabit', { name: createdHabit }) });
  if (createdOkr) recap.push({ planet: 'okr', text: t('perso.done.recapOkr', { name: createdOkr }) });

  const previewProps = {
    step,
    theme,
    tasks: previewTasks,
    habit: createdHabit || habitDraft.trim(),
    habitMinutes,
    objective: createdOkr || okrDraft.trim(),
    keyResult: krDraft.trim(),
    target: targetDraft,
    slot: slotPreview,
    created: { tasks: createdTasks.length, habit: Boolean(createdHabit), okr: Boolean(createdOkr), slot: Boolean(createdSlot) },
  };

  const primaryLabel =
    step === 0
      ? t('perso.intro.cta')
      : step === 2
        ? slotHour !== null && createdTasks.length > 0 && !createdSlot
          ? t('perso.agenda.ctaSlot')
          : t('perso.agenda.cta')
        : step === STEP_DONE
          ? t('perso.done.cta')
          : t('common.next');
  // « Passer » n'apparaît que s'il y a quelque chose à ne PAS créer.
  const pendingTasks = taskNames.length + (taskDraft.trim() ? 1 : 0);
  const canSkip =
    step === 1
      ? createdTasks.length === 0 || pendingTasks > 0
      : step === 2
        ? slotHour !== null && !createdSlot
        : step === 3
          ? !createdHabit
          : step === 4
            ? !createdOkr
            : false;
  const enter = prefersReduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -10 } };

  // Sous mouvement réduit, la personne peut DEMANDER l'animation (WCAG 2.3.3
  // interdit le mouvement non demandé, pas le mouvement).
  const motionToggle = prefersReduced && (
    <button
      type="button"
      onClick={() => setForceMotion((v) => !v)}
      aria-pressed={forceMotion}
      className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-[var(--onb-line)] bg-[var(--onb-card)] px-3 py-1.5 text-label text-[var(--onb-body)] hover:text-[var(--onb-ink)]"
    >
      {forceMotion ? <Pause size={13} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
      {forceMotion ? t('perso.motion.stop') : t('perso.motion.play')}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-[60] overflow-y-auto bg-[var(--onb-bg)] text-[var(--onb-ink)]"
      style={persoScope(theme)}
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
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-label font-medium text-[var(--onb-body)] transition-colors hover:bg-[var(--onb-chip)] hover:text-[var(--onb-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563EB]"
            >
              {t('common.skipAll')}
              <X size={15} aria-hidden="true" />
            </button>
          </header>

          {/* Planétaire réduit, au-dessus du formulaire sur téléphone. */}
          <div className="relative mx-5 mt-3 h-[150px] rounded-[22px] bg-[var(--onb-stage)] px-3 py-3 sm:mx-10 sm:h-[200px] lg:hidden">
            <div aria-hidden="true" className="h-full">
              <Orrery step={step} labels={planetLabels} taskCount={stageTaskCount} compact forceMotion={forceMotion} />
            </div>
            {motionToggle}
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
                        style={{ backgroundColor: i + 1 <= step ? PLANET_COLOR[p] : 'var(--onb-line)' }}
                      />
                    ))}
                  </ol>
                  <p className="mt-2 font-data text-caption text-[var(--onb-muted)]" aria-live="polite">
                    {t('common.progress', { current: String(step), total: String(TOTAL_STEPS) })}
                  </p>
                </div>
              )}

              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={step} {...enter} transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}>
                  <PersoStepContent
                    recap={recap}
                    s={{
                      step,
                      theme,
                      name: firstName(user?.name),
                      businessPending,
                      taskDraft,
                      taskNames,
                      createdTasks,
                      slotDay,
                      slotHour,
                      createdSlot,
                      habitDraft,
                      habitMinutes,
                      createdHabit,
                      okrDraft,
                      krDraft,
                      targetDraft,
                      createdOkr,
                    }}
                    a={{
                      setTaskDraft,
                      addTask,
                      addTaskDraft,
                      removeTask: (i) => setTaskNames((prev) => prev.filter((_, j) => j !== i)),
                      setSlotDay,
                      setSlotHour,
                      setHabitDraft,
                      setHabitMinutes,
                      setOkrDraft,
                      setKrDraft,
                      setTargetDraft,
                      submit,
                      openBusiness,
                      goTo,
                    }}
                  />
                </motion.div>
              </AnimatePresence>

              {/* Téléphone : l'aperçu passe SOUS le formulaire (illustratif). */}
              {(step >= 1 || step === STEP_DONE) && (
                <div aria-hidden="true" className="mt-6 lg:hidden">
                  <PersoPreview {...previewProps} compact />
                </div>
              )}

              {/* `mt-auto` pousse les actions en bas d'un contenu court, `sticky`
                  les y garde quand il est long. L'espaceur garantit l'écart. */}
              <div className="h-8 shrink-0" aria-hidden="true" />
              <div className="sticky bottom-0 -mx-5 mt-auto flex items-center justify-between gap-2 border-t border-[var(--onb-line-soft)] bg-[var(--onb-bg)] px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:static sm:mx-0 sm:mt-0 sm:border-0 sm:bg-transparent sm:p-0">
                <span className="flex items-center gap-1">
                  {step > 0 && (
                    <button type="button" onClick={back} className={QUIET} aria-label={t('common.back')}>
                      <ArrowLeft size={15} aria-hidden="true" />
                      <span className="hidden sm:inline">{t('common.back')}</span>
                    </button>
                  )}
                  {canSkip && step !== STEP_DONE && (
                    <button type="button" onClick={skip} className={QUIET}>
                      {t('common.skipStep')}
                    </button>
                  )}
                </span>
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
        <aside className="relative hidden p-3 lg:block">
          <div className="sticky top-3 flex h-[calc(100dvh-1.5rem)] flex-col items-center justify-center overflow-hidden rounded-[28px] bg-[var(--onb-stage)] px-10 py-8">
            {motionToggle}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{
                backgroundImage: 'radial-gradient(var(--onb-dot) 1px, transparent 1px)',
                backgroundSize: '22px 22px',
                maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, #000 20%, transparent 80%)',
                WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, #000 20%, transparent 80%)',
              }}
            />
            <div aria-hidden="true" className="relative w-full max-w-[620px] -mb-6">
              <Orrery step={step} labels={planetLabels} taskCount={stageTaskCount} forceMotion={forceMotion} />
            </div>
            <div aria-hidden="true" className="relative w-full max-w-[430px]">
              <PersoPreview {...previewProps} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default FirstRunSetup;
