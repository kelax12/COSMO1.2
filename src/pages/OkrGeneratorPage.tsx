import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, Copy, Printer, Trash2 } from 'lucide-react';
import { useSeoMeta } from '@/lib/useSeoMeta';
import { safeParse } from '@/lib/safe-json';
import { canonicalUrl, routeSlug } from '@/i18n/routes';
import { useT } from '@/i18n/useT';
import { useForcedLightTheme } from '@/hooks/use-forced-light-theme';
import { useOptionalAuth } from '@/modules/auth/AuthContext';
import { enterWithTheme } from '@/lib/theme';
import { OKR_DOMAINES } from '@/content/okr-generator.mjs';

// Outil gratuit sans inscription (plan SEO C7) : générateur d'OKR. Les
// propositions viennent d'une banque rédigée à la main (src/content/
// okr-generator.mjs), aucune IA. Tout reste dans ce navigateur. Stockage lu
// dans un effet seulement : la page est aussi rendue par le prérendu.

interface Kr { texte: string; unite: string; depart: string; cible: string }
interface Etat { domaine: string; objectif: string; krs: Kr[] }

const STORAGE_KEY = 'cosmo_outil_okr';
const MAX_KR = 5;
const VIDE: Etat = { domaine: OKR_DOMAINES[0].id, objectif: '', krs: [] };
const chaine = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

function lireEtat(brut: string | null): Etat {
  const e = safeParse<Partial<Etat>>(brut);
  if (!e || typeof e !== 'object') return VIDE;
  const domaine = OKR_DOMAINES.some((d) => d.id === e.domaine) ? (e.domaine as string) : VIDE.domaine;
  const krs = Array.isArray(e.krs)
    ? e.krs.slice(0, MAX_KR).map((k) => ({ texte: chaine(k?.texte, 120), unite: chaine(k?.unite, 30), depart: chaine(k?.depart, 12), cible: chaine(k?.cible, 12) })).filter((k) => k.texte)
    : [];
  return { domaine, objectif: chaine(e.objectif, 140), krs };
}

