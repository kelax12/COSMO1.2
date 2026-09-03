import React from 'react';
import { Link } from 'react-router';
import { ArrowRight, Clock } from 'lucide-react';
import { useSeoMeta } from '@/lib/useSeoMeta';
import { ARTICLES } from '@/content/blog/index.mjs';
import { formatDate } from '@/i18n/format';
import { useT } from '@/i18n/useT';

const formatArticleDate = (iso: string) =>
  formatDate(new Date(iso + 'T00:00:00'), { day: 'numeric', month: 'long', year: 'numeric' });

const BlogIndexPage: React.FC = () => {
  const { t } = useT('landing');
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
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
            <img src="/logo-128.webp" alt="Cosmo" className="w-7 h-7 rounded-lg object-contain" />
            <span className="font-semibold text-white">Cosmo</span>
          </Link>
          <Link to="/signup" className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1.5">
            {t('blog.createFreeAccount')}
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3 text-white">{t('blog.title')}</h1>
        <p className="text-slate-400 mb-12">
          {t('blog.indexIntro')}
        </p>

        <div className="space-y-6">
          {ARTICLES.map((article) => (
            <Link
              key={article.slug}
              to={`/blog/${article.slug}`}
              className="block rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors p-6 group"
            >
              <h2 className="text-xl font-bold text-white group-hover:text-blue-300 transition-colors mb-2">
                {article.title}
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">{article.description}</p>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <time dateTime={article.datePublished}>{formatArticleDate(article.datePublished)}</time>
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {article.readingMinutes} min de lecture
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
