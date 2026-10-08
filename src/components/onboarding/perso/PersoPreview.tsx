import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BarChart3, Check, Clock, Flame, Target } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { formatDate } from '@/i18n/format';
import { PLANET_COLOR, PLANETS, type Planet } from './orrery-geometry';
import { PLANET_TEXT, type PersoTheme } from './perso-theme';

interface PersoPreviewProps {
  step: number;
  theme: PersoTheme;
  /** Tâches prêtes à créer, brouillon en cours compris : l'aperçu suit la frappe. */
  tasks: string[];
  habit: string;
  habitMinutes: number;
  objective: string;
  keyResult: string;
  /** Cible chiffrée saisie (vide = résultat clé binaire). */
  target: string;
  /** Créneau choisi à l'étape Agenda : heure de début, et le jour en toutes lettres. */
  slot: { hour: number; dayLabel: string } | null;
  /** Ce qui a été créé, pour la carte de statistiques du bilan. */
  created: { tasks: number; habit: boolean; okr: boolean; slot: boolean };
  /** Sous le formulaire, sur téléphone : marges et ombre réduites. */
  compact?: boolean;
}

const pad = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** Lundi de la semaine courante, puis les six jours suivants. */
const currentWeek = (now = new Date()): Date[] => {
  const monday = new Date(now);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
};

/**
 * Ce que l'étape va créer, tel que COSMO l'affichera : la personne voit sa
 * propre saisie prendre la forme d'une vraie carte de l'application. C'est la
 * moitié « comprendre » de l'accueil.
 *
 * Illustratif (`aria-hidden` posé par le parent) : la liste accessible des
 * tâches à créer vit dans le formulaire, avec ses boutons « Retirer ».
 *
 * Rendu deux fois selon l'écran (scène à droite au-delà de `lg`, sous le
 * formulaire en dessous), jamais les deux à la fois : la version téléphone
 * existe depuis le 2026-10-05, l'écran principal de beaucoup de gens perdait
 * sinon toute la moitié « comprendre ».
 */
