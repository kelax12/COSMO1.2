import React from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { ArrowRight, ChevronRight, Clock } from 'lucide-react';
import { useSeoMeta } from '@/lib/useSeoMeta';
import { canonicalUrl } from '@/i18n/routes';
import { getArticle, relatedArticles } from '@/content/blog/index.mjs';
import { formatDate } from '@/i18n/format';
import { useT } from '@/i18n/useT';
import { useForcedLightTheme } from '@/hooks/use-forced-light-theme';

const formatArticleDate = (iso: string) =>
  formatDate(new Date(iso + 'T00:00:00'), { day: 'numeric', month: 'long', year: 'numeric' });

const BlogArticlePage: React.FC = () => {
  useForcedLightTheme();
  const { t, locale } = useT('landing');
  const { slug } = useParams<{ slug: string }>();
  // Le slug ne se traduit pas : /en/blog/<slug> est la version anglaise du MÊME
  // article. `getArticle` sert la langue demandée, ou le français si l'article
  // n'est pas encore traduit, et dit laquelle par `contentLocale`.
  const article = slug ? getArticle(slug, locale) : undefined;

  useSeoMeta({
    // Sans suffixe de marque — doit rester identique au prérendu
    // (prerender/ → ROUTES des articles), sinon le titre change au mount.
    title: article ? article.metaTitle : 'Blog Cosmo',
    description: article?.description,
    canonical: article ? canonicalUrl(`/blog/${article.slug}`, locale) : undefined,
  });

  if (!article) return <Navigate to="/blog" replace />;

  return (
    <div className="min-h-[100dvh] bg-white text-slate-900">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-900/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-sm shrink-0">
              <img src="/logo-128.webp" alt="Cosmo" className="w-7 h-7 rounded-lg object-contain" />
              <span className="font-semibold text-slate-900">Cosmo</span>
            </Link>
            <ChevronRight size={14} className="text-slate-400 shrink-0" />
            <Link to="/blog" className="text-sm text-slate-500 hover:text-slate-900 transition-colors truncate">
              Blog
            </Link>
          </div>
          <Link to="/signup" className="text-sm text-slate-500 hover:text-slate-900 transition-colors items-center gap-1.5 hidden sm:flex shrink-0">
            {t('blog.createFreeAccount')}
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <article>
          <header className="mb-10">
            <h1
              className="text-3xl sm:text-4xl font-bold leading-tight mb-4 text-slate-900 [text-wrap:balance]"
              lang={article.contentLocale}
            >
              {article.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <time dateTime={article.datePublished}>{formatArticleDate(article.datePublished)}</time>
              <span className="flex items-center gap-1">
                <Clock size={14} />
                {t('blog.readingTime', { minutes: String(article.readingMinutes) })}
              </span>
            </div>
          </header>

          {/* Contenu maison (src/content/blog/*.mjs), pas de données utilisateur */}
          {/* `lang` porte la langue RÉELLEMENT rendue : servir du français est
              acceptable, le déclarer anglais ne l'est pas (lecteurs d'écran,
              moteurs). */}
          <div
            className="blog-prose"
            lang={article.contentLocale}
            dangerouslySetInnerHTML={{ __html: article.html }}
          />
        </article>

        <nav aria-label={t('blog.readNext')} className="mt-16">
          <h2 className="text-lg font-bold text-slate-900 mb-4">{t('blog.readNext')}</h2>
          <div className="space-y-3">
            {relatedArticles(article, locale).map((a) => (
              <Link
                key={a.slug}
                to={`/blog/${a.slug}`}
                className="block rounded-xl border border-slate-900/10 bg-slate-50 hover:bg-slate-100 transition-colors px-5 py-4"
              >
                <span className="font-medium text-slate-900" lang={a.contentLocale}>
                  {a.title}
                </span>
                <span className="block text-xs text-slate-500 mt-1">
                  {t('blog.readingTime', { minutes: String(a.readingMinutes) })}
                </span>
              </Link>
            ))}
          </div>
        </nav>

        <aside className="mt-10 rounded-2xl border border-slate-900/10 bg-slate-50 p-6 sm:p-8 text-center">
          <p className="text-lg font-semibold mb-2">{t('blog.tryFree')}</p>
          <p className="text-slate-500 text-sm mb-5">
            {t('blog.ctaPitch')}
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
          >
            {t('blog.startFree')}
            <ArrowRight size={16} />
          </Link>
        </aside>
      </main>
    </div>
  );
};

export default BlogArticlePage;
