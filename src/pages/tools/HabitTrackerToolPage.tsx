import React from 'react';
import { Printer } from 'lucide-react';
import { useSeoMeta } from '@/lib/useSeoMeta';
import { safeParse } from '@/lib/safe-json';
import { canonicalUrl, routeSlug } from '@/i18n/routes';
import { useT } from '@/i18n/useT';
import { formatDate } from '@/i18n/format';
import ToolShell, { usePersistedState } from './ToolShell';

// Outil gratuit (plan SEO C7) : habit tracker sur mesure, à imprimer.
// Le visiteur choisit le mois et jusqu'à 8 habitudes ; la grille s'imprime en A4.

interface Etat { annee: number; mois: number; habitudes: string[] }
const KEY = 'cosmo_outil_habit_tracker';
const MAX = 8;
const ANNEES = [2026, 2027];
const initial = (): Etat => ({ annee: 2027, mois: 0, habitudes: ['', '', ''] });

export function lireEtat(brut: string | null): Etat {
  const e = safeParse<Partial<Etat>>(brut);
  if (!e || typeof e !== 'object') return initial();
  const annee = ANNEES.includes(Number(e.annee)) ? Number(e.annee) : 2027;
  const mois = Number.isInteger(e.mois) && Number(e.mois) >= 0 && Number(e.mois) <= 11 ? Number(e.mois) : 0;
  const habitudes = Array.isArray(e.habitudes) ? e.habitudes.filter((h): h is string => typeof h === 'string').map((h) => h.slice(0, 60)).slice(0, MAX) : [];
  return { annee, mois, habitudes: habitudes.length ? habitudes : ['', '', ''] };
}

/** Jours d'un mois, avec leur jour de semaine (0 = dimanche). */
export const joursDuMois = (annee: number, mois: number) =>
  Array.from({ length: new Date(Date.UTC(annee, mois + 1, 0)).getUTCDate() }, (_, i) => ({ jour: i + 1, semaine: new Date(Date.UTC(annee, mois, i + 1)).getUTCDay() }));

const HabitTrackerToolPage: React.FC = () => {
  const { locale } = useT('landing');
  const { t: tSeo } = useT('seo');
  const { t } = useT('tools');
  const [etat, setEtat] = usePersistedState<Etat>(KEY, initial(), lireEtat);
  useSeoMeta({
    title: tSeo('habitTrackerTool.title'),
    description: tSeo('habitTrackerTool.description'),
    canonical: canonicalUrl(`/${routeSlug('habitTrackerTool', 'fr')}`, locale),
  });
  const jours = joursDuMois(etat.annee, etat.mois);
  const nomMois = (m: number) => formatDate(new Date(Date.UTC(etat.annee, m, 15)), { month: 'long' });
  const initiale = (s: number) => formatDate(new Date(Date.UTC(2026, 10, 1 + s)), { weekday: 'narrow' });
  const remplies = etat.habitudes.filter((h) => h.trim());

  return (
    <ToolShell
      cta="outil-habit-tracker"
      title={t('habit.title')}
      intro={t('habit.intro')}
      ctaTitle={t('habit.ctaTitle')}
      ctaText={t('habit.ctaText')}
      howTitle={t('habit.howTitle')}
      how={[t('habit.how1'), t('habit.how2')]}
      demoPath="/habits"
    >
      <div className="grid lg:grid-cols-[18rem_1fr] gap-8">
        <div className="space-y-5 print:hidden">
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="ht-mois">{t('habit.month')}</label>
            <select id="ht-mois" value={etat.mois} onChange={(e) => setEtat((s) => ({ ...s, mois: Number(e.target.value) }))} className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white">
              {Array.from({ length: 12 }, (_, m) => <option key={m} value={m}>{nomMois(m)}</option>)}
            </select>
            <label className="sr-only" htmlFor="ht-annee">{t('habit.year')}</label>
            <select id="ht-annee" value={etat.annee} onChange={(e) => setEtat((s) => ({ ...s, annee: Number(e.target.value) }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white">
              {ANNEES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <fieldset className="space-y-2">
            <legend className="font-bold text-slate-900 mb-2">{t('habit.habits')}</legend>
            {etat.habitudes.map((h, i) => (
              <div key={i}>
                <label className="sr-only" htmlFor={`ht-h-${i}`}>{t('habit.habitLabel')}</label>
                <input
                  id={`ht-h-${i}`}
                  value={h}
                  maxLength={60}
                  placeholder={t('habit.placeholder')}
                  onChange={(e) => setEtat((s) => ({ ...s, habitudes: s.habitudes.map((x, j) => (j === i ? e.target.value.slice(0, 60) : x)) }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            ))}
            {etat.habitudes.length < MAX && (
              <button type="button" onClick={() => setEtat((s) => ({ ...s, habitudes: [...s.habitudes, ''] }))} className="text-sm text-blue-700 hover:underline">
                {t('habit.addHabit')}
              </button>
            )}
          </fieldset>
          <p className="text-xs text-slate-500">{t('habit.hint')}</p>
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">
            <Printer size={16} /> {t('habit.print')}
          </button>
        </div>

        <section aria-labelledby="ht-grille" className="overflow-x-auto">
          <h2 id="ht-grille" className="text-xl font-bold mb-3 capitalize">{formatDate(new Date(Date.UTC(etat.annee, etat.mois, 15)), { month: 'long', year: 'numeric' })}</h2>
          <table className="border-collapse text-[11px] w-full">
            <thead>
              <tr>
                <th className="text-left font-semibold pr-2 min-w-32">{t('habit.habitColumn')}</th>
                {jours.map((j) => (
                  <th key={j.jour} className={`w-6 text-center font-normal ${j.semaine === 0 || j.semaine === 6 ? 'bg-slate-100' : ''}`}>
                    <div className="text-slate-400">{initiale(j.semaine)}</div>{j.jour}
                  </th>
                ))}
                <th className="pl-1 font-semibold">{t('habit.total')}</th>
              </tr>
            </thead>
            <tbody>
              {(remplies.length ? remplies : ['', '', '']).map((h, i) => (
                <tr key={i} className="h-8">
                  <td className="pr-2 border-b border-slate-200">{h}</td>
                  {jours.map((j) => <td key={j.jour} className={`border border-slate-200 ${j.semaine === 0 || j.semaine === 6 ? 'bg-slate-50' : ''}`} />)}
                  <td className="border border-slate-200" />
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-400">{t('habit.rule')}</p>
        </section>
      </div>
    </ToolShell>
  );
};

export default HabitTrackerToolPage;