const PersoPreview = ({
  step,
  theme,
  tasks,
  habit,
  habitMinutes,
  objective,
  keyResult,
  target,
  slot,
  created,
  compact = false,
}: PersoPreviewProps) => {
  const { t, tp } = useT('onboarding');
  const reduce = useReducedMotion() ?? false;
  const text = PLANET_TEXT[theme];
  const fade = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 } };
  const CARD = `w-full rounded-[22px] border border-[var(--onb-line)] bg-[var(--onb-card)] ${
    compact ? 'p-4' : 'p-5 shadow-[0_28px_60px_-30px_var(--onb-shadow)]'
  }`;
  const CAPTION = 'mt-3 text-center font-data text-caption uppercase tracking-[0.14em] text-[var(--onb-muted)]';

  let body: React.ReactNode = null;

  if (step === 0) {
    const defs: Record<Planet, string> = {
      tasks: t('perso.intro.legendTasks'),
      agenda: t('perso.intro.legendAgenda'),
      habits: t('perso.intro.legendHabits'),
      okr: t('perso.intro.legendOkr'),
    };
    body = (
      <div className={CARD}>
        <p className="font-data text-caption uppercase tracking-[0.14em] text-[var(--onb-muted)]">{t('perso.intro.legendTitle')}</p>
        <ul className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3">
          {PLANETS.map((planet) => (
            <li key={planet} className="flex items-start gap-2.5">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: PLANET_COLOR[planet] }} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--onb-ink)]">{t(`perso.planets.${planet}`)}</span>
                <span className="block text-label leading-snug text-[var(--onb-body)]">{defs[planet]}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  } else if (step === 1) {
    body = (
      <div>
        <div className={CARD}>
          <p className="flex items-center justify-between text-label font-semibold text-[var(--onb-ink)]">
            {t('perso.tasks.previewTitle')}
            <span className="font-data text-caption font-normal text-[var(--onb-muted)]">{tasks.length}/5</span>
          </p>
          <ul className="mt-3 space-y-2">
            <AnimatePresence initial={false}>
              {tasks.map((name, i) => (
                <motion.li
                  key={`${name}-${i}`}
                  layout={!reduce}
                  {...fade}
                  transition={{ duration: 0.28 }}
                  className="flex items-center gap-3 rounded-xl border border-[var(--onb-line-soft)] bg-[var(--onb-row)] px-3 py-2.5"
                >
                  <span className="h-[18px] w-[18px] shrink-0 rounded-full border-[1.5px] border-[var(--onb-faint)]" />
                  <span className="truncate text-sm text-[var(--onb-ink)]">{name}</span>
                </motion.li>
              ))}
            </AnimatePresence>
            {tasks.length === 0 &&
              [72, 54, 64].map((w) => (
                <li key={w} className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--onb-line)] px-3 py-2.5">
                  <span className="h-[18px] w-[18px] shrink-0 rounded-full border-[1.5px] border-dashed border-[var(--onb-hair)]" />
                  <span className="h-2.5 rounded-full bg-[var(--onb-line-soft)]" style={{ width: `${w}%` }} />
                </li>
              ))}
          </ul>
        </div>
        {tasks.length === 0 && !compact && <p className={CAPTION}>{t('perso.tasks.previewEmpty')}</p>}
      </div>
    );
  } else if (step === 2) {
    const name = tasks[0] || t('perso.agenda.fallbackTask');
    const startHour = slot?.hour ?? 10;
    const hours = [startHour - 1, startHour, startHour + 1, startHour + 2];
    body = (
      <div>
        <div className={CARD}>
          <p className="text-label font-semibold text-[var(--onb-ink)] first-letter:uppercase">
            {slot?.dayLabel ?? formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <div className="relative mt-3">
            {hours.map((h) => (
              <div key={h} className="flex h-11 items-start gap-3">
                <span className="w-10 shrink-0 -translate-y-1.5 font-data text-caption text-[var(--onb-faint)]">{pad(h)}</span>
                <span className="h-px flex-1 bg-[var(--onb-line-soft)]" />
              </div>
            ))}
            <motion.div
              key={`${startHour}-${slot?.dayLabel ?? ''}`}
              {...(reduce
                ? { initial: { opacity: 0 }, animate: { opacity: slot ? 1 : 0.55 } }
                : { initial: { opacity: 0, x: -36, rotate: -2 }, animate: { opacity: slot ? 1 : 0.55, x: 0, rotate: 0 } })}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              className={`absolute left-[3.25rem] right-0 top-11 h-11 rounded-lg border-l-[3px] bg-[var(--onb-tint-agenda)] px-3 py-1.5 ${
                slot ? '' : 'border-dashed'
              }`}
              style={{ borderLeftColor: PLANET_COLOR.agenda }}
            >
              <span className="block truncate text-label font-semibold text-[var(--onb-tint-agenda-ink)]">{name}</span>
              <span className="block font-data text-caption" style={{ color: text.agenda }}>
                {`${pad(startHour)} – ${pad(startHour + 1)}`}
              </span>
            </motion.div>
          </div>
        </div>
        {!compact && <p className={CAPTION}>{t('perso.agenda.previewCaption')}</p>}
      </div>
    );
  } else if (step === 3) {
    const week = currentWeek();
    const today = new Date().getDay();
    body = (
      <div>
        <div className={CARD}>
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: PLANET_COLOR.habits }} />
              <span className={`truncate text-body font-semibold ${habit ? 'text-[var(--onb-ink)]' : 'text-[var(--onb-faint)]'}`}>
                {habit || t('perso.habits.previewFallback')}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1 font-data text-caption text-[var(--onb-muted)]">
              <Clock size={12} aria-hidden="true" />
              {t('perso.habits.previewEvery', { minutes: habitMinutes })}
            </span>
          </div>
          <ol className="mt-4 grid grid-cols-7 gap-1.5">
            {week.map((day) => {
              const isToday = day.getDay() === today;
              const past = !isToday && day < new Date();
              return (
                <li key={day.toISOString()} className="flex flex-col items-center gap-1.5">
                  <span className={`font-data text-caption uppercase ${isToday ? 'font-bold text-[var(--onb-ink)]' : 'text-[var(--onb-faint)]'}`}>
                    {formatDate(day, { weekday: 'narrow' })}
                  </span>
                  {isToday ? (
                    <motion.span
                      {...(reduce ? {} : { initial: { scale: 0.6 }, animate: { scale: 1 } })}
                      transition={{ type: 'spring', stiffness: 380, damping: 18, delay: 0.3 }}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-white"
                      style={{ backgroundColor: PLANET_COLOR.habits }}
                    >
                      <Check size={16} strokeWidth={3} />
                    </motion.span>
                  ) : (
                    <span
                      className={`h-9 w-9 rounded-full border-[1.5px] ${past ? 'border-dashed border-[var(--onb-line)]' : 'border-[var(--onb-hair)]'}`}
                    />
                  )}
                </li>
              );
            })}
          </ol>
          <p className="mt-4 flex items-center gap-1.5 text-label font-medium" style={{ color: text.habits }}>
            <Flame size={15} />
            {t('perso.habits.previewStreak')}
          </p>
        </div>
        {!compact && <p className={CAPTION}>{t('perso.habits.previewCaption')}</p>}
      </div>
    );
  } else if (step === 4) {
    const r = 26;
    const c = 2 * Math.PI * r;
    const targetNum = Number(target.replace(',', '.'));
    const targetLabel = Number.isFinite(targetNum) && targetNum > 0 ? String(targetNum) : '1';
    body = (
      <div>
        <div className={CARD}>
          <div className="flex items-center gap-4">
            <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0 -rotate-90">
              <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" style={{ stroke: 'var(--onb-track-okr)' }} />
              <circle
                cx="32"
                cy="32"
                r={r}
                fill="none"
                stroke={PLANET_COLOR.okr}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${c * 0.04} ${c}`}
              />
            </svg>
            <div className="min-w-0">
              <p className={`line-clamp-2 text-body font-semibold leading-snug ${objective ? 'text-[var(--onb-ink)]' : 'text-[var(--onb-faint)]'}`}>
                {objective || t('perso.okr.previewFallback')}
              </p>
              <p className="mt-0.5 font-data text-caption text-[var(--onb-muted)]">{t('perso.okr.previewPeriod')} · 0 %</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-[var(--onb-tint-okr-line)] bg-[var(--onb-tint-okr)] px-3.5 py-3">
            <p className="flex items-center justify-between gap-3 text-label">
              <span className={`flex min-w-0 items-center gap-2 ${keyResult ? 'text-[var(--onb-ink)]' : 'text-[var(--onb-faint)]'}`}>
                <Target size={14} className="shrink-0" style={{ color: text.okr }} />
                <span className="truncate">{keyResult || t('perso.okr.previewKrFallback')}</span>
              </span>
              <span className="shrink-0 font-data text-caption text-[var(--onb-muted)]">{`0 / ${targetLabel}`}</span>
            </p>
            <span className="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-[var(--onb-track-okr)]">
              <span className="block h-full w-[3%] rounded-full" style={{ backgroundColor: PLANET_COLOR.okr }} />
            </span>
          </div>
        </div>
        {!compact && <p className={CAPTION}>{t('perso.okr.previewCaption')}</p>}
      </div>
    );
  } else {
    // Bilan : la carte de statistiques que ces créations vont nourrir. Une
    // semaine, la barre d'aujourd'hui à la hauteur de ce qui vient d'être
    // posé, les autres à zéro : rien d'inventé.
    const week = currentWeek();
    const today = new Date().getDay();
    const todayCount = created.tasks + (created.habit ? 1 : 0) + (created.slot ? 1 : 0);
    body = (
      <div className={CARD}>
        <p className="flex items-center gap-2 text-label font-semibold text-[var(--onb-ink)]">
          <BarChart3 size={15} aria-hidden="true" style={{ color: text.agenda }} />
          {t('perso.done.statsTitle')}
        </p>
        <div className="mt-4 flex h-24 items-end gap-2">
          {week.map((day) => {
            const isToday = day.getDay() === today;
            const h = isToday ? Math.min(100, 18 + todayCount * 14) : 0;
            return (
              <div key={day.toISOString()} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-20 w-full items-end">
                  <motion.span
                    className="block w-full rounded-md"
                    style={{
                      height: `${Math.max(h, 4)}%`,
                      backgroundColor: isToday ? PLANET_COLOR.tasks : 'var(--onb-line-soft)',
                    }}
                    {...(reduce ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 } })}
                  />
                </div>
                <span className={`font-data text-caption uppercase ${isToday ? 'font-bold text-[var(--onb-ink)]' : 'text-[var(--onb-faint)]'}`}>
                  {formatDate(day, { weekday: 'narrow' })}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-label leading-snug text-[var(--onb-body)]">
          {todayCount > 0 ? tp('perso.done.statsToday', todayCount) : t('perso.done.statsEmpty')}
        </p>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {body && (
        <motion.div key={step} {...fade} transition={{ duration: 0.3 }} className="w-full">
          {body}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PersoPreview;
