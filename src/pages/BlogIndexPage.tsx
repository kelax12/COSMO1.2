import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock } from 'lucide-react';
import { useSeoMeta } from '@/lib/useSeoMeta';
import { ARTICLES } from '@/content/blog/index.mjs';

const formatDate = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

const BlogIndexPage: React.FC = () => {
  useSeoMeta({
    title: 'Blog Cosmo — Productivité, OKR, habitudes et time-blocking',
    description:
      'Guides pratiques sur la méthode OKR, le suivi d’habitudes, le time-blocking et la productivité personnelle. Par l’équipe de Cosmo.',
    canonical: 'https://thecosmo.app/blog',
  });

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm">
            <img src="/logo.png" alt="Cosmo" className="w-7 h-7 rounded-lg object-contain" />
            <span className="font-semibold text-white">Cosmo</span>
          </Link>
          <Link to="/signup" className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1.5">
            Créer un compte gratuit
            <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <h1 className="text-3xl sm:text-4xl font-bold mb-3 text-white">Le blog Cosmo</h1>
        <p className="text-slate-400 mb-12">
          Guides pratiques sur la méthode OKR, les habitudes, le time-blocking et la productivité — sans bullshit.
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
                <time dateTime={article.datePublished}>{formatDate(article.datePublished)}</time>
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
