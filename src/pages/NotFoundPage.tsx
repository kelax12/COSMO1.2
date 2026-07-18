import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useSeoMeta } from '@/lib/useSeoMeta';

// Vraie page 404 (au lieu d'un Navigate vers la home qui produisait des
// soft-404 : toute URL inconnue renvoyait la home en HTTP 200). Le statut
// HTTP reste 200 (SPA + rewrite Vercel), mais le meta robots noindex posé
// ci-dessous suffit à Google (qui rend le JS) pour exclure ces URLs.
const NotFoundPage: React.FC = () => {
  useSeoMeta({
    title: 'Page introuvable – Cosmo',
    description: "Cette page n'existe pas ou a été déplacée.",
  });

  // noindex le temps de la 404, restauré au démontage (la valeur par défaut
  // d'index.html est "index, follow, ...").
  useEffect(() => {
    const el = document.querySelector('meta[name="robots"]');
    const previous = el?.getAttribute('content') ?? null;
    el?.setAttribute('content', 'noindex');
    return () => {
      if (el && previous) el.setAttribute('content', previous);
    };
  }, []);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="text-7xl font-bold text-slate-700 mb-4">404</p>
        <h1 className="text-2xl sm:text-3xl font-bold mb-3">Page introuvable</h1>
        <p className="text-slate-400 mb-8">
          Cette page n'existe pas ou a été déplacée. Vérifiez l'adresse, ou repartez de l'accueil.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-slate-900 font-semibold hover:bg-slate-200 transition-colors"
          >
            <ArrowLeft size={18} />
            Retour à l'accueil
          </Link>
          <Link to="/guide" className="text-slate-400 hover:text-white transition-colors">
            Voir le guide
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
