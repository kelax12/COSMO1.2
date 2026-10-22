import type React from 'react';
import { ArrowRight, Briefcase, CalendarClock, Check, MoveRight, Plus, Sparkles, X } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { EMPHASIS_CLASS, withEmphasis } from '../onboarding-text';
import { HABIT_MINUTES, MAX_FIRST_TASKS, SLOT_HOURS, type SlotDay } from '../first-run';
import { PLANETS, PLANET_COLOR, type Planet } from './orrery-geometry';
import { PLANET_TEXT, type PersoTheme } from './perso-theme';

// ═══════════════════════════════════════════════════════════════════
// Le contenu des six écrans de l'accueil perso. Aucun état ici : tout vit
// dans `FirstRunSetup`, qui crée, avance et revient en arrière.
// ═══════════════════════════════════════════════════════════════════

const FIELD =
  'flex items-center gap-2 rounded-2xl border border-[var(--onb-line)] bg-[var(--onb-card)] p-1.5 pl-4 transition-shadow focus-within:border-[#2563EB] focus-within:shadow-[0_0_0_4px_rgba(37,99,235,0.18)]';
const FIELD_INPUT =
  'no-input-chrome h-11 min-w-0 flex-1 bg-transparent text-base text-[var(--onb-ink)] placeholder:text-[var(--onb-faint)] focus:outline-none';
const CHIP =
  'inline-flex items-center gap-1.5 rounded-full border border-[var(--onb-line)] bg-[var(--onb-card)] px-3 py-1.5 text-label text-[var(--onb-strong)] transition-colors hover:border-[#2563EB] hover:text-[var(--onb-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563EB]';
const CHIP_ON = 'border-transparent text-white';
const QUESTION = 'mt-3 text-3xl font-semibold leading-[1.06] tracking-[-0.035em] text-[var(--onb-ink)] sm:text-4xl';
const LABEL = 'font-data text-caption uppercase tracking-[0.14em] text-[var(--onb-muted)]';

export interface PersoStepsState {
  step: number;
  theme: PersoTheme;
  name: string;
  businessPending: boolean;
  taskDraft: string;
  taskNames: string[];
  createdTasks: string[];
  slotDay: SlotDay;
  slotHour: number | null;
  createdSlot: string;
  habitDraft: string;
  habitMinutes: number;
  createdHabit: string;
  okrDraft: string;
  krDraft: string;
  targetDraft: string;
  createdOkr: string;
}

export interface PersoStepsActions {
  setTaskDraft: (v: string) => void;
  addTask: (v: string) => void;
  addTaskDraft: () => void;
  removeTask: (i: number) => void;
  setSlotDay: (d: SlotDay) => void;
  setSlotHour: (h: number | null) => void;
  setHabitDraft: (v: string) => void;
  setHabitMinutes: (m: number) => void;
  setOkrDraft: (v: string) => void;
  setKrDraft: (v: string) => void;
  setTargetDraft: (v: string) => void;
  submit: () => void;
  openBusiness: () => void;
  goTo: (path: string) => void;
}

/** Une ligne « déjà enregistré », montrée quand on revient sur une étape faite. */
const Saved = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-6 flex items-start gap-3 rounded-2xl border border-[var(--onb-line)] bg-[var(--onb-row)] px-4 py-3 text-body text-[var(--onb-ink)]">
    <Check size={18} className="mt-0.5 shrink-0 text-[#16A34A]" aria-hidden="true" />
    <span className="min-w-0 break-words">{children}</span>
  </p>
);