const OkrGeneratorPage: React.FC = () => {
  useForcedLightTheme();
  const { t, locale } = useT('landing');
  const { t: tSeo } = useT('seo');
  const { t: tt } = useT('tools');
  const auth = useOptionalAuth();
  const navigate = useNavigate();
  const [etat, setEtat] = useState<Etat>(VIDE);
  const [charge, setCharge] = useState(false);
  const [copie, setCopie] = useState(false);
  const langue = locale === 'fr' ? 'fr' : 'en';

  useSeoMeta({
    title: tSeo('okrGeneratorTool.title'),
    description: tSeo('okrGeneratorTool.description'),
    canonical: canonicalUrl(`/${routeSlug('okrGeneratorTool', 'fr')}`, locale),
  });

  useEffect(() => {
    setEtat(lireEtat(window.localStorage.getItem(STORAGE_KEY)));
    setCharge(true);
  }, []);
  useEffect(() => {
    if (!charge) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(etat));
    } catch {
      // Stockage refusé : l'outil reste utilisable pour la session.
    }
  }, [etat, charge]);

  const domaine = useMemo(() => OKR_DOMAINES.find((d) => d.id === etat.domaine) ?? OKR_DOMAINES[0], [etat.domaine]);
  const contenu = domaine[langue];
  const choisi = (texte: string) => etat.krs.some((k) => k.texte === texte);
  const basculer = ([texte, unite, depart, cible]: readonly string[]) =>
    setEtat((e) =>
      choisi(texte)
        ? { ...e, krs: e.krs.filter((k) => k.texte !== texte) }
        : e.krs.length >= MAX_KR ? e : { ...e, krs: [...e.krs, { texte, unite, depart, cible }] }
    );
  const majKr = (i: number, champ: keyof Kr, valeur: string) =>
    setEtat((e) => ({ ...e, krs: e.krs.map((k, j) => (j === i ? { ...k, [champ]: valeur.slice(0, champ === 'texte' ? 120 : 12) } : k)) }));
  const chiffreDansObjectif = /\d/.test(etat.objectif);

  const texteOkr = () =>
    [`${tt('okr.objective')} : ${etat.objectif || '...'}`, ...etat.krs.map((k, i) => `${i + 1}. ${k.texte} (${k.unite}) : ${k.depart} → ${k.cible}`)].join('\n');
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(texteOkr());
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      setCopie(false);
    }
  };
  const ouvrirDemo = () => {
    enterWithTheme('light');
    auth?.loginDemo();
    setTimeout(() => navigate('/okr'), 0);
  };

  return (
    <div className="min-h-[100dvh] bg-white text-slate-900">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-900/10 print:hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-sm">
            <img src="/logo-128.webp" alt="Cosmo" className="w-7 h-7 rounded-lg object-contain" />
            <span className="font-semibold text-slate-900">Cosmo</span>
          </Link>
          <Link to="/signup" data-cta="outil-okr-signup-entete" className="text-sm text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5">
            {t('blog.createFreeAccount')}
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3 text-slate-900">{tt('okr.title')}</h1>
        <p className="text-slate-500 mb-8 max-w-2xl print:hidden">{tt('okr.intro')}</p>

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-6 print:hidden">
            <section aria-labelledby="okr-etape-1">
              <h2 id="okr-etape-1" className="font-bold text-slate-900 mb-3">{tt('okr.step1')}</h2>
              <div className="flex flex-wrap gap-2">
                {OKR_DOMAINES.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={d.id === etat.domaine}
                    onClick={() => setEtat((e) => ({ ...e, domaine: d.id }))}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${d.id === etat.domaine ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 hover:bg-slate-50'}`}
                  >
                    {d[langue].nom}
                  </button>
                ))}
              </div>
            </section>

            <section aria-labelledby="okr-etape-2">
              <h2 id="okr-etape-2" className="font-bold text-slate-900 mb-3">{tt('okr.step2')}</h2>
              <label className="sr-only" htmlFor="okr-objectif">{tt('okr.objective')}</label>
              <input
                id="okr-objectif"
                value={etat.objectif}
                onChange={(e) => setEtat((s) => ({ ...s, objectif: e.target.value.slice(0, 140) }))}
                placeholder={contenu.objectifs[0]}
                className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {contenu.objectifs.map((o) => (
                  <button key={o} type="button" onClick={() => setEtat((s) => ({ ...s, objectif: o }))} className="text-xs rounded-lg bg-slate-100 hover:bg-slate-200 px-2.5 py-1">
                    {o}
                  </button>
                ))}
              </div>
              {chiffreDansObjectif && <p className="mt-2 text-xs text-amber-700" role="status">{tt('okr.hintNumber')}</p>}
            </section>

            <section aria-labelledby="okr-etape-3">
              <h2 id="okr-etape-3" className="font-bold text-slate-900 mb-1">{tt('okr.step3')}</h2>
              <p className="text-xs text-slate-500 mb-3">{tt('okr.step3Hint')}</p>
              <ul className="space-y-2">
                {contenu.kr.map((k) => (
                  <li key={k[0]}>
                    <label className="flex items-start gap-2 text-sm cursor-pointer">
                      <input type="checkbox" className="mt-0.5" checked={choisi(k[0])} onChange={() => basculer(k)} disabled={!choisi(k[0]) && etat.krs.length >= MAX_KR} />
                      <span>{k[0]} <span className="text-slate-400">({k[1]})</span></span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section aria-labelledby="okr-resultat" className="rounded-2xl border border-slate-900/10 bg-slate-50 p-5 h-fit">
            <h2 id="okr-resultat" className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-2">{tt('okr.result')}</h2>
            <p className="text-lg font-bold text-slate-900 mb-4">{etat.objectif || <span className="text-slate-400 font-normal">{tt('okr.objectiveEmpty')}</span>}</p>
            {etat.krs.length === 0 ? (
              <p className="text-sm text-slate-400 italic">{tt('okr.krEmpty')}</p>
            ) : (
              <ol className="space-y-3">
                {etat.krs.map((k, i) => (
                  <li key={i} className="rounded-xl bg-white border border-slate-900/5 p-3">
                    <label className="sr-only" htmlFor={`kr-texte-${i}`}>{tt('okr.krLabel')}</label>
                    <input id={`kr-texte-${i}`} value={k.texte} onChange={(e) => majKr(i, 'texte', e.target.value)} className="w-full text-sm font-medium bg-transparent focus-visible:outline-none" />
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                      <label htmlFor={`kr-depart-${i}`}>{tt('okr.start')}</label>
                      <input id={`kr-depart-${i}`} value={k.depart} onChange={(e) => majKr(i, 'depart', e.target.value)} className="w-16 rounded-md border border-slate-200 px-1.5 py-0.5" />
                      <label htmlFor={`kr-cible-${i}`}>{tt('okr.target')}</label>
                      <input id={`kr-cible-${i}`} value={k.cible} onChange={(e) => majKr(i, 'cible', e.target.value)} className="w-16 rounded-md border border-slate-200 px-1.5 py-0.5" />
                      <span>{k.unite}</span>
                      <button type="button" onClick={() => setEtat((s) => ({ ...s, krs: s.krs.filter((_, j) => j !== i) }))} aria-label={tt('okr.remove')} className="ml-auto text-slate-400 hover:text-red-600 print:hidden">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-5 flex flex-wrap gap-2 print:hidden">
              <button type="button" onClick={copier} disabled={!etat.objectif && etat.krs.length === 0} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50">
                <Copy size={14} /> {copie ? tt('okr.copied') : tt('okr.copy')}
              </button>
              <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50">
                <Printer size={14} /> {tt('okr.print')}
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-400 print:hidden">{tt('eisenhower.privacy')}</p>
          </section>
        </div>

        <aside className="mt-12 rounded-2xl border border-slate-900/10 bg-slate-50 p-6 sm:p-8 text-center print:hidden">
          <p className="text-lg font-semibold mb-2">{tt('okr.ctaTitle')}</p>
          <p className="text-slate-500 text-sm mb-5">{tt('okr.ctaText')}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button type="button" data-cta="outil-okr-demo" onClick={ouvrirDemo} className="rounded-xl bg-blue-600 text-white font-semibold px-5 py-2.5 hover:bg-blue-700 transition-colors">
              {t('blog.demoCta')}
            </button>
            <Link to="/signup" data-cta="outil-okr-signup" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-2.5 font-semibold hover:bg-white">
              {t('blog.startFree')} <ArrowRight size={16} />
            </Link>
          </div>
        </aside>

        <section className="mt-12 max-w-2xl text-slate-600 space-y-3 leading-relaxed print:hidden">
          <h2 className="text-xl font-bold text-slate-900">{tt('okr.howTitle')}</h2>
          <p>{tt('okr.how1')}</p>
          <p>{tt('okr.how2')}</p>
        </section>
      </main>
    </div>
  );
};

export default OkrGeneratorPage;
