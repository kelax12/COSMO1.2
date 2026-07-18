import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight, ChevronRight, Clock } from 'lucide-react';
import { useSeoMeta } from '@/lib/useSeoMeta';
import { getArticle } from '@/content/blog/index.mjs';

const formatDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

const BlogArticlePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const article = slug ? getArticle(slug) : undefined;

  useSeoMeta({
    title: article ? `${article.metaTitle} | Blog Cosmo` : 'Blog Cosmo',
    description: article?.description,
    canonical: article ? `https://thecosmo.app/blog/${article.slug}` : undefined,
  });

  if (!article) return <Navigate to="/blog" replace />;

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm shrink-0">
              <img src="/logo.png" alt="Cosmo" className="w-7 h-7 rounded-lg object-contain" />
              <span className="font-semibold text-white">Cosmo</span>
            </Link>
            <ChevronRight size={14} className="text-slate-600 shrink-0" />
            <Link to="/blog" className="text-sm text-slate-400 hover:text-white transition-colors truncate">
              Blog
            </Link>
          </div>
          <Link to="/signup" className="text-sm text-slate-400 hover:text-white transition-colors items-center gap-1.5 hidden sm:flex shrink-0">
            Créer un compte gratuit
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <article>
          <header className="mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight mb-4 text-white [text-wrap:balance]">
              {article.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <time dateTime={article.datePublished}>{formatDate(article.datePublished)}</time>
              <span className="flex items-center gap-1">
                <Clock size={14} />
                {article.readingMinutes} min de lecture
              </span>
            </div>
          </header>

          {/* Contenu maison (src/content/blog/*.mjs), pas de données utilisateur */}
          <div className="blog-prose" dangerouslySetInnerHTML={{ __html: article.html }} />
        </article>

        <aside className="mt-16 rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8 text-center">
          <p className="text-lg font-semibold mb-2">Essayez Cosmo gratuitement</p>
          <p className="text-slate-400 text-sm mb-5">
            Tâches, habitudes, agenda et OKR dans une seule application. Démo instantanée, sans inscription.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-slate-900 font-semibold hover:bg-slate-200 transition-colors"
          >
            Commencer gratuitement
            <ArrowRight size={16} />
          </Link>
        </aside>
      </main>
    </div>
  );
};

export default BlogArticlePage;
