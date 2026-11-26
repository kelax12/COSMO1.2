import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react';
import { useSeoMeta } from '@/lib/useSeoMeta';
import { safeParse } from '@/lib/safe-json';
import { canonicalUrl, routeSlug } from '@/i18n/routes';
import { useT } from '@/i18n/useT';
import ToolShell, { usePersistedState } from './ToolShell';

// Outil gratuit (plan SEO C7) : minuteur Pomodoro relié à une tâche.
// 25 min de travail, 5 min de pause, 15 min toutes les 4 sessions. Le temps
// restant se calcule depuis l'heure de fin (`finA`), pas en comptant les ticks :
// un onglet en arrière-plan ralentit les timers sans fausser le minuteur.

export type Phase = 'travail' | 'pause' | 'longue';
export const DUREES: Record<Phase, number> = { travail: 25 * 60, pause: 5 * 60, longue: 15 * 60 };
const KEY = 'cosmo_outil_pomodoro';

interface Etat { tache: string; jour: string; sessions: number }
const aujourdhui = () => new Date().toISOString().slice(0, 10);
export function lireEtat(brut: string | null): Etat {
  const e = safeParse<Partial<Etat>>(brut);
  const jour = aujourdhui();
  if (!e || typeof e !== 'object') return { tache: '', jour, sessions: 0 };
  const sessions = e.jour === jour && Number.isInteger(e.sessions) && Number(e.sessions) >= 0 ? Math.min(Number(e.sessions), 99) : 0;
  return { tache: typeof e.tache === 'string' ? e.tache.slice(0, 80) : '', jour, sessions };
}

/** Phase qui suit, selon le nombre de sessions de travail déjà terminées. */
export const phaseSuivante = (phase: Phase, sessions: number): Phase =>
  phase !== 'travail' ? 'travail' : sessions > 0 && sessions % 4 === 0 ? 'longue' : 'pause';

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const PomodoroToolPage: React.FC = () => {
  const { locale } = useT('landing');
  const { t: tSeo } = useT('seo');
  const { t } = useT('tools');
  const [etat, setEtat] = usePersistedState<Etat>(KEY, { tache: '', jour: '', sessions: 0 }, lireEtat);
  const [phase, setPhase] = useState<Phase>('travail');
  const [finA, setFinA] = useState<number | null>(null);
  const [reste, setReste] = useState(DUREES.travail);
  useSeoMeta({
    title: tSeo('pomodoroTool.title'),
    description: tSeo('pomodoroTool.description'),
    canonical: canonicalUrl(`/${routeSlug('pomodoroTool', 'fr')}`, locale),
  });

  const changerPhase = (suivante: Phase) => {
    setPhase(suivante);
    setFinA(null);
    setReste(DUREES[suivante]);
  };
  const terminer = () => {
    const sessions = phase === 'travail' ? etat.sessions + 1 : etat.sessions;
    if (phase === 'travail') setEtat((e) => ({ ...e, sessions }));
    changerPhase(phaseSuivante(phase, sessions));
  };
  // Ref vers la dernière version de `terminer` : l'intervalle lit l'état courant
  // (phase, sessions) au moment où le minuteur atteint zéro, sans redémarrer.
  const terminerRef = useRef(terminer);
  terminerRef.current = terminer;

  useEffect(() => {
    if (finA === null) return;
    const id = window.setInterval(() => {
      const r = Math.max(0, Math.round((finA - Date.now()) / 1000));
      setReste(r);
      if (r === 0) {
        window.clearInterval(id);
        terminerRef.current();
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [finA]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const titre = document.title;
    if (finA !== null) document.title = `${mmss(reste)} · ${t(`pomodoro.phase.${phase}`)}`;
    return () => { document.title = titre; };
  }, [reste, finA, phase, t]);

  const enCours = finA !== null;
  const demarrer = () => setFinA(Date.now() + reste * 1000);
  const mettreEnPause = () => setFinA(null);

  return (
    <ToolShell
      cta="outil-pomodoro"
      title={t('pomodoro.title')}
      intro={t('pomodoro.intro')}
      ctaTitle={t('pomodoro.ctaTitle')}
      ctaText={t('pomodoro.ctaText')}
      howTitle={t('pomodoro.howTitle')}
      how={[t('pomodoro.how1'), t('pomodoro.how2')]}
      demoPath="/tasks"
    >
      <section aria-labelledby="pomo-minuteur" className={`mx-auto max-w-md rounded-3xl border p-8 text-center ${phase === 'travail' ? 'border-blue-200 bg-blue-50/50' : 'border-emerald-200 bg-emerald-50/50'}`}>
        <h2 id="pomo-minuteur" className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t(`pomodoro.phase.${phase}`)}</h2>
        <p className="my-4 text-7xl font-bold tabular-nums text-slate-900" role="timer" aria-live="off">{mmss(reste)}</p>
        <label className="sr-only" htmlFor="pomo-tache">{t('pomodoro.taskLabel')}</label>
        <input
          id="pomo-tache"
          value={etat.tache}
          maxLength={80}
          onChange={(e) => setEtat((s) => ({ ...s, tache: e.target.value.slice(0, 80) }))}
          placeholder={t('pomodoro.taskPlaceholder')}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-center"
        />
        <div className="mt-5 flex justify-center gap-3">
          {enCours ? (
            <button type="button" onClick={mettreEnPause} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white font-semibold px-5 py-2.5">
              <Pause size={16} /> {t('pomodoro.pause')}
            </button>
          ) : (
            <button type="button" onClick={demarrer} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white font-semibold px-5 py-2.5 hover:bg-blue-700">
              <Play size={16} /> {t('pomodoro.start')}
            </button>
          )}
          <button type="button" onClick={() => changerPhase(phase)} aria-label={t('pomodoro.reset')} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 hover:bg-slate-50">
            <RotateCcw size={16} />
          </button>
          <button type="button" onClick={terminer} aria-label={t('pomodoro.skip')} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 hover:bg-slate-50">
            <SkipForward size={16} />
          </button>
        </div>
        <p className="mt-5 text-sm text-slate-600" aria-live="polite">{t('pomodoro.sessions', { n: String(etat.sessions) })}</p>
      </section>
      <p className="mt-3 text-center text-xs text-slate-400">{t('eisenhower.privacy')}</p>
    </ToolShell>
  );
};

export default PomodoroToolPage;
