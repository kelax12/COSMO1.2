import React from 'react';
import { Printer } from 'lucide-react';
import { useSeoMeta } from '@/lib/useSeoMeta';
import { safeParse } from '@/lib/safe-json';
import { canonicalUrl, routeSlug } from '@/i18n/routes';
import { useT } from '@/i18n/useT';
import { formatDate } from '@/i18n/format';
import ToolShell, { usePersistedState } from './ToolShell';

// Outil gratuit (plan SEO C7) : planning de semaine en time-blocking.
// Une grille 7 jours × créneaux d'une heure, chaque case reçoit un libellé.

const KEY = 'cosmo_outil_planning_semaine';
export const HEURES = Array.from({ length: 13 }, (_, i) => 7 + i); // 7 h à 19 h
const JOURS = 7;
type Grille = Record<string, string>; // clé `jour-heure`

export function lireGrille(brut: string | null): Grille {
  const e = safeParse<Record<string, unknown>>(brut);
  if (!e || typeof e !== 'object' || Array.isArray(e)) return {};
  const propre: Grille = {};
  for (const [k, v] of Object.entries(e)) {
    const m = /^(\d)-(\d{1,2})$/.exec(k);
    if (!m || typeof v !== 'string') continue;
    const jour = Number(m[1]);
    const heure = Number(m[2]);
    if (jour < JOURS && HEURES.includes(heure) && v.trim()) propre[k] = v.slice(0, 40);
  }
  return propre;
}

const WeeklyPlannerToolPage: React.FC = () => {
  const { locale } = useT('landing');
  const { t: tSeo } = useT('seo');
  const { t } = useT('tools');
  const [grille, setGrille] = usePersistedState<Grille>(KEY, {}, lireGrille);
  useSeoMeta({
    title: tSeo('weeklyPlannerTool.title'),
    description: tSeo('weeklyPlannerTool.description'),
    canonical: canonicalUrl(`/${routeSlug('weeklyPlannerTool', 'fr')}`, locale),
  });
  // Une date connue pour tomber un lundi, qui sert seulement à nommer les jours dans la langue.
  const nomHeure = (h: number) => formatDate(new Date(2026, 0, 1, h), { hour: 'numeric' });
  const nomJour = (j: number) => formatDate(new Date(Date.UTC(2026, 10, 2 + j, 12)), { weekday: 'short' });
  const ecrire = (cle: string, v: string) =>
    setGrille((g) => {
      const suite = { ...g };
      if (v.trim()) suite[cle] = v.slice(0, 40);
      else delete suite[cle];
      return suite;
    });
  const nbBlocs = Object.keys(grille).length;

  return (
    <ToolShell
      cta="outil-planning-semaine"
      title={t('planner.title')}
      intro={t('planner.intro')}
      ctaTitle={t('planner.ctaTitle')}
      ctaText={t('planner.ctaText')}
      howTitle={t('planner.howTitle')}
      how={[t('planner.how1'), t('planner.how2')]}
      demoPath="/agenda"
    >
      <div className="flex flex-wrap items-center gap-3 mb-4 print:hidden">
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">
          <Printer size={16} /> {t('planner.print')}
        </button>
        {nbBlocs > 0 && (
          <button type="button" onClick={() => setGrille({})} className="rounded-xl px-4 py-2 text-sm text-slate-500 hover:text-slate-900">
            {t('planner.clear')}
          </button>
        )}
        <p className="text-xs text-slate-500">{t('planner.hint')}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="border-collapse w-full min-w-[44rem] text-xs">
          <thead>
            <tr>
              <th className="w-12" />
              {Array.from({ length: JOURS }, (_, j) => <th key={j} className="py-2 font-semibold capitalize">{nomJour(j)}</th>)}
            </tr>
          </thead>
          <tbody>
            {HEURES.map((h) => (
              <tr key={h}>
                <th scope="row" className="text-right pr-2 font-normal text-slate-400 align-top pt-1">{nomHeure(h)}</th>
                {Array.from({ length: JOURS }, (_, j) => {
                  const cle = `${j}-${h}`;
                  return (
                    <td key={cle} className={`border border-slate-200 p-0 ${grille[cle] ? 'bg-blue-50' : ''}`}>
                      <label className="sr-only" htmlFor={`pl-${cle}`}>{`${nomJour(j)} ${nomHeure(h)}`}</label>
                      <input
                        id={`pl-${cle}`}
                        value={grille[cle] ?? ''}
                        maxLength={40}
                        onChange={(e) => ecrire(cle, e.target.value)}
                        className="w-full h-8 px-1.5 bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-400 print:hidden">{t('eisenhower.privacy')}</p>
    </ToolShell>
  );
};

export default WeeklyPlannerToolPage;
