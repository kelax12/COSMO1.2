import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, Flame, Target } from 'lucide-react';
import { useT } from '@/i18n/useT';
import { formatDate } from '@/i18n/format';
import { PLANET_COLOR, PLANETS, type Planet } from './orrery-geometry';

interface PersoPreviewProps {
  step: number;
  /** Tâches prêtes à créer, brouillon en cours compris : l'aperçu suit la frappe. */
  tasks: string[];
  habit: string;
  objective: string;
  keyResult: string;
}

const CARD =
  'w-full rounded-[22px] border border-[#E2E8F0] bg-white p-5 shadow-[0_28px_60px_-30px_rgba(15,23,42,0.35)]';
const CAPTION = 'mt-3 text-center font-data text-caption uppercase tracking-[0.14em] text-[#64748B]';

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
 * moitié « comprendre » de l'accueil, la colonne de gauche étant la moitié
 * « faire ».
 *
 * Illustratif (`aria-hidden` posé par le parent) : la liste accessible des
 * tâches à créer vit dans le formulaire, avec ses boutons « Retirer ».
 */
const PersoPreview = ({ step, tasks, habit, objective, keyResult }: PersoPreviewProps) => {
  const { t } = useT('onboarding');
  const reduce = useReducedMotion() ?? false;
  const fade = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 } };

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
        <p className="font-data text-caption uppercase tracking-[0.14em] text-[#64748B]">{t('perso.intro.legendTitle')}</p>
        <ul className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3">
          {PLANETS.map((planet) => (
            <li key={planet} className="flex items-start gap-2.5">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: PLANET_COLOR[planet] }} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[#0F172A]">{t(`perso.planets.${planet}`)}</span>
                <span className="block text-label leading-snug text-[#475569]">{defs[planet]}</span>
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
          <p className="flex items-center justify-between text-label font-semibold text-[#0F172A]">
            {t('perso.tasks.previewTitle')}
            <span className="font-data text-caption font-normal text-[#64748B]">{tasks.length}/5</span>
          </p>
          <ul className="mt-3 space-y-2">
            <AnimatePresence initial={false}>
              {tasks.map((name, i) => (
                <motion.li
                  key={`${name}-${i}`}
                  layout={!reduce}
                  {...fade}
                  transition={{ duration: 0.28 }}
                  className="flex items-center gap-3 rounded-xl border border-[#EEF2F7] bg-[#FBFCFE] px-3 py-2.5"
                >
                  <span className="h-[18px] w-[18px] shrink-0 rounded-full border-[1.5px] border-[#94A3B8]" />
                  <span className="truncate text-sm text-[#0F172A]">{name}</span>
                </motion.li>
              ))}
            </AnimatePresence>
            {tasks.length === 0 &&
              [72, 54, 64].map((w) => (
                <li key={w} className="flex items-center gap-3 rounded-xl border border-dashed border-[#E2E8F0] px-3 py-2.5">
                  <span className="h-[18px] w-[18px] shrink-0 rounded-full border-[1.5px] border-dashed border-[#CBD5E1]" />
                  <span className="h-2.5 rounded-full bg-[#EEF2F7]" style={{ width: `${w}%` }} />
                </li>
              ))}
          </ul>
        </div>
        {tasks.length === 0 && <p className={CAPTION}>{t('perso.tasks.previewEmpty')}</p>}
      </div>
    );
  } else if (step === 2) {
    const name = tasks[0] || t('perso.agenda.fallbackTask');
    const hours = ['09:00', '10:00', '11:00', '12:00'];
    body = (
      <div>
        <div className={CARD}>
          <p className="text-label font-semibold text-[#0F172A] first-letter:uppercase">
            {formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <div className="relative mt-3">
            {hours.map((h) => (
              <div key={h} className="flex h-11 items-start gap-3">
                <span className="w-10 shrink-0 -translate-y-1.5 font-data text-caption text-[#94A3B8]">{h}</span>
                <span className="mt-0 h-px flex-1 bg-[#EEF2F7]" />
              </div>
            ))}
            <motion.div
              {...(reduce
                ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
                : { initial: { opacity: 0, x: -36, rotate: -2 }, animate: { opacity: 1, x: 0, rotate: 0 } })}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
              className="absolute left-[3.25rem] right-0 top-11 h-11 rounded-lg border-l-[3px] bg-[#EEF2FF] px-3 py-1.5"
              style={{ borderLeftColor: PLANET_COLOR.agenda }}
            >
              <span className="block truncate text-label font-semibold text-[#312E81]">{name}</span>
              <span className="block font-data text-caption text-[#4F46E5]">10:00 – 11:00</span>
            </motion.div>
          </div>
        </div>
        <p className={CAPTION}>{t('perso.agenda.previewCaption')}</p>
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
              <span className={`truncate text-body font-semibold ${habit ? 'text-[#0F172A]' : 'text-[#94A3B8]'}`}>
                {habit || t('perso.habits.previewFallback')}
              </span>
            </span>
            <span className="shrink-0 font-data text-caption text-[#64748B]">{t('perso.habits.previewDaily')}</span>
          </div>
          <ol className="mt-4 grid grid-cols-7 gap-1.5">
            {week.map((day) => {
              const isToday = day.getDay() === today;
              const past = !isToday && day < new Date();
              return (
                <li key={day.toISOString()} className="flex flex-col items-center gap-1.5">
                  <span className={`font-data text-caption uppercase ${isToday ? 'font-bold text-[#0F172A]' : 'text-[#94A3B8]'}`}>
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
                      className={`h-9 w-9 rounded-full border-[1.5px] ${past ? 'border-dashed border-[#E2E8F0]' : 'border-[#CBD5E1]'}`}
                    />
                  )}
                </li>
              );
            })}
          </ol>
          <p className="mt-4 flex items-center gap-1.5 text-label font-medium text-[#6D28D9]">
            <Flame size={15} />
            {t('perso.habits.previewStreak')}
          </p>
        </div>
        <p className={CAPTION}>{t('perso.habits.previewCaption')}</p>
      </div>
    );
  } else if (step === 4) {
    const r = 26;
    const c = 2 * Math.PI * r;
    body = (
      <div>
        <div className={CARD}>
          <div className="flex items-center gap-4">
            <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0 -rotate-90">
              <circle cx="32" cy="32" r={r} fill="none" stroke="#F3E8FF" strokeWidth="6" />
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
              <p className={`line-clamp-2 text-body font-semibold leading-snug ${objective ? 'text-[#0F172A]' : 'text-[#94A3B8]'}`}>
                {objective || t('perso.okr.previewFallback')}
              </p>
              <p className="mt-0.5 font-data text-caption text-[#64748B]">{t('perso.okr.previewPeriod')} · 0 %</p>
            </div>
          </div>
          <div className="mt-4 rounded-xl border border-[#F5E8FA] bg-[#FDF8FE] px-3.5 py-3">
            <p className="flex items-center justify-between gap-3 text-label">
              <span className={`flex min-w-0 items-center gap-2 ${keyResult ? 'text-[#0F172A]' : 'text-[#94A3B8]'}`}>
                <Target size={14} className="shrink-0 text-[#C026D3]" />
                <span className="truncate">{keyResult || t('perso.okr.previewKrFallback')}</span>
              </span>
              <span className="shrink-0 font-data text-caption text-[#64748B]">0 / 1</span>
            </p>
            <span className="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-[#F3E8FF]">
              <span className="block h-full w-[3%] rounded-full" style={{ backgroundColor: PLANET_COLOR.okr }} />
            </span>
          </div>
        </div>
        <p className={CAPTION}>{t('perso.okr.previewCaption')}</p>
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
