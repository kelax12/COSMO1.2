import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, Printer, Trash2 } from 'lucide-react';
import { useSeoMeta } from '@/lib/useSeoMeta';
import { safeParseArray } from '@/lib/safe-json';
import { articleSlug, canonicalUrl } from '@/i18n/routes';
import { useT } from '@/i18n/useT';
import { useForcedLightTheme } from '@/hooks/use-forced-light-theme';
import { useOptionalAuth } from '@/modules/auth/AuthContext';
import { enterWithTheme } from '@/lib/theme';

// Outil gratuit sans inscription (plan SEO C7) : matrice d'Eisenhower en ligne.
// Les tâches restent dans ce navigateur (localStorage), rien n'est envoyé.
// Lecture du stockage dans un effet seulement : la page est aussi rendue par
// le prérendu, sans `window`.

type Quadrant = 'q1' | 'q2' | 'q3' | 'q4';
interface ToolTask { id: string; text: string; q: Quadrant }

const STORAGE_KEY = 'cosmo_outil_eisenhower';
const QUADRANTS: readonly Quadrant[] = ['q1', 'q2', 'q3', 'q4'];
const COULEURS: Record<Quadrant, string> = {
  q1: 'border-red-200 bg-red-50/60',
  q2: 'border-blue-200 bg-blue-50/60',
  q3: 'border-amber-200 bg-amber-50/60',
  q4: 'border-slate-200 bg-slate-50',
};
const estQuadrant = (v: unknown): v is Quadrant => typeof v === 'string' && (QUADRANTS as readonly string[]).includes(v);