export const PersoStepContent = ({ s, a, recap }: { s: PersoStepsState; a: PersoStepsActions; recap: { planet: Planet; text: string }[] }) => {
  const { t } = useT('onboarding');
  const text = PLANET_TEXT[s.theme];
  const body = (value: string) => <p className="mt-4 text-base leading-[1.6] text-[var(--onb-body)]">{value}</p>;
  const big = (value: string) => (
    <h2 className="mt-3 text-4xl font-semibold leading-[1.04] tracking-[-0.035em] text-[var(--onb-ink)] sm:text-5xl">
      {withEmphasis(value, EMPHASIS_CLASS)}
    </h2>
  );
  const kicker = (p: Planet) => (
    <p className="font-data text-caption uppercase tracking-[0.16em]" style={{ color: text[p] }}>
      {`0${PLANETS.indexOf(p) + 1} · ${t(`perso.planets.${p}`)}`}
    </p>
  );
  const ideas = (list: string[], onPick: (value: string) => void) => (
    <div className="mt-4">
      <p className={LABEL}>{t('common.ideas')}</p>
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
  const onEnter = (fn: () => void) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fn();
    }
  };

  if (s.step === 0) {
    return (
      <>
        {s.businessPending && (
          <div className="mb-8 rounded-2xl border border-[var(--onb-line)] bg-[var(--onb-row)] p-4">
            <p className="flex items-center gap-2 text-body font-semibold text-[var(--onb-ink)]">
              <Briefcase size={16} aria-hidden="true" />
              {t('perso.intro.businessTitle')}
            </p>
            <p className="mt-1 text-label leading-snug text-[var(--onb-body)]">{t('perso.intro.businessBody')}</p>
            <button
              type="button"
              onClick={a.openBusiness}
              className="mt-3 inline-flex items-center gap-1.5 text-label font-semibold text-[#2563EB] underline-offset-4 hover:underline"
            >
              {t('perso.intro.businessCta')}
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </div>
        )}
        <p className="text-base text-[var(--onb-body)]">{s.name ? t('perso.intro.hello', { name: s.name }) : t('perso.intro.helloAnon')}</p>
        {big(t('perso.intro.title'))}
        {body(t('perso.intro.body'))}
        <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--onb-chip)] px-3 py-1.5 font-data text-caption text-[var(--onb-body)]">
          <Sparkles size={13} aria-hidden="true" style={{ color: text.agenda }} />
          {t('perso.intro.duration')}
        </p>
      </>
    );
  }

  if (s.step === 1) {
    const room = MAX_FIRST_TASKS - s.createdTasks.length - s.taskNames.length;
    const full = room <= 0;
    return (
      <>
        {kicker('tasks')}
        <h2 className={QUESTION}>{t('perso.tasks.title')}</h2>
        {body(t('perso.tasks.body'))}
        {s.createdTasks.length > 0 && (
          <div className="mt-6">
            <p className={LABEL}>{t('perso.tasks.alreadyCreated')}</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {s.createdTasks.map((task, i) => (
                <li key={`${task}-${i}`} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--onb-line)] px-3 py-1 text-label text-[var(--onb-strong)]">
                  <Check size={13} aria-hidden="true" className="text-[#16A34A]" />
                  <span className="truncate">{task}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-label text-[var(--onb-muted)]">{t('perso.tasks.alreadyHint')}</p>
          </div>
        )}
        <div className={`mt-6 ${FIELD}`}>
          <input
            autoFocus
            value={s.taskDraft}
            disabled={full}
            onChange={(e) => a.setTaskDraft(e.target.value)}
            onKeyDown={onEnter(a.addTaskDraft)}
            placeholder={t('perso.tasks.placeholder')}
            aria-label={t('perso.tasks.title')}
            maxLength={200}
            className={FIELD_INPUT}
          />
          <button
            type="button"
            onClick={a.addTaskDraft}
            disabled={full}
            className="h-11 shrink-0 rounded-xl bg-[var(--onb-solid)] px-4 text-sm font-medium text-[var(--onb-solid-text)] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {t('common.add')}
          </button>
        </div>
        {s.taskNames.length > 0 && (
          <ul aria-label={t('perso.tasks.listLabel')} className="mt-3 flex flex-wrap gap-2">
            {s.taskNames.map((task, i) => (
              <li
                key={`${task}-${i}`}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[var(--onb-tint-tasks)] py-1 pl-3 pr-1 text-label text-[var(--onb-tint-tasks-ink)]"
              >
                <span className="truncate">{task}</span>
                <button
                  type="button"
                  aria-label={t('common.remove', { name: task })}
                  onClick={() => a.removeTask(i)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-black/10"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {full ? (
          <p className="mt-3 text-label text-[var(--onb-muted)]">{t('perso.tasks.limit')}</p>
        ) : (
          ideas(
            [t('perso.tasks.idea1'), t('perso.tasks.idea2'), t('perso.tasks.idea3')].filter(
              (idea) => !s.taskNames.includes(idea) && !s.createdTasks.includes(idea),
            ),
            a.addTask,
          )
        )}
        <p className="mt-6 flex items-start gap-2 text-label leading-relaxed text-[var(--onb-muted)]">
          <kbd className="mt-px rounded-md border border-[var(--onb-line)] bg-[var(--onb-row)] px-1.5 font-data text-caption text-[var(--onb-strong)]">N</kbd>
          {t('perso.tasks.tip')}
        </p>
      </>
    );
  }

  if (s.step === 2) {
    const first = s.createdTasks[0];
    return (
      <>
        {kicker('agenda')}
        <h2 className={QUESTION}>{withEmphasis(t('perso.agenda.title'), EMPHASIS_CLASS)}</h2>
        {body(t('perso.agenda.body'))}
        {s.createdSlot ? (
          <Saved>{t('perso.agenda.slotCreated', { when: s.createdSlot })}</Saved>
        ) : first ? (
          <fieldset className="mt-6 rounded-2xl border border-[var(--onb-line)] p-4">
            <legend className="px-1 text-body font-semibold text-[var(--onb-ink)]">{t('perso.agenda.slotTitle', { name: first })}</legend>
            <p className="text-label text-[var(--onb-muted)]">{t('perso.agenda.slotHint')}</p>
            <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={t('perso.agenda.slotDay')}>
              {(['today', 'tomorrow'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={s.slotDay === d}
                  onClick={() => a.setSlotDay(d)}
                  className={`${CHIP} ${s.slotDay === d ? CHIP_ON : ''}`}
                  style={s.slotDay === d ? { backgroundColor: PLANET_COLOR.agenda } : undefined}
                >
                  {t(`perso.agenda.${d}`)}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={t('perso.agenda.slotHour')}>
              {SLOT_HOURS.map((h) => (
                <button
                  key={h}
                  type="button"
                  role="radio"
                  aria-checked={s.slotHour === h}
                  onClick={() => a.setSlotHour(s.slotHour === h ? null : h)}
                  className={`${CHIP} font-data ${s.slotHour === h ? CHIP_ON : ''}`}
                  style={s.slotHour === h ? { backgroundColor: PLANET_COLOR.agenda } : undefined}
                >
                  <CalendarClock size={13} aria-hidden="true" />
                  {`${String(h).padStart(2, '0')}:00`}
                </button>
              ))}
            </div>
          </fieldset>
        ) : (
          <p className="mt-6 text-label text-[var(--onb-muted)]">{t('perso.agenda.noTask')}</p>
        )}
        <ul className="mt-6 space-y-3">
          {[
            { Icon: MoveRight, value: t('perso.agenda.point1') },
            { Icon: CalendarClock, value: t('perso.agenda.point2') },
            { Icon: Check, value: t('perso.agenda.point3') },
          ].map(({ Icon, value }) => (
            <li key={value} className="flex items-start gap-3 text-sm leading-snug text-[var(--onb-strong)]">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--onb-tint-agenda)]" style={{ color: text.agenda }}>
                <Icon size={14} aria-hidden="true" />
              </span>
              <span className="pt-1">{value}</span>
            </li>
          ))}
        </ul>
      </>
    );
  }

  if (s.step === 3) {
    return (
      <>
        {kicker('habits')}
        <h2 className={QUESTION}>{t('perso.habits.title')}</h2>
        {body(t('perso.habits.body'))}
        {s.createdHabit ? (
          <Saved>{t('perso.habits.alreadyCreated', { name: s.createdHabit })}</Saved>
        ) : (
          <>
            <div className={`mt-6 ${FIELD} pr-4`}>
              <input
                autoFocus
                value={s.habitDraft}
                onChange={(e) => a.setHabitDraft(e.target.value)}
                onKeyDown={onEnter(a.submit)}
                placeholder={t('perso.habits.placeholder')}
                aria-label={t('perso.habits.title')}
                maxLength={120}
                className={FIELD_INPUT}
              />
            </div>
            <div className="mt-4">
              <p className={LABEL} id="habit-minutes-label">{t('perso.habits.durationLabel')}</p>
              <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-labelledby="habit-minutes-label">
                {HABIT_MINUTES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={s.habitMinutes === m}
                    onClick={() => a.setHabitMinutes(m)}
                    className={`${CHIP} font-data ${s.habitMinutes === m ? CHIP_ON : ''}`}
                    style={s.habitMinutes === m ? { backgroundColor: PLANET_COLOR.habits } : undefined}
                  >
                    {t('perso.habits.minutes', { minutes: m })}
                  </button>
                ))}
              </div>
            </div>
            {ideas(
              [t('perso.habits.idea1'), t('perso.habits.idea2'), t('perso.habits.idea3'), t('perso.habits.idea4')],
              (idea) => {
                a.setHabitDraft(idea);
                // Les idées portent leur durée (« Lire 20 minutes ») : la
                // reprendre évite une incohérence visible dès l'aperçu.
                const m = Number(idea.match(/(\d+)\s*min/i)?.[1]);
                if (HABIT_MINUTES.includes(m as (typeof HABIT_MINUTES)[number])) a.setHabitMinutes(m);
              },
            )}
          </>
        )}
      </>
    );
  }

  if (s.step === 4) {
    return (
      <>
        {kicker('okr')}
        <h2 className={QUESTION}>{t('perso.okr.title')}</h2>
        {body(t('perso.okr.body'))}
        {s.createdOkr ? (
          <Saved>{t('perso.okr.alreadyCreated', { name: s.createdOkr })}</Saved>
        ) : (
          <>
            <div className={`mt-6 ${FIELD} pr-4`}>
              <input
                autoFocus
                value={s.okrDraft}
                onChange={(e) => a.setOkrDraft(e.target.value)}
                placeholder={t('perso.okr.placeholder')}
                aria-label={t('perso.okr.title')}
                maxLength={200}
                className={FIELD_INPUT}
              />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_8.5rem]">
              <label className="block">
                <span className={LABEL}>{t('perso.okr.krLabel')}</span>
                <span className={`mt-2 ${FIELD} pr-4`}>
                  <input
                    value={s.krDraft}
                    onChange={(e) => a.setKrDraft(e.target.value)}
                    onKeyDown={onEnter(a.submit)}
                    placeholder={t('perso.okr.krPlaceholder')}
                    maxLength={300}
                    className={FIELD_INPUT}
                  />
                </span>
              </label>
              <label className="block">
                <span className={LABEL}>{t('perso.okr.targetLabel')}</span>
                <span className={`mt-2 ${FIELD} pr-4`}>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={s.targetDraft}
                    onChange={(e) => a.setTargetDraft(e.target.value)}
                    onKeyDown={onEnter(a.submit)}
                    placeholder={t('perso.okr.targetPlaceholder')}
                    className={FIELD_INPUT}
                  />
                </span>
              </label>
            </div>
            <p className="mt-3 text-label text-[var(--onb-muted)]">{t('perso.okr.targetHint')}</p>
          </>
        )}
      </>
    );
  }

  return (
    <>
      {big(t('perso.done.title'))}
      {body(t('perso.done.body'))}
      <div className="mt-6 rounded-[20px] border border-[var(--onb-line)] p-4">
        <p className={LABEL}>{t('perso.done.recapTitle')}</p>
        {recap.length > 0 ? (
          <ul className="mt-3 space-y-2.5">
            {recap.map((item) => (
              <li key={item.text} className="flex items-start gap-3 text-body leading-snug text-[var(--onb-ink)]">
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
          <p className="mt-2 text-body leading-snug text-[var(--onb-body)]">{t('perso.done.recapNothing')}</p>
        )}
      </div>
      <p className={`mt-6 ${LABEL}`}>{t('perso.done.nextTitle')}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => a.goTo('/tasks')} className={CHIP}>
          {t('perso.done.goTasks')}
          <ArrowRight size={13} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => a.goTo('/agenda')} className={CHIP}>
          {t('perso.done.goAgenda')}
          <ArrowRight size={13} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => a.goTo('/habits')} className={CHIP}>
          {t('perso.done.goHabits')}
          <ArrowRight size={13} aria-hidden="true" />
        </button>
      </div>
      <p className="mt-4 text-label leading-relaxed text-[var(--onb-muted)]">{t('perso.done.next')}</p>
    </>
  );
};
