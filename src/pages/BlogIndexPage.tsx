import React from 'react';
import { Link } from 'react-router';
import { ArrowRight, Clock } from 'lucide-react';
import { useSeoMeta } from '@/lib/useSeoMeta';
import { servedArticles } from '@/content/blog/index.mjs';
import { formatDate } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { useForcedLightTheme } from '@/hooks/use-forced-light-theme';

const formatArticleDate = (iso: string) =>
  formatDate(new Date(iso + 'T00:00:00'), { day: 'numeric', month: 'long', year: 'numeric' });

const BlogIndexPage: React.FC = () => {
  useForcedLightTheme();
  const { t, locale } = useT('landing');
  // `servedArticles` et non `articlesFor` : l'index ne doit pas RÉTRÉCIR dans
  // une langue où un article n'est pas encore traduit, il le sert en français.
  // Le prérendu, lui, est strict et n'annonce que ce qui existe.
  const articles = servedArticles(locale);
  // Les titres et descriptions vivent DEJA dans `seo.json` : le prerendu les
  // lit depuis ce catalogue, la page les recopiait a cote. Deux sources pour
  // la meme balise, c'est une occasion de les laisser diverger.
  const { t: tSeo } = useT('seo');
  useSeoMeta({
    title: tSeo('blog.title'),
    description: tSeo('blog.description'),
    canonical: 'https://thecosmo.app/blog',
  });

  return (
    <div className="min-h-[100dvh] bg-white text-slate-900">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-900/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-sm">
            <img src="/logo-128.webp" alt="Cosmo" className="w-7 h-7 rounded-lg object-contain" />
            <span className="font-semibold text-slate-900">Cosmo</span>
          </Link>
          <Link to="/signup" className="text-sm text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5">
            {t('blog.createFreeAccount')}
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3 text-slate-900">{t('blog.title')}</h1>
        <p className="text-slate-500 mb-12">
          {t('blog.indexIntro')}
        </p>

        <div className="space-y-6">
          {articles.map((article) => (
            <Link
              key={article.slug}
              to={`/blog/${article.slug}`}
              className="block rounded-2xl border border-slate-900/10 bg-slate-50 hover:bg-slate-100 transition-colors p-6 group"
            >
              <h2
                className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors mb-2"
                lang={article.contentLocale}
              >
                {article.title}
              </h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-4" lang={article.contentLocale}>
                {article.description}
              </p>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <time dateTime={article.datePublished}>{formatArticleDate(article.datePublished)}</time>
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {t('blog.readingTime', { minutes: String(article.readingMinutes) })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
};

export default BlogIndexPage;
