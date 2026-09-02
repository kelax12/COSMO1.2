import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useT } from '@/i18n/useT';
import { useSlideUpEntrance } from '@/lib/motion-safe';
import { useIsDemo } from '@/lib/app-mode.store';
import { useAuth } from '@/modules/auth/AuthContext';
import { useTasks, useCreateTask } from '@/modules/tasks';
import { useCreateHabit } from '@/modules/habits';
import { useCreateOkr } from '@/modules/okrs';
import {
  buildHabitInput,
  buildOkrInput,
  buildTaskInput,
  markFirstRunDone,
  readFirstRunDone,
  shouldOfferFirstRun,
} from './first-run';

/**
 * Premier écran d'un compte réel (T-23). Trois questions, chacune passable,
 * et ce que la personne écrit devient ses vraies données — cf. `first-run.ts`
 * pour la mesure qui a motivé cet écran.
 *
 * ⚠️ Monté dans `Layout`, PAS sur une route : une inscription par Google ne
 * repasse pas par `SignupPage`, et un écran d'accueil qui ne couvre qu'un des
 * deux chemins d'inscription n'accueille que la moitié des gens.
 *
 * ⚠️ Chaque étape crée AU MOMENT où elle est validée, jamais à la fin. Quelqu'un
 * qui répond à la première question puis ferme l'onglet garde sa tâche : c'est
 * précisément la population qu'on essaie de retenir.
 */
const TOTAL_STEPS = 3;

const FirstRunSetup: React.FC = () => {
  const { t } = useT('common');
  const isDemo = useIsDemo();
  const { isAuthenticated } = useAuth();
  const { data: tasks, isSuccess } = useTasks({ enabled: isAuthenticated && !isDemo });
  const createTask = useCreateTask();
  const createHabit = useCreateHabit();
  const createOkr = useCreateOkr();
  const entrance = useSlideUpEntrance(24);

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

  const open =
    !dismissed &&
    shouldOfferFirstRun({
      isDemo,
      isAuthenticated,
      tasksLoaded: isSuccess,
      taskCount: tasks?.length ?? 0,
      alreadyDone,
    });

  if (!open) return null;

  const close = () => {
    markFirstRunDone();
    setDismissed(true);
  };

  const addTaskDraft = () => {
    const name = taskDraft.trim();
    if (!name) return;
    setTaskNames((prev) => (prev.length >= 5 ? prev : [...prev, name]));
    setTaskDraft('');
  };

  const advance = () => {
    if (step + 1 >= TOTAL_STEPS) close();
    else setStep(step + 1);
  };

  // Chaque étape valide ce qu'elle a, crée, puis avance. Le champ en cours de
  // saisie compte : personne ne devrait avoir à cliquer « Ajouter » avant
  // « Continuer » pour que sa réponse existe.
  const submitStep = () => {
    if (step === 0) {
      const pending = taskDraft.trim();
      const all = pending && taskNames.length < 5 ? [...taskNames, pending] : taskNames;
      all.forEach((name) => createTask.mutate(buildTaskInput(name)));
      setTaskNames([]);
      setTaskDraft('');
    } else if (step === 1) {
      const name = habitDraft.trim();
      if (name) createHabit.mutate(buildHabitInput(name));
      setHabitDraft('');
    } else {
      const objective = okrDraft.trim();
      if (objective) createOkr.mutate(buildOkrInput(objective, krDraft));
      setOkrDraft('');
      setKrDraft('');
    }
    advance();
  };

  const questions = [
    { q: t('firstRun.taskQuestion'), hint: t('firstRun.taskHint') },
    { q: t('firstRun.habitQuestion'), hint: t('firstRun.habitHint') },
    { q: t('firstRun.okrQuestion'), hint: t('firstRun.okrHint') },
  ];
  const isLast = step === TOTAL_STEPS - 1;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto p-4"
      style={{ backgroundColor: 'rgb(var(--color-background))' }}
      role="dialog"
      aria-modal="true"
      aria-label={t('firstRun.title')}
    >
      {/* Position en CSS, l'animation ne porte que le décoratif : sous
          `prefers-reduced-motion` ce helper ne produit AUCUN transform. */}
      <motion.div
        {...entrance}
        transition={{ duration: 0.25 }}
        className="w-full max-w-lg rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-6 shadow-2xl sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-title font-semibold text-[rgb(var(--color-text-primary))]">
              {t('firstRun.title')}
            </h1>
            <p className="mt-1 text-body text-[rgb(var(--color-text-secondary))]">
              {t('firstRun.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t('firstRun.skipAll')}
            className="shrink-0 rounded-full p-2 text-[rgb(var(--color-text-muted))] hover:bg-[rgb(var(--color-hover))]"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <p className="mt-6 text-caption uppercase tracking-wider text-[rgb(var(--color-text-muted))]">
          {t('firstRun.step', { current: String(step + 1), total: String(TOTAL_STEPS) })}
        </p>
        <h2 className="mt-1 text-headline font-semibold text-[rgb(var(--color-text-primary))]">
          {questions[step].q}
        </h2>
        <p className="mt-1 text-label text-[rgb(var(--color-text-secondary))]">
          {questions[step].hint}
        </p>

        <div className="mt-4 space-y-3">
          {step === 0 && (
            <>
              <div className="flex gap-2">
                <Input
                  autoFocus
                  value={taskDraft}
                  onChange={(e) => setTaskDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTaskDraft();
                    }
                  }}
                  placeholder={t('firstRun.taskPlaceholder')}
                  aria-label={questions[0].q}
                />
                <Button type="button" variant="secondary" onClick={addTaskDraft}>
                  {t('firstRun.add')}
                </Button>
              </div>
              {taskNames.length > 0 && (
                <ul aria-label={t('firstRun.taskListLabel')} className="space-y-1">
                  {taskNames.map((name, i) => (
                    <li
                      key={`${name}-${i}`}
                      className="flex items-center justify-between gap-2 rounded-lg bg-[rgb(var(--color-hover))] px-3 py-2"
                    >
                      <span className="text-label text-[rgb(var(--color-text-primary))]">{name}</span>
                      <button
                        type="button"
                        aria-label={`${t('firstRun.remove')} : ${name}`}
                        onClick={() => setTaskNames((prev) => prev.filter((_, j) => j !== i))}
                        className="text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text-primary))]"
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {step === 1 && (
            <Input
              autoFocus
              value={habitDraft}
              onChange={(e) => setHabitDraft(e.target.value)}
              placeholder={t('firstRun.habitPlaceholder')}
              aria-label={questions[1].q}
            />
          )}

          {step === 2 && (
            <>
              <Input
                autoFocus
                value={okrDraft}
                onChange={(e) => setOkrDraft(e.target.value)}
                placeholder={t('firstRun.okrPlaceholder')}
                aria-label={questions[2].q}
              />
              <label className="block">
                <span className="text-caption text-[rgb(var(--color-text-muted))]">
                  {t('firstRun.okrKeyResultLabel')}
                </span>
                <Input
                  value={krDraft}
                  onChange={(e) => setKrDraft(e.target.value)}
                  placeholder={t('firstRun.okrKeyResultPlaceholder')}
                  className="mt-1"
                />
              </label>
            </>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={advance}
            className="text-label text-[rgb(var(--color-text-muted))] underline underline-offset-2 hover:text-[rgb(var(--color-text-primary))]"
          >
            {t('firstRun.skip')}
          </button>
          <Button type="button" onClick={submitStep}>
            {isLast ? t('firstRun.finish') : t('firstRun.next')}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default FirstRunSetup;
