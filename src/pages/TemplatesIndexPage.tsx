import React from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { useSeoMeta } from '@/lib/useSeoMeta';
import { servedArticles } from '@/content/blog/index.mjs';
import { useT } from '@/i18n/useT';
import { articleSlug, canonicalUrl } from '@/i18n/routes';
import { useForcedLightTheme } from '@/hooks/use-forced-light-theme';

// Galerie des modèles (plan SEO C5). Chaque modèle est un article du registre
// du blog marqué `kind: "modele"` : cette page ne fait que les regrouper.
const ORDRE = ['okr', 'habitudes', 'planning', 'methode'] as const;

const TemplatesIndexPage: React.FC = () => {
  useForcedLightTheme();
  const { t, locale } = useT('landing');
  const { t: tSeo } = useT('seo');
  const modeles = servedArticles(locale).filter((a) => a.kind === 'modele');
  useSeoMeta({
    title: tSeo('templates.title'),
    description: tSeo('templates.description'),
    canonical: canonicalUrl('/modeles', locale),
  });

  return (
    <div className="min-h-[100dvh] bg-white text-slate-900">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-900/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-sm">
            <img src="/logo-128.webp" alt="Cosmo" className="w-7 h-7 rounded-lg object-contain" />
            <span className="font-semibold text-slate-900">Cosmo</span>
          </Link>
          <Link to="/signup" data-cta="modeles-signup-entete" className="text-sm text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5">
            {t('blog.createFreeAccount')}
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3 text-slate-900">{t('templates.title')}</h1>
        <p className="text-slate-500 mb-12">{t('templates.intro')}</p>

        {ORDRE.map((categorie) => {
          const liste = modeles.filter((m) => m.categorie === categorie);
          if (liste.length === 0) return null;
          return (
            <section key={categorie} className="mb-12">
              <h2 className="text-xl font-bold text-slate-900 mb-4 pb-2 border-b border-slate-900/10">
                {t(`templates.category.${categorie}`)}
              </h2>
              <div className="space-y-4">
                {liste.map((m) => (
                  <Link
                    key={m.slug}
                    to={`/blog/${articleSlug(m.slug, locale)}`}
                    className="block rounded-2xl border border-slate-900/10 bg-slate-50 hover:bg-slate-100 transition-colors p-5 group"
                  >
                    <h3 className="text-lg font-semibold text-slate-900 group-hover:text-blue-600 transition-colors mb-1" lang={m.contentLocale}>
                      {m.title}
                    </h3>
                    <p className="text-slate-500 text-sm leading-relaxed" lang={m.contentLocale}>
                      {m.description}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
};

export default TemplatesIndexPage;