const EisenhowerToolPage: React.FC = () => {
  useForcedLightTheme();
  const { t, locale } = useT('landing');
  const { t: tSeo } = useT('seo');
  const { t: tt } = useT('tools');
  const auth = useOptionalAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<ToolTask[]>([]);
  const [texte, setTexte] = useState('');
  const [quadrant, setQuadrant] = useState<Quadrant>('q2');
  const [charge, setCharge] = useState(false);

  useSeoMeta({
    title: tSeo('eisenhowerTool.title'),
    description: tSeo('eisenhowerTool.description'),
    canonical: canonicalUrl('/matrice-eisenhower-en-ligne', locale),
  });

  useEffect(() => {
    const brut = safeParseArray<Partial<ToolTask>>(window.localStorage.getItem(STORAGE_KEY)) ?? [];
    setTasks(
      brut
        .filter((x): x is ToolTask => typeof x?.id === 'string' && typeof x.text === 'string' && estQuadrant(x.q))
        .slice(0, 200)
    );
    setCharge(true);
  }, []);

  useEffect(() => {
    if (!charge) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      // Stockage refusé (navigation privée stricte) : l'outil reste utilisable pour la session.
    }
  }, [tasks, charge]);

  const ajouter = (e: React.FormEvent) => {
    e.preventDefault();
    const propre = texte.trim().slice(0, 140);
    if (!propre) return;
    setTasks((l) => [...l, { id: `${Date.now()}-${l.length}`, text: propre, q: quadrant }]);
    setTexte('');
  };
  const deplacer = (id: string, q: Quadrant) => setTasks((l) => l.map((x) => (x.id === id ? { ...x, q } : x)));
  const retirer = (id: string) => setTasks((l) => l.filter((x) => x.id !== id));
  const ouvrirDemo = () => {
    enterWithTheme('light');
    auth?.loginDemo();
    setTimeout(() => navigate('/dashboard'), 0);
  };

  return (
    <div className="min-h-[100dvh] bg-white text-slate-900">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-900/10 print:hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-sm">
            <img src="/logo-128.webp" alt="Cosmo" className="w-7 h-7 rounded-lg object-contain" />
            <span className="font-semibold text-slate-900">Cosmo</span>
          </Link>
          <Link to="/signup" data-cta="outil-eisenhower-signup-entete" className="text-sm text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5">
            {t('blog.createFreeAccount')}
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3 text-slate-900">{tt('eisenhower.title')}</h1>
        <p className="text-slate-500 mb-8 max-w-2xl print:hidden">{tt('eisenhower.intro')}</p>

        <form onSubmit={ajouter} className="flex flex-col sm:flex-row gap-3 mb-8 print:hidden">
          <label className="sr-only" htmlFor="outil-tache">{tt('eisenhower.taskLabel')}</label>
          <input
            id="outil-tache"
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            maxLength={140}
            placeholder={tt('eisenhower.placeholder')}
            className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          />
          <label className="sr-only" htmlFor="outil-case">{tt('eisenhower.quadrantLabel')}</label>
          <select
            id="outil-case"
            value={quadrant}
            onChange={(e) => estQuadrant(e.target.value) && setQuadrant(e.target.value)}
            className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm bg-white"
          >
            {QUADRANTS.map((q) => <option key={q} value={q}>{tt(`eisenhower.${q}.title`)}</option>)}
          </select>
          <button type="submit" className="rounded-xl bg-blue-600 text-white font-semibold px-5 py-2.5 text-sm hover:bg-blue-700 transition-colors">
            {tt('eisenhower.add')}
          </button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {QUADRANTS.map((q) => {
            const liste = tasks.filter((x) => x.q === q);
            return (
              <section key={q} className={`rounded-2xl border p-4 min-h-40 ${COULEURS[q]}`} aria-labelledby={`titre-${q}`}>
                <h2 id={`titre-${q}`} className="font-bold text-slate-900">{tt(`eisenhower.${q}.title`)}</h2>
                <p className="text-xs text-slate-500 mb-3">{tt(`eisenhower.${q}.action`)}</p>
                {liste.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">{tt('eisenhower.empty')}</p>
                ) : (
                  <ul className="space-y-2">
                    {liste.map((x) => (
                      <li key={x.id} className="flex items-center gap-2 rounded-lg bg-white/80 border border-slate-900/5 px-3 py-2 text-sm">
                        <span className="flex-1 break-words">{x.text}</span>
                        <label className="sr-only" htmlFor={`deplacer-${x.id}`}>{tt('eisenhower.moveLabel')}</label>
                        <select
                          id={`deplacer-${x.id}`}
                          value={x.q}
                          onChange={(e) => estQuadrant(e.target.value) && deplacer(x.id, e.target.value)}
                          className="text-xs rounded-md border border-slate-200 bg-white px-1 py-0.5 print:hidden"
                        >
                          {QUADRANTS.map((o) => <option key={o} value={o}>{o.toUpperCase()}</option>)}
                        </select>
                        <button type="button" onClick={() => retirer(x.id)} aria-label={tt('eisenhower.remove')} className="text-slate-400 hover:text-red-600 print:hidden">
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap gap-3 print:hidden">
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">
            <Printer size={16} /> {tt('eisenhower.print')}
          </button>
          {tasks.length > 0 && (
            <button type="button" onClick={() => setTasks([])} className="rounded-xl px-4 py-2 text-sm text-slate-500 hover:text-slate-900">
              {tt('eisenhower.clear')}
            </button>
          )}
        </div>
        <p className="mt-3 text-xs text-slate-400 print:hidden">{tt('eisenhower.privacy')}</p>

        <aside className="mt-12 rounded-2xl border border-slate-900/10 bg-slate-50 p-6 sm:p-8 text-center print:hidden">
          <p className="text-lg font-semibold mb-2">{tt('eisenhower.ctaTitle')}</p>
          <p className="text-slate-500 text-sm mb-5">{tt('eisenhower.ctaText')}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button type="button" data-cta="outil-eisenhower-demo" onClick={ouvrirDemo} className="rounded-xl bg-blue-600 text-white font-semibold px-5 py-2.5 hover:bg-blue-700 transition-colors">
              {t('blog.demoCta')}
            </button>
            <Link to="/signup" data-cta="outil-eisenhower-signup" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-2.5 font-semibold hover:bg-white">
              {t('blog.startFree')} <ArrowRight size={16} />
            </Link>
          </div>
        </aside>

        <section className="mt-12 max-w-2xl text-slate-600 space-y-3 leading-relaxed print:hidden">
          <h2 className="text-xl font-bold text-slate-900">{tt('eisenhower.howTitle')}</h2>
          <p>{tt('eisenhower.how1')}</p>
          <p>{tt('eisenhower.how2')}</p>
          <p>
            {tt('eisenhower.moreBefore')}{' '}
            <Link to={`/blog/${articleSlug('matrice-eisenhower', locale)}`} className="text-blue-600 hover:underline">{tt('eisenhower.moreLink')}</Link>
          </p>
        </section>
      </main>
    </div>
  );
};

export default EisenhowerToolPage;
